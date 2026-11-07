// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Anything with dates in rows: a real ruler with a scale on it, and the only slider
 * on the page. The ruler carries the dates, the day the board shows and the scale,
 * so a slider and the rows can no longer disagree.
 *
 * Weeks, Months, Quarters and Years, Today and Fit; ⌘ or Ctrl with the wheel zooms
 * as on every canvas, Shift with the wheel or a sideways swipe scrolls. The window
 * is plain data and the caller's (`AxisView`), so whoever remembers a person's last
 * scale and position just keeps it. A chevron at a bar's end says it runs on past
 * the window. Today is labelled once on the ruler, and the board's day is a handle
 * whose line runs down every row. Out of view that marker pins to the edge it went
 * past, and pressing it brings the day back and keeps the scale.
 *
 * It knows no plan and no application: `TimeBar` and `TimeMilestones` take what a
 * screen worked out. Reading never writes, and the day is a look: the screen decides
 * what a look means.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import Popover from '@mui/material/Popover'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n/LanguageContext'
import { LOCALE } from '../../i18n/strings'
import { Button } from './Button'
import { Segmented } from './Segmented'
import { Tooltip } from './Tooltip'
import { useCanvasZoom } from './useCanvasZoom'
import type { ZoomTarget } from './useCanvasZoom'
import {
  AXIS_SCALES, barInView, cellWord, dayAt, dayNumber, dayString, fitView, fractionOf, lastDayOf, mergedMilestones, monthWords,
  openingView, rulerCells, scaleOf, scrolledView, sideOf, viewAround, viewAtScale, viewBetween, viewWith, zoomedView,
} from './timeScale'
import type { AxisScale, AxisView } from './timeScale'
import './TimeAxis.css'

const AxisContext = createContext<{ view: AxisView; width: number }>({ view: { start: '2000-01-01', days: 365 }, width: 0 })

/** One press of + or −, and how far the window moves on an arrow. */
const ZOOM_PRESS = 1.25
const ARROW_SHARE = 1 / 12

export type TimeAxisProps = {
  view: AxisView
  onViewChange: (view: AxisView) => void
  /** Today, as the screen knows it. */
  today: string
  /** The day the board shows, when it is not today. */
  day?: string
  /** Absent: no handle, for an axis that moves nothing behind it. */
  onDayChange?: (day: string | undefined) => void
  /** Everything with a date, which is what Fit shows. */
  dates?: readonly string[]
  /** The cell above the row names. */
  head?: ReactNode
  /** The rows: `TimeAxisGroup` and `TimeAxisRow`. */
  children?: ReactNode
  'data-guide'?: string
}

