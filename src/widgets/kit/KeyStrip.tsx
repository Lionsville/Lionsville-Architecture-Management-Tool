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
import { CloseIcon } from '../icons'
import { tokenVar } from './tokens'
import type { ColourToken } from './tokens'
import './KeyStrip.css'

export type KeyValue = {
  id: string
  label: string
  /** How many are drawn. Absent where a key says only what a mark or a line means. */
  count?: number
  swatch?: ColourToken
  colour?: string
  /** A mark where the rows draw one, so the key looks like what it explains. */
  mark?: MarkKind
  /** A sample of what it means, for what a patch of colour cannot show: a line and its head. */
  sample?: ReactNode
  /** What is drawn in place of a swatch: a mark, or a band's number. */
  shown?: ReactNode
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

export function KeyStrip({ title, values, pressed, onPress, onKeep, onClose, note, 'data-guide': guide, 'data-testid': testId }: {
  /** What the key is of, where it is not plain from the values. */
  title?: string
  values: readonly KeyValue[]
  pressed?: string
  onPress?: (id: string | undefined) => void
  /** Absent for a reader who may not keep it, and when it is kept already. */
  onKeep?: () => void
  /** A line under the values, for what a key has to say as well. */
  note?: string
  /** Takes down what the key is of. */
  onClose?: { label: string; press: () => void }
  'data-guide'?: string
  'data-testid'?: string
}) {
  const { t } = useStrings()
  const shown = keyValues(values, t('kit.key.other'))
  return (
    <div className="kit-key" role="group" aria-label={title ?? t('kit.key.label')} data-guide={guide} data-testid={testId}>
      <div className="kit-key__values">
        {title && <span className="kit-key__title">{title}</span>}
        {shown.map((value) => {
          const swatch = value.shown ?? value.sample ?? (value.mark ? <Mark kind={value.mark} /> : <span
            className="kit-key__swatch"
            style={value.swatch || value.colour ? { background: value.colour ?? tokenVar(value.swatch!) } : undefined}
            data-outline={value.swatch || value.colour ? undefined : true}
          />)
          const words = <>{swatch}<span>{value.label}</span>{value.count !== undefined && <> <span className="kit-key__count">{value.count}</span></>}</>
          return onPress
            ? (
              <button
                key={value.id}
                type="button"
                className="kit-key__value"
                data-key={value.id}
                aria-pressed={pressed === value.id}
                onClick={() => onPress(pressed === value.id ? undefined : value.id)}
              >{words}</button>
            )
            : <span key={value.id} className="kit-key__value" data-key={value.id}>{words}</span>
        })}
        {onKeep && <button type="button" className="kit-key__keep" data-guide="board.keepLens" data-testid="keep-lens" onClick={onKeep}>{t('kit.key.keep')}</button>}
        {onClose && <button type="button" className="kit-key__close" aria-label={onClose.label} onClick={onClose.press}><CloseIcon size={12} /></button>}
      </div>
      {note && <div className="kit-key__note">{note}</div>}
    </div>
  )
}
