/**
 * The write tier, over the real reducer.
 *
 * Two properties are what the record asks for, and every tool here is held
 * to both: the command the builder makes is one the reducer accepts, and
 * applying its inverse gives back a model that is byte-identical to the one
 * before — which is what makes ⌘Z after an agent's step honest. The rest is
 * what each tool refuses before the reducer sees anything.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/fromInterchange'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import { groupRectAround, placementRect, unionRects } from '../model/placement'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { syntheticModel } from '../model/testing/synthetic'
import { commandFor } from './commandFor'
import type { Prepared, WriteView } from './commandFor'
import type { AgentAnswer, ToolName } from './tools'

const element = (id: string, name: string, over: Partial<HostModel['elements'][number]> = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const,
  isManaged: true, aspects: {}, ...over,
})

const decision = (id: string, number: number, title: string, status: Adr['status'] = 'proposed', applicationId?: string): Adr => ({
  id, number, title, status, date: '2026-09-01', body: '# body', signers: [],
  ...(applicationId ? { applicationId } : {}),
})

const host: HostModel = {
  name: 'Landscape',
  customerName: 'Acme',
  elements: [
    element('billing', 'Billing'),
    element('crm', 'CRM'),
    element('api', 'Billing API', { kind: 'component', parentApplicationId: 'billing' }),
    element('who', 'Clerk', { kind: 'actor' }),
  ],
  connections: [{ id: 'c1', sourceId: 'crm', targetId: 'billing', isBidirectional: false }],
  diagrams: [
    {
      id: 'l7', kind: 'layer7', name: 'L7',
      placements: [
        { elementId: 'billing', zone: 'landscape', domainGroup: 'Finance', x: 100, y: 400 },
        { elementId: 'crm', zone: 'landscape', x: 400, y: 400 },
        { elementId: 'who', zone: 'actors', x: 20, y: 20 },
      ],
    },
  ],
  decisions: [
    decision('adr-1', 1, 'Keep the ledger'),
    decision('adr-2', 2, 'Retire the fax', 'accepted'),
    decision('adr-3', 1, 'Billing on Kestrel', 'reviewing', 'billing'),
  ],
}

function view(model: Model, over: Partial<WriteView> = {}): WriteView {
  let counter = 0
  return {
    model,
    current: () => toArrays(model),
    activeDiagramId: 'l7',
    groupDecisions: [decision('g-1', 1, 'One identity provider')],
    ids: idPolicy(() => [...model.order.elements, ...model.order.connections, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-09-07',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    ...over,
  }
}

const prepared = (out: Prepared | AgentAnswer): Prepared => {
  if ('ok' in out) throw new Error(`refused: ${JSON.stringify(out)}`)
  return out
}
const answerOf = (out: Prepared | AgentAnswer): Record<string, unknown> => {
  const held = prepared(out).answer
  if (!held.ok || held.content[0].type !== 'text') throw new Error('not an answer')
  return JSON.parse(held.content[0].text)
}

/** Apply, then apply the inverse, and insist the bytes are the same. */
function roundTrip(model: Model, out: Prepared | AgentAnswer): Model {
  const { command } = prepared(out)
  const before = JSON.stringify(toArrays(model))
  const applied = apply(model, command)
  if (!applied.ok) throw new Error(`the reducer refused: ${applied.reason}`)
  const undone = apply(applied.model, applied.inverse)
  if (!undone.ok) throw new Error(`undo refused: ${undone.reason}`)
  expect(JSON.stringify(toArrays(undone.model))).toBe(before)
  return applied.model
}

