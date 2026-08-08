import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorExtensions } from '../src/renderer/editor/extensions'

describe('pasted font cleanup', () => {
  it('strips foreign font-family and font-size from pasted HTML spans', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: editorExtensions,
      content: {
        type: 'doc',
        content: [{ type: 'docParagraph' }],
      },
    })

    // Simulate pasting foreign HTML with inline font-family: Arial; font-size: 18pt
    const foreignHtml = `<span style="font-family: Arial, sans-serif; font-size: 18pt; font-weight: bold; color: #ff0000">Pasted Content</span>`

    // Insert content using Tiptap's HTML parser
    editor.commands.insertContent(foreignHtml)

    const json = editor.getJSON()
    const para = json.content?.[0]
    expect(para).toBeDefined()

    const textNode = para?.content?.[0] as
      | { text?: string; marks?: Array<{ type: string; attrs?: Record<string, any> }> }
      | undefined
    expect(textNode).toBeDefined()
    expect(textNode?.text).toBe('Pasted Content')

    // Find docTextStyle mark if present
    const styleMark = textNode?.marks?.find((m: { type: string }) => m.type === 'docTextStyle')

    // Foreign font family and font size should NOT be present on the mark
    if (styleMark) {
      expect(styleMark.attrs?.font).toBeNull()
      expect(styleMark.attrs?.sizeHalfPoints).toBeNull()
      // Other styles like color are preserved
      expect(styleMark.attrs?.color).toBe('FF0000')
    }

    // Bold mark is preserved
    const boldMark = textNode?.marks?.find((m: { type: string }) => m.type === 'bold')
    expect(boldMark).toBeDefined()
  })
})
