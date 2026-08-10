import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { processPdf } from '@firecrawl/pdf-inspector'

// pdfjs needs the standard_fonts data directory for non-embedded standard fonts
// (Helvetica etc.); under Node a filesystem path works (same usage as the official
// Node example). The packaged build may fail require.resolve (only out/** is bundled),
// so return undefined and omit it — degrading to "non-embedded standard fonts may be
// slightly incomplete" (most embedded-font PDFs unaffected) instead of crashing parsing.
function standardFontDataUrl(): string | undefined {
  try {
    const require = createRequire(import.meta.url)
    const pdfPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs')
    return `${join(dirname(pdfPath), '..', '..', 'standard_fonts')}/`
  } catch {
    return undefined
  }
}

/**
 * pdfjs's Node compat layer borrows DOMMatrix from the optional dep @napi-rs/canvas,
 * and pdf.mjs calls `new DOMMatrix()` at module top level — in the packaged build
 * (no node_modules inside asar) the require fails, so the import throws
 * "DOMMatrix is not defined" and PDF attachment parsing breaks entirely (not
 * reproducible in dev since the dep happens to be present). Text extraction only
 * needs a tiny subset of 2D affine matrices, so ship a pure-JS fallback that
 * doesn't depend on packaging layout.
 */
function installDomMatrixPolyfill(): void {
  const g = globalThis as { DOMMatrix?: unknown }
  if (g.DOMMatrix) return
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    constructor(init?: number[] | DOMMatrixPolyfill) {
      if (Array.isArray(init) && init.length >= 6) {
        ;[this.a, this.b, this.c, this.d, this.e, this.f] = init as [number, number, number, number, number, number]
      } else if (init && typeof init === 'object') {
        const m = init as DOMMatrixPolyfill
        this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.e = m.e; this.f = m.f
      }
    }
    get is2D(): boolean { return true }
    get isIdentity(): boolean {
      return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0
    }
    /** this × other (DOM spec semantics: result applied to a point = this(other(p))) */
    #product(o: DOMMatrixPolyfill): [number, number, number, number, number, number] {
      return [
        this.a * o.a + this.c * o.b,
        this.b * o.a + this.d * o.b,
        this.a * o.c + this.c * o.d,
        this.b * o.c + this.d * o.d,
        this.a * o.e + this.c * o.f + this.e,
        this.b * o.e + this.d * o.f + this.f,
      ]
    }
    #assign(v: [number, number, number, number, number, number]): this {
      ;[this.a, this.b, this.c, this.d, this.e, this.f] = v
      return this
    }
    multiply(o: DOMMatrixPolyfill): DOMMatrixPolyfill { return new DOMMatrixPolyfill(this.#product(o)) }
    multiplySelf(o: DOMMatrixPolyfill): this { return this.#assign(this.#product(o)) }
    preMultiplySelf(o: DOMMatrixPolyfill): this { return this.#assign(o.#product(this)) }
    translate(tx = 0, ty = 0): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]))
    }
    translateSelf(tx = 0, ty = 0): this { return this.multiplySelf(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty])) }
    scale(sx = 1, sy?: number): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([sx, 0, 0, sy ?? sx, 0, 0]))
    }
    scaleSelf(sx = 1, sy?: number): this { return this.multiplySelf(new DOMMatrixPolyfill([sx, 0, 0, sy ?? sx, 0, 0])) }
    invertSelf(): this {
      const { a, b, c, d, e, f } = this
      const det = a * d - b * c
      if (!det || !Number.isFinite(det)) return this.#assign([NaN, NaN, NaN, NaN, NaN, NaN])
      return this.#assign([d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det])
    }
    inverse(): DOMMatrixPolyfill { return new DOMMatrixPolyfill(this).invertSelf() }
    transformPoint(p: { x?: number; y?: number } = {}): { x: number; y: number; z: number; w: number } {
      const x = p.x ?? 0
      const y = p.y ?? 0
      return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 }
    }
  }
  g.DOMMatrix = DOMMatrixPolyfill
}

/** extract text from a pdf using @firecrawl/pdf-inspector (with pdfjs fallback) */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  return pdfToMarkdown(bytes)
}

/** Convert PDF to structured Markdown using @firecrawl/pdf-inspector with pdfjs fallback */
export async function pdfToMarkdown(bytes: Uint8Array): Promise<string> {
  try {
    const buffer = Buffer.from(bytes)
    const result = processPdf(buffer)
    if (result && typeof result.markdown === 'string' && result.markdown.trim().length > 0) {
      return result.markdown.trim()
    }
  } catch (err) {
    console.warn('[file-parse] @firecrawl/pdf-inspector processPdf failed, falling back to pdfjs:', err)
  }

  return pdfjsToMarkdown(bytes)
}

