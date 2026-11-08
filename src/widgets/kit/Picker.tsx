// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Choosing a record, a person, a scope or an element, wherever it happens: one
 * field that searches what exists and offers to name a new one, in place of a
 * dropdown of 300 flat rows and a merge list, an owner list and a uses list each
 * of its own.
 *
 * A row says enough to tell two apart (`detail`: a role, a path). It takes the
 * options the screen has worked out and knows nothing of what they are.
 *
 * With nothing typed it shows `recent`, or says to type where there are none yet,
 * or the first options where the screen keeps no recent list at all. With no match
 * it offers Add, and *Did you mean* where the screen can say what was probably
 * meant. Where nothing may be picked it says why (`refusal`), and takes no typing.
 *
 * **Three postures, one list.** In a panel or a popover the list is simply there
 * (`posture="open"`). In a form the list falls out of the field while it has the
 * focus (`"popup"`), in MUI's popper so a dialog's edge cannot cut it. On a canvas
 * it appears where the double-click or the dropped line landed (`PickerAt`).
 *
 * The keyboard is the ARIA combobox's: the focus stays in the field, the arrows
 * walk the list by `aria-activedescendant`, Enter picks, and Escape puts a popup
 * list away and stops there, so a dialog around it keeps its question.
 */
import { useId, useMemo, useRef, useState } from 'react'
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react'
import { focusLeaves, SurfacePopover as Popover, SurfacePopper as Popper } from './Surface'
import { useStrings } from '../../i18n/LanguageContext'
import type { Translate } from '../../i18n'
import { AddIcon, CloseIcon, SearchIcon } from '../icons'
import { claimKey } from './keys'
import './Picker.css'

export type PickerOption = {
  id: string
  label: string
  /** What tells it apart from another of the same name. */
  detail?: string
  /** A heading the list groups by. */
  group?: string
  /** Why this one cannot be picked here. It stays in the list, saying so. */
  refused?: string
}

/** Lower case and without accents, for finding *Müller* by *muller*. */
const folded = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/** What matches, names that start with it first, then names that hold it, then what only the detail holds. */
export function matching(options: readonly PickerOption[], query: string): PickerOption[] {
  const wanted = folded(query.trim())
  if (wanted === '') return [...options]
  const rank = (option: PickerOption) => {
    const name = folded(option.label)
    if (name.startsWith(wanted)) return 0
    if (name.includes(wanted)) return 1
    return folded(option.detail ?? '').includes(wanted) ? 2 : 3
  }
  return options
    .map((option) => ({ option, rank: rank(option) }))
    .filter(({ rank: at }) => at < 3)
    .sort((a, b) => a.rank - b.rank)
    .map(({ option }) => option)
}

export type PickerProps = {
  /** What is being picked: the field's name for a screen reader. */
  label: string
  options: readonly PickerOption[]
  onPick: (option: PickerOption) => void
  /** Offer to name a new one. Its presence is the offer. */
  onCreate?: (name: string) => void
  /** How the offer reads: *New application “tar”*. */
  createLabel?: (name: string) => string
  /** What to show with nothing typed. An empty list says to type. */
  recent?: readonly PickerOption[]
  /** With no match, what was probably meant. */
  didYouMean?: (query: string) => PickerOption | undefined
  /** Nothing may be picked here, and why. */
  refusal?: string
  placeholder?: string
  posture?: 'open' | 'popup'
  autoFocus?: boolean
  /** How many rows before it asks for more typing. */
  maxShown?: number
  /** Stands under the list, such as what a new one would be. */
  foot?: ReactNode
  /** Tab, where it moves that and not the focus. Shift says back. */
  onTab?: (back: boolean) => void
  /** Escape with nothing left for the field to put away. */
  onEscape?: () => void
  /** The focus left the field: a list that stands in a row goes back to being the row. */
  onLeave?: () => void
  /** The one picked already: marked in the list, where the list stays up after a pick. */
  selected?: string
  /** A line under the list, for what the keys do here. */
  hint?: string
  /** The name a test finds the field by. */
  inputTestId?: string
  'data-guide'?: string
}

type Row =
  | { kind: 'option'; option: PickerOption }
  | { kind: 'create' }
  | { kind: 'heading'; text: string }

