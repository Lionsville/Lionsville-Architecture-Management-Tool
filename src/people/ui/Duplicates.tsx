// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The To review tab (ADR-0036 §9, as built in 3.6.1): the pairs in the register
 * that may be one person, strongest sign first, as a queue with the reason in a
 * column of its own so the two entries line up.
 *
 * - **A pair is one row**: the two people, each with what tells them apart — the
 *   first role today and how many more, the work address, *External*, and an
 *   account where a source with accounts says one is linked — and *Merge…* and
 *   *Not the same person*. The entry on the left is the one a merge keeps to
 *   start with: the one linked to an account, then the one with more assignments.
 * - **Under the table**, the pairs answered as not the same person, each with
 *   *Take back*.
 *
 * Each row is offered to whoever may merge the two, or answer about them
 * (`mayMerge`, `mayAnswer`), and offers only that.
 */
import { useState } from 'react'
import type { PersonId } from '../../model/person'
import { Button } from '../../widgets/kit/Button'
import { List } from '../../widgets/kit/List'
import type { DistinctPair } from '../distinct'
import type { DuplicatePair } from '../duplicates'
import type { Person } from '../person'
import { registerOf, resolvePerson, shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import { mayAnswer, mayMerge } from './access'
import type { PeopleRegisterAccess, Saying } from './access'
import { SIGN_LABEL } from './AddPerson'
import { rolesText, useDayWords } from './parts'
import type { RolesHeld } from './parts'

export type DuplicatesProps = {
  /** Every pair that may be one person, strongest sign first, the pairs answered left out (`duplicatePairs`). */
  pairs: readonly DuplicatePair[]
  register: PeopleRegisterAccess
  saying: Saying
  /** What each holds today; absent where the shell has no tree to read. */
  roles: ReadonlyMap<PersonId, RolesHeld> | undefined
  /** *Merge…*: the asks-first dialog, with the entry to keep chosen to start with and swappable. */
  onMerge: (keep: Person, drop: Person) => void
  s: Translate
}

/** The two of a pair in the order a merge keeps them to start with: an account first, then more assignments, then the pair's own. */
export function keptFirst(pair: Pick<DuplicatePair, 'keep' | 'drop'>, register: Pick<PeopleRegisterAccess, 'linked' | 'assignmentsOf'>): [Person, Person] {
  const weight = (person: Person) => [register.linked?.(person.id) ? 1 : 0, register.assignmentsOf?.(person.id).length ?? 0]
  const [keep, drop] = [weight(pair.keep), weight(pair.drop)]
  const swap = drop[0] > keep[0] || (drop[0] === keep[0] && drop[1] > keep[1])
  return swap ? [pair.drop, pair.keep] : [pair.keep, pair.drop]
}

/** The pairs that may be acted on here, and the answers that may be taken back. */
export function reviewable(pairs: readonly DuplicatePair[], register: PeopleRegisterAccess) {
  return {
    offered: pairs.filter((pair) => mayMerge(register, pair.keep.id, pair.drop.id) || mayAnswer(register, pair.keep.id, pair.drop.id)),
    answered: (register.distinct ?? []).filter((pair) => mayAnswer(register, pair.a, pair.b)),
  }
}

/** One of the two: what tells them apart. */
function Side({ person, register, roles, s }: {
  person: Person; register: PeopleRegisterAccess; roles: ReadonlyMap<PersonId, RolesHeld> | undefined; s: Translate
}) {
  const address = person.email ?? (register.withheld?.(person.id) ? s('people.emailWithheld') : s('people.noEmail'))
  const marks = [
    person.kind === 'external' ? s('people.kindExternal') : undefined,
    register.linked?.(person.id) ? s('people.account') : undefined,
  ].filter(Boolean)
  return (
    <div className="people-side">
      <span className="people-side__name">{shownText(shownEntry(person), s)}</span>
      {marks.length > 0 && <span className="people-quiet" data-testid="people-pair-marks"> · {marks.join(' · ')}</span>}
      {roles && <span className="people-side__line">{rolesText(roles.get(person.id) ?? [], s)}</span>}
      <span className="people-side__line">{address}</span>
    </div>
  )
}

function PairActions({ keep, drop, register, saying, onMerge, s }: Pick<DuplicatesProps, 'register' | 'saying' | 'onMerge' | 's'> & { keep: Person; drop: Person }) {
  const name = (person: Person) => shownText(shownEntry(person), s)
  const answer = () => {
    void saying.run(register.answerDistinct!(keep.id, drop.id), () => s('people.notSameDone', { one: name(keep), other: name(drop) }))
  }
  return (
    <div className="people-actions" data-testid={`people-pair-${keep.id}-${drop.id}`} data-guide="people.duplicatePair">
      {mayMerge(register, keep.id, drop.id) && (
        <Button size="small" onClick={() => onMerge(keep, drop)} data-testid="people-pair-merge" aria-label={s('people.mergePair', { one: name(keep), other: name(drop) })}>
          {s('people.mergeAsk')}
        </Button>
      )}
      {mayAnswer(register, keep.id, drop.id) && (
        <Button size="small" variant="quiet" onClick={answer} data-testid="people-pair-not-same" aria-label={s('people.notSamePair', { one: name(keep), other: name(drop) })}>
          {s('people.notSame')}
        </Button>
      )}
    </div>
  )
}

/** The pairs answered as not the same person, each with *Take back*, under the table. */
function Answered({ answered, register, saying, s }: {
  answered: readonly DistinctPair[]; register: PeopleRegisterAccess; saying: Saying; s: Translate
}) {
  const [open, setOpen] = useState(false)
  const dayWords = useDayWords()
  const held = registerOf(register.people ?? [])
  const named = (id: PersonId) => {
    const person = resolvePerson(id, held)
    return person ? shownText(shownEntry(person), s) : s('people.formerUnknown')
  }
  const takeBack = (pair: DistinctPair) => {
    const words = { one: named(pair.a), other: named(pair.b) }
    void saying.run(register.takeBackDistinct!(pair.a, pair.b), () => s('people.takenBack', words))
  }
  return (
    <div data-testid="people-answered" className="people-list">
      <Button
        variant="quiet" size="small" onClick={() => setOpen((was) => !was)} aria-expanded={open} aria-controls="people-answered-list"
        data-guide="people.answered" data-testid="people-answered-toggle"
      >
        {s(answered.length === 1 ? 'people.answeredOne' : 'people.answeredOther', { count: answered.length })}
      </Button>
      {open && (
        <ul id="people-answered-list" className="people-lines people-effects">
          {answered.map((pair) => (
            <li key={`${pair.a} ${pair.b}`} data-testid={`people-answered-${pair.a}-${pair.b}`} className="people-actions">
              <span>{s('people.answeredPair', { one: named(pair.a), other: named(pair.b) })}</span>
              <span className="people-quiet">{s('people.answeredOn', { day: dayWords(pair.on) })}</span>
              <Button
                size="small" onClick={() => takeBack(pair)} data-testid="people-take-back"
                aria-label={s('people.takeBackPair', { one: named(pair.a), other: named(pair.b) })}
              >
                {s('people.takeBack')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The queue and the answers given, each offered only to whoever may act on it. */
export function Duplicates({ pairs, register, saying, roles, onMerge, s }: DuplicatesProps) {
  const { offered, answered } = reviewable(pairs, register)
  return (
    <section data-testid="people-duplicates" data-guide="people.duplicates" aria-label={s('people.duplicates')}>
      {offered.length > 0 && <p className="people-note">{s('people.reviewLead')}</p>}
      {offered.length > 0 && (
        <div className="people-list">
          <List
            label={s('people.duplicates')} itemLabel={s('people.reviewWhy')}
            columns={[
              { id: 'one', label: s('people.reviewOne') }, { id: 'other', label: s('people.reviewOther') },
              { id: 'do', label: s('people.reviewDo'), width: '320px' },
            ]}
            groups={[{
              id: '', label: '',
              rows: offered.map((pair) => {
                const [keep, drop] = keptFirst(pair, register)
                return {
                  id: `${keep.id}|${drop.id}`,
                  text: s(SIGN_LABEL[pair.sign]),
                  cells: {
                    one: <Side person={keep} register={register} roles={roles} s={s} />,
                    other: <Side person={drop} register={register} roles={roles} s={s} />,
                    do: <PairActions keep={keep} drop={drop} register={register} saying={saying} onMerge={onMerge} s={s} />,
                  },
                }
              }),
            }]}
          />
        </div>
      )}
      {answered.length > 0 && <Answered answered={answered} register={register} saying={saying} s={s} />}
    </section>
  )
}
