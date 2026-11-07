// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the register asks before a change it cannot undo (ADR-0036, amended 7
 * November 2026): the title says the act, the body the effect with the facts the
 * page already has, the button the outcome.
 *
 * - **Mark as left** names the last day, each role that ends, any vacancy that
 *   opens, and the dates a name is forgotten and an entry removed, and says it can
 *   be taken back until then.
 * - **Take back the leaving** has the entry active again, with what leaving ended
 *   restored by steps.
 * - **Forget** counts the roles it ends and the records that show the pseudonym,
 *   and says what it does not reach, with a way to see them.
 * - **Merge** sets the two entries side by side with what tells them apart, so two
 *   people of one name can be told apart, and asks which stays; somebody active
 *   going into an entry that has left is asked which is true (`MergeLeaving.tsx`).
 */
import { useMemo, useState } from 'react'
import { plural } from '../../i18n/strings'
import { addDays } from '../../model/transition'
import { Button } from '../../widgets/kit/Button'
import { Dialog, DialogChoices, DialogDanger } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { Picker } from '../../widgets/kit/Picker'
import { heldOn, keptName, leavingOn, vacancyOf } from '../hold'
import type { MergeLeaving, Person } from '../person'
import { entriesOf, mergeAsks } from '../person'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess, Saying } from './access'
import { tellsApart } from './AddPerson'
import { keptFirst } from './Duplicates'
import { mergeLeavingFirst, MergeLeavingChoice } from './MergeLeaving'
import { useDayWords } from './parts'
import { usePointsAt } from './PersonReader'
import { useMentions } from './WhatWeHold'

export type Question =
  | { kind: 'leave'; person: Person }
  | { kind: 'takeBack'; person: Person }
  | { kind: 'forget'; person: Person }
  | { kind: 'remove'; person: Person }
  /** Merge from a person: whom with, and then the two side by side. */
  | { kind: 'mergePick'; person: Person }
  | { kind: 'merge'; one: Person; other: Person }

type Asked = { register: PeopleRegisterAccess; saying: Saying; onClose: () => void; s: Translate }

const name = (person: Person, s: Translate) => shownText(shownEntry(person), s)

