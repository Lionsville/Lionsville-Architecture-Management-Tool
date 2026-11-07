// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one Day control: today, the days worth looking at, a chosen day. It draws
 * today's model with its dates: what was really there is History's, and the two
 * are named apart. Today says nothing, so only a day that is not today wears the
 * accent, and the band, the frame and the address are the screen's.
 */
import { useRef, useState } from 'react'
import Popover from '@mui/material/Popover'
import { formatDay } from '../../i18n/dates'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { ViewBarMenu } from './ViewBar'
import './DayControl.css'

export type DayGroup = {
  /** Where these days come from, such as a plan. */
  heading?: string
  days: readonly { day: string; label: string }[]
}

export function DayControl({ day, groups = [], onChange, outsideData, 'data-guide': guide }: {
  /** The day looked at or saved on; nothing for today. */
  day: string | undefined
  groups?: readonly DayGroup[]
  onChange: (day: string | undefined) => void
  /** The day is past every date this view holds, which a person should not have to work out. */
  outsideData?: boolean
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
            ...group.days.map((held) => ({
              label: `${held.label} · ${formatDay(held.day, language)}`,
              checked: held.day === day,
              onSelect: () => onChange(held.day),
            })),
          ]),
          { line: true },
          { label: t('kit.day.choose'), onSelect: choose },
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
          <label className="kit-day__label">
            {t('kit.day.field')}
            <input
              className="kit-day__field"
              type="date"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- a person who asked to choose a day is here to type it.
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" size="small" disabled={!typed}>{t('kit.day.show')}</Button>
        </form>
      </Popover>
    </span>
  )
}
