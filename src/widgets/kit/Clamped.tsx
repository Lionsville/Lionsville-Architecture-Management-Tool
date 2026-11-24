// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A long text that must not push what stands under it out of reach: its first
 * part, the last line fading, and one press for the rest of it. A text that fits
 * is drawn as it is, with nothing to press. The focus going into what is folded
 * away opens it, so a link there is never pressed unseen.
 */
import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import './Clamped.css'

const FOLDED_REM = 14
const SLACK_REM = 3

export function Clamped({ children, testId }: { readonly children: ReactNode; readonly testId?: string }) {
  const { t } = useStrings()
  const [over, setOver] = useState(false)
  const [open, setOpen] = useState(false)
  const watching = useRef<() => void>(undefined)
  const text = useRef<HTMLDivElement | null>(null)
  const body = useCallback((element: HTMLDivElement | null) => {
    watching.current?.()
    watching.current = undefined
    text.current = element
    if (!element) return
    // The words inside are measured against the folded height, so it is known while open too.
    const inner = element.firstElementChild as HTMLElement
    // A line or two over is not worth a press: it is drawn whole.
    const measure = () => setOver(inner.offsetHeight > (FOLDED_REM + SLACK_REM) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16))
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(inner)
    watching.current = () => observer?.disconnect()
  }, [])
  const toggle = () => {
    setOpen(!open)
    // Folded from its foot, the text's start comes back into sight with the press.
    if (open) text.current?.scrollIntoView?.({ block: 'nearest' })
  }
  return (
    <div className="kit-clamped" data-testid={testId}>
      <div ref={body} className="kit-clamped__body" data-folded={(over && !open) || undefined} style={over && !open ? { maxHeight: `${FOLDED_REM}rem` } : undefined} onFocusCapture={() => { if (over && !open) setOpen(true) }}>
        <div>{children}</div>
      </div>
      {over && <button type="button" className="kit-clamped__more" aria-expanded={open} onClick={toggle}>{t(open ? 'kit.property.showLess' : 'kit.property.showAll')}</button>}
    </div>
  )
}
