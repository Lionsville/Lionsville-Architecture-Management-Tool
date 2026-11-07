// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two ways a fact is written.
 *
 * **Field**: the label above, the hint or the error under, for a form that makes a
 * new record and for the dialog that asks one thing. `TextField` and `SelectField`
 * are that with a control in it; anything else goes in as a render function, which
 * is handed what ties the control to its label and its words.
 *
 * **PropertyRow**: a fact on a record that exists. It reads as text in a row of
 * 24 px, and becomes a field on a press, one at a time, in place of a Read and an
 * Edit mode: a screen with no mode has no way to look read-only and still take
 * typing. Enter or leaving keeps what was typed, Escape drops it, and either way
 * the row is text again. What a press would change is hidden under `readOnly`,
 * for one row or all of them, and then the row is plain text and not a button.
 *
 * Fields with nothing in them stay out, behind `add` on `PropertyRows`. A row that
 * must show it is empty says so with `empty`, and an `action` beside that word. A
 * value from above names its source, a selection's mixed value says how many, and
 * a long one stops at three lines with *Show all*.
 */
import { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, ComponentPropsWithRef, KeyboardEvent, ReactNode, RefObject } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import type { Translate } from '../../i18n'
import { MenuButton } from './Menu'
import type { MenuEntry } from './Menu'
import './Field.css'

/** What ties a control to its label and to the words under it. */
export type ControlTies = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: boolean
}

export type FieldProps = {
  label: string
  /** What goes here, in a line under the control. */
  hint?: string
  /** What is wrong, in the hint's place. */
  error?: string
  required?: boolean
  children: (ties: ControlTies) => ReactNode
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()
  const wordsId = `${id}-words`
  const words = error ?? hint
  return (
    <div className="kit-field">
      <label className="kit-field__label" htmlFor={id}>{label}</label>
      {children({
        id,
        ...(words ? { 'aria-describedby': wordsId } : {}),
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(required ? { required } : {}),
      })}
      {words && <p className="kit-field__words" id={wordsId} data-error={error ? true : undefined}>{words}</p>}
    </div>
  )
}

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'className' | 'style'>
type TextAreaProps = Omit<ComponentPropsWithRef<'textarea'>, 'className' | 'style'>
type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'className' | 'style'>

/** The kit's text box. In a row it fits the row's 24 px (`data-fit`). */
export function TextInput(props: InputProps) {
  return <input {...props} className="kit-input" />
}

export function TextArea(props: TextAreaProps) {
  return <textarea {...props} className="kit-input" data-long />
}

export type SelectOption = { value: string; label: string }

/**
 * The browser's own select, drawn in the kit's box. For a short closed list; a
 * long list or anything to search is a Picker.
 */
export function Select({ options, ...props }: SelectProps & { options: readonly SelectOption[] }) {
  return (
    <select {...props} className="kit-input" data-select>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

type Words = Pick<FieldProps, 'label' | 'hint' | 'error' | 'required'>

/** A label above a text box, or above a box for several lines with `rows`. */
export function TextField({ label, hint, error, required, rows, value, onChange, ...rest }: Words & Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /** Several lines: how many to start with. */
  rows?: number
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(ties) => (rows !== undefined
        ? (
          <TextArea
            {...(rest as TextAreaProps)} {...ties} rows={rows} value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )
        : <TextInput {...rest} {...ties} value={value} onChange={(event) => onChange(event.target.value)} />)}
    </Field>
  )
}

/** A label above a short closed list. */
export function SelectField({ label, hint, error, required, value, options, onChange, ...rest }: Words & Omit<SelectProps, 'value' | 'onChange'> & {
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(ties) => <Select {...rest} {...ties} value={value} options={options} onChange={(event) => onChange(event.target.value)} />}
    </Field>
  )
}

type Rows = { editing: string | undefined; setEditing: (id: string | undefined) => void; readOnly: boolean }
const RowsContext = createContext<Rows | undefined>(undefined)

export type PropertyRowsProps = {
  children: ReactNode
  /** Every row reads and none can be pressed. */
  readOnly?: boolean
  /** What is left out for being empty: *+ Vendor, technology, dates…*, and what each adds. */
  add?: { label: string; items: readonly MenuEntry[]; 'data-guide'?: string }
}

