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
 * Hierarchical recursive markdown chunking strategy:
 * - Attempts to split down the level hierarchy: # (H1), ## (H2), ### (H3), #### (H4).
 * - Sibling headers or nested content are grouped together up to `maxChunkSize` (default 4000).
 * - If a section block is under maxChunkSize, we leave it. If not, we try to split by the current level (starting at level 1, then level 2, then level 3, then level 4).
 * - If a section block is still over maxChunkSize even at H4 (or has no further headers), it splits by paragraphs (\n\n) then lines (\n).
 * - Sibling headers are grouped back-to-back if they fit together without exceeding maxChunkSize.
 * - Empty titles (titles without body text) are merged with lower-level titles until text is present under the title.
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

  // 1. Initial parsing of the document into "Section Blocks"
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

  // If there were only headers and no body text at all in the document
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

  // Helper to calculate the size of a block taking into account printed headers
  const getBlockText = (b: SectionBlock, printed: Set<string>): { text: string; prefix: string; body: string } => {
    const unprinted = b.headers.filter((h) => !printed.has(h.rawLine))
    const prefix = unprinted.map((h) => h.rawLine).join('\n')
    const body = b.lines.join('\n').trim()
    const text = prefix ? (body ? `${prefix}\n${body}` : prefix) : body
    return { text, prefix, body }
  };

  // Sibling hierarchy splitting function
  function splitRecursive(blocksToSplit: SectionBlock[], currentLevel: number): void {
    if (blocksToSplit.length === 0) return

    // 1. Calculate the total size of this entire blocksToSplit set
    let totalLen = 0
    const testPrinted = new Set<string>(printedHeaders)
    for (const b of blocksToSplit) {
      const { text } = getBlockText(b, testPrinted)
      totalLen += text.length + (totalLen > 0 ? 2 : 0)
      for (const h of b.headers) {
        testPrinted.add(h.rawLine)
      }
    }

    if (totalLen <= maxChunkSize) {
      // Entire group fits perfectly in maxChunkSize! Merge and commit.
      const groupTextParts: string[] = []
      const path = formatPath(blocksToSplit[0]!.headers)
      for (const b of blocksToSplit) {
        const { text } = getBlockText(b, printedHeaders)
        groupTextParts.push(text)
        for (const h of b.headers) {
          printedHeaders.add(h.rawLine)
        }
      }
      pushChunk(groupTextParts.join('\n\n'), path)
      return
    }

    // 2. Group adjacent blocks by their header at currentLevel
    const subGroups: SectionBlock[][] = []
    let currentSubGroup: SectionBlock[] = []
    let lastHeaderRaw: string | null = null

    for (const b of blocksToSplit) {
      // Find header at this level
      let hRaw: string | null = null
      for (const header of b.headers) {
        if (header.level === currentLevel) {
          hRaw = header.rawLine
          break
        }
      }

      if (hRaw !== null && hRaw !== lastHeaderRaw) {
        if (currentSubGroup.length > 0) {
          subGroups.push(currentSubGroup)
        }
        currentSubGroup = [b]
        lastHeaderRaw = hRaw
      } else {
        currentSubGroup.push(b)
      }
    }
    if (currentSubGroup.length > 0) {
      subGroups.push(currentSubGroup)
    }

    // 3. Progressive fallbacks if everything grouped into a single subgroup
    if (subGroups.length === 1) {
      // If we have a single block and it still exceeds the limit
      if (blocksToSplit.length === 1) {
        const singleBlock = blocksToSplit[0]!
        const path = formatPath(singleBlock.headers)

        if (currentLevel < 4) {
          // Find if this single block has sub-headers inside its lines of level > currentLevel
          const lines = singleBlock.lines
          const subBlocks: SectionBlock[] = []
          let activeHeadersSub = [...singleBlock.headers]
          let currentLinesSub: string[] = []
          let inCodeBlockSub = false
          let codeFenceSub = ''
          let inMathBlockSub = false

          const flushSub = () => {
            if (currentLinesSub.length > 0 || activeHeadersSub.length > singleBlock.headers.length) {
              if (currentLinesSub.some((l) => l.trim().length > 0)) {
                subBlocks.push({
                  headers: [...activeHeadersSub],
                  lines: [...currentLinesSub],
                })
              }
              currentLinesSub = []
            }
          }

          for (const line of lines) {
            const trimmed = line.trim()

            const codeMatch = trimmed.match(/^(`{3,}|~{3,})/)
            if (codeMatch && !inMathBlockSub) {
              const fence = codeMatch[1]!
              if (!inCodeBlockSub) {
                inCodeBlockSub = true
                codeFenceSub = fence
              } else if (trimmed.startsWith(codeFenceSub)) {
                inCodeBlockSub = false
                codeFenceSub = ''
              }
            }

            if (trimmed.startsWith('$$') && !inCodeBlockSub) {
              inMathBlockSub = !inMathBlockSub
            }

            const match = !inCodeBlockSub && !inMathBlockSub ? line.match(/^(#{1,6})\s+(.+)$/) : null
            if (match) {
              const lvl = match[1]!.length
              const title = match[2]!.trim()
              if (!isInvalidPageHeaderTitle(title) && lvl > singleBlock.headers.length) {
                flushSub()
                const node: HeaderNode = { level: lvl, title, rawLine: line }
                while (activeHeadersSub.length > singleBlock.headers.length && activeHeadersSub.at(-1)!.level >= lvl) {
                  activeHeadersSub.pop()
                }
                activeHeadersSub.push(node)
                continue
              }
            }
            currentLinesSub.push(line)
          }
          flushSub()

          if (subBlocks.length > 1) {
            // Recurse into the sub-blocks we just extracted
            splitRecursive(subBlocks, currentLevel + 1)
            return
          }
        }

        // Base Case: H4 reached or no sub-headers found. Split by paragraph and lines protecting atomic units.
        const { text } = getBlockText(singleBlock, printedHeaders)
        for (const h of singleBlock.headers) {
          printedHeaders.add(h.rawLine)
        }

        const units = parseAtomicUnits(text)
        let unitText = ''

        for (const unit of units) {
          const candidate = unitText ? `${unitText}\n\n${unit}` : unit
          if (candidate.length <= maxChunkSize) {
            unitText = candidate
          } else {
            if (unitText) {
              pushChunk(unitText, path)
              unitText = ''
            }

            if (unit.length > maxChunkSize) {
              if (unit.startsWith('```') || unit.startsWith('~~~')) {
                splitOversizedCodeBlock(unit, maxChunkSize, path, pushChunk)
              } else {
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
              unitText = unit
            }
          }
        }
        if (unitText) {
          pushChunk(unitText, path)
        }
      } else {
        // If all blocks share the same header at currentLevel, we progress currentLevel down
        if (currentLevel < 4) {
          splitRecursive(blocksToSplit, currentLevel + 1)
        } else {
          // We reached H4, but still have multiple blocks under the same H4.
          // Process each block individually.
          for (const b of blocksToSplit) {
            splitRecursive([b], currentLevel)
          }
        }
      }
      return
    }

    // 4. Pack sub-groups sequentially into packed sibling groups of size <= maxChunkSize
    const packedSiblingGroups: SectionBlock[][] = []
    let currentSiblingGroup: SectionBlock[] = []
    let currentSiblingSize = 0
    const siblingPrinted = new Set<string>(printedHeaders)

    for (const sg of subGroups) {
      // Calculate total size of this sibling group
      let sgSize = 0
      for (const b of sg) {
        const { text } = getBlockText(b, siblingPrinted)
        sgSize += text.length + (sgSize > 0 ? 2 : 0)
        for (const h of b.headers) {
          siblingPrinted.add(h.rawLine)
        }
      }

      if (sgSize > maxChunkSize) {
        if (currentSiblingGroup.length > 0) {
          packedSiblingGroups.push(currentSiblingGroup)
          currentSiblingGroup = []
          currentSiblingSize = 0
        }
        packedSiblingGroups.push(sg)
      } else {
        const candSize = currentSiblingSize + (currentSiblingSize > 0 ? 2 : 0) + sgSize
        if (candSize <= maxChunkSize) {
          currentSiblingGroup.push(...sg)
          currentSiblingSize = candSize
        } else {
          if (currentSiblingGroup.length > 0) {
            packedSiblingGroups.push(currentSiblingGroup)
          }
          currentSiblingGroup = [...sg]
          currentSiblingSize = sgSize
        }
      }
    }
    if (currentSiblingGroup.length > 0) {
      packedSiblingGroups.push(currentSiblingGroup)
    }

    // 5. Recursively split or commit each packed sibling group
    for (const psg of packedSiblingGroups) {
      // We check if psg fits in a single chunk with the latest printedHeaders
      let psgSize = 0
      const psgTestPrinted = new Set<string>(printedHeaders)
      for (const b of psg) {
        const { text } = getBlockText(b, psgTestPrinted)
        psgSize += text.length + (psgSize > 0 ? 2 : 0)
        for (const h of b.headers) {
          psgTestPrinted.add(h.rawLine)
        }
      }

      if (psgSize > maxChunkSize) {
        // This single packed subgroup exceeds maxChunkSize. Step down to currentLevel + 1!
        splitRecursive(psg, currentLevel + 1)
      } else {
        // Fits perfectly in maxChunkSize! Merge and commit.
        const groupTextParts: string[] = []
        const path = formatPath(psg[0]!.headers)
        for (const b of psg) {
          const { text } = getBlockText(b, printedHeaders)
          groupTextParts.push(text)
          for (const h of b.headers) {
            printedHeaders.add(h.rawLine)
          }
        }
        pushChunk(groupTextParts.join('\n\n'), path)
      }
    }
  }

  // Kick off splitting at level 1 (H1)
  splitRecursive(blocks, 1)

  return chunks
}