/** What the list holds for what is typed: its rows, how many did not fit, and a word when it holds none. */
export function pickerRows({ options, recent, typed, didYouMean, canCreate, maxShown, t }: {
  options: readonly PickerOption[]
  recent: readonly PickerOption[] | undefined
  typed: string
  didYouMean: PickerProps['didYouMean']
  canCreate: boolean
  maxShown: number
  t: Translate
}): { rows: Row[]; more: number; note?: string } {
  const listed = (found: readonly PickerOption[]): Row[] => {
    let group: string | undefined
    // What matches best comes first within a group, and a heading is said once.
    const groups = [...new Set(found.map((option) => option.group))]
    const ordered = groups.length > 1 ? groups.flatMap((held) => found.filter((option) => option.group === held)) : found
    return ordered.slice(0, maxShown).flatMap((option): Row[] => {
      const heading = option.group !== undefined && option.group !== group
      group = option.group
      return heading ? [{ kind: 'heading', text: option.group as string }, { kind: 'option', option }] : [{ kind: 'option', option }]
    })
  }
  const beyond = (found: readonly PickerOption[]) => Math.max(0, found.length - maxShown)

  if (typed === '' && recent) {
    if (recent.length === 0) return { rows: [], more: 0, note: t('kit.picker.typeToSearch') }
    return { rows: [{ kind: 'heading', text: t('kit.picker.recent') }, ...listed(recent)], more: beyond(recent) }
  }
  const found = matching(options, typed)
  const exact = options.some((option) => folded(option.label) === folded(typed))
  const create: Row[] = canCreate && typed !== '' && !exact ? [{ kind: 'create' }] : []
  if (found.length > 0 || typed === '') return { rows: [...listed(found), ...create], more: beyond(found) }
  const near = didYouMean?.(typed)
  if (near) return { rows: [{ kind: 'heading', text: t('kit.picker.didYouMean') }, { kind: 'option', option: near }, ...create], more: 0 }
  return create.length > 0 ? { rows: create, more: 0 } : { rows: [], more: 0, note: t('kit.picker.nothing') }
}

export function Picker({
  label, options, onPick, onCreate, createLabel, recent, didYouMean, refusal, placeholder, posture = 'open',
  autoFocus = false, maxShown = 50, onEscape, onLeave, selected, hint, inputTestId, foot, onTab, 'data-guide': guide,
}: PickerProps) {
  const { t } = useStrings()
  const base = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [popped, setPopped] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const typed = query.trim()

  const { rows, more, note } = useMemo(
    () => pickerRows({ options, recent, typed, didYouMean, canCreate: onCreate !== undefined, maxShown, t }),
    [options, recent, typed, didYouMean, onCreate, maxShown, t],
  )

  const pickable = rows.flatMap((row, index) => (row.kind === 'heading' ? [] : [index]))
  const activeRow = pickable[Math.min(active, pickable.length - 1)]
  const showing = refusal === undefined && (posture === 'open' || popped)
  const listId = `${base}-list`
  const rowId = (index: number) => `${base}-row-${index}`

  const choose = (row: Row | undefined) => {
    if (!row || row.kind === 'heading') return
    if (row.kind === 'create') {
      onCreate?.(typed)
    } else {
      if (row.option.refused) return
      onPick(row.option)
    }
    setQuery('')
    setActive(0)
    setPopped(false)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (posture === 'popup' && popped) {
        event.preventDefault()
        event.stopPropagation()
        setPopped(false)
      } else if (onEscape) {
        claimKey(event)
        onEscape()
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!showing) { setPopped(true); return }
      const step = event.key === 'ArrowDown' ? 1 : -1
      if (pickable.length > 0) setActive((Math.min(active, pickable.length - 1) + step + pickable.length) % pickable.length)
      return
    }
    if (event.key === 'Tab' && onTab) {
      event.preventDefault()
      onTab(event.shiftKey)
      return
    }
    if (event.key === 'Enter' && showing && activeRow !== undefined) {
      event.preventDefault()
      choose(rows[activeRow])
    }
  }

  const list: ReactNode = (
    <div className="kit-picker__results">
      {rows.length > 0 && (
        <div className="kit-picker__list" id={listId} role="listbox" aria-label={label}>
          {rows.map((row, index) => {
            if (row.kind === 'heading') return <div key={index} className="kit-picker__heading" role="presentation">{row.text}</div>
            const isActive = index === activeRow
            if (row.kind === 'create') {
              return (
                <div
                  key={index} id={rowId(index)} role="option" aria-selected={isActive} className="kit-picker__row" data-active={isActive || undefined}
                  data-create onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row)}
                >
                  <AddIcon size={14} />
                  <span className="kit-picker__name">{createLabel ? createLabel(typed) : t('kit.picker.add', { query: typed })}</span>
                </div>
              )
            }
            const refused = row.option.refused
            return (
              <div
                key={row.option.id} id={rowId(index)} role="option" aria-selected={isActive} aria-disabled={refused ? true : undefined}
                className="kit-picker__row" data-active={isActive || undefined} data-refused={refused ? true : undefined} data-selected={row.option.id === selected || undefined}
                onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row)}
              >
                <span className="kit-picker__name">{row.option.label}</span>
                {(refused ?? row.option.detail) && <span className="kit-picker__detail">{refused ?? row.option.detail}</span>}
              </div>
            )
          })}
        </div>
      )}
      {note && <p className="kit-picker__note">{note}</p>}
      {more > 0 && <p className="kit-picker__note">{t('kit.picker.more', { count: more })}</p>}
      {hint && <p className="kit-picker__note" data-hint>{hint}</p>}
    </div>
  )

  return (
    <div className="kit-picker" data-posture={posture} ref={box} data-guide={guide}>
      <div className="kit-picker__field">
        <SearchIcon size={14} />
        <PickerInput
          aria-label={label}
          data-testid={inputTestId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showing && rows.length > 0}
          aria-controls={showing && rows.length > 0 ? listId : undefined}
          aria-activedescendant={showing && activeRow !== undefined ? rowId(activeRow) : undefined}
          value={query}
          placeholder={placeholder}
          disabled={refusal !== undefined}
          autoFocus={autoFocus}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setPopped(true) }}
          onFocus={() => setPopped(true)}
          onBlur={() => { setPopped(false); onLeave?.() }}
          onKeyDown={onKeyDown}
        />
      </div>
      {refusal !== undefined && <p className="kit-picker__note" data-refusal>{refusal}</p>}
      {showing && posture === 'open' && list}
      {showing && posture === 'popup' && (
        <Popper
          open
          anchorEl={box.current}
          placement="bottom-start"
          className="kit-picker__popup"
          style={{ width: box.current?.offsetWidth }}
        >
          {list}
        </Popper>
      )}
      {foot && <div className="kit-picker__foot">{foot}</div>}
    </div>
  )
}

