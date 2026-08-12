import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { AgentToolCall, AgentToolDef, ToolExecution } from '@genoffice/agent-core'
import type { OutlineNode } from '../OutlinePanel'
import type { SearchIndex } from '../search'
import { searchInIndex } from '../search'
import type { FormValueInput, MarkupType } from '../../shared/ipc'
import { t } from '../i18n/locale'

/** Text cap per read_pages fed back to the model (the payload is resent in full each turn, so volume must be limited) */
const READ_CHUNK_CHARS = 24_000

/** Capability surface App provides to AI tools; all getters, since the loop outlives render closures */
export interface PdfAiDeps {
  doc(): PDFDocumentProxy | null
  fileName(): string
  pageCount(): number
  /** Original page number of the currently visible page (1-based) */
  currentPage(): number
  readOnly(): boolean
  outline(): OutlineNode[] | null
  searchIndex(): Promise<SearchIndex> | null
  isDeleted(origIdx: number): boolean
  /** Original page number → scroll to that page; returns false if the page was deleted */
  gotoPage(origPage: number): boolean
  addMarkup(type: MarkupType, origIdx: number, rects: [number, number, number, number][]): void
  formEdits(): ReadonlyMap<string, FormValueInput>
  applyFormEdit(v: FormValueInput): void
  rotatePage(origIdx: number, dir: 90 | -90): void
  deletePage(origIdx: number): boolean
  markups?(): readonly LocalMarkup[]
  drawings?(): readonly LocalDrawing[]
  selectedText?(): string | null
}

export const AGENT_TOOLS: AgentToolDef[] = [
  {
    name: 'web_search',
    description:
      'Search the web for textual information (references/data/facts). Use when you need up-to-date information or are unsure about a fact. Returns titles/links/snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords/query' },
        maxResults: { type: 'integer', description: 'Maximum search results to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_pages',
    description:
      'Read the text content of a page range (with [Page N] markers). Read the relevant pages before answering questions; at most 10 pages per call, over-long output is truncated.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'integer', description: 'Start page number (1-based)' },
        end: {
          type: 'integer',
          description: 'End page number (inclusive); if omitted, only the start page is read',
        },
      },
      required: ['start'],
    },
  },
  {
    name: 'search_text',
    description:
      'Search the full text for a string; returns the page number and a context excerpt for each hit. Prefer this when locating which page something is on.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for (case-insensitive)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'goto_page',
    description: 'Scroll the reading view to the given page so the user can see it.',
    inputSchema: {
      type: 'object',
      properties: { page: { type: 'integer', description: 'Page number (1-based)' } },
      required: ['page'],
    },
  },
  {
    name: 'markup_text',
    description:
      'Add a markup (highlight/underline/strikeout) to a text passage on the given page. text must be a verbatim fragment that actually exists on that page (confirm with read_pages or search_text first); by default only the first occurrence is marked, all=true marks every occurrence on that page.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Page number (1-based)' },
        text: { type: 'string', description: 'Verbatim text fragment from the page' },
        type: {
          type: 'string',
          enum: ['highlight', 'underline', 'strikeout'],
          description: 'Markup type',
        },
        all: {
          type: 'boolean',
          description: 'Whether to mark every occurrence on the page; defaults to false',
        },
      },
      required: ['page', 'text', 'type'],
    },
  },
  {
    name: 'list_form_fields',
    description:
      'List all form fields in the document (name/type/current value/options/page). Must be called before filling forms to learn the fields.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'fill_form_field',
    description:
      'Fill in one form field. For text/choice/radio fields pass value (radio: the exportValue; choice: an option exportValue); for checkboxes pass checked.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Field name (from list_form_fields)' },
        value: { type: 'string', description: 'Value for text/choice/radio fields' },
        checked: { type: 'boolean', description: 'Checked state for checkboxes' },
      },
      required: ['name'],
    },
  },
  {
    name: 'rotate_page',
    description: 'Rotate the given page 90 degrees clockwise or counterclockwise.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Page number (1-based)' },
        direction: {
          type: 'string',
          enum: ['left', 'right'],
          description: 'left = counterclockwise, right = clockwise',
        },
      },
      required: ['page', 'direction'],
    },
  },
  {
    name: 'delete_page',
    description: 'Delete the given page (takes effect on save; the user can undo before saving).',
    inputSchema: {
      type: 'object',
      properties: { page: { type: 'integer', description: 'Page number (1-based)' } },
      required: ['page'],
    },
  },
  {
    name: 'get_outline',
    description:
      'Read the document outline (bookmarks) tree, including entry titles. Returns empty if the document has no outline.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_annotations',
    description:
      'Read all annotations, notes, highlights, and markups in the document (both saved PDF annotations and session edits). For highlights/underlines, this extracts the corresponding text under the marked area.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Optional: limit reading to a specific page number (1-based)' },
      },
    },
  },
]

