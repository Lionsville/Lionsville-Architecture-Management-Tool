// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one Day control: today, the days worth looking at, a chosen day. It draws
 * today's model with its dates: what was really there is History's, and the two
 * are named apart. Today says nothing, so only a day that is not today wears the
 * accent, and the band, the frame and the address are the screen's.
 */
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SurfacePopover as Popover } from './Surface'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { DateInput } from './DateInput'
import { ViewBarMenu } from './ViewBar'
import type { MenuEntry } from './Menu'
import './DayControl.css'

export type DayGroup = {
  /** Where these days come from, such as a plan. */
  heading?: string
  days: readonly { day: string; label: string }[]
}

const TODAY_LINE = Symbol('today')

/** Today on this computer, as a day is written. */
function todayHere(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** The days in order, with a line where the past ends and what is still to come begins. */
export function pastThenComing<T extends { day: string }>(days: readonly T[], today = todayHere()): (T | typeof TODAY_LINE)[] {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  const first = sorted.findIndex((one) => one.day >= today)
  if (first <= 0) return sorted
  return [...sorted.slice(0, first), TODAY_LINE, ...sorted.slice(first)]
}

export function DayControl({ day, groups = [], onChange, onKeep, keepLabel, outsideData, note, 'data-guide': guide }: {
  /** The day looked at or saved on; nothing for today. */
  day: string | undefined
  groups?: readonly DayGroup[]
  onChange: (day: string | undefined) => void
  /** Keep the day looked at with what is drawn, for whoever opens it. Absent: nothing to keep, or a reader who may not. */
  onKeep?: () => void
  /** What keeping it does, in this view's words. */
  keepLabel?: string
  /** The day is past every date this view holds, which a person should not have to work out. */
  outsideData?: boolean
  /** Said where a day is typed: what a day is and is not, which only the screen knows. */
  note?: ReactNode
  'data-guide'?: string
}) {
  const { t, language } = useStrings()
  const anchor = useRef<HTMLSpanElement>(null)
  const [choosing, setChoosing] = useState(false)
  const [typed, setTyped] = useState('')
  const said = day ? formatDay(day, language) : undefined
  const choose = () => { setTyped(day ?? ''); setChoosing(true) }
  const show = () => { if (typed) { setChoosing(false); onChange(typed) } }
  return (
    <span ref={anchor} className="kit-day" title={outsideData ? t('kit.day.outside') : undefined}>
      <ViewBarMenu
        label={said ? t('kit.day.on', { day: said }) : t('kit.day')}
        menuLabel={t('kit.day')}
        on={day !== undefined}
        data-guide={guide}
        items={[
          { label: t('kit.day.today'), checked: day === undefined, onSelect: () => onChange(undefined) },
          ...groups.flatMap((group) => [
            ...(group.heading ? [{ heading: group.heading }] : [{ line: true as const }]),
            ...pastThenComing(group.days).map((held): MenuEntry => (held === TODAY_LINE ? { line: true } : {
              // The date first, where the eye runs down the list; what happens then under it.
              label: formatDay(held.day, language),
              detail: held.label,
              checked: held.day === day,
              onSelect: () => onChange(held.day),
            })),
          ]),
          { line: true },
          { label: t('kit.day.choose'), onSelect: choose },
          ...(onKeep && keepLabel ? [{ line: true as const }, { label: keepLabel, onSelect: onKeep }] : []),
        ]}
      />
      {outsideData && <span className="kit-day__outside" role="note">{t('kit.day.outside')}</span>}
      <Popover
        open={choosing}
        anchorEl={anchor.current}
        onClose={() => setChoosing(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { className: 'kit-day__chooser' } }}
      >
        <form onSubmit={(event) => { event.preventDefault(); show() }}>
          {note && <p className="kit-day__note">{note}</p>}
          <label className="kit-day__label">
            {t('kit.day.field')}
            <DateInput autoFocus value={typed} onChange={setTyped} />
          </label>
          <Button type="submit" variant="primary" size="small" disabled={!typed}>{t('kit.day.show')}</Button>
        </form>
      </Popover>
    </span>
  )
}