describe('every write, applied and undone', () => {
  const model = fromArrays(host)
  const cases: [ToolName, unknown][] = [
    ['element.add', { name: 'Warehouse', vendor: 'Kestrel' }],
    ['element.add', { name: 'Ops console', kind: 'managementTool', zone: 'management' }],
    ['element.update', { id: 'billing', description: 'Sends the invoices.', lifecycle: 'retiring' }],
    ['element.remove', { id: 'billing' }],
    ['connect', { sourceId: 'billing', targetId: 'crm', label: 'invoices', protocol: 'REST' }],
    ['connect', { sourceId: 'billing', targetId: 'crm', color: '#C0392B', lineStyle: 'dashed' }],
    ['connection.update', { id: 'c1', label: 'orders', isBidirectional: true }],
    ['connection.update', { id: 'c1', color: '#2e86c1', lineStyle: 'dotted' }],
    ['connection.remove', { id: 'c1' }],
    ['decision.propose', { title: 'Move CRM to the cloud' }],
    ['decision.propose', { title: 'Split the API', applicationId: 'billing', body: '# Custom' }],
    ['decision.transition', { id: 'adr-1', status: 'reviewing' }],
    ['decision.transition', { id: 'adr-3', status: 'accepted' }],
    ['diagram.create', { kind: 'layer7', name: 'Target state' }],
    ['diagram.create', { kind: 'container', applicationId: 'billing' }],
    ['moveBy', { elementIds: ['billing', 'crm'], dx: 40, dy: -20 }],
    ['placeNextTo', { elementId: 'crm', anchorId: 'billing', side: 'below', gap: 24 }],
    ['group', { name: 'Finance', elementIds: ['crm'] }],
    ['group', { name: 'Sales', elementIds: ['crm'], color: '#2e86c1' }],
    ['align', { elementIds: ['billing', 'crm'], axis: 'top' }],
    ['distribute', { elementIds: ['billing', 'crm', 'who'], axis: 'horizontal' }],
  ]
  for (const [tool, args] of cases) {
    it(`${tool} ${JSON.stringify(args)}`, () => {
      const out = commandFor(tool, args, view(model))
      const command = prepared(out).command
      expect(command.type === 'transaction' ? command.origin : command.origin).toBe('agent')
      roundTrip(model, out)
    })
  }
})

