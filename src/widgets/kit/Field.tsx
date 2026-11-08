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
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import type { Translate } from '../../i18n'
import { PencilIcon } from '../icons'
import { MenuButton } from './Menu'
import { Select } from './Select'
import type { SelectOption, SelectProps } from './Select'
import { DateInput } from './DateInput'
import type { DateInputProps } from './DateInput'
import type { MenuEntry } from './Menu'
import { commandKey } from './keys'
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

/**
 * A required field's label carries a * after its name (`data-required`, drawn by
 * the stylesheet). A reader of the screen hears *required* from the control
 * itself, which carries `required`, so the mark is for the eye and the label
 * stays the field's plain name: the * has no words in the accessible name.
 */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId()
  const wordsId = `${id}-words`
  const words = error ?? hint
  return (
    <div className="kit-field">
      <label className="kit-field__label" htmlFor={id} data-required={required || undefined}>{label}</label>
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

/** The kit's text box. In a row it fits the row's 24 px (`data-fit`). */
export function TextInput(props: InputProps) {
  return <input {...props} className="kit-input" />
}

export function TextArea(props: TextAreaProps) {
  return <textarea {...props} className="kit-input" data-long />
}

export { Select } from './Select'
export type { SelectOption, SelectProps } from './Select'
export { DateInput } from './DateInput'
export type { DateInputProps } from './DateInput'

/**
 * A box as tall as its text, for a form that is read as a page: it has no scroll of
 * its own and needs no measuring. The hidden copy of the text in the same cell gives
 * the height, so nothing collapses while typing and a page scrolled far down stays
 * where it is, and a wider window rewraps both alike.
 */
export function GrowingTextArea({ classes, minRows = 1, value, ...props }: Omit<TextAreaProps, 'rows' | 'value'> & {
  value: string
  /** The class of the box itself, for its type. */
  classes?: string
  minRows?: number
}) {
  return (
    <div className="kit-grow" data-text={value} style={{ '--grow-rows': minRows } as CSSProperties}>
      <textarea {...props} className={classes ? `kit-grow__text ${classes}` : 'kit-grow__text'} value={value} rows={1} />
    </div>
  )
}

/**
 * A record's title being written, where it stands when read: its size and no box.
 * One line under it says it can be written in, and the words go under that only
 * when something is wrong, so the document below does not move for a hint.
 */
export function TitleField({ label, hint, error, required, value, onChange, ...rest }: Omit<FieldProps, 'children'> & Omit<TextAreaProps, 'value' | 'onChange' | 'rows' | 'placeholder'> & {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="kit-titleField">
      <GrowingTextArea
        {...rest} classes="kit-titleField__text" aria-label={label} aria-required={required} placeholder={hint} title={hint} value={value}
        onChange={(event) => onChange(event.target.value)}
        {...(error ? { 'aria-invalid': true as const, 'aria-describedby': id } : {})}
      />
      {error && <p className="kit-field__words" id={id} data-error>{error}</p>}
    </div>
  )
}

/** A record's title as it reads, in the place and the size `TitleField` writes it. */
export function TitleRead({ children }: { children: ReactNode }) {
  return <div className="kit-titleField"><h2 className="kit-titleField__read">{children}</h2></div>
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
export function SelectField({ label, hint, error, required, value, options, onChange, ...rest }: Words & Omit<SelectProps, 'value' | 'onChange' | 'options'> & {
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(ties) => <Select {...rest} {...ties} value={value} options={options} onChange={onChange} />}
    </Field>
  )
}

/** A label above a day: `YYYY-MM-DD`, or `''` for none. */
export function DateField({ label, hint, error, required, value, onChange, ...rest }: Words & Omit<DateInputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(ties) => <DateInput {...rest} {...ties} value={value} onChange={onChange} />}
    </Field>
  )
}

type Rows = {
  editing: string | undefined
  setEditing: (id: string | undefined) => void
  readOnly: boolean
  onHelp: ((help: string | undefined) => void) | undefined
}
const RowsContext = createContext<Rows | undefined>(undefined)

export type PropertyRowsProps = {
  children: ReactNode
  /** Every row reads and none can be pressed. */
  readOnly?: boolean
  /** What is left out for being empty: *+ Vendor, technology, dates…*, and what each adds. */
  add?: { label: string; items: readonly MenuEntry[]; 'data-guide'?: string }
  /** Which row is a field, for a screen that opens one from somewhere else: a row names itself with `rowId`. */
  editing?: string | undefined
  onEditing?: (rowId: string | undefined) => void
  /** Side by side with no labels on show, for the facts in a record's head. Each row still has its name. */
  line?: boolean
  /** The help of the row being edited, and nothing once none is: a panel says it in its foot. */
  onHelp?: (help: string | undefined) => void
}