export function TimeAxis({ view, onViewChange, today, day, onDayChange, dates = [], head, children, 'data-guide': guide }: TimeAxisProps) {
  const { t, language } = useStrings()
  const locale = LOCALE[language]
  const ruler = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const latest = useRef({ view, onViewChange, width })
  latest.current = { view, onViewChange, width }

  useLayoutEffect(() => {
    const element = ruler.current
    if (!element) return undefined
    const measure = () => setWidth(element.clientWidth)
    measure()
    // Absent under a test's DOM, which never resizes.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])

  const toToday = () => onViewChange(scaleOf(view) === 'months' ? openingView(today) : viewAround(view, today))
  const toEverything = () => { const fitted = fitView(dates); if (fitted) onViewChange(fitted) }

  /** Where the pointer is across the ruler; the element's own pixels start left of the row names. */
  const anchorOf = (at?: { x: number }) => {
    const box = ruler.current?.getBoundingClientRect()
    const outer = root.current?.getBoundingClientRect()
    if (!at || !box || !outer || box.width === 0) return 0.5
    return Math.min(1, Math.max(0, (outer.left + at.x - box.left) / box.width))
  }
  const target: ZoomTarget = {
    go(how, at) {
      if (how === 'fit') toEverything()
      else if (how === 'home') toToday()
      else onViewChange(zoomedView(view, how === 'in' ? ZOOM_PRESS : 1 / ZOOM_PRESS, anchorOf(at)))
    },
    by(factor, at) {
      onViewChange(zoomedView(view, factor, anchorOf(at)))
    },
  }
  const zoomRef = useCanvasZoom(target)
  // Stable: a new function each render would attach anew, and lose where the pointer is.
  const rootRef = useCallback((element: HTMLDivElement | null) => { root.current = element; zoomRef(element) }, [zoomRef])

  // A swipe arrives in many small pieces and a window moves in whole days, so what
  // does not yet come to a day is kept for the next piece.
  const carried = useRef(0)
  useEffect(() => {
    const element = root.current
    if (!element) return undefined
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      const sideways = event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0
      if (sideways === 0) return
      event.preventDefault()
      const held = latest.current
      if (held.width === 0) return
      carried.current += sideways
      const pixelsADay = held.width / held.view.days
      const days = Math.trunc(carried.current / pixelsADay)
      if (days === 0) return
      carried.current -= days * pixelsADay
      held.onViewChange(scrolledView(held.view, days * pixelsADay, held.width))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])

  const onRulerKey = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    const way = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (way === 0 || width === 0) return
    event.preventDefault()
    onViewChange(scrolledView(view, way * width * ARROW_SHARE, width))
  }

  const scaleWords: Record<AxisScale, string> = {
    weeks: t('kit.axis.weeks'), months: t('kit.axis.months'), quarters: t('kit.axis.quarters'), years: t('kit.axis.years'),
  }
  const todayAt = fractionOf(view, today)
  const todayInView = sideOf(view, today) === 'inside'
  const shown = day ?? today
  const daySide = sideOf(view, shown)
  // Two words on one line of the ruler: near each other, each goes to its own side of its line.
  const dayAtFraction = day ? fractionOf(view, day) : 0
  const close = day !== undefined && Math.abs(dayAtFraction - todayAt) * width < 170
  const todayFlips = todayAt > 0.8 || (close && dayAtFraction >= todayAt)
  const dayFlips = dayAtFraction > 0.75 || (close && dayAtFraction < todayAt)

  return (
    <AxisContext.Provider value={{ view, width }}>
      <div
        ref={rootRef}
        className="kit-time"
        data-guide={guide}
      >
        <div className="kit-time__head">
          <div className="kit-time__corner">{head}</div>
          <div className="kit-time__tools">
            <RangeField view={view} onViewChange={onViewChange} />
            <span className="kit-time__grow" />
            <Tooltip title={t('kit.axis.todayHint')}><Button onClick={toToday}>{t('kit.axis.today')}</Button></Tooltip>
            <Tooltip title={t('kit.axis.fitHint')}><Button onClick={toEverything}>{t('kit.axis.fit')}</Button></Tooltip>
            <Segmented
              label={t('kit.axis.scale')}
              options={AXIS_SCALES.map((value) => ({ value, label: scaleWords[value] }))}
              value={scaleOf(view)}
              onChange={(scale) => onViewChange(viewAtScale(view, scale))}
            />
          </div>
          <div ref={ruler} className="kit-time__ruler" role="group" tabIndex={0} aria-label={t('kit.axis.ruler')} onKeyDown={onRulerKey}>
            <div className="kit-time__marks">
              {todayInView && (
                <span className="kit-time__todaymark" data-flip={todayFlips || undefined} style={{ left: `${todayAt * 100}%` }}>{t('kit.axis.today')}</span>
              )}
              {onDayChange && day && daySide === 'inside' && (
                <span className="kit-time__daymark" data-flip={dayFlips || undefined} style={{ left: `${dayAtFraction * 100}%` }}>
                  {t('kit.axis.boardShows', { day: formatDay(day, language) })}
                </span>
              )}
              {day && daySide !== 'inside' && (
                <button
                  type="button"
                  className="kit-time__pinned"
                  data-side={daySide}
                  aria-label={t('kit.axis.dayBack', { day: formatDay(day, language) })}
                  onClick={() => onViewChange(viewWith(view, day))}
                >
                  {daySide === 'before' && '‹ '}{t('kit.axis.boardPinned', { day: formatDay(day, language) })}{daySide === 'after' && ' ›'}
                </button>
              )}
            </div>
            <div className="kit-time__cells">
              {rulerCells(view, width).map((cell) => (
                <span key={cell.key} className="kit-time__cell" data-major={cell.major || undefined} style={{ left: `${cell.left * 100}%`, width: `${cell.width * 100}%` }}>
                  {cell.width * width >= 22 || width === 0 ? cellWord(cell, locale) : ''}
                </span>
              ))}
            </div>
            {onDayChange && daySide === 'inside' && (
              <DayHandle view={view} today={today} day={day} ruler={ruler} onDayChange={onDayChange} />
            )}
          </div>
        </div>
        <div className="kit-time__rows">
          {children}
          <div className="kit-time__lines" aria-hidden>
            {todayInView && <span className="kit-time__line" data-line="today" style={{ left: `${todayAt * 100}%` }} />}
            {day && daySide === 'inside' && <span className="kit-time__line" data-line="day" style={{ left: `${dayAtFraction * 100}%` }} />}
            {day && daySide !== 'inside' && <span className="kit-time__line" data-line="day" data-pinned={daySide} />}
          </div>
        </div>
      </div>
    </AxisContext.Provider>
  )
}

/** The window in words; pressing it asks for a first and a last day. Whole axis is Fit. */
function RangeField({ view, onViewChange }: { view: AxisView; onViewChange: (view: AxisView) => void }) {
  const { t, language } = useStrings()
  const anchor = useRef<HTMLButtonElement>(null)
  const [held, setHeld] = useState<{ from: string; to: string } | undefined>(undefined)
  const words = monthWords(view, LOCALE[language])
  const refused = held !== undefined && held.from !== '' && held.to !== '' && dayNumber(held.to) < dayNumber(held.from)
  const type = (next: { from: string; to: string }) => {
    setHeld(next)
    if (next.from && next.to && dayNumber(next.to) >= dayNumber(next.from)) onViewChange(viewBetween(next.from, next.to))
  }
  return (
    <>
      <Button ref={anchor} aria-haspopup="dialog" onClick={() => setHeld({ from: view.start, to: lastDayOf(view) })}>
        {t('kit.axis.range', words)}
      </Button>
      <Popover
        open={held !== undefined}
        anchorEl={anchor.current}
        onClose={() => setHeld(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { className: 'kit-time__range', role: 'dialog', 'aria-label': t('kit.axis.rangeLabel') } }}
      >
        {held && (
          <>
            <label className="kit-time__rangefield">{t('kit.axis.from')}
              <input type="date" value={held.from} aria-invalid={refused || undefined} onChange={(event) => type({ ...held, from: event.target.value })} />
            </label>
            <label className="kit-time__rangefield">{t('kit.axis.to')}
              <input type="date" value={held.to} aria-invalid={refused || undefined} onChange={(event) => type({ ...held, to: event.target.value })} />
            </label>
            {refused && <p className="kit-time__refused" role="alert">{t('kit.axis.rangeRefused')}</p>}
          </>
        )}
      </Popover>
    </>
  )
}

/** The board's day: a slider with a date, on the ruler. Dropped on today it stops being a look. */
function DayHandle({ view, today, day, ruler, onDayChange }: {
  view: AxisView; today: string; day: string | undefined
  ruler: React.RefObject<HTMLDivElement | null>
  onDayChange: (day: string | undefined) => void
}) {
  const { t, language } = useStrings()
  const shown = day ?? today
  const set = (next: string) => onDayChange(next === today ? undefined : next)
  const fromPointer = (event: PointerEvent) => {
    const box = ruler.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    set(dayAt(view, (event.clientX - box.left) / box.width))
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const at = dayNumber(shown)
    const page = Math.max(7, Math.round(view.days / 12))
    const next: Record<string, number> = {
      ArrowRight: at + 1, ArrowUp: at + 1, ArrowLeft: at - 1, ArrowDown: at - 1,
      PageUp: at + page, PageDown: at - page, Home: dayNumber(view.start), End: dayNumber(lastDayOf(view)),
    }
    if (event.key === 'Escape' && day) { event.preventDefault(); onDayChange(undefined); return }
    const moved = next[event.key]
    if (moved === undefined) return
    event.preventDefault()
    // A slider's ends are the window's: past them is the ruler's to scroll.
    set(dayString(Math.min(dayNumber(lastDayOf(view)), Math.max(dayNumber(view.start), moved))))
  }
  return (
    <span
      className="kit-time__handle"
      role="slider"
      tabIndex={0}
      aria-label={t('kit.axis.dayHandle')}
      aria-valuemin={dayNumber(view.start)}
      aria-valuemax={dayNumber(lastDayOf(view))}
      aria-valuenow={dayNumber(shown)}
      aria-valuetext={formatDay(shown, language)}
      data-looking={day ? true : undefined}
      style={{ left: `${fractionOf(view, shown) * 100}%` }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault(); event.currentTarget.focus() }}
      onPointerMove={(event) => { if (event.buttons === 1) fromPointer(event) }}
    />
  )
}

