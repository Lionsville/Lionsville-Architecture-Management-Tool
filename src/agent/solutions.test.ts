// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The solution tools (ADR-0026) as an agent uses them: propose from a root
 * cause, answer the gates, be told what a refused move still needs, plan and
 * conclude an experiment, propose the decision record, start the plan, and
 * see an implemented solution's sightings — with nothing but tools, every
 * write one transaction.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { answer } from './answer'
import type { ReadTool } from './answer'
import { commandFor } from './commandFor'
import type { Prepared, WriteView } from './commandFor'
import type { AgentAnswer, ToolName } from './tools'

const host: HostModel = {
  name: 'Delivery', elements: [], relations: [], diagrams: [],
  observations: [{
    id: 'ob-1', number: 1, title: 'Estimate differs per channel', date: '2026-06-01', impact: 'major', seen: 1, body: '',
    history: [{ date: '2026-06-01', kind: 'recorded' }],
  }],
  causes: [
    { id: 'ca-1', number: 1, title: 'Two systems compute it', state: 'verified', body: '', explains: [{ id: 'ob-1', strength: 'strong' }] },
    { id: 'ca-2', number: 2, title: 'Nobody owns the data', state: 'verified', body: '', explains: [{ id: 'ca-1', strength: 'strong' }] },
  ],
}

let counter = 0
let day = '2026-09-20'
beforeEach(() => { counter = 0; day = '2026-09-20' })
function view(model: Model): WriteView {
  return {
    model,
    current: () => toArrays(model),
    activeDiagramId: '',
    scopePath: 'acme/delivery',
    ancestorDecisions: [],
    ids: idPolicy(() => []),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => day,
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    tree: { lookup: () => undefined, initiativesBelow: () => [], observationsBelow: () => [], rowsTo: () => [] },
  }
}

