// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A person picked from the register, wherever one is asked for (ADR-0036 §9):
 * a slot on a unit, an assignment corrected, and every field that names a
 * person (`PersonRefField`).
 *
 * It searches the register as it is, the people still with the organisation
 * first, and marks *you*. Nobody new is added without the four signs being
 * asked first: *New person…* is the People page's own form (`AddPerson`), so
 * a name that may already be in the register is offered before a second entry
 * is made, and adding anyway is the person's choice. What is picked is an id;
 * the name is the register's.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { matchesQuery } from '../../model/textSearch'
import type { PersonId } from '../../model/person'
import { entriesOf } from '../person'
import type { Person } from '../person'
import { registerOf, resolvePerson, shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { AddPerson } from './AddPerson'

/** How many matches the list shows: a picker, not the People page. */
const SHOWN = 8

export type PersonPickerProps = {
  register: PeopleRegisterAccess
  saying: Saying
  value: PersonId | undefined
  onChange: (id: PersonId | undefined) => void
  /** Said beside a name: what the person holds already, say. */
  note?: (person: Person) => string | undefined
  /** What the search starts with: a name already typed into the field it picks for. */
  initialQuery?: string
  s: Translate
}

/** The active entries a query matches, by name; everybody active where there is no query. */
export function pickable(people: readonly Person[], query: string): Person[] {
  return entriesOf(people)
    .filter((person) => person.state === 'active' && matchesQuery(query, [person.name, person.email]))
    .sort((one, other) => (one.name ?? '').localeCompare(other.name ?? ''))
}

export function PersonPicker({ register, saying, value, onChange, note, initialQuery, s }: PersonPickerProps) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [adding, setAdding] = useState(false)
  const people = useMemo(() => register.people ?? [], [register.people])
  const found = useMemo(() => pickable(people, query), [people, query])
  const picked = value === undefined ? undefined : resolvePerson(value, registerOf(people))
  const pick = (id: PersonId) => {
    onChange(id)
    setAdding(false)
    setQuery('')
  }
  if (adding) {
    return <AddPerson register={register} saying={saying} onAdded={pick} onUse={pick} onCancel={() => setAdding(false)} initialName={query} s={s} />
  }
  return (
    <Box data-testid="person-picker" sx={{ display: 'grid', gap: 0.75 }}>
      {picked && (
        <Box>
          <Chip
            size="small" color="primary" data-testid="person-picked"
            label={`${shownText(shownEntry(picked), s)}${picked.id === register.me ? ` · ${s('people.you')}` : ''}`}
            onDelete={() => onChange(undefined)}
          />
        </Box>
      )}
      <TextField
        size="small" label={s('people.search')} value={query} onChange={(event) => setQuery(event.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'person-picker-search' } }}
      />
      <Box sx={{ display: 'grid', maxHeight: 220, overflowY: 'auto' }}>
        {found.slice(0, SHOWN).map((person) => (
          <Button
            key={person.id} size="small" onClick={() => pick(person.id)} data-testid={`person-pick-${person.id}`}
            sx={{ justifyContent: 'space-between', textTransform: 'none', fontWeight: person.id === value ? 700 : 400 }}
          >
            <span>{shownText(shownEntry(person), s)}{person.id === register.me ? ` · ${s('people.you')}` : ''}</span>
            {note?.(person) && <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{note(person)}</Typography>}
          </Button>
        ))}
        {found.length === 0 && query.trim() && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.searchEmpty', { query })}</Typography>
        )}
      </Box>
      {!register.readOnly && (
        <Button size="small" variant="outlined" onClick={() => setAdding(true)} data-testid="person-picker-new">
          {s('people.newPerson')}
        </Button>
      )}
    </Box>
  )
}
