import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { Block } from '@genoffice/docx-engine'
import { AgentLoop, composeSkills, type AgentImage } from '@genoffice/agent-core'
import type { AiSettings, AttachmentAddResult, AttachmentMeta } from '../../shared/ipc'
import { ATTACHMENT_IMAGE_EXTS } from '../../shared/ipc'
import type { PmNode } from '../editor/convert'
import { findNumId, type NumIds } from './protocol'
import { markDocSeen } from './tools'
import { createDocsSkill } from './docs-skill'
import { applyRevisionsBy } from '../editor/revisions'
import { DOCS_AGENT_MAX_TURNS, DOCS_CONTINUE_INSTRUCTION } from './continuation'
import { createFilesSkill } from './files-skill'
import {
  createKnowledgeSkill,
  createSkillsSkill,
  resolveSlashCommand,
} from '@genoffice/agent-core'
import { createElectronTransport } from './transport'
import { useI18n, t as tModule, aiLangDirective, type StringKey } from '../i18n/locale'
import { Markdown } from '@genoffice/ui'
import { AiComposer, AiTypingIndicator, formatChatTimestamp } from '@genoffice/ui'
import { GensparkMark } from '../components/icons'
import sendEnterOn from '../assets/send-enter-on.png'
import sendEnterOff from '../assets/send-enter-off.png'
import sendStop from '../assets/send-stop.png'
import attachIcon from '../assets/attach-icon.png'
import {
  IconClock,
  IconNewChat,
  IconPaperclip,
  IconRefresh,
  IconSidebarCollapse,
  IconTrash,
} from '../components/icons'

interface Snapshot {
  label: string
  time: string
  json: PmNode
}

interface ToolActivity {
  name: string
  summary: string
  /** still executing: rendered as a spinner chip, replaced in place when the tool finishes */
  running?: boolean
  isError?: boolean
  /** Tool output (truncated on the UI side); when set, the row can be expanded for details */
  output?: string
}

/** Max characters of tool output in the UI expansion panel */
const TOOL_OUTPUT_MAX_CHARS = 2000

/** Cap on tool args/output persisted in the transcript (the store layer has another 16k truncation fallback) */
const PERSIST_TOOL_FIELD_MAX = 16_000

/** Tool args → JSON string (truncated; returns undefined on serialization failure, doesn't block persistence) */
function safeJsonInput(input: unknown): string | undefined {
  try {
    const s = JSON.stringify(input)
    return s && s !== '{}' ? s.slice(0, PERSIST_TOOL_FIELD_MAX) : undefined
  } catch {
    return undefined
  }
}

interface ChatEntry {
  role: 'user' | 'assistant'
  text: string
  error?: string
  streaming?: boolean
  turnLimit?: boolean
  /** the run failed and this user message was rolled back out of the model context */
  undelivered?: boolean
  /** the run failed because Genspark is signed out — render an inline sign-in button */
  loginRequired?: boolean
  /** tool executions performed during this assistant turn */
  tools?: ToolActivity[]
}

/** clickable starter prompts for the empty state (fill the input, do not send) —
 * blank documents get generation starters, documents with content get edit starters */
const DRAFT_STARTER_PROMPTS: StringKey[] = [
  'aiStarterWeeklyReport',
  'aiStarterLaunchPost',
  'aiStarterEventOutline',
]
const EDIT_STARTER_PROMPTS: StringKey[] = [
  'aiStarterSummarize',
  'aiStarterPolishAll',
  'aiStarterContinue',
]

/** resizable panel width: persisted, clamped so neither pane collapses */
const PANEL_WIDTH_KEY = 'docs-ai-panel-width'
const PANEL_WIDTH_DEFAULT = 360
const PANEL_WIDTH_MIN = 280

function maxPanelWidth(): number {
  return Math.min(720, Math.round(window.innerWidth * 0.6))
}

function clampPanelWidth(w: number): number {
  return Math.min(Math.max(w, PANEL_WIDTH_MIN), maxPanelWidth())
}

function loadPanelWidth(): number {
  const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY))
  return Number.isFinite(saved) && saved > 0 ? clampPanelWidth(saved) : PANEL_WIDTH_DEFAULT
}

/** persisted UI preference: highlight AI edits in yellow and ask for confirmation */
const TRACK_CHANGES_KEY = 'ai-docs-track-changes'

/** Clipboard bitmap MIME → attachment extension (corresponds to ATTACHMENT_IMAGE_EXTS) */
const PASTE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** author name on AI-generated tracked revisions (accept/reject via Review) */
export const AI_REVISION_AUTHOR = 'AI Assistant'

interface AiPanelProps {
  editor: Editor
  blocks: Block[]
  settings: AiSettings
  /** the document has no text yet — the empty-state copy offers drafting instead of editing */
  docEmpty?: boolean
  /** fallback numbering ids for documents created from the blank template */
  numIdFallback?: NumIds | null
  /** preset instruction pushed from the ribbon or start screen; autoRun sends it immediately */
  preset?: { text: string; nonce: number; autoRun?: boolean } | null
  /** false shows only the collapsed rail; the component stays mounted so panel state survives */
  open?: boolean
  /** expand from the collapsed rail */
  onExpand?: () => void
  /** collapse the panel to the sidebar rail */
  onCollapse?: () => void
  /** Absolute path of the currently open file (used for chat-history persistence) */
  filePath?: string | null
}

