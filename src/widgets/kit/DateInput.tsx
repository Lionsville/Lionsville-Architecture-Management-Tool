// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A day, written or chosen, in the kit's box and the kit's calendar. The browser's
 * own date field drew its segments and its calendar in the system's colours and
 * type, and in the system's light or dark rather than the app's.
 *
 * The value is a `YYYY-MM-DD` day or nothing, as the browser's was. What is typed
 * is said out only when it is a day — written so, or day first as `8-11-2026` or
 * `8.11.2026` — or when the box is emptied; a half-typed day stays in the box, and
 * leaving it puts back the day held. The calendar beside it opens on the day held,
 * or today, and is walked with the arrows, the page keys for a month, Enter to take
 * a day and Escape to leave it.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { formatDay, parseDay } from '../../i18n/dates'
import { LOCALE } from '../../i18n/strings'
import type { Language } from '../../i18n/languages'
import { CalendarIcon, CaretIcon } from '../icons'
import { SURFACE_OWNER, SurfacePopover } from './Surface'
import './DateInput.css'

export type DateInputProps = {
  /** A `YYYY-MM-DD` day, or `''`. */
  value: string
  /** A day, or `''` for none; never a half-typed one. */
  onChange: (value: string) => void
  min?: string
  max?: string
  id?: string
  name?: string
  title?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  /** The focus has left the box and its calendar. */
  onBlur?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  /** In a row: the row's 24 px. */
  'data-fit'?: boolean
  'data-guide'?: string
  'data-testid'?: string
}

const DAY_FIRST = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/
const pad = (n: number) => String(n).padStart(2, '0')
export const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** What was typed, as a day; nothing where it is not one. */
export function typedDay(typed: string): string | undefined {
  const text = typed.trim()
  if (parseDay(text)) return text
  const match = DAY_FIRST.exec(text)
  if (!match) return undefined
  const day = `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`
  return parseDay(day) ? day : undefined
}

export function DateInput({ value, onChange, min, max, onBlur, onKeyDown, disabled, 'data-fit': fit, 'data-guide': guide, ...rest }: DateInputProps) {
  const { t, language } = useStrings()
  const box = useRef<HTMLSpanElement>(null)
  const ownId = useId()
  const id = rest.id ?? ownId
  const [typed, setTyped] = useState(value)
  const [seen, setSeen] = useState(value)
  // A ref as well: the box's blur comes as the calendar takes the focus, before a render says it is open.
  const choosing = useRef(false)
  const [open, setOpen] = useState(false)
  if (seen !== value) { setSeen(value); setTyped(value) }

  const show = (to: boolean) => { choosing.current = to; setOpen(to) }
  // Back to the box once the calendar has gone: while it is there its trap would take the focus back.
  const back = useRef(false)
  useEffect(() => {
    if (open || !back.current) return
    back.current = false
    box.current?.querySelector('input')?.focus()
  }, [open])
  const close = () => { back.current = true; show(false) }
  const type = (text: string) => {
    setTyped(text)
    const day = text.trim() === '' ? '' : typedDay(text)
    if (day !== undefined && day !== value) onChange(day)
  }
  const left = (event: FocusEvent) => {
    // The calendar taking the focus is not leaving: a row or a form around this must not hear it as that.
    if (choosing.current) { event.stopPropagation(); return }
    if (box.current?.contains(event.relatedTarget as Node | null)) return
    setTyped(value)
    onBlur?.()
  }
  const take = (day: string) => {
    close()
    setTyped(day)
    if (day !== value) onChange(day)
  }
  return (
    <span ref={box} className="kit-date" data-fit={fit || undefined} data-guide={guide} onBlur={left}>
      <input
        {...rest}
        id={id}
        className="kit-input kit-date__text"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        data-date=""
        data-fit={fit || undefined}
        placeholder={t('kit.date.format')}
        disabled={disabled}
        value={typed}
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && event.altKey) { event.preventDefault(); show(true); return }
          onKeyDown?.(event)
        }}
      />
      <button
        type="button" className="kit-date__open" aria-label={t('kit.date.choose')} title={t('kit.date.choose')}
        aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => show(true)}
      >
        <CalendarIcon size={14} />
      </button>
      {open && (
        <SurfacePopover
          open
          anchorEl={box.current}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { className: 'kit-menu kit-date__chooser', [SURFACE_OWNER]: id } as object }}
          disableRestoreFocus
        >
          <Calendar language={language} held={parseDay(value) ? value : undefined} min={min} max={max} onTake={take} t={t} />
        </SurfacePopover>
      )}
    </span>
  )
}

