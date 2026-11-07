// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Two to four readings of the same thing, or a level: *Names | Coverage*,
 * *1 2 3 All*. Changing it moves no data and needs no saving, and a segment is
 * never coloured by what it means. More than four choices are a Menu.
 *
 * A radio group: the arrows move and choose, the ring is on the group, one is on.
 *
 * **Below 1024 px** long labels in a tight bar run out of room, in German first.
 * Where the row no longer fits there, it becomes a menu that says what is on. The
 * width of the row cannot be asked once it has gone, so it stays a menu until the
 * window is wide again.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { MenuButton } from './Menu'
import { rovedIndex } from './roving'
import './Segmented.css'

export type SegmentedOption<V extends string = string> = { value: V; label: string }

export type SegmentedProps<V extends string = string> = {
  /** What is being chosen, for a screen reader. */
  label: string
  options: readonly SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  'data-guide'?: string
}

const NARROW = '(max-width: 1023px)'

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.(NARROW)
    if (!query) return undefined
    const changed = () => setNarrow(query.matches)
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  }, [])
  return narrow
}

export function Segmented<V extends string = string>({ label, options, value, onChange, 'data-guide': guide }: SegmentedProps<V>) {
  const narrow = useNarrow()
  const [overflowed, setOverflowed] = useState(false)
  const group = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())

  useLayoutEffect(() => {
    if (!narrow) { setOverflowed(false); return }
    const element = group.current
    if (element && element.scrollWidth > element.clientWidth) setOverflowed(true)
  }, [narrow, options])

  if (narrow && overflowed) {
    const on = options.find((option) => option.value === value)
    return (
      <MenuButton
        label={on?.label ?? label}
        menuLabel={label}
        data-guide={guide}
        items={options.map((option) => ({
          label: option.label,
          checked: option.value === value,
          onSelect: () => { if (option.value !== value) onChange(option.value) },
        }))}
      />
    )
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = rovedIndex(event.key, index, options.length)
    if (next === undefined) return
    event.preventDefault()
    const option = options[next]
    if (!option) return
    refs.current.get(option.value)?.focus()
    onChange(option.value)
  }
  const on = Math.max(0, options.findIndex((option) => option.value === value))

  return (
    <div ref={group} className="kit-segmented" role="radiogroup" aria-label={label} data-guide={guide}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => { if (element) refs.current.set(option.value, element); else refs.current.delete(option.value) }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === on ? 0 : -1}
          className="kit-segmented__option"
          onClick={() => { if (option.value !== value) onChange(option.value) }}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
