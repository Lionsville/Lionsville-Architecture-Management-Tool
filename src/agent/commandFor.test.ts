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
import { inspect } from './inspect'
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
  relations: [{ type: 'flow', id: 'c1', sourceId: 'crm', targetId: 'billing', isBidirectional: false }],
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
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
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
    ['connection.update', { id: 'c1', validFrom: '2027-01-01', validUntil: '2027-06-30' }],
    ['connections.update', { items: [{ id: 'c1', label: 'orders', validUntil: '2027-06-30' }] }],
    ['connection.remove', { id: 'c1' }],
    ['connections.remove', { ids: ['c1', 'c1'] }],
    ['relation.add', { type: 'supports', sourceId: 'billing', targetId: 'crm', validFrom: '2027-03-01' }],
    ['relation.add', { type: 'assigned', sourceId: 'who', targetId: 'billing' }],
    ['relation.update', { id: 'c1', type: 'realises', label: 'how it is done' }],
    ['relation.remove', { id: 'c1' }],
    ['decision.propose', { title: 'Move CRM to the cloud' }],
    ['decision.propose', { title: 'Split the API', applicationId: 'billing', body: '# Custom' }],
    ['decision.propose', { title: 'Sign it', signers: [{ name: 'Ada', role: 'CTO', verdict: 'approved', signedAt: '2026-09-01' }] }],
    ['decision.update', { id: 'adr-1', title: 'Keep the ledger, for now', body: '# Revised', date: '2026-09-05' }],
    ['decision.update', { id: 'adr-1', signers: [{ name: 'Ada' }] }],
    ['decision.remove', { id: 'adr-1' }],
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

