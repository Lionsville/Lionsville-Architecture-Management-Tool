// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A field that names a person (ADR-0036 §8): an element's owner, a plan's,
 * who saw an observation, who runs an experiment, who proposed or signed a
 * decision.
 *
 * It takes a person picked from the register, or text as every such field
 * took before the register. Picked, it holds an id and shows what the
 * register says — the name, or the pseudonym once the person is forgotten —
 * with the cross to take it off. As text it is a text field as it always was,
 * with *From the register…* beside it: the person picker, whose *New person…*
 * asks the four signs before anyone is added. While a name is typed, the
 * register's entries it may be are offered, so text is never written where
 * the person was already there to pick — and **text that resembles an entry is
 * held until the field is left**, never written keystroke by keystroke: a
 * name typed to find somebody, then picked, would otherwise be in the history,
 * where no forget reaches it.
 */
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { PersonId, PersonRef } from '../../model/person'
import { isPicked, pickedPerson } from '../../model/person'
import { possibleDuplicates } from '../duplicates'
import { entriesOf } from '../person'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import { useSaying } from './access'
import type { PersonNames } from './names'
import { PersonPicker } from './PersonPicker'

export type PersonRefFieldProps = {
  value: PersonRef | undefined
  onChange: (next: PersonRef | undefined) => void
  names: PersonNames
  label: string
  disabled?: boolean
  required?: boolean
  /** `standard` in a table row; `outlined` as a form's field. */
  variant?: 'outlined' | 'standard'
  /** Text committed as it is typed, or when the field is left — a name is not worth a step per keystroke. */
  commit?: 'change' | 'blur'
  error?: boolean
  helperText?: string
  placeholder?: string
  /** Called when the text field is left, after any commit: a form that keeps a draft commits it then. */
  onBlur?: () => void
  testId?: string
  /** The text input's own test id, where a page's tests already name it; `<testId>-text` otherwise. */
  inputTestId?: string
  s: Translate
}

/** How many entries a typed name is offered: a hint, not the People page. */
const OFFERED = 3

/** A person picked, as a chip: the register's words, *you*, and the cross that takes it off. */
function Picked({ value, names, label, disabled, onChange, testId, s }: PersonRefFieldProps & { value: PersonRef }) {
  return (
    <Box data-testid={testId} sx={{ display: 'grid', gap: 0.25 }}>
      <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Box>
        <Chip
          size="small" color="primary" variant="outlined" data-testid={testId ? `${testId}-picked` : undefined}
          label={`${names.text(value)}${names.isMe(value) ? ` · ${s('people.you')}` : ''}`}
          {...(disabled ? {} : { onDelete: () => onChange(undefined) })}
        />
      </Box>
    </Box>
  )
}

export function PersonRefField(props: PersonRefFieldProps) {
  const { value, onChange, names, label, disabled, required, variant = 'outlined', commit = 'change', testId, s } = props
  const text = typeof value === 'string' ? value : ''
  const [draft, setDraft] = useState(text)
  const [picking, setPicking] = useState(false)
  const saying = useSaying(s)
  useEffect(() => { setDraft(text) }, [text])
  const access = names.access
  const people = access?.people
  const offered = useMemo(
    () => (people && draft.trim().length > 2 ? possibleDuplicates({ name: draft }, entriesOf(people)).slice(0, OFFERED) : []),
    [people, draft],
  )
  const pick = (id: PersonId) => {
    setPicking(false)
    onChange(pickedPerson(id))
    props.onBlur?.()
  }
  if (isPicked(value)) return <Picked {...props} value={value} />
  if (picking && access) {
    return (
      <Box data-testid={testId} sx={{ display: 'grid', gap: 0.5 }}>
        <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
        <PersonPicker register={access} saying={saying} value={undefined} onChange={(id) => { if (id) pick(id) }} initialQuery={draft} s={s} />
        {saying.said && <Typography sx={{ fontSize: 12, color: saying.said.tone === 'error' ? 'error.main' : 'text.secondary' }}>{saying.said.text}</Typography>}
        <Box><Button size="small" onClick={() => setPicking(false)}>{s('people.cancel')}</Button></Box>
      </Box>
    )
  }
  const resembles = (next: string) => people !== undefined && next.trim().length > 2 && possibleDuplicates({ name: next }, entriesOf(people)).length > 0
  const changed = (next: string) => {
    setDraft(next)
    if (commit === 'change' && !resembles(next)) onChange(next === '' ? undefined : next)
  }
  // What was held — typed in a field that commits when it is left, or resembling somebody — is written now.
  const left = () => {
    if (draft.trim() !== text.trim()) onChange(draft.trim() ? draft : undefined)
    props.onBlur?.()
  }
  const inputId = props.inputTestId ?? (testId ? `${testId}-text` : undefined)
  return (
    <Box data-testid={testId} sx={{ display: 'grid', gap: 0.5 }}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: variant === 'standard' ? 'flex-end' : 'center' }}>
        <TextField
          variant={variant} size="small" fullWidth label={variant === 'standard' ? undefined : label}
          value={draft} disabled={disabled} required={required} error={props.error} helperText={props.helperText}
          placeholder={props.placeholder}
          onChange={(event) => changed(event.target.value)}
          onBlur={left}
          onKeyDown={(event) => { if (event.key === 'Enter' && commit === 'blur') left() }}
          slotProps={{ htmlInput: { 'aria-label': label, autoComplete: 'off', ...(inputId ? { 'data-testid': inputId } : {}) } }}
        />
        {access && people && !disabled && (
          <Button size="small" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setPicking(true)}
            // Going to the picker leaves what was typed unwritten: the picker starts from it.
            onMouseDown={(event) => event.preventDefault()}
            data-testid={testId ? `${testId}-pick` : undefined}>
            {s('people.fromRegister')}
          </Button>
        )}
      </Box>
      {!disabled && offered.length > 0 && (
        <Box data-testid={testId ? `${testId}-offered` : undefined} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.inRegister')}</Typography>
          {offered.map(({ person }) => (
            <Button
              key={person.id} size="small" sx={{ textTransform: 'none', minWidth: 0 }} onClick={() => pick(person.id)}
              // Pressing an entry leaves the field where it is: its text is not written first.
              onMouseDown={(event) => event.preventDefault()}
            >
              {shownText(shownEntry(person), s)}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  )
}