describe('element.add', () => {
  const model = fromArrays(host)

  it('gives the element the key the file would, and lands it in its band', () => {
    const out = commandFor('element.add', { name: 'Billing', kind: 'actor' }, view(model))
    expect(answerOf(out)).toMatchObject({ id: 'billing-2', kind: 'actor', diagramId: 'l7', zone: 'actors' })
    const after = roundTrip(model, out)
    expect(after.elements['billing-2']).toMatchObject({ name: 'Billing', kind: 'actor', isManaged: false })
    expect(after.diagrams['l7'].placements['billing-2']).toMatchObject({ zone: 'actors' })
  })

  it('takes a spot and a group when told, and refuses a diagram it does not have', () => {
    const out = commandFor('element.add', { name: 'Ledger', x: 10, y: 20, domainGroup: 'Finance' }, view(model))
    expect(answerOf(out)).toMatchObject({ x: 10, y: 20 })
    expect(prepared(out).command).toMatchObject({ type: 'transaction' })
    expect(commandFor('element.add', { name: 'Ledger', diagramId: 'nope' }, view(model)))
      .toMatchObject({ ok: false, refusal: 'agent.unknownId' })
    expect(commandFor('element.add', { name: '   ' }, view(model)))
      .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('files a component under the application of the container view it is drawn on', () => {
    const withContainer = roundTrip(model, commandFor('diagram.create', { kind: 'container', applicationId: 'billing' }, view(model)))
    const held = view(withContainer, { activeDiagramId: 'cd-new-1' })
    const out = commandFor('element.add', { name: 'Queue', kind: 'component' }, held)
    const after = roundTrip(withContainer, out)
    expect(after.elements['queue']).toMatchObject({ parentApplicationId: 'billing' })
  })
})

describe('the refusals before the reducer', () => {
  const model = fromArrays(host)
  const refuse = (tool: ToolName, args: unknown) => commandFor(tool, args, view(model))

  it('names an id nothing has', () => {
    expect(refuse('element.update', { id: 'ghost', name: 'x' })).toMatchObject({ refusal: 'agent.unknownId', detail: 'element ghost' })
    expect(refuse('connect', { sourceId: 'billing', targetId: 'ghost' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(refuse('connection.update', { id: 'c9', label: 'x' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(refuse('decision.transition', { id: 'adr-9', status: 'reviewing' })).toMatchObject({ refusal: 'agent.unknownId' })
  })

  it('will not connect an element to itself', () => {
    expect(refuse('connect', { sourceId: 'billing', targetId: 'billing' })).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('keeps a locked decision locked, and a group’s where it is', () => {
    expect(refuse('decision.transition', { id: 'adr-2', status: 'superseded', supersededBy: 'adr-1' }))
      .toMatchObject({ refusal: 'agent.locked' })
    expect(refuse('decision.transition', { id: 'g-1', status: 'reviewing' })).toMatchObject({ refusal: 'agent.readOnly' })
  })

  it('follows the status machine, and wants a successor for superseded', () => {
    expect(refuse('decision.transition', { id: 'adr-1', status: 'accepted' }))
      .toMatchObject({ refusal: 'agent.badArguments', detail: 'proposed can only move to reviewing' })
    expect(refuse('decision.transition', { id: 'adr-3', status: 'superseded' })).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('numbers a decision after the last one in its own list', () => {
    expect(answerOf(refuse('decision.propose', { title: 'Landscape-level' }))).toMatchObject({ number: 3 })
    expect(answerOf(refuse('decision.propose', { title: 'About billing', applicationId: 'billing' }))).toMatchObject({ number: 2 })
  })

  it('refuses to move what is not drawn on the diagram', () => {
    expect(refuse('moveBy', { elementIds: ['api'], dx: 1, dy: 1 })).toMatchObject({ refusal: 'agent.notDrawn', detail: 'api' })
    expect(refuse('placeNextTo', { elementId: 'api', anchorId: 'billing' })).toMatchObject({ refusal: 'agent.notDrawn' })
  })

  it('switches to a container view that already exists rather than making a second', () => {
    const withContainer = roundTrip(model, commandFor('diagram.create', { kind: 'container', applicationId: 'billing' }, view(model)))
    const again = prepared(commandFor('diagram.create', { kind: 'container', applicationId: 'billing' }, view(withContainer)))
    expect(again.activeDiagramId).toBe('cd-new-1')
    expect(again.command).toEqual({ type: 'transaction', commands: [] })
  })
})

describe('relational placement', () => {
  const model = fromArrays(host)

  it('puts an element beside its anchor, in the anchor’s band and group', () => {
    const out = commandFor('placeNextTo', { elementId: 'who', anchorId: 'billing', side: 'right' }, view(model))
    // An application card is 200 wide; right of it with the default gap.
    expect(answerOf(out)).toMatchObject({ elementId: 'who', x: 340, y: 400, zone: 'landscape', domainGroup: 'Finance' })
  })

  it('aligns and distributes with the canonical sizes', () => {
    const aligned = answerOf(commandFor('align', { elementIds: ['billing', 'crm', 'who'], axis: 'left' }, view(model)))
    expect(aligned).toMatchObject({ moved: [{ elementId: 'billing', x: 20 }, { elementId: 'crm', x: 20 }] })
    const spaced = answerOf(commandFor('distribute', { elementIds: ['who', 'billing', 'crm'], axis: 'horizontal' }, view(model)))
    expect((spaced.moved as unknown[]).length).toBe(1)
  })
})

describe('the look of a line', () => {
  const model = fromArrays(host)

  it('keeps a colour as the model does, and leaves the theme its line when nothing is asked', () => {
    const drawn = prepared(commandFor('connect', { sourceId: 'billing', targetId: 'crm', color: '#C0392B', lineStyle: 'dashed' }, view(model))).command
    if (drawn.type !== 'connection.create') throw new Error(drawn.type)
    expect(drawn.connection).toMatchObject({ color: '#c0392b', lineStyle: 'dashed' })
    const plain = prepared(commandFor('connect', { sourceId: 'billing', targetId: 'crm' }, view(model))).command
    if (plain.type !== 'connection.create') throw new Error(plain.type)
    expect('color' in plain.connection).toBe(false)
    expect('lineStyle' in plain.connection).toBe(false)
  })

  it('takes solid and an empty colour as deletions, so the line falls back to the theme', () => {
    const out = prepared(commandFor('connection.update', { id: 'c1', color: '', lineStyle: 'solid' }, view(model))).command
    if (out.type !== 'connection.update') throw new Error(out.type)
    expect(Object.keys(out.patch)).toEqual(['color', 'lineStyle'])
    expect(out.patch.color).toBeUndefined()
    expect(out.patch.lineStyle).toBeUndefined()
  })

  it('refuses a colour that is not a hex', () => {
    expect(commandFor('connection.update', { id: 'c1', color: 'red' }, view(model))).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
    expect(commandFor('connect', { sourceId: 'billing', targetId: 'crm', color: '#abc' }, view(model))).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})

describe('group', () => {
  const model = fromArrays(host)
  const crm = placementRect('application', { elementId: 'crm', x: 400, y: 400 })

  it('draws a new box around its members, the way the editor does, and files them', () => {
    const out = commandFor('group', { name: 'Sales', elementIds: ['crm'], color: '#2E86C1' }, view(model))
    expect(answerOf(out)).toMatchObject({ name: 'Sales', created: true, box: groupRectAround([crm]), members: ['crm'] })
    const after = roundTrip(model, out)
    expect(after.diagrams.l7.placements.crm.domainGroup).toBe('Sales')
    expect(after.diagrams.l7.layoutConfig?.domainGroups).toEqual([{ name: 'Sales', ...groupRectAround([crm]), color: '#2e86c1' }])
  })

  it('grows an existing box to take a member in, never moving or shrinking it', () => {
    const boxed = fromArrays({
      ...host,
      diagrams: [{ ...host.diagrams[0], layoutConfig: { domainGroups: [{ name: 'Finance', x: 40, y: 300, width: 300, height: 200, color: '#111111' }] } }],
    })
    const out = commandFor('group', { name: 'Finance', elementIds: ['crm'] }, view(boxed))
    const grown = unionRects([{ x: 40, y: 300, width: 300, height: 200 }, groupRectAround([crm])!])
    expect(answerOf(out)).toMatchObject({ name: 'Finance', created: false, box: grown })
    const after = roundTrip(boxed, out)
    expect(after.diagrams.l7.layoutConfig?.domainGroups).toEqual([{ name: 'Finance', ...grown, color: '#111111' }])
    // The name is the key: no second Finance.
    expect(after.diagrams.l7.layoutConfig?.domainGroups?.length).toBe(1)
  })

  it('recolours an existing box on its own, and wants a member for a new one', () => {
    const boxed = fromArrays({
      ...host,
      diagrams: [{ ...host.diagrams[0], layoutConfig: { domainGroups: [{ name: 'Finance', x: 40, y: 300, width: 300, height: 200 }] } }],
    })
    const after = roundTrip(boxed, commandFor('group', { name: 'Finance', color: '#aa0000' }, view(boxed)))
    expect(after.diagrams.l7.layoutConfig?.domainGroups?.[0]).toMatchObject({ x: 40, y: 300, width: 300, height: 200, color: '#aa0000' })
    expect(commandFor('group', { name: 'Fresh' }, view(boxed))).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('groups only landscape cards, and only on a landscape', () => {
    expect(commandFor('group', { name: 'People', elementIds: ['who'] }, view(model))).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
    expect(commandFor('group', { name: 'People', elementIds: ['nobody'] }, view(model))).toMatchObject({ ok: false, refusal: 'agent.unknownId' })
    expect(commandFor('group', { name: 'People', elementIds: ['api'] }, view(model))).toMatchObject({ ok: false, refusal: 'agent.notDrawn' })
    const withContainer = roundTrip(model, commandFor('diagram.create', { kind: 'container', applicationId: 'billing' }, view(model)))
    const container = withContainer.order.diagrams.find((id) => withContainer.diagrams[id].kind === 'container')!
    expect(commandFor('group', { name: 'People', elementIds: ['api'], diagramId: container }, view(withContainer)))
      .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})

describe('over the generated landscape', () => {
  const model = fromArrays(syntheticModel('large'))

  it('adds, connects, moves and undoes without leaving a byte behind', () => {
    const held = view(model, { activeDiagramId: 'landscape' })
    roundTrip(model, commandFor('element.add', { name: 'Fresh gateway' }, held))
    roundTrip(model, commandFor('connect', { sourceId: 'app-0001', targetId: 'app-0002' }, held))
    roundTrip(model, commandFor('element.remove', { id: 'app-0001' }, held))
    roundTrip(model, commandFor('align', { elementIds: ['app-0001', 'app-0002', 'app-0003'], axis: 'centerY' }, held))
  })
})

describe('the plan tools (ADR-0010)', () => {
  const plan = {
    id: 'tr-1', number: 1, title: 'Replace billing', status: 'agreed' as const,
    elements: [{ elementId: 'billing', role: 'retires' as const }, { elementId: 'crm', role: 'introduces' as const }],
    decisions: [], milestones: [], body: '',
  }
  // c1 joins billing to crm — the introduced element — so it is the tap, not
  // an interface that moves. c2 is one that does.
  const withPlan = fromArrays({
    ...host,
    connections: [...host.connections, { id: 'c2', sourceId: 'billing', targetId: 'who', isBidirectional: false, protocol: 'REST' }],
    transitions: [plan],
  })

  it('plan.replace writes the whole gesture as one step, and undoes as one', () => {
    const out = commandFor('plan.replace', { elementId: 'billing', newName: 'Billing next', shadowFrom: '2027-03-01', cutover: '2027-09-01' }, view(fromArrays(host)))
    expect(answerOf(out)).toMatchObject({ planId: 'tr-new-1', toId: 'billing-next' })
    const after = roundTrip(fromArrays(host), out)
    expect(after.elements['billing-next']).toMatchObject({ lifecycle: 'planned', lifecycleDates: { live: '2027-03-01' } })
    expect(after.elements.billing).toMatchObject({ successorId: 'billing-next', lifecycleDates: { retiring: '2027-03-01', retired: '2027-09-01' } })
    expect(Object.keys(after.transitions ?? {})).toEqual(['tr-new-1'])
    // Drawn beside the old one on the board the old one is on.
    expect(after.diagrams.l7.placements['billing-next']).toMatchObject({ zone: 'landscape', domainGroup: 'Finance' })
  })

  it('plan.replace takes an existing successor, a split and a merge', () => {
    const out = commandFor('plan.replace', {
      elementId: 'billing', existingId: 'crm', stays: true, alsoRetiring: ['who'], shadowFrom: '2027-03-01', cutover: '2027-09-01',
    }, view(fromArrays(host)))
    const after = roundTrip(fromArrays(host), out)
    const written = Object.values(after.transitions ?? {})[0]
    expect(written.elements).toEqual([
      { elementId: 'billing', role: 'changes' }, { elementId: 'who', role: 'retires' }, { elementId: 'crm', role: 'introduces' },
    ])
  })

  it('plan.replace refuses what it cannot do', () => {
    const refuse = (args: unknown) => commandFor('plan.replace', args, view(fromArrays(host)))
    expect(refuse({ elementId: 'ghost', newName: 'x', shadowFrom: '2027-03-01', cutover: '2027-09-01' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(refuse({ elementId: 'billing', shadowFrom: '2027-03-01', cutover: '2027-09-01' })).toMatchObject({ refusal: 'agent.badArguments' })
    expect(refuse({ elementId: 'billing', existingId: 'billing', shadowFrom: '2027-03-01', cutover: '2027-09-01' })).toMatchObject({ refusal: 'agent.badArguments' })
    expect(refuse({ elementId: 'billing', newName: 'x', shadowFrom: '2027-09-01', cutover: '2027-03-01' })).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('plan.port moves one interface, or every one not yet planned, and undoes as one', () => {
    const one = commandFor('plan.port', { planId: 'tr-1', connectionId: 'c2', on: '2027-05-01' }, view(withPlan))
    expect(answerOf(one)).toMatchObject({ moved: ['c2'], toId: 'crm' })
    const after = roundTrip(withPlan, one)
    expect(after.connections.c2.validUntil).toBe('2027-04-30')
    const twin = Object.values(after.connections).find((c) => c.id !== 'c1' && c.id !== 'c2')
    expect(twin).toMatchObject({ sourceId: 'crm', targetId: 'who', protocol: 'REST', validFrom: '2027-05-01' })
    // And all of them at once, when no line is named.
    const all = commandFor('plan.port', { planId: 'tr-1', on: '2027-06-01' }, view(withPlan))
    expect(answerOf(all)).toMatchObject({ moved: ['c2'] })
    roundTrip(withPlan, all)
  })

  it('plan.port refuses an unknown plan or interface, and asks which target when there are several', () => {
    const refuse = (args: unknown, model = withPlan) => commandFor('plan.port', args, view(model))
    expect(refuse({ planId: 'tr-9', on: '2027-05-01' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(refuse({ planId: 'tr-1', connectionId: 'c9', on: '2027-05-01' })).toMatchObject({ refusal: 'agent.unknownId' })
    // The tap is not an interface of the plan.
    expect(refuse({ planId: 'tr-1', connectionId: 'c1', on: '2027-05-01' })).toMatchObject({ refusal: 'agent.unknownId' })
    const two = fromArrays({ ...host, transitions: [{ ...plan, elements: [...plan.elements, { elementId: 'who', role: 'introduces' as const }] }] })
    expect(refuse({ planId: 'tr-1', on: '2027-05-01' }, two)).toMatchObject({ refusal: 'agent.badArguments' })
  })
})
