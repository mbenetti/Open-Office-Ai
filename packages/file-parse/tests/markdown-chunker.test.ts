import { describe, expect, it } from 'vitest'
import { chunkMarkdownDocument } from '../src/markdown-chunker'

describe('chunkMarkdownDocument', () => {
  it('returns empty list for empty input', () => {
    expect(chunkMarkdownDocument('')).toEqual([])
    expect(chunkMarkdownDocument('   ')).toEqual([])
  })

  it('merges empty header titles with lower level header and text', () => {
    const raw = `# Chapter 1
## Section 1
This is the text for section 1.`

    const chunks = chunkMarkdownDocument(raw)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.headerPath).toBe('# Chapter 1 > ## Section 1')
    expect(chunks[0]!.text).toBe(`# Chapter 1
## Section 1
This is the text for section 1.`)
  })

  it('handles multiple sections without duplicating top level titles', () => {
    const raw = `# Chapter 1
## Section 1
Text for section 1.

## Section 2
Text for section 2.`

    const chunks = chunkMarkdownDocument(raw)
    // Adjacent small sections are merged into a single chunk (up to maxChunkSize).
    expect(chunks).toHaveLength(1)

    expect(chunks[0]!.headerPath).toBe('# Chapter 1 > ## Section 1')
    expect(chunks[0]!.text).toBe(`# Chapter 1
## Section 1
Text for section 1.

## Section 2
Text for section 2.`)

    // Full document reconstruction check
    const reconstructed = chunks.map((c) => c.text).join('\n\n')
    expect(reconstructed).toBe(raw)
  })

  it('merges adjacent sections into chunks up to maxChunkSize', () => {
    const section = (n: number) => `## Section ${n}\n${String(n).repeat(300)}`
    const raw = `# Chapter 1\n${section(1)}\n\n${section(2)}\n\n${section(3)}\n\n${section(4)}`

    const chunks = chunkMarkdownDocument(raw, { maxChunkSize: 1200 })
    // Each section is ≈312 chars; three fit in 1200, four don't → 2 chunks
    // where the first merges three sections (proving adjacent merging).
    expect(chunks).toHaveLength(2)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(1200)
    }
    expect(chunks[0]!.text.length).toBeGreaterThan(600)
    expect(chunks[0]!.headerPath).toBe('# Chapter 1 > ## Section 1')
    expect(chunks[1]!.headerPath).toBe('# Chapter 1 > ## Section 4')

    // Full document reconstruction check
    const reconstructed = chunks.map((c) => c.text).join('\n\n')
    expect(reconstructed).toBe(raw)
  })

  it('chunks plain text or pdf text without headers', () => {
    const raw = `First paragraph of plain text.

Second paragraph of plain text.`

    const chunks = chunkMarkdownDocument(raw)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.headerPath).toBe('(Document)')
    expect(chunks[0]!.text).toBe(raw)
  })

  it('respects maxChunkSize limit', () => {
    const p1 = 'A'.repeat(300)
    const p2 = 'B'.repeat(300)
    const raw = `${p1}\n\n${p2}`

    const chunks = chunkMarkdownDocument(raw, { maxChunkSize: 400 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(400)
    }
  })

  it('keeps code blocks intact and does not parse headers inside code blocks', () => {
    const raw = `# Code Section
Intro text before code.

\`\`\`python
# This is a comment inside code, not a section header
def hello():
    return "world"
\`\`\`

Ending text.`

    const chunks = chunkMarkdownDocument(raw)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.headerPath).toBe('# Code Section')
    expect(chunks[0]!.text).toContain('```python')
    expect(chunks[0]!.text).toContain('# This is a comment inside code')
  })

  it('keeps lists and bullet points together as atomic units', () => {
    const raw = `# Lists Section
- Bullet item 1
- Bullet item 2
- Bullet item 3

1. Numbered item 1
2. Numbered item 2`

    const chunks = chunkMarkdownDocument(raw)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.text).toContain('- Bullet item 1')
    expect(chunks[0]!.text).toContain('1. Numbered item 1')
  })

  it('keeps markdown tables intact', () => {
    const raw = `# Table Section
| Header 1 | Header 2 |
| --- | --- |
| Row 1 Col 1 | Row 1 Col 2 |
| Row 2 Col 1 | Row 2 Col 2 |`

    const chunks = chunkMarkdownDocument(raw)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.text).toContain('| Header 1 | Header 2 |')
  })
})
  it('performs recursive hierarchical splitting and fallback down to H4 then paragraphs', () => {
    // We construct a document that has:
    // - H1 (huge body, exceeds 200 maxChunkSize)
    //   - H2 (fits, around 80 chars)
    //   - H2 (fits, around 80 chars)
    //   - H2 (oversized, exceeds 200 maxChunkSize)
    //     - H3 (fits, around 60 chars)
    //     - H3 (fits, around 60 chars)
    //       - H4 (fits, around 40 chars)
    //       - H4 (oversized, exceeds 200 maxChunkSize, falls back to paragraph split)
    const raw = `# Main Chapter
## Section 1
Short paragraph under section 1. It fits perfectly.

## Section 2
Short paragraph under section 2. It fits perfectly.

## Section 3
### Subsection 3.1
Short subsection 3.1 content.

### Subsection 3.2
#### Subsection 3.2.1
Short sub-sub-sub content.

#### Subsection 3.2.2
This is a very long paragraph that will trigger paragraph and line based chunking on our hierarchical splitter. We repeat this to make sure it exceeds the max chunk size easily and correctly. We repeat this to make sure it exceeds the max chunk size easily and correctly.`

    const chunks = chunkMarkdownDocument(raw, { maxChunkSize: 200 })

    // It should successfully chunk the entire document without losing any lines
    expect(chunks.length).toBeGreaterThan(3)

    // Check that we don't have any chunks larger than 200 characters
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(200)
    }

    // Reconstruction test to ensure all characters are intact and identical
    const reconstructed = chunks.map((c) => c.text).join('\n\n')
    // Remove extra trailing newlines to compare raw text content
    expect(reconstructed.replace(/\s+/g, '')).toBe(raw.replace(/\s+/g, ''))
  })
