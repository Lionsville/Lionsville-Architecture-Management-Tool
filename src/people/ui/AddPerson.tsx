// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Someone added to the register, after the four signs have been asked
 * (ADR-0036 §9): who is already there that this may be, each with what tells
 * them apart and *Use this one*, before anyone is added. Adding anyway is
 * allowed, and makes a second entry a merge can join later.
 *
 * The form alone, since a field that names a person shows it in place
 * (`PersonPicker`); the People page shows it in a question of its own.
 *
 * **Not a `<form>`.** It is drawn inside forms of its own — the vacancy's popover
 * and the assignment's question — and a form in a form is submitted by the
 * browser, not by React: the page was loaded afresh, and a visit to the example
 * with it. Enter in a field adds, and goes no further, so the form around it is
 * not answered by the same key.
 */
import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { StringKey } from '../../i18n/table'
import type { PersonId } from '../../model/person'
import { Button } from '../../widgets/kit/Button'
import { SelectField, TextField } from '../../widgets/kit/Field'
import type { DuplicateSign } from '../duplicates'
import { possibleDuplicates } from '../duplicates'
import { rolesOn } from '../hold'
import type { Person, PersonKind } from '../person'
import { PERSON_KINDS } from '../person'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { KIND_LABEL, rolesText } from './parts'

export const SIGN_LABEL: Record<DuplicateSign, StringKey> = {
  sameEmail: 'people.signSameEmail',
  sameName: 'people.signSameName',
  nearName: 'people.signNearName',
  familyAndInitial: 'people.signFamilyAndInitial',
}

/** What tells one entry from another of the same name: what they hold, and the address. */
export function tellsApart(person: Person, register: Pick<PeopleRegisterAccess, 'assignmentsOf' | 'today' | 'withheld'>, s: Translate): string {
  const roles = register.assignmentsOf ? rolesText(rolesOn(register.assignmentsOf(person.id), register.today), s) : undefined
  const address = person.email ?? (register.withheld?.(person.id) ? s('people.emailWithheld') : s('people.noEmail'))
  return [roles, address].filter(Boolean).join(' · ')
}

export function AddPerson({ register, saying, onAdded, onUse, onCancel, initialName, s }: {
  register: PeopleRegisterAccess
  saying: Saying
  onAdded: (id: PersonId) => void
  /** Nobody added: the entry already there is the one meant. */
  onUse: (id: PersonId) => void
  onCancel: () => void
  /** A name already typed where the person was asked for. */
  initialName?: string
  s: Translate
}) {
  const [name, setName] = useState(initialName?.trim() ?? '')
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<PersonKind>('internal')
  const similar = useMemo(
    () => possibleDuplicates({ name, ...(email.trim() ? { email } : {}) }, register.people ?? []),
    [name, email, register.people],
  )
  const add = () => {
    void saying.run(register.add({ name, ...(email.trim() ? { email } : {}), kind }), (added) => {
      onAdded(added.person.id)
      return s('people.addDone')
    })
  }
  const onEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    event.stopPropagation()
    // The register has no undo: with somebody like this already there, Enter takes them, and adding anyway is a press.
    const first = similar[0]
    if (first) onUse(first.person.id)
    else if (name.trim()) add()
  }
  return (
    <div role="group" aria-label={s('people.add')} className="people-stack" data-testid="people-add-form" onKeyDown={onEnter}>
      <TextField label={s('people.name')} value={name} onChange={setName} autoFocus data-testid="people-add-name" />
      <TextField label={s('people.email')} value={email} onChange={setEmail} data-testid="people-add-email" />
      <SelectField
        label={s('people.kind')} value={kind} onChange={(next) => setKind(next as PersonKind)}
        options={PERSON_KINDS.map((one) => ({ value: one, label: s(KIND_LABEL[one]) }))}
      />
      {similar.length > 0 ? (
        <div className="people-warn" data-testid="people-add-similar">
          <p className="people-warn__title">{s('people.isItOne')}</p>
          <div className="people-lines">
            {similar.map(({ person, sign }, at) => (
              <div key={person.id} className="people-actions">
                <span>
                  {shownText(shownEntry(person), s)} · {tellsApart(person, register, s)}
                  <span className="people-quiet"> · {s(SIGN_LABEL[sign])}</span>
                </span>
                <Button size="small" variant={at === 0 ? 'primary' : 'plain'} onClick={() => onUse(person.id)}>{s('people.useThis')}</Button>
              </div>
            ))}
          </div>
          <p className="people-note">{s('people.addAnywayNote')}</p>
        </div>
      ) : name.trim().length > 2 && <p className="people-note">{s('people.noOneLike')}</p>}
      <p className="people-note">{s('people.notAStep')}</p>
      {/* The dialogs' order: Cancel, then what it is for, at the end; adding anyway is no longer the default where a match shows. */}
      <div className="people-actions people-actions--end">
        <Button onClick={onCancel}>{s('people.cancel')}</Button>
        <Button variant={similar.length > 0 ? 'plain' : 'primary'} disabled={!name.trim()} onClick={add} data-testid="people-add-save">
          {s(similar.length > 0 ? 'people.addAnyway' : 'people.addSave')}
        </Button>
      </div>
    </div>
  )
}
