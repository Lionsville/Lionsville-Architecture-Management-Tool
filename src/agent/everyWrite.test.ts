// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every agent write says so (ADR-0007).
 *
 * A step an agent took is marked `origin: 'agent'` on its outermost command,
 * and that mark is what the Activity list, the undo of an agent's own steps
 * and anything reading the log later tell an agent's work from a person's by.
 * A tool whose builder forgets it writes a step that reads as the person's.
 *
 * So this holds every tool that builds a command to it, not a sample: the
 * table below is typed over {@link CommandTool}, and a write tool added without
 * a case here does not compile. Each case is a request the reducer accepts,
 * built on the model the steps before it leave; the command must carry the
 * mark, and so must its inverse — the step that takes an agent's write back
 * is the agent's too. `batch` is the one write that is several tools in one
 * step, and `handle.test.ts` pins that its transaction carries the mark.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { laidOut } from '../model/testFixtures'
import { commandFor, isCommandTool } from './commandFor'
import type { CommandTool, Prepared, WriteView } from './commandFor'
import { TOOLS } from './tools'
import type { AgentAnswer, ToolName } from './tools'

const element = (id: string, name: string, over: Partial<HostModel['elements'][number]> = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over,
})

const host: HostModel = {
  name: 'Landscape',
  elements: [
    element('billing', 'Billing'),
    element('crm', 'CRM'),
    element('fax', 'Fax gateway'),
    element('api', 'Billing API', { kind: 'component', parentId: 'billing' }),
    element('who', 'Clerk', { kind: 'actor' }),
    element('bus', 'Message brokering', { kind: 'platformService' }),
  ],
  relations: [
    { type: 'flow', id: 'c1', sourceId: 'crm', targetId: 'billing', isBidirectional: false },
    { type: 'flow', id: 'c2', sourceId: 'billing', targetId: 'who', isBidirectional: false, protocol: 'REST' },
    { type: 'flow', id: 'x1', sourceId: 'crm', targetId: 'api', isBidirectional: false },
  ],
  diagrams: [
    laidOut({
      id: 'l7', kind: 'layer7', name: 'L7',
      groups: [{ id: 'finance', name: 'Finance' }],
      placements: [
        { id: 'billing', zone: 'landscape', group: 'finance', x: 100, y: 400 },
        { id: 'crm', zone: 'landscape', x: 400, y: 400 },
        { id: 'who', zone: 'actors', x: 20, y: 20 },
      ],
    }),
  ],
  decisions: [
    { id: 'adr-1', number: 1, title: 'Keep the ledger', status: 'proposed', date: '2026-09-01', body: '# body', signers: [] },
    { id: 'adr-2', number: 2, title: 'Split the API', status: 'reviewing', date: '2026-09-01', body: '# body', signers: [] },
  ],
  observations: [
    { id: 'ob-1', number: 1, title: 'Invoices arrive late', date: '2026-09-01', impact: 'major', seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }] },
    { id: 'ob-2', number: 2, title: 'Totals differ per channel', date: '2026-09-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }] },
  ],
  causes: [
    { id: 'ca-1', number: 1, title: 'Two systems compute it', state: 'verified', body: '', explains: [{ id: 'ob-1', strength: 'strong' }] },
    { id: 'ca-2', number: 2, title: 'Nobody owns the data', state: 'verified', body: '', explains: [{ id: 'ca-1', strength: 'strong' }] },
  ],
  transitions: [{
    id: 'tr-1', number: 1, title: 'Replace billing', status: 'agreed',
    elements: [{ elementId: 'billing', role: 'retires' }, { elementId: 'crm', role: 'introduces' }],
    decisions: [], milestones: [{ date: '2027-03-01', name: 'Pilot' }], body: '',
  }],
}

function view(model: Model): WriteView {
  let counter = 0
  return {
    model,
    current: () => toArrays(model),
    activeDiagramId: 'l7',
    scopePath: 'acme/landscape',
    ancestorDecisions: [],
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-09-20',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    tree: { lookup: () => undefined, initiativesBelow: () => [], observationsBelow: () => [], rowsTo: () => [] },
  }
}

const prepared = (tool: ToolName, out: Prepared | AgentAnswer): Prepared => {
  if ('ok' in out) throw new Error(`${tool} built no command: ${JSON.stringify(out)}`)
  return out
}

/** The model the steps leave, each one built and applied as an agent's would be. */
function after(steps: readonly Step[]): Model {
  let model = fromArrays(host)
  for (const [tool, args] of steps) {
    const applied = apply(model, prepared(tool, commandFor(tool, args, view(model))).command)
    if (!applied.ok) throw new Error(`${tool}: the reducer refused: ${applied.reason}`)
    model = applied.model
  }
  return model
}

