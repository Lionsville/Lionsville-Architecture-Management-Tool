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
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { BackIcon } from '../icons'
import { PressName } from './PressName'
import { leaveWithDrafts } from './drafts'
import './RecordPage.css'

export type RecordSection = {
  readonly id: string
  readonly heading: string
  readonly children: ReactNode
  /** The outline's heading this falls under: *Moves*, *Around it*. */
  readonly group?: string
  /** A quiet number or word beside its line in the outline: *0 of 11*. */
  readonly count?: ReactNode
  /** At the end of the heading: *+ Milestone*, *Edit text*. */
  readonly aside?: ReactNode
  /** It says its own heading (a thread, a list that names itself), so the page does not say it too. */
  readonly headless?: boolean
  /** In the outline and not yet on the page: pressing its line is what asks for it (`onSection`). */
  readonly folded?: boolean
  /** Lines in the outline in place of this one's own: a document's headings. */
  readonly within?: readonly RecordOutlineLine[]
}

export type RecordOutlineLine = { readonly id: string; readonly label: string; readonly onPress: () => void }

export type RecordPageProps = {
  /** Named: *‹ Decisions*, never only an arrow, because a person may have come by a link. */
  readonly back?: { readonly label: string; readonly onPress: () => void }
  readonly code?: string
  readonly title: ReactNode
  /** Press the title to rename it. It must be plain words then. */
  readonly onRename?: (name: string) => string | void
  /** One sentence: *Accepted 10 Feb 2026. Locked: to change it, write a decision that replaces it.* */
  readonly status?: ReactNode
  /** What can be done to the record, at the end of the head: a `RecordActions` (verbs · ✎ Edit · ⋯). A page has no ×. */
  readonly actions?: ReactNode
  /** The record's next step: one band under the head, where a preview and a panel have it too (`NextStep`). */
  readonly next?: ReactNode
  /** A band for this record: *Kept in …*. */
  readonly band?: ReactNode
  /** The section to be at, said by the address: the page goes there when this changes. */
  readonly section?: string
  /** A line of the outline was pressed. */
  readonly onSection?: (id: string) => void
  readonly sections: readonly RecordSection[]
  /** How many sections it takes to need an outline. */
  readonly outlineFrom?: number
  readonly dataGuide?: string
}

const NAME_CLASSES = { heading: 'kit-record__title', press: 'kit-record__titlePress', field: 'kit-record__titleField', refused: 'kit-record__refused' }

const sectionDom = (id: string) => `kit-record-${id}`

/**
 * The section the outline marks: the one at the top of the scroll, the last one at
 * the scroll's end — a short last section never reaches the top — and, after a
 * press in the outline, the one pressed, until the person scrolls themselves.
 */
