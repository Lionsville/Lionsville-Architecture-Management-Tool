// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sums behind the time axis: which days a window shows, what the ruler
 * marks, and how much of a bar is in view.
 *
 * A day is a `YYYY-MM-DD` string where it is stored and a whole number of days
 * where it is added up, always in UTC: a calendar day has no time zone, and a
 * local date loses or gains an hour twice a year.
 *
 * React-free, and the view is plain data, so whoever remembers a person's scale
 * and position can keep it as it is.
 */

/** What the axis shows: from this day, this many days. */
export type AxisView = { start: string; days: number }

export type AxisScale = 'weeks' | 'months' | 'quarters' | 'years'

export const AXIS_SCALES: readonly AxisScale[] = ['weeks', 'months', 'quarters', 'years']

/** How long a window each scale opens on. */
const SCALE_DAYS: Record<AxisScale, number> = { weeks: 84, months: 365, quarters: 730, years: 1826 }

/** Closer than four weeks a ruler says nothing a date does not; further than this nothing has a date. */
export const AXIS_MIN_DAYS = 28
export const AXIS_MAX_DAYS = 36525

const MS = 86_400_000

export function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day.slice(0, 10)}T00:00:00Z`) / MS)
}

export function dayString(number: number): string {
  return new Date(Math.round(number) * MS).toISOString().slice(0, 10)
}

const firstOfMonth = (year: number, month: number) => Math.floor(Date.UTC(year, month, 1) / MS)
const parts = (day: number) => {
  const date = new Date(day * MS)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), date: date.getUTCDate() }
}

/** What a first open shows: three months back and nine ahead, in whole months. */
export function openingView(today: string): AxisView {
  const { year, month } = parts(dayNumber(today))
  const from = firstOfMonth(year, month - 3)
  return { start: dayString(from), days: firstOfMonth(year, month + 9) - from }
}

/** The scale a window of this length reads as: the nearest one, by ratio. */
export function scaleOf(view: AxisView): AxisScale {
  const distance = (scale: AxisScale) => Math.abs(Math.log(view.days / SCALE_DAYS[scale]))
  return AXIS_SCALES.reduce((best, scale) => (distance(scale) < distance(best) ? scale : best))
}

/**
 * The same window at another scale: anchored on today where today is in view, so
 * the day a person reads from stays where it stood, and on the middle otherwise.
 */
export function viewAtScale(view: AxisView, scale: AxisScale, today?: string): AxisView {
  const days = SCALE_DAYS[scale]
  const at = today === undefined ? undefined : fractionOf(view, today)
  const anchor = at !== undefined && at >= 0 && at <= 1 ? at : 0.5
  return { start: dayString(dayNumber(view.start) + (view.days - days) * anchor), days }
}

/** The window moved by some pixels of a ruler this wide. */
export function scrolledView(view: AxisView, pixels: number, width: number): AxisView {
  const moved = width > 0 ? (pixels / width) * view.days : 0
  return { start: dayString(dayNumber(view.start) + moved), days: view.days }
}

/** A window longer or shorter by a factor, with the day at `anchor` (0 to 1 across the ruler) staying there. */
export function zoomedView(view: AxisView, factor: number, anchor = 0.5): AxisView {
  const days = Math.round(Math.min(AXIS_MAX_DAYS, Math.max(AXIS_MIN_DAYS, view.days / factor)))
  return { start: dayString(dayNumber(view.start) + (view.days - days) * anchor), days }
}

/** A window with this day in view, the rest as it is: in the middle if it had to move, else unmoved. */
export function viewWith(view: AxisView, day: string): AxisView {
  const at = dayNumber(day)
  const start = dayNumber(view.start)
  if (at >= start && at < start + view.days) return view
  return { start: dayString(at - view.days / 2), days: view.days }
}

/** The same length with a day a quarter of the way in, which is where a first open has today. */
export function viewAround(view: AxisView, day: string): AxisView {
  return { start: dayString(dayNumber(day) - view.days / 4), days: view.days }
}

/** Everything with a date in the window, with a little air; a month round one lone day. */
export function fitView(days: readonly string[]): AxisView | undefined {
  if (days.length === 0) return undefined
  const numbers = days.map(dayNumber)
  const first = Math.min(...numbers)
  const last = Math.max(...numbers)
  const span = Math.max(AXIS_MIN_DAYS, last - first + 1)
  const air = Math.ceil(span * 0.03)
  const middle = Math.round((first + last) / 2)
  const whole = Math.min(AXIS_MAX_DAYS, span + air * 2)
  return { start: dayString(middle - Math.floor(whole / 2)), days: whole }
}

/** The view from a first to a last day shown, both in the window. */
export function viewBetween(first: string, last: string): AxisView {
  return { start: first, days: Math.min(AXIS_MAX_DAYS, Math.max(AXIS_MIN_DAYS, dayNumber(last) - dayNumber(first) + 1)) }
}

export function lastDayOf(view: AxisView): string {
  return dayString(dayNumber(view.start) + view.days - 1)
}

/** Where a day sits across the ruler: 0 is the first day's start, 1 the end of the last. */
export function fractionOf(view: AxisView, day: string): number {
  return (dayNumber(day) - dayNumber(view.start)) / view.days
}

export function dayAt(view: AxisView, fraction: number): string {
  return dayString(dayNumber(view.start) + Math.floor(Math.min(0.9999, Math.max(0, fraction)) * view.days))
}

/** Whether a day is in the window, and if not on which side. */
export function sideOf(view: AxisView, day: string): 'before' | 'inside' | 'after' {
  const fraction = fractionOf(view, day)
  if (fraction < 0) return 'before'
  return fraction >= 1 ? 'after' : 'inside'
}

/** How much of a bar is in the window. A bar with no end runs on that way. */
export type BarInView = { left: number; width: number; runsBefore: boolean; runsAfter: boolean }

export function barInView(view: AxisView, from: string | undefined, to: string | undefined): BarInView | undefined {
  const start = from === undefined ? Number.NEGATIVE_INFINITY : fractionOf(view, from)
  // A bar's last day is drawn whole, so it ends where the next day starts.
  const end = to === undefined ? Number.POSITIVE_INFINITY : fractionOf(view, to) + 1 / view.days
  if (end <= 0 || start >= 1) return undefined
  const left = Math.max(0, start)
  const right = Math.min(1, end)
  return { left, width: right - left, runsBefore: start < 0, runsAfter: end > 1 }
}

/** One mark on the ruler: the cell from `left` to its end, and what it says. */
export type RulerCell = {
  key: string
  left: number
  width: number
  /** The cell's unit and whether the year goes with it, for whoever words it. */
  unit: 'week' | 'month' | 'quarter' | 'year'
  day: string
  withYear: boolean
  /** The start of a year, drawn taller. */
  major: boolean
}

type Unit = RulerCell['unit']

const UNIT_OF: Record<AxisScale, Unit> = { weeks: 'week', months: 'month', quarters: 'quarter', years: 'year' }

function unitStart(day: number, unit: Unit): number {
  const { year, month } = parts(day)
  if (unit === 'week') return day - ((new Date(day * MS).getUTCDay() + 6) % 7)
  if (unit === 'month') return firstOfMonth(year, month)
  if (unit === 'quarter') return firstOfMonth(year, month - (month % 3))
  return firstOfMonth(year, 0)
}

function unitNext(day: number, unit: Unit): number {
  const { year, month } = parts(day)
  if (unit === 'week') return day + 7
  if (unit === 'month') return firstOfMonth(year, month + 1)
  if (unit === 'quarter') return firstOfMonth(year, month + 3)
  return firstOfMonth(year + 1, 0)
}

/** A cell narrower than this cannot hold its word. */
const CELL_AT_LEAST = 28

/**
 * The ruler's cells for a window on a ruler this wide. The unit follows the
 * window's scale, and goes up one where the cells would be too narrow to say
 * anything. The year is said where one starts and once in the first cell that
 * can hold it, and not on every mark.
 */
export function rulerCells(view: AxisView, width: number): RulerCell[] {
  const order: Unit[] = ['week', 'month', 'quarter', 'year']
  const unitDays: Record<Unit, number> = { week: 7, month: 30.4, quarter: 91.3, year: 365.25 }
  const pixelsPerDay = width > 0 ? width / view.days : Number.POSITIVE_INFINITY
  let unit = UNIT_OF[scaleOf(view)]
  while (unit !== 'year' && unitDays[unit] * pixelsPerDay < CELL_AT_LEAST) unit = order[order.indexOf(unit) + 1]

  const start = dayNumber(view.start)
  const end = start + view.days
  const cells: RulerCell[] = []
  let yearSaid = false
  for (let at = unitStart(start, unit); at < end; at = unitNext(at, unit)) {
    const left = Math.max(0, (at - start) / view.days)
    const right = Math.min(1, (unitNext(at, unit) - start) / view.days)
    const { month, date } = parts(at)
    const major = month === 0 && date === 1 && at >= start
    const room = (right - left) * width >= (unit === 'week' ? 48 : 56)
    const withYear = unit === 'year' || major || (!yearSaid && room)
    if (withYear) yearSaid = true
    cells.push({ key: `${unit}-${at}`, left, width: right - left, unit, day: dayString(at), withYear, major })
  }
  return cells
}

/** Milestones this close on the ruler merge, and say how many. */
const MERGE_WITHIN_PIXELS = 14

export type MilestoneCluster<T> = { left: number; day: string; items: T[] }

export function mergedMilestones<T extends { day: string }>(view: AxisView, width: number, items: readonly T[]): MilestoneCluster<T>[] {
  const inside = items.filter((item) => sideOf(view, item.day) === 'inside')
    .sort((a, b) => dayNumber(a.day) - dayNumber(b.day))
  const clusters: MilestoneCluster<T>[] = []
  for (const item of inside) {
    const left = (fractionOf(view, item.day) + 0.5 / view.days)
    const last = clusters[clusters.length - 1]
    // Not measured yet, nothing can be said to overlap.
    if (last && width > 0 && (left - last.left) * width < MERGE_WITHIN_PIXELS) last.items.push(item)
    else clusters.push({ left, day: item.day, items: [item] })
  }
  return clusters
}

/**
 * A month's short name as the language writes it in a date: German "Aug." and
 * "Sept.", as in "1. Sept. 2027", rather than the "Aug" and "Sep" ICU gives a
 * month standing alone, so the axis, the window's words and every date beside
 * them abbreviate a month the same way.
 */
export function shortMonth(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .formatToParts(date).find((part) => part.type === 'month')?.value ?? ''
}

/** A ruler's word for a cell, in a language's own short month. */
export function cellWord(cell: Pick<RulerCell, 'unit' | 'day' | 'withYear'>, locale: string): string {
  const date = new Date(dayNumber(cell.day) * MS)
  const year = date.getUTCFullYear()
  if (cell.unit === 'year') return String(year)
  if (cell.unit === 'quarter') return `Q${Math.floor(date.getUTCMonth() / 3) + 1}${cell.withYear ? ` ${year}` : ''}`
  if (cell.unit === 'month') {
    const month = shortMonth(date, locale)
    return cell.withYear ? `${month} ${year}` : month
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(cell.withYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC' })
}

/** The width of a character of the ruler's small type, at a root font size: an estimate a cell's words are fitted by. */
export const rulerCharPx = (rootPx: number) => rootPx * 0.8125 * 0.56

/** The root's font size in px, which a person's text size sets: 16 where there is no page to ask. */
export function rootFontPx(): number {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return 16
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/**
 * A cell's words as its width holds them: with its year where there is room, the
 * month alone where there is not (*Aug*, never *Aug 2…*), and nothing where not
 * even that fits. The cell's title keeps the whole.
 */
export function fittedCellWord(cell: Pick<RulerCell, 'unit' | 'day' | 'withYear'>, locale: string, px: number, charPx: number): string {
  const room = px - 8
  const whole = cellWord(cell, locale)
  if (whole.length * charPx <= room) return whole
  const short = cellWord({ ...cell, withYear: false }, locale)
  return short.length * charPx <= room ? short : ''
}

/** The window in words: "Aug 2026" and "Jul 2027", for a sentence of the caller's. */
export function monthWords(view: AxisView, locale: string): { from: string; to: string } {
  const say = (day: string) => {
    const date = new Date(dayNumber(day) * MS)
    return `${shortMonth(date, locale)} ${date.getUTCFullYear()}`
  }
  return { from: say(view.start), to: say(lastDayOf(view)) }
}