type Step = readonly [ToolName, unknown]
/** A request, and the steps that make the model it is a sensible request of. */
type Case = { readonly args: unknown; readonly on?: readonly Step[] }

const PROPOSED: Step = ['solution.propose', { title: 'Appoint a data owner', addresses: [{ id: 'ca-2' }] }]
const SHAPED: readonly Step[] = [
  PROPOSED,
  ['solution.update', { id: 'SO-0001', benefit: 'large', cost: 'small', validatedWith: ['Operations'], noneKnown: true }],
  ['solution.move', { id: 'SO-0001', to: 'shaped' }],
]
const TRIED: readonly Step[] = [...SHAPED, ['experiment.plan', { tests: ['SO-0001'], title: 'Two weeks at one desk', hypothesis: 'Calls halve' }]]
const PROVEN: readonly Step[] = [
  ...TRIED,
  ['experiment.conclude', { id: 'EX-0001', outcome: 'confirmed' }],
  ['solution.move', { id: 'SO-0001', to: 'proven' }],
]
// The record `solution.decide` proposes, by the id the view mints for it.
const ADOPTED: readonly Step[] = [
  ...PROVEN,
  ['solution.decide', { id: 'SO-0001' }],
  ['decision.transition', { id: 'adr-new-1', status: 'reviewing' }],
  ['decision.transition', { id: 'adr-new-1', status: 'accepted' }],
  ['solution.move', { id: 'SO-0001', to: 'adopted' }],
]

