import { useEffect, useMemo, useRef, useState } from 'react'
import { AiComposer, AiTypingIndicator, formatChatTimestamp } from '@genoffice/ui'
import { GensparkMark } from '../ribbon-icons'
import type { ChangePlan } from '../../domain/workbook.types'
import type { AttachmentMeta } from '../../shared/desktop-api'
import { useI18n, type TFunc } from '../i18n/locale'
import { Markdown } from '@genoffice/ui'
import sendEnterOn from '../assets/send-enter-on.png'
import sendEnterOff from '../assets/send-enter-off.png'
import sendStop from '../assets/send-stop.png'
import attachIcon from '../assets/attach-icon.png'

/** Clipboard bitmap MIME → attachment extension (matches the main process's
 * ATTACHMENT_IMAGE_EXTS) */
const PASTE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** Resizable panel width: persisted, clamped to min/max, drives the .sheet-body grid column via --copilot-width */
const PANEL_WIDTH_KEY = 'sheets-ai-panel-width'
const PANEL_WIDTH_MIN = 280

function clampPanelWidth(w: number): number {
  return Math.min(Math.max(w, PANEL_WIDTH_MIN), Math.min(720, Math.round(window.innerWidth * 0.6)))
}

function loadPanelWidth(): number | null {
  const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY))
  return Number.isFinite(saved) && saved > 0 ? clampPanelWidth(saved) : null
}

export interface AiToolChip {
  readonly summary: string
  readonly isError: boolean
  /** still executing: rendered as a spinner chip, replaced in place when the tool finishes */
  readonly running?: boolean
  /** Tool name (title tooltip) */
  readonly name?: string
  /** Tool output (truncated UI-side); when present the row expands to details */
  readonly output?: string
}

export interface AiChatMessage {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly tools: readonly AiToolChip[]
  readonly streaming?: boolean | undefined
  readonly isError?: boolean | undefined
  /** the run failed and this user message was rolled back out of the model context */
  readonly undelivered?: boolean | undefined
  /** the run failed because Genspark is signed out — render an inline sign-in button */
  readonly loginRequired?: boolean | undefined
  /** Set when this message reflects an auto-applied plan; renders an inline [Undo] button. */
  readonly autoApplied?: { readonly opCount: number } | undefined
}

