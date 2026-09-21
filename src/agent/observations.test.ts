/**
 * The observation tools (ADR-0021) as an agent uses them: record, see again,
 * share, analyse into a cause, deepen it to a root, merge two, and fold in one
 * a scope below shared — every write one transaction, every answer what the
 * page shows.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { Observation } from '../model/observation'
import { apply } from '../model/reducer'
import { answer } from './answer'
import type { ReadTool } from './answer'
import { commandFor } from './commandFor'
import type { Prepared, WriteView } from './commandFor'
import type { AgentAnswer, ToolName } from './tools'

const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Observation ${number}`, date: '2026-09-01', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})

const host: HostModel = {
  name: 'Claims', elements: [], relations: [], diagrams: [],
  observations: [observation('ob-1', 1, { impact: 'major', seen: 2 }), observation('ob-2', 2)],
  causes: [{ id: 'ca-1', number: 1, title: 'Window too small', state: 'assumed', body: '', explains: [{ id: 'ob-1', strength: 'strong' }] }],
}

const below = [{ scope: 'acme/claims/intake', observation: observation('in-1', 1, { shared: true, seen: 3 }) }]

let counter = 0
beforeEach(() => { counter = 0 })
function view(model: Model, over: Partial<WriteView> = {}): WriteView {
  return {
    model,
    current: () => toArrays(model),
    activeDiagramId: '',
    scopePath: 'acme/claims',
    ancestorDecisions: [],
    ids: idPolicy(() => []),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-09-20',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    tree: { lookup: () => undefined, initiativesBelow: () => [], observationsBelow: () => below, rowsTo: () => [] },
    ...over,
  }
}

const prepared = (out: Prepared | AgentAnswer): Prepared => {
  if ('ok' in out) throw new Error(`refused: ${JSON.stringify(out)}`)
  return out
}
const parse = (held: AgentAnswer): Record<string, unknown> => {
  if (!held.ok || held.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(held)}`)
  return JSON.parse(held.content[0].text)
}
const write = (model: Model, tool: ToolName, args: unknown): { model: Model; answer: Record<string, unknown> } => {
  const out = prepared(commandFor(tool, args, view(model)))
  const applied = apply(model, out.command)
  if (!applied.ok) throw new Error(`reducer refused: ${applied.reason}`)
  return { model: applied.model, answer: parse(out.answer) }
}
const read = (model: Model, tool: ReadTool, args: unknown = {}) => parse(answer(tool, args, view(model)))

describe('observations.list and observation.read', () => {
  it('lists this scope’s own with their causes, and the shared ones from below with their scope', () => {
    const listed = read(fromArrays(host), 'observations.list') as { observations: { id: string; causes: { label: string }[] }[]; fromBelow: { scope: string; id: string }[] }
    expect(listed.observations.map((one) => one.id)).toEqual(['ob-1', 'ob-2'])
    expect(listed.observations[0].causes.map((one) => one.label)).toEqual(['CA-0001'])
    expect(listed.fromBelow).toEqual([expect.objectContaining({ scope: 'acme/claims/intake', id: 'in-1', seen: 3 })])
  })

  it('filters by analysed and impact, and reads one by its label', () => {
    const model = fromArrays(host)
    expect((read(model, 'observations.list', { analysed: false }) as { observations: { id: string }[] }).observations.map((one) => one.id)).toEqual(['ob-2'])
    expect((read(model, 'observations.list', { impact: 'major' }) as { observations: { id: string }[] }).observations.map((one) => one.id)).toEqual(['ob-1'])
    expect(read(model, 'observation.read', { id: 'OB-2' })).toMatchObject({ id: 'ob-2', label: 'OB-0002', history: [{ date: '2026-09-01', kind: 'recorded' }] })
    expect(answer('observation.read', { id: 'ob-9' }, view(model)).ok).toBe(false)
  })
})

describe('archiving', () => {
  it('closes an observation with the day and the note, lists it only when asked, and restores it', () => {
    let model = fromArrays(host)
    const closed = write(model, 'observation.archive', { id: 'OB-2', note: 'Fixed in the release checklist' })
    model = closed.model
    expect(closed.answer).toMatchObject({ id: 'ob-2', archived: true })
    expect(model.observations!['ob-2'].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'archived', note: 'Fixed in the release checklist' })
    expect((read(model, 'observations.list') as { observations: { id: string }[] }).observations.map((one) => one.id)).toEqual(['ob-1'])
    expect((read(model, 'observations.list', { includeArchived: true }) as { observations: { id: string }[] }).observations.map((one) => one.id)).toEqual(['ob-1', 'ob-2'])
    expect(commandFor('observation.archive', { id: 'ob-2' }, view(model))).toMatchObject({ ok: false })
    expect(commandFor('observation.merge', { id: 'ob-2', into: 'ob-1' }, view(model))).toMatchObject({ ok: false })

    model = write(model, 'observation.archive', { id: 'ob-2', restore: true }).model
    expect(model.observations!['ob-2'].archived).toBeUndefined()
    expect(model.observations!['ob-2'].history.map((one) => one.kind)).toEqual(['recorded', 'archived', 'restored'])
  })

  it('an observation archived below is no longer offered above', () => {
    const closedBelow = [{ scope: 'acme/claims/intake', observation: observation('in-1', 1, { shared: true, archived: true }) }]
    const listed = read(fromArrays(host), 'observations.list') as { fromBelow?: unknown }
    expect(listed.fromBelow).toBeDefined()
    const gone = parse(answer('observations.list', {}, view(fromArrays(host), { tree: { lookup: () => undefined, initiativesBelow: () => [], observationsBelow: () => closedBelow, rowsTo: () => [] } }))) as { fromBelow?: unknown }
    expect(gone.fromBelow).toBeUndefined()
  })
})

describe('recording and analysing', () => {
  it('records a local observation, seen once, with the template, and says who saw it', () => {
    const { model, answer: said } = write(fromArrays(host), 'observation.record', { title: 'Duplicate customers', where: 'CRM', by: 'W.S.', impact: 'major' })
    expect(said).toMatchObject({ label: 'OB-0003', title: 'Duplicate customers', where: 'CRM', by: 'W.S.', impact: 'major', seen: 1, shared: false })
    expect(read(write(model, 'observation.update', { id: 'ob-new-1', by: '' }).model, 'observation.read', { id: 'ob-new-1' })).not.toHaveProperty('by')
    expect(model.order.observations).toEqual(['ob-1', 'ob-2', 'ob-new-1'])
    expect(model.observations!['ob-new-1'].body).toMatch(/^## /)
  })

  it('seen again, then shared, both dated in the history', () => {
    let model = fromArrays(host)
    model = write(model, 'observation.seen', { id: 'ob-2', note: 'again at the desk' }).model
    model = write(model, 'observation.update', { id: 'ob-2', shared: true }).model
    expect(model.observations!['ob-2'].seen).toBe(2)
    expect(model.observations!['ob-2'].shared).toBe(true)
    expect(model.observations!['ob-2'].history.map((one) => one.kind)).toEqual(['recorded', 'seen', 'shared'])
  })

  it('a new cause explains an own observation and a shared one, then a deeper cause makes it a non-root', () => {
    let model = fromArrays(host)
    const added = write(model, 'cause.add', {
      title: 'No customer master',
      explains: [{ id: 'OB-2', strength: 'strong' }, { id: 'in-1', scope: 'acme/claims/intake' }],
    })
    model = added.model
    expect(added.answer).toMatchObject({ label: 'CA-0002', state: 'assumed', root: true })
    expect(model.causes!['ca-new-1'].explains).toEqual([
      { id: 'ob-2', strength: 'strong' }, { id: 'in-1', scope: 'acme/claims/intake', strength: 'normal' },
    ])
    const deeper = write(model, 'cause.add', { title: 'Nobody owns shared data', state: 'verified', explains: [{ id: 'ca-new-1' }] })
    model = deeper.model
    expect(deeper.answer).toMatchObject({ root: true, state: 'verified' })
    expect((read(model, 'cause.read', { id: 'CA-2' }) as { root: boolean; explainedBy: { id: string }[] })).toMatchObject({ root: false, explainedBy: [{ id: 'ca-new-2' }] })
    expect((read(model, 'causes.list', { root: true }) as { causes: { id: string }[] }).causes.map((one) => one.id)).toEqual(['ca-1', 'ca-new-2'])
  })

  it('refuses a loop between causes and a link to nothing', () => {
    const model = fromArrays(host)
    expect(commandFor('cause.link', { id: 'ca-1', explains: 'ca-1' }, view(model))).toMatchObject({ ok: false })
    expect(commandFor('cause.link', { id: 'ca-1', explains: 'nope' }, view(model))).toMatchObject({ ok: false })
  })
})

describe('merging', () => {
  it('folds one own observation into another: sightings, links and history move', () => {
    const { model, answer: said } = write(fromArrays(host), 'observation.merge', { id: 'ob-1', into: 'ob-2' })
    expect(said).toMatchObject({ id: 'ob-2', seen: 3, causes: [{ id: 'ca-1' }] })
    expect(model.observations!['ob-1'].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'merged', id: 'ob-2' })
    expect(model.causes!['ca-1'].explains).toEqual([{ id: 'ob-2', strength: 'strong' }])
    const listed = read(model, 'observations.list') as { observations: { id: string }[] }
    expect(listed.observations.map((one) => one.id)).toEqual(['ob-2'])
    expect((read(model, 'observations.list', { includeMerged: true }) as { observations: { id: string; mergedInto?: string }[] }).observations[0]).toMatchObject({ id: 'ob-1', mergedInto: 'ob-2' })
  })

  it('folds in a shared observation from below by writing only the survivor', () => {
    const { model, answer: said } = write(fromArrays(host), 'observation.merge', { id: 'in-1', into: 'ob-1', fromScope: 'acme/claims/intake' })
    expect(said).toMatchObject({ id: 'ob-1', seen: 5 })
    expect(model.observations!['ob-1'].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'absorbed', id: 'in-1', scope: 'acme/claims/intake', seen: 3 })
    expect(model.order.observations).toEqual(['ob-1', 'ob-2'])
    expect((read(model, 'observations.list') as { fromBelow?: unknown }).fromBelow).toBeUndefined()
  })

  it('refuses a merge into itself and a second merge of the same record', () => {
    const model = fromArrays(host)
    expect(commandFor('observation.merge', { id: 'ob-1', into: 'ob-1' }, view(model))).toMatchObject({ ok: false })
    const once = write(model, 'observation.merge', { id: 'ob-1', into: 'ob-2' }).model
    expect(commandFor('observation.merge', { id: 'ob-1', into: 'ob-2' }, view(once))).toMatchObject({ ok: false })
  })
})
