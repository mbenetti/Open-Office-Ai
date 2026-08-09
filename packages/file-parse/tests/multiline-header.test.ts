import { describe, expect, it } from 'vitest'
import { extractToc } from '../src/toc'
import { chunkMarkdownDocument } from '../src/markdown-chunker'

describe('multiline header merging', () => {
  it('merges multi-line consecutive headers of the same level in TOC extraction', () => {
    const text = `# What is new in State of Agentic AI Security and Governance\n# v2\n\nSome body text under the merged title.`
    const toc = extractToc(text)

    expect(toc).toHaveLength(1)
    expect(toc[0]!.title).toBe('What is new in State of Agentic AI Security and Governance v2')
  })

  it('merges multi-line consecutive headers of the same level in document chunking', () => {
    const text = `# What is new in State of Agentic AI Security and Governance\n# v2\n\nSome body text under the merged title.`
    const chunks = chunkMarkdownDocument(text)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.headerPath).toBe('# What is new in State of Agentic AI Security and Governance v2')
    expect(chunks[0]!.text).toContain('Some body text under the merged title.')
  })
})