async function pdfjsToMarkdown(bytes: Uint8Array): Promise<string> {
  installDomMatrixPolyfill()
  // @ts-expect-error the worker build artifact has no type declarations
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const fontUrl = standardFontDataUrl()
  const doc = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    ...(fontUrl ? { standardFontDataUrl: fontUrl } : {}),
    verbosity: 0,
  }).promise
  try {
    const pagesMarkdown: string[] = []
    
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()

      interface LineItem {
        text: string
        height: number
        x: number
        y: number
        hasEOL: boolean
      }

      const lineItems: LineItem[] = []
      const heights: number[] = []

      for (const item of content.items) {
        if ('str' in item && typeof item.str === 'string') {
          const str = item.str
          let h = item.height
          if (!h && str.trim().length > 0 && Array.isArray(item.transform) && item.transform[3]) {
            h = Math.abs(item.transform[3])
          }
          if (str.trim().length > 0 && h > 0) {
            heights.push(h)
          }
          lineItems.push({
            text: str,
            height: h || 10,
            x: Array.isArray(item.transform) ? (item.transform[4] ?? 0) : 0,
            y: Array.isArray(item.transform) ? (item.transform[5] ?? 0) : 0,
            hasEOL: Boolean(item.hasEOL),
          })
        }
      }

      if (lineItems.length === 0) continue

      heights.sort((a, b) => a - b)
      const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)]! : 10

      // Group items by y coordinate (bucketed by 3pt for layout tolerance)
      const lineMap = new Map<number, LineItem[]>()
      for (const item of lineItems) {
        if (!item.text.trim()) continue
        const bucketY = Math.round(item.y / 3) * 3
        if (!lineMap.has(bucketY)) lineMap.set(bucketY, [])
        lineMap.get(bucketY)!.push(item)
      }

      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a)
      const linesWithCells: Array<{ cells: string[]; maxH: number; y: number }> = []

      for (const y of sortedY) {
        const rawItems = lineMap.get(y)!.sort((a, b) => a.x - b.x)
        const cells: string[] = []
        let curCell = ''
        let lastXEnd = -1
        let maxH = 0

        for (const item of rawItems) {
          if (item.height > maxH) maxH = item.height
          if (lastXEnd >= 0 && item.x - lastXEnd > 18) {
            if (curCell.trim()) cells.push(curCell.trim())
            curCell = item.text.trim()
          } else {
            curCell = curCell ? `${curCell} ${item.text.trim()}` : item.text.trim()
          }
          lastXEnd = item.x + item.text.trim().length * (item.height * 0.5)
        }
        if (curCell.trim()) cells.push(curCell.trim())

        if (cells.length > 0) {
          linesWithCells.push({ cells, maxH, y })
        }
      }

      // Reconstruct Markdown tables vs Headings vs Paragraphs
      const formattedBlocks: string[] = []
      let tableBuffer: string[][] = []
      let paraLines: string[] = []
      let lastY: number | null = null
      let lastH = 10

      const flushPara = () => {
        if (paraLines.length > 0) {
          formattedBlocks.push(paraLines.join('\n'))
          paraLines = []
        }
      }

      const flushTable = () => {
        if (tableBuffer.length === 0) return
        if (tableBuffer.length >= 1) {
          const colCount = Math.max(...tableBuffer.map((r) => r.length))
          if (colCount >= 2) {
            for (const row of tableBuffer) {
              while (row.length < colCount) row.push('')
            }
            const headerRow = tableBuffer[0]!
            const headerLine = `| ${headerRow.join(' | ')} |`
            const dividerLine = `| ${Array(colCount).fill('---').join(' | ')} |`
            const bodyLines = tableBuffer.slice(1).map((r) => `| ${r.join(' | ')} |`)
            formattedBlocks.push([headerLine, dividerLine, ...bodyLines].join('\n'))
            tableBuffer = []
            return
          }
        }
        for (const row of tableBuffer) {
          paraLines.push(row.join(' '))
        }
        tableBuffer = []
      }

      for (const line of linesWithCells) {
        if (line.cells.length >= 2) {
          flushPara()
          tableBuffer.push(line.cells)
        } else if (tableBuffer.length > 0) {
          // Continuation line for first column cell of last table row
          const lastRow = tableBuffer[tableBuffer.length - 1]
          if (lastRow) {
            lastRow[0] = (lastRow[0] + ' ' + line.cells[0]).trim()
          }
        } else {
          flushTable()
          const text = line.cells[0]!
          const isHeading = line.maxH >= medianHeight * 1.25

          if (isHeading) {
            flushPara()
            if (line.maxH >= medianHeight * 1.4) {
              formattedBlocks.push(`# ${text}`)
            } else {
              formattedBlocks.push(`## ${text}`)
            }
            lastY = null
          } else {
            // Check vertical gap from last line in paragraph
            if (lastY !== null && Math.abs(lastY - line.y) > lastH * 1.8) {
              flushPara()
            }
            paraLines.push(text)
            lastY = line.y
            lastH = line.maxH
          }
        }
      }
      flushTable()
      flushPara()

      pagesMarkdown.push(formattedBlocks.join('\n\n'))
      page.cleanup()
    }

    return pagesMarkdown.join('\n\n')
  } finally {
    await doc.destroy()
  }
}
