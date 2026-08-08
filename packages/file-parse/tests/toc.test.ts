import { describe, expect, it } from 'vitest'
import { extractToc } from '../src/toc'

describe('extractToc', () => {
  it('extracts level 1 and level 2 headings with correct offsets', () => {
    const text = `# Introduction\nThis is intro.\n\n## Section 1\nContent 1.\n\n### Level 3 Heading\nIgnored.\n\n# Conclusion\nEnd.`
    const toc = extractToc(text)

    expect(toc).toEqual([
      { level: 1, title: 'Introduction', offset: 0 },
      { level: 2, title: 'Section 1', offset: 31 },
      { level: 1, title: 'Conclusion', offset: 86 },
    ])

    // Verify offset slicing
    const introSlice = text.slice(toc[0]!.offset)
    expect(introSlice.startsWith('# Introduction')).toBe(true)

    const sec1Slice = text.slice(toc[1]!.offset)
    expect(sec1Slice.startsWith('## Section 1')).toBe(true)

    const concSlice = text.slice(toc[2]!.offset)
    expect(concSlice.startsWith('# Conclusion')).toBe(true)
  })

  it('ignores headings inside code blocks and math blocks', () => {
    const text = `# Main Heading\n\n\`\`\`markdown\n# Fake Heading in Code\n## Another Fake Heading\n\`\`\`\n\n## Real Subsection\nText`
    const toc = extractToc(text)

    expect(toc).toEqual([
      { level: 1, title: 'Main Heading', offset: 0 },
      { level: 2, title: 'Real Subsection', offset: 80 },
    ])

    const subSlice = text.slice(toc[1]!.offset)
    expect(subSlice.startsWith('## Real Subsection')).toBe(true)
  })

  it('returns empty array when no level 1 or level 2 headings exist', () => {
    const text = 'Just some plain text without any markdown headings.'
    expect(extractToc(text)).toEqual([])
  })
})