/** A heading over rows. Says how many, and folds when it is given how. */
export function TimeAxisGroup({ label, count, folded, onToggle }: { label: string; count?: ReactNode; folded?: boolean; onToggle?: () => void }) {
  const words = <>{label}{count !== undefined && <span className="kit-time__groupcount"> {count}</span>}</>
  return (
    <div className="kit-time__group">
      <div className="kit-time__groupname">
        {onToggle
          ? <button type="button" className="kit-time__groupfold" aria-expanded={!folded} onClick={onToggle}>{words}<span className="kit-time__groupcaret" data-folded={folded || undefined} aria-hidden>▸</span></button>
          : words}
      </div>
    </div>
  )
}

/** One thing with dates: its name, a word beside it, and its lane of bars and milestones. */
export function TimeAxisRow({ label, aside, children }: { label: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <div className="kit-time__row">
      <div className="kit-time__name">
        <span className="kit-time__label">{label}</span>
        {aside && <span className="kit-time__aside">{aside}</span>}
      </div>
      <div className="kit-time__lane">{children}</div>
    </div>
  )
}

/** The outline by status, or the fill by lifecycle. Each also says its name, so colour is not the only signal. */
export type TimeBarTone = 'draft' | 'agreed' | 'running' | 'done' | 'planned' | 'live' | 'retiring' | 'gone'

