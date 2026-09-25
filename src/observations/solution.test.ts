// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { Analysis, Cause, Observation } from './observation'
import {
  addressCause, alternatives, concludeExperiment, decisionContext, defaultStrength, dropSolution, experimentsFor,
  forgetCause, formatExperimentNumber, formatSolutionNumber, implementedOn, linkRecord, moveSolution, newExperiment,
  newSolution, nextExperimentNumber, nextSolutionNumber, openItems, planExperiment, removeSolution, restoreSolution,
  rootsWithoutSolution, seenSinceImplemented, solutionGate, solutionPhase, solutionQuestions, unaddressCause,
  underneath, updateExperiment, updateSolution, waiveExperiment,
} from './solution'
import type { Experiment, Solution, SolutionContext, SolutionPlan } from './solution'

const t = translator('en')

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Estimate differs per channel', date: '2026-06-01', impact: 'major', seen: 1, body: '',
  history: [{ date: '2026-06-01', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Two systems compute it', state: 'verified', body: '', explains: [], ...over,
})
const solution = (over: Partial<Solution>): Solution => ({
  id: 's1', number: 1, title: 'One estimate service', state: 'idea', addresses: [], validatedWith: [], attempts: [],
  body: '', history: [{ date: '2026-07-01', kind: 'proposed' }], ...over,
})
const experiment = (over: Partial<Experiment>): Experiment => ({
  id: 'e1', number: 1, title: 'Two weeks at one desk', tests: ['s1'], hypothesis: 'Calls halve', outcome: 'planned',
  body: '', ...over,
})

/** A direct cause c1 under a root c2; two observations under c1. */
const analysis: Analysis = {
  observations: [observation({}), observation({ id: 'o2', number: 2 })],
  causes: [
    cause({ explains: [{ id: 'o1', strength: 'strong' }, { id: 'o2', strength: 'normal' }] }),
    cause({ id: 'c2', number: 2, title: 'Nobody owns the data', explains: [{ id: 'c1', strength: 'strong' }] }),
  ],
}

const context = (over: Partial<SolutionContext> = {}): SolutionContext => ({
  causes: analysis.causes, experiments: [], decisions: [], plans: [], ...over,
})

/** Everything the idea gate asks, answered. */
const vetted = solution({
  addresses: [{ id: 'c2', strength: 'strong' }], benefit: 'large', cost: 'small', validatedWith: ['Operations'],
  noneKnown: true,
})

describe('numbering', () => {
  it('formats as SO- and EX- with four digits, one past the highest', () => {
    expect(formatSolutionNumber(3)).toBe('SO-0003')
    expect(formatExperimentNumber(12)).toBe('EX-0012')
    expect(nextSolutionNumber([solution({ number: 4 }), solution({ id: 's2', number: 2 })])).toBe(5)
    expect(nextExperimentNumber([])).toBe(1)
  })
})

describe('a new record', () => {
  it('is an idea with a proposed event and the template', () => {
    const fresh = newSolution({ id: 'x', number: 1, title: '  Own the data ', date: '2026-09-24', t, addresses: [{ id: 'c2', strength: 'strong' }] })
    expect(fresh.title).toBe('Own the data')
    expect(fresh.state).toBe('idea')
    expect(fresh.history).toEqual([{ date: '2026-09-24', kind: 'proposed' }])
    expect(fresh.body).toContain('## Costs and benefits')
    expect(fresh.addresses).toEqual([{ id: 'c2', strength: 'strong' }])
  })
  it('links strong to a root and normal to a cause that has a cause of its own', () => {
    expect(defaultStrength('c2', analysis.causes)).toBe('strong')
    expect(defaultStrength('c1', analysis.causes)).toBe('normal')
  })
  it('starts an experiment planned, keeping only the fields that were said', () => {
    const fresh = newExperiment({ id: 'e', number: 1, title: 'Trial', tests: ['s1', 's1'], hypothesis: ' It halves ', t, where: ' ', by: 'Desk 3' })
    expect(fresh).toMatchObject({ outcome: 'planned', tests: ['s1'], hypothesis: 'It halves', by: 'Desk 3' })
    expect(fresh).not.toHaveProperty('where')
  })
})

