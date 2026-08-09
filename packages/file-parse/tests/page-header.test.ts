import { describe, expect, it } from 'vitest'
import { isInvalidPageHeaderTitle } from '../src/page-header'
import { extractToc } from '../src/toc'
import { chunkMarkdownDocument } from '../src/markdown-chunker'

describe('isInvalidPageHeaderTitle', () => {
  it('flags page numbers and page indicators as invalid header titles', () => {
    // Invalid titles (should return true)
    expect(isInvalidPageHeaderTitle('59')).toBe(true)
    expect(isInvalidPageHeaderTitle('Page 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('page 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('PAGE 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('pg. 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('pg 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('pag. 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('pag 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('pág. 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('p. 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('p 59')).toBe(true)
    expect(isInvalidPageHeaderTitle('Page IV')).toBe(true)
    expect(isInvalidPageHeaderTitle('pg. iii')).toBe(true)

    // Valid titles (should return false)
    expect(isInvalidPageHeaderTitle('Page 59: Executive Summary')).toBe(false)
    expect(isInvalidPageHeaderTitle('Page Layout and Styling')).toBe(false)
    expect(isInvalidPageHeaderTitle('Emerging Threat Vectors')).toBe(false)
    expect(isInvalidPageHeaderTitle('Chapter 1 Overview')).toBe(false)
  })

  it('filters out invalid page headers from TOC extraction', () => {
    const text = `# Page 59\n\n# Real Executive Summary\nSummary content.\n\n## pg. 60\n\n## Financial Highlights\nFinancial content.`
    const toc = extractToc(text)

    expect(toc).toHaveLength(2)
    expect(toc[0]!.title).toBe('Real Executive Summary')
    expect(toc[1]!.title).toBe('Financial Highlights')
  })

  it('filters out invalid page headers from document chunking', () => {
    const text = `# Page 1\n\nSome body text on page 1.\n\n# Main Overview\n\nOverview content.`
    const chunks = chunkMarkdownDocument(text)

    expect(chunks.some((c) => c.headerPath.includes('Page 1'))).toBe(false)
    expect(chunks.some((c) => c.headerPath.includes('Main Overview'))).toBe(true)
  })
})