function useCurrentSection(root: React.RefObject<HTMLDivElement | null>, ids: readonly string[]) {
  const [current, setCurrentRaw] = useState(ids[0])
  const pressed = useRef(false)
  useEffect(() => {
    const scroller = root.current
    if (!scroller) return undefined
    const atEnd = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver((seen) => {
      if (pressed.current) return
      const shown = seen.filter((one) => one.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const pick = atEnd() ? shown.at(-1) : shown[0]
      if (pick) setCurrentRaw(pick.target.id.replace('kit-record-', ''))
    }, { root: scroller, rootMargin: '0px 0px -70% 0px' })
    for (const id of ids) {
      const section = document.getElementById(sectionDom(id))
      if (section) observer?.observe(section)
    }
    // The person's own scroll lets go of a pressed section.
    const own = () => { pressed.current = false }
    // The observer hears a section cross the top band only: a short last section never does, so the end is heard on its own.
    const last = ids.at(-1)
    const onScroll = () => { if (!pressed.current && last !== undefined && atEnd()) setCurrentRaw(last) }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('wheel', own, { passive: true })
    scroller.addEventListener('touchmove', own, { passive: true })
    scroller.addEventListener('keydown', own)
    return () => {
      observer?.disconnect()
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('wheel', own)
      scroller.removeEventListener('touchmove', own)
      scroller.removeEventListener('keydown', own)
    }
  }, [root, ids])
  const setCurrent = useCallback((id: string) => { pressed.current = true; setCurrentRaw(id) }, [])
  return [current, setCurrent] as const
}

export function RecordPage({ back, code, title, onRename, status, actions, next, band, section, onSection, sections, outlineFrom = 4, dataGuide }: RecordPageProps) {
  const { t } = useStrings()
  const scroller = useRef<HTMLDivElement>(null)
  const outlined = sections.length >= outlineFrom
  const ids = sections.filter((one) => !one.folded).map((one) => one.id)
  const stableIds = useStable(ids)
  const [current, setCurrent] = useCurrentSection(scroller, stableIds)
  const scrollTo = (id: string) => {
    const section = document.getElementById(sectionDom(id))
    const heading = section?.querySelector<HTMLElement>('h2') ?? section
    heading?.scrollIntoView?.({ block: 'start' })
    heading?.focus()
  }
  // After the render that unfolded it: a folded section has nothing to go to.
  const [goingTo, setGoingTo] = useState<{ id: string } | undefined>(undefined)
  useEffect(() => {
    if (!section) return
    setCurrent(section)
    setGoingTo({ id: section })
  }, [section, setCurrent])
  useEffect(() => {
    if (goingTo) scrollTo(goingTo.id)
  }, [goingTo])
  const goTo = (id: string) => {
    setCurrent(id)
    onSection?.(id)
    setGoingTo({ id })
  }
  const groups = sections.reduce<{ name: string | undefined; lines: RecordSection[] }[]>((all, one) => {
    const last = all[all.length - 1]
    if (last && last.name === one.group) last.lines.push(one)
    else all.push({ name: one.group, lines: [one] })
    return all
  }, [])
  return (
    <div className="kit-record" data-guide={dataGuide}>
      <header className="kit-record__head">
        <div className="kit-record__line">
          {back && (
            <button type="button" className="kit-record__back" onClick={() => leaveWithDrafts(back.onPress)}>
              <BackIcon size={12} /> {back.label}
            </button>
          )}
          {code && <span className="kit-record__code">{code}</span>}
          {onRename && typeof title === 'string'
            ? <PressName name={title} onRename={onRename} heading="h1" classes={NAME_CLASSES} />
            : <h1 className="kit-record__title">{title}</h1>}
          {actions && <span className="kit-record__actions">{actions}</span>}
        </div>
        {status && <div className="kit-record__status">{status}</div>}
        {next && <div className="kit-record__next">{next}</div>}
      </header>
      {band}
      <div className="kit-record__scroll" ref={scroller} tabIndex={0} role="region" aria-label={t('kit.record.content')}>
        <div className="kit-record__page" data-outlined={outlined || undefined}>
          {outlined && (
            <nav className="kit-record__outline" aria-label={t('kit.record.outline')}>
              {groups.map((group, at) => (
                <div key={group.name ?? at} className="kit-record__outlineGroup">
                  {group.name && <div className="kit-record__outlineHead">{group.name}</div>}
                  {group.lines.flatMap((one) => (one.within && one.within.length > 0
                    ? one.within.map((line) => (
                      <button type="button" key={`${one.id}/${line.id}`} className="kit-record__outlineItem" onClick={line.onPress}>
                        <span>{line.label}</span>
                      </button>
                    ))
                    : [(
                      <button
                        type="button" key={one.id} className="kit-record__outlineItem"
                        aria-current={current === one.id ? 'location' : undefined} onClick={() => goTo(one.id)}
                      >
                        <span>{one.heading}</span>
                        {one.count !== undefined && <span className="kit-record__outlineCount">{one.count}</span>}
                      </button>
                    )]))}
                </div>
              ))}
            </nav>
          )}
          <div className="kit-record__sections">
            {sections.filter((one) => !one.folded).map((one) => (
              <section
                key={one.id} id={sectionDom(one.id)} className="kit-record__section" tabIndex={one.headless ? -1 : undefined}
                {...(one.headless ? { 'aria-label': one.heading } : { 'aria-labelledby': `${sectionDom(one.id)}-h` })}
              >
                {!one.headless && (
                  <div className="kit-record__sectionHead">
                    <h2 id={`${sectionDom(one.id)}-h`} tabIndex={-1}>{one.heading}</h2>
                    {one.aside && <span className="kit-record__sectionAside">{one.aside}</span>}
                  </div>
                )}
                {one.children}
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