describe('editing', () => {
  it('trims names, drops blanks and empty attempts, and removes a blank why-now', () => {
    const [one] = updateSolution([solution({ whyNow: 'was' })], 's1', {
      validatedWith: [' Ops ', '', 'Ops'], attempts: [{ what: ' ', why: '' }, { when: '2023', what: 'A sync', why: 'Lagged' }], whyNow: ' ',
    })
    expect(one.validatedWith).toEqual(['Ops'])
    expect(one.attempts).toEqual([{ when: '2023', what: 'A sync', why: 'Lagged' }])
    expect(one).not.toHaveProperty('whyNow')
  })
  it('clears a size and the none-known flag when told to', () => {
    const [one] = updateSolution([vetted], 's1', { benefit: undefined, noneKnown: false })
    expect(one).not.toHaveProperty('benefit')
    expect(one).not.toHaveProperty('noneKnown')
  })
  it('addresses a cause once, changing the strength the second time, and unaddresses it', () => {
    let list = addressCause([solution({})], 's1', { id: 'c1', strength: 'weak' })
    list = addressCause(list, 's1', { id: 'c1', strength: 'strong' })
    expect(list[0].addresses).toEqual([{ id: 'c1', strength: 'strong' }])
    expect(unaddressCause(list, 's1', 'c1')[0].addresses).toEqual([])
    expect(forgetCause(list, 'c1')[0].addresses).toEqual([])
  })
  it('links a decision once, with an event', () => {
    const once = linkRecord([solution({})], 's1', 'decision', 'adr1', '2026-09-24')
    expect(once[0].decision).toBe('adr1')
    expect(linkRecord(once, 's1', 'decision', 'adr1', '2026-09-25')[0].history).toHaveLength(2)
  })
})

describe('the idea gate', () => {
  it('lists every item open on a bare idea', () => {
    expect(openItems(solutionGate(solution({}), context()))).toEqual(
      ['addresses', 'benefit', 'cost', 'validatedWith', 'triedBefore'])
  })
  it('is clear once each is said', () => {
    expect(solutionGate(vetted, context())).toMatchObject({ to: 'shaped' })
    expect(openItems(solutionGate(vetted, context()))).toEqual([])
  })
  it('asks why now once there is an earlier attempt, and not before', () => {
    const tried = { ...vetted, noneKnown: undefined, attempts: [{ what: 'A sync', why: 'Lagged' }] }
    expect(openItems(solutionGate(tried, context()))).toEqual(['whyNow'])
    expect(openItems(solutionGate({ ...tried, whyNow: 'It is live now' }, context()))).toEqual([])
  })
})

describe('moving', () => {
  const day = '2026-09-24'
  it('goes forward one step when the gate is clear, with an event', () => {
    const result = moveSolution([vetted], 's1', 'shaped', day, context())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.solutions[0].state).toBe('shaped')
      expect(result.solutions[0].history.at(-1)).toEqual({ date: day, kind: 'moved', to: 'shaped' })
    }
  })
  it('refuses forward with the open items named', () => {
    expect(moveSolution([solution({})], 's1', 'shaped', day, context())).toMatchObject({ ok: false, refusal: 'gate' })
  })
  it('refuses two steps at once, and a solution that is not there', () => {
    expect(moveSolution([vetted], 's1', 'testing', day, context())).toMatchObject({ ok: false, refusal: 'notAdjacent' })
    expect(moveSolution([vetted], 'nope', 'shaped', day, context())).toMatchObject({ ok: false, refusal: 'missing' })
    expect(moveSolution([{ ...vetted, state: 'dropped' }], 's1', 'shaped', day, context())).toMatchObject({ refusal: 'notAdjacent' })
  })
  it('needs an experiment that is planned, running or confirmed to start testing', () => {
    const shaped = { ...vetted, state: 'shaped' as const }
    expect(moveSolution([shaped], 's1', 'testing', day, context())).toMatchObject({ ok: false, open: ['experimentPlanned'] })
    const running = context({ experiments: [experiment({ outcome: 'running' })] })
    expect(moveSolution([shaped], 's1', 'testing', day, running).ok).toBe(true)
    const confirmed = context({ experiments: [experiment({ outcome: 'confirmed' })] })
    expect(moveSolution([shaped], 's1', 'testing', day, confirmed).ok).toBe(true)
    const refuted = context({ experiments: [experiment({ outcome: 'refuted' })] })
    expect(moveSolution([shaped], 's1', 'testing', day, refuted).ok).toBe(false)
  })
  it('moves every shaped solution an experiment tests on to testing when it is planned, and no other', () => {
    const shaped = { ...vetted, state: 'shaped' as const }
    const idea = solution({ id: 's2', number: 2 })
    const proven = { ...vetted, id: 's3', number: 3, state: 'proven' as const }
    const trial = experiment({ tests: ['s1', 's2', 's3'] })
    const work = planExperiment({ solutions: [shaped, idea, proven], experiments: [] }, trial, day)
    expect(work.experiments).toEqual([trial])
    expect(work.solutions.map((one) => one.state)).toEqual(['testing', 'idea', 'proven'])
    expect(work.solutions[0].history.at(-1)).toEqual({ date: day, kind: 'moved', to: 'testing' })
    expect(work.solutions[1]).toBe(idea)
    expect(work.solutions[2]).toBe(proven)
  })
  it('needs a confirmed experiment, or a waiver, to be proven', () => {
    const testing = { ...vetted, state: 'testing' as const }
    expect(moveSolution([testing], 's1', 'proven', day, context()).ok).toBe(false)
    expect(moveSolution([testing], 's1', 'proven', day, context({ experiments: [experiment({ outcome: 'confirmed' })] })).ok).toBe(true)
    const waived = waiveExperiment([testing], 's1', 'An appointment is not trialled', day)
    expect(waived[0].history.at(-1)).toMatchObject({ kind: 'waived' })
    expect(moveSolution(waived, 's1', 'proven', day, context()).ok).toBe(true)
  })
  it('refuses a waiver without a reason, and takes one back with a blank', () => {
    const testing = { ...vetted, state: 'testing' as const }
    expect(waiveExperiment([testing], 's1', '  ', day)[0]).toBe(testing)
    const waived = waiveExperiment([testing], 's1', 'Why', day)
    expect(waiveExperiment(waived, 's1', '', day)[0]).not.toHaveProperty('waived')
  })
  it('needs an accepted decision record to be adopted', () => {
    const proven = { ...vetted, state: 'proven' as const, decision: 'adr1' }
    expect(moveSolution([proven], 's1', 'adopted', day, context({ decisions: [{ id: 'adr1', status: 'reviewing' }] })).ok).toBe(false)
    expect(moveSolution([proven], 's1', 'adopted', day, context({ decisions: [{ id: 'adr1', status: 'accepted' }] })).ok).toBe(true)
  })
  it('goes back one step ungated, except out of adopted while its decision stands', () => {
    const shaped = { ...vetted, state: 'shaped' as const, benefit: undefined }
    expect(moveSolution([shaped], 's1', 'idea', day, context()).ok).toBe(true)
    const adopted = { ...vetted, state: 'adopted' as const, decision: 'adr1' }
    expect(moveSolution([adopted], 's1', 'proven', day, context({ decisions: [{ id: 'adr1', status: 'accepted' }] })))
      .toMatchObject({ ok: false, refusal: 'decided' })
    expect(moveSolution([adopted], 's1', 'proven', day, context({ decisions: [{ id: 'adr1', status: 'superseded' }] })).ok).toBe(true)
  })
})