function Leave({ person, day, register, saying, onClose, s }: Asked & { person: Person; day: string }) {
  const dayWords = useDayWords()
  const [lastDay, setLastDay] = useState(day)
  const held = useMemo(() => register.assignmentsOf?.(person.id) ?? [], [register, person.id])
  const others = useMemo(
    () => entriesOf(register.people ?? []).filter((one) => one.id !== person.id).flatMap((one) => register.assignmentsOf?.(one.id) ?? []),
    [register, person.id],
  )
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(lastDay)
  const { later } = leavingOn(held, lastDay)
  const ending = held.filter((one) => !(one.from !== undefined && one.from > lastDay) && (one.until === undefined || one.until > lastDay))
  const forgets = valid ? addDays(lastDay, register.policy.keepNameDays) : ''
  const removes = valid ? addDays(forgets, register.policy.removeAfterDays) : ''
  const leave = () => {
    void saying.run(register.leave(person.id, lastDay), (left) => s('people.leftDone', {
      name: name(left.person, s), day: dayWords(lastDay), forget: dayWords(forgets), count: left.ended,
    }))
    onClose()
  }
  return (
    <Dialog
      open size="m" title={s('people.leaveTitle', { name: name(person, s) })} onClose={onClose} onSubmit={leave}
      actions={(
        <>
          <Button onClick={onClose}>{s('people.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={!valid} data-testid="people-leave-confirm">{s('people.markLeft')}</Button>
        </>
      )}
    >
      <div className="people-stack">
        <TextField label={s('people.lastDay')} type="date" value={lastDay} onChange={setLastDay} autoFocus data-testid="people-last-day" />
        <div>
          <p className="people-heading">{s('people.leaveEffects')}</p>
          <ul className="people-effects" data-testid="people-leave-effects">
            {register.assignmentsOf && (
              <li>
                {ending.length === 0 ? s('people.leaveEndsNone') : plural(s, { one: 'people.leaveEndsOne', other: 'people.leaveEndsOther' }, ending.length, { roles: ending.map((one) => s('people.heldIn', { role: one.role, unit: one.unit })).join(', ') })}
                {valid && ending.filter((one) => vacancyOf(one, others, lastDay)).map((one) => (
                  <span key={one.id} data-testid="people-leave-vacancy"> {s('people.leaveVacancy', { unit: one.unit, role: one.role })}</span>
                ))}
              </li>
            )}
            {later > 0 && <li>{s(later === 1 ? 'people.mergeLeftLaterOne' : 'people.mergeLeftLaterOther', { count: later, day: dayWords(lastDay) })}</li>}
            {valid && <li>{s('people.leaveForgets', { day: dayWords(forgets) })}</li>}
            {valid && <li>{s('people.leaveRemoves', { day: dayWords(removes) })}</li>}
          </ul>
        </div>
        <p className="people-note">{s('people.leaveBack')}</p>
      </div>
    </Dialog>
  )
}

function TakeBack({ person, register, saying, onClose, s }: Asked & { person: Person }) {
  const dayWords = useDayWords()
  const words = { name: name(person, s), day: dayWords(person.leftOn) }
  const back = () => {
    void saying.run(register.takeBackLeaving!(person.id), (done) => s('people.takenBackDone', { ...words, count: done.restored }))
    onClose()
  }
  return (
    <Dialog
      open size="s" title={s('people.takeBackTitle', words)} onClose={onClose}
      actions={(
        <>
          <Button onClick={onClose}>{s('people.cancel')}</Button>
          <Button variant="primary" onClick={back} data-testid="people-take-back-confirm">{s('people.takeBackLeaving')}</Button>
        </>
      )}
    >
      <p>{s('people.takeBackBody', words)}</p>
    </Dialog>
  )
}

function Forget({ person, register, saying, onClose, s }: Asked & { person: Person }) {
  const [showing, setShowing] = useState(false)
  const found = usePointsAt(person.id, register)
  const mentions = useMentions(person.name, register)
  const shown = name(person, s)
  const words = { name: shown, pseudonym: s('people.former', { code: person.pseudonym }) }
  const ending = person.state === 'active' ? heldOn(register.assignmentsOf?.(person.id) ?? [], register.today).now : []
  const pointing = found ? found.pointers.filter((one) => !keptName(one)).length : undefined
  const signed = found ? found.pointers.filter(keptName).length : 0
  const forget = () => {
    void saying.run(register.forget(person.id, register.today), () => s('people.forgetDone', words))
    onClose()
  }
  return (
    <Dialog
      open size="m" title={s('people.forgetTitle', words)} onClose={onClose}
      actions={(
        <>
          <Button onClick={onClose}>{s('people.cancel')}</Button>
          <Button variant="danger" onClick={forget} data-testid="people-forget-confirm">{s('people.forgetName', words)}</Button>
        </>
      )}
    >
      <div className="people-stack">
        <p>{s('people.forgetBody', words)}</p>
        <ul className="people-effects" data-testid="people-forget-effects">
          {ending.length > 0 && <li>{plural(s, { one: 'people.forgetEndsOne', other: 'people.forgetEndsOther' }, ending.length, { roles: ending.map((one) => s('people.heldIn', { role: one.role, unit: one.unit })).join(', ') })}</li>}
          {pointing !== undefined && pointing > 0 && <li>{plural(s, { one: 'people.forgetPointsOne', other: 'people.forgetPointsOther' }, pointing)}</li>}
          {mentions !== undefined && mentions.length > 0 && (
            <li>
              {plural(s, { one: 'people.forgetTypedOne', other: 'people.forgetTypedOther' }, mentions.length)}{' '}
              <button type="button" className="people-link" aria-expanded={showing} onClick={() => setShowing((was) => !was)} data-testid="people-forget-find">{s('people.findThem')}</button>
              {showing && (
                <ul className="people-effects">
                  {mentions.map((one) => <li key={`${one.scope}/${one.kind}/${one.id}`}>{one.title} · {one.scope || s('common.organisation')}</li>)}
                </ul>
              )}
            </li>
          )}
          {signed > 0 && <li>{s('people.forgetSigned')}</li>}
        </ul>
        <DialogDanger title={s('people.forgetFinal')} />
      </div>
    </Dialog>
  )
}

function Remove({ person, register, saying, onClose, s }: Asked & { person: Person }) {
  const remove = () => {
    void saying.run(register.remove(person.id), () => s('people.removeDone'))
    onClose()
  }
  return (
    <Dialog
      open size="s" title={s('people.removeTitle', { pseudonym: name(person, s) })} onClose={onClose}
      actions={(
        <>
          <Button onClick={onClose}>{s('people.cancel')}</Button>
          <Button variant="danger" onClick={remove} data-testid="people-remove-confirm">{s('people.remove')}</Button>
        </>
      )}
    >
      <DialogDanger title={s('people.removeBody')} />
    </Dialog>
  )
}

/** Whom to merge with: the one picker, searched, with what tells people apart. */
function MergePick({ person, register, onPicked, onClose, s }: Asked & { person: Person; onPicked: (other: Person) => void }) {
  const others = entriesOf(register.people ?? []).filter((one) => one.id !== person.id && one.state !== 'forgotten')
  const options = others
    .map((one) => ({ id: one.id, label: name(one, s), detail: tellsApart(one, register, s) }))
    .sort((one, other) => one.label.localeCompare(other.label))
  return (
    <Dialog
      open size="m" title={s('people.mergePickTitle', { name: name(person, s) })} onClose={onClose}
      actions={<Button onClick={onClose}>{s('people.cancel')}</Button>}
    >
      <div className="people-stack">
        <div data-testid="people-merge-pick">
          <Picker
            label={s('people.mergePickLabel')} options={options} autoFocus
            onPick={(option) => { const other = others.find((one) => one.id === option.id); if (other) onPicked(other) }}
          />
        </div>
        <p className="people-note">{s('people.mergePickNote')}</p>
      </div>
    </Dialog>
  )
}

/** What a card in the merge says: what they hold, their address, an account, and how many records name them. */
function useCardWords(person: Person, register: PeopleRegisterAccess, s: Translate): string {
  const found = usePointsAt(person.id, register)
  const named = found ? found.pointers.length + found.byRule.length : undefined
  return [
    tellsApart(person, register, s),
    register.linked?.(person.id) ? s('people.account') : undefined,
    named === undefined ? undefined : named === 0 ? s('people.namedOnNothing') : plural(s, { one: 'people.namedOnOne', other: 'people.namedOnOther' }, named),
  ].filter(Boolean).join(' · ')
}

function Merge({ one, other, register, saying, onClose, s }: Asked & { one: Person; other: Person }) {
  const dayWords = useDayWords()
  const [first, second] = useMemo(() => keptFirst({ keep: one, drop: other }, register), [one, other, register])
  const [keptId, setKeptId] = useState(first.id)
  const [answered, setAnswered] = useState<MergeLeaving | undefined>(undefined)
  const into = keptId === first.id ? first : second
  const from = keptId === first.id ? second : first
  const firstWords = useCardWords(first, register, s)
  const secondWords = useCardWords(second, register, s)
  const absorbed = register.assignmentsOf?.(from.id) ?? []
  const asks = mergeAsks(from, into) && into.leftOn !== undefined
  const answer = asks ? answered ?? mergeLeavingFirst(absorbed, into.leftOn!) : undefined
  const words = { drop: name(from, s), keep: name(into, s) }
  const merge = () => {
    void saying.run(register.merge(from.id, into.id, answer), (merged) => {
      if (answer === 'stillHere') return s('people.mergeDoneHere', words)
      if (answer === 'left') return s('people.mergeDoneLeft', { ...words, count: merged.ended, day: dayWords(into.leftOn) })
      return s('people.mergeDone', words)
    })
    onClose()
  }
  const sameName = name(first, s) === name(second, s)
  return (
    <Dialog
      open size="m" title={sameName ? s('people.mergeWhichNamed', { name: name(first, s) }) : s('people.mergeWhich')} onClose={onClose}
      actions={(
        <>
          <Button onClick={onClose}>{s('people.cancel')}</Button>
          <Button variant="primary" onClick={merge} data-testid="people-merge-confirm">
            {s(answer === 'stillHere' ? 'people.mergeConfirmHere' : answer === 'left' ? 'people.mergeConfirmLeft' : 'people.mergeConfirm')}
          </Button>
        </>
      )}
    >
      <div className="people-stack" data-testid="people-merge">
        <DialogChoices
          label={s('people.mergeKeep')} value={keptId} onChange={(id) => { setKeptId(id); setAnswered(undefined) }}
          options={[
            { value: first.id, label: name(first, s), effect: firstWords },
            { value: second.id, label: name(second, s), effect: secondWords },
          ]}
        />
        <p className="people-note">{s('people.mergeBody', words)}</p>
        {from.email && from.email !== into.email && <p className="people-note" data-testid="people-merge-address">{s('people.mergeAddress', { address: from.email })}</p>}
        {asks && answer && (
          <MergeLeavingChoice drop={words.drop} keep={words.keep} leftOn={into.leftOn!} held={absorbed} value={answer} onChange={setAnswered} s={s} />
        )}
        <DialogDanger title={s('people.mergeFinal')} />
      </div>
    </Dialog>
  )
}

export function PersonQuestion({ question, day, register, saying, onAsk, onClose, s }: Asked & {
  question: Question | undefined
  /** The day the page reads: what a last day starts from. */
  day: string
  onAsk: (next: Question) => void
}) {
  if (!question) return null
  const asked = { register, saying, onClose, s }
  switch (question.kind) {
    case 'leave': return <Leave {...asked} person={question.person} day={day} />
    case 'takeBack': return <TakeBack {...asked} person={question.person} />
    case 'forget': return <Forget {...asked} person={question.person} />
    case 'remove': return <Remove {...asked} person={question.person} />
    case 'mergePick': return <MergePick {...asked} person={question.person} onPicked={(other) => onAsk({ kind: 'merge', one: question.person, other })} />
    default: return <Merge key={`${question.one.id}|${question.other.id}`} {...asked} one={question.one} other={question.other} />
  }
}