/** The rows of a record. It is what keeps editing to one row at a time. */
export function PropertyRows({ children, readOnly = false, add }: PropertyRowsProps) {
  const [editing, setEditing] = useState<string>()
  return (
    <RowsContext.Provider value={{ editing, setEditing, readOnly }}>
      <div className="kit-props">
        <dl className="kit-props__list">{children}</dl>
        {add && !readOnly && (
          <div className="kit-props__add">
            <MenuButton label={`+ ${add.label}`} menuLabel={add.label} items={add.items} variant="quiet" size="small" data-guide={add['data-guide']} />
          </div>
        )}
      </div>
    </RowsContext.Provider>
  )
}

/** What a row's own editor is handed, for a value that is not text: a date, a Picker. */
export type RowEditor = {
  value: string
  onChange: (value: string) => void
  /** Keep this value, or what `onChange` last said. */
  commit: (value?: string) => void
  cancel: () => void
  ties: { 'aria-label': string; 'aria-invalid'?: true; 'aria-describedby'?: string; autoFocus: true }
}

export type PropertyRowEdit =
  | 'text'
  | 'long'
  | { options: readonly SelectOption[] }
  | ((editor: RowEditor) => ReactNode)

export type PropertyRowProps = {
  label: string
  /** The value as text: what the editor starts from, and what the row says. */
  value?: string
  /** How it reads, where text is not enough: a mark and a word, a name that is a link. */
  display?: ReactNode
  /** What the row says with nothing in it: *Nobody yet*. */
  empty?: string
  /** An act beside the empty word: *+ Unit*. */
  action?: { label: string; onPress: () => void }
  /** The value is not this record's own. `true` says from above; a name says from where. */
  inherited?: boolean | string
  /** A selection disagrees: how many values it holds. */
  mixed?: number
  /** What is wrong, said under the row. A refusal from the screen; `check` says the rest. */
  error?: string
  /** How a press edits. None, or `readOnly`, and the row only reads. */
  edit?: PropertyRowEdit
  onCommit?: (value: string) => void
  /** Why this value will not do; the row stays open and says so. */
  check?: (value: string) => string | undefined
  readOnly?: boolean
  'data-guide'?: string
}

/** How a value that is not simply this record's own is said. */
function notOwnWords(t: Translate, value: string, inherited: PropertyRowProps['inherited'], mixed: number | undefined): string {
  if (mixed !== undefined) return t('kit.property.mixed', { count: mixed })
  return typeof inherited === 'string'
    ? t('kit.property.from', { value, source: inherited })
    : t('kit.property.fromAbove', { value })
}

export function PropertyRow({ label, edit, error, check, onCommit, readOnly = false, 'data-guide': guide, ...reading }: PropertyRowProps) {
  const rows = useContext(RowsContext)
  if (!rows) throw new Error('A PropertyRow belongs in PropertyRows.')
  const id = useId()
  const pressable = useRef<HTMLButtonElement>(null)
  const returning = useRef(false)

  const writable = !readOnly && !rows.readOnly
  const editing = edit !== undefined && writable && rows.editing === id

  useLayoutEffect(() => {
    if (!editing && returning.current) {
      returning.current = false
      pressable.current?.focus()
    }
  }, [editing])

  return (
    <div className="kit-prop" data-guide={guide}>
      <dt className="kit-prop__label">{label}</dt>
      <dd className="kit-prop__value">
        {editing
          ? (
            <RowEditing
              label={label} edit={edit} startsFrom={isNotOwn(reading) ? '' : reading.value ?? ''} refusal={error} check={check} onCommit={onCommit}
              onClose={(back) => { returning.current = back; rows.setEditing(undefined) }}
            />
          )
          : (
            <RowReading
              {...reading} label={label} writable={writable} error={error} pressable={pressable}
              onPress={edit !== undefined && writable ? () => rows.setEditing(id) : undefined}
            />
          )}
      </dd>
    </div>
  )
}

type Reading = Pick<PropertyRowProps, 'value' | 'display' | 'empty' | 'action' | 'inherited' | 'mixed'>

const isNotOwn = ({ mixed, inherited }: Reading) => mixed !== undefined || (inherited !== undefined && inherited !== false)

