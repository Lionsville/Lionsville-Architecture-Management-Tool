// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The key: a strip on the canvas, made from what is drawn, with counts. Pressing
 * a value dims the rest, and pressing it again lets them back; the dimming is the
 * screen's, as what it draws. A second legend in a dialog is what this replaces.
 *
 * A swatch is a token's name or a colour somebody chose, and a value with neither
 * is drawn as an outline, which is how *Other* looks.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Mark } from './Mark'
import type { MarkKind } from './Mark'
import { tokenVar } from './tokens'
import type { ColourToken } from './tokens'
import './KeyStrip.css'

export type KeyValue = {
  id: string
  label: string
  /** How many are drawn. A key of what a line means has none to count. */
  count?: number
  swatch?: ColourToken
  colour?: string
  /** A mark where the rows draw one, so the key looks like what it explains. */
  mark?: MarkKind
  /** A sample of what it means, for what a patch of colour cannot show: a line and its head. */
  sample?: ReactNode
}

/** Past six a key stops being read, so the smallest go together as *Other*. */
const KEY_AT_MOST = 6

export const OTHER_VALUE = 'other'

/** The values to show, largest first, the rest gathered up. `otherLabel` is the word for what was gathered. */
export function keyValues(values: readonly KeyValue[], otherLabel: string): KeyValue[] {
  const ordered = [...values].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  if (ordered.length <= KEY_AT_MOST) return ordered
  const rest = ordered.slice(KEY_AT_MOST - 1)
  return [
    ...ordered.slice(0, KEY_AT_MOST - 1),
    { id: OTHER_VALUE, label: otherLabel, count: rest.reduce((sum, value) => sum + (value.count ?? 0), 0) },
  ]
}

export function KeyStrip({ values, pressed, onPress, onKeep, note, 'data-guide': guide }: {
  values: readonly KeyValue[]
  pressed?: string
  onPress?: (id: string | undefined) => void
  /** Absent for a reader who may not keep it, and when it is kept already. */
  onKeep?: () => void
  /** A line under the values, for what a key has to say as well. */
  note?: string
  'data-guide'?: string
}) {
  const { t } = useStrings()
  const shown = keyValues(values, t('kit.key.other'))
  return (
    <div className="kit-key" role="group" aria-label={t('kit.key.label')} data-guide={guide}>
      <div className="kit-key__values">
        {shown.map((value) => {
          const swatch = value.sample ?? (value.mark ? <Mark kind={value.mark} /> : <span
            className="kit-key__swatch"
            style={value.swatch || value.colour ? { background: value.colour ?? tokenVar(value.swatch!) } : undefined}
            data-outline={value.swatch || value.colour ? undefined : true}
          />)
          const words = <>{swatch}<span>{value.label}</span> {value.count !== undefined && <span className="kit-key__count">{value.count}</span>}</>
          return onPress
            ? (
              <button
                key={value.id}
                type="button"
                className="kit-key__value"
                aria-pressed={pressed === value.id}
                onClick={() => onPress(pressed === value.id ? undefined : value.id)}
              >{words}</button>
            )
            : <span key={value.id} className="kit-key__value">{words}</span>
        })}
        {onKeep && <button type="button" className="kit-key__keep" onClick={onKeep}>{t('kit.key.keep')}</button>}
      </div>
      {note && <div className="kit-key__note">{note}</div>}
    </div>
  )
}
