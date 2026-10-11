// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Someone added to the register, after the four signs have been asked
 * (ADR-0036 §9): who is already there that this may be, each with *Use this
 * one*, before anyone is added. Adding anyway is allowed, and makes a second
 * entry a merge can join later.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { StringKey } from '../../i18n/table'
import type { PersonId } from '../../model/person'
import type { DuplicateSign } from '../duplicates'
import { possibleDuplicates } from '../duplicates'
import type { PersonKind } from '../person'
import { PERSON_KINDS } from '../person'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { KIND_LABEL } from './parts'

export const SIGN_LABEL: Record<DuplicateSign, StringKey> = {
  sameEmail: 'people.signSameEmail',
  sameName: 'people.signSameName',
  nearName: 'people.signNearName',
  familyAndInitial: 'people.signFamilyAndInitial',
}

export function AddPerson({ register, saying, onAdded, onUse, onCancel, s }: {
  register: PeopleRegisterAccess
  saying: Saying
  onAdded: (id: PersonId) => void
  /** Nobody added: the entry already there is the one meant. */
  onUse: (id: PersonId) => void
  onCancel: () => void
  s: Translate
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<PersonKind>('internal')
  const similar = useMemo(
    () => possibleDuplicates({ name, ...(email.trim() ? { email } : {}) }, register.people ?? []),
    [name, email, register.people],
  )
  const add = () => {
    void saying.run(register.add({ name, ...(email.trim() ? { email } : {}), kind }), () => s('people.addDone'))
      .then((added) => { if (added) onAdded(added.person.id) })
  }
  return (
    <Box data-testid="people-add-form" sx={{ display: 'grid', gap: 1 }}>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>{s('people.addTitle')}</Typography>
      <TextField size="small" label={s('people.name')} value={name} onChange={(event) => setName(event.target.value)} autoFocus
        slotProps={{ htmlInput: { 'data-testid': 'people-add-name' } }} />
      <TextField size="small" label={s('people.email')} value={email} onChange={(event) => setEmail(event.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'people-add-email' } }} />
      <TextField size="small" select label={s('people.kind')} value={kind} onChange={(event) => setKind(event.target.value as PersonKind)}>
        {PERSON_KINDS.map((one) => <MenuItem key={one} value={one}>{s(KIND_LABEL[one])}</MenuItem>)}
      </TextField>
      {similar.length > 0 ? (
        <Box data-testid="people-add-similar" sx={{ p: 1, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s('people.isItOne')}</Typography>
          {similar.map(({ person, sign }) => (
            <Box key={person.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 12 }}>
              <span>{shownText(shownEntry(person), s)} — {s(SIGN_LABEL[sign])}</span>
              <Button size="small" onClick={() => onUse(person.id)}>{s('people.useThis')}</Button>
            </Box>
          ))}
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.addAnywayNote')}</Typography>
        </Box>
      ) : name.trim().length > 2 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.noOneLike')}</Typography>}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={add} disabled={!name.trim()} data-testid="people-add-save">
          {s(similar.length > 0 ? 'people.addAnyway' : 'people.addSave')}
        </Button>
        <Button size="small" onClick={onCancel}>{s('people.cancel')}</Button>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.notAStep')}</Typography>
    </Box>
  )
}