const READONLY_OUTPUT =
  'The document is encrypted and read-only; it cannot be modified. Inform the user.'

function err(output: string, summary: string): ToolExecution {
  return { output, isError: true, summary }
}

/** Validate a 1-based page number; returns the original page index or an error */
function resolvePage(deps: PdfAiDeps, raw: unknown): { origIdx: number } | { bad: string } {
  const page = Number(raw)
  if (!Number.isInteger(page) || page < 1 || page > deps.pageCount()) {
    return {
      bad: `Page number ${String(raw)} is out of range (document has ${deps.pageCount()} pages)`,
    }
  }
  if (deps.isDeleted(page - 1)) return { bad: `Page ${page} has been deleted (unsaved)` }
  return { origIdx: page - 1 }
}

async function readPages(deps: PdfAiDeps, input: Record<string, unknown>): Promise<ToolExecution> {
  const doc = deps.doc()
  if (!doc) return err('Document not ready', t('aiToolReadPages', { start: '?', end: '?' }))
  const start = Number(input.start)
  const end = Math.min(Number(input.end ?? start), start + 9)
  const summary = t('aiToolReadPages', { start, end })
  if (!Number.isInteger(start) || start < 1 || end < start || start > doc.numPages) {
    return err(`Invalid page range (document has ${doc.numPages} pages)`, summary)
  }
  let out = ''
  for (let n = start; n <= Math.min(end, doc.numPages); n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      if ('str' in item) {
        text += item.str
        if (item.hasEOL) text += '\n'
      }
    }
    page.cleanup()
    out += `[Page ${n}]\n${text.trim()}\n\n`
    if (out.length > READ_CHUNK_CHARS) {
      out = `${out.slice(0, READ_CHUNK_CHARS)}\n… (truncated; read the rest in further calls)`
      break
    }
  }
  return {
    output: out.trim() || '(No extractable text in this range; the pages may be scanned images)',
    summary,
  }
}

async function searchText(deps: PdfAiDeps, input: Record<string, unknown>): Promise<ToolExecution> {
  const query = String(input.query ?? '').trim()
  if (!query) return err('query must not be empty', t('aiToolSearch', { query: '', count: 0 }))
  const indexPromise = deps.searchIndex()
  if (!indexPromise) return err('Document not ready', t('aiToolSearch', { query, count: 0 }))
  const index = await indexPromise
  const matches = searchInIndex(index, query)
  const lines: string[] = []
  for (const m of matches.slice(0, 40)) {
    const entry = index[m.pageIndex]!
    const pos = entry.lower.indexOf(query.toLowerCase())
    const from = Math.max(0, pos - 40)
    const snippet = entry.text.slice(from, pos + query.length + 40).replace(/\s+/g, ' ')
    lines.push(`Page ${m.pageIndex + 1}: …${snippet}…`)
  }
  if (matches.length > 40) lines.push(`(${matches.length} matches total; only the first 40 listed)`)
  return {
    output: lines.join('\n') || 'No matches found',
    summary: t('aiToolSearch', { query, count: matches.length }),
  }
}

