// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record with room: one fixed head (the way back, named; a code; a title; one
 * sentence on where it stands), one scroll, its sections in order, an outline for
 * the long ones. Three nested scrollers made a long record hard to read, so there
 * is one, and a table may be as wide as it needs inside it.
 *
 * Being edited, the same record is a `FocusedWindow`: a full window with nothing
 * else on screen. Only the prose has an *Edit text*; facts are pressed where they stand.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { BackIcon } from '../icons'
import './RecordPage.css'

export type RecordSection = {
  readonly id: string
  readonly heading: string
  readonly children: ReactNode
}

export type RecordPageProps = {
  /** Named: *‹ Decisions*, never only an arrow, because a person may have come by a link. */
  readonly back?: { readonly label: string; readonly onPress: () => void }
  readonly code?: string
  readonly title: ReactNode
  /** One sentence: *Accepted 10 Feb 2026. Locked: to change it, write a decision that replaces it.* */
  readonly status?: ReactNode
  /** The ⋯ and whatever else belongs at the end of the head. */
  readonly actions?: ReactNode
  /** A band for this record: *Kept in …*. */
  readonly band?: ReactNode
  readonly sections: readonly RecordSection[]
  /** How many sections it takes to need an outline. */
  readonly outlineFrom?: number
  readonly dataGuide?: string
}

const sectionDom = (id: string) => `kit-record-${id}`

function useCurrentSection(root: React.RefObject<HTMLDivElement | null>, ids: readonly string[]) {
  const [current, setCurrent] = useState(ids[0])
  useEffect(() => {
    const scroller = root.current
    if (!scroller || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((seen) => {
      const top = seen.filter((one) => one.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setCurrent(top.target.id.replace('kit-record-', ''))
    }, { root: scroller, rootMargin: '0px 0px -70% 0px' })
    for (const id of ids) {
      const section = document.getElementById(sectionDom(id))
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [root, ids])
  return [current, setCurrent] as const
}

export function RecordPage({ back, code, title, status, actions, band, sections, outlineFrom = 4, dataGuide }: RecordPageProps) {
  const { t } = useStrings()
  const scroller = useRef<HTMLDivElement>(null)
  const outlined = sections.length >= outlineFrom
  const ids = sections.map((section) => section.id)
  const stableIds = useStable(ids)
  const [current, setCurrent] = useCurrentSection(scroller, stableIds)
  const goTo = (id: string) => {
    setCurrent(id)
    const heading = document.getElementById(sectionDom(id))?.querySelector<HTMLElement>('h2')
    heading?.scrollIntoView?.({ block: 'start' })
    heading?.focus()
  }
  return (
    <div className="kit-record" data-guide={dataGuide}>
      <header className="kit-record__head">
        <div className="kit-record__line">
          {back && (
            <button type="button" className="kit-record__back" onClick={back.onPress}>
              <BackIcon size={12} /> {back.label}
            </button>
          )}
          {code && <span className="kit-record__code">{code}</span>}
          <h1 className="kit-record__title">{title}</h1>
          {actions && <span className="kit-record__actions">{actions}</span>}
        </div>
        {status && <div className="kit-record__status">{status}</div>}
      </header>
      {band}
      <div className="kit-record__scroll" ref={scroller} tabIndex={0} role="region" aria-label={t('kit.record.content')}>
        <div className="kit-record__page" data-outlined={outlined || undefined}>
          {outlined && (
            <nav className="kit-record__outline" aria-label={t('kit.record.outline')}>
              {sections.map((section) => (
                <button
                  type="button" key={section.id} className="kit-record__outlineItem"
                  aria-current={current === section.id ? 'location' : undefined} onClick={() => goTo(section.id)}
                >
                  {section.heading}
                </button>
              ))}
            </nav>
          )}
          <div className="kit-record__sections">
            {sections.map((section) => (
              <section key={section.id} id={sectionDom(section.id)} className="kit-record__section" aria-labelledby={`${sectionDom(section.id)}-h`}>
                <h2 id={`${sectionDom(section.id)}-h`} tabIndex={-1}>{section.heading}</h2>
                {section.children}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function useStable(ids: readonly string[]): readonly string[] {
  const kept = useRef(ids)
  if (kept.current.join('\u0000') !== ids.join('\u0000')) kept.current = ids
  return kept.current
}
