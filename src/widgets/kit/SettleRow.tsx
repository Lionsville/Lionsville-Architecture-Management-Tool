// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One value two people left differently, as a pair of choices in words: neither
 * side drawn as the default, because the visual default is how a colleague's work
 * gets overwritten without anybody deciding to. Choosing per row is the merge; there
 * is no separate mode.
 */
import './SettleRow.css'

export type SettleSide = 'first' | 'second'

export type SettleRowProps = {
  readonly label: string
  readonly first: string
  readonly second: string
  /** Null: nobody has chosen yet. */
  readonly chosen: SettleSide | null
  /** Absent: the two are shown and may not be picked apart. */
  readonly onChoose?: (side: SettleSide) => void
  /** Whose each side is, for a screen reader: the columns say it to the eye. */
  readonly firstName: string
  readonly secondName: string
}

export function SettleRow({ label, first, second, chosen, onChoose, firstName, secondName }: SettleRowProps) {
  const side = (which: SettleSide, value: string, whose: string) => (
    <label className="kit-settle__side" data-chosen={chosen === which || undefined}>
      {onChoose && (
        <input type="radio" name={label} checked={chosen === which} onChange={() => onChoose(which)} aria-label={`${label}: ${whose}: ${value}`} />
      )}
      <span>{value}</span>
    </label>
  )
  return (
    <div className="kit-settle__row" role={onChoose ? 'radiogroup' : 'group'} aria-label={label}>
      <span className="kit-settle__label">{label}</span>
      {side('first', first, firstName)}
      {side('second', second, secondName)}
    </div>
  )
}