describe('dropping', () => {
  it('needs a note, keeps where it was, and restores there', () => {
    const shaped = { ...vetted, state: 'shaped' as const }
    expect(dropSolution([shaped], 's1', ' ', '2026-09-24')[0]).toBe(shaped)
    const dropped = dropSolution([shaped], 's1', 'Contract runs to 2028', '2026-09-24')
    expect(dropped[0]).toMatchObject({ state: 'dropped', droppedFrom: 'shaped', dropNote: 'Contract runs to 2028' })
    const back = restoreSolution(dropped, 's1', '2026-09-25')[0]
    expect(back.state).toBe('shaped')
    expect(back).not.toHaveProperty('dropNote')
    expect(back.history.map((event) => event.kind)).toEqual(['proposed', 'dropped', 'restored'])
  })
  it('refuses an adopted solution: its decision is superseded first', () => {
    const adopted = { ...vetted, state: 'adopted' as const }
    expect(dropSolution([adopted], 's1', 'No', '2026-09-24')[0]).toBe(adopted)
  })
  it('removing a solution takes it out of its experiments', () => {
    const work = removeSolution({ solutions: [vetted], experiments: [experiment({ tests: ['s1', 's2'] })] }, 's1')
    expect(work.solutions).toEqual([])
    expect(work.experiments[0].tests).toEqual(['s2'])
  })
})

describe('experiments', () => {
  it('refuses a blank hypothesis and drops blank optional text', () => {
    const list = [experiment({ where: 'Desk 3' })]
    expect(updateExperiment(list, 'e1', { hypothesis: ' ' })[0]).toBe(list[0])
    expect(updateExperiment(list, 'e1', { where: '' })[0]).not.toHaveProperty('where')
  })
  it('concludes with an outcome and a result', () => {
    const [one] = concludeExperiment([experiment({})], 'e1', 'confirmed', ' 41 to 12 a week ')
    expect(one).toMatchObject({ outcome: 'confirmed', result: '41 to 12 a week' })
    expect(experimentsFor([one, experiment({ id: 'e2', tests: ['s9'] })], 's1')).toEqual([one])
  })
})

