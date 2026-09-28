// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Dates as the screen says them, in one place.
 *
 * Two shapes: a day ("28 Sept 2026") for the day-only fields the records keep
 * (`YYYY-MM-DD`), and a moment ("28 Sept, 06:39") for a time something
 * happened, with the year said only when it is not this year's. Both in the
 * interface's language through {@link LOCALE}, never the machine's.
 *
 * A day is parsed as a **local** date: `new Date('2026-09-28')` is midnight
 * UTC, which is the day before anywhere west of Greenwich.
 */
import type { Language } from './languages'
import { LOCALE } from './strings'

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A `YYYY-MM-DD` day as a local date; nothing where it is not one. A day the
 * calendar does not have — the 31st of September — is not one: `Date` would
 * roll it over into October, which is a different day from the one written.
 */
export function parseDay(day: string): Date | undefined {
  const match = DAY.exec(day.trim())
  if (!match) return undefined
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const held = new Date(year, month - 1, date)
  return held.getMonth() === month - 1 && held.getDate() === date ? held : undefined
}

/** A day to show: "28 Sept 2026". What is not a day is shown as it came. */
export function formatDay(day: string, language: Language): string {
  const date = parseDay(day)
  if (!date) return day
  return date.toLocaleDateString(LOCALE[language], { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A moment to show: "28 Sept, 06:39", with the year when it is not this one. */
export function formatMoment(at: string | number | Date, language: Language, now: Date = new Date()): string {
  const date = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(date.getTime())) return String(at)
  return date.toLocaleString(LOCALE[language], {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
    hour: '2-digit',
    minute: '2-digit',
  })
}