describe('an element’s dates, successor, owner and look (ADR-0009)', () => {
  const model = fromArrays(host)

  it('element.update writes the three dates as one field, clears one with null, and undoes', () => {
    const dated = commandFor('element.update', {
      id: 'billing', liveOn: '2026-01-01', retiringOn: '2027-03-01', retiredOn: '2027-09-01', successorId: 'crm', owner: 'Finance',
    }, view(model))
    expect(answerOf(dated)).toMatchObject({ changed: ['owner', 'successorId', 'lifecycleDates'] })
    const after = roundTrip(model, dated)
    expect(after.elements.billing).toMatchObject({
      owner: 'Finance', successorId: 'crm', lifecycleDates: { live: '2026-01-01', retiring: '2027-03-01', retired: '2027-09-01' },
    })
    const cleared = commandFor('element.update', { id: 'billing', retiringOn: null, owner: null }, view(after))
    const applied = apply(after, prepared(cleared).command)
    if (!applied.ok) throw new Error(applied.reason)
    expect(applied.model.elements.billing.lifecycleDates).toEqual({ live: '2026-01-01', retired: '2027-09-01' })
    expect(applied.model.elements.billing).not.toHaveProperty('owner')
    // The last date gone takes the field with it.
    const none = commandFor('element.update', { id: 'billing', liveOn: null, retiredOn: null }, view(applied.model))
    const emptied = apply(applied.model, prepared(none).command)
    expect(emptied.ok && emptied.model.elements.billing).not.toHaveProperty('lifecycleDates')
  })

  it('leaves dates out of order to the reducer, and refuses what is not a day or not an element', () => {
    const backwards = commandFor('element.update', { id: 'billing', liveOn: '2027-09-01', retiredOn: '2027-03-01' }, view(model))
    expect(apply(model, prepared(backwards).command)).toMatchObject({ ok: false, reason: 'command.datesOutOfOrder' })
    expect(commandFor('element.update', { id: 'billing', liveOn: 'soon' }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('element.update', { id: 'billing', successorId: 'ghost' }, view(model))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('element.update', { id: 'billing', successorId: 'billing' }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('merges aspects, takes one off with null, and keeps a note the person wrote', () => {
    const noted = fromArrays({
      ...host,
      elements: host.elements.map((e) => (e.id === 'billing' ? { ...e, aspects: { platform: { status: 'partial' as const, note: 'On the old VMs' }, dr: { status: 'none' as const } } } : e)),
    })
    const out = commandFor('element.update', { id: 'billing', aspects: { platform: 'managed', dr: null, cicd: 'atRisk' } }, view(noted))
    const after = roundTrip(noted, out)
    expect(after.elements.billing.aspects).toEqual({ platform: { status: 'managed', note: 'On the old VMs' }, cicd: { status: 'atRisk' } })
    expect(commandFor('element.update', { id: 'billing', aspects: { platform: 'great' } }, view(noted))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('sets and clears the accent and the icon', () => {
    const on = roundTrip(model, commandFor('element.update', { id: 'billing', accentColor: '#2E86C1', iconKey: 'postgres' }, view(model)))
    expect(on.elements.billing).toMatchObject({ accentColor: '#2e86c1', iconKey: 'postgres' })
    const off = apply(on, prepared(commandFor('element.update', { id: 'billing', accentColor: '', iconKey: null }, view(on))).command)
    expect(off.ok && off.model.elements.billing).not.toHaveProperty('accentColor')
    expect(off.ok && off.model.elements.billing).not.toHaveProperty('iconKey')
    expect(commandFor('element.update', { id: 'billing', accentColor: 'blue' }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('element.add takes the same fields', () => {
    const out = commandFor('element.add', { name: 'Ledger', liveOn: '2027-01-01', lifecycle: 'planned', owner: 'Finance', aspects: { dr: 'managed' } }, view(model))
    const after = roundTrip(model, out)
    expect(after.elements.ledger).toMatchObject({ lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' }, owner: 'Finance', aspects: { dr: { status: 'managed' } } })
  })
})

describe('a decision record an agent may correct', () => {
  const model = fromArrays(host)

  it('decision.update changes what is given on a record still being written, and answers with the label', () => {
    const out = commandFor('decision.update', { id: 'adr-1', title: ' Keep the ledger, twice ', signers: [{ name: 'Ada', role: 'CTO' }] }, view(model))
    expect(answerOf(out)).toEqual({ id: 'adr-1', label: 'ADR-0001', changed: ['title', 'signers'] })
    const after = roundTrip(model, out)
    expect(after.decisions?.['adr-1']).toMatchObject({ title: 'Keep the ledger, twice', signers: [{ name: 'Ada', role: 'CTO' }], body: '# body' })
  })

  it('decision.update and decision.remove keep a locked record locked, and a group’s where it is', () => {
    expect(commandFor('decision.update', { id: 'adr-2', title: 'x' }, view(model))).toMatchObject({ refusal: 'agent.locked' })
    expect(commandFor('decision.remove', { id: 'adr-2' }, view(model))).toMatchObject({ refusal: 'agent.locked' })
    expect(commandFor('decision.update', { id: 'g-1', title: 'x' }, view(model))).toMatchObject({ refusal: 'agent.readOnly' })
    expect(commandFor('decision.remove', { id: 'ghost' }, view(model))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('decision.update', { id: 'adr-1', date: 'yesterday' }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('decision.update', { id: 'adr-1', signers: [{ name: ' ' }] }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('decision.remove takes a proposed record and unlinks whoever it superseded', () => {
    const chain = fromArrays({
      ...host,
      decisions: [
        ...host.decisions!.map((adr) => (adr.id === 'adr-2' ? { ...adr, status: 'superseded' as const, supersededBy: 'adr-1' } : adr)),
      ],
    })
    const out = commandFor('decision.remove', { id: 'adr-1' }, view(chain))
    expect(answerOf(out)).toMatchObject({ id: 'adr-1', label: 'ADR-0001', removed: true })
    const after = roundTrip(chain, out)
    expect(after.decisions?.['adr-1']).toBeUndefined()
    expect(after.decisions?.['adr-2']).not.toHaveProperty('supersededBy')
  })

  it('decision.propose links the plans that rest on it in the same step', () => {
    const withPlan = fromArrays({
      ...host,
      transitions: [{ id: 'tr-1', number: 1, title: 'Move', status: 'draft' as const, elements: [], decisions: ['adr-1'], milestones: [], body: '' }],
    })
    const out = commandFor('decision.propose', { title: 'Use PostgreSQL', planIds: ['TR-0001', 'tr-1'] }, view(withPlan))
    expect(answerOf(out)).toMatchObject({ label: 'ADR-0003', plans: ['tr-1'] })
    const after = roundTrip(withPlan, out)
    expect(after.transitions?.['tr-1'].decisions).toEqual(['adr-1', 'adr-new-1'])
    expect(commandFor('decision.propose', { title: 'x', planIds: ['tr-9'] }, view(withPlan))).toMatchObject({ refusal: 'agent.unknownId' })
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

describe('a line’s window, and lines in bulk (ADR-0009)', () => {
  const model = fromArrays(host)

  it('connect dates a temporary line, and connection.update clears a day with null', () => {
    const drawn = roundTrip(model, commandFor('connect', { sourceId: 'billing', targetId: 'who', validFrom: '2027-01-01', validUntil: '2027-03-31', label: 'sync' }, view(model)))
    const line = Object.values(drawn.relations).find((c) => c.id !== 'c1')!
    expect(line).toMatchObject({ validFrom: '2027-01-01', validUntil: '2027-03-31', label: 'sync' })
    const cleared = apply(drawn, prepared(commandFor('connection.update', { id: line.id, validUntil: null, label: null }, view(drawn))).command)
    expect(cleared.ok && cleared.model.relations[line.id]).not.toHaveProperty('validUntil')
    expect(cleared.ok && cleared.model.relations[line.id]).not.toHaveProperty('label')
    expect(cleared.ok && cleared.model.relations[line.id].validFrom).toBe('2027-01-01')
  })

  it('refuses a window that runs backwards, against what the line keeps', () => {
    const dated = roundTrip(model, commandFor('connection.update', { id: 'c1', validFrom: '2027-06-01' }, view(model)))
    expect(commandFor('connection.update', { id: 'c1', validUntil: '2027-01-01' }, view(dated))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('connect', { sourceId: 'billing', targetId: 'who', validFrom: 'June' }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('connections.update lands every change or none, and says which item was wrong', () => {
    const two = roundTrip(model, commandFor('connect', { sourceId: 'billing', targetId: 'who' }, view(model)))
    const other = Object.keys(two.relations).find((id) => id !== 'c1')!
    const out = commandFor('connections.update', { items: [{ id: 'c1', protocol: 'REST' }, { id: other, isBidirectional: true }] }, view(two))
    expect(answerOf(out)).toEqual({ updated: [{ id: 'c1', changed: ['protocol'] }, { id: other, changed: ['isBidirectional'] }] })
    const after = roundTrip(two, out)
    expect(after.relations.c1.protocol).toBe('REST')
    expect(after.relations[other].isBidirectional).toBe(true)
    expect(commandFor('connections.update', { items: [{ id: 'c1' }, { id: 'c9' }] }, view(two))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('connections.update', { items: [{ id: 'c1' }, { id: other, validFrom: 'x' }] }, view(two)))
      .toMatchObject({ refusal: 'agent.badArguments', detail: 'items[1]: validFrom must be yyyy-mm-dd' })
  })

  it('connections.remove cuts them all as one step, or none', () => {
    const two = roundTrip(model, commandFor('connect', { sourceId: 'billing', targetId: 'who' }, view(model)))
    const other = Object.keys(two.relations).find((id) => id !== 'c1')!
    const after = roundTrip(two, commandFor('connections.remove', { ids: ['c1', other] }, view(two)))
    expect(after.order.relations).toEqual([])
    expect(commandFor('connections.remove', { ids: ['c1', 'c9'] }, view(two))).toMatchObject({ refusal: 'agent.unknownId' })
  })
})

/**
 * The four types the business layer needs (ADR-0012 §5). `connect` and
 * `connection.*` keep their names and mean `flow`, because a tool name is a
 * client's configuration; these three are how everything else is said.
 */
describe('a typed relation', () => {
  const model = fromArrays(host)

  it('adds one with a window, and says what it made', () => {
    const out = commandFor('relation.add', {
      type: 'supports', sourceId: 'billing', targetId: 'crm', label: 'invoicing', validFrom: '2027-03-01',
    }, view(model))
    expect(answerOf(out)).toMatchObject({ type: 'supports', sourceId: 'billing', targetId: 'crm' })
    const after = roundTrip(model, out)
    const row = Object.values(after.relations).find((r) => r.id !== 'c1')!
    expect(row).toMatchObject({ type: 'supports', label: 'invoicing', validFrom: '2027-03-01' })
    // Nothing a flow means by itself is invented for a row that has no use for it.
    expect(row).not.toHaveProperty('isBidirectional')
    expect(row).not.toHaveProperty('protocol')
  })

  it('changes what a row means, and the days it holds', () => {
    const after = roundTrip(model, commandFor('relation.update', { id: 'c1', type: 'serves', validUntil: '2028-01-31' }, view(model)))
    expect(after.relations.c1).toMatchObject({ type: 'serves', validUntil: '2028-01-31' })
  })

  it('removes one, and refuses an id nobody holds', () => {
    expect(roundTrip(model, commandFor('relation.remove', { id: 'c1' }, view(model))).order.relations).toEqual([])
    expect(commandFor('relation.remove', { id: 'c9' }, view(model))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('relation.update', { id: 'c9', label: 'x' }, view(model))).toMatchObject({ refusal: 'agent.unknownId' })
  })

  it('refuses an end nobody holds, a row that joins a thing to itself, and a window that runs backwards', () => {
    expect(commandFor('relation.add', { type: 'supports', sourceId: 'billing', targetId: 'nope' }, view(model)))
      .toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('relation.add', { type: 'supports', sourceId: 'billing', targetId: 'billing' }, view(model)))
      .toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('relation.add', { type: 'supports', sourceId: 'billing', targetId: 'crm', validFrom: '2027-06-01', validUntil: '2027-01-01' }, view(model)))
      .toMatchObject({ refusal: 'agent.badArguments' })
  })
})

describe('where a card goes (the placement fixes)', () => {
  const model = fromArrays(host)
  const boxed = fromArrays({
    ...host,
    diagrams: [{ ...host.diagrams[0], layoutConfig: { domainGroups: [{ name: 'Finance', x: 60, y: 360, width: 300, height: 200 }] } }],
  })
  const applied = (m: Model, out: Prepared | AgentAnswer): Model => {
    const result = apply(m, prepared(out).command)
    if (!result.ok) throw new Error(result.reason)
    return result.model
  }

  it('element.add with a group lands inside the group’s box, and draws the box when there is none', () => {
    const inside = roundTrip(boxed, commandFor('element.add', { name: 'Ledger', domainGroup: 'Finance' }, view(boxed)))
    const report = inspect(inside, inside.diagrams.l7)
    expect(inside.diagrams.l7.placements.ledger.domainGroup).toBe('Finance')
    expect(report.outsideGroup.total).toBe(0)
    expect(report.overlaps.total).toBe(0)
    expect(report.groups?.[0].members).toEqual(['billing', 'ledger'])
    // No box yet: one is drawn around the card, so the next drag keeps it filed.
    const drawn = roundTrip(model, commandFor('element.add', { name: 'Ledger', x: 900, y: 700, domainGroup: 'Ops' }, view(model)))
    expect(drawn.diagrams.l7.layoutConfig?.domainGroups).toEqual([expect.objectContaining({ name: 'Ops' })])
    expect(inspect(drawn, drawn.diagrams.l7).outsideGroup.some.map((one) => one.elementId)).not.toContain('ledger')
    expect(commandFor('element.add', { name: 'x', zone: 'actors', domainGroup: 'Finance' }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('placeNextTo keeps a card inside a side band, and grows the anchor’s group box to hold it', () => {
    // Below the clerk, in the actors band, is outside the band; the card is kept in it.
    const beside = commandFor('placeNextTo', { elementId: 'crm', anchorId: 'who', side: 'below', gap: 400 }, view(model))
    expect(answerOf(beside)).toMatchObject({ zone: 'actors', clamped: true })
    const report = inspect(applied(model, beside), applied(model, beside).diagrams.l7)
    expect(report.outsideZone.some.map((one) => one.elementId)).not.toContain('crm')
    // Sliding it back into the band would put it on the clerk; it takes a free slot instead.
    expect(report.overlaps.total).toBe(0)
    const grouped = roundTrip(boxed, commandFor('placeNextTo', { elementId: 'crm', anchorId: 'billing', side: 'right' }, view(boxed)))
    expect(grouped.diagrams.l7.placements.crm.domainGroup).toBe('Finance')
    expect(inspect(grouped, grouped.diagrams.l7).outsideGroup.total).toBe(0)
  })

  it('element.place sets a spot, refuses a spot in another band unless the band is named, and files under a group', () => {
    const moved = roundTrip(model, commandFor('element.place', { id: 'crm', x: 600, y: 500 }, view(model)))
    expect(moved.diagrams.l7.placements.crm).toMatchObject({ x: 600, y: 500, zone: 'landscape' })
    expect(commandFor('element.place', { id: 'crm', x: 20, y: 20 }, view(model))).toMatchObject({
      refusal: 'agent.badArguments', detail: '(20, 20) is in the actors band; say zone: actors to move it there',
    })
    const banded = roundTrip(model, commandFor('element.place', { id: 'crm', x: 300, y: 20, zone: 'actors' }, view(model)))
    expect(banded.diagrams.l7.placements.crm).toMatchObject({ zone: 'actors', x: 300, y: 20 })
    expect(inspect(banded, banded.diagrams.l7).outsideZone.some.map((one) => one.elementId)).not.toContain('crm')
    // Into a group with no spot given: a free slot inside its box, and the box holds it.
    const filed = roundTrip(boxed, commandFor('element.place', { id: 'crm', domainGroup: 'Finance' }, view(boxed)))
    expect(filed.diagrams.l7.placements.crm.domainGroup).toBe('Finance')
    expect(inspect(filed, filed.diagrams.l7)).toMatchObject({ outsideGroup: { total: 0 }, overlaps: { total: 0 } })
    const unfiled = applied(filed, commandFor('element.place', { id: 'crm', domainGroup: null }, view(filed)))
    expect(unfiled.diagrams.l7.placements.crm).not.toHaveProperty('domainGroup')
  })

  it('element.place refuses what it cannot do', () => {
    expect(commandFor('element.place', { id: 'crm', domainGroup: 'Ops' }, view(model))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('element.place', { id: 'api', x: 1, y: 1 }, view(model))).toMatchObject({ refusal: 'agent.notDrawn' })
    expect(commandFor('element.place', { id: 'ghost', x: 1, y: 1 }, view(model))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('element.place', { id: 'crm', x: 1 }, view(model))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('element.place', { id: 'who', domainGroup: 'Finance' }, view(boxed))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('element.draw puts an existing element on a board and element.undraw takes it off, leaving the landscape alone', () => {
    const drawn = roundTrip(model, commandFor('element.draw', { id: 'api', zone: 'management' }, view(model)))
    expect(drawn.diagrams.l7.placements.api).toMatchObject({ zone: 'management' })
    expect(commandFor('element.draw', { id: 'api' }, view(drawn))).toMatchObject({ refusal: 'agent.badArguments' })
    const undrawn = roundTrip(drawn, commandFor('element.undraw', { id: 'api' }, view(drawn)))
    expect(undrawn.diagrams.l7.placements.api).toBeUndefined()
    expect(undrawn.elements.api).toBeDefined()
    expect(commandFor('element.undraw', { id: 'api' }, view(undrawn))).toMatchObject({ refusal: 'agent.notDrawn' })
  })

  it('ungroup takes members out, or dissolves the group with its box', () => {
    const two = roundTrip(boxed, commandFor('placeNextTo', { elementId: 'crm', anchorId: 'billing' }, view(boxed)))
    const one = roundTrip(two, commandFor('ungroup', { name: 'Finance', elementIds: ['crm'] }, view(two)))
    expect(one.diagrams.l7.placements.crm).not.toHaveProperty('domainGroup')
    expect(one.diagrams.l7.placements.billing.domainGroup).toBe('Finance')
    expect(one.diagrams.l7.layoutConfig?.domainGroups).toHaveLength(1)
    const none = roundTrip(two, commandFor('ungroup', { name: 'Finance' }, view(two)))
    expect(none.diagrams.l7.placements.billing).not.toHaveProperty('domainGroup')
    expect(none.diagrams.l7.layoutConfig?.domainGroups).toEqual([])
    expect(commandFor('ungroup', { name: 'Ops' }, view(two))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('ungroup', { name: 'Finance', elementIds: ['who'] }, view(two))).toMatchObject({ refusal: 'agent.badArguments' })
  })
})

describe('the look of a line', () => {
  const model = fromArrays(host)

  it('keeps a colour as the model does, and leaves the theme its line when nothing is asked', () => {
    const drawn = prepared(commandFor('connect', { sourceId: 'billing', targetId: 'crm', color: '#C0392B', lineStyle: 'dashed' }, view(model))).command
    if (drawn.type !== 'relation.create') throw new Error(drawn.type)
    expect(drawn.relation).toMatchObject({ color: '#c0392b', lineStyle: 'dashed' })
    const plain = prepared(commandFor('connect', { sourceId: 'billing', targetId: 'crm' }, view(model))).command
    if (plain.type !== 'relation.create') throw new Error(plain.type)
    expect('color' in plain.relation).toBe(false)
    expect('lineStyle' in plain.relation).toBe(false)
  })

  it('takes solid and an empty colour as deletions, so the line falls back to the theme', () => {
    const out = prepared(commandFor('connection.update', { id: 'c1', color: '', lineStyle: 'solid' }, view(model))).command
    if (out.type !== 'relation.update') throw new Error(out.type)
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
    relations: [...host.relations, { type: 'flow', id: 'c2', sourceId: 'billing', targetId: 'who', isBidirectional: false, protocol: 'REST' }],
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
    expect(after.relations.c2.validUntil).toBe('2027-04-30')
    const twin = Object.values(after.relations).find((c) => c.id !== 'c1' && c.id !== 'c2')
    expect(twin).toMatchObject({ sourceId: 'crm', targetId: 'who', protocol: 'REST', validFrom: '2027-05-01' })
    // And all of them at once, when no line is named.
    const all = commandFor('plan.port', { planId: 'tr-1', on: '2027-06-01' }, view(withPlan))
    expect(answerOf(all)).toMatchObject({ moved: ['c2'] })
    roundTrip(withPlan, all)
  })

  it('plan.port leaves a line another plan closed alone, says so, and refuses it by name', () => {
    // c2 was ported by some other plan onto `who`'s new neighbour: closed, with
    // no twin on crm. c3 is this plan's to move.
    const elsewhere = fromArrays({
      ...host,
      relations: [
        ...host.relations,
        { type: 'flow', id: 'c2', sourceId: 'billing', targetId: 'who', isBidirectional: false, protocol: 'REST', validUntil: '2027-02-28' },
        { type: 'flow', id: 'c3', sourceId: 'api', targetId: 'billing', isBidirectional: false },
      ],
      transitions: [plan],
    })
    const all = commandFor('plan.port', { planId: 'TR-0001', on: '2027-06-01' }, view(elsewhere))
    expect(answerOf(all)).toMatchObject({ moved: ['c3'], skipped: [{ connectionId: 'c2', closedOn: '2027-02-28' }] })
    const after = roundTrip(elsewhere, all)
    expect(after.relations.c2.validUntil).toBe('2027-02-28')
    expect(commandFor('plan.port', { planId: 'tr-1', connectionId: 'c2', on: '2027-06-01' }, view(elsewhere))).toMatchObject({ refusal: 'agent.planned' })
    expect(commandFor('plan.port', { planId: 'tr-1', on: '2027-07-01' }, view(after))).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('plan.unport takes a port back as one step, and refuses one that is not this plan’s', () => {
    const ported = roundTrip(withPlan, commandFor('plan.port', { planId: 'tr-1', connectionId: 'c2', on: '2027-05-01' }, view(withPlan)))
    const back = commandFor('plan.unport', { planId: 'TR-1', connectionId: 'c2' }, view(ported))
    expect(answerOf(back)).toMatchObject({ connectionId: 'c2', unported: true })
    const after = roundTrip(ported, back)
    expect(Object.keys(after.relations)).toEqual(['c1', 'c2'])
    expect(after.relations.c2).not.toHaveProperty('validUntil')
    expect(commandFor('plan.unport', { planId: 'tr-1', connectionId: 'c2' }, view(withPlan))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('plan.unport', { planId: 'tr-1', connectionId: 'c9' }, view(withPlan))).toMatchObject({ refusal: 'agent.unknownId' })
    const closed = fromArrays({ ...toArrays(withPlan), relations: [...host.relations, { type: 'flow', id: 'c2', sourceId: 'billing', targetId: 'who', isBidirectional: false, validUntil: '2027-01-31' }] })
    expect(commandFor('plan.unport', { planId: 'tr-1', connectionId: 'c2' }, view(closed))).toMatchObject({ refusal: 'agent.planned' })
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

describe('a plan as a record an agent may write (ADR-0009)', () => {
  const plan = {
    id: 'tr-1', number: 1, title: 'Move the ledger', status: 'draft' as const,
    from: '2027-01-01', to: '2027-06-30', owner: 'Finance IT',
    elements: [{ elementId: 'billing', role: 'changes' as const }],
    decisions: ['adr-1'], milestones: [{ date: '2027-03-01', name: 'Pilot' }], body: '## Goal\n',
  }
  const withPlan = fromArrays({ ...host, transitions: [plan] })

  it('plan.create numbers the plan after the last, starts it from the template, and undoes as one', () => {
    const out = commandFor('plan.create', {
      title: 'Oracle to PostgreSQL', from: '2027-02-01', to: '2027-12-31', owner: 'Data', status: 'agreed',
      changes: ['billing', 'crm'], decisionIds: ['adr-2', 'g-1'],
    }, view(withPlan))
    // The template's fence reads: two named lines with nothing in them yet.
    expect(answerOf(out)).toMatchObject({ id: 'tr-new-1', label: 'TR-0002', status: 'agreed', businessCase: { state: 'computed', totalIn: 0 } })
    const after = roundTrip(withPlan, out)
    expect(after.transitions?.['tr-new-1']).toMatchObject({
      number: 2, owner: 'Data', decisions: ['adr-2', 'g-1'],
      elements: [{ elementId: 'billing', role: 'changes' }, { elementId: 'crm', role: 'changes' }],
    })
    expect(after.transitions?.['tr-new-1'].body).toContain('```business-case')
  })

  it('plan.create refuses an unknown element or decision, a double role, and a window that runs backwards', () => {
    const refuse = (args: unknown) => commandFor('plan.create', args, view(withPlan))
    expect(refuse({ title: 'x', introduces: ['ghost'] })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(refuse({ title: 'x', decisionIds: ['adr-9'] })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(refuse({ title: 'x', introduces: ['crm'], retires: ['crm'] })).toMatchObject({ refusal: 'agent.badArguments' })
    expect(refuse({ title: 'x', from: '2027-06-01', to: '2027-01-01' })).toMatchObject({ refusal: 'agent.badArguments' })
    expect(refuse({ title: '  ' })).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('plan.update changes only what is given, takes the label as the id, and clears with null', () => {
    const out = commandFor('plan.update', { id: 'TR-1', title: 'Move the ledger, twice', to: null, owner: null }, view(withPlan))
    expect(answerOf(out)).toMatchObject({ changed: ['title', 'to', 'owner'], from: '2027-01-01' })
    // Deep-equal rather than byte-equal here: a cleared field comes back at
    // the end of its row, which is the reducer's rule for every deletion.
    const applied = apply(withPlan, prepared(out).command)
    if (!applied.ok) throw new Error(applied.reason)
    const after = applied.model
    expect(after.transitions?.['tr-1']).toMatchObject({ title: 'Move the ledger, twice', from: '2027-01-01', status: 'draft' })
    expect(after.transitions?.['tr-1']).not.toHaveProperty('to')
    expect(after.transitions?.['tr-1']).not.toHaveProperty('owner')
    const undone = apply(after, applied.inverse)
    expect(undone.ok && toArrays(undone.model)).toEqual(toArrays(withPlan))
  })

  it('plan.update replaces one role list and leaves the others, and follows the status machine', () => {
    const out = commandFor('plan.update', { id: 'tr-1', introduces: ['crm'], status: 'agreed' }, view(withPlan))
    const after = roundTrip(withPlan, out)
    expect(after.transitions?.['tr-1'].elements).toEqual([
      { elementId: 'crm', role: 'introduces' }, { elementId: 'billing', role: 'changes' },
    ])
    expect(after.transitions?.['tr-1'].status).toBe('agreed')
    expect(commandFor('plan.update', { id: 'tr-1', status: 'done' }, view(withPlan))).toMatchObject({
      refusal: 'agent.badArguments', detail: 'draft can only move to agreed, abandoned',
    })
    expect(commandFor('plan.update', { id: 'tr-1', to: '2026-12-01' }, view(withPlan))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('plan.update', { id: 'tr-7' }, view(withPlan))).toMatchObject({ refusal: 'agent.unknownId' })
  })

  it('plan.update answers with what the body’s business case computes', () => {
    const body = [
      '## Business case', '', '```business-case', 'currency: EUR', 'discount rate: 10%', '',
      '| Line | Year 0 | Year 1 |', '| --- | --- | --- |', '| Investment | -100 | |', '| Savings | | 220 |', '```',
    ].join('\n')
    const out = commandFor('plan.update', { id: 'tr-1', body }, view(withPlan))
    const answered = answerOf(out) as { businessCase: { state: string; npv: number; periods: string[] } }
    expect(answered.businessCase.state).toBe('computed')
    expect(answered.businessCase.periods).toEqual(['Year 0', 'Year 1'])
    expect(answered.businessCase.npv).toBeCloseTo(-100 + 220 / 1.1, 6)
  })

  it('plan.remove takes the record and nothing else, and undoes', () => {
    const out = commandFor('plan.remove', { id: 'tr-0001' }, view(withPlan))
    expect(answerOf(out)).toMatchObject({ id: 'tr-1', label: 'TR-0001', removed: true })
    const after = roundTrip(withPlan, out)
    expect(after.transitions).toBeUndefined()
    expect(after.elements.billing).toBeDefined()
  })

  it('milestones are added in date order, moved or renamed by name, and taken off', () => {
    const added = commandFor('milestone.add', { planId: 'tr-1', date: '2027-02-01', name: 'Kick-off' }, view(withPlan))
    let model = roundTrip(withPlan, added)
    expect(model.transitions?.['tr-1'].milestones).toEqual([{ date: '2027-02-01', name: 'Kick-off' }, { date: '2027-03-01', name: 'Pilot' }])
    const moved = commandFor('milestone.update', { planId: 'tr-1', name: 'Kick-off', date: '2027-04-01', newName: 'Start' }, view(model))
    model = roundTrip(model, moved)
    expect(model.transitions?.['tr-1'].milestones).toEqual([{ date: '2027-03-01', name: 'Pilot' }, { date: '2027-04-01', name: 'Start' }])
    const removed = commandFor('milestone.remove', { planId: 'tr-1', name: 'Pilot' }, view(model))
    model = roundTrip(model, removed)
    expect(model.transitions?.['tr-1'].milestones).toEqual([{ date: '2027-04-01', name: 'Start' }])
  })

  it('milestones refuse a day that is not one, a name that is taken, and one that is not there', () => {
    expect(commandFor('milestone.add', { planId: 'tr-1', date: 'March', name: 'x' }, view(withPlan))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('milestone.add', { planId: 'tr-1', date: '2027-05-01', name: 'Pilot' }, view(withPlan))).toMatchObject({ refusal: 'agent.badArguments' })
    expect(commandFor('milestone.update', { planId: 'tr-1', name: 'Go-live' }, view(withPlan))).toMatchObject({ refusal: 'agent.unknownId' })
    expect(commandFor('milestone.remove', { planId: 'tr-9', name: 'Pilot' }, view(withPlan))).toMatchObject({ refusal: 'agent.unknownId' })
  })
})