export function AiPanel({
  editor,
  blocks,
  settings,
  docEmpty,
  numIdFallback,
  preset,
  open = true,
  onExpand,
  onCollapse,
  filePath,
}: AiPanelProps) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  /** Wall-clock start of the current run, drives the elapsed badge */
  const runStartedAtRef = useRef(0)
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [isGrammarChecking, setIsGrammarChecking] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [trackChanges, setTrackChanges] = useState(
    () => localStorage.getItem(TRACK_CHANGES_KEY) === '1',
  )
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  /** chat content zoom, controlled by the +A / -A header buttons (0.75x–1.6x) */
  const [chatFontZoom, setChatFontZoom] = useState(1)
  const adjustChatFontZoom = (delta: number) =>
    setChatFontZoom((z) => Math.min(1.6, Math.max(0.75, Math.round((z + delta) * 10) / 10)))
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([])
  const [showKbMenu, setShowKbMenu] = useState(false)
  const selectedKbIdRef = useRef(selectedKbId)
  selectedKbIdRef.current = selectedKbId

  const refreshKbList = async () => {
    try {
      const fn =
        (window as any).desktop?.listKnowledgeBases ??
        (window as any).desktopApi?.listKnowledgeBases ??
        (window as any).pdfApi?.listKnowledgeBases ??
        (window as any).aiOffice?.knowledge?.listKnowledgeBases
      if (typeof fn === 'function') {
        const result = await fn()
        if (Array.isArray(result) && result.length > 0) {
          setKnowledgeBases(result)
        }
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void refreshKbList()
  }, [])

  const effectiveKbList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const kb of knowledgeBases) {
      if (kb?.id && kb?.name) map.set(kb.id, kb)
    }
    return Array.from(map.values())
  }, [knowledgeBases])
  const [attachNotice, setAttachNotice] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth)
  const [resizing, setResizing] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  // The .ai-dock wrapper owns the animated width (Excel-parity 180ms slide);
  // it tracks the resizable panel width through this variable
  // `open` dep: the aside ref only exists while expanded
  useEffect(() => {
    const dock = asideRef.current?.closest('.ai-dock') as HTMLElement | null
    dock?.style.setProperty('--ai-panel-width', `${panelWidth}px`)
  }, [panelWidth, open])

  // Re-clamp the persisted width when the window shrinks (max is 60% of the window)
  useEffect(() => {
    const onResize = () => setPanelWidth((w) => clampPanelWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  /** Past conversation restored from JSONL (read-only transcript, not fed to the model) */
  const [historicChat, setHistoricChat] = useState<ChatEntry[]>([])
  // bumped on selection/doc changes so the scope hint & quick actions stay fresh
  const [, setScopeTick] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** false once the user scrolls up to read; re-arms near the bottom */
  const stickToBottomRef = useRef(true)
  /** projectId/chatId of the current chat */
  const chatRefIds = useRef<{ projectId: string; chatId: string } | null>(null)

  // latest props for the loop's closures (the loop instance outlives renders)
  const editorRef = useRef(editor)
  editorRef.current = editor
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const numIdFallbackRef = useRef(numIdFallback)
  numIdFallbackRef.current = numIdFallback
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments
  const trackChangesRef = useRef(trackChanges)
  trackChangesRef.current = trackChanges

  /** drop every aiChanged flag; silent = skip undo history (auto-accept path) */
  const clearAiHighlights = (silent = false) => {
    const view = editorRef.current.view
    let tr = view.state.tr
    let touched = false
    view.state.doc.forEach((node, offset) => {
      if (node.attrs.aiChanged) {
        tr = tr.setNodeMarkup(offset, undefined, { ...node.attrs, aiChanged: false })
        touched = true
      }
    })
    if (silent) tr = tr.setMeta('addToHistory', false)
    if (touched) {
      view.dispatch(tr)
      // AI-pipeline housekeeping, not a user edit: keep the freshness baseline current
      markDocSeen(editorRef.current)
    }
  }
  /** instruction of the in-flight run, labels its rollback snapshot */
  const instructionRef = useRef('')
  /** last sent instruction, for one-click retry */
  const lastInstructionRef = useRef('')
  /** Tool activity of the whole run (with args/output, accumulated across turns) — for full
      transcript persistence, and so persisting needn't do side effects inside a setState updater */
  const runToolsRef = useRef<
    Array<{ name: string; summary: string; isError?: boolean; input?: string; output?: string }>
  >([])

  // ── Chat-history persistence ────────────────────────────────────────────
  /** The document's conversations (newest first), for the previous-chats picker */
  const [chatList, setChatList] = useState<Array<{ chatId: string; createdAt: string; preview?: string }>>([])
  const [chatPickerOpen, setChatPickerOpen] = useState(false)
  /** saved slash-command skills for the composer picker */
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string }>>([])

  useEffect(() => {
    ;(window as any).desktop?.listSkills?.().then((list: unknown) => {
      if (Array.isArray(list)) setSkills(list)
    }).catch(() => {
      /* silent */
    })
  }, [])

  const refreshChatList = () => {
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (!api?.listChats) return
    void api
      .listChats({ filePath: filePath ?? null })
      .then((list) => setChatList(Array.isArray(list) ? list : []))
      .catch(() => {
        /* silent */
      })
  }

  useEffect(() => {
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (!api) return
    const tempChatId = `unsaved-${Date.now()}`
    void api
      .resolveChat({ filePath: filePath ?? null, tempChatId })
      .then((ids) => {
        chatRefIds.current = ids
        void refreshChatList()
        return api.loadChat({ projectId: ids.projectId, chatId: ids.chatId, limit: 200 })
      })
      .then((msgs) => {
        if (msgs.length === 0) return
        setHistoricChat(
          msgs.map((m) => ({
            role: m.role,
            text: m.text,
            tools: m.tools?.map((t) => ({
              name: t.name,
              summary: t.summary,
              isError: t.isError,
              output: t.output ? t.output.slice(0, TOOL_OUTPUT_MAX_CHARS) : undefined,
            })),
          })),
        )
        // restore model context: follow-ups after reopening a file continue the previous conversation (only when the loop is idle with no history)
        loopRef.current?.restore(msgs.map((m) => ({ role: m.role, text: m.text })))
      })
      .catch(() => {
        /* history load failures are silent */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** After an unsaved document's first save yields a real path, bind the unsaved-* history to that file (recoverable by path on reopen) */
  useEffect(() => {
    const ids = chatRefIds.current
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (!api || !ids || !filePath || !ids.chatId.startsWith('unsaved-')) return
    void api
      .rebindChat({ projectId: ids.projectId, tempChatId: ids.chatId, newFilePath: filePath })
      .then((r) => {
        if (r?.chatId) chatRefIds.current = r
      })
      .catch(() => {
        /* silent */
      })
  }, [filePath])

  const persistMessage = (
    role: 'user' | 'assistant',
    text: string,
    tools?: Array<{
      name: string
      summary: string
      isError?: boolean
      input?: string
      output?: string
    }>,
    attachments?: AttachmentMeta[],
  ) => {
    const ids = chatRefIds.current
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (!ids || !api) return
    void api
      .appendChat({
        projectId: ids.projectId,
        chatId: ids.chatId,
        role,
        text,
        ...(tools && tools.length > 0 ? { tools } : {}),
        ...(attachments && attachments.length > 0
          ? {
              attachments: attachments.map((a) => ({
                name: a.name,
                path: a.path,
                ext: a.ext,
                sizeBytes: a.sizeBytes,
              })),
            }
          : {}),
      })
      .catch(() => {
        /* silent */
      })
  }

  const patchLastAssistant = (
    patch: Partial<ChatEntry> | ((last: ChatEntry) => Partial<ChatEntry>),
  ) => {
    setChat((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (!last || last.role !== 'assistant') return prev
      next[next.length - 1] = { ...last, ...(typeof patch === 'function' ? patch(last) : patch) }
      return next
    })
  }

  const loopRef = useRef<AgentLoop<PmNode> | null>(null)
  if (!loopRef.current) {
    const numIds = (): NumIds => ({
      bullet: findNumId(blocksRef.current, 'bullet') ?? numIdFallbackRef.current?.bullet ?? null,
      ordered: findNumId(blocksRef.current, 'ordered') ?? numIdFallbackRef.current?.ordered ?? null,
    })
    loopRef.current = new AgentLoop<PmNode>({
      transport: createElectronTransport(() => settingsRef.current),
      systemSuffix: aiLangDirective,
      maxTurns: DOCS_AGENT_MAX_TURNS,
      skill: composeSkills('docs+files+knowledge+skills', '', [
        createDocsSkill(
          () => editorRef.current,
          numIds,
          () => (trackChangesRef.current ? { author: AI_REVISION_AUTHOR } : undefined),
        ),
        createFilesSkill(() => attachmentsRef.current),
        createKnowledgeSkill(
          (query, kbId, topK) =>
            (window as any).desktop?.searchKnowledgeBase?.(query, kbId, topK) ?? Promise.resolve([]),
          () => selectedKbIdRef.current || undefined,
          (kbId) => (window as any).desktop?.listKnowledgeDocuments?.(kbId) ?? Promise.resolve([]),
          (docId, offset, maxChars) =>
            (window as any).desktop?.readKnowledgeDocument?.(docId, offset, maxChars) ??
            Promise.resolve({ ok: false }),
        ),
        createSkillsSkill(
          () =>
            (window as any).desktop?.listSkills?.() ?? Promise.resolve([]),
          (name) =>
            (window as any).desktop?.getSkill?.(name) ?? Promise.resolve(null),
        ),
      ]),
      captureSnapshot: () => editorRef.current.getJSON() as PmNode,
      events: {
        onText: (text) => patchLastAssistant({ text }),
        onToolStart: (call) => {
          // Live "running" chip: replaced in place by onToolExecuted
          patchLastAssistant((last) => ({
            tools: [
              ...(last.tools ?? []),
              { name: call.name, summary: call.name.replace(/[_-]+/g, ' '), running: true },
            ],
          }))
        },
        onToolExecuted: ({ call, execution, snapshotBefore }) => {
          if (snapshotBefore) {
            setSnapshots((prev) =>
              [
                {
                  label: instructionRef.current.slice(0, 40),
                  time: new Date().toLocaleTimeString(),
                  json: snapshotBefore,
                },
                ...prev,
              ].slice(0, 20),
            )
          }
          if (execution.mutated) {
            // tracking off: accept immediately (same tick, so the yellow never paints);
            // tracking on: revisions stay pending, handled in the Review tab
            if (!trackChangesRef.current) clearAiHighlights(true)
          }
          runToolsRef.current.push({
            name: call.name,
            summary: execution.summary,
            isError: execution.isError,
            input: safeJsonInput(call.input),
            output: execution.output
              ? execution.output.slice(0, PERSIST_TOOL_FIELD_MAX)
              : undefined,
          })
          patchLastAssistant((last) => {
            // Swap out the running placeholder pushed by onToolStart (parse-fail calls have none)
            const tools = [...(last.tools ?? [])]
            if (tools.at(-1)?.running) tools.pop()
            return {
              tools: [
                ...tools,
                {
                  name: call.name,
                  summary: execution.summary,
                  isError: execution.isError,
                  output: execution.output
                    ? execution.output.slice(0, TOOL_OUTPUT_MAX_CHARS)
                    : undefined,
                },
              ],
            }
          })
        },
        onTurnEnd: () => {
          patchLastAssistant({ streaming: false })
          setChat((prev) => [...prev, { role: 'assistant', text: '', streaming: true }])
        },
        onDone: ({ text, cancelled, turnLimit, truncated }) => {
          // module-level t: the loop instance is created only once; the component's t goes stale with the first-render closure
          const baseText = turnLimit
            ? [text, tModule('aiTurnLimit')].filter(Boolean).join('\n\n')
            : text || (cancelled ? tModule('aiStopped') : '')
          const finalText = truncated
            ? [baseText, tModule('aiTruncatedNote')].filter(Boolean).join('\n\n')
            : baseText
          patchLastAssistant((last) => ({
            streaming: false,
            turnLimit,
            text: finalText || (last.tools?.length ? last.text : tModule('aiNoReply')),
            // A stop mid-tool can leave a running placeholder behind — drop it
            tools: last.tools?.filter((tl) => !tl.running),
          }))
          setBusy(false)
          // App listens: a run that generated content into a never-saved document
          // triggers a silent first save with a content-derived file name
          window.dispatchEvent(new Event('ai-docs-run-done'))
          // persist outside the updater (a double-invoked updater would write history twice); tools stores the whole run's full activity.
          // Edits-only runs (tools ran, no text) persist too, or the whole turn vanishes from the restored transcript
          if (!cancelled && (finalText || runToolsRef.current.length > 0)) {
            persistMessage('assistant', finalText, runToolsRef.current)
          }
        },
        onError: (error) => {
          setChat((prev) => {
            const next = [...prev]
            // the loop rolled this run's user message out of the model context — surface that
            for (let i = next.length - 1; i >= 0; i--) {
              const entry = next[i]!
              if (entry.role === 'user') {
                next[i] = { ...entry, undelivered: true }
                break
              }
            }
            const last = next.at(-1)
            if (last?.role === 'assistant') {
              next[next.length - 1] = {
                ...last,
                streaming: false,
                error,
                tools: last.tools?.filter((tl) => !tl.running),
              }
            }
            return next
          })
          setBusy(false)
        },
      },
    })
  }

  useEffect(() => {
    if (!preset) return
    if (preset.autoRun) runWith(preset.text)
    else {
      setInput(preset.text)
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.nonce])

  // keep the scope hint & quick actions in sync with the editor selection
  useEffect(() => {
    const bump = () => setScopeTick((t) => t + 1)
    editor.on('selectionUpdate', bump)
    editor.on('update', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('update', bump)
    }
  }, [editor])

  // follow the stream, but stop yanking once the user scrolls up to read;
  // `open` dep: re-expanding lands on messages streamed while collapsed
  useEffect(() => {
    if (stickToBottomRef.current) {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
    }
  }, [chat, open])

  const onLogScroll = () => {
    const el = logRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  const run = () => {
    const raw = input.trim()
    if (!raw) return
    if (raw.startsWith('/')) {
      void resolveSlashCommand(raw, (name) =>
        (window as any).desktop?.getSkill?.(name) ?? Promise.resolve(null),
      ).then(({ instruction, applied }) => runWith(instruction, applied ? raw : instruction))
      return
    }
    runWith(raw)
  }

  /** Image attachments are read as base64 and go multimodal with this user message (≤5MB per image, max 20) */
  const MAX_IMAGES_PER_MESSAGE = 20
  const collectImageAttachments = async (): Promise<AgentImage[]> => {
    const imageAtts = attachmentsRef.current.filter((a) => ATTACHMENT_IMAGE_EXTS.has(a.ext))
    const images: AgentImage[] = []
    const failures: string[] = []
    for (const att of imageAtts.slice(0, MAX_IMAGES_PER_MESSAGE)) {
      const result = await window.desktop.readAttachmentImage(att.path)
      if (result.ok && result.base64 && result.mime) {
        images.push({ base64: result.base64, mime: result.mime })
      } else {
        failures.push(result.error ?? t('aiImageReadFail', { name: att.name }))
      }
    }
    if (imageAtts.length > MAX_IMAGES_PER_MESSAGE) {
      failures.push(t('aiTooManyImages', { max: MAX_IMAGES_PER_MESSAGE }))
    }
    if (failures.length > 0) {
      setAttachNotice(failures.join(';'))
      window.setTimeout(() => setAttachNotice(null), 5000)
    }
    return images
  }

  const runWith = (instruction: string, displayInstruction = instruction) => {
    const loop = loopRef.current
    if (!instruction || !loop || loop.busy) return
    setInput('')
    instructionRef.current = instruction
    lastInstructionRef.current = instruction
    runToolsRef.current = []
    stickToBottomRef.current = true
    setChat((prev) => [
      ...prev,
      { role: 'user', text: displayInstruction },
      { role: 'assistant', text: '', streaming: true },
    ])
    runStartedAtRef.current = Date.now()
    setBusy(true)
    persistMessage('user', instruction, undefined, attachmentsRef.current)
    // a rejected image read must not strand the run (busy would stay true forever): degrade to a no-image send
    void collectImageAttachments()
      .catch((): AgentImage[] => {
        setAttachNotice(t('aiImagesSendFailed'))
        window.setTimeout(() => setAttachNotice(null), 5000)
        return []
      })
      .then((images) => loop.run(instruction, images))
  }

  const cancel = () => loopRef.current?.cancel()

  const retry = () => runWith(lastInstructionRef.current)

  const continueRun = () => runWith(DOCS_CONTINUE_INSTRUCTION, t('aiContinue'))

  /** Start a brand-new conversation for the document (fresh chatId in project-store). */
  const newChat = () => {
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (!api?.newChat) {
      loopRef.current?.reset()
      setBusy(false)
      setChat([])
      inputRef.current?.focus()
      return
    }
    void api
      .newChat({ filePath: filePath ?? null })
      .then((ids) => {
        chatRefIds.current = ids
        loopRef.current?.reset()
        setBusy(false)
        setChat([])
        setHistoricChat([])
        setInput('')
        void refreshChatList()
        inputRef.current?.focus()
      })
      .catch(() => {
        /* silent */
      })
  }

  /** Switch to a previous conversation of the document and load its history. */
  const selectChat = (chatId: string) => {
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (!api?.selectChat) return
    setChatPickerOpen(false)
    void api
      .selectChat({ filePath: filePath ?? null, chatId })
      .then((ids) => {
        if (!ids) return null
        chatRefIds.current = ids
        loopRef.current?.reset()
        setBusy(false)
        setChat([])
        setHistoricChat([])
        setInput('')
        return api.loadChat({ projectId: ids.projectId, chatId: ids.chatId, limit: 200 })
      })
      .then((msgs) => {
        if (!msgs || msgs.length === 0) return
        setHistoricChat(
          msgs.map((m) => ({
            role: m.role,
            text: m.text,
            tools: m.tools?.map((t) => ({
              name: t.name,
              summary: t.summary,
              isError: t.isError,
              output: t.output ? t.output.slice(0, TOOL_OUTPUT_MAX_CHARS) : undefined,
            })),
          })),
        )
        loopRef.current?.restore(msgs.map((m) => ({ role: m.role, text: m.text })))
      })
      .catch(() => {
        /* silent */
      })
  }

  /** Discard the current conversation; the store re-points the current chat to the most recent remaining one. */
  const clearHistory = () => {
    const ids = chatRefIds.current
    const api = (window as Window & { projectApi?: typeof window.projectApi }).projectApi
    if (ids && api?.clearChat) {
      void api.clearChat({ projectId: ids.projectId, chatId: ids.chatId })
    }
    loopRef.current?.reset()
    setBusy(false)
    setChat([])
    setHistoricChat([])
    setInput('')
    // Follow the store's new current chat (or none) and refresh the picker
    if (api?.resolveChat) {
      void api
        .resolveChat({ filePath: filePath ?? null })
        .then((r) => {
          chatRefIds.current = r
          void refreshChatList()
        })
        .catch(() => {
          /* silent */
        })
    }
  }

  const copyMessage = (text: string, idx: number) => {
    void navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    window.setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1200)
  }

  const mergeAttachments = (result: AttachmentAddResult | null) => {
    if (!result) return
    if (result.accepted.length > 0) {
      setAttachments((prev) => {
        const seen = new Set(prev.map((a) => a.path))
        return [...prev, ...result.accepted.filter((a) => !seen.has(a.path))]
      })
    }
    if (result.rejected.length > 0) {
      setAttachNotice(result.rejected.join(';'))
      window.setTimeout(() => setAttachNotice(null), 5000)
    }
  }

  const pickAttachments = async () => mergeAttachments(await window.desktop.pickAttachments())

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.desktop.getPathForFile(f))
      .filter(Boolean)
    if (paths.length > 0) mergeAttachments(await window.desktop.addAttachmentPaths(paths))
  }

  /** Files pasted into the input: ones with a local path go through regular attachments; pure bitmaps like screenshots hit a temp file first */
  const onPasteFiles = async (files: File[]) => {
    const paths: string[] = []
    for (const f of files) {
      const p = window.desktop.getPathForFile(f)
      if (p) {
        paths.push(p)
        continue
      }
      const ext = PASTE_MIME_EXT[f.type] ?? f.name.split('.').pop()?.toLowerCase() ?? 'bin'
      mergeAttachments(await window.desktop.addPastedImage(await f.arrayBuffer(), ext))
    }
    if (paths.length > 0) mergeAttachments(await window.desktop.addAttachmentPaths(paths))
  }

  const removeAttachment = (path: string) =>
    setAttachments((prev) => prev.filter((a) => a.path !== path))

  const acceptChanges = () => {
    applyRevisionsBy(editorRef.current, AI_REVISION_AUTHOR, 'accept')
    clearAiHighlights()
  }

  const toggleTrackChanges = () => {
    const next = !trackChanges
    setTrackChanges(next)
    localStorage.setItem(TRACK_CHANGES_KEY, next ? '1' : '0')
    // switching off keeps nothing pending: accept whatever is still highlighted
    if (!next) acceptChanges()
  }

  const rollback = (snapshot: Snapshot) => {
    editor.commands.setContent(snapshot.json as never)
    setSnapshots((prev) => prev.filter((s) => s !== snapshot))
  }

  const resizeCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => resizeCleanupRef.current?.(), [])

  /** drag the panel's right edge to resize; panel is flush with the window's left edge */
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const resizer = e.currentTarget
    setResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: PointerEvent) => {
      setPanelWidth(clampPanelWidth(ev.clientX))
    }
    let done = false
    const cleanup = () => {
      if (done) return
      done = true
      resizeCleanupRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      resizer.removeEventListener('lostpointercapture', cleanup)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setResizing(false)
      setPanelWidth((w) => {
        localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(w)))
        return w
      })
    }
    resizeCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    // lostpointercapture also fires if the resizer is unmounted mid-drag (panel collapse)
    resizer.addEventListener('lostpointercapture', cleanup)
    resizer.setPointerCapture(e.pointerId)
  }

  // collapsed: rail only — after all hooks, so the instance and its state survive
  if (!open) {
    return (
      <button className="ai-rail" title={t('appExpandAiPanel')} onClick={onExpand}>
        <GensparkMark size={22} />
      </button>
    )
  }

  return (
    <aside
      ref={asideRef}
      style={{ width: '100%' }}
      className={`ai-panel${dragOver ? ' ai-panel-dragover' : ''}${resizing ? ' ai-panel-resizing' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      <div
        className="ai-panel-resizer"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('aiPanelTitle')}
      />
      <div className="ai-panel-header">
        <span className="ai-panel-title">
          <GensparkMark size={22} />
          {t('aiPanelTitle')}
        </span>
        <div className="ai-panel-header-actions">
          <button
            className="ai-header-btn ai-header-btn-sm"
            onClick={() => adjustChatFontZoom(-0.1)}
            title="Decrease chat font size"
            aria-label="Decrease chat font size"
          >
            -A
          </button>
          <button
            className="ai-header-btn"
            onClick={() => adjustChatFontZoom(0.1)}
            title="Increase chat font size"
            aria-label="Increase chat font size"
          >
            +A
          </button>
          {(chat.length > 0 || historicChat.length > 0 || chatList.length > 0) && (
            <>
              <div className="ai-chat-picker">
                <button
                  className="ai-header-btn"
                  onClick={() => {
                    void refreshChatList()
                    setChatPickerOpen((o) => !o)
                  }}
                  title="Previous chats"
                  aria-label="Previous chats"
                >
                  <IconClock size={15} />
                </button>
                {chatPickerOpen && (
                  <div className="ai-chat-picker-menu">
                    {chatList.length === 0 && (
                      <div className="ai-chat-picker-empty">No previous chats</div>
                    )}
                    {chatList.map((c) => (
                      <button
                        key={c.chatId}
                        className={`ai-chat-picker-item${c.chatId === chatRefIds.current?.chatId ? ' active' : ''}`}
                        onClick={() => selectChat(c.chatId)}
                      >
                        <span className="ai-chat-picker-name">{formatChatTimestamp(c.createdAt)}</span>
                        {c.preview && (
                          <span className="ai-chat-picker-preview">{c.preview}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="ai-header-btn" onClick={newChat} title={t('aiNewChatTitle')}>
                <IconNewChat size={16} />
              </button>
              <button
                className="ai-header-btn"
                onClick={clearHistory}
                title="Clear history"
                aria-label="Clear history"
              >
                <IconTrash size={15} />
              </button>
            </>
          )}
          {onCollapse && (
            <button className="ai-header-btn" onClick={onCollapse} title={t('aiCollapseTitle')}>
              <IconSidebarCollapse size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="ai-panel-body">
        <div
          className="ai-panel-body-inner"
          style={{
            width: `${100 / chatFontZoom}%`,
            height: `${100 / chatFontZoom}%`,
            // only create the composited scale layer when zoomed; at 100% the
            // panel renders natively so rapid chat updates can't flash the grid
            ...(chatFontZoom !== 1 ? { transform: `scale(${chatFontZoom})` } : {}),
          }}
        >
      <div ref={logRef} className="ai-chat" onScroll={onLogScroll}>
        {/* past conversation (read-only transcript, not fed to the model), shown continuously with the current turn */}
        {historicChat.length > 0 && (
          <>
            {historicChat.map((entry, i) => (
              <div key={`h${i}`} className={`ai-msg ai-msg-${entry.role} ai-msg-historic`}>
                {entry.tools && entry.tools.length > 0 && <ToolChipList tools={entry.tools} />}
                {entry.text && <Markdown text={entry.text} />}
                {entry.role === 'user' && entry.text && (
                  <button
                    className="ai-msg-tool-btn"
                    onClick={() => runWith(entry.text)}
                    aria-label="Replay"
                    data-tip="Replay"
                    title="Replay"
                  >
                    <IconRefresh size={12} />
                  </button>
                )}
              </div>
            ))}
            <div className="ai-history-sep">{t('aiHistorySep')}</div>
          </>
        )}
        {chat.length === 0 && historicChat.length === 0 && (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-title">
              {t(docEmpty ? 'aiEmptyDraftTitle' : 'aiEmptyTitle')}
            </div>
            <div className="ai-chat-empty-body">
              {t(docEmpty ? 'aiEmptyDraftBody1' : 'aiEmptyBody1')}
              <br />
              {t(docEmpty ? 'aiEmptyDraftBody2' : 'aiEmptyBody2')}
            </div>
            <div className="ai-starter-list">
              {(docEmpty ? DRAFT_STARTER_PROMPTS : EDIT_STARTER_PROMPTS).map((p) => (
                <button
                  key={p}
                  className="ai-starter"
                  onClick={() => {
                    setInput(t(p))
                    inputRef.current?.focus()
                  }}
                >
                  {t(p)}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((entry, i) => {
          if (
            entry.role === 'assistant' &&
            !entry.text &&
            !entry.streaming &&
            !entry.error &&
            !entry.tools?.length
          ) {
            return null
          }
          const isLast = i === chat.length - 1
          // Action row appears once per completed reply: on the turn's final segment only
          // (mid-turn segments have a following assistant entry; the live turn ends when !busy)
          const nextEntry = chat[i + 1]
          const turnEnded = nextEntry ? nextEntry.role === 'user' : !busy
          const showToolbar =
            entry.role === 'assistant' &&
            !entry.streaming &&
            turnEnded &&
            !!(entry.text || entry.error)
          return (
            <div
              key={i}
              className={`ai-msg ai-msg-${entry.role}${entry.role === 'assistant' && entry.streaming ? ' ai-msg-streaming' : ''}`}
            >
              {entry.role === 'assistant' && !entry.text && entry.streaming ? (
                <span className="ai-typing-row">
                  <AiTypingIndicator
                    label={entry.tools?.length ? t('aiWorking') : t('aiThinking')}
                  />
                </span>
              ) : entry.role === 'assistant' ? (
                <Markdown text={entry.text} />
              ) : (
                entry.text
              )}
              {entry.role === 'user' && entry.undelivered && (
                <div className="ai-msg-undelivered">{t('aiUndelivered')}</div>
              )}
              {entry.tools && entry.tools.length > 0 && <ToolChipList tools={entry.tools} />}
              {entry.error && (
                <div className="ai-msg-error">{t('aiErrorPrefix', { error: entry.error })}</div>
              )}

              {showToolbar && (
                <div className="ai-msg-toolbar">
                  {entry.text && (
                    <button
                      className="ai-msg-tool-btn"
                      onClick={() => copyMessage(entry.text, i)}
                      aria-label={t('aiCopyReplyTitle')}
                      data-tip={t('aiCopyReplyTitle')}
                    >
                      {copiedIdx === i ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M14.6113 5.34253C16.0608 5.3428 17.2363 6.518 17.2363 7.96753V15.5066C17.2361 16.956 16.0607 18.1313 14.6113 18.1316H7.07227C5.62267 18.1316 4.44751 16.9561 4.44727 15.5066V7.96753C4.44732 6.51783 5.62255 5.34253 7.07227 5.34253H14.6113ZM7.07227 6.59253C6.31291 6.59253 5.69732 7.20819 5.69727 7.96753V15.5066C5.69751 16.2658 6.31302 16.8816 7.07227 16.8816H14.6113C15.3703 16.8813 15.9861 16.2656 15.9863 15.5066V7.96753C15.9863 7.20835 15.3705 6.5928 14.6113 6.59253H7.07227ZM10.0176 2.8689C10.3626 2.86905 10.6426 3.14882 10.6426 3.4939C10.6425 3.83888 10.3626 4.11874 10.0176 4.1189H4.59961C3.84022 4.1189 3.22461 4.73451 3.22461 5.4939V11.324C3.22433 11.6689 2.94461 11.949 2.59961 11.949C2.25461 11.949 1.97489 11.6689 1.97461 11.324V5.4939C1.97461 4.04415 3.14987 2.8689 4.59961 2.8689H10.0176Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                  {isLast && !busy && lastInstructionRef.current && (
                    <button
                      className="ai-msg-tool-btn"
                      onClick={retry}
                      aria-label={t('aiRegenerateTitle')}
                      data-tip={t('aiRegenerateTitle')}
                    >
                      <IconRefresh size={12} />
                    </button>
                  )}
                </div>
              )}
              {entry.turnLimit && isLast && !busy && (
                <button className="ai-continue-btn" onClick={continueRun}>
                  {t('aiContinue')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {snapshots.length > 0 && (
        <div className="ai-versions">
          <div className="ai-versions-title">
            <IconClock size={12} />
            {t('aiSnapshotsTitle')}
          </div>
          {snapshots.map((s, i) => (
            <div key={i} className="ai-version-row">
              <span className="ai-version-label" title={s.label}>
                <span className="ai-version-time">{s.time}</span>
                {s.label}
              </span>
              <button className="ai-version-rollback" onClick={() => rollback(s)}>
                {t('aiRollback')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ai-composer">
        {showKbMenu && (
          <div
            style={{
              background: '#fcfcfc',
              borderTop: '1px solid #e0e0e0',
              borderBottom: '1px solid #e0e0e0',
              padding: '12px 14px',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 8,
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 12, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Knowledge Base RAG Options
              </strong>
              <button
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#999', padding: '2px 6px' }}
                onClick={() => setShowKbMenu(false)}
              >
                ×
              </button>
            </div>

            {/* Segmented Control Button Group */}
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 6, padding: 2, border: '1px solid #ddd' }}>
              <button
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: !selectedKbId || selectedKbId === 'NONE' ? 600 : 400,
                  background: !selectedKbId || selectedKbId === 'NONE' ? '#fff' : 'none',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: !selectedKbId || selectedKbId === 'NONE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: !selectedKbId || selectedKbId === 'NONE' ? '#111' : '#666',
                }}
                onClick={() => setSelectedKbId('NONE')}
              >
                Off
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: selectedKbId === 'ALL' ? 600 : 400,
                  background: selectedKbId === 'ALL' ? '#fff' : 'none',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: selectedKbId === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: selectedKbId === 'ALL' ? '#111' : '#666',
                }}
                onClick={() => setSelectedKbId('ALL')}
              >
                All Collections
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: selectedKbId && selectedKbId !== 'ALL' && selectedKbId !== 'NONE' ? 600 : 400,
                  background: selectedKbId && selectedKbId !== 'ALL' && selectedKbId !== 'NONE' ? '#fff' : 'none',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  boxShadow: selectedKbId && selectedKbId !== 'ALL' && selectedKbId !== 'NONE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: selectedKbId && selectedKbId !== 'ALL' && selectedKbId !== 'NONE' ? '#111' : '#666',
                }}
                onClick={() => {
                  const first = effectiveKbList[0]
                  if (first) setSelectedKbId(first.id)
                }}
              >
                Specific Collection
              </button>
            </div>

            {selectedKbId && selectedKbId !== 'ALL' && selectedKbId !== 'NONE' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2, maxHeight: 160, overflowY: 'auto' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>
                  Select Knowledge Base Collections:
                </span>
                {effectiveKbList.map((kb) => {
                  const selectedList = (selectedKbId || '').split(',').filter(Boolean)
                  const isChecked = selectedList.includes(kb.id)

                  return (
                    <label
                      key={kb.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: isChecked ? '#e6f0ff' : '#f8f8f8',
                        border: `1px solid ${isChecked ? '#0066cc' : '#e0e0e0'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let nextList: string[]
                          if (e.target.checked) {
                            nextList = Array.from(new Set([...selectedList, kb.id]))
                          } else {
                            nextList = selectedList.filter((id) => id !== kb.id)
                          }
                          if (nextList.length === 0) {
                            setSelectedKbId('NONE')
                          } else {
                            setSelectedKbId(nextList.join(','))
                          }
                        }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? '#0066cc' : '#333' }}>
                        📁 {kb.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}

        {(attachments.length > 0 || (selectedKbId && selectedKbId !== 'NONE')) && (
          <div className="ai-attachments">
            {selectedKbId && selectedKbId !== 'NONE' && (
              <span className="ai-attachment-chip" style={{ background: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 4 }}>
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                </svg>
                <span>
                  RAG:{' '}
                  {selectedKbId === 'ALL'
                    ? 'All Collections'
                    : (() => {
                        const ids = (selectedKbId || '').split(',').filter(Boolean)
                        const names = ids.map(
                          (id) => effectiveKbList.find((k) => k.id === id)?.name ?? id,
                        )
                        return names.length > 1
                          ? `${names.length} Collections (${names.join(', ')})`
                          : names[0] ?? 'Collection'
                      })()}
                </span>
                <button
                  className="ai-attachment-remove"
                  onClick={() => setSelectedKbId('NONE')}
                  title="Clear Knowledge Base Selection"
                >
                  ×
                </button>
              </span>
            )}
            {attachments.map((a) => (
              <span key={a.path} className="ai-attachment-chip" title={a.path}>
                <IconPaperclip size={11} />
                {a.name}
                <button
                  className="ai-attachment-remove"
                  onClick={() => removeAttachment(a.path)}
                  title={t('aiRemoveAttachmentTitle')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {attachNotice && <div className="ai-attach-notice">{attachNotice}</div>}
        <AiComposer
          value={input}
          busy={busy}
          placeholder={t('aiInputPlaceholder')}
          hintIdle={t('aiHintIdle')}
          hintBusy={t('aiHintBusy')}
          hintIdleTitle={t('aiHintIdleTitle')}
          sendLabel={t('aiSend')}
          stopLabel={t('aiStop')}
          iconOnly
          sendIconEnabled={<img src={sendEnterOn} alt="" aria-hidden />}
          sendIconDisabled={<img src={sendEnterOff} alt="" aria-hidden />}
          stopIcon={<img src={sendStop} alt="" aria-hidden />}
          textareaRef={inputRef}
          onChange={setInput}
          onSend={run}
          onStop={cancel}
          onPasteFiles={(files) => void onPasteFiles(files)}
          skills={skills}
          footerStart={
            <>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className="ai-attach-btn"
                  onClick={pickAttachments}
                  title={t('aiAttachTitle')}
                >
                  <img src={attachIcon} alt="" aria-hidden />
                </button>
                <button
                  className={`ai-attach-btn${selectedKbId && selectedKbId !== 'NONE' ? ' active' : ''}`}
                  onClick={() => {
                    void refreshKbList()
                    setShowKbMenu((open) => !open)
                  }}
                  title="Knowledge Base RAG Options"
                  style={{
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: selectedKbId && selectedKbId !== 'NONE' ? '#f5f5f5' : 'none',
                    border: selectedKbId && selectedKbId !== 'NONE' ? '1px solid #ccc' : 'none',
                    borderRadius: 4,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={selectedKbId && selectedKbId !== 'NONE' ? '#333' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                  </svg>
                </button>
              </div>
              <button
                className={`ai-track-btn${trackChanges ? ' on' : ''}`}
                onClick={toggleTrackChanges}
                title={trackChanges ? t('aiTrackOnTitle') : t('aiTrackOffTitle')}
              >
                <span className="ai-track-dot" aria-hidden />
                {t('aiTrackChanges')}
              </button>
            </>
          }
        />
      </div>
      </div>
      </div>
    </aside>
  )
}

/** Tool row list (unified with slides/sheets): dot + summary; expandable details when there's output; arrow shows on hover */
/** Step-row status icons (timeline glyphs: 14px in a 20px slot, 1.6 stroke) */
function StepIcon({ status }: { status: 'running' | 'done' | 'error' }) {
  if (status === 'running') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v3.2c0 2.6 4 4.2 4 5.3 0 1.1 4 2.7 4 5.3v3.2M16 3.5v3.2c0 2.6-4 4.2-4 5.3 0 1.1-4 2.7-4 5.3v3.2" />
      </svg>
    )
  }
  if (status === 'error') {
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.4 2.4 2.4 4.6-5" />
    </svg>
  )
}

/** Tool activity group: a single quiet summary row
 *  that auto-opens while tools run, auto-collapses into "Worked · N steps" when they finish,
 *  and a manual toggle that always wins. Rows inside are step rows with 1px connectors. */
function ToolChipList({ tools }: { tools: ToolActivity[] }) {
  const { t: tr } = useI18n()
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [userOpen, setUserOpen] = useState<boolean | null>(null)

  const toggle = (j: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(j)) next.delete(j)
      else next.add(j)
      return next
    })
  }

  const anyRunning = tools.some((tool) => tool.running)
  const open = userOpen ?? anyRunning
  const label = anyRunning ? tr('aiGroupWorking') : tr('aiWorkedSteps', { n: tools.length })

  return (
    <div className="ai-work-group">
      <button
        type="button"
        className={`ai-work-group-summary${anyRunning ? ' running' : ''}`}
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
      >
        {anyRunning && !open && <span className="ai-tool-chip-spinner" aria-hidden />}
        <span className="ai-work-group-label">{label}</span>
        <span className={`ai-tool-chip-caret${open ? ' open' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      <div className={`ai-work-group-body${open ? ' open' : ''}`}>
        <div className="ai-work-group-body-inner">
          {tools.map((tool, j) => {
            const hasOutput = !tool.running && !!tool.output
            const isOpen = expanded.has(j)
            const stepStatus = tool.running ? 'running' : tool.isError ? 'error' : 'done'
            return (
              <div key={j} className="ai-step-row">
                <span className={`ai-step-icon ${stepStatus}`} aria-hidden>
                  <StepIcon status={stepStatus} />
                </span>
                <div className="ai-step-content">
                  {hasOutput ? (
                    <button
                      type="button"
                      className="ai-step-title clickable"
                      title={tool.name}
                      aria-expanded={isOpen}
                      onClick={() => toggle(j)}
                    >
                      {tool.summary}
                    </button>
                  ) : (
                    <span className="ai-step-title" title={tool.name}>
                      {tool.summary}
                    </span>
                  )}
                  {hasOutput && isOpen && (
                    <div className="ai-step-detail">
                      <div className="ai-tool-output">
                        <div className="ai-tool-output-pre">{tool.output}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