async function markupText(deps: PdfAiDeps, input: Record<string, unknown>): Promise<ToolExecution> {
  const type = String(input.type) as MarkupType
  const summary = t('aiToolMarkup', { page: Number(input.page) })
  if (deps.readOnly()) return err(READONLY_OUTPUT, summary)
  if (!['highlight', 'underline', 'strikeout'].includes(type))
    return err(`Invalid type: ${type}`, summary)
  const r = resolvePage(deps, input.page)
  if ('bad' in r) return err(r.bad, summary)
  const text = String(input.text ?? '').trim()
  if (!text) return err('text must not be empty', summary)
  const indexPromise = deps.searchIndex()
  if (!indexPromise) return err('Document not ready', summary)
  const index = await indexPromise
  const onPage = searchInIndex(index, text).filter((m) => m.pageIndex === r.origIdx)
  if (onPage.length === 0) {
    return err(
      `"${text}" not found on page ${r.origIdx + 1}; use read_pages to verify the exact text`,
      summary,
    )
  }
  const targets = input.all === true ? onPage : onPage.slice(0, 1)
  for (const m of targets) deps.addMarkup(type, r.origIdx, m.rects)
  deps.gotoPage(r.origIdx + 1)
  return {
    output: `Marked ${targets.length} occurrence(s) on page ${r.origIdx + 1} (unsaved; the user saves with ⌘S)`,
    mutated: true,
    summary,
  }
}

interface RawWidget {
  subtype?: string
  fieldType?: string
  fieldName?: string
  fieldValue?: unknown
  buttonValue?: string
  readOnly?: boolean
  checkBox?: boolean
  radioButton?: boolean
  options?: { exportValue?: unknown; displayValue?: unknown }[]
}

/** Whole-document form field inventory (radios aggregate exportValue lists by field name) */
async function collectFields(
  doc: PDFDocumentProxy,
): Promise<Map<string, { kind: string; page: number; value: string; options: string[] }>> {
  const fields = new Map<string, { kind: string; page: number; value: string; options: string[] }>()
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const annots = (await page.getAnnotations()) as RawWidget[]
    for (const a of annots) {
      if (a.subtype !== 'Widget' || !a.fieldName || a.readOnly) continue
      const value = Array.isArray(a.fieldValue)
        ? String(a.fieldValue[0] ?? '')
        : String(a.fieldValue ?? '')
      if (a.fieldType === 'Tx') {
        fields.set(a.fieldName, { kind: 'text', page: n, value, options: [] })
      } else if (a.fieldType === 'Btn' && a.checkBox) {
        fields.set(a.fieldName, { kind: 'checkbox', page: n, value, options: [] })
      } else if (a.fieldType === 'Btn' && a.radioButton) {
        const cur = fields.get(a.fieldName) ?? { kind: 'radio', page: n, value, options: [] }
        if (typeof a.buttonValue === 'string' && !cur.options.includes(a.buttonValue))
          cur.options.push(a.buttonValue)
        fields.set(a.fieldName, cur)
      } else if (a.fieldType === 'Ch') {
        fields.set(a.fieldName, {
          kind: 'choice',
          page: n,
          value,
          options: (a.options ?? [])
            .map((o) => String(o.exportValue ?? o.displayValue ?? ''))
            .filter(Boolean),
        })
      }
    }
  }
  return fields
}

async function listFormFields(deps: PdfAiDeps): Promise<ToolExecution> {
  const doc = deps.doc()
  if (!doc) return err('Document not ready', t('aiToolFields', { count: 0 }))
  const fields = await collectFields(doc)
  const edits = deps.formEdits()
  const lines = [...fields].map(([name, f]) => {
    const edit = edits.get(name)
    const value = edit
      ? edit.kind === 'checkbox'
        ? String(!!edit.checked)
        : (edit.value ?? '')
      : f.value
    const opts = f.options.length > 0 ? ` options[${f.options.join(', ')}]` : ''
    return `${name} (${f.kind}, page ${f.page})${opts} current value: ${value || '(empty)'}`
  })
  return {
    output: lines.join('\n') || 'The document has no form fields',
    summary: t('aiToolFields', { count: fields.size }),
  }
}

