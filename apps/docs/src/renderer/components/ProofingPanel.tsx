import type { Editor } from '@tiptap/core'
import type { LanguageToolMatch } from '@genoffice/ai-provider'
import { useI18n } from '../i18n/locale'

export function ProofingPanel({
  editor,
  languageName,
  matches,
  baseOffset = 0,
  activeMatchIndex,
  onSelectMatchIndex,
  onIgnoreMatch,
  onApplyMatch,
  onClose,
}: {
  editor: Editor | null
  languageName?: string
  matches: LanguageToolMatch[]
  baseOffset?: number
  activeMatchIndex: number | null
  onSelectMatchIndex: (idx: number | null) => void
  onIgnoreMatch: (idx: number) => void
  onApplyMatch: (idx: number, replacement: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()

  const handleSelectMatch = (match: LanguageToolMatch, idx: number) => {
    onSelectMatchIndex(idx)
    if (!editor) return
    const badSnippet = match.context?.text?.slice(match.context.offset, match.context.offset + match.length) || ''
    try {
      const docText = editor.getText()
      const targetOffset = baseOffset + match.offset
      const foundIdx = badSnippet && docText.indexOf(badSnippet, Math.max(0, targetOffset - 20)) >= 0
        ? docText.indexOf(badSnippet, Math.max(0, targetOffset - 20))
        : badSnippet ? docText.indexOf(badSnippet) : -1

      if (foundIdx >= 0) {
        const from = foundIdx + 1
        const to = from + badSnippet.length
        editor.chain().focus().setTextSelection({ from, to }).run()
      }
    } catch (err) {
      console.warn('Failed to select match:', err)
    }
  }

  return (
    <aside className="comments-pane proofing-pane">
      <div className="comments-pane-head">
        <span className="comments-pane-title">
          ✨ Proofing ({languageName || 'LanguageTool'})
        </span>
        <button className="comments-pane-close" title={t('appClose')} onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)' }}>
        Found <strong>{matches.length}</strong> suggestion{matches.length === 1 ? '' : 's'}. Review each item below to apply or ignore.
      </div>

      <div className="comments-pane-list" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        {matches.length === 0 && (
          <div className="comments-empty" style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)' }}>
            ✓ No grammar or spelling errors found!
          </div>
        )}

        {matches.map((m, idx) => {
          const category = m.rule?.category?.name || 'Spelling / Grammar'
          const badWord = m.context?.text?.slice(m.context.offset, m.context.offset + m.length) || ''
          const isActive = activeMatchIndex === idx

          return (
            <div
              key={idx}
              onClick={() => handleSelectMatch(m, idx)}
              style={{
                background: isActive ? 'var(--active-bg, #e8f1fb)' : 'var(--surface)',
                border: isActive ? '1.5px solid var(--word-blue, #185abd)' : '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: 'var(--word-blue)' }}>
                <span>{category}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onIgnoreMatch(idx)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                  }}
                >
                  Ignore
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {m.message}
              </div>

              {badWord && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--hover, #f3f2f1)', padding: '6px 10px', borderRadius: 4, borderLeft: '3px solid #f2b900' }}>
                  Original: <span style={{ textDecoration: 'line-through', color: '#d9381e', fontWeight: 600 }}>{badWord}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                {m.replacements && m.replacements.length > 0 ? (
                  m.replacements.slice(0, 4).map((r, rIdx) => (
                    <button
                      key={rIdx}
                      type="button"
                      onClick={() => onApplyMatch(idx, r.value)}
                      style={{
                        background: 'var(--active-bg, #e8f1fb)',
                        color: 'var(--word-blue, #185abd)',
                        border: '1px solid var(--word-blue, #185abd)',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Change to "{r.value}"
                    </button>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>No automatic replacement suggested</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