const parse = (held: AgentAnswer): Record<string, unknown> => {
  if (!held.ok || held.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(held)}`)
  return JSON.parse(held.content[0].text)
}
const attempt = (model: Model, tool: ToolName, args: unknown) => commandFor(tool, args, view(model))
const write = (model: Model, tool: ToolName, args: unknown): { model: Model; answer: Record<string, unknown> } => {
  const out = attempt(model, tool, args)
  if ('ok' in out) throw new Error(`refused: ${JSON.stringify(out)}`)
  const applied = apply(model, (out as Prepared).command)
  if (!applied.ok) throw new Error(`reducer refused: ${applied.reason}`)
  return { model: applied.model, answer: parse((out as Prepared).answer) }
}
const refusal = (model: Model, tool: ToolName, args: unknown): string => {
  const out = attempt(model, tool, args)
  if (!('ok' in out) || out.ok) throw new Error(`not refused: ${tool}`)
  return JSON.stringify(out)
}
const read = (model: Model, tool: ReadTool, args: unknown = {}) => parse(answer(tool, args, view(model)))

describe('solution tools', () => {
  it('proposes from a root cause, strong by default, and lists it with what the gate still needs', () => {
    const { model, answer: proposed } = write(fromArrays(host), 'solution.propose', { title: 'Appoint a data owner', addresses: [{ id: 'CA-0002' }] })
    expect(proposed).toMatchObject({ label: 'SO-0001', state: 'idea', phase: 'idea', addresses: [{ id: 'ca-2', strength: 'strong', root: true }] })
    expect((proposed.next as { open: string[] }).open).toEqual(['benefit', 'cost', 'validatedWith', 'triedBefore'])
    const listed = read(model, 'solutions.list', { causeId: 'ca-2' }) as { solutions: { label: string }[] }
    expect(listed.solutions.map((one) => one.label)).toEqual(['SO-0001'])
  })

  it('refuses a move with the gate items named, and takes it once they are answered', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'Own the data', addresses: [{ id: 'ca-2' }] }).model
    expect(refusal(model, 'solution.move', { id: 'SO-0001', to: 'shaped' })).toContain('benefit, cost, validatedWith, triedBefore')
    expect(refusal(model, 'solution.move', { id: 'SO-0001', to: 'testing' })).toContain('one step at a time')
    model = write(model, 'solution.update', { id: 'SO-0001', benefit: 'large', cost: 'small', validatedWith: ['Operations'], noneKnown: true }).model
    const moved = write(model, 'solution.move', { id: 'SO-0001', to: 'shaped' })
    expect(moved.answer).toMatchObject({ state: 'shaped', next: { to: 'testing', open: ['experimentPlanned'] } })
  })

  it('goes from an idea to implemented with nothing but tools, and then sees a sighting come back', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'One estimate service', addresses: [{ id: 'ca-2' }] }).model
    model = write(model, 'solution.update', { id: 'SO-0001', benefit: 'medium', cost: 'medium', validatedWith: ['Customer service'], attempts: [{ when: '2024', what: 'A nightly sync', why: 'It lagged' }], whyNow: 'The feed is live' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'shaped' }).model
    const planned = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Two weeks at one desk', hypothesis: 'Calls halve', measure: 'Calls per week' })
    expect(planned.answer).toMatchObject({ label: 'EX-0001', outcome: 'planned', from: '2026-09-20', tests: [{ label: 'SO-0001' }] })
    model = write(planned.model, 'solution.move', { id: 'SO-0001', to: 'testing' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed', result: '41 to 12 a week' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'proven' }).model
    expect(refusal(model, 'solution.move', { id: 'SO-0001', to: 'adopted' })).toContain('decisionAccepted')

    const decided = write(model, 'solution.decide', { id: 'SO-0001' })
    const adr = decided.answer.proposed as { id: string; label: string; status: string }
    expect(adr).toMatchObject({ label: 'ADR-0001', status: 'proposed' })
    expect(decided.model.decisions![adr.id].body).toContain('* CA-0002 Nobody owns the data')
    model = write(decided.model, 'decision.transition', { id: adr.id, status: 'reviewing' }).model
    model = write(model, 'decision.transition', { id: adr.id, status: 'accepted' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'adopted' }).model
    expect(read(model, 'solution.read', { id: 'SO-0001' })).toMatchObject({ phase: 'adopted', questions: ['adoptedUnplanned'] })

    const started = write(model, 'solution.plan', { id: 'SO-0001' })
    const plan = started.answer.started as { id: string }
    expect(started.model.transitions![plan.id].decisions).toEqual([adr.id])
    model = write(started.model, 'plan.update', { id: plan.id, status: 'agreed', to: '2026-10-01' }).model
    model = write(model, 'plan.update', { id: plan.id, status: 'running' }).model
    model = write(model, 'plan.update', { id: plan.id, status: 'done' }).model
    expect(read(model, 'solutions.list', { phase: 'implemented' })).toMatchObject({ solutions: [{ label: 'SO-0001' }] })

    day = '2026-10-12'
    model = write(model, 'observation.seen', { id: 'OB-0001' }).model
    expect(read(model, 'solution.read', { id: 'SO-0001' }).seenSinceImplemented).toEqual([{ id: 'ob-1', date: '2026-10-12' }])
  })

  it('waives an experiment only with a reason, and drops only with a note', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'Appoint an owner', addresses: [{ id: 'ca-2' }] }).model
    expect(refusal(model, 'solution.waive', { id: 'SO-0001', reason: ' ' })).toContain('a reason a person gave')
    model = write(model, 'solution.waive', { id: 'SO-0001', reason: 'An appointment is not trialled' }).model
    expect(read(model, 'solution.read', { id: 'SO-0001' }).waived).toBe('An appointment is not trialled')
    expect(refusal(model, 'solution.drop', { id: 'SO-0001', note: '' })).toContain('must not be blank')
    model = write(model, 'solution.drop', { id: 'SO-0001', note: 'Nobody would take it' }).model
    expect((read(model, 'solutions.list') as { solutions: unknown[] }).solutions).toEqual([])
    expect(read(model, 'solutions.list', { includeDropped: true })).toMatchObject({ solutions: [{ phase: 'dropped', dropNote: 'Nobody would take it' }] })
    model = write(model, 'solution.restore', { id: 'SO-0001' }).model
    expect(read(model, 'solution.read', { id: 'SO-0001' }).state).toBe('idea')
  })

  it('asks whether a proven solution for a cause with a cause of its own works around it', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'Sync the two estimates', addresses: [{ id: 'ca-1' }] }).model
    model = write(model, 'solution.update', { id: 'SO-0001', benefit: 'small', cost: 'small', validatedWith: ['Ops'], noneKnown: true }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'shaped' }).model
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'Fewer calls' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'testing' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed' }).model
    const proven = write(model, 'solution.move', { id: 'SO-0001', to: 'proven' })
    expect(proven.answer.questions).toEqual(['worksAround'])
    expect(proven.answer.addresses).toEqual([expect.objectContaining({ id: 'ca-1', strength: 'normal', root: false })])
  })

  it('removing a cause takes it out of every solution, as one step', () => {
    const model = write(fromArrays(host), 'solution.propose', { title: 'Own the data', addresses: [{ id: 'ca-2' }] }).model
    const removed = write(model, 'cause.remove', { id: 'ca-2' }).model
    expect(removed.solutions!['so-new-1'].addresses).toEqual([])
  })

  it('removes a solution from the experiments that tested it', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }).model
    model = write(model, 'solution.remove', { id: 'SO-0001' }).model
    expect(read(model, 'experiments.list')).toMatchObject({ experiments: [{ label: 'EX-0001', tests: [] }] })
    expect(refusal(model, 'experiment.plan', { tests: ['SO-0009'], title: 'x', hypothesis: 'y' })).toContain('SO-0009')
  })
})
