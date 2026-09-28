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
import { element } from '../model/testFixtures'
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

/** A proposed solution's idea gate answered, and the move to shaped made. */
const shape = (model: Model, id: string): Model => {
  const answered = write(model, 'solution.update', { id, benefit: 'small', cost: 'small', validatedWith: ['Ops'], noneKnown: true }).model
  return write(answered, 'solution.move', { id, to: 'shaped' }).model
}

describe('solution tools', () => {
  it('proposes from a root cause, strong by default, and lists it with what the gate still needs', () => {
    const { model, answer: proposed } = write(fromArrays(host), 'solution.propose', { title: 'Appoint a data owner', addresses: [{ id: 'CA-0002' }] })
    expect(proposed).toMatchObject({ label: 'SO-0001', state: 'idea', phase: 'idea', addresses: [{ id: 'ca-2', strength: 'strong', root: true }] })
    expect((proposed.next as { open: string[] }).open).toEqual(['benefit', 'cost', 'validatedWith', 'triedBefore', 'whyNow'])
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
    // One element for the plan to change: a plan names something before it is agreed.
    const withEstimates = fromArrays({ ...host, elements: [element('estimates', { name: 'Estimates' })] })
    let model = write(withEstimates, 'solution.propose', { title: 'One estimate service', addresses: [{ id: 'ca-2' }] }).model
    model = write(model, 'solution.update', { id: 'SO-0001', benefit: 'medium', cost: 'medium', validatedWith: ['Customer service'], attempts: [{ when: '2024', what: 'A nightly sync', why: 'It lagged' }], whyNow: 'The feed is live' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'shaped' }).model
    const planned = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Two weeks at one desk', hypothesis: 'Calls halve', measure: 'Calls per week' })
    expect(planned.answer).toMatchObject({ label: 'EX-0001', outcome: 'planned', from: '2026-09-20', tests: [{ label: 'SO-0001', state: 'testing' }] })
    model = planned.model
    expect(refusal(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed', result: '41 to 12 a week' })).toContain('start it (running)')
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'running' }).model
    expect(refusal(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed' })).toContain('must say what happened')
    const concluded = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed', result: '41 to 12 a week' })
    expect(concluded.answer).toMatchObject({ outcome: 'confirmed', from: '2026-09-20', to: '2026-09-20', result: '41 to 12 a week' })
    model = concluded.model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'proven' }).model
    expect(refusal(model, 'solution.move', { id: 'SO-0001', to: 'adopted' })).toContain('decisionAccepted')

    const decided = write(model, 'solution.decide', { id: 'SO-0001' })
    const adr = decided.answer.proposed as { id: string; label: string; status: string }
    expect(adr).toMatchObject({ label: 'ADR-0001', status: 'proposed' })
    const body = decided.model.decisions![adr.id].body
    expect(body).toContain('* CA-0002 Nobody owns the data')
    expect(body).toContain('Chosen option: \u201cSO-0001 One estimate service\u201d, because EX-0001 Two weeks at one desk confirmed it: 41 to 12 a week')
    expect(body).toContain('OB-0001 should stop being seen')
    // The only solution on its causes: leaving it as it is is the other option weighed.
    expect(body).toContain('* Leave it as it is: ')
    model = write(decided.model, 'decision.transition', { id: adr.id, status: 'reviewing' }).model
    // Accepting is gated on an approval (ADR-0008): the body the tool wrote clears the rest.
    expect(refusal(model, 'decision.transition', { id: adr.id, status: 'accepted' })).toContain('approved')
    model = write(model, 'decision.update', { id: adr.id, signers: [{ name: 'Customer service', verdict: 'approved', signedAt: '2026-09-20' }] }).model
    model = write(model, 'decision.transition', { id: adr.id, status: 'accepted' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'adopted' }).model
    expect(read(model, 'solution.read', { id: 'SO-0001' })).toMatchObject({ phase: 'adopted', questions: ['adoptedUnplanned'] })

    const started = write(model, 'solution.plan', { id: 'SO-0001' })
    const plan = started.answer.started as { id: string }
    expect(started.model.transitions![plan.id].decisions).toEqual([adr.id])
    // Agreed needs a window, an owner and something named (ADR-0009), given in the same call.
    model = write(started.model, 'plan.update', {
      id: plan.id, status: 'agreed', from: '2026-09-20', to: '2026-10-01', owner: 'Customer service', changes: ['estimates'],
    }).model
    model = write(model, 'plan.update', { id: plan.id, status: 'running' }).model
    const done = write(model, 'plan.update', { id: plan.id, status: 'done' })
    expect(done.model.transitions![plan.id].doneOn).toBe('2026-09-20')
    model = done.model
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

  it('addresses root causes only, and names the deeper one when asked for a symptom', () => {
    const model = fromArrays(host)
    expect(refusal(model, 'solution.propose', { title: 'Sync the two estimates', addresses: [{ id: 'ca-1' }] }))
      .toContain('CA-0001 is not a root cause: CA-0002 explains it')
    const proposed = write(model, 'solution.propose', { title: 'Own the data', addresses: [{ id: 'ca-2' }] }).model
    expect(refusal(proposed, 'solution.address', { id: 'SO-0001', cause: 'ca-1' })).toContain('CA-0002 explains it')
  })

  it('asks whether a proven solution works around its cause once that cause gains a deeper one', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'Own the data', addresses: [{ id: 'ca-2' }] }).model
    model = shape(model, 'SO-0001')
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'Fewer calls' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'running' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed', result: 'Calls fell by half' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'proven' }).model
    expect(read(model, 'solution.read', { id: 'SO-0001' }).questions).toEqual([])
    model = write(model, 'cause.add', { title: 'Nobody was asked to own it', explains: [{ id: 'ca-2' }] }).model
    const asked = read(model, 'solution.read', { id: 'SO-0001' })
    expect(asked.questions).toEqual(['worksAround'])
    expect(asked.addresses).toEqual([expect.objectContaining({ id: 'ca-2', root: false })])
    const restrengthened = write(model, 'solution.address', { id: 'SO-0001', cause: 'ca-2', strength: 'weak' })
    expect(restrengthened.answer.addresses).toEqual([expect.objectContaining({ id: 'ca-2', strength: 'weak' })])
  })

  it('removing a cause takes it out of every solution, as one step', () => {
    const model = write(fromArrays(host), 'solution.propose', { title: 'Own the data', addresses: [{ id: 'ca-2' }] }).model
    const removed = write(model, 'cause.remove', { id: 'ca-2' }).model
    expect(removed.solutions!['so-new-1'].addresses).toEqual([])
  })

  it('says how firmly an experiment bears on each solution it tests, and only on those', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    model = write(model, 'solution.propose', { title: 'B', addresses: [{ id: 'ca-2' }] }).model
    model = shape(shape(model, 'SO-0001'), 'SO-0002')
    const planned = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works', strength: { 'SO-0001': 'strong' } })
    expect(planned.answer).toMatchObject({ tests: [{ label: 'SO-0001', strength: 'strong' }] })
    expect(refusal(planned.model, 'experiment.update', { id: 'EX-0001', strength: { 'SO-0002': 'weak' } })).toContain('does not test SO-0002')
    const widened = write(planned.model, 'experiment.update', { id: 'EX-0001', tests: ['SO-0001', 'SO-0002'], strength: { 'SO-0002': 'weak' } })
    expect(widened.answer).toMatchObject({ tests: [{ label: 'SO-0001', strength: 'strong' }, { label: 'SO-0002', strength: 'weak' }] })
  })

  it('removes a solution from the experiments that tested it', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    model = shape(model, 'SO-0001')
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }).model
    model = write(model, 'solution.remove', { id: 'SO-0001' }).model
    expect(read(model, 'experiments.list')).toMatchObject({ experiments: [{ label: 'EX-0001', tests: [] }] })
    expect(refusal(model, 'experiment.plan', { tests: ['SO-0009'], title: 'x', hypothesis: 'y' })).toContain('SO-0009')
  })

  it('plans an experiment only for a shaped or testing solution, and says what to do instead', () => {
    const model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    expect(refusal(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }))
      .toContain('SO-0001 is idea: an experiment is planned for a shaped or testing solution. Answer its gate')
  })

  it('takes on a new cause only while a solution is an idea or shaped', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    model = shape(model, 'SO-0001')
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }).model
    model = write(model, 'cause.add', { title: 'Nobody was asked to own it', explains: [{ id: 'ca-2' }] }).model
    expect(refusal(model, 'solution.address', { id: 'SO-0001', cause: 'CA-0003' })).toContain('SO-0001 is testing: a solution takes on a cause while it is an idea or shaped')
    // How directly it addresses one it already does may still change.
    expect(write(model, 'solution.address', { id: 'SO-0001', cause: 'ca-2', strength: 'weak' }).answer.addresses)
      .toEqual([expect.objectContaining({ id: 'ca-2', strength: 'weak' })])
  })

  it('reopens a confirmed experiment, names the proof it withdrew, and asks about it without moving the solution', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    model = shape(model, 'SO-0001')
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'running' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'confirmed', result: 'It did' }).model
    model = write(model, 'solution.move', { id: 'SO-0001', to: 'proven' }).model
    const reopened = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'running' })
    expect(reopened.answer).toMatchObject({ outcome: 'running', proofWithdrawn: ['SO-0001'] })
    expect(reopened.answer).not.toHaveProperty('to')
    expect(read(reopened.model, 'solution.read', { id: 'SO-0001' })).toMatchObject({ state: 'proven', questions: ['proofWithdrawn'] })
    expect(refusal(reopened.model, 'experiment.plan', { tests: ['SO-0001'], title: 'Again', hypothesis: 'It works' })).toContain('Move it back to testing first')
  })

  it('refuses a conclusion that ends before the experiment started', () => {
    let model = write(fromArrays(host), 'solution.propose', { title: 'A', addresses: [{ id: 'ca-2' }] }).model
    model = shape(model, 'SO-0001')
    model = write(model, 'experiment.plan', { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }).model
    model = write(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'running' }).model
    expect(refusal(model, 'experiment.conclude', { id: 'EX-0001', outcome: 'refuted', result: 'No change', to: '2026-09-01' }))
      .toContain('before EX-0001 started, on 2026-09-20')
  })

  it('says how to reopen an adopted solution whose decision stands: supersede it', () => {
    const model = fromArrays({
      ...host,
      decisions: [{ id: 'adr-1', number: 3, title: 'Own the data', status: 'accepted', date: '2026-09-01', body: '', signers: [] }],
      solutions: [{
        id: 'so-1', number: 1, title: 'Own the data', state: 'adopted', addresses: [{ id: 'ca-2', strength: 'strong' }],
        validatedWith: [], attempts: [], waived: 'An appointment is not trialled', decision: 'adr-1', body: '',
        history: [{ date: '2026-09-01', kind: 'proposed' }],
      }],
    })
    expect(refusal(model, 'solution.move', { id: 'SO-0001', to: 'proven' })).toContain('To reopen, supersede ADR-0003 on the Decisions page.')
    expect(refusal(model, 'solution.address', { id: 'SO-0001', cause: 'ca-1' })).toContain('To reopen, supersede ADR-0003')
  })
})
