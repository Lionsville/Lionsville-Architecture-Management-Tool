// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Privacy tab (ADR-0036 §10): how long a leaver's name is kept, how long the
 * forgotten entry after that, and what an agent sees, with the periods drawn as
 * the three steps they are. A setting of the organisation's, not a step. Whoever
 * may not change it reads the same things as sentences, not as greyed fields.
 */
import { useEffect, useState } from 'react'
import { plural } from '../../i18n/strings'
import { Button } from '../../widgets/kit/Button'
import { SelectField, TextField } from '../../widgets/kit/Field'
import { AGENT_SEES } from '../policy'
import type { AgentSees, PeoplePolicy } from '../policy'
import type { Translate } from '../shown'
import { mayDo } from './access'
import type { PeopleRegisterAccess, Saying } from './access'

const SEES_LABEL = { names: 'people.agentsNames', pseudonyms: 'people.agentsPseudonyms' } as const
/** A choice starts with a capital, as every other choice does; the sentence that reads it back does not. */
const SEES_OPTION = { names: 'people.agentsNamesOption', pseudonyms: 'people.agentsPseudonymsOption' } as const

function days(text: string): number | undefined {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) && value >= 0 ? value : undefined
}

export function PolicyPanel({ register, saying, s }: { register: PeopleRegisterAccess; saying: Saying; s: Translate }) {
  const [keep, setKeep] = useState(String(register.policy.keepNameDays))
  const [remove, setRemove] = useState(String(register.policy.removeAfterDays))
  const [sees, setSees] = useState<AgentSees>(register.policy.agentsSee)
  const { policy } = register
  useEffect(() => {
    setKeep(String(policy.keepNameDays))
    setRemove(String(policy.removeAfterDays))
    setSees(policy.agentsSee)
  }, [policy])
  const change: Partial<PeoplePolicy> = {
    ...(days(keep) !== undefined ? { keepNameDays: days(keep) } : {}),
    ...(days(remove) !== undefined ? { removeAfterDays: days(remove) } : {}),
    agentsSee: sees,
  }
  const changed = change.keepNameDays !== policy.keepNameDays || change.removeAfterDays !== policy.removeAfterDays || sees !== policy.agentsSee
  const save = () => { void saying.run(register.setPolicy(change).then(() => ({})), () => s('people.policySaved')) }
  const daysWords = (count: number) => plural(s, { one: 'people.daysOne', other: 'people.daysOther' }, count)
  const kept = days(keep) ?? policy.keepNameDays
  const removed = days(remove) ?? policy.removeAfterDays
  const mayChange = mayDo(register, 'policy')
  return (
    <section className="people-policy" data-testid="people-policy" data-guide="people.policy" aria-label={s('people.policy')}>
      <h2 className="people-heading">{s('people.policy')}</h2>
      {mayChange ? (
        <>
          <TextField label={`${s('people.keepName')} (${s('people.days')})`} type="number" min={0} value={keep} onChange={setKeep} data-testid="people-keep" />
          <TextField label={`${s('people.removeAfter')} (${s('people.days')})`} type="number" min={0} value={remove} onChange={setRemove} data-testid="people-remove-after" />
        </>
      ) : (
        <p data-testid="people-policy-read">{s('people.policyRead', { keep: daysWords(policy.keepNameDays), remove: daysWords(policy.removeAfterDays) })}</p>
      )}
      <ol className="people-steps">
        <li className="people-steps__step"><span className="people-steps__label">{s('people.stepLeft')}</span>{s('people.stepLastDay')}</li>
        <li className="people-steps__step"><span className="people-steps__label">{s('people.stepForgotten')}</span>{s('people.stepPlus', { days: daysWords(kept) })}</li>
        <li className="people-steps__step"><span className="people-steps__label">{s('people.stepRemoved')}</span>{s('people.stepPlus', { days: daysWords(removed) })}</li>
      </ol>
      {mayChange ? (
        <>
          <SelectField
            label={s('people.agentsSee')} value={sees} onChange={(next) => setSees(next as AgentSees)}
            options={AGENT_SEES.map((one) => ({ value: one, label: s(SEES_OPTION[one]) }))}
          />
          <div><Button variant="primary" disabled={!changed} onClick={save} data-testid="people-policy-save">{s('people.save')}</Button></div>
        </>
      ) : <p>{s('people.agentsSeeRead', { sees: s(SEES_LABEL[policy.agentsSee]) })}</p>}
      <p className="people-note">{s('people.policyNote')}</p>
    </section>
  )
}
