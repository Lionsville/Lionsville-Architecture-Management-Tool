// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A short closed list, drawn by the kit and not by the system. The browser's own
 * select opened the system's menu, in the system's colours and type, and in the
 * dark mode of the system rather than the app's: one control on a page that did
 * not follow the page.
 *
 * It is a button that names the choice, and a list under it of the choices, the
 * one held ticked. The keys are a select's: the arrows, Home and End, a letter for
 * the next choice it starts, Enter or Space to take one, Escape to leave it as it
 * was. A press outside closes the list and does nothing else (`Surface.tsx`).
 *
 * A long list, or one to search, is a Picker.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CaretIcon, CheckIcon } from '../icons'
import { SURFACE_OWNER, SurfacePopover } from './Surface'
import './Select.css'

export type SelectOption = {
  value: string
  label: string
  /** The heading it stands under; a run of options with the same one is said under it once. */
  group?: string
}

export type SelectProps = {
  value: string
  options: readonly SelectOption[]
  /** The value chosen; only when it is another than the one held. */
  onChange: (value: string) => void
  id?: string
  name?: string
  title?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  onBlur?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  /** In a row: the row's 24 px. */
  'data-fit'?: boolean
  'data-guide'?: string
  'data-testid'?: string
}

const OPENS = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' '])

export function Select({ value, options, onChange, onBlur, onKeyDown, required, 'data-fit': fit, ...rest }: SelectProps) {
  const anchor = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const ownId = useId()
  const id = rest.id ?? ownId
  // Held in a ref too: the button's blur comes as the list takes the focus, before a render says it is open.
  const opening = useRef(false)
  const [open, setOpen] = useState(false)
  const held = options.findIndex((option) => option.value === value)
  const show = (to: boolean) => { opening.current = to; setOpen(to) }
  const choose = (index: number) => {
    show(false)
    const next = options[index]
    if (next && next.value !== value) onChange(next.value)
  }
  return (
    <>
      <button
        {...rest}
        id={id}
        ref={anchor}
        type="button"
        // The value a form or a test reads, as it read a select's.
        value={value}
        className="kit-input kit-select"
        data-fit={fit || undefined}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required || undefined}
        onClick={() => show(true)}
        onBlur={(event) => {
          // The list taking the focus is not leaving: a row or a form around this must not hear it as that.
          if (opening.current) { event.stopPropagation(); return }
          onBlur?.()
        }}
        onKeyDown={(event) => {
          if (OPENS.has(event.key)) { event.preventDefault(); show(true); return }
          onKeyDown?.(event)
        }}
      >
        <span className="kit-select__value">{options[held]?.label ?? ''}</span>
        <span className="kit-select__caret"><CaretIcon size={12} /></span>
      </button>
      {open && (
        <SurfacePopover
          open
          anchorEl={anchor.current}
          onClose={() => show(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { className: 'kit-menu kit-select__list', style: { minWidth: anchor.current?.offsetWidth }, [SURFACE_OWNER]: id } as object }}
        >
          <Options
            id={listId} labelledBy={id}
            options={options} held={held} onChoose={choose} onLeave={() => show(false)}
          />
        </SurfacePopover>
      )}
    </>
  )
}

function Options({ id, labelledBy, options, held, onChoose, onLeave }: {
  id: string
  /** The select: the list is named as it is. */
  labelledBy: string
  options: readonly SelectOption[]
  held: number
  onChoose: (index: number) => void
  onLeave: () => void
}) {
  const [active, setActive] = useState(Math.max(held, 0))
  const list = useRef<HTMLUListElement>(null)
  // Before the surface's own trap looks for something to focus, so it finds the list has it.
  useLayoutEffect(() => { list.current?.focus() }, [])
  useLayoutEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])
  const last = options.length - 1
  const move = (to: number) => setActive(Math.min(last, Math.max(0, to)))
  const typeAhead = (key: string) => {
    const letter = key.toLocaleLowerCase()
    for (let step = 1; step <= options.length; step++) {
      const at = (active + step) % options.length
      if (options[at]?.label.toLocaleLowerCase().startsWith(letter)) { setActive(at); return }
    }
  }
  const keys = (event: KeyboardEvent<HTMLUListElement>) => {
    const to: Record<string, () => void> = {
      ArrowDown: () => move(active + 1),
      ArrowUp: () => move(active - 1),
      Home: () => move(0),
      End: () => move(last),
      PageDown: () => move(active + 8),
      PageUp: () => move(active - 8),
      Enter: () => onChoose(active),
      ' ': () => onChoose(active),
    }
    const act = to[event.key]
    if (act) { event.preventDefault(); act(); return }
    if (event.key === 'Tab') { event.preventDefault(); onLeave(); return }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) typeAhead(event.key)
  }
  return (
    <ul
      ref={list}
      id={id}
      className="kit-select__options"
      role="listbox"
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-activedescendant={`${id}-${active}`}
      onKeyDown={keys}
      // The list is in a portal, and React would carry its focus moves out to the field's owner as leaving.
      onBlur={(event) => event.stopPropagation()}
      onFocus={(event) => event.stopPropagation()}
    >
      {options.flatMap((option, index) => [
        ...(option.group && option.group !== options[index - 1]?.group
          ? [<li key={`group-${index}`} className="kit-select__group" role="presentation">{option.group}</li>]
          : []),
        <li
          key={option.value}
          id={`${id}-${index}`}
          data-index={index}
          data-value={option.value}
          className="kit-select__option"
          role="option"
          aria-selected={index === held}
          data-active={index === active || undefined}
          onMouseMove={() => { if (index !== active) setActive(index) }}
          onClick={() => onChoose(index)}
        >
          <span className="kit-select__check">{index === held && <CheckIcon size={14} />}</span>
          <span className="kit-select__label">{option.label}</span>
        </li>,
      ])}
    </ul>
  )
}