const shifted = (day: string, by: { days?: number; months?: number }) => {
  const date = parseDay(day)!
  if (by.months) {
    const wanted = date.getDate()
    date.setDate(1)
    date.setMonth(date.getMonth() + by.months)
    date.setDate(Math.min(wanted, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
  }
  if (by.days) date.setDate(date.getDate() + by.days)
  return dayOf(date)
}

/** The weeks of the month a day is in, Monday first, each day as `YYYY-MM-DD`. */
export function monthWeeks(day: string): string[][] {
  const date = parseDay(day)!
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const weeks: string[][] = []
  for (const at = new Date(start); weeks.length < 6; ) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) { week.push(dayOf(at)); at.setDate(at.getDate() + 1) }
    weeks.push(week)
    if (at.getMonth() !== date.getMonth()) break
  }
  return weeks
}

function Calendar({ language, held, min, max, onTake, t }: {
  language: Language
  held: string | undefined
  min: string | undefined
  max: string | undefined
  onTake: (day: string) => void
  t: (key: 'kit.date.previous' | 'kit.date.next') => string
}) {
  const today = dayOf(new Date())
  const [at, setAt] = useState(held ?? today)
  const titleId = useId()
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)
  useLayoutEffect(() => { grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus() }, [])
  useEffect(() => {
    if (moved.current) grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [at])
  const month = at.slice(0, 7)
  const locale = LOCALE[language]
  const title = parseDay(`${month}-01`)!.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const weekdays = monthWeeks('2024-01-01')[0]!.map((day) => parseDay(day)!.toLocaleDateString(locale, { weekday: 'short' }))
  const outside = (day: string) => (min !== undefined && day < min) || (max !== undefined && day > max)
  const go = (by: { days?: number; months?: number }) => { moved.current = true; setAt(shifted(at, by)) }
  const keys = (event: KeyboardEvent) => {
    const to: Record<string, { days?: number; months?: number }> = {
      ArrowLeft: { days: -1 }, ArrowRight: { days: 1 }, ArrowUp: { days: -7 }, ArrowDown: { days: 7 },
      PageUp: { months: -1 }, PageDown: { months: 1 },
    }
    const by = to[event.key]
    if (by) { event.preventDefault(); go(by) }
  }
  return (
    <div
      className="kit-date__calendar" role="dialog" aria-labelledby={titleId}
      // In a portal: React would carry its focus moves out to the field's owner as leaving.
      onBlur={(event) => event.stopPropagation()} onFocus={(event) => event.stopPropagation()}
    >
      <div className="kit-date__head">
        <button type="button" className="kit-date__step" data-back aria-label={t('kit.date.previous')} onClick={() => setAt(shifted(at, { months: -1 }))}>
          <CaretIcon size={12} />
        </button>
        <span className="kit-date__title" id={titleId} aria-live="polite">{title}</span>
        <button type="button" className="kit-date__step" aria-label={t('kit.date.next')} onClick={() => setAt(shifted(at, { months: 1 }))}>
          <CaretIcon size={12} />
        </button>
      </div>
      <table ref={grid} className="kit-date__grid" role="grid" aria-labelledby={titleId} onKeyDown={keys}>
        <thead>
          <tr>{weekdays.map((name) => <th key={name} scope="col" abbr={name}>{name}</th>)}</tr>
        </thead>
        <tbody>
          {monthWeeks(at).map((week) => (
            <tr key={week[0]}>
              {week.map((day) => (
                <td key={day} role="gridcell" aria-selected={day === held}>
                  <button
                    type="button"
                    className="kit-date__day"
                    tabIndex={day === at ? 0 : -1}
                    aria-label={formatDay(day, language)}
                    aria-current={day === today ? 'date' : undefined}
                    data-held={day === held || undefined}
                    data-other={!day.startsWith(month) || undefined}
                    disabled={outside(day)}
                    onClick={() => onTake(day)}
                  >
                    {Number(day.slice(8))}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
