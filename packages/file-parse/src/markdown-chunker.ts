import { isInvalidPageHeaderTitle } from './page-header'

export interface DocumentChunk {
  chunkIndex: number
  headerPath: string
  text: string
  charCount: number
}

export interface ChunkingOptions {
  maxChunkSize?: number // default 4000
}

interface HeaderNode {
  level: number
  title: string
  rawLine: string
}

interface SectionBlock {
  headers: HeaderNode[]
  lines: string[]
}

/**
 * Splits body text into atomic structural units:
 * - Code blocks (``` ... ```)
 * - Math formula blocks ($$ ... $$)
 * - Markdown tables (| ... |)
 * - Lists / bullet points (- item, * item, 1. item)
 * - Blockquotes (> ...)
 * - Normal paragraphs
 */
function parseAtomicUnits(text: string): string[] {
  const lines = text.split('\n')
  const units: string[] = []
  let currentUnitLines: string[] = []
  let inCodeBlock = false
  let codeFence = ''
  let inMathBlock = false

  const flushUnit = () => {
    if (currentUnitLines.length > 0) {
      const u = currentUnitLines.join('\n').trim()
      if (u) units.push(u)
      currentUnitLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    // 1. Code block fence check (``` or ~~~)
    const codeMatch = trimmed.match(/^(`{3,}|~{3,})/)
    if (codeMatch && !inMathBlock) {
      const fence = codeMatch[1]!
      if (!inCodeBlock) {
        flushUnit()
        inCodeBlock = true
        codeFence = fence
        currentUnitLines.push(line)
        continue
      } else if (trimmed.startsWith(codeFence)) {
        currentUnitLines.push(line)
        inCodeBlock = false
        codeFence = ''
        flushUnit()
        continue
      }
    }

    if (inCodeBlock) {
      currentUnitLines.push(line)
      continue
    }

    // 2. Math formula block check ($$)
    if (trimmed.startsWith('$$')) {
      if (!inMathBlock) {
        if (trimmed.endsWith('$$') && trimmed.length > 2) {
          flushUnit()
          units.push(line)
          continue
        }
        flushUnit()
        inMathBlock = true
        currentUnitLines.push(line)
        continue
      } else {
        currentUnitLines.push(line)
        inMathBlock = false
        flushUnit()
        continue
      }
    }

    if (inMathBlock) {
      currentUnitLines.push(line)
      continue
    }

    // 3. Table line check (| ... |)
    const isTableLine = (trimmed.startsWith('|') && trimmed.endsWith('|')) || trimmed.startsWith('<table')
    const prevIsTable = currentUnitLines.length > 0 && (currentUnitLines[0]!.trim().startsWith('|') || currentUnitLines[0]!.trim().startsWith('<table'))
    if (isTableLine) {
      if (!prevIsTable) {
        flushUnit()
      }
      currentUnitLines.push(line)
      continue
    } else if (prevIsTable) {
      flushUnit()
    }

    // 4. List item check (- , * , + , 1. , 2. )
    const isListLine = /^(?:[-*+]\s+|\d+\.\s+)/.test(trimmed)
    const prevIsList =
      currentUnitLines.length > 0 &&
      /^(?:[-*+]\s+|\d+\.\s+)/.test(currentUnitLines[0]!.trim())
    if (isListLine) {
      if (!prevIsList) {
        flushUnit()
      }
      currentUnitLines.push(line)
      continue
    } else if (prevIsList) {
      if (/^\s+/.test(line) && trimmed.length > 0) {
        currentUnitLines.push(line)
        continue
      } else {
        flushUnit()
      }
    }

    // 5. Blank lines separate normal paragraphs
    if (trimmed === '') {
      flushUnit()
    } else {
      currentUnitLines.push(line)
    }
  }

  flushUnit()
  return units
}

/**
 * Safely splits an oversized code block across chunk boundaries while preserving valid fences
 */
function splitOversizedCodeBlock(
  codeBlockText: string,
  maxChunkSize: number,
  path: string,
  pushChunk: (text: string, path: string) => void,
) {
  const lines = codeBlockText.split('\n')
  const fence = lines[0]?.match(/^(`{3,}|~{3,})/)?.[1] ?? '```'
  const codeLines = lines.slice(1, lines.at(-1)?.startsWith(fence) ? -1 : undefined)

  let curLines: string[] = []
  let curLen = fence.length * 2 + 2

  for (const line of codeLines) {
    if (curLen + line.length + 1 <= maxChunkSize) {
      curLines.push(line)
      curLen += line.length + 1
    } else {
      if (curLines.length > 0) {
        pushChunk(`${fence}\n${curLines.join('\n')}\n${fence}`, path)
        curLines = []
      }
      if (line.length > maxChunkSize - fence.length * 2 - 10) {
        for (let i = 0; i < line.length; i += maxChunkSize - fence.length * 2 - 10) {
          const slice = line.slice(i, i + maxChunkSize - fence.length * 2 - 10)
          pushChunk(`${fence}\n${slice}\n${fence}`, path)
        }
        curLen = fence.length * 2 + 2
      } else {
        curLines.push(line)
        curLen = fence.length * 2 + 2 + line.length
      }
    }
  }
  if (curLines.length > 0) {
    pushChunk(`${fence}\n${curLines.join('\n')}\n${fence}`, path)
  }
}

/**
 * Hierarchical markdown chunking strategy:
 * - Starts from top header `#`, `##`, `###`, etc.
 * - Keeps entire sections up to `maxChunkSize` (default 2000 chars).
 * - Merges empty titles (titles without body text) with lower-level titles until text is present under the title.
 * - Never breaks mid code-block, math formula ($$), table, list item, or blockquote unless an individual unit exceeds maxChunkSize.
 * - Concatenating all chunks' text creates a complete, duplicate-free copy of the original document.
 */
export function chunkMarkdownDocument(
  rawText: string,
  options: ChunkingOptions = {},
): DocumentChunk[] {
  const maxChunkSize = options.maxChunkSize ?? 4000
  const normalized = rawText.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: SectionBlock[] = []
  const activeHeaders: HeaderNode[] = []
  let currentLines: string[] = []
  let inCodeBlock = false
  let codeFence = ''
  let inMathBlock = false

  const flush = () => {
    if (currentLines.length > 0 || activeHeaders.length > 0) {
      if (currentLines.some((l) => l.trim().length > 0)) {
        blocks.push({
          headers: [...activeHeaders],
          lines: [...currentLines],
        })
      }
      currentLines = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Track code blocks and math blocks to ignore header syntax inside literal code/formulas
    const codeMatch = trimmed.match(/^(`{3,}|~{3,})/)
    if (codeMatch && !inMathBlock) {
      const fence = codeMatch[1]!
      if (!inCodeBlock) {
        inCodeBlock = true
        codeFence = fence
      } else if (trimmed.startsWith(codeFence)) {
        inCodeBlock = false
        codeFence = ''
      }
    }

    if (trimmed.startsWith('$$') && !inCodeBlock) {
      inMathBlock = !inMathBlock
    }

    const match = !inCodeBlock && !inMathBlock ? line.match(/^(#{1,6})\s+(.+)$/) : null
    if (match) {
      const level = match[1]!.length
      const title = match[2]!.trim()
      if (!isInvalidPageHeaderTitle(title)) {
        const lastHeader = activeHeaders.length > 0 ? activeHeaders.at(-1) : undefined
        const noBodyTextYet = blocks.length === 0 || blocks.at(-1)?.headers.at(-1) !== lastHeader

        if (lastHeader && lastHeader.level === level && noBodyTextYet && currentLines.length === 0) {
          lastHeader.title = `${lastHeader.title} ${title}`
          lastHeader.rawLine = `${lastHeader.rawLine}\n${line}`
          continue
        }

        flush()
        const node: HeaderNode = { level, title, rawLine: line }

        while (activeHeaders.length > 0 && activeHeaders.at(-1)!.level >= level) {
          activeHeaders.pop()
        }
        activeHeaders.push(node)
        continue
      }
    }
    currentLines.push(line)
  }
  flush()

  // If there were only headers and no body text at all in the whole document
  if (blocks.length === 0 && activeHeaders.length > 0) {
    const fullText = activeHeaders.map((h) => h.rawLine).join('\n')
    const headerPath = activeHeaders.map((h) => `${'#'.repeat(h.level)} ${h.title}`).join(' > ')
    return [{ chunkIndex: 0, headerPath, text: fullText, charCount: fullText.length }]
  }

  const chunks: DocumentChunk[] = []
  const printedHeaders = new Set<string>()

  const formatPath = (headers: HeaderNode[]): string => {
    if (headers.length === 0) return '(Document)'
    return headers.map((h) => `${'#'.repeat(h.level)} ${h.title}`).join(' > ')
  }

  const pushChunk = (text: string, path: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    chunks.push({
      chunkIndex: chunks.length,
      headerPath: path,
      text: trimmed,
      charCount: trimmed.length,
    })
  }

  for (const block of blocks) {
    const path = formatPath(block.headers)

    // Collect headers that need to be prepended (unprinted ones)
    const unprinted = block.headers.filter((h) => !printedHeaders.has(h.rawLine))
    const headerPrefix = unprinted.map((h) => h.rawLine).join('\n')

    const bodyText = block.lines.join('\n').trim()
    const fullBlockText = headerPrefix
      ? bodyText
        ? `${headerPrefix}\n${bodyText}`
        : headerPrefix
      : bodyText

    // Mark these headers as printed so they aren't duplicated in future sections
    for (const h of block.headers) {
      printedHeaders.add(h.rawLine)
    }

    if (fullBlockText.length <= maxChunkSize) {
      pushChunk(fullBlockText, path)
    } else {
      // Parse section body into protected atomic units
      const units = parseAtomicUnits(fullBlockText)
      let curText = ''

      for (const unit of units) {
        const candidate = curText ? `${curText}\n\n${unit}` : unit
        if (candidate.length <= maxChunkSize) {
          curText = candidate
        } else {
          if (curText) {
            pushChunk(curText, path)
            curText = ''
          }

          if (unit.length > maxChunkSize) {
            if (unit.startsWith('```') || unit.startsWith('~~~')) {
              splitOversizedCodeBlock(unit, maxChunkSize, path, pushChunk)
            } else {
              // Split list items or text lines cleanly
              const lines = unit.split('\n')
              let subText = ''
              for (const l of lines) {
                const subCand = subText ? `${subText}\n${l}` : l
                if (subCand.length <= maxChunkSize) {
                  subText = subCand
                } else {
                  if (subText) pushChunk(subText, path)
                  if (l.length > maxChunkSize) {
                    for (let i = 0; i < l.length; i += maxChunkSize) {
                      pushChunk(l.slice(i, i + maxChunkSize), path)
                    }
                    subText = ''
                  } else {
                    subText = l
                  }
                }
              }
              if (subText) pushChunk(subText, path)
            }
          } else {
            curText = unit
          }
        }
      }
      if (curText) {
        pushChunk(curText, path)
      }
    }
  }

  return chunks
}
