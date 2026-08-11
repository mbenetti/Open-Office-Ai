import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/**
 * @firecrawl/pdf-inspector is a napi-rs native module: its JS loader requires a
 * platform-specific .node binary at import time and throws when that binary is
 * missing (e.g. a packaged build without asarUnpack or without the matching
 * platform optional dependency). Load it lazily so a missing binary degrades to
 * the pdfjs fallback with a clear log instead of breaking the whole module (and
 * with it every PDF parse in the app).
 */
interface PdfInspectorResult {
  markdown?: string | null
  pdfType?: string
}
interface PdfInspectorModule {
  processPdf(buffer: Buffer): PdfInspectorResult
}
let pdfInspectorModulePromise: Promise<PdfInspectorModule | undefined> | undefined
function loadPdfInspector(): Promise<PdfInspectorModule | undefined> {
  if (!pdfInspectorModulePromise) {
    // Dynamic import (not a static import): rollup still bundles the module and
    // its .node asset, but the napi loader's module-init throw (missing binary)
    // surfaces here as a rejected promise we can catch — a static import would
    // crash the whole app at startup instead of degrading to the pdfjs fallback.
    pdfInspectorModulePromise = import('@firecrawl/pdf-inspector')
      .then((mod) => {
        const m = mod as PdfInspectorModule & { default?: PdfInspectorModule }
        // CJS packages imported through the ESM loader may surface named exports
        // either directly on the namespace or under `default`.
        if (typeof m.processPdf !== 'function' && typeof m.default?.processPdf === 'function') {
          return m.default
        }
        return m
      })
      .catch((err) => {
        console.warn(
          '[file-parse] @firecrawl/pdf-inspector native binding unavailable; PDF parsing will fall back to pdfjs (Markdown tables will NOT be produced):',
          err,
        )
        return undefined
      })
  }
  return pdfInspectorModulePromise
}

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
  const mod = await loadPdfInspector()
  if (mod?.processPdf) {
    try {
      const buffer = Buffer.from(bytes)
      const result = mod.processPdf(buffer)
      if (result && typeof result.markdown === 'string' && result.markdown.trim().length > 0) {
        return result.markdown.trim()
      }
    } catch (err) {
      console.warn('[file-parse] @firecrawl/pdf-inspector processPdf failed, falling back to pdfjs:', err)
    }
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
            y: Array.isArray(item.transform) ? (item.transform[5] ?? 0) : 0,
            hasEOL: Boolean(item.hasEOL),
          })
        }
      }

      if (lineItems.length === 0) continue

      heights.sort((a, b) => a - b)
      const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)]! : 10

      const pageLines: { text: string; maxH: number; y: number }[] = []
      let curText = ''
      let curMaxH = 0
      let curY = 0

      for (const item of lineItems) {
        if (!curText) curY = item.y
        curText += item.text
        if (item.height > curMaxH) curMaxH = item.height
        if (item.hasEOL || curText.endsWith('\n')) {
          const trimmed = curText.trim()
          if (trimmed) {
            pageLines.push({ text: trimmed, maxH: curMaxH, y: curY })
          }
          curText = ''
          curMaxH = 0
        }
      }
      if (curText.trim()) {
        pageLines.push({ text: curText.trim(), maxH: curMaxH, y: curY })
      }

      const formattedLines: string[] = []
      for (let j = 0; j < pageLines.length; j++) {
        const l = pageLines[j]!
        if (l.maxH >= medianHeight * 1.4) {
          formattedLines.push(`# ${l.text}`)
        } else if (l.maxH >= medianHeight * 1.25) {
          formattedLines.push(`## ${l.text}`)
        } else {
          formattedLines.push(l.text)
        }
      }

      pagesMarkdown.push(formattedLines.join('\n\n'))
      page.cleanup()
    }

    return pagesMarkdown.join('\n\n')
  } finally {
    await doc.destroy()
  }
}