describe('what is derived', () => {
  const plan = (over: Partial<SolutionPlan>): SolutionPlan => ({ id: 'tr1', status: 'running', elements: [], ...over })
  const adopted = {
    ...vetted, state: 'adopted' as const, decision: 'adr1', plan: 'tr1',
    history: [...vetted.history, { date: '2026-08-01', kind: 'moved' as const, to: 'adopted' }],
  }

  it('reads implemented off the plan being done, and nothing else', () => {
    expect(solutionPhase(adopted, [plan({})])).toBe('adopted')
    expect(solutionPhase(adopted, [plan({ status: 'done' })])).toBe('implemented')
    expect(solutionPhase({ ...adopted, state: 'proven' }, [plan({ status: 'done' })])).toBe('proven')
  })
  it('counts from the plan end, or from the day it was adopted', () => {
    expect(implementedOn(adopted, [plan({ status: 'done', to: '2026-09-01' })])).toBe('2026-09-01')
    expect(implementedOn(adopted, [plan({ status: 'done' })])).toBe('2026-08-01')
    expect(implementedOn(adopted, [plan({})])).toBeUndefined()
  })
  it('finds the observations under what it addresses, however deep', () => {
    expect(underneath(vetted, analysis).map((one) => one.id).sort()).toEqual(['o1', 'o2'])
  })
  it('reads a merged observation as the one that took it in, and keeps a scope below', () => {
    const merged: Analysis = {
      observations: [
        observation({ history: [{ date: '2026-06-01', kind: 'recorded' }, { date: '2026-06-02', kind: 'absorbed', id: 'o2' }] }),
        observation({ id: 'o2', number: 2 }),
      ],
      causes: [cause({ explains: [{ id: 'o2', strength: 'strong' }, { id: 'x9', scope: 'claims', strength: 'weak' }] })],
    }
    expect(underneath({ addresses: [{ id: 'c1', strength: 'strong' }] }, merged)).toEqual(
      expect.arrayContaining([{ id: 'o1' }, { id: 'x9', scope: 'claims' }]))
  })
  it('finds a sighting after it was implemented, and none before', () => {
    const seen: Analysis = {
      ...analysis,
      observations: [
        observation({ history: [{ date: '2026-06-01', kind: 'recorded' }, { date: '2026-08-15', kind: 'seen' }] }),
        observation({ id: 'o2', number: 2, history: [{ date: '2026-06-01', kind: 'recorded' }, { date: '2026-09-10', kind: 'seen' }] }),
      ],
    }
    const plans = [plan({ status: 'done', to: '2026-09-01' })]
    expect(seenSinceImplemented(adopted, seen, [], plans)).toEqual([{ id: 'o2', date: '2026-09-10' }])
    expect(seenSinceImplemented(adopted, seen, [], [plan({ status: 'running', to: '2026-09-01' })])).toEqual([])
  })
  it('asks whether a proven solution only treats a symptom', () => {
    const symptom = { ...vetted, state: 'proven' as const, addresses: [{ id: 'c1', strength: 'strong' as const }] }
    expect(solutionQuestions(symptom, context())).toEqual(['worksAround'])
    expect(solutionQuestions({ ...symptom, state: 'shaped' }, context())).toEqual([])
    expect(solutionQuestions({ ...vetted, state: 'proven' }, context())).toEqual([])
  })
  it('asks what a plan that only adds clears up, and about an adopted one with no plan', () => {
    const adds = plan({ elements: [{ role: 'introduces' }] })
    expect(solutionQuestions(adopted, context({ plans: [adds] }))).toEqual(['addsOnly'])
    expect(solutionQuestions(adopted, context({ plans: [plan({ elements: [{ role: 'introduces' }, { role: 'retires' }] })] }))).toEqual([])
    expect(solutionQuestions({ ...adopted, plan: undefined }, context())).toEqual(['adoptedUnplanned'])
    expect(solutionQuestions({ ...adopted, state: 'dropped' }, context())).toEqual([])
  })
  it('lists the alternatives on the same causes, dropped ones included', () => {
    const other = { ...vetted, id: 's2', state: 'dropped' as const }
    const elsewhere = { ...vetted, id: 's3', addresses: [{ id: 'c9', strength: 'weak' as const }] }
    expect(alternatives(vetted, [vetted, other, elsewhere])).toEqual([other])
  })
  it('names the root causes nobody is working on', () => {
    expect(rootsWithoutSolution(analysis.causes, [])).toEqual([analysis.causes[1]])
    expect(rootsWithoutSolution(analysis.causes, [vetted])).toEqual([])
    expect(rootsWithoutSolution(analysis.causes, [{ ...vetted, state: 'dropped' }])).toEqual([analysis.causes[1]])
  })
  it('writes a decision context naming the causes and the alternatives', () => {
    const other = { ...vetted, id: 's2', number: 2, title: 'Rewrite', state: 'dropped' as const, dropNote: 'Too costly' }
    const text = decisionContext(vetted, analysis.causes, [vetted, other], t)
    expect(text).toContain('SO-0001 One estimate service')
    expect(text).toContain('* CA-0002 Nobody owns the data')
    expect(text).toContain('* SO-0002 Rewrite (dropped: Too costly)')
  })
})
