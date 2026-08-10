import { useEffect, useRef, useState } from 'react'
import appIcon from './assets/app-icon.png'
import iconDocx from './assets/file-docx.svg'
import iconXlsx from './assets/file-xlsx.svg'
import iconPptx from './assets/file-pptx.svg'
import iconPdf from './assets/file-pdf.svg'
import type {
  HomeApi,
  ProjectHomeApi,
  ProjectSummaryEntry,
  RecentEntry,
  KnowledgeDocument,
  KnowledgeChunkRecord,
  KnowledgeDocumentPreview,
  KnowledgeBaseFolder,
  SearchResultMatch,
  SkillRecord,
} from '../../shared/home-api'
import { fileCountKey, visiblePageCount } from './counts'
import { useI18n } from './locale'
import type { I18n, StringKey } from './locale'
import {
  AI_PROVIDERS,
  EMBEDDING_PROVIDERS,
  defaultAiSettings,
  type AiProviderId,
  type AiSettings,
  type EmbeddingProviderId,
  type McpServerConfig,
} from '@genoffice/ai-provider'

declare global {
  interface Window {
    aiOffice: HomeApi
    aiOfficeProject?: ProjectHomeApi
  }
}

/** page size of the home list; scrolling to the bottom auto-loads the next page */
const PAGE_SIZE = 50

/** greeting sublines on the home page: one is picked at random on entry */
const GREET_ASK_KEYS = [
  'greetAsk1',
  'greetAsk2',
  'greetAsk3',
  'greetAsk4',
  'greetAsk5',
  'greetAsk6',
] as const satisfies readonly StringKey[]

const FILE_ICONS: Record<string, string> = {
  docx: iconDocx,
  xlsx: iconXlsx,
  pptx: iconPptx,
  pdf: iconPdf,
}

function FileBadge({ ext, size }: { ext: string; size: number }) {
  const icon = FILE_ICONS[ext]
  if (icon) {
    return <img src={icon} width={size} height={size} alt="" aria-hidden="true" />
  }
  const label = ext ? ext[0].toUpperCase() : '?'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7.5" fill="#98a2b3" />
      <text
        x="16"
        y="16.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={17}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      >
        {label}
      </text>
    </svg>
  )
}