/**
 * Several picked out of one list, while it stands in a row: what is chosen, each
 * with its ×, and the field for the next. The screen says when a change is written.
 */
export function PickerMany({ label, chosen, options, onAdd, onRemove, onDone, placeholder, 'data-guide': guide }: {
  label: string
  chosen: readonly { id: string; label: string; detail?: string }[]
  options: readonly PickerOption[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  /** Escape, or the focus left the whole of it. */
  onDone: () => void
  placeholder?: string
  'data-guide'?: string
}) {
  const { t } = useStrings()
  const held = new Set(chosen.map((one) => one.id))
  return (
    <div
      className="kit-picker__many"
      data-guide={guide}
      onBlur={(event) => { if (focusLeaves(event)) onDone() }}
    >
      {chosen.length > 0 && (
        <ul className="kit-picker__chosen">
          {chosen.map((one) => (
            <li key={one.id} title={one.detail}>
              {one.label}
              <button
                type="button" className="kit-picker__unchoose" aria-label={t('kit.picker.remove', { name: one.label })}
                onMouseDown={(event) => event.preventDefault()} onClick={() => onRemove(one.id)}
              >
                <CloseIcon size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Picker
        label={label} placeholder={placeholder} autoFocus posture="open" maxShown={12}
        options={options.filter((option) => !held.has(option.id))}
        onPick={(option) => onAdd(option.id)}
        onEscape={onDone}
      />
    </div>
  )
}

function PickerInput(props: Omit<ComponentPropsWithRef<'input'>, 'className' | 'style' | 'type'>) {
  return <input {...props} type="text" className="kit-picker__input" autoComplete="off" spellCheck={false} />
}

export type PickerAtProps = Omit<PickerProps, 'posture' | 'autoFocus' | 'onEscape'> & {
  open: boolean
  /** Where it landed, in window pixels. */
  at: { x: number; y: number }
  onClose: () => void
}

/** The picker where the double-click or the dropped line landed. Picking closes it. */
export function PickerAt({ open, at, onClose, onPick, onCreate, ...rest }: PickerAtProps) {
  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: at.y, left: at.x }}
      slotProps={{ paper: { className: 'kit-picker__over' } }}
    >
      <Picker
        {...rest}
        autoFocus
        posture="open"
        onPick={(option) => { onClose(); onPick(option) }}
        onCreate={onCreate && ((name) => { onClose(); onCreate(name) })}
      />
    </Popover>
  )
}
