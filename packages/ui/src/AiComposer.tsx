import React, { useEffect, useMemo, useRef, useState } from 'react'
import { IconEnter, IconSend, IconStop } from './icons'

// Keep in sync with the CSS `max-height` on `.ai-input-box textarea` (7 lines à 21px)
const MAX_TEXTAREA_HEIGHT = 147

/**
 * The AI panel input box shared by docs and sheets: auto-growing textarea
 * (Enter sends, Shift+Enter newline, Esc stops) plus a footer with optional
 * app-specific controls, a shortcut hint, and the send/stop button.
 * Renders the `.ai-input-box` class family; each app themes it in its own CSS.
 */
export function AiComposer({
  value,
  busy,
  placeholder,
  hintIdle,
  hintBusy,
  hintIdleTitle,
  sendLabel,
  stopLabel,
  ariaLabel,
  footerStart,
  iconOnly = false,
  sendIconEnabled,
  sendIconDisabled,
  stopIcon,
  textareaRef,
  onChange,
  onSend,
  onStop,
  onPasteFiles,
  skills,
}: {
  readonly value: string
  readonly busy: boolean
  readonly placeholder: string
  readonly hintIdle: string
  readonly hintBusy: string
  readonly hintIdleTitle?: string | undefined
  readonly sendLabel: string
  readonly stopLabel: string
  readonly ariaLabel?: string | undefined
  /** extra controls at the left of the footer (attach button, toggles, …) */
  readonly footerStart?: React.ReactNode
  /** compact variant: no hint text, icon-only enter/stop button (Genspark composer style) */
  readonly iconOnly?: boolean | undefined
  /** custom art for the icon-only send button (e.g. brand-supplied PNGs); falls back to IconEnter */
  readonly sendIconEnabled?: React.ReactNode
  readonly sendIconDisabled?: React.ReactNode
  /** custom art for the icon-only stop button while busy; falls back to IconStop */
  readonly stopIcon?: React.ReactNode
  /** pass a ref to focus the textarea from outside */
  readonly textareaRef?: React.RefObject<HTMLTextAreaElement | null> | undefined
  readonly onChange: (next: string) => void
  readonly onSend: () => void
  readonly onStop: () => void
  /** clipboard files pasted into the textarea (screenshots, copied files); text paste stays native */
  readonly onPasteFiles?: ((files: File[]) => void) | undefined
  /** saved slash-command skills: shows a picker while the draft starts with "/" */
  readonly skills?: ReadonlyArray<{ id: string; name: string; description: string }> | undefined
}): React.JSX.Element {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = textareaRef ?? innerRef
  const canSend = value.trim().length > 0 && !busy

  /** highlighted slash-command entry (0-based) and whether the menu was dismissed with Esc */
  const [skillHighlight, setSkillHighlight] = useState(0)
  const [skillMenuDismissed, setSkillMenuDismissed] = useState(false)

  // Slash-command autocomplete: the token is only the first word after "/", so
  // typing "/R" (or "/R ...") keeps filtering until the exact skill name is left.
  const skillToken =
    !skills || busy || !value.trim().startsWith('/')
      ? null
      : value.trim().slice(1).split(/\s+/)[0]!.toLowerCase()
  const skillMatches = useMemo(() => {
    if (skillToken === null) return []
    const all = skills ?? []
    if (skillToken === '') return all.slice(0, 6)
    return all.filter((s) => s.name.toLowerCase().startsWith(skillToken)).slice(0, 6)
  }, [skills, skillToken])

  useEffect(() => {
    setSkillHighlight(0)
  }, [skillToken, skillMatches.length])

  const skillMenuOpen = skillMatches.length > 0 && !skillMenuDismissed
  const highlightedSkill = skillMatches[skillHighlight] ?? skillMatches[0]

  const completeSkill = (s: { id: string; name: string; description: string }) => {
    onChange(`/${s.name} `)
    setSkillMenuDismissed(true)
    ref.current?.focus()
  }

  // auto-grow up to ~6 lines; empty clears the inline height outright so the
  // CSS min-height governs (a hidden-at-measure pass can leave a stale value).
  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    if (value === '') {
      ta.style.height = ''
      return
    }
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value, ref])

  return (
    <div className="ai-input-box">
      {skillMenuOpen && (
        <div className="ai-skills-menu">
          {skillMatches.map((s, i) => (
            <button
              key={s.id}
              className={`ai-skills-item${i === skillHighlight ? ' active' : ''}`}
              onMouseMove={() => setSkillHighlight(i)}
              onMouseDown={(e) => {
                // keep the textarea focus so typing continues after picking
                e.preventDefault()
                completeSkill(s)
              }}
            >
              <span className="ai-skills-name">/{s.name}</span>
              <span className="ai-skills-desc">{s.description}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={1}
        onChange={(e) => {
          setSkillMenuDismissed(false)
          onChange(e.target.value)
        }}
        onKeyDown={(e) => {
          if (skillMenuOpen) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSkillHighlight((h) => (h + 1) % skillMatches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSkillHighlight((h) => (h - 1 + skillMatches.length) % skillMatches.length)
              return
            }
            if (e.key === 'Tab') {
              e.preventDefault()
              completeSkill(highlightedSkill!)
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setSkillMenuDismissed(true)
              return
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              completeSkill(highlightedSkill!)
              return
            }
          }
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (canSend) onSend()
          } else if (e.key === 'Escape' && busy) {
            e.preventDefault()
            onStop()
          }
        }}
        onPaste={(e) => {
          if (!onPasteFiles) return
          const files = Array.from(e.clipboardData.files)
          if (files.length === 0) return
          e.preventDefault()
          onPasteFiles(files)
        }}
      />
      <div className="ai-input-footer">
        {footerStart}
        {!iconOnly && (
          <span className="ai-input-hint" title={busy ? undefined : hintIdleTitle}>
            {busy ? hintBusy : hintIdle}
          </span>
        )}
        {busy ? (
          <button
            className="ai-send-btn ai-stop-btn"
            onClick={onStop}
            title={stopLabel}
            aria-label={stopLabel}
          >
            {iconOnly ? (stopIcon ?? <IconStop size={16} />) : <IconStop size={16} />}
            {!iconOnly && stopLabel}
          </button>
        ) : (
          <button
            className="ai-send-btn"
            onClick={onSend}
            disabled={!canSend}
            title={sendLabel}
            aria-label={sendLabel}
          >
            {iconOnly ? (
              ((canSend ? sendIconEnabled : (sendIconDisabled ?? sendIconEnabled)) ?? (
                <IconEnter size={16} />
              ))
            ) : (
              <IconSend size={16} />
            )}
            {!iconOnly && sendLabel}
          </button>
        )}
      </div>
    </div>
  )
}