function formatModified(mtimeMs: number, i18n: I18n): string {
  const date = new Date(mtimeMs)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (days <= 0) {
    return `${i18n.t('today')} · ${date.toLocaleTimeString(i18n.dateLocale, { hour: '2-digit', minute: '2-digit' })}`
  }
  if (days === 1) return i18n.t('yesterday')
  return date.toLocaleDateString(i18n.dateLocale, { month: 'short', day: 'numeric' })
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function parentDir(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 2] ?? ''
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function baseName(entry: RecentEntry): string {
  return entry.ext ? entry.name.slice(0, -(entry.ext.length + 1)) : entry.name
}

// ── Project hooks ─────────────────────────────────────────

/** whether we are inside the shell (aiOfficeProject API available) */
function hasProjectApi(): boolean {
  return typeof window.aiOfficeProject !== 'undefined'
}

const FILTERS: { key: string; label: StringKey }[] = [
  { key: 'all', label: 'filterAll' },
  { key: 'docx', label: 'filterDocs' },
  { key: 'xlsx', label: 'filterSheets' },
  { key: 'pptx', label: 'filterSlides' },
  { key: 'pdf', label: 'filterPdf' },
]

// ── Project sidebar component ────────────────────────────

interface ProjectPanelProps {
  projects: ProjectSummaryEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onRefresh: () => void
}

function ProjectPanel({ projects, selectedId, onSelect, onRefresh }: ProjectPanelProps) {
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  // open menu id + fixed-position anchor (viewport coords), so the popup can
  // escape the scrollable project list without the list losing overflow-y
  const [projMenu, setProjMenu] = useState<{ id: string; top: number; right: number } | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating && newInputRef.current) newInputRef.current.focus()
  }, [creating])

  // close the menu on outside click or any scroll (the fixed-position popup
  // would otherwise detach from its row while the list scrolls)
  useEffect(() => {
    if (!projMenu) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target?.closest?.('.proj-menu-wrap')) setProjMenu(null)
    }
    const close = () => setProjMenu(null)
    window.addEventListener('pointerdown', handler)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('scroll', close, true)
    }
  }, [projMenu])

  const commitCreate = async () => {
    const name = newName.trim()
    setCreating(false)
    setNewName('')
    if (!name) return
    await window.aiOfficeProject?.createProject(name)
    onRefresh()
  }

  const commitRename = async () => {
    if (!renaming) return
    const name = renaming.value.trim()
    const id = renaming.id
    setRenaming(null)
    if (!name) return
    await window.aiOfficeProject?.renameProject(id, name)
    onRefresh()
  }

  // in-app confirm dialog (same style as the delete-files modal), not window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const doDelete = (id: string) => {
    setProjMenu(null)
    setConfirmDeleteId(id)
  }

  const confirmDeleteNow = async () => {
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    if (!id) return
    await window.aiOfficeProject?.deleteProject(id)
    if (selectedId === id) onSelect(null)
    onRefresh()
  }

  useEffect(() => {
    if (!confirmDeleteId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDeleteId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmDeleteId])

  return (
    <div className="proj-panel">
      <div className="proj-panel-head">
        <span className="proj-panel-title">{t('projects')}</span>
        <button
          className="proj-add-btn"
          title={t('newProject')}
          onClick={() => setCreating(true)}
          aria-label={t('newProject')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1v12M1 7h12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {creating && (
        <div className="proj-new-row">
          <input
            ref={newInputRef}
            className="proj-rename-input"
            placeholder={t('projectName')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => void commitCreate()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitCreate()
              if (e.key === 'Escape') {
                setCreating(false)
                setNewName('')
              }
            }}
          />
        </div>
      )}

      <ul className="proj-list">
        {projects.map((proj) => {
          const isActive = selectedId === proj.id
          const isRenaming = renaming?.id === proj.id
          return (
            <li key={proj.id} className={`proj-item${isActive ? ' active' : ''}`}>
              <div
                className="proj-item-main"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(isActive ? null : proj.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(isActive ? null : proj.id)
                }}
              >
                <span className="proj-item-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.1c.44 0 .85.19 1.13.52L8.4 4.4H13A1.5 1.5 0 0 1 14.5 5.9v5.6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {isRenaming ? (
                  <input
                    className="proj-rename-input inline"
                    value={renaming.value}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenaming({ id: proj.id, value: e.target.value })}
                    onBlur={() => void commitRename()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') void commitRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <span className="proj-item-name">
                    {proj.isDefault ? t('defaultProject') : proj.name}
                  </span>
                )}
                <span className="proj-item-meta">
                  <span className="proj-item-count">{proj.fileCount}</span>
                </span>
              </div>

              {!proj.isDefault && (
                <div className="proj-menu-wrap">
                  <button
                    className="proj-more-btn"
                    aria-label={t('projMoreActions', { name: proj.name })}
                    aria-expanded={projMenu?.id === proj.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (projMenu?.id === proj.id) {
                        setProjMenu(null)
                        return
                      }
                      const rect = e.currentTarget.getBoundingClientRect()
                      setProjMenu({
                        id: proj.id,
                        top: rect.bottom + 4,
                        right: window.innerWidth - rect.right,
                      })
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                      <circle cx="3.2" cy="8" r="1.35" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
                      <circle cx="12.8" cy="8" r="1.35" fill="currentColor" />
                    </svg>
                  </button>
                  {projMenu?.id === proj.id && (
                    <div
                      className="proj-menu"
                      role="menu"
                      style={{ top: projMenu.top, right: projMenu.right }}
                    >
                      <button
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation()
                          setProjMenu(null)
                          setRenaming({ id: proj.id, value: proj.name })
                        }}
                      >
                        {t('rename')}
                      </button>
                      <div className="row-menu-divider" />
                      <button
                        role="menuitem"
                        className="danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          doDelete(proj.id)
                        }}
                      >
                        {t('deleteProject')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {confirmDeleteId &&
        (() => {
          // locale string is "title?\nbody" — split it across the dialog
          const [confirmTitle, ...confirmBody] = t('deleteProjectConfirm').split('\n')
          return (
            <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
              <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-label={confirmTitle}
                onClick={(event) => event.stopPropagation()}
              >
                <h3>{confirmTitle}</h3>
                <p>{confirmBody.join('\n')}</p>
                <div className="modal-buttons">
                  <button
                    className="btn btn-secondary"
                    autoFocus
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    {t('cancel')}
                  </button>
                  <button className="btn btn-danger" onClick={() => void confirmDeleteNow()}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
    </div>
  )
}

function renderMarkdownInline(text: string) {
  const parts: React.ReactNode[] = []
  const regex = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*)/g
  let lastIdx = 0
  let key = 0
  for (const match of text.matchAll(regex)) {
    const idx = match.index ?? 0
    if (idx > lastIdx) {
      parts.push(text.slice(lastIdx, idx))
    }
    const token = match[0] ?? ''
    if (token.startsWith('`')) {
      parts.push(
        <code
          key={key++}
          style={{
            background: 'rgba(0,0,0,0.06)',
            padding: '2px 5px',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: '0.9em',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>)
    }
    lastIdx = idx + token.length
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }
  return parts
}

/**
 * Extract markdown headings with stable DOM ids, sharing the code-fence handling
 * of MarkdownPreview so TOC links line up with the rendered headings.
 */
function extractMarkdownHeadings(content: string): Array<{ id: string; level: number; text: string }> {
  const headings: Array<{ id: string; level: number; text: string }> = []
  let inCodeBlock = false
  let ordinal = 0
  for (const raw of content.split('\n')) {
    const trimmed = raw.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const m = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (m) {
      headings.push({ id: `kb-heading-${ordinal}`, level: m[1]!.length, text: m[2]! })
      ordinal++
    }
  }
  return headings
}

function parseHtmlTableToReact(htmlBlock: string, key: number): React.ReactNode {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlBlock, 'text/html')
    const table = doc.querySelector('table')
    if (!table) return null

    const trs = Array.from(table.querySelectorAll('tr'))
    if (trs.length === 0) return null

    const parsedRows = trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll('th, td'))
      return {
        isHeader: cells.some((c) => c.tagName.toLowerCase() === 'th'),
        cells: cells.map((c) => c.innerHTML.replace(/<br\s*\/?>/gi, ' ').trim()),
      }
    })

    let headerRow = parsedRows.find((r) => r.isHeader)
    if (!headerRow && parsedRows.length > 0) {
      headerRow = parsedRows[0]
    }

    const headerCells = headerRow ? headerRow.cells : []
    const dataRows = parsedRows.filter((r) => r !== headerRow)

    return (
      <div
        key={key}
        style={{
          margin: '12px 0',
          overflowX: 'auto',
          maxWidth: '100%',
        }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: '13px',
            border: '1px solid var(--border-color, #e0e0e0)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {headerCells.length > 0 && (
            <thead>
              <tr style={{ background: 'var(--surface-2, #f0f2f5)' }}>
                {headerCells.map((c, cIdx) => (
                  <th
                    key={cIdx}
                    style={{
                      border: '1px solid var(--border-color, #e0e0e0)',
                      padding: '8px 12px',
                      fontWeight: 600,
                      textAlign: 'left',
                      color: 'var(--text, #111)',
                    }}
                    dangerouslySetInnerHTML={{ __html: c }}
                  />
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {dataRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  background: rIdx % 2 === 1 ? 'var(--surface-1, #f8f9fa)' : 'transparent',
                }}
              >
                {row.cells.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      border: '1px solid var(--border-color, #e0e0e0)',
                      padding: '6px 12px',
                      color: 'var(--text, #222)',
                    }}
                    dangerouslySetInnerHTML={{ __html: cell }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } catch {
    return null
  }
}

function parseMarkdownTableToReact(tableLines: string[], key: number): React.ReactNode {
  const rows = tableLines.map((l) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim()),
  )
  if (rows.length === 0) return null

  let headerCells: string[] = []
  let bodyRows: string[][] = []

  if (rows.length >= 2 && /^:?-+:?$/.test(rows[1][0]?.replace(/\s/g, '') ?? '')) {
    headerCells = rows[0]
    bodyRows = rows.slice(2)
  } else {
    headerCells = rows[0]
    bodyRows = rows.slice(1)
  }

  return (
    <div
      key={key}
      style={{
        margin: '12px 0',
        overflowX: 'auto',
        maxWidth: '100%',
      }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: '13px',
          border: '1px solid var(--border-color, #e0e0e0)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        {headerCells.length > 0 && (
          <thead>
            <tr style={{ background: 'var(--surface-2, #f0f2f5)' }}>
              {headerCells.map((c, cIdx) => (
                <th
                  key={cIdx}
                  style={{
                    border: '1px solid var(--border-color, #e0e0e0)',
                    padding: '8px 12px',
                    fontWeight: 600,
                    textAlign: 'left',
                    color: 'var(--text, #111)',
                  }}
                >
                  {renderMarkdownInline(c)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{
                background: rIdx % 2 === 1 ? 'var(--surface-1, #f8f9fa)' : 'transparent',
              }}
            >
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    border: '1px solid var(--border-color, #e0e0e0)',
                    padding: '6px 12px',
                    color: 'var(--text, #222)',
                  }}
                >
                  {renderMarkdownInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarkdownPreview({
  content,
  headingIds,
}: {
  content: string
  headingIds?: ReadonlyMap<number, string>
}) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let key = 0
  let headingOrdinal = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBuffer = []
      } else {
        inCodeBlock = false
        elements.push(
          <pre
            key={key++}
            style={{
              background: '#282c34',
              color: '#abb2bf',
              padding: '12px 16px',
              borderRadius: 6,
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              margin: '12px 0',
              lineHeight: 1.4,
            }}
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>,
        )
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (!trimmed) {
      elements.push(<div key={key++} style={{ height: 6 }} />)
      continue
    }

    // HTML Table
    if (trimmed.toLowerCase().startsWith('<table') || trimmed.toLowerCase().startsWith('<tr')) {
      const htmlLines: string[] = [line]
      while (i + 1 < lines.length && !lines[i]!.toLowerCase().includes('</table>')) {
        i++
        htmlLines.push(lines[i]!)
      }
      const tableEl = parseHtmlTableToReact(htmlLines.join('\n'), key++)
      if (tableEl) {
        elements.push(tableEl)
        continue
      }
    }

    // Markdown Table
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [line]
      while (i + 1 < lines.length && lines[i + 1]!.trim().startsWith('|')) {
        i++
        tableLines.push(lines[i]!)
      }
      const tableEl = parseMarkdownTableToReact(tableLines, key++)
      if (tableEl) {
        elements.push(tableEl)
        continue
      }
    }

    // Headings
    const h1 = /^#\s+(.+)$/.exec(line)
    if (h1) {
      const hid = headingIds?.get(headingOrdinal++)
      elements.push(
        <h1
          id={hid}
          key={key++}
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: '16px 0 8px',
            borderBottom: '1px solid var(--border-color, #eaeaea)',
            paddingBottom: 6,
            color: 'var(--text, #111)',
          }}
        >
          {renderMarkdownInline(h1[1]!)}
        </h1>,
      )
      continue
    }

    const h2 = /^##\s+(.+)$/.exec(line)
    if (h2) {
      const hid = headingIds?.get(headingOrdinal++)
      elements.push(
        <h2
          id={hid}
          key={key++}
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: '14px 0 6px',
            borderBottom: '1px solid var(--border-color, #f0f0f0)',
            paddingBottom: 4,
            color: 'var(--text, #222)',
          }}
        >
          {renderMarkdownInline(h2[1]!)}
        </h2>,
      )
      continue
    }

    const h3 = /^###\s+(.+)$/.exec(line)
    if (h3) {
      const hid = headingIds?.get(headingOrdinal++)
      elements.push(
        <h3
          id={hid}
          key={key++}
          style={{ fontSize: 15, fontWeight: 600, margin: '12px 0 4px', color: 'var(--text, #333)' }}
        >
          {renderMarkdownInline(h3[1]!)}
        </h3>,
      )
      continue
    }

    const h4 = /^#{4,6}\s+(.+)$/.exec(line)
    if (h4) {
      const hid = headingIds?.get(headingOrdinal++)
      elements.push(
        <h4
          id={hid}
          key={key++}
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: '10px 0 4px',
            color: 'var(--text-muted, #555)',
          }}
        >
          {renderMarkdownInline(h4[1]!)}
        </h4>,
      )
      continue
    }

    // Lists
    const list = /^(?:[-*+]\s+|\d+\.\s+)(.+)$/.exec(line)
    if (list) {
      elements.push(
        <li key={key++} style={{ marginLeft: 20, marginBottom: 4, lineHeight: 1.5 }}>
          {renderMarkdownInline(list[1]!)}
        </li>,
      )
      continue
    }

    // Blockquotes
    const bq = /^>\s+(.+)$/.exec(line)
    if (bq) {
      elements.push(
        <blockquote
          key={key++}
          style={{
            borderLeft: '3px solid #0066cc',
            margin: '8px 0',
            paddingLeft: 12,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          {renderMarkdownInline(bq[1]!)}
        </blockquote>,
      )
      continue
    }

    // Paragraph
    elements.push(
      <p key={key++} style={{ margin: '4px 0 8px', lineHeight: 1.6, fontSize: 14, color: 'var(--text, #222)' }}>
        {renderMarkdownInline(line)}
      </p>,
    )
  }

  return <div>{elements}</div>
}

// ── Knowledge sidebar component ────────────────────────────

interface KnowledgePanelProps {
  /** currently open tab in the Knowledge Management area */
  activeTab: 'documents' | 'workbench' | 'skills'
  /** whether the knowledge area is the visible main view */
  viewActive: boolean
  /** navigate the main Knowledge Management area to a tab */
  onOpenTab: (tab: 'documents' | 'workbench' | 'skills') => void
}

function KnowledgePanel({ activeTab, viewActive, onOpenTab }: KnowledgePanelProps) {
  const items: Array<{
    tab: 'documents' | 'workbench' | 'skills'
    label: string
    icon: React.ReactNode
  }> = [
    {
      tab: 'documents',
      label: 'Collections',
      icon: (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M1.5 4A1.5 1.5 0 013 2.5h3.1c.44 0 .85.19 1.13.52L8.4 4.4H13A1.5 1.5 0 0114.5 5.9v5.6A1.5 1.5 0 0113 13H3a1.5 1.5 0 01-1.5-1.5V4z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      ),
    },
    {
      tab: 'workbench',
      label: 'Semantic Workbench',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M9.3 9.3L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      tab: 'skills',
      label: 'Skills Library',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7.5 1L2.5 8h3.5L5 13l5.5-7H6.8L8.5 1z" fill="currentColor" />
        </svg>
      ),
    },
  ]

  return (
    <div className="proj-panel">
      <div className="proj-panel-head">
        <span className="proj-panel-title">Knowledge Base</span>
      </div>
      <ul className="proj-list">
        {items.map((it) => {
          const isActive = viewActive && activeTab === it.tab
          return (
            <li key={it.tab} className={`proj-item${isActive ? ' active' : ''}`}>
              <div
                className="proj-item-main"
                role="button"
                tabIndex={0}
                onClick={() => onOpenTab(it.tab)}
              >
                {it.icon}
                <span className="proj-item-name">{it.label}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Knowledge Base collection management (upload tab) ─────
// Create / rename / delete collections from the Upload Document tab; the
// sidebar keeps only the collection picker and the workbench/skills shortcuts.

function CollectionsManager({
  knowledgeBases,
  onCreate,
  onRename,
  onDelete,
}: {
  knowledgeBases: KnowledgeBaseFolder[]
  onCreate: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (creating && newInputRef.current) newInputRef.current.focus()
  }, [creating])

  // close the ⋮ actions menu on any click outside it
  useEffect(() => {
    if (!menuFor) return
    const onDocDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null)
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [menuFor])

  const commitCreate = async () => {
    const name = newName.trim()
    setCreating(false)
    setNewName('')
    if (!name) return
    await onCreate(name)
  }

  const commitRename = async () => {
    if (!renaming) return
    const name = renaming.value.trim()
    const id = renaming.id
    setRenaming(null)
    if (!name) return
    await onRename(id, name)
  }

  return (
    <div className="kb-collections">
      <div className="kb-collections-head">
        <span className="kb-collections-title">Knowledge Base Collections</span>
        <button
          className="btn btn-secondary"
          style={{ padding: '3px 10px', fontSize: 12 }}
          onClick={() => {
            setCreating((c) => !c)
            setRenaming(null)
            setMenuFor(null)
          }}
        >
          {creating ? 'Cancel' : '+ New Collection'}
        </button>
      </div>
      {creating && (
        <input
          ref={newInputRef}
          className="proj-rename-input"
          placeholder="Collection name..."
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            marginBottom: 8,
            padding: '6px 10px',
            fontSize: 13,
            border: '1px solid var(--accent, #0066cc)',
            borderRadius: 6,
          }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={() => void commitCreate()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitCreate()
            if (e.key === 'Escape') {
              setCreating(false)
              setNewName('')
            }
          }}
        />
      )}
      <div className="kb-collection-list">
        {knowledgeBases.map((kb) => {
          const isRenaming = renaming?.id === kb.id
          return (
            <div key={kb.id} className="kb-collection-row">
              {isRenaming ? (
                <input
                  className="proj-rename-input"
                  value={renaming.value}
                  autoFocus
                  style={{ flex: 1, minWidth: 0, padding: '3px 8px', fontSize: 13, border: '1px solid var(--accent, #0066cc)', borderRadius: 4 }}
                  onChange={(e) => setRenaming({ id: kb.id, value: e.target.value })}
                  onBlur={() => void commitRename()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename()
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path
                      d="M1.5 4A1.5 1.5 0 013 2.5h3.1c.44 0 .85.19 1.13.52L8.4 4.4H13A1.5 1.5 0 0114.5 5.9v5.6A1.5 1.5 0 0113 13H3a1.5 1.5 0 01-1.5-1.5V4z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                  <span className="kb-collection-name" title={kb.name}>
                    {kb.name}
                  </span>
                  {kb.id !== 'default-kb' && (
                    <div className="kb-more-wrap" ref={menuFor === kb.id ? menuRef : undefined}>
                      <button
                        className="kb-more-btn"
                        title="Collection actions"
                        aria-label={`Actions for ${kb.name}`}
                        onClick={() => setMenuFor((open) => (open === kb.id ? null : kb.id))}
                      >
                        ⋮
                      </button>
                      {menuFor === kb.id && (
                        <div className="kb-action-menu">
                          <button
                            onClick={() => {
                              setMenuFor(null)
                              setRenaming({ id: kb.id, value: kb.name })
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              setMenuFor(null)
                              onDelete(kb.id)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Knowledge tree document row (upload tab) ─────────────
// One document in the collection tree: Preview / Chunks buttons plus a ⋮
// actions menu with "Move to" (another collection) and "Delete".

function DocumentTreeRow({
  doc,
  otherCollections,
  onPreview,
  onDelete,
  onMove,
}: {
  doc: KnowledgeDocument
  /** collections other than the document's current one (move targets) */
  otherCollections: Array<{ id: string; name: string }>
  onPreview: (docId: string, tab: 'full' | 'chunks') => void
  onDelete: (docId: string, docName: string) => void
  onMove: (docId: string, targetKbId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // close the ⋮ actions menu on any click outside it
  useEffect(() => {
    if (!menuOpen) return
    const onDocDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setMoveOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [menuOpen])

  const closeMenu = () => {
    setMenuOpen(false)
    setMoveOpen(false)
  }

  return (
    <div className="kb-tree-doc">
      <div className="kb-tree-doc-name">
        <FileBadge ext={doc.ext} size={16} />
        <span title={doc.path}>{doc.name}</span>
        <span className="kb-tree-doc-meta">
          {doc.chunkCount} chunks &bull; {doc.totalChars.toLocaleString()} chars
        </span>
      </div>
      <div className="kb-tree-doc-actions">
        <button
          className="btn btn-secondary"
          style={{ padding: '3px 8px', fontSize: 12 }}
          onClick={() => onPreview(doc.id, 'full')}
        >
          Preview
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '3px 8px', fontSize: 12 }}
          onClick={() => onPreview(doc.id, 'chunks')}
        >
          Chunks ({doc.chunkCount})
        </button>
        <div className="kb-more-wrap" ref={menuRef}>
          <button
            className="kb-more-btn"
            title="Document actions"
            aria-label={`Actions for ${doc.name}`}
            onClick={() => {
              setMenuOpen((o) => !o)
              setMoveOpen(false)
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="kb-action-menu">
              <button
                className="kb-action-move"
                onClick={() => setMoveOpen((o) => !o)}
              >
                <span>Move to</span>
                <span className="kb-menu-chevron">{moveOpen ? '▴' : '▾'}</span>
              </button>
              {moveOpen && (
                <div className="kb-action-submenu">
                  {otherCollections.length === 0 ? (
                    <span className="kb-action-empty">No other collections</span>
                  ) : (
                    otherCollections.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          closeMenu()
                          onMove(doc.id, c.id)
                        }}
                        title={`Move to ${c.name}`}
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              )}
              <button
                className="danger"
                onClick={() => {
                  closeMenu()
                  onDelete(doc.id, doc.name)
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Account entry (bottom-left) ──────────────────────────
// Currently the Genspark (gsk) login entry; to be upgraded to a signup/account system later.
// Language switching also lives in this popup menu.

// sorted by ISO 639 language code — native-script labels have no natural
// shared alphabet, so the code is the ordering key
const LANG_OPTIONS = [
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'he', label: 'עברית' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
] as const

function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang, setLang } = useI18n()
  const [tab, setTab] = useState<'llm' | 'search' | 'embedding' | 'mcp' | 'general'>('llm')
  const [settings, setSettings] = useState<AiSettings>(defaultAiSettings())
  /** welcome-page theme (dark/light); document editors stay light */
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  )

  const applyTheme = (next: 'dark' | 'light') => {
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('home-theme', next)
  }

  useEffect(() => {
    if (!isOpen) return
    window.aiOffice.getAiSettings?.().then((s) => {
      if (s) setSettings(s)
    })
  }, [isOpen])

  if (!isOpen) return null

  const curProvider = settings.provider
  const providerConfig = settings.providers[curProvider] ?? { apiKey: '', model: '' }
  const curProviderMeta = AI_PROVIDERS.find((p) => p.id === curProvider)

  const updateProviderConfig = (patch: Partial<typeof providerConfig>) => {
    setSettings({
      ...settings,
      providers: {
        ...settings.providers,
        [curProvider]: { ...providerConfig, ...patch },
      },
    })
  }

  const saveSettings = async () => {
    await window.aiOffice.setAiSettings?.(settings)
    onClose()
  }

  const addMcpServer = () => {
    const newServer: McpServerConfig = {
      id: crypto.randomUUID(),
      name: 'New MCP Server',
      type: 'sse',
      url: '',
      enabled: true,
    }
    setSettings({
      ...settings,
      mcpServers: [...(settings.mcpServers ?? []), newServer],
    })
  }

  const updateMcpServer = (id: string, patch: Partial<McpServerConfig>) => {
    setSettings({
      ...settings,
      mcpServers: (settings.mcpServers ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }

  const removeMcpServer = (id: string) => {
    setSettings({
      ...settings,
      mcpServers: (settings.mcpServers ?? []).filter((s) => s.id !== id),
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>AI & System Settings</h3>

        <div className="settings-tab-bar">
          <button
            className={`settings-tab-btn${tab === 'llm' ? ' active' : ''}`}
            onClick={() => setTab('llm')}
          >
            LLM Endpoint
          </button>
          <button
            className={`settings-tab-btn${tab === 'search' ? ' active' : ''}`}
            onClick={() => setTab('search')}
          >
            Web Search
          </button>
          <button
            className={`settings-tab-btn${tab === 'embedding' ? ' active' : ''}`}
            onClick={() => setTab('embedding')}
          >
            Embedding Model
          </button>
          <button
            className={`settings-tab-btn${tab === 'mcp' ? ' active' : ''}`}
            onClick={() => setTab('mcp')}
          >
            MCP Servers
          </button>
          <button
            className={`settings-tab-btn${tab === 'general' ? ' active' : ''}`}
            onClick={() => setTab('general')}
          >
            General
          </button>
        </div>

        <div>
          {tab === 'llm' && (
            <div className="settings-form-group">
              <label className="settings-field">
                <span className="settings-field-label">Provider</span>
                <select
                  className="settings-select"
                  value={curProvider}
                  onChange={(e) =>
                    setSettings({ ...settings, provider: e.target.value as AiProviderId })
                  }
                >
                  {AI_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span className="settings-field-label">Base URL (OpenAI-compatible)</span>
                <input
                  type="text"
                  className="settings-input"
                  placeholder={
                    curProvider === 'ollama'
                      ? 'http://localhost:11434/v1'
                      : curProvider === 'vllm'
                        ? 'http://localhost:8000/v1'
                        : 'https://api.openai.com/v1'
                  }
                  value={providerConfig.baseUrl ?? ''}
                  onChange={(e) => updateProviderConfig({ baseUrl: e.target.value })}
                />
              </label>

              <label className="settings-field">
                <span className="settings-field-label">Model Name</span>
                <input
                  type="text"
                  className="settings-input"
                  placeholder={
                    curProvider === 'ollama'
                      ? 'deepseek-r1'
                      : curProvider === 'vllm'
                        ? 'qwen2.5-7b-instruct'
                        : 'gpt-4o-mini'
                  }
                  value={providerConfig.model}
                  onChange={(e) => updateProviderConfig({ model: e.target.value })}
                />
              </label>

              <label className="settings-field">
                <span className="settings-field-label">API Key</span>
                <input
                  type="password"
                  className="settings-input"
                  placeholder={curProviderMeta?.keyPlaceholder || 'API Key'}
                  value={providerConfig.apiKey}
                  onChange={(e) => updateProviderConfig({ apiKey: e.target.value })}
                />
              </label>

              <label className="settings-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!providerConfig.disableThinking}
                  onChange={(e) => updateProviderConfig({ disableThinking: e.target.checked })}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                />
                <span className="settings-field-label" style={{ margin: 0, userSelect: 'none' }}>
                  Disable Thinking (strips &lt;think&gt;...&lt;/think&gt; blocks)
                </span>
              </label>
            </div>
          )}

          {tab === 'search' && (
            <div className="settings-form-group">
              <div
                style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  background: 'var(--bg-card, #252830)',
                  borderRadius: 6,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-main, #e0e0e0)',
                  border: '1px solid var(--border-color, #333)',
                }}
              >
                <strong>Search Execution Priority:</strong>
                <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>
                    <strong>Tavily API</strong> (used first if API key is provided)
                  </li>
                  <li>
                    <strong>Serper API</strong> (Google Search; requires API key)
                  </li>
                  <li>
                    <strong>DuckDuckGo</strong> (default fallback, works automatically without API keys)
                  </li>
                </ol>
              </div>

              <label className="settings-field">
                <span className="settings-field-label">Tavily API Key</span>
                <input
                  type="password"
                  className="settings-input"
                  placeholder="tvly-..."
                  value={settings.search?.tavilyApiKey ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      search: { ...settings.search, tavilyApiKey: e.target.value },
                    })
                  }
                />
                <span style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  High-precision AI search API (tavily.com). Used first when set.
                </span>
              </label>

              <label className="settings-field" style={{ marginTop: 12 }}>
                <span className="settings-field-label">Serper API Key</span>
                <input
                  type="password"
                  className="settings-input"
                  placeholder="Serper API Key (Google Search)"
                  value={settings.search?.serperApiKey ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      search: { ...settings.search, serperApiKey: e.target.value },
                    })
                  }
                />
                <span style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  Google Search API via Serper (serper.dev). Serper requires an API key; without a key,
                  search automatically falls back to DuckDuckGo.
                </span>
              </label>
            </div>
          )}

          {tab === 'embedding' && (
            <div className="settings-form-group">
              <label className="settings-field">
                <span className="settings-field-label">Provider</span>
                <select
                  className="settings-select"
                  value={settings.embedding?.provider ?? 'openai'}
                  onChange={(e) => {
                    const nextProv = e.target.value as EmbeddingProviderId
                    const meta = EMBEDDING_PROVIDERS.find((p) => p.id === nextProv)
                    const current = settings.embedding ?? {
                      provider: 'openai',
                      baseUrl: 'https://api.openai.com/v1',
                      model: 'text-embedding-3-small',
                      apiKey: '',
                    }
                    setSettings({
                      ...settings,
                      embedding: {
                        ...current,
                        provider: nextProv,
                        baseUrl: meta?.defaultBaseUrl ?? current.baseUrl,
                        model: meta?.defaultModel ?? current.model,
                      },
                    })
                  }}
                >
                  {EMBEDDING_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span className="settings-field-label">Base URL</span>
                <input
                  type="text"
                  className="settings-input"
                  placeholder={
                    settings.embedding?.provider === 'ollama'
                      ? 'http://localhost:11434'
                      : 'https://api.openai.com/v1'
                  }
                  value={settings.embedding?.baseUrl ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      embedding: {
                        ...(settings.embedding ?? {
                          provider: 'openai',
                          model: 'text-embedding-3-small',
                          apiKey: '',
                        }),
                        baseUrl: e.target.value,
                      },
                    })
                  }
                />
              </label>

              <label className="settings-field">
                <span className="settings-field-label">Embedding Model Name</span>
                <input
                  type="text"
                  className="settings-input"
                  placeholder={
                    settings.embedding?.provider === 'ollama'
                      ? 'nomic-embed-text'
                      : 'text-embedding-3-small'
                  }
                  value={settings.embedding?.model ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      embedding: {
                        ...(settings.embedding ?? {
                          provider: 'openai',
                          baseUrl: 'https://api.openai.com/v1',
                          apiKey: '',
                        }),
                        model: e.target.value,
                      },
                    })
                  }
                />
              </label>

              <label className="settings-field">
                <span className="settings-field-label">API Key (Optional)</span>
                <input
                  type="password"
                  className="settings-input"
                  placeholder={
                    settings.embedding?.provider === 'ollama'
                      ? 'Optional for local Ollama'
                      : 'sk-...'
                  }
                  value={settings.embedding?.apiKey ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      embedding: {
                        ...(settings.embedding ?? {
                          provider: 'openai',
                          baseUrl: 'https://api.openai.com/v1',
                          model: 'text-embedding-3-small',
                        }),
                        apiKey: e.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>
          )}

          {tab === 'mcp' && (
            <div className="settings-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="settings-field-label">Configured MCP Servers</span>
                <button className="btn btn-secondary" onClick={addMcpServer}>
                  + Add Server
                </button>
              </div>
              {(settings.mcpServers ?? []).map((srv) => (
                <div key={srv.id} className="mcp-server-card">
                  <input
                    type="text"
                    className="settings-input"
                    style={{ width: '130px' }}
                    value={srv.name}
                    placeholder="Server Name"
                    onChange={(e) => updateMcpServer(srv.id, { name: e.target.value })}
                  />
                  <select
                    className="settings-select"
                    style={{ width: '90px' }}
                    value={srv.type}
                    onChange={(e) =>
                      updateMcpServer(srv.id, { type: e.target.value as 'sse' | 'stdio' })
                    }
                  >
                    <option value="sse">SSE</option>
                    <option value="stdio">Stdio</option>
                  </select>
                  <input
                    type="text"
                    className="settings-input"
                    style={{ flex: 1 }}
                    placeholder={srv.type === 'sse' ? 'http://localhost:3000/sse' : 'command'}
                    value={srv.type === 'sse' ? srv.url ?? '' : srv.command ?? ''}
                    onChange={(e) =>
                      updateMcpServer(
                        srv.id,
                        srv.type === 'sse' ? { url: e.target.value } : { command: e.target.value },
                      )
                    }
                  />
                  <button className="btn btn-danger" onClick={() => removeMcpServer(srv.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'general' && (
            <div className="settings-form-group">
              <label className="settings-field">
                <span className="settings-field-label">Language</span>
                <select
                  className="settings-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as any)}
                >
                  {LANG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span className="settings-field-label">Welcome Page Theme</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`settings-tab-btn${theme === 'dark' ? ' active' : ''}`}
                    onClick={() => applyTheme('dark')}
                  >
                    Dark
                  </button>
                  <button
                    className={`settings-tab-btn${theme === 'light' ? ' active' : ''}`}
                    onClick={() => applyTheme('light')}
                  >
                    Light
                  </button>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Applies to the welcome / home screen only. Document editors keep their own
                  light interface.
                </span>
              </label>

              <div className="settings-acknowledgments">
                <span className="settings-field-label">Acknowledgments</span>
                <p>
                  Open Office Ai is an independent fork of GenOffice, created and published by Dr. Ing.
                  Benetti Mauro A. under the Apache License 2.0.
                </p>
                <p>
                  We are grateful to GenOffice contributors for opening the substantial foundation
                  this fork builds on: the document, spreadsheet, presentation, and PDF
                  applications; the OOXML engines; the rendering and round-trip fidelity work; and
                  the original AI integration.
                </p>
                <p>
                  For more projects visit:{' '}
                  <button
                    type="button"
                    className="settings-acknowledgments-link"
                    onClick={() => void window.aiOffice.openGithub?.()}
                  >
                    https://github.com/mbenetti
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-buttons">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void saveSettings()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}







// ── Skills tab (Knowledge Management) ────────────────────

function SkillsTab({
  skills,
  onCreate,
  onUpdate,
  onDelete,
}: {
  skills: SkillRecord[]
  onCreate: (name: string, description: string, instructions: string) => Promise<void>
  onUpdate: (
    id: string,
    patch: { name?: string; description?: string; instructions?: string },
  ) => Promise<void>
  onDelete: (id: string, name: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<SkillRecord | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')

  const startCreate = () => {
    setCreating(true)
    setEditing(null)
    setName('')
    setDescription('')
    setInstructions('')
  }

  const startEdit = (skill: SkillRecord) => {
    setEditing(skill)
    setCreating(false)
    setName(skill.name)
    setDescription(skill.description)
    setInstructions(skill.instructions)
  }

  const cancelForm = () => {
    setCreating(false)
    setEditing(null)
  }

  const saveForm = () => {
    if (editing) {
      void onUpdate(editing.id, { name, description, instructions })
    } else {
      void onCreate(name, description, instructions)
    }
    setCreating(false)
    setEditing(null)
  }

  const formOpen = creating || !!editing

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          padding: 16,
          background: 'var(--surface-subtle, #f8f9fa)',
          border: '1px solid var(--border-color, #e9ecef)',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <strong>Reusable AI Skills</strong>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Invoke in any chat with <code>/Skill_Name</code> (e.g. <code>/Analyze_document</code>), or let
            the assistant recall one with <code>use_skill</code>. Names are one word or
            underscore-joined words.
          </div>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>
          + New Skill
        </button>
      </div>

      {formOpen && (
        <div
          style={{
            border: '1px solid var(--border-color, #e0e0e0)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {editing ? `Edit Skill /${editing.name}` : 'New Skill'}
          </div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Name (one word or underscore-joined, e.g. Analyze_document)
            <input
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '6px 10px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Analyze_document"
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Description
            <input
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                padding: '6px 10px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
              }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this skill does"
            />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Instructions (inserted into the chat context)
            <textarea
              style={{
                display: 'block',
                width: '100%',
                marginTop: 4,
                minHeight: 90,
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
              }}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Follow this workflow..."
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={cancelForm}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!name.trim() || !instructions.trim()}
              onClick={saveForm}
            >
              {editing ? 'Save Changes' : 'Create Skill'}
            </button>
          </div>
        </div>
      )}

      {skills.length === 0 ? (
        <div
          className="empty proj-empty"
          style={{ padding: '40px 20px', border: '2px dashed var(--border-color, #dee2e6)', borderRadius: 12 }}
        >
          <span className="empty-title" style={{ fontWeight: 600, fontSize: 15, marginTop: 8 }}>
            No Skills Yet
          </span>
          <span className="empty-hint" style={{ marginTop: 4 }}>
            Create your first skill to reuse a workflow with the / slash command in any chat.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {skills.map((skill) => (
            <div
              key={skill.id}
              style={{
                border: '1px solid var(--border-color, #e0e0e0)',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>/{skill.name}</div>
                {skill.description && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {skill.description}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    background: 'var(--surface-subtle, #fafafa)',
                    border: '1px solid var(--border-color, #eee)',
                    borderRadius: 6,
                    padding: 8,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 96,
                    overflowY: 'auto',
                  }}
                >
                  {skill.instructions}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => startEdit(skill)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => void onDelete(skill.id, skill.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────

function renderHighlightedText(text: string, query: string): React.ReactNode {
  if (!text) return ''
  if (!query || !query.trim() || query.trim() === '*') return text

  const terms = Array.from(
    new Set(
      query
        .replace(/[^\w\s\u00C0-\u024F\u4E00-\u9FFF]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  )

  if (terms.length === 0) return text

  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)

  return parts.map((part, idx) =>
    pattern.test(part) ? (
      <mark
        key={idx}
        style={{
          backgroundColor: '#ffe082',
          color: '#000000',
          padding: '1px 3px',
          borderRadius: '3px',
          fontWeight: 600,
        }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export function Home() {
  const i18n = useI18n()
  const { t, lang } = i18n
  // ── Paged list state (rows loaded for the current view + filter) ──
  const [entries, setEntries] = useState<RecentEntry[]>([])
  /** total count under the current view + filter (not just the loaded rows) */
  const [listTotal, setListTotal] = useState(0)
  /** sidebar Recent / Starred counts under the active type filter */
  const [navCounts, setNavCounts] = useState({ recent: 0, starred: 0 })
  const [loadingMore, setLoadingMore] = useState(false)
  const [view, setView] = useState<'recent' | 'starred'>('recent')
  const [filter, setFilter] = useState('all')
  const [rowMenu, setRowMenu] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)
  // name in the greeting; omitted when logged out
  const [accountName] = useState('')
  const [greetAskKey] = useState(
    () => GREET_ASK_KEYS[Math.floor(Math.random() * GREET_ASK_KEYS.length)]!,
  )

  // ── Project state ──
  const [projects, setProjects] = useState<ProjectSummaryEntry[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedKnowledgeView, setSelectedKnowledgeView] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [appSettings, setAppSettings] = useState<AiSettings>(defaultAiSettings())

  // ── Knowledge Base state ──
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseFolder[]>([])
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([])
  const [previewDocData, setPreviewDocData] = useState<KnowledgeDocumentPreview | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState<'full' | 'chunks'>('full')
  /** wide (near full-viewport) preview modal vs the default ~1300px */
  const [previewWide, setPreviewWide] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)

  // ── Workbench state ──
  const [kbViewTab, setKbViewTab] = useState<'documents' | 'workbench' | 'skills'>('documents')
  const [expandedKbs, setExpandedKbs] = useState<Set<string>>(() => new Set(['default-kb']))
  const [workbenchQuery, setWorkbenchQuery] = useState('')
  const [workbenchTopK, setWorkbenchTopK] = useState(5)
  const [workbenchMode, setWorkbenchMode] = useState<'hybrid' | 'vector' | 'fts'>('hybrid')
  const [workbenchScope, setWorkbenchScope] = useState<'chunks' | 'documents'>('chunks')
  const [workbenchSelectedKbIds, setWorkbenchSelectedKbIds] = useState<string[]>([])
  const [workbenchResults, setWorkbenchResults] = useState<SearchResultMatch[]>([])
  const [workbenchSearching, setWorkbenchSearching] = useState(false)

  // ── Skills state ──
  const [skills, setSkills] = useState<SkillRecord[]>([])

  const reloadSkills = async () => {
    if (!window.aiOffice?.skills) return
    try {
      const list = await window.aiOffice.skills.listSkills()
      const records = await Promise.all(
        list.map((s) => window.aiOffice?.skills?.getSkill(s.name) ?? Promise.resolve(null)),
      )
      setSkills(records.filter((s): s is SkillRecord => !!s))
    } catch {
      /* fail-open */
    }
  }

  useEffect(() => {
    void reloadSkills()
  }, [])

  const handleRunWorkbenchSearch = async () => {
    if (!window.aiOffice?.knowledge || !workbenchQuery.trim()) return
    setWorkbenchSearching(true)
    try {
      const results = await (window.aiOffice.knowledge.searchKnowledgeBase as any)(
        workbenchQuery.trim(),
        workbenchSelectedKbIds.length > 0 ? workbenchSelectedKbIds : undefined,
        workbenchTopK,
        { mode: workbenchMode, scope: workbenchScope },
      )
      setWorkbenchResults(results)
    } finally {
      setWorkbenchSearching(false)
    }
  }

  const reloadKnowledgeData = async () => {
    if (window.aiOffice?.knowledge) {
      try {
        const kbs = await window.aiOffice.knowledge.listKnowledgeBases()
        setKnowledgeBases(kbs)
        // Keep the upload target valid: when nothing is selected (or the
        // selected collection was deleted), fall back to the default
        // collection (the store always lists it first).
        setSelectedKbId((prev) =>
          prev && kbs.some((kb) => kb.id === prev) ? prev : (kbs[0]?.id ?? null),
        )
        // Always load every document so the tree can navigate all collections
        const docs = await window.aiOffice.knowledge.listDocuments()
        setKnowledgeDocs(docs)
      } catch {
        /* fail-open */
      }
    }
  }

  useEffect(() => {
    void reloadKnowledgeData()
  }, [])

  const handleCreateKnowledgeBase = async (name: string) => {
    if (!window.aiOffice?.knowledge) return
    await window.aiOffice.knowledge.createKnowledgeBase(name)
    await reloadKnowledgeData()
  }

  const handleRenameKnowledgeBase = async (id: string, name: string) => {
    if (!window.aiOffice?.knowledge) return
    await window.aiOffice.knowledge.renameKnowledgeBase(id, name)
    await reloadKnowledgeData()
  }

  const handleDeleteKnowledgeBase = async (id: string) => {
    if (!window.aiOffice?.knowledge) return
    const kb = knowledgeBases.find((f) => f.id === id)
    if (
      window.confirm(
        `Are you sure you want to delete collection "${kb?.name ?? id}" and all its documents?`,
      )
    ) {
      await window.aiOffice.knowledge.deleteKnowledgeBase(id)
      if (selectedKbId === id) setSelectedKbId(null)
      await reloadKnowledgeData()
    }
  }

  const handleUploadKnowledgeDoc = async (filePath?: string) => {
    if (!window.aiOffice?.knowledge) return
    let path = filePath
    if (!path) {
      path = (await window.aiOffice.knowledge.pickDocument()) ?? undefined
    }
    if (!path) return

    setUploadingDoc(true)
    try {
      const res = await window.aiOffice.knowledge.addDocument(path, selectedKbId || undefined)
      if (!res.ok) {
        window.alert(res.error)
      } else {
        await reloadKnowledgeData()
      }
    } finally {
      setUploadingDoc(false)
    }
  }

  const handlePreviewDoc = async (docId: string, initialTab: 'full' | 'chunks' = 'full') => {
    if (!window.aiOffice?.knowledge) return
    const data = await window.aiOffice.knowledge.getDocumentPreview(docId)
    if (data) {
      setPreviewDocData(data)
      setPreviewTab(initialTab)
      setPreviewModalOpen(true)
    }
  }

  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!window.aiOffice?.knowledge) return
    if (window.confirm(`Are you sure you want to delete "${docName}" from the Knowledge Base?`)) {
      await window.aiOffice.knowledge.deleteDocument(docId)
      await reloadKnowledgeData()
    }
  }

  const handleMoveDoc = async (docId: string, targetKbId: string) => {
    if (!window.aiOffice?.knowledge) return
    await window.aiOffice.knowledge.moveDocumentToKb(docId, targetKbId)
    await reloadKnowledgeData()
  }

  const handleCreateSkill = async (name: string, description: string, instructions: string) => {
    if (!window.aiOffice?.skills) return
    const res = await window.aiOffice.skills.createSkill(name, description, instructions)
    if (!res.ok) window.alert(res.error)
    await reloadSkills()
  }

  const handleUpdateSkill = async (
    id: string,
    patch: { name?: string; description?: string; instructions?: string },
  ) => {
    if (!window.aiOffice?.skills) return
    const res = await window.aiOffice.skills.updateSkill(id, patch)
    if (!res.ok) window.alert(res.error)
    await reloadSkills()
  }

  const handleDeleteSkill = async (id: string, name: string) => {
    if (!window.aiOffice?.skills) return
    if (window.confirm(`Delete skill "/${name}"?`)) {
      await window.aiOffice.skills.deleteSkill(id)
      await reloadSkills()
    }
  }

  useEffect(() => {
    window.aiOffice?.getAiSettings?.().then((s) => {
      if (s) setAppSettings(s)
    })
  }, [settingsModalOpen])

  const projectMode = hasProjectApi()

  // ── Paged loading ──
  // stale responses are dropped via a request sequence number (when views/filters switch quickly)
  const requestSeq = useRef(0)
  const entriesLen = useRef(0)
  entriesLen.current = entries.length

  /** reload the list; keepCount keeps the loaded row count (refresh), otherwise back to page one */
  const reload = (keepCount: boolean) => {
    const seq = ++requestSeq.current
    const ext = filter === 'all' ? undefined : filter
    const limit = keepCount ? Math.max(entriesLen.current, PAGE_SIZE) : PAGE_SIZE
    const primary = view === 'recent' ? window.aiOffice.recents : window.aiOffice.starred
    const secondary = view === 'recent' ? window.aiOffice.starred : window.aiOffice.recents
    void primary({ offset: 0, limit, ext }).then((page) => {
      if (seq !== requestSeq.current) return
      setEntries(page.entries)
      setListTotal(page.total)
      setNavCounts((prev) =>
        view === 'recent'
          ? { ...prev, recent: visiblePageCount(page) }
          : { ...prev, starred: visiblePageCount(page) },
      )
    })
    // The other view fetches only its count under the same active filter.
    void secondary({ offset: 0, limit: 0, ext }).then((page) => {
      if (seq !== requestSeq.current) return
      setNavCounts((prev) =>
        view === 'recent'
          ? { ...prev, starred: visiblePageCount(page) }
          : { ...prev, recent: visiblePageCount(page) },
      )
    })
    if (projectMode) {
      void window.aiOfficeProject!.listProjects().then(setProjects)
    }
  }
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  // refresh signal for project-view data (re-pull file stats after file changes)
  const [projectTick, setProjectTick] = useState(0)

  const refresh = () => {
    reloadRef.current(true)
    setProjectTick((n) => n + 1)
  }

  useEffect(() => {
    reloadRef.current(false)
  }, [view, filter])

  useEffect(() => {
    const onFocus = () => {
      reloadRef.current(true)
      setProjectTick((n) => n + 1)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const hasMore = entries.length < listTotal

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const seq = requestSeq.current
    const ext = filter === 'all' ? undefined : filter
    const api = view === 'recent' ? window.aiOffice.recents : window.aiOffice.starred
    void api({ offset: entriesLen.current, limit: PAGE_SIZE, ext }).then((page) => {
      setLoadingMore(false)
      if (seq !== requestSeq.current) return
      setEntries((prev) => [...prev, ...page.entries])
      setListTotal(page.total)
    })
  }
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  // Load the next page once the bottom sentinel enters the viewport (240px early);
  // depending on entries.length rebuilds the observer after each page — observe fires an immediate
  // callback, so while the sentinel stays in view we keep loading until full or exhausted
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) loadMoreRef.current()
      },
      { rootMargin: '240px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, entries.length])

  useEffect(() => {
    if (rowMenu === null && confirmDelete === null) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (rowMenu !== null && !target?.closest?.('.recent-actions')) setRowMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRowMenu(null)
        setConfirmDelete(null)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [rowMenu, confirmDelete])

  // ── Project files state ────────────────────────────────

  const [projectFileEntries, setProjectFileEntries] = useState<RecentEntry[]>([])
  const [moveFileMenu, setMoveFileMenu] = useState<string | null>(null)
  // submenu opens rightward by default; flips left when the window edge is too close
  const [moveMenuFlip, setMoveMenuFlip] = useState(false)
  // hover-open/close delays: avoid flashing the submenu while the pointer passes
  // through, and keep it open while crossing the 4px gap into it
  const moveMenuTimers = useRef<{ open: number | null; close: number | null }>({
    open: null,
    close: null,
  })

  const openMoveMenu = (path: string) => {
    setMoveMenuFlip(false)
    setMoveFileMenu(path)
  }

  // ref runs pre-paint, so measuring the real width (long project names exceed
  // the min-width) and flipping never flashes; once flipped the check no longer hits
  const measureSubmenu = (el: HTMLDivElement | null) => {
    if (el && el.getBoundingClientRect().right > document.documentElement.clientWidth - 8) {
      setMoveMenuFlip(true)
    }
  }

  const clearMoveMenuTimer = (kind: 'open' | 'close') => {
    const timers = moveMenuTimers.current
    if (timers[kind] !== null) {
      window.clearTimeout(timers[kind])
      timers[kind] = null
    }
  }
  const [bulkMoveMenu, setBulkMoveMenu] = useState(false)

  useEffect(() => {
    if (!projectMode || !selectedProjectId) {
      setProjectFileEntries([])
      return
    }
    let active = true
    const api = window.aiOfficeProject!
    void api.listFiles(selectedProjectId).then(async (paths) => {
      const stats = await window.aiOffice.statPaths(paths)
      if (!active) return
      setProjectFileEntries(stats.sort((a, b) => b.mtimeMs - a.mtimeMs))
    })
    return () => {
      active = false
    }
  }, [projectMode, selectedProjectId, projectTick])

  // the submenu lives inside the row menu: when that closes, drop the stale
  // submenu state and any pending hover timers so it doesn't reopen expanded
  useEffect(() => {
    if (rowMenu === null) {
      clearMoveMenuTimer('open')
      clearMoveMenuTimer('close')
      setMoveFileMenu(null)
    }
  }, [rowMenu])

  // close the move-file menu
  useEffect(() => {
    if (!moveFileMenu) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target?.closest?.('.move-menu-wrap')) setMoveFileMenu(null)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [moveFileMenu])

  // close the bulk move-to-project menu in the selection bar
  useEffect(() => {
    if (!bulkMoveMenu) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target?.closest?.('.selection-move-wrap')) setBulkMoveMenu(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBulkMoveMenu(false)
    }
    window.addEventListener('pointerdown', handler)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [bulkMoveMenu])

  // ── Plain view (no project selected): filtering runs in the main process; entries is the visible list ──
  const selectedPaths = entries.filter((e) => selected.has(e.path)).map((e) => e.path)
  const allSelected = entries.length > 0 && selectedPaths.length === entries.length

  // project view shares the same `selected` set (keyed by path)
  const projSelectedPaths = projectFileEntries
    .filter((e) => selected.has(e.path))
    .map((e) => e.path)
  const projAllSelected =
    projectFileEntries.length > 0 && projSelectedPaths.length === projectFileEntries.length

  const changeView = (next: 'recent' | 'starred') => {
    setView(next)
    setSelected(new Set())
    setRowMenu(null)
  }

  const changeFilter = (key: string) => {
    setFilter(key)
    setSelected(new Set())
    setRowMenu(null)
  }

  const toggleSelect = (path: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(path)
      else next.delete(path)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.path)))
  }

  const toggleSelectAllProject = () => {
    setSelected(projAllSelected ? new Set() : new Set(projectFileEntries.map((e) => e.path)))
  }

  const toggleStar = (path: string) => {
    void window.aiOffice.toggleStar(path).then(refresh)
  }

  const removeRecent = (paths: string[]) => {
    setRowMenu(null)
    setSelected(new Set())
    void window.aiOffice.removeRecent(paths).then(refresh)
  }

  const deleteFiles = (paths: string[]) => {
    setRowMenu(null)
    setConfirmDelete(paths)
  }

  const confirmDeleteNow = () => {
    const paths = confirmDelete ?? []
    setConfirmDelete(null)
    setSelected(new Set())
    void window.aiOffice.deleteFiles(paths).then(refresh)
  }

  const duplicateFile = (path: string) => {
    setRowMenu(null)
    void window.aiOffice.duplicateFile(path).then(refresh)
  }

  const startRename = (entry: RecentEntry) => {
    setRowMenu(null)
    setRenaming({ path: entry.path, value: baseName(entry) })
  }

  const commitRename = (entry: RecentEntry) => {
    const value = renaming?.value.trim() ?? ''
    setRenaming(null)
    if (!value || value === baseName(entry)) return
    const newName = entry.ext ? `${value}.${entry.ext}` : value
    void window.aiOffice.renameFile(entry.path, newName).then((result) => {
      if (!result.ok) window.alert(result.error ?? t('renameFailed'))
      refresh()
    })
  }

  const moveFileTo = async (filePath: string, targetProjectId: string) => {
    setMoveFileMenu(null)
    setRowMenu(null)
    await window.aiOfficeProject?.moveFile(filePath, targetProjectId)
    refresh()
    if (selectedProjectId) {
      setProjectFileEntries((prev) => prev.filter((e) => e.path !== filePath))
    }
  }

  const moveFilesTo = async (paths: string[], targetProjectId: string) => {
    setBulkMoveMenu(false)
    setSelected(new Set())
    // drop moved rows immediately (same as moveFileTo) so they cannot be
    // re-selected or re-moved while the sequential IPC loop is in flight
    const moved = new Set(paths)
    setProjectFileEntries((prev) => prev.filter((e) => !moved.has(e.path)))
    for (const path of paths) {
      await window.aiOfficeProject?.moveFile(path, targetProjectId)
    }
    refresh()
  }

  // ── New file (passes projectId when a project is selected) ──
  const handleNewDoc = () => {
    void window.aiOffice.newDoc(selectedProjectId ? { projectId: selectedProjectId } : undefined)
  }

  const handleNewSheet = () => {
    void window.aiOffice.newSheet(selectedProjectId ? { projectId: selectedProjectId } : undefined)
  }

  const handleNewSlide = () => {
    void window.aiOffice.newSlide(selectedProjectId ? { projectId: selectedProjectId } : undefined)
  }

  const NEW_ITEMS = [
    { ext: 'docx', title: t('newDoc'), sub: '.docx', action: handleNewDoc },
    { ext: 'xlsx', title: t('newSheet'), sub: '.xlsx', action: handleNewSheet },
    { ext: 'pptx', title: t('newSlide'), sub: '.pptx', action: handleNewSlide },
  ]

  function renderQuickCards() {
    return (
      <div className="quick-cards">
        {NEW_ITEMS.map((item) => (
          <button key={item.ext} className="quick-card" onClick={() => void item.action()}>
            <FileBadge ext={item.ext} size={30} />
            <span className="quick-text">
              <span className="quick-title-row">
                <span className="quick-title">{item.title}</span>
                <span className="ai-chip">AI</span>
              </span>
              <span className="quick-sub">{item.sub}</span>
            </span>
          </button>
        ))}
        <button className="quick-card" onClick={() => void window.aiOffice.browse()}>
          <span className="quick-folder">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.1c.44 0 .85.19 1.13.52L8.4 4.4H13A1.5 1.5 0 0 1 14.5 5.9v5.6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5V4z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="quick-text">
            <span className="quick-title-row">
              <span className="quick-title">{t('openLocal')}</span>
            </span>
            <span className="quick-sub">.docx / .xlsx / .xls / .csv / .pptx / .pdf</span>
          </span>
        </button>
      </div>
    )
  }

  // ── File row rendering (shared by the plain view and the project files view) ──

  function renderFileRow(entry: RecentEntry, context: 'global' | 'project') {
    const isRenaming = renaming?.path === entry.path
    const otherProjects = projects.filter(
      (p) => p.id !== (context === 'project' ? selectedProjectId : undefined),
    )
    return (
      <li className="recent-row" key={entry.path}>
        <div
          className="recent-item"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isRenaming) void window.aiOffice.openPath(entry.path)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.target === event.currentTarget) {
              void window.aiOffice.openPath(entry.path)
            }
          }}
        >
          <span className="col-check" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              className="row-check"
              checked={selected.has(entry.path)}
              onChange={(event) => toggleSelect(entry.path, event.target.checked)}
              aria-label={t('selectFile', { name: entry.name })}
            />
          </span>
          <span className="recent-icon">
            <FileBadge ext={entry.ext} size={24} />
          </span>
          {isRenaming ? (
            <input
              className="rename-input"
              value={renaming.value}
              autoFocus
              onFocus={(event) => event.target.select()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenaming({ path: entry.path, value: event.target.value })}
              onBlur={() => commitRename(entry)}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') commitRename(entry)
                if (event.key === 'Escape') setRenaming(null)
              }}
            />
          ) : (
            <span className="recent-name">{entry.name}</span>
          )}
          <span className="recent-path">{parentDir(entry.path)}</span>
          <span className="recent-time">{formatModified(entry.mtimeMs, i18n)}</span>
          <span className="recent-size">{formatSize(entry.sizeBytes)}</span>
          <button
            className={`star-btn${entry.starred ? ' starred' : ''}`}
            aria-label={entry.starred ? t('unstar') : t('star')}
            onClick={(event) => {
              event.stopPropagation()
              toggleStar(entry.path)
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 1.9l1.9 3.85 4.25.62-3.07 3 .72 4.23L8 11.6l-3.8 2 .72-4.23-3.07-3 4.25-.62z"
                fill={entry.starred ? '#f5a623' : 'none'}
                stroke={entry.starred ? '#f5a623' : 'currentColor'}
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="recent-actions" onClick={(event) => event.stopPropagation()}>
            <button
              className="more-btn"
              aria-label={t('moreActions')}
              aria-expanded={rowMenu === entry.path}
              onClick={() => setRowMenu(rowMenu === entry.path ? null : entry.path)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="3.2" cy="8" r="1.4" fill="currentColor" />
                <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                <circle cx="12.8" cy="8" r="1.4" fill="currentColor" />
              </svg>
            </button>
            {rowMenu === entry.path && (
              <div className="row-menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setRowMenu(null)
                    void window.aiOffice.openPath(entry.path)
                  }}
                >
                  {t('open')}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setRowMenu(null)
                    void window.aiOffice.revealPath(entry.path)
                  }}
                >
                  {t('revealInFolder')}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setRowMenu(null)
                    void navigator.clipboard.writeText(entry.path)
                  }}
                >
                  {t('copyPath')}
                </button>
                {projectMode && otherProjects.length > 0 && (
                  <>
                    <div className="row-menu-divider" />
                    <div
                      className="move-menu-wrap"
                      onMouseEnter={() => {
                        clearMoveMenuTimer('close')
                        if (moveFileMenu === entry.path) return
                        clearMoveMenuTimer('open')
                        moveMenuTimers.current.open = window.setTimeout(
                          () => openMoveMenu(entry.path),
                          160,
                        )
                      }}
                      onMouseLeave={() => {
                        clearMoveMenuTimer('open')
                        clearMoveMenuTimer('close')
                        moveMenuTimers.current.close = window.setTimeout(
                          () => setMoveFileMenu(null),
                          140,
                        )
                      }}
                    >
                      <button
                        role="menuitem"
                        className="submenu-trigger"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearMoveMenuTimer('open')
                          clearMoveMenuTimer('close')
                          if (moveFileMenu === entry.path) setMoveFileMenu(null)
                          else openMoveMenu(entry.path)
                        }}
                      >
                        {t('moveToProject')}
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 12 12"
                          aria-hidden="true"
                          style={{ marginLeft: 'auto' }}
                        >
                          <path
                            d="M4.5 2.5l4 3.5-4 3.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                      </button>
                      {moveFileMenu === entry.path && (
                        <div
                          className={`submenu${moveMenuFlip ? ' submenu-left' : ''}`}
                          role="menu"
                          ref={measureSubmenu}
                        >
                          {otherProjects.map((p) => (
                            <button
                              key={p.id}
                              role="menuitem"
                              onClick={() => void moveFileTo(entry.path, p.id)}
                            >
                              {p.isDefault ? t('defaultProject') : p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="row-menu-divider" />
                <button role="menuitem" onClick={() => startRename(entry)}>
                  {t('rename')}
                </button>
                <button role="menuitem" onClick={() => duplicateFile(entry.path)}>
                  {t('duplicate')}
                </button>
                {context === 'global' && selectedPaths.length === 0 && (
                  <>
                    <div className="row-menu-divider" />
                    <button role="menuitem" onClick={() => removeRecent([entry.path])}>
                      {t('removeFromList')}
                    </button>
                    <button
                      role="menuitem"
                      className="danger"
                      onClick={() => deleteFiles([entry.path])}
                    >
                      {t('deleteFiles')}
                    </button>
                  </>
                )}
              </div>
            )}
          </span>
        </div>
      </li>
    )
  }

  // ── Project files view ────────────────────────────────

  function renderProjectContent() {
    const proj = projects.find((p) => p.id === selectedProjectId)
    if (!proj) return null
    const otherProjects = projects.filter((p) => p.id !== proj.id)

    return (
      <main className="content">
        <section className="quick-start" aria-label={t('secQuickStart')}>
          <div className="section-head">
            <span className="section-label">{t('secQuickStart')}</span>
          </div>
          {renderQuickCards()}
        </section>

        <section className="recents" aria-label={t('secProjectFiles')}>
          <div className="recents-toolbar">
            <div className="recents-heading">
              <span className="section-label">{t('secProjectFiles')}</span>
              <span className="file-count">
                {t(fileCountKey(projectFileEntries.length), { n: projectFileEntries.length })}
              </span>
            </div>
            {projSelectedPaths.length > 0 && (
              <div className="selection-bar">
                <span className="selection-count">
                  {t('selectedCount', { n: projSelectedPaths.length })}
                </span>
                {otherProjects.length > 0 && (
                  <span className="selection-move-wrap">
                    <button
                      className="selection-action"
                      aria-expanded={bulkMoveMenu}
                      onClick={() => setBulkMoveMenu((open) => !open)}
                    >
                      {t('moveToProject')}
                    </button>
                    {bulkMoveMenu && (
                      <div className="selection-move-menu" role="menu">
                        {otherProjects.map((p) => (
                          <button
                            key={p.id}
                            role="menuitem"
                            onClick={() => void moveFilesTo(projSelectedPaths, p.id)}
                          >
                            {p.isDefault ? t('defaultProject') : p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </span>
                )}
                <button
                  className="selection-action danger"
                  onClick={() => deleteFiles(projSelectedPaths)}
                >
                  {t('deleteFiles')}
                </button>
                <button className="selection-action" onClick={() => setSelected(new Set())}>
                  {t('cancel')}
                </button>
              </div>
            )}
          </div>

          {projectFileEntries.length === 0 ? (
            <p className="empty proj-empty">
              <svg
                className="proj-empty-icon"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6.29297 3.75H14.1729C14.4927 3.75 14.7979 3.88392 15.0146 4.11914L18.5566 7.96387C18.7512 8.17512 18.8593 8.45208 18.8594 8.73926V19.1055C18.8593 19.7376 18.346 20.25 17.7139 20.25H6.29297C5.66091 20.2499 5.14855 19.7375 5.14844 19.1055V4.89453C5.14855 4.26247 5.66091 3.75011 6.29297 3.75Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M13.8984 4V7.11C13.8984 8.15382 14.7446 9 15.7884 9H18.8984"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="empty-hint">{t('projEmptyHint')}</span>
            </p>
          ) : (
            <div className="recent-table">
              <div className="recent-columns">
                <span className="col-check">
                  <input
                    type="checkbox"
                    checked={projAllSelected}
                    onChange={toggleSelectAllProject}
                    aria-label={t('selectAll')}
                  />
                </span>
                <span className="col-name">{t('colName')}</span>
                <span>{t('colLocation')}</span>
                <span>{t('colModified')}</span>
                <span className="col-size">{t('colSize')}</span>
                <span />
                <span />
              </div>
              <ul className="recent-list">
                {projectFileEntries.map((entry) => renderFileRow(entry, 'project'))}
              </ul>
            </div>
          )}
        </section>
      </main>
    )
  }

  // ── Plain view ────────────────────────────────────────

  function renderGlobalContent() {
    const now = new Date()
    const hour = now.getHours()
    const greetKey =
      hour < 6
        ? 'greetEvening'
        : hour < 12
          ? 'greetMorning'
          : hour < 18
            ? 'greetAfternoon'
            : 'greetEvening'
    const cjk = lang === 'zh' || lang === 'zh-TW' || lang === 'ja'
    const greeting = `${t(greetKey)}${accountName ? (cjk ? '，' : ', ') + accountName : ''}${cjk ? '。' : '. '}`
    return (
      <main className="content">
        <section className="quick-start" aria-label={t('secQuickStart')}>
          <div className="home-hero">
            <h1 className="hero-title">
              {greeting}
              <span className="hero-ask">{t(greetAskKey)}</span>
            </h1>
          </div>
          {renderQuickCards()}
        </section>

        <section
          className="recents"
          aria-label={view === 'recent' ? t('secRecent') : t('secStarred')}
        >
          <div className="recents-toolbar">
            <div className="recents-heading">
              <span className="section-label">
                {view === 'recent' ? t('secRecent') : t('secStarred')}
              </span>
              <span className="file-count">{t(fileCountKey(listTotal), { n: listTotal })}</span>
            </div>
            {selectedPaths.length > 0 ? (
              <div className="selection-bar">
                <span className="selection-count">
                  {t('selectedCount', { n: selectedPaths.length })}
                </span>
                <button className="selection-action" onClick={() => removeRecent(selectedPaths)}>
                  {t('removeFromList')}
                </button>
                <button
                  className="selection-action danger"
                  onClick={() => deleteFiles(selectedPaths)}
                >
                  {t('deleteFiles')}
                </button>
                <button className="selection-action" onClick={() => setSelected(new Set())}>
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <div className="filter-pills" role="tablist" aria-label={t('filterAria')}>
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`filter-pill${filter === f.key ? ' active' : ''}`}
                    onClick={() => changeFilter(f.key)}
                  >
                    {t(f.label)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="empty proj-empty">
              <svg
                className="proj-empty-icon"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6.29297 3.75H14.1729C14.4927 3.75 14.7979 3.88392 15.0146 4.11914L18.5566 7.96387C18.7512 8.17512 18.8593 8.45208 18.8594 8.73926V19.1055C18.8593 19.7376 18.346 20.25 17.7139 20.25H6.29297C5.66091 20.2499 5.14855 19.7375 5.14844 19.1055V4.89453C5.14855 4.26247 5.66091 3.75011 6.29297 3.75Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M13.8984 4V7.11C13.8984 8.15382 14.7446 9 15.7884 9H18.8984"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="empty-hint">
                {view === 'starred'
                  ? t('emptyStarred')
                  : navCounts.recent === 0
                    ? t('emptyRecent')
                    : t('emptyFiltered')}
              </span>
            </p>
          ) : (
            <div className={`recent-table${selectedPaths.length > 0 ? ' has-selection' : ''}`}>
              <div className="recent-columns">
                <span className="col-check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t('selectAll')}
                  />
                </span>
                <span className="col-name">{t('colName')}</span>
                <span>{t('colLocation')}</span>
                <span>{t('colModified')}</span>
                <span className="col-size">{t('colSize')}</span>
                <span />
                <span />
              </div>
              <ul className="recent-list">
                {entries.map((entry) => renderFileRow(entry, 'global'))}
              </ul>
              {hasMore && (
                <div ref={sentinelRef} className="load-more" aria-hidden="true">
                  <span className="load-more-spinner" />
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    )
  }

  function renderKnowledgeContent() {
    const embed = appSettings.embedding ?? {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
    }
    const providerLabel = embed.provider === 'ollama' ? 'Ollama' : 'OpenAI-compatible'

    // Group every document under its collection for the tree view
    const docsByKb = new Map<string, KnowledgeDocument[]>()
    for (const doc of knowledgeDocs) {
      const list = docsByKb.get(doc.knowledgeBaseId) ?? []
      list.push(doc)
      docsByKb.set(doc.knowledgeBaseId, list)
    }
    const toggleKb = (id: string) => {
      setExpandedKbs((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    return (
      <main className="content">
        <div className="main-head">
          <div className="main-title-group">
            <h1 className="main-title">Knowledge Management</h1>
          </div>
        </div>

        <div className="settings-tab-bar" style={{ marginTop: 16, marginBottom: 16 }}>
          <button
            className={`settings-tab-btn${kbViewTab === 'documents' ? ' active' : ''}`}
            onClick={() => setKbViewTab('documents')}
          >
            Upload Document
          </button>
          <button
            className={`settings-tab-btn${kbViewTab === 'workbench' ? ' active' : ''}`}
            onClick={() => setKbViewTab('workbench')}
          >
            Semantic Workbench
          </button>
          <button
            className={`settings-tab-btn${kbViewTab === 'skills' ? ' active' : ''}`}
            onClick={() => setKbViewTab('skills')}
          >
            Skills
          </button>
        </div>

        {kbViewTab === 'documents' && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                padding: 16,
                background: 'var(--surface-subtle, #f8f9fa)',
                border: '1px solid var(--border-color, #e9ecef)',
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong>SQLite Vector Database Status:</strong> Active ({knowledgeDocs.length}{' '}
                documents indexed)
                <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  Embedding Provider: <strong>{providerLabel}</strong> ({embed.model}) &bull; Base
                  URL: <code>{embed.baseUrl}</code>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setSettingsModalOpen(true)}>
                Configure Model
              </button>
            </div>

            <CollectionsManager
              knowledgeBases={knowledgeBases}
              onCreate={(name) => handleCreateKnowledgeBase(name)}
              onRename={handleRenameKnowledgeBase}
              onDelete={(id) => void handleDeleteKnowledgeBase(id)}
            />

            {knowledgeBases.length === 0 ? (
              <div
                className="empty proj-empty"
                style={{
                  padding: '40px 20px',
                  border: '2px dashed var(--border-color, #dee2e6)',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
                onClick={() => void handleUploadKnowledgeDoc()}
              >
                <span className="empty-title" style={{ fontWeight: 600, fontSize: 15, marginTop: 8 }}>
                  No Knowledge Base Collections Yet
                </span>
                <span className="empty-hint" style={{ marginTop: 4 }}>
                  Create a collection in the sidebar, then click or select `.pdf` / `.md` files to
                  chunk, store, and vectorize.
                </span>
              </div>
            ) : (
              <div className="kb-tree">
                {knowledgeBases.map((kb) => {
                  const docs = docsByKb.get(kb.id) ?? []
                  const expanded = expandedKbs.has(kb.id)
                  return (
                    <div key={kb.id} className="kb-tree-branch">
                      <div className="kb-tree-kb">
                        <button
                          className="kb-tree-toggle"
                          onClick={() => toggleKb(kb.id)}
                          aria-label={expanded ? 'Collapse' : 'Expand'}
                        >
                          {expanded ? '▾' : '▸'}
                        </button>
                        <span className="kb-tree-kb-name" title={kb.name}>
                          {kb.name}
                        </span>
                        <span className="kb-tree-count">
                          {docs.length} doc{docs.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {expanded && (
                        <div className="kb-tree-docs">
                          {docs.length === 0 && (
                            <div className="kb-tree-empty">No documents in this collection.</div>
                          )}
                          {docs.map((doc) => (
                            <DocumentTreeRow
                              key={doc.id}
                              doc={doc}
                              otherCollections={knowledgeBases
                                .filter((o) => o.id !== kb.id)
                                .map((o) => ({ id: o.id, name: o.name }))}
                              onPreview={(docId, tab) => void handlePreviewDoc(docId, tab)}
                              onDelete={(docId, name) => void handleDeleteDoc(docId, name)}
                              onMove={(docId, targetKbId) => void handleMoveDoc(docId, targetKbId)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid var(--border-color, #e9ecef)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, maxWidth: 560, fontSize: 13, color: 'var(--text-muted, #666)', lineHeight: 1.5 }}>
                Upload documents for chunking and vector storage, run semantic retrieval, and manage
                reusable AI skills.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted, #666)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Upload to:
                  <select
                    value={selectedKbId ?? ''}
                    onChange={(e) => setSelectedKbId(e.target.value || null)}
                    style={{
                      padding: '5px 8px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                    }}
                  >
                    {knowledgeBases.map((kb) => (
                      <option key={kb.id} value={kb.id}>
                        {kb.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn-primary"
                  disabled={uploadingDoc}
                  onClick={() => void handleUploadKnowledgeDoc()}
                >
                  {uploadingDoc ? 'Uploading & Chunking...' : '+ Upload Document (.pdf / .md)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {kbViewTab === 'workbench' && (
          /* Semantic Workbench Tab */
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: 16,
                background: 'var(--surface-subtle, #f8f9fa)',
                border: '1px solid var(--border-color, #e9ecef)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>RAG Retrieval Testing Parameters</div>

              {/* Collections Multi-Select Checkboxes */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Target Knowledge Base Collections:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={workbenchSelectedKbIds.length === 0}
                      onChange={() => setWorkbenchSelectedKbIds([])}
                    />
                    <span>All Collections (Global Search)</span>
                  </label>
                  {knowledgeBases.map((kb) => {
                    const isChecked = workbenchSelectedKbIds.includes(kb.id)
                    return (
                      <label key={kb.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWorkbenchSelectedKbIds((prev) => [...prev, kb.id])
                            } else {
                              setWorkbenchSelectedKbIds((prev) => prev.filter((id) => id !== kb.id))
                            }
                          }}
                        />
                        <span>{kb.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Search Mode & Scope & Top K */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Search Mode:</span>
                  <select
                    value={workbenchMode}
                    style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface-1)' }}
                    onChange={(e) => setWorkbenchMode(e.target.value as 'hybrid' | 'vector' | 'fts')}
                  >
                    <option value="hybrid">Hybrid (Vector + FTS via RRF)</option>
                    <option value="vector">Vector Only (Cosine Similarity)</option>
                    <option value="fts">FTS Only (SQLite FTS5 BM25)</option>
                  </select>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Target Scope:</span>
                  <select
                    value={workbenchScope}
                    style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface-1)' }}
                    onChange={(e) => setWorkbenchScope(e.target.value as 'chunks' | 'documents')}
                  >
                    <option value="chunks">Chunks / Passages</option>
                    <option value="documents">Full Documents</option>
                  </select>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Max Results:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={workbenchTopK}
                    style={{ width: 60, padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--border-strong)' }}
                    onChange={(e) => setWorkbenchTopK(Math.max(1, Math.min(20, Number(e.target.value) || 5)))}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <textarea
                  style={{
                    flex: 1,
                    minHeight: 60,
                    padding: 10,
                    fontSize: 13,
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #ccc)',
                    fontFamily: 'inherit',
                  }}
                  placeholder="Type a semantic search query to test RAG retrieval (e.g. Database Security System Configuration Requirements)"
                  value={workbenchQuery}
                  onChange={(e) => setWorkbenchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleRunWorkbenchSearch()
                    }
                  }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '10px 16px', height: '100%' }}
                  disabled={workbenchSearching || !workbenchQuery.trim()}
                  onClick={() => void handleRunWorkbenchSearch()}
                >
                  {workbenchSearching ? 'Searching...' : 'Run RAG Search'}
                </button>
              </div>
            </div>

            {/* Results Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  Retrieval Matches ({workbenchResults.length})
                </h3>
              </div>

              {workbenchResults.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-subtle, #fafafa)', borderRadius: 8, border: '1px solid var(--border-color, #eee)', fontSize: 13 }}>
                  No matches retrieved yet. Enter a query and click "Run RAG Search".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {workbenchResults.map((match, i) => (
                    <div
                      key={`${match.documentId}-${match.chunkIndex}-${i}`}
                      style={{
                        border: '1px solid var(--border-color, #e0e0e0)',
                        borderRadius: 8,
                        padding: 14,
                        background: 'var(--surface-subtle, #fff)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: 'var(--accent-subtle, #e6f0ff)', color: 'var(--accent, #0066cc)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                            Match #{i + 1}
                          </span>
                          <span>
                            Document: <strong>{match.documentName}</strong> &bull; Collection:{' '}
                            <strong>{match.knowledgeBaseName}</strong>
                          </span>
                        </div>
                        <span
                          style={{
                            ...(match.scoreType === 'BM25 Score' || workbenchMode === 'fts'
                              ? { background: '#e0f2f1', color: '#00695c' }
                              : match.scoreType === 'Cosine Similarity' || workbenchMode === 'vector'
                                ? { background: '#e8f5e9', color: '#2e7d32' }
                                : { background: '#fff3e0', color: '#e65100' }),
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontWeight: 700,
                          }}
                        >
                          {match.scoreType ??
                            (workbenchMode === 'vector'
                              ? 'Cosine Similarity'
                              : workbenchMode === 'fts'
                                ? 'BM25 Score'
                                : 'RRF Score')}
                          : {match.similarityScore}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Header Path: <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>{renderHighlightedText(match.headerPath, workbenchQuery)}</code>
                      </div>

                      <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {renderHighlightedText(match.text, workbenchQuery)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {kbViewTab === 'skills' && (
          <SkillsTab
            skills={skills}
            onCreate={handleCreateSkill}
            onUpdate={handleUpdateSkill}
            onDelete={handleDeleteSkill}
          />
        )}
      </main>
    )
  }

  function renderDocumentPreviewModal() {
    if (!previewModalOpen || !previewDocData) return null
    const { document: doc, chunks, fullText } = previewDocData
    const headings = extractMarkdownHeadings(fullText)
    const headingIds = new Map(headings.map((h, i) => [i, h.id]))

    const scrollToHeading = (id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
      <div className="modal-overlay" onClick={() => setPreviewModalOpen(false)}>
        <div
          className="modal"
          style={{
            maxWidth: previewWide ? 'calc(100vw - 40px)' : 'min(1400px, 94vw)',
            width: '92%',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileBadge ext={doc.ext} size={24} />
              <h3 style={{ margin: 0, fontSize: 18 }}>{doc.name}</h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewWide((w) => !w)}
                title={previewWide ? 'Collapse preview width' : 'Expand preview to full width'}
                aria-label={previewWide ? 'Collapse preview width' : 'Expand preview to full width'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
                  {previewWide ? (
                    // collapse: corners point inward
                    <path d="M1.5 4V1.5H4M12.5 4V1.5H10M4 12.5H1.5V10M10 12.5H12.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  ) : (
                    // expand: corners point outward
                    <path d="M4 1.5H1.5V4M10 1.5H12.5V4M1.5 10V12.5H4M12.5 10V12.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  )}
                </svg>
              </button>
              <button className="btn btn-secondary" onClick={() => setPreviewModalOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className="settings-tab-bar" style={{ marginBottom: 16 }}>
            <button
              className={`settings-tab-btn${previewTab === 'full' ? ' active' : ''}`}
              onClick={() => setPreviewTab('full')}
            >
              Full Document Preview
            </button>
            <button
              className={`settings-tab-btn${previewTab === 'chunks' ? ' active' : ''}`}
              onClick={() => setPreviewTab('chunks')}
            >
              Chunk Inspector ({chunks.length})
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16 }}>
            {previewTab === 'full' ? (
              <>
                {headings.length > 0 && (
                  <nav
                    className="kb-preview-toc"
                    style={{
                      width: 220,
                      flexShrink: 0,
                      minHeight: 0,
                      overflowY: 'auto',
                      borderRight: '1px solid var(--border-color, #e9ecef)',
                      paddingRight: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        color: 'var(--text-muted, #666)',
                        marginBottom: 10,
                      }}
                    >
                      Table of Contents
                    </div>
                    {headings.map((h) => (
                      <button
                        key={h.id}
                        className="kb-preview-toc-link"
                        style={{ paddingLeft: 6 + (h.level - 1) * 14 }}
                        onClick={() => scrollToHeading(h.id)}
                        title={h.text}
                      >
                        {h.text}
                      </button>
                    ))}
                  </nav>
                )}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    paddingRight: 4,
                    background: 'var(--surface-subtle, #f8f9fa)',
                    border: '1px solid var(--border-color, #e9ecef)',
                    borderRadius: 8,
                    padding: 16,
                    // keep every PDF/markdown line on one visual line; long
                    // lines scroll horizontally instead of wrapping mid-sentence
                    whiteSpace: 'pre',
                  }}
                >
                  <MarkdownPreview content={fullText} headingIds={headingIds} />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                {chunks.map((chunk: KnowledgeChunkRecord) => (
                  <div
                    key={chunk.id}
                    style={{
                      border: '1px solid var(--border-color, #e9ecef)',
                      borderRadius: 8,
                      padding: 12,
                      background: 'var(--surface-subtle, #fff)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                      <span>
                        Chunk #{chunk.chunkIndex + 1} &bull; <code style={{ background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 4 }}>{chunk.headerPath}</code>
                      </span>
                      <span>{chunk.charCount} characters</span>
                    </div>
                    <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'pre', overflowX: 'auto' }}>
                      <MarkdownPreview content={chunk.text} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home">
      <aside className="sidebar">
        <div
          className="sidebar-logo"
          role="button"
          tabIndex={0}
          title="Open Mauro Benetti's LinkedIn profile"
          onClick={() => void window.aiOffice?.openLinkedIn()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              void window.aiOffice?.openLinkedIn()
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <img className="logo-lockup" src={appIcon} width={28} height={28} alt="Open Office Ai" style={{ borderRadius: '6px' }} />
          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>Open Office Ai</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item${view === 'recent' && !selectedProjectId && !selectedKnowledgeView ? ' active' : ''}`}
            onClick={() => {
              setSelectedProjectId(null)
              setSelectedKnowledgeView(false)
              changeView('recent')
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <path
                d="M8 4.5V8l2.5 1.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="nav-label">{t('navRecent')}</span>
            <span className="nav-count">{navCounts.recent}</span>
          </button>

          <button
            className={`nav-item${view === 'starred' && !selectedProjectId && !selectedKnowledgeView ? ' active' : ''}`}
            onClick={() => {
              setSelectedProjectId(null)
              setSelectedKnowledgeView(false)
              changeView('starred')
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 1.9l1.9 3.85 4.25.62-3.07 3 .72 4.23L8 11.6l-3.8 2 .72-4.23-3.07-3 4.25-.62z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            <span className="nav-label">{t('navStarred')}</span>
            <span className="nav-count">{navCounts.starred}</span>
          </button>
        </nav>

        {/* project sidebar */}
        {projectMode && (
          <>
            <div className="sidebar-divider" />
            <ProjectPanel
              projects={projects}
              selectedId={selectedProjectId}
              onSelect={(id) => {
                setSelectedProjectId(id)
                if (id !== null) setSelectedKnowledgeView(false)
                // reset list-selection state on any project switch (paths are
                // shared between the plain view and project views)
                setSelected(new Set())
                setRowMenu(null)
              }}
              onRefresh={refresh}
            />
          </>
        )}

        {/* knowledge base sidebar */}
        <div className="sidebar-divider" />
        <KnowledgePanel
          activeTab={kbViewTab}
          viewActive={selectedKnowledgeView}
          onOpenTab={(tab) => {
            setKbViewTab(tab)
            setSelectedKnowledgeView(true)
            setSelectedProjectId(null)
            setSelected(new Set())
            setRowMenu(null)
          }}
        />

        <div className="account-entry">
          <button className="account-btn" onClick={() => setSettingsModalOpen(true)} title="AI Settings">
            <span className="account-avatar logged-in">⚙</span>
            <span className="account-text">
              <span className="account-name">AI Settings</span>
              <span className="account-sub">Custom Endpoint</span>
            </span>
          </button>
          <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
        </div>
      </aside>

      {selectedKnowledgeView
        ? renderKnowledgeContent()
        : selectedProjectId
          ? renderProjectContent()
          : renderGlobalContent()}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('deleteModalTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{t('deleteModalTitle')}</h3>
            <p>
              {confirmDelete.length === 1
                ? t('deleteConfirmOne', { name: fileName(confirmDelete[0]) })
                : t('deleteConfirmMany', { n: confirmDelete.length })}
            </p>
            {confirmDelete.length > 1 && (
              <ul className="modal-file-list">
                {confirmDelete.slice(0, 6).map((p) => (
                  <li key={p}>{fileName(p)}</li>
                ))}
                {confirmDelete.length > 6 && (
                  <li>{t('deleteMoreCount', { n: confirmDelete.length })}</li>
                )}
              </ul>
            )}
            <div className="modal-buttons">
              <button
                className="btn btn-secondary"
                autoFocus
                onClick={() => setConfirmDelete(null)}
              >
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={() => confirmDeleteNow()}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderDocumentPreviewModal()}
    </div>
  )
}