async function fillFormField(
  deps: PdfAiDeps,
  input: Record<string, unknown>,
): Promise<ToolExecution> {
  const name = String(input.name ?? '')
  const summary = t('aiToolFill', { name })
  if (deps.readOnly()) return err(READONLY_OUTPUT, summary)
  const doc = deps.doc()
  if (!doc || !name) return err('Document not ready or name is empty', summary)
  const fields = await collectFields(doc)
  const field = fields.get(name)
  if (!field)
    return err(`No field named "${name}"; use list_form_fields to see the fields`, summary)
  let edit: FormValueInput
  if (field.kind === 'checkbox') {
    if (typeof input.checked !== 'boolean')
      return err('Checkbox requires the checked parameter', summary)
    edit = { name, kind: 'checkbox', checked: input.checked }
  } else {
    const value = String(input.value ?? '')
    if (field.kind !== 'text' && value && !field.options.includes(value)) {
      return err(
        `Value "${value}" is not among the options: [${field.options.join(', ')}]`,
        summary,
      )
    }
    edit = { name, kind: field.kind as 'text' | 'radio' | 'choice', value }
  }
  deps.applyFormEdit(edit)
  deps.gotoPage(field.page)
  return { output: `Filled ${name} (unsaved; the user saves with ⌘S)`, mutated: true, summary }
}

