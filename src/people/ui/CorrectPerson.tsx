// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The correction: a name, an address, a kind — and who it may then be the same
 * person as, by the four signs, but nobody this entry was answered as not being
 * (`people/distinct.ts`). A warning, never a refusal. It asks and is not pressed to
 * edit, because the register has no undo.
 */
import { useMemo, useState } from 'react'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { possibleDuplicates } from '../duplicates'
import type { Person, PersonKind } from '../person'
import { PERSON_KINDS } from '../person'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { SIGN_LABEL } from './AddPerson'
import { KIND_LABEL } from './parts'

export function CorrectPerson({ person, register, saying, onClose, s }: {
  person: Person; register: PeopleRegisterAccess; saying: Saying; onClose: () => void; s: Translate
}) {
  const [name, setName] = useState(person.name ?? '')
  const [email, setEmail] = useState(person.email ?? '')
  const [kind, setKind] = useState<PersonKind>(person.kind)
  const similar = useMemo(
    () => possibleDuplicates({ name, ...(email.trim() ? { email } : {}) }, register.people ?? [], person.id, register.distinct),
    [name, email, register.people, register.distinct, person.id],
  )
  const save = () => {
    void saying.run(register.change(person.id, { name, email: email.trim() ? email : null, kind }), () => s('people.saved'))
      .then((done) => { if (done) onClose() })
  }
  return (
    <Dialog
      open size="m" title={s('people.correctTitle', { name: shownText(shownEntry(person), s) })} onClose={onClose} onSubmit={save}
      actions={(
        <>
          <Button onClick={onClose}>{s('people.cancel')}</Button>
          <Button variant="primary" type="submit" data-testid="people-correct-save">{s('people.save')}</Button>
        </>
      )}
    >
      <div className="people-stack">
        <TextField label={s('people.name')} value={name} onChange={setName} autoFocus data-testid="people-correct-name" />
        <TextField label={s('people.email')} value={email} onChange={setEmail} data-testid="people-correct-email" />
        <SelectField
          label={s('people.kind')} value={kind} onChange={(next) => setKind(next as PersonKind)}
          options={PERSON_KINDS.map((one) => ({ value: one, label: s(KIND_LABEL[one]) }))}
        />
        {similar.length > 0 && (
          <div className="people-warn" data-testid="people-correct-similar">
            <p className="people-warn__title">{s('people.correctSimilar')}</p>
            {similar.map(({ person: other, sign }) => (
              <span key={other.id} className="people-line">{shownText(shownEntry(other), s)} · {s(SIGN_LABEL[sign])}</span>
            ))}
            <p className="people-note">{s('people.correctSimilarNote')}</p>
          </div>
        )}
        <p className="people-note">{s('people.notAStep')}</p>
      </div>
    </Dialog>
  )
}