/** A row at rest: text, or text to press, and what goes with it. */
function RowReading({ label, value = '', display, empty, action, inherited, mixed, error, writable, pressable, onPress }: Reading & {
  label: string
  error: string | undefined
  writable: boolean
  pressable: RefObject<HTMLButtonElement | null>
  /** Absent, it only reads. */
  onPress: (() => void) | undefined
}) {
  const { t } = useStrings()
  const notOwn = isNotOwn({ mixed, inherited })
  const quiet = notOwn || (value === '' && display === undefined)
  const shown = notOwn ? notOwnWords(t, value, inherited, mixed) : display ?? (value === '' ? empty : value)
  const readAs = typeof shown === 'string' ? shown : value
  const clamp = useClamp(shown)
  const words = <span ref={clamp.box} className="kit-prop__text" data-all={clamp.all || undefined}>{shown}</span>
  return (
    <>
      {onPress
        ? (
          <button
            ref={pressable} type="button" className="kit-prop__press" data-quiet={quiet || undefined}
            aria-label={readAs ? t('kit.property.edit', { label, value: readAs }) : t('kit.property.editEmpty', { label })}
            onClick={onPress}
          >
            {words}
          </button>
        )
        : <span className="kit-prop__read" data-quiet={quiet || undefined}>{words}</span>}
      {clamp.cut && (
        <button type="button" className="kit-prop__more" onClick={clamp.toggle}>
          {t(clamp.all ? 'kit.property.showLess' : 'kit.property.showAll')}
        </button>
      )}
      {action && writable && value === '' && (
        <button type="button" className="kit-prop__action" onClick={action.onPress}>+ {action.label}</button>
      )}
      {error && <p className="kit-prop__error">{error}</p>}
    </>
  )
}

/**
 * A row while it is a field. Mounted for just that long, so what was typed starts
 * from the value each time and leaves with the field.
 */
function RowEditing({ label, edit, startsFrom, refusal, check, onCommit, onClose }: {
  label: string
  edit: PropertyRowEdit
  startsFrom: string
  refusal: string | undefined
  check: PropertyRowProps['check']
  onCommit: PropertyRowProps['onCommit']
  /** `back`: put the focus back on the row, because the keyboard ended it. */
  onClose: (back: boolean) => void
}) {
  const errorId = useId()
  const [draft, setDraft] = useState(startsFrom)
  const [problem, setProblem] = useState<string>()

  const commit = (next: string, back: boolean) => {
    const refused = check?.(next)
    if (refused) { setProblem(refused); return }
    onClose(back)
    if (next !== startsFrom) onCommit?.(next)
  }
  const cancel = () => onClose(true)

  const said = problem ?? refusal
  const ties = {
    'aria-label': label,
    autoFocus: true as const,
    ...(said ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}),
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
    } else if (event.key === 'Enter' && (edit !== 'long' || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit(draft, true)
    }
  }
  const typing = {
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onKeyDown,
    onBlur: () => commit(draft, false),
  }

  const field = (): ReactNode => {
    if (typeof edit === 'function') return edit({ value: draft, onChange: setDraft, commit: (next) => commit(next ?? draft, true), cancel, ties })
    if (edit === 'long') return <TextArea {...ties} {...typing} rows={3} />
    if (edit !== 'text') {
      return (
        <Select
          {...ties} data-fit options={edit.options} value={draft} onKeyDown={onKeyDown}
          onChange={(event) => commit(event.target.value, true)} onBlur={() => onClose(false)}
        />
      )
    }
    return <TextInput {...ties} {...typing} data-fit />
  }

  return (
    <>
      {field()}
      {said && <p className="kit-prop__error" id={errorId}>{said}</p>}
    </>
  )
}

/**
 * Three lines, and *Show all* when there are more. The more is measured rather
 * than guessed from the length, since a line's width is the panel's.
 */
function useClamp(content: ReactNode) {
  const box = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)
  const [all, setAll] = useState(false)

  useLayoutEffect(() => {
    const element = box.current
    if (!element || all) return undefined
    const measure = () => setCut(element.scrollHeight > element.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const watching = new ResizeObserver(measure)
    watching.observe(element)
    return () => watching.disconnect()
  }, [all, content])

  return { box, cut, all, toggle: () => setAll((was) => !was) }
}
