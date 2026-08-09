import { isInvalidPageHeaderTitle } from './page-header'

export interface TocItem {
  level: 1 | 2
  title: string
  offset: number
}

/**
 * Extracts Level 1 (#) and Level 2 (##) Table of Contents headings with their character offsets.
 * Ignores headings inside code blocks (``` or ~~~) and math blocks ($$).
 */
export function extractToc(text: string): TocItem[] {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const toc: TocItem[] = []
  let offset = 0
  let inCodeBlock = false
  let codeFence = ''
  let inMathBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    // Track code blocks
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

    // Track math blocks
    if (trimmed.startsWith('$$') && !inCodeBlock) {
      inMathBlock = !inMathBlock
    }

    if (!inCodeBlock && !inMathBlock) {
      const match = line.match(/^(#{1,2})\s+(.+)$/)
      if (match) {
        const level = match[1]!.length as 1 | 2
        const title = match[2]!.trim()
        if (!isInvalidPageHeaderTitle(title)) {
          const last = toc.length > 0 ? toc[toc.length - 1] : undefined
          let hasInterveningBodyText = false
          if (last) {
            const between = normalized.slice(last.offset, offset).split('\n').slice(1)
            for (const bLine of between) {
              const bTrim = bLine.trim()
              if (bTrim && !bTrim.startsWith('#')) {
                hasInterveningBodyText = true
                break
              }
            }
          }

          if (last && last.level === level && !hasInterveningBodyText) {
            last.title = `${last.title} ${title}`
          } else {
            toc.push({
              level,
              title,
              offset,
            })
          }
        }
      }
    }

    // Add line length + 1 for newline character
    offset += line.length + 1
  }

  return toc
}
