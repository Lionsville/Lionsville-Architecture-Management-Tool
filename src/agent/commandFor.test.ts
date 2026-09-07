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
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { syntheticModel } from '../model/testing/synthetic'
import { commandFor } from './commandFor'
import type { Prepared, WriteView } from './commandFor'
import type { AgentAnswer, ToolName } from './tools'

const element = (id: string, name: string, over: Partial<HostModel['elements'][number]> = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const,
  isManaged: true, aspects: {}, parameters: {}, ...over,
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
    ['connection.update', { id: 'c1', label: 'orders', isBidirectional: true }],
    ['connection.remove', { id: 'c1' }],
    ['decision.propose', { title: 'Move CRM to the cloud' }],
    ['decision.propose', { title: 'Split the API', applicationId: 'billing', body: '# Custom' }],
    ['decision.transition', { id: 'adr-1', status: 'reviewing' }],
    ['decision.transition', { id: 'adr-3', status: 'accepted' }],
    ['diagram.create', { kind: 'layer7', name: 'Target state' }],
    ['diagram.create', { kind: 'container', applicationId: 'billing' }],
    ['moveBy', { elementIds: ['billing', 'crm'], dx: 40, dy: -20 }],
    ['placeNextTo', { elementId: 'crm', anchorId: 'billing', side: 'below', gap: 24 }],
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
