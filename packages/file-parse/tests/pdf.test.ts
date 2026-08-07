import { describe, expect, it } from 'vitest'
import { parseFileToText } from '../src/index'
import { buildPdfFixture, buildPdfFixtureWithStream, writeFixture } from './helpers/fixtures'

describe('parseFileToText: pdf', () => {
  it('extracts page text via pdfjs', async () => {
    const path = writeFixture('doc.pdf', buildPdfFixture('Hello PDF parsing'))
    const result = await parseFileToText(path)
    expect(result.ok).toBe(true)
    expect(result.kind).toBe('text')
    expect(result.text).toContain('Hello PDF parsing')
  })

  it('keeps soft-wrapped lines in one paragraph and only breaks on real vertical gaps', async () => {
    // font 24 lines 20pt apart = soft wraps (same paragraph); 80pt gap = paragraph
    // break; a 36pt line is detected as a heading.
    const stream = [
      'BT /F1 24 Tf 72 720 Td (First line of paragraph one) Tj ET',
      'BT /F1 24 Tf 72 700 Td (Second line of paragraph one) Tj ET',
      'BT /F1 24 Tf 72 680 Td (Third line of paragraph one) Tj ET',
      'BT /F1 24 Tf 72 600 Td (Second paragraph starts here) Tj ET',
      'BT /F1 36 Tf 72 540 Td (The Big Title) Tj ET',
      'BT /F1 24 Tf 72 500 Td (Body after title) Tj ET',
    ].join('\n')
    const path = writeFixture('paragraphs.pdf', buildPdfFixtureWithStream(stream))
    const result = await parseFileToText(path)
    expect(result.ok).toBe(true)
    const text = result.text!
    // soft-wrapped lines stay on one paragraph (single newlines, no blank lines)
    expect(text).toContain(
      'First line of paragraph one\nSecond line of paragraph one\nThird line of paragraph one',
    )
    // real vertical gap becomes a blank line between paragraphs
    expect(text).toContain('Third line of paragraph one\n\nSecond paragraph starts here')
    // larger font line is a heading, followed by a blank line before the body
    expect(text).toContain('# The Big Title\n\nBody after title')
  })

  it('fails gracefully on a corrupt pdf', async () => {
    const path = writeFixture('broken.pdf', Buffer.from('%PDF-1.4 garbage'))
    const result = await parseFileToText(path)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