export async function executePdfTool(deps: PdfAiDeps, call: AgentToolCall): Promise<ToolExecution> {
  const input = call.input
  switch (call.name) {
    case 'web_search': {
      const query = String(input.query ?? '').trim()
      if (!query) return err('query must not be empty', 'Web Search')
      try {
        const r = await (window as any).pdfApi.webSearch(query, Number(input.maxResults) || 6)
        if (r.method === 'error') {
          return err(r.error || 'Search backend error', 'Web Search')
        }
        const lines: string[] = []
        if (r.answer) lines.push(`Direct answer: ${r.answer}\n`)
        r.results.forEach((it: any, i: number) => {
          lines.push(`[${i + 1}] ${it.title}\nSource: ${it.link}\n${it.snippet}\n`)
        })
        return {
          output: lines.join('\n') || 'No results found',
          summary: `Searched web for "${query}"`,
        }
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e), 'Web Search')
      }
    }
    case 'read_pages':
      return readPages(deps, input)
    case 'search_text':
      return searchText(deps, input)
    case 'goto_page': {
      const summary = t('aiToolGoto', { page: Number(input.page) })
      const r = resolvePage(deps, input.page)
      if ('bad' in r) return err(r.bad, summary)
      deps.gotoPage(r.origIdx + 1)
      return { output: `Jumped to page ${r.origIdx + 1}`, summary }
    }
    case 'markup_text':
      return markupText(deps, input)
    case 'list_form_fields':
      return listFormFields(deps)
    case 'fill_form_field':
      return fillFormField(deps, input)
    case 'rotate_page': {
      const summary = t('aiToolRotate', { page: Number(input.page) })
      if (deps.readOnly()) return err(READONLY_OUTPUT, summary)
      const r = resolvePage(deps, input.page)
      if ('bad' in r) return err(r.bad, summary)
      deps.rotatePage(r.origIdx, input.direction === 'left' ? -90 : 90)
      deps.gotoPage(r.origIdx + 1)
      return { output: `Rotated page ${r.origIdx + 1} (unsaved)`, mutated: true, summary }
    }
    case 'delete_page': {
      const summary = t('aiToolDelete', { page: Number(input.page) })
      if (deps.readOnly()) return err(READONLY_OUTPUT, summary)
      const r = resolvePage(deps, input.page)
      if ('bad' in r) return err(r.bad, summary)
      if (!deps.deletePage(r.origIdx)) return err('At least one page must remain', summary)
      return {
        output: `Deleted page ${r.origIdx + 1} (unsaved; can be undone)`,
        mutated: true,
        summary,
      }
    }
    case 'get_outline': {
      const outline = deps.outline()
      const lines: string[] = []
      const walk = (nodes: OutlineNode[], depth: number) => {
        for (const n of nodes) {
          lines.push(`${'  '.repeat(depth)}${n.title}`)
          if (n.items) walk(n.items, depth + 1)
        }
      }
      if (outline) walk(outline, 0)
      return {
        output: lines.join('\n') || 'The document has no outline',
        summary: t('aiToolOutline'),
      }
    }
    case 'read_annotations': {
      const doc = deps.doc()
      if (!doc) return err('Document not ready', 'Read Annotations')
      const targetPage = input.page ? Number(input.page) : null
      const lines: string[] = []

      for (let n = 1; n <= doc.numPages; n++) {
        if (targetPage !== null && targetPage !== n) continue
        if (deps.isDeleted(n - 1)) continue

        const page = await doc.getPage(n)
        const annots = await page.getAnnotations().catch(() => [])
        const content = await page.getTextContent().catch(() => ({ items: [] }))
        page.cleanup()

        // Helper to extract text under quads/rect
        const extractTextUnderQuads = (quads: number[][]): string => {
          interface TextItem { str: string; transform: number[]; width: number; height: number }
          const items = (content.items || []).filter((it): it is TextItem => 'str' in it)
          const matchedStrings: string[] = []

          for (const q of quads) {
            const xs = [q[0]!, q[2]!, q[4]!, q[6]!]
            const ys = [q[1]!, q[3]!, q[5]!, q[7]!]
            const minX = Math.min(...xs) - 2
            const maxX = Math.max(...xs) + 2
            const minY = Math.min(...ys) - 2
            const maxY = Math.max(...ys) + 2

            for (const item of items) {
              const ix = item.transform[4]!
              const iy = item.transform[5]!
              if (ix >= minX && ix <= maxX && iy >= minY && iy <= maxY) {
                if (item.str.trim()) matchedStrings.push(item.str.trim())
              }
            }
          }
          return matchedStrings.join(' ')
        }

        // 1. Saved PDF Annotations
        for (const a of annots) {
          const type = a.subtype || 'Annotation'
          const contents = a.contents || ''
          let extractedText = ''
          if (a.quadPoints && Array.isArray(a.quadPoints)) {
            const quads: number[][] = []
            for (let i = 0; i < a.quadPoints.length; i += 8) {
              quads.push(a.quadPoints.slice(i, i + 8))
            }
            extractedText = extractTextUnderQuads(quads)
          } else if (a.rect) {
            const r = a.rect
            extractedText = extractTextUnderQuads([[r[0], r[3], r[2], r[3], r[0], r[1], r[2], r[1]]])
          }

          if (extractedText || contents) {
            let desc = `[Page ${n}] Saved ${type}`
            if (extractedText) desc += `: "${extractedText}"`
            if (contents) desc += ` (Note: "${contents}")`
            lines.push(desc)
          }
        }

        // 2. Session Markups (Highlights / Underlines / Strikeouts)
        const sessionMarkups = (deps.markups?.() || []).filter((m) => m.pageIndex === n - 1)
        for (const m of sessionMarkups) {
          const text = extractTextUnderQuads(m.quads)
          lines.push(`[Page ${n}] Session ${m.type}: "${text || '(markup at coordinates)'}"`)
        }

        // 3. Session Drawings / Note Pins
        const sessionDrawings = (deps.drawings?.() || []).filter((d) => d.input.pageIndex === n - 1)
        for (const d of sessionDrawings) {
          if (d.input.kind === 'note') {
            lines.push(`[Page ${n}] Session Note Pin: "${d.input.contents}"`)
          }
        }
      }

      return {
        output: lines.join('\n') || 'No annotations, highlights, or notes found in the document.',
        summary: 'Read document annotations',
      }
    }
    default:
      return err(`Unknown tool: ${call.name}`, call.name)
  }
}
