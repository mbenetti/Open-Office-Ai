import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorExtensions } from '../src/renderer/editor/extensions'

describe('unfocused selection extension', () => {
  it('renders unfocused selection decoration when editor loses DOM focus', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: editorExtensions,
      content: {
        type: 'doc',
        content: [
          {
            type: 'docParagraph',
            content: [{ type: 'text', text: 'Hello world in Word document' }],
          },
        ],
      },
    })

    // Set selection across "Hello" (positions 1..6)
    editor.commands.setTextSelection({ from: 1, to: 6 })

    // When view is not focused, UnfocusedSelectionExtension generates decorations
    const decos = editor.view.someProp('decorations', (f) => f(editor.state))
    expect(decos).toBeDefined()

    // Verify decoration set contains our unfocused selection class
    const found = (decos as any)?.find?.(1, 6) ?? []
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]?.type?.attrs?.class).toBe('doc-selection-unfocused')
  })
})