/** The rows of a record. It is what keeps editing to one row at a time. */
export function PropertyRows({ children, readOnly = false, add, editing: held, onEditing, line, onHelp }: PropertyRowsProps) {
  const [own, setOwn] = useState<string>()
  const editing = onEditing ? held : own
  const setEditing = onEditing ?? setOwn
  return (
    <RowsContext.Provider value={{ editing, setEditing, readOnly, onHelp }}>
      <div className="kit-props" data-line={line || undefined}>
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
  | 'date'
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
  /** An act beside the empty word: *+ Unit*. `always` keeps it beside a value too, and it then reads as its words alone: *Replace…*. */
  action?: { label: string; onPress: () => void; always?: boolean }
  /** What this field is for, said while it is being edited. */
  help?: string
  /** Opens as a field on arrival: a row somebody just asked for with *+ add*. */
  startOpen?: boolean
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
  /** A word at the end of the row: *live from 2 Nov 2026*. Colour is not the only thing it may carry. */
  aside?: ReactNode
  /** The row's name to `PropertyRows`' `editing`. */
  rowId?: string
  /** The name a finding asks for this row by: what is pressed carries it as `data-field`, so arriving gives it the focus. */
  field?: string
  'data-guide'?: string
  'data-testid'?: string
}

/** How a value that is not simply this record's own is said. */
function notOwnWords(t: Translate, value: string, inherited: PropertyRowProps['inherited'], mixed: number | undefined): string {
  if (mixed !== undefined) return t('kit.property.mixed', { count: mixed })
  return typeof inherited === 'string'
    ? t('kit.property.from', { value, source: inherited })
    : t('kit.property.fromAbove', { value })
}

export function PropertyRow({ label, edit, error, check, onCommit, readOnly = false, aside, rowId, field, help, startOpen = false, 'data-guide': guide, 'data-testid': testId, ...reading }: PropertyRowProps) {
  const rows = useContext(RowsContext)
  if (!rows) throw new Error('A PropertyRow belongs in PropertyRows.')
  const ownId = useId()
  const id = rowId ?? ownId
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

  const { setEditing, onHelp } = rows
  useLayoutEffect(() => {
    if (startOpen && edit !== undefined && writable) setEditing(id)
    // On arrival and no other time: a row that was closed stays closed.
  }, [])
  useEffect(() => {
    if (!editing || !help || !onHelp) return undefined
    onHelp(help)
    return () => onHelp(undefined)
  }, [editing, help, onHelp])

  return (
    <div className="kit-prop" data-guide={guide} data-testid={testId}>
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
              {...reading} label={label} field={field} writable={writable} error={error} pressable={pressable}
              onPress={edit !== undefined && writable ? () => rows.setEditing(id) : undefined}
            />
          )}
        {aside && !editing && <span className="kit-prop__aside">{aside}</span>}
      </dd>
    </div>
  )
}

type Reading = Pick<PropertyRowProps, 'value' | 'display' | 'empty' | 'action' | 'inherited' | 'mixed'>

const isNotOwn = ({ mixed, inherited }: Reading) => mixed !== undefined || (inherited !== undefined && inherited !== false)

/** A row at rest: text, or text to press, and what goes with it. */
function RowReading({ label, value = '', display, empty, action, inherited, mixed, error, field, writable, pressable, onPress }: Reading & {
  label: string
  field: string | undefined
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
            ref={pressable} type="button" className="kit-prop__press" data-quiet={quiet || undefined} data-field={field}
            aria-label={readAs ? t('kit.property.edit', { label, value: readAs }) : t('kit.property.editEmpty', { label })}
            onClick={onPress}
          >
            {words}
            <span className="kit-prop__pen"><PencilIcon size={12} /></span>
          </button>
        )
        : <span className="kit-prop__read" data-quiet={quiet || undefined}>{words}</span>}
      {clamp.cut && (
        <button type="button" className="kit-prop__more" onClick={clamp.toggle}>
          {t(clamp.all ? 'kit.property.showLess' : 'kit.property.showAll')}
        </button>
      )}
      {action && writable && (action.always || value === '') && (
        <button type="button" className="kit-prop__action" onClick={action.onPress}>{action.always ? action.label : `+ ${action.label}`}</button>
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
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
    } else if (event.key === 'Enter' && (edit !== 'long' || commandKey(event))) {
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
    if (edit === 'date') {
      return <DateInput {...ties} data-fit value={draft} onChange={setDraft} onKeyDown={onKeyDown} onBlur={() => commit(draft, false)} />
    }
    if (edit !== 'text') {
      // Enter and Space open the list; only Escape is the row's.
      return (
        <Select
          {...ties} data-fit options={edit.options} value={draft}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() } }}
          onChange={(value) => commit(value, true)} onBlur={() => onClose(false)}
        />
      )
    }
    return <TextInput {...ties} {...typing} data-fit />
  }

  // The keys are this field's while it is one: Escape puts it back and must not reach a canvas beside it.
  return (
    <div className="kit-prop__editing" data-shortcuts-ignore="">
      {field()}
      {said && <p className="kit-prop__error" id={errorId}>{said}</p>}
    </div>
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