export function AiChatPanel({
  isOpen,
  hasContent,
  chat,
  historicChat = [],
  attachments,
  attachNotice,
  selectedKbId,
  knowledgeBases,
  onSelectKbId,
  onPickAttachments,
  onAddAttachmentPaths,
  onAddPastedImage,
  onRemoveAttachment,
  prompt,
  preview,
  aiBusy,
  onPromptChange,
  onSend,
  onStop,
  onNewChat,
  onClearHistory,
  chatList = [],
  currentChatId,
  onSelectChat,
  onRefreshChatList,
  skills,
  onUndo,
  onExpand,
  onCollapse,
}: {
  readonly isOpen: boolean
  /** the workbook has cells with content — empty workbooks get "build me a sheet" copy instead */
  readonly hasContent: boolean
  readonly chat: readonly AiChatMessage[]
  readonly historicChat?: readonly AiChatMessage[]
  /// Chat attachments (chips + 📎 button + drag onto the panel), same structure
  /// as the docs/slides AI panels.
  readonly attachments: readonly AttachmentMeta[]
  readonly attachNotice: string | null
  readonly selectedKbId?: string | null | undefined
  readonly knowledgeBases?: ReadonlyArray<{ id: string; name: string }> | undefined
  readonly onSelectKbId?: ((id: string | null) => void) | undefined
  readonly onPickAttachments: () => void
  readonly onAddAttachmentPaths: (paths: readonly string[]) => void
  /// Clipboard-pasted bitmaps (screenshots etc. without a local path): bytes +
  /// extension
  readonly onAddPastedImage: (data: ArrayBuffer, ext: string) => void
  readonly onRemoveAttachment: (path: string) => void
  readonly prompt: string
  readonly preview: ChangePlan | null
  readonly aiBusy: boolean
  readonly onPromptChange: (prompt: string) => void
  /** Send the composer text, or the given instruction when provided (used by the failed-run Retry) */
  readonly onSend: (instruction?: string) => void
  readonly onStop: () => void
  readonly onNewChat: () => void
  /** Delete the document's persisted chat history */
  readonly onClearHistory?: (() => void) | undefined
  /** The document's conversations (newest first) for the previous-chats picker */
  readonly chatList?: ReadonlyArray<{ chatId: string; createdAt: string; preview?: string }> | undefined
  readonly currentChatId?: string | null | undefined
  readonly onSelectChat?: ((chatId: string) => void) | undefined
  readonly onRefreshChatList?: (() => void) | undefined
  /** saved slash-command skills for the composer picker */
  readonly skills?: ReadonlyArray<{ id: string; name: string; description: string }> | undefined
  readonly onUndo: () => void
  readonly onExpand: () => void
  readonly onCollapse: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const chatRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickToBottomRef = useRef(true)
  const [dragOver, setDragOver] = useState(false)
  const [showKbMenu, setShowKbMenu] = useState(false)
  const [chatPickerOpen, setChatPickerOpen] = useState(false)
  /** chat content zoom, controlled by the +A / -A header buttons (0.75x–1.6x) */
  const [chatFontZoom, setChatFontZoom] = useState(1)
  const adjustChatFontZoom = (delta: number) =>
    setChatFontZoom((z) => Math.min(1.6, Math.max(0.75, Math.round((z + delta) * 10) / 10)))
  const [localKbList, setLocalKbList] = useState<ReadonlyArray<{ id: string; name: string }>>([])

  const refreshKbList = async () => {
    try {
      const fn =
        window.desktopApi?.listKnowledgeBases ??
        (window as any).desktop?.listKnowledgeBases ??
        (window as any).pdfApi?.listKnowledgeBases ??
        (window as any).aiOffice?.knowledge?.listKnowledgeBases
      if (typeof fn === 'function') {
        const result = await fn()
        if (Array.isArray(result) && result.length > 0) {
          setLocalKbList(result)
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
    for (const kb of knowledgeBases ?? []) {
      if (kb?.id && kb?.name) map.set(kb.id, kb)
    }
    for (const kb of localKbList) {
      if (kb?.id && kb?.name) map.set(kb.id, kb)
    }
    return Array.from(map.values())
  }, [knowledgeBases, localKbList])

  const toggleKbMenu = async () => {
    if (!showKbMenu) {
      await refreshKbList()
    }
    setShowKbMenu((prev) => !prev)
  }
  const asideRef = useRef<HTMLElement | null>(null)
  const [resizing, setResizing] = useState(false)
  /** Wall-clock start of the current run (aiBusy false→true), drives the elapsed badge */
  const busyStartRef = useRef(0)
  useEffect(() => {
    if (aiBusy) busyStartRef.current = Date.now()
  }, [aiBusy])

  // Restore the persisted panel width (the grid column tracks --copilot-width on .sheet-body)
  useEffect(() => {
    if (!isOpen) return
    const saved = loadPanelWidth()
    if (saved === null) return
    const area = asideRef.current?.closest('.sheet-body') as HTMLElement | null
    area?.style.setProperty('--copilot-width', `${saved}px`)
  }, [isOpen])

  // Re-clamp the panel width when the window shrinks (max is 60% of the window)
  useEffect(() => {
    if (!isOpen) return
    const onResize = (): void => {
      const area = asideRef.current?.closest('.sheet-body') as HTMLElement | null
      const current = parseFloat(area?.style.getPropertyValue('--copilot-width') ?? '')
      if (!area || !Number.isFinite(current)) return
      area.style.setProperty('--copilot-width', `${clampPanelWidth(current)}px`)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isOpen])

  // follow the stream, but stop yanking once the user scrolls up to read
  useEffect(() => {
    if (stickToBottomRef.current) {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
    }
  }, [chat, preview])

  const resizeCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => resizeCleanupRef.current?.(), [])

  /** Drag the right edge to resize: the panel is flush with the window's left edge, so width = clientX; the grid transition is disabled while dragging */
  const startResize = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const area = asideRef.current?.closest('.sheet-body') as HTMLElement | null
    if (!area) return
    const resizer = e.currentTarget
    setResizing(true)
    area.style.transition = 'none'
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    let width = 0
    const onMove = (ev: PointerEvent): void => {
      width = clampPanelWidth(ev.clientX)
      area.style.setProperty('--copilot-width', `${width}px`)
    }
    let done = false
    const cleanup = (): void => {
      if (done) return
      done = true
      resizeCleanupRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      resizer.removeEventListener('lostpointercapture', cleanup)
      area.style.transition = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setResizing(false)
      if (width > 0) localStorage.setItem(PANEL_WIDTH_KEY, String(Math.round(width)))
    }
    resizeCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    // lostpointercapture also fires if the resizer is unmounted mid-drag (panel collapse)
    resizer.addEventListener('lostpointercapture', cleanup)
    resizer.setPointerCapture(e.pointerId)
  }

  const onChatScroll = (): void => {
    const el = chatRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  if (!isOpen) {
    return (
      <aside className="copilot collapsed">
        <button className="expand-copilot" onClick={onExpand} title={t('aiOpenAssistant')}>
          <GensparkMark size={22} />
        </button>
      </aside>
    )
  }

  const canSend = prompt.trim().length > 0 && !aiBusy

  const send = (): void => {
    if (!canSend) return
    stickToBottomRef.current = true
    onSend()
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.desktopApi.getPathForFile(f))
      .filter(Boolean)
    if (paths.length > 0) onAddAttachmentPaths(paths)
  }

  /** Files pasted into the input: ones with a local path go the regular
   * attachment route; pure bitmaps like screenshots are persisted by the host */
  const onPasteFiles = (files: File[]): void => {
    const paths: string[] = []
    for (const f of files) {
      const p = window.desktopApi.getPathForFile(f)
      if (p) {
        paths.push(p)
        continue
      }
      const ext = PASTE_MIME_EXT[f.type] ?? f.name.split('.').pop()?.toLowerCase() ?? 'bin'
      void f.arrayBuffer().then((buf) => onAddPastedImage(buf, ext))
    }
    if (paths.length > 0) onAddAttachmentPaths(paths)
  }

  return (
    <aside
      ref={asideRef}
      className={`copilot${dragOver ? ' ai-panel-dragover' : ''}${resizing ? ' ai-panel-resizing' : ''}`}
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
        aria-label="Open Office Ai"
      />
      <header className="ai-panel-header">
        <span className="ai-panel-title">
          <GensparkMark size={22} />
          Open Office Ai
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
                    onRefreshChatList?.()
                    setChatPickerOpen((o) => !o)
                  }}
                  title="Previous chats"
                  aria-label="Previous chats"
                >
                  <IconHistory size={15} />
                </button>
                {chatPickerOpen && (
                  <div className="ai-chat-picker-menu">
                    {chatList.length === 0 && (
                      <div className="ai-chat-picker-empty">No previous chats</div>
                    )}
                    {chatList.map((c) => (
                      <button
                        key={c.chatId}
                        className={`ai-chat-picker-item${c.chatId === currentChatId ? ' active' : ''}`}
                        onClick={() => onSelectChat?.(c.chatId)}
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
              <button className="ai-header-btn" onClick={onNewChat} title={t('aiNewChat')}>
                <IconNewChat size={15} />
              </button>
              <button
                className="ai-header-btn"
                onClick={onClearHistory}
                title="Clear history"
                aria-label="Clear history"
              >
                <IconTrash size={15} />
              </button>
            </>
          )}
          <button className="ai-header-btn" onClick={onCollapse} title={t('aiCollapsePanel')}>
            <IconCollapse size={15} />
          </button>
        </div>
      </header>

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
      <div className="ai-chat" ref={chatRef} onScroll={onChatScroll}>
        {/* Past conversation (read-only transcript), shown continuously with the current turn */}
        {historicChat.length > 0 && (
          <>
            {historicChat.map((entry, i) => (
              <div key={`h${i}`} className={`ai-msg ai-msg-${entry.role} ai-msg-historic`}>
                {entry.tools.length > 0 && <ToolChipList tools={entry.tools} />}
                {entry.text && <Markdown text={entry.text} />}
                {entry.role === 'user' && entry.text && (
                  <button
                    className="ai-msg-tool-btn"
                    onClick={() => onSend(entry.text)}
                    aria-label="Replay"
                    data-tip="Replay"
                    title="Replay"
                  >
                    <IconReplay size={12} />
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
              {t(hasContent ? 'aiEmptyTitle' : 'aiEmptyBuildTitle')}
            </div>
            <div className="ai-chat-empty-body">
              {t(hasContent ? 'aiEmptyBodyLine1' : 'aiEmptyBuildBody')}
            </div>
          </div>
        )}
        {chat.map((entry, index) => (
          <div
            key={index}
            className={`ai-msg ai-msg-${entry.role}${entry.isError ? ' ai-msg-error' : ''}${entry.role === 'assistant' && entry.streaming ? ' ai-msg-streaming' : ''}`}
          >
            {entry.role === 'user' ? (
              <>
                {entry.text}
                {entry.undelivered && (
                  <div className="ai-msg-undelivered">
                    {t('aiUndelivered')}
                    {!aiBusy && (
                      <button className="ai-retry-btn" onClick={() => onSend(entry.text)}>
                        {t('aiRetry')}
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {entry.tools.length > 0 && <ToolChipList tools={entry.tools} />}
                {entry.text ? (
                  <Markdown text={entry.text} />
                ) : (
                  entry.streaming && (
                    <span className="ai-typing-row">
                      <AiTypingIndicator
                        label={entry.tools.length > 0 ? t('aiWorking') : t('aiThinking')}
                      />
                    </span>
                  )
                )}
                {entry.autoApplied && (
                  <div className="ai-auto-applied">
                    <span className="ai-auto-applied-text">
                      {t('aiAutoApplied', { count: entry.autoApplied.opCount })}
                    </span>
                    <button className="ai-undo-btn" onClick={onUndo} title={t('aiUndoTitle')}>
                      {t('aiUndo')}
                    </button>
                  </div>
                )}

              </>
            )}
          </div>
        ))}

        {preview && (
          <section className="preview ai-preview-card" aria-label={t('aiPreviewAria')}>
            <h3>{t('aiProposedChanges')}</h3>
            {preview.structuralChanges.map((change, index) => (
              <div className="change" key={`structural-${index}`}>
                <strong>{t('aiChangeStructure')}</strong>
                <span>{change.label}</span>
              </div>
            ))}
            {preview.formatChanges.map((change, index) => (
              <div className="change" key={`format-${index}`}>
                <strong>{t('aiChangeFormat')}</strong>
                <span>{change.label}</span>
              </div>
            ))}
            {preview.cellChanges.slice(0, MAX_PREVIEW_CELL_ROWS).map((change) => (
              <div className="change" key={`${change.sheetId}-${change.address}`}>
                <strong>{change.address}</strong>
                <span>
                  {formatCell(change.before, t)} → {formatCell(change.after, t)}
                </span>
              </div>
            ))}
            {preview.cellChanges.length > MAX_PREVIEW_CELL_ROWS && (
              <div className="change">
                <strong>…</strong>
                <span>
                  {t('aiMoreCells', { count: preview.cellChanges.length - MAX_PREVIEW_CELL_ROWS })}
                </span>
              </div>
            )}
            {preview.sheetRenames.map((rename) => (
              <div className="change" key={rename.sheetId}>
                <strong>{t('aiChangeSheet')}</strong>
                <span>
                  {rename.before} → {rename.after}
                </span>
              </div>
            ))}
            {preview.warnings.map((warning) => (
              <div className="change" key={warning}>
                <strong>⚠</strong>
                <span>{warning}</span>
              </div>
            ))}
          </section>
        )}
      </div>

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
                onClick={() => onSelectKbId?.('NONE')}
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
                onClick={() => onSelectKbId?.('ALL')}
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
                  if (first) onSelectKbId?.(first.id)
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
                            onSelectKbId?.('NONE')
                          } else {
                            onSelectKbId?.(nextList.join(','))
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
                <IconDatabase size={11} color="#666" />
                <span style={{ marginLeft: 4 }}>
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
                  onClick={() => onSelectKbId?.('NONE')}
                  title="Clear Knowledge Base Selection"
                >
                  ×
                </button>
              </span>
            )}
            {attachments.map((attachment) => (
              <span key={attachment.path} className="ai-attachment-chip" title={attachment.path}>
                <IconPaperclip size={11} />
                {attachment.name}
                <button
                  className="ai-attachment-remove"
                  onClick={() => onRemoveAttachment(attachment.path)}
                  title={t('aiRemoveAttachment')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {attachNotice && <div className="ai-attach-notice">{attachNotice}</div>}
        <AiComposer
          value={prompt}
          busy={aiBusy}
          placeholder={t(hasContent ? 'aiComposerPlaceholder' : 'aiComposerPlaceholderBuild')}
          hintIdle={t('aiHintIdle')}
          hintBusy={t('aiHintBusy')}
          hintIdleTitle={t('aiHintIdleTitle')}
          sendLabel={t('aiSend')}
          stopLabel={t('aiStop')}
          ariaLabel={t('aiInstructionAria')}
          iconOnly
          sendIconEnabled={<img src={sendEnterOn} alt="" aria-hidden />}
          sendIconDisabled={<img src={sendEnterOff} alt="" aria-hidden />}
          stopIcon={<img src={sendStop} alt="" aria-hidden />}
          footerStart={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="ai-attach-btn"
                onClick={onPickAttachments}
                title={t('aiAttachTitle')}
              >
                <img src={attachIcon} alt="" aria-hidden />
              </button>
              <button
                className={`ai-attach-btn${selectedKbId && selectedKbId !== 'NONE' ? ' active' : ''}`}
                onClick={() => void toggleKbMenu()}
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
                <IconDatabase size={13} color={selectedKbId && selectedKbId !== 'NONE' ? '#333' : '#666'} />
              </button>
            </div>
          }
          textareaRef={inputRef}
          onChange={onPromptChange}
          onSend={send}
          onStop={onStop}
          onPasteFiles={onPasteFiles}
          skills={skills}
        />
      </div>
      </div>
      </div>
    </aside>
  )
}

const MAX_PREVIEW_CELL_ROWS = 50

function formatCell(
  cell: { readonly value: unknown; readonly formula?: string | undefined },
  t: TFunc,
): string {
  if (cell.formula) return cell.formula
  if (cell.value === null) return t('aiCellEmpty')
  return String(cell.value)
}

function Svg({ size, children }: { size: number; children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function IconNewChat({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg size={size}>
      <path
        d="M13.5 7.2v-3A1.7 1.7 0 0 0 11.8 2.5H4.2a1.7 1.7 0 0 0-1.7 1.7v6.1a1.7 1.7 0 0 0 1.7 1.7h1.1v2l2.6-2h1.3"
        strokeLinejoin="round"
      />
      <path d="M12.2 9.4v4M10.2 11.4h4" />
    </Svg>
  )
}

function IconReplay({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg size={size}>
      <path d="M13.1 8a5.1 5.1 0 1 1-1.5-3.6" />
      <path d="M13.4 3.1v2.8h-2.8" />
    </Svg>
  )
}

function IconHistory({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg size={size}>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5.3V8l2 1.4" />
    </Svg>
  )
}

function IconTrash({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg size={size}>
      <path d="M3.11 4.89h9.79M6.4 4.89V3.73a.62.62 0 0 1 .62-.62h1.96a.62.62 0 0 1 .62.62v1.16" />
      <path d="M4.44 4.89l.62 7.39a.89.89 0 0 0 .89.8h4.09a.89.89 0 0 0 .89-.8l.62-7.39" />
      <path d="M6.75 7.11v3.56M9.25 7.11v3.56" />
    </Svg>
  )
}

function IconCollapse({ size }: { size: number }): React.JSX.Element {
  // Mirrored glyph: the AI panel docks on the LEFT, so the divider and arrow point left
  return (
    <Svg size={size}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <path d="M5.5 2.5v11" />
      <path d="M12.5 8H8.1M9.8 5.9 7.7 8l2.1 2.1" strokeWidth="1.3" strokeLinejoin="round" />
    </Svg>
  )
}

function IconDatabase({ size = 14, color = '#666' }: { size?: number; color?: string }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  )
}

function IconPaperclip({ size }: { size: number }): React.JSX.Element {
  return (
    <Svg size={size}>
      <path
        d="M13 7.2 8.2 12a3.4 3.4 0 0 1-4.8-4.8l5-5a2.3 2.3 0 0 1 3.2 3.2l-5 5a1.1 1.1 0 0 1-1.6-1.6l4.6-4.6"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Tool row list (unified with docs/slides): dot + summary; rows with output
 * expand to details, with the arrow shown on hover */
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
function ToolChipList({ tools }: { tools: readonly AiToolChip[] }): React.JSX.Element {
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
