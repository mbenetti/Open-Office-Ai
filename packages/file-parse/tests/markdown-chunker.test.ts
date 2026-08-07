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
    expect(chunks).toHaveLength(2)

    expect(chunks[0]!.headerPath).toBe('# Chapter 1 > ## Section 1')
    expect(chunks[0]!.text).toBe(`# Chapter 1
## Section 1
Text for section 1.`)

    expect(chunks[1]!.headerPath).toBe('# Chapter 1 > ## Section 2')
    expect(chunks[1]!.text).toBe(`## Section 2
Text for section 2.`)

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
