/**
 * Where a thing is on a given day (ADR-0009).
 *
 * A landscape used to be able to say only what was true this morning:
 * `lifecycle` was one value with no date on it, and a connection knew nothing
 * about time at all. So "what will this look like after the cutover" could only
 * be answered by copying the project and editing the copy, which is a second
 * brain and drifts the same afternoon.
 *
 * Time is therefore a property **of the facts that already exist**, not a copy
 * of them: optional dates on the lifecycle an element already had, an optional
 * window on a connection, and a date on a diagram saying when it is. One model,
 * read at whatever moment you ask about.
 *
 * ## The rule
 *
 * The stored `lifecycle` is where the element is **until a date says
 * otherwise**, and each date names the day it *enters* that phase. An element
 * with no dates therefore answers the same thing on every day of its life —
 * which is exactly today's behaviour, and is the property the tests pin.
 *
 * Where a stored phase and a date that has passed disagree — `planned`, with a
 * `live` date last year — the date wins. It is the more specific statement, and
 * the alternative is a landscape that says an application is still planned
 * three years after it went in.
 *
 * ## Dates are strings, and compared as strings
 *
 * `yyyy-mm-dd`, the form every other date in this model already takes, and
 * compared with `<`. That is not a shortcut: it is why the format was chosen.
 * A `Date` here would drag in a timezone, and a landscape is not a thing that
 * happens at an instant — an application goes live on a day, and which day it
 * is does not depend on where the reader is sitting.
 */
import type { DesignConnection, DesignElement, Lifecycle, LifecycleDates } from './types'

/** The phases a date can move an element into, in the order it moves through them. */
export const DATED_PHASES = ['live', 'retiring', 'retired'] as const

export type DatedPhase = (typeof DATED_PHASES)[number]

/** Every phase, in order, including the one no date names. */
export const LIFECYCLE_ORDER: readonly Lifecycle[] = ['planned', 'live', 'retiring', 'retired']

export type { LifecycleDates }

/** A `yyyy-mm-dd` day, and a real one — 2026-02-31 is not a day. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The dates this element carries, in phase order, ignoring anything malformed. */
function datesOf(dates: LifecycleDates | undefined): { phase: DatedPhase; day: string }[] {
  if (!dates) return []
  return DATED_PHASES
    .map((phase) => ({ phase, day: dates[phase] }))
    .filter((entry): entry is { phase: DatedPhase; day: string } => isDay(entry.day))
}

/**
 * Whether these dates run forwards.
 *
 * Only the dates that are actually there are compared, so an element with a
 * retirement date and no go-live date is perfectly well formed — plenty of
 * things in a landscape were there before anybody started writing dates down.
 */
export function datesInOrder(dates: LifecycleDates | undefined): boolean {
  const held = datesOf(dates)
  return held.every((entry, at) => at === 0 || held[at - 1].day <= entry.day)
}

/** Where this element is on `day`. See the rule at the top of this file. */
export function phaseAt(
  element: Pick<DesignElement, 'lifecycle'> & { lifecycleDates?: LifecycleDates },
  day: string,
): Lifecycle {
  const passed = datesOf(element.lifecycleDates).filter((entry) => entry.day <= day)
  // The last phase whose day has come; the stored value until one has.
  return passed.length ? passed[passed.length - 1].phase : element.lifecycle
}

/**
 * Whether a connection's own window includes this day.
 *
 * A line with no window has none, and follows the elements it joins — which is
 * what keeps a landscape where every line needs two dates from being a
 * landscape nobody dates. Only the genuinely temporary lines of a hybrid
 * phase — the sync, the façade, the double write — say anything here.
 *
 * `validUntil` is the last day it is there, not the first day it is gone: a
 * person writing down when a link is switched off writes the day they switch
 * it off.
 */
export function connectionLiveAt(
  connection: Pick<DesignConnection, 'validFrom' | 'validUntil'>,
  day: string,
): boolean {
  const { validFrom, validUntil } = connection
  if (isDay(validFrom) && day < validFrom) return false
  if (isDay(validUntil) && day > validUntil) return false
  return true
}

/** Whether this element or connection says anything about time at all. */
export function hasDates(
  held: { lifecycleDates?: LifecycleDates; validFrom?: string; validUntil?: string },
): boolean {
  return datesOf(held.lifecycleDates).length > 0 || isDay(held.validFrom) || isDay(held.validUntil)
}

/** Today, as this model writes a day. The one place the clock is read. */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Every day a model has an opinion about, sorted and deduplicated.
 *
 * What a roadmap's axis is drawn from, and what a "what changes between these
 * two dates" question steps through. Only the days something actually happens
 * on: a landscape of four thousand elements and nine dates has nine.
 */
export function datesIn(model: {
  elements: readonly (Pick<DesignElement, 'lifecycle'> & { lifecycleDates?: LifecycleDates })[]
  connections: readonly Pick<DesignConnection, 'validFrom' | 'validUntil'>[]
}): string[] {
  const days = new Set<string>()
  for (const element of model.elements) {
    for (const entry of datesOf(element.lifecycleDates)) days.add(entry.day)
  }
  for (const connection of model.connections) {
    if (isDay(connection.validFrom)) days.add(connection.validFrom)
    if (isDay(connection.validUntil)) days.add(connection.validUntil)
  }
  return [...days].sort()
}