const EVERY_WRITE: { readonly [T in CommandTool]: readonly Case[] } = {
  'element.add': [{ args: { name: 'Warehouse' } }, { args: { name: 'Fulfilment', kind: 'function' } }],
  'element.update': [{ args: { id: 'billing', description: 'Sends the invoices.' } }],
  'element.remove': [{ args: { id: 'fax' } }],

  connect: [{ args: { sourceId: 'billing', targetId: 'crm', label: 'invoices' } }],
  'connection.update': [{ args: { id: 'c1', label: 'orders' } }],
  'connections.update': [{ args: { items: [{ id: 'c1', label: 'orders' }] } }],
  'interface.accept': [{ args: { id: 'x1' } }],
  'connection.remove': [{ args: { id: 'c1' } }],
  'connections.remove': [{ args: { ids: ['c1', 'c2'] } }],
  'relation.add': [{ args: { type: 'supports', sourceId: 'billing', targetId: 'crm' } }],
  'technology.use': [{ args: { elementId: 'billing', targetIds: ['bus'] } }],
  'relation.update': [{ args: { id: 'c1', type: 'realises' } }],
  'relation.remove': [{ args: { id: 'c1' } }],

  'decision.propose': [{ args: { title: 'Move CRM to the cloud' } }],
  'decision.update': [{ args: { id: 'adr-1', title: 'Keep the ledger, for now' } }],
  'decision.remove': [{ args: { id: 'adr-1' } }],
  'decision.transition': [{ args: { id: 'adr-2', status: 'accepted' } }],

  'observation.record': [{ args: { title: 'Duplicate customers', impact: 'major' } }],
  'observation.update': [{ args: { id: 'ob-2', shared: true } }],
  'observation.seen': [{ args: { id: 'ob-2' } }],
  'observation.archive': [{ args: { id: 'ob-2', note: 'Fixed in the checklist' } }],
  'observation.merge': [{ args: { id: 'ob-2', into: 'ob-1' } }],
  'observation.remove': [{ args: { id: 'ob-2' } }],
  'cause.add': [{ args: { title: 'No customer master', explains: [{ id: 'ob-2' }] } }],
  'cause.update': [{ args: { id: 'ca-1', title: 'Two systems compute the total' } }],
  'cause.link': [{ args: { id: 'ca-2', explains: 'ob-2' } }],
  'cause.unlink': [{ args: { id: 'ca-1', explains: 'ob-1' } }],
  'cause.remove': [{ args: { id: 'ca-1' } }],

  'solution.propose': [{ args: { title: 'Appoint a data owner', addresses: [{ id: 'ca-2' }] } }],
  'solution.update': [{ args: { id: 'SO-0001', benefit: 'large' }, on: [PROPOSED] }],
  'solution.address': [{ args: { id: 'SO-0001', cause: 'ca-2', strength: 'weak' }, on: [PROPOSED] }],
  'solution.unaddress': [{ args: { id: 'SO-0001', cause: 'ca-2' }, on: [PROPOSED] }],
  'solution.move': [{ args: { id: 'SO-0001', to: 'proven' }, on: [...TRIED, ['experiment.conclude', { id: 'EX-0001', outcome: 'confirmed' }]] }],
  'solution.waive': [{ args: { id: 'SO-0001', reason: 'An appointment is not trialled' }, on: [PROPOSED] }],
  'solution.drop': [{ args: { id: 'SO-0001', note: 'Nobody would take it' }, on: [PROPOSED] }],
  'solution.restore': [{ args: { id: 'SO-0001' }, on: [PROPOSED, ['solution.drop', { id: 'SO-0001', note: 'Not now' }]] }],
  'solution.decide': [{ args: { id: 'SO-0001' }, on: PROVEN }],
  'solution.plan': [{ args: { id: 'SO-0001' }, on: ADOPTED }],
  'solution.remove': [{ args: { id: 'SO-0001' }, on: [PROPOSED] }],
  'experiment.plan': [{ args: { tests: ['SO-0001'], title: 'Trial', hypothesis: 'It works' }, on: SHAPED }],
  'experiment.update': [{ args: { id: 'EX-0001', measure: 'Calls per week' }, on: TRIED }],
  'experiment.conclude': [{ args: { id: 'EX-0001', outcome: 'refuted' }, on: TRIED }],
  'experiment.remove': [{ args: { id: 'EX-0001' }, on: TRIED }],

  'plan.replace': [{ args: { elementId: 'crm', newName: 'CRM next', shadowFrom: '2027-03-01', cutover: '2027-09-01' } }],
  'plan.port': [{ args: { planId: 'tr-1', connectionId: 'c2', on: '2027-05-01' } }],
  'plan.unport': [{ args: { planId: 'tr-1', connectionId: 'c2' }, on: [['plan.port', { planId: 'tr-1', connectionId: 'c2', on: '2027-05-01' }]] }],
  'plan.create': [{ args: { title: 'Oracle to PostgreSQL', changes: ['billing'] } }],
  'plan.update': [{ args: { id: 'tr-1', title: 'Replace billing, in two steps' } }],
  'plan.remove': [{ args: { id: 'tr-1' } }],
  'milestone.add': [{ args: { planId: 'tr-1', date: '2027-02-01', name: 'Kick-off' } }],
  'milestone.update': [{ args: { planId: 'tr-1', name: 'Pilot', date: '2027-04-01' } }],
  'milestone.remove': [{ args: { planId: 'tr-1', name: 'Pilot' } }],

  'diagram.create': [
    { args: { kind: 'layer7', name: 'Target state' } },
    // Asked for a container view that is there already: nothing changes, and
    // what lands is still the agent's.
    { args: { kind: 'container', applicationId: 'billing' }, on: [['diagram.create', { kind: 'container', applicationId: 'billing' }]] },
  ],
  'diagram.update': [{ args: { id: 'l7', asOf: '2027-01-01' } }],

  moveBy: [{ args: { elementIds: ['billing', 'crm'], dx: 40, dy: -20 } }],
  placeNextTo: [{ args: { elementId: 'crm', anchorId: 'billing', side: 'below' } }],
  'element.place': [{ args: { id: 'crm', x: 600, y: 500 } }],
  'element.draw': [{ args: { id: 'fax' } }],
  'element.undraw': [{ args: { id: 'crm' } }],
  group: [{ args: { name: 'Sales', elementIds: ['crm'] } }],
  ungroup: [{ args: { name: 'Finance', elementIds: ['billing'] } }],
  align: [{ args: { elementIds: ['billing', 'crm'], axis: 'top' } }],
  distribute: [{ args: { elementIds: ['billing', 'crm', 'who'], axis: 'horizontal' } }],
}

describe('every agent write says so', () => {
  it('has a case for every tool that builds a command, and for nothing else', () => {
    const building = TOOLS.map((tool) => tool.name).filter((name) => isCommandTool(name))
    expect(Object.keys(EVERY_WRITE).sort()).toEqual([...building].sort())
  })

  for (const [tool, cases] of Object.entries(EVERY_WRITE) as [CommandTool, readonly Case[]][]) {
    for (const { args, on = [] } of cases) {
      it(`${tool} ${JSON.stringify(args)}`, () => {
        const model = after(on)
        const { command } = prepared(tool, commandFor(tool, args, view(model)))
        expect(command.origin).toBe('agent')
        const applied = apply(model, command)
        if (!applied.ok) throw new Error(`the reducer refused: ${applied.reason}`)
        expect(applied.inverse.origin).toBe('agent')
      })
    }
  }
})
