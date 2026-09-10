/**
 * Where a thing is on a given day (ADR-0009).
 *
 * A landscape used to be able to say only what was true this morning:
 * `lifecycle` was one value with no date on it, and a relation knew nothing
 * about time at all. So "what will this look like after the cutover" could only
 * be answered by copying the project and editing the copy, which is a second
 * brain and drifts the same afternoon.
 *
 * Time is therefore a property **of the facts that already exist**, not a copy
 * of them: optional dates on the lifecycle an element already had, an optional
 * window on a relation, and a date on a diagram saying when it is. One model,
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
import type { DesignElement, Lifecycle, LifecycleDates, Relation } from './types'

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
 * Whether a relation's own window includes this day.
 *
 * A row with no window has none, and follows the elements it joins — which is
 * what keeps a landscape where every line needs two dates from being a
 * landscape nobody dates. Only the genuinely temporary lines of a hybrid
 * phase — the sync, the façade, the double write — and the dated statements of
 * the business layer — "the WMS supports fulfilment from March" (ADR-0012 §5)
 * — say anything here.
 *
 * `validUntil` is the last day it is there, not the first day it is gone: a
 * person writing down when a link is switched off writes the day they switch
 * it off.
 */
export function relationLiveAt(
  relation: Pick<Relation, 'validFrom' | 'validUntil'>,
  day: string,
): boolean {
  const { validFrom, validUntil } = relation
  if (isDay(validFrom) && day < validFrom) return false
  if (isDay(validUntil) && day > validUntil) return false
  return true
}

/**
 * Whether a date says this element is gone on `day`.
 *
 * Only a *dated* retirement answers yes: `retired` names the day it is gone,
 * so a board on or after that day does not draw it, or the lines to it. An
 * element stored as `retired` with no day is a different statement — "this
 * is retired, and we are still drawing it" — and keeps its dimmed card.
 */
export function isGoneOn(
  element: { lifecycleDates?: LifecycleDates },
  day: string,
): boolean {
  const gone = element.lifecycleDates?.retired
  return isDay(gone) && day >= gone
}

/** Whether this element or relation says anything about time at all. */
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
 * Whole days from one day to another; negative when the second is earlier.
 *
 * UTC, for the reason {@link ../model/transition#addDays} is: a calendar day is
 * not an instant, and a local `Date` built from two of them across a
 * daylight-saving change is 23 or 25 hours apart rather than 24.
 */
export function daysBetween(from: string, to: string): number {
  const at = (day: string) => {
    const [year, month, date] = day.split('-').map(Number)
    return Date.UTC(year, month - 1, date)
  }
  return Math.round((at(to) - at(from)) / 86_400_000)
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
  relations: readonly Pick<Relation, 'validFrom' | 'validUntil'>[]
}): string[] {
  const days = new Set<string>()
  for (const element of model.elements) {
    for (const entry of datesOf(element.lifecycleDates)) days.add(entry.day)
  }
  for (const relation of model.relations) {
    if (isDay(relation.validFrom)) days.add(relation.validFrom)
    if (isDay(relation.validUntil)) days.add(relation.validUntil)
  }
  return [...days].sort()
}