export function TimeBar({ from, to, name, tone, onOpen, 'data-guide': guide }: {
  from?: string
  to?: string
  name: string
  tone: TimeBarTone
  onOpen?: () => void
  'data-guide'?: string
}) {
  const { t } = useStrings()
  const { view } = useContext(AxisContext)
  const bar = barInView(view, from, to)
  if (!bar) return null
  const said = bar.runsBefore && bar.runsAfter ? t('kit.axis.runsBoth', { name })
    : bar.runsBefore ? t('kit.axis.runsBefore', { name })
    : bar.runsAfter ? t('kit.axis.runsAfter', { name }) : name
  const style = { marginLeft: `${bar.left * 100}%`, width: `${bar.width * 100}%` }
  const inside = (
    <>
      {bar.runsBefore && <span className="kit-time__runs" aria-hidden>‹</span>}
      <span className="kit-time__barname">{name}</span>
      {bar.runsAfter && <span className="kit-time__runs" data-end aria-hidden>›</span>}
    </>
  )
  const shared = { className: 'kit-time__bar', 'data-tone': tone, 'data-guide': guide, title: said, style }
  return onOpen
    ? <button type="button" {...shared} aria-label={said} onClick={onOpen}>{inside}</button>
    : <div {...shared} role="img" aria-label={said}>{inside}</div>
}

export type TimeMilestone = { id: string; day: string; label: string }

/** Diamonds under a bar. Those that would sit on each other merge, and say how many. */
export function TimeMilestones({ items, onOpen, 'data-guide': guide }: { items: readonly TimeMilestone[]; onOpen?: (id: string) => void; 'data-guide'?: string }) {
  const { t, language } = useStrings()
  const { view, width } = useContext(AxisContext)
  return (
    <div className="kit-time__milestones" data-guide={guide}>
      {mergedMilestones(view, width, items).map((cluster) => {
        const many = cluster.items.length > 1
        const words = cluster.items.map((item) => `${item.label}, ${formatDay(item.day, language)}`).join('; ')
        const name = many ? `${t('kit.axis.together', { count: cluster.items.length })}: ${words}` : words
        const shared = { className: 'kit-time__milestone', 'data-many': many || undefined, title: name, style: { left: `${cluster.left * 100}%` } }
        const inside = <>{many && <span className="kit-time__count">{cluster.items.length}</span>}</>
        return onOpen
          ? <button key={cluster.day} type="button" {...shared} aria-label={name} onClick={() => onOpen(cluster.items[0].id)}>{inside}</button>
          : <span key={cluster.day} {...shared} role="img" aria-label={name}>{inside}</span>
      })}
    </div>
  )
}
