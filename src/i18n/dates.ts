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

type Part = 'day' | 'month' | 'year'

/** How the language writes a day in figures: the order of its parts and what stands between them. */
export function dayPattern(language: Language): { order: readonly Part[]; separator: string } {
  const parts = new Intl.DateTimeFormat(LOCALE[language], { day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(2026, 10, 8))
  const order = parts.filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year').map((part) => part.type as Part)
  const separator = parts.find((part) => part.type === 'literal')?.value ?? '-'
  return { order, separator }
}

/** A `YYYY-MM-DD` day in figures as the language writes them: 08-11-2026, 08.11.2026, 08/11/2026. */
export function numericDay(day: string, language: Language): string {
  const match = DAY.exec(day.trim())
  if (!match || !parseDay(day)) return day
  const of: Record<Part, string> = { year: match[1]!, month: match[2]!, day: match[3]! }
  const { order, separator } = dayPattern(language)
  return order.map((part) => of[part]).join(separator)
}

/**
 * A day typed in a field, as `YYYY-MM-DD`; nothing where it is not one. Taken
 * in the language's own order — day first in Dutch, German and British English
 * — with any of `-`, `.` or `/` between the figures, or written out as the
 * records keep it.
 */
export function typedDayIn(typed: string, language: Language): string | undefined {
  const text = typed.trim()
  if (parseDay(text)) return text
  const figures = /^(\d{1,4})[-./ ](\d{1,2})[-./ ](\d{1,4})$/.exec(text)
  if (!figures) return undefined
  const { order } = dayPattern(language)
  const of = Object.fromEntries(order.map((part, at) => [part, figures[at + 1]!])) as Record<Part, string>
  if (of.year.length !== 4) return undefined
  const day = `${of.year}-${of.month.padStart(2, '0')}-${of.day.padStart(2, '0')}`
  return parseDay(day) ? day : undefined
}

/** The day a week starts on in the language's region, 1 for Monday to 7 for Sunday. */
export function firstWeekday(language: Language): number {
  return weekStartOf(LOCALE[language])
}

/** The day a week starts on where a locale is spoken, 1 for Monday to 7 for Sunday; Monday where the runtime cannot say. */
export function weekStartOf(tag: string): number {
  const locale = new Intl.Locale(tag) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } }
  return locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay ?? 1
}
