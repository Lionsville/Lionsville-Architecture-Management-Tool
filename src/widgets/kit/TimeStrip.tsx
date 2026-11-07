// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One record's own time, under its head and staying there while the record
 * scrolls: a thin band over its window, each milestone named and dated, today
 * marked. The first question of a plan is what happens when, and a list of fields
 * further down cannot answer it.
 *
 * It takes what the screen worked out and knows no plan. Milestones too close to
 * tell apart merge and say how many, as on the axis (`mergedMilestones`), and a
 * press hands the first of them back.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n/LanguageContext'
import { LOCALE } from '../../i18n/strings'
import { barInView, cellWord, fitView, fractionOf, mergedMilestones, rulerCells, sideOf } from './timeScale'
import type { AxisView } from './timeScale'
import './TimeStrip.css'

export type TimeStripItem = { readonly id: string; readonly day: string; readonly label: string }

/** Two lines of words under the band; a word needs about this much room to be read at all. */
const ROOM_FOR_A_WORD = 90

export function TimeStrip({ label, today, from, to, items, pickedId, onPick, 'data-guide': guide }: {
  /** What the strip is the time of, for a screen reader. */
  label: string
  today: string
  from?: string
  to?: string
  items: readonly TimeStripItem[]
  pickedId?: string
  onPick?: (id: string) => void
  'data-guide'?: string
}) {
  const { t, language } = useStrings()
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return undefined
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])
  const days = [...items.map((item) => item.day), ...(from ? [from] : []), ...(to ? [to] : []), today]
  const view: AxisView = fitView(days) ?? { start: today, days: 365 }
  const band = from || to ? barInView(view, from, to) : undefined
  const clusters = mergedMilestones(view, width, items)
  return (
    <div ref={box} className="kit-strip" role="group" aria-label={label} data-guide={guide}>
      <div className="kit-strip__ruler" aria-hidden="true">
        {rulerCells(view, width).map((cell) => (
          <span key={cell.key} className="kit-strip__cell" data-major={cell.major || undefined} style={{ left: `${cell.left * 100}%`, width: `${cell.width * 100}%` }}>
            {cell.width * width >= 40 ? cellWord(cell, LOCALE[language]) : ''}
          </span>
        ))}
      </div>
      {sideOf(view, today) === 'inside' && (
        <span className="kit-strip__today" style={{ left: `${fractionOf(view, today) * 100}%` }}>{t('kit.axis.today')}</span>
      )}
      {band && <span className="kit-strip__band" style={{ left: `${band.left * 100}%`, width: `${band.width * 100}%` }} />}
      {clusters.map((cluster, at) => {
        const many = cluster.items.length > 1
        const first = cluster.items[0]
        const said = cluster.items.map((item) => `${formatDay(item.day, language)} ${item.label}`).join('; ')
        // A word runs towards the middle, and shares its line with every other cluster.
        const flip = cluster.left > 0.75
        const room = (flip ? cluster.left - (clusters[at - 2]?.left ?? 0) : (clusters[at + 2]?.left ?? 1) - cluster.left) * width >= ROOM_FOR_A_WORD
        const words = many ? t('kit.axis.together', { count: cluster.items.length }) : `${formatDay(first.day, language)} ${first.label}`
        const inside = (
          <>
            <span className="kit-strip__diamond" aria-hidden="true" />
            {room && <span className="kit-strip__word" data-flip={flip || undefined}>{words}</span>}
          </>
        )
        const shared = {
          className: 'kit-strip__item', 'data-line': at % 2 === 0 ? 'one' : 'two',
          'data-picked': cluster.items.some((item) => item.id === pickedId) || undefined,
          style: { left: `${cluster.left * 100}%` }, title: said,
        }
        return onPick
          ? <button key={first.id} type="button" {...shared} aria-label={said} onClick={() => onPick(first.id)}>{inside}</button>
          : <span key={first.id} {...shared} role="img" aria-label={said}>{inside}</span>
      })}
    </div>
  )
}
