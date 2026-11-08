// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one field that narrows what a page shows by what is typed.
 *
 * Named by what it finds, *Find …*, which is its name for a screen reader and
 * the words in it: every page says it the same way, so nobody has to read a
 * different sentence to know it is the same thing. Wide enough for those words
 * (`--find-min`) wherever its container has the room, and never wider than that
 * container. Escape empties it before it does anything else; once empty, the
 * key is the page's again.
 */
import type { ComponentPropsWithRef } from 'react'
import { SearchIcon } from '../icons'
import './FindField.css'

export type FindFieldProps = Omit<ComponentPropsWithRef<'input'>, 'className' | 'style' | 'type' | 'value' | 'onChange' | 'placeholder' | 'aria-label'> & {
  /** What it finds, said *Find …*: its name and the words in it. */
  label: string
  value: string
  onChange: (value: string) => void
  /** The width of what it stands in, for a field heading a column or a panel rather than standing in a bar. */
  fill?: boolean
}

export function FindField({ label, value, onChange, onKeyDown, fill, ...rest }: FindFieldProps) {
  return (
    <span className="kit-find" data-fill={fill || undefined}>
      <SearchIcon size={14} />
      <input
        {...rest} type="search" className="kit-find__input" aria-label={label} placeholder={label} title={label} value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || event.key !== 'Escape' || value === '') return
          event.stopPropagation()
          onChange('')
        }}
      />
    </span>
  )
}
