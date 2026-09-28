// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A row of dates that have to run in order — go-live, retiring, gone — where
 * a day typed out of order stays in its field, marked, with the reason under
 * it, and is not written.
 *
 * Each of the three screens that set an element's dates wrote whatever was
 * typed and let the writer refuse it: a toast said the dates ran backwards,
 * and the field went back to what it held, so the day typed vanished and the
 * sentence that explained it was gone a few seconds later and in another
 * corner. The window on a plan already worked the other way (`WindowFields`);
 * this is that, for the lifecycle.
 *
 * Whether a set of dates is in order is the caller's to say (`accepts`,
 * `model/lifecycle.datesInOrder` in practice): the rule is the model's, and
 * this module may not import it. The writer still refuses on its own, for
 * every path that does not come through here.
 */
import { useState } from 'react'
import TextField from '@mui/material/TextField'
import type { SxProps, Theme } from '@mui/material/styles'

export type OrderedDateFieldsProps<K extends string> = {
  /** The fields, in the order their days have to run. */
  keys: readonly K[]
  values: Partial<Record<K, string>> | undefined
  label(key: K): string
  /** The accessible name, where the visible label alone is not enough to tell two rows apart. */
  ariaLabel?(key: K): string
  disabled?: boolean
  /** Whether these dates may be written. */
  accepts(next: Partial<Record<K, string>> | undefined): boolean
  /** Under a field whose day was not written: why, and what order the days run in. */
  refusal: string
  onChange(next: Partial<Record<K, string>> | undefined): void
  size?: 'small' | 'medium'
  fullWidth?: boolean
  sx?: SxProps<Theme>
}

/** The dates with one day changed, the key removed rather than left empty when it is cleared. */
function withDay<K extends string>(
  held: Partial<Record<K, string>> | undefined, key: K, day: string,
): Partial<Record<K, string>> | undefined {
  const next: Partial<Record<K, string>> = { ...held }
  if (day) next[key] = day
  else delete next[key]
  return Object.keys(next).length ? next : undefined
}

export function OrderedDateFields<K extends string>(props: OrderedDateFieldsProps<K>) {
  const { keys, values, label, ariaLabel, disabled, accepts, refusal, onChange, size, fullWidth, sx } = props
  // The one day typed and not written, shown where it was typed until a day
  // that can be written replaces it.
  const [held, setHeld] = useState<{ key: K; day: string } | undefined>(undefined)
  const type = (key: K, day: string) => {
    const next = withDay(values, key, day)
    if (!accepts(next)) { setHeld({ key, day }); return }
    setHeld(undefined)
    onChange(next)
  }
  return (
    <>
      {keys.map((key) => {
        const wrong = held?.key === key
        return (
          <TextField
            key={key}
            type="date"
            size={size}
            fullWidth={fullWidth}
            label={label(key)}
            value={wrong ? held.day : values?.[key] ?? ''}
            disabled={disabled}
            error={wrong}
            helperText={wrong ? refusal : undefined}
            sx={sx}
            slotProps={{
              inputLabel: { shrink: true },
              ...(ariaLabel ? { htmlInput: { 'aria-label': ariaLabel(key) } } : {}),
            }}
            onChange={(e) => type(key, e.target.value)}
          />
        )
      })}
    </>
  )
}
