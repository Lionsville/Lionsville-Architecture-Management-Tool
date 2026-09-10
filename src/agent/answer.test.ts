/**
 * The read tier, against a small hand-built landscape and the generated one.
 *
 * What is pinned is the shape of an answer and the refusals: an agent builds
 * on these fields, so a renamed one is a broken agent rather than a tidier
 * answer. The exact prose of a description or a decision passes through
 * untouched, which is the one property worth stating about text.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../model/adr'
import type { HostModel } from '../model/fromInterchange'
import { fromArrays, toArrays } from '../model/normalised'
import { syntheticModel } from '../model/testing/synthetic'
import { answer } from './answer'
import type { ReadView } from './answer'
import type { ReadTool } from './answer'
import type { AgentAnswer } from './tools'

const element = (id: string, name: string, over: Partial<HostModel['elements'][number]> = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const,
  isManaged: true, aspects: {}, ...over,
})

const decision = (id: string, number: number, title: string, applicationId?: string): Adr => ({
  id, number, title, status: 'proposed', date: '2026-09-01', body: `# ${title}\n\nBecause.`, signers: [],
  ...(applicationId ? { applicationId } : {}),
})

const host: HostModel = {
  name: 'Warehouse landscape',
  customerName: 'Acme Logistics',
  description: 'Everything that moves a parcel.',
  elements: [
    element('billing', 'Billing', { category: 'Finance', vendor: 'Kestrel', description: 'Sends the **invoices**.' }),
    element('crm', 'CRM', { technology: 'Java' }),
    element('wh', 'Warehouse', { kind: 'externalSystem' }),
    element('who', 'Clerk', { kind: 'actor' }),
    element('billing-api', 'Billing API', { kind: 'component', parentApplicationId: 'billing' }),
  ],
  relations: [
    { type: 'flow', id: 'c1', sourceId: 'crm', targetId: 'billing', label: 'orders', protocol: 'REST', isBidirectional: false },
    { type: 'flow', id: 'c2', sourceId: 'billing', targetId: 'wh', isBidirectional: true },
    { type: 'flow', id: 'c3', sourceId: 'billing', targetId: 'billing-api', isBidirectional: false },
  ],
  diagrams: [
    {
      id: 'l7', kind: 'layer7', name: 'Landscape',
      placements: [
        { elementId: 'billing', zone: 'landscape', domainGroup: 'Finance', x: 100, y: 200 },
        { elementId: 'crm', zone: 'landscape', x: 400, y: 200 },
        { elementId: 'who', zone: 'actors', x: 10, y: 10 },
      ],
    },
    {
      id: 'inside', kind: 'container', name: 'Inside billing', applicationElementId: 'billing',
      placements: [{ elementId: 'billing', x: 0, y: 0 }, { elementId: 'billing-api', x: 40, y: 60 }],
    },
  ],
  decisions: [
    decision('adr-1', 1, 'Keep the ledger'),
    decision('adr-2', 1, 'Billing stays on Kestrel', 'billing'),
  ],
}

const group: Adr[] = [decision('g-1', 1, 'One group, one identity provider')]

function view(model: HostModel = host, activeDiagramId = 'l7'): ReadView {
  const indexed = fromArrays(model)
  return { model: indexed, current: () => model, activeDiagramId, groupDecisions: group }
}

/** The JSON out of an answer, or the refusal, as a test wants to read it. */
function read(tool: ReadTool, args: unknown, over: ReadView = view()): unknown {
  const held: AgentAnswer = answer(tool, args, over)
  if (!held.ok) return held
  const block = held.content[0]
  return block.type === 'text' ? JSON.parse(block.text) : block
}

describe('project.current', () => {
  it('says what is open, in numbers and names', () => {
    expect(read('project.current', {})).toMatchObject({
      name: 'Warehouse landscape',
      group: 'Acme Logistics',
      description: 'Everything that moves a parcel.',
      elements: 5,
      connections: 3,
      decisions: 3,
      activeDiagramId: 'l7',
    })
    const held = read('project.current', {}) as { diagrams: { id: string; active: boolean }[] }
    expect(held.diagrams.map((d) => [d.id, d.active])).toEqual([['l7', true], ['inside', false]])
  })
})

describe('elements.list', () => {
  it('lists every element, one line each, with what a list needs', () => {
    const held = read('elements.list', {}) as { total: number; shown: number; elements: Record<string, unknown>[] }
    expect(held.total).toBe(5)
    expect(held.elements[0]).toEqual({
      id: 'billing', name: 'Billing', kind: 'application', lifecycle: 'live',
      category: 'Finance', vendor: 'Kestrel', technology: undefined, parentApplicationId: undefined,
      hasDescription: true,
    })
    expect(held.elements.find((e) => e.id === 'crm')).toMatchObject({ hasDescription: false })
  })

  it('filters by kind, by diagram and by query', () => {
    const ids = (args: unknown) => (read('elements.list', args) as { elements: { id: string }[] }).elements.map((e) => e.id)
    expect(ids({ kind: 'actor' })).toEqual(['who'])
    expect(ids({ diagramId: 'inside' })).toEqual(['billing', 'billing-api'])
    expect(ids({ query: 'kestrel' })).toEqual(['billing'])
    expect(ids({ query: 'billing api' })).toEqual(['billing-api'])
  })

  it('bounds the list and says how many there were', () => {
    expect(read('elements.list', { limit: 2 })).toMatchObject({ total: 5, shown: 2 })
  })

  it('refuses a diagram that does not exist, and arguments it was not shown', () => {
    expect(read('elements.list', { diagramId: 'nope' })).toEqual({ ok: false, refusal: 'agent.unknownId', detail: 'diagram nope' })
    expect(read('elements.list', { kind: 'planet' })).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})

describe('element.describe', () => {
  it('hands over the element whole, with its connections, placements and decisions', () => {
    const held = read('element.describe', { id: 'billing' }) as Record<string, unknown>
    expect(held).toMatchObject({ id: 'billing', description: 'Sends the **invoices**.' })
    expect((held.connections as { id: string }[]).map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect(held.connections).toContainEqual({
      id: 'c1', sourceId: 'crm', source: 'CRM', targetId: 'billing', target: 'Billing',
      label: 'orders', protocol: 'REST', isBidirectional: false,
    })
    expect(held.drawnOn).toEqual([
      { diagramId: 'l7', name: 'Landscape', elementId: 'billing', zone: 'landscape', domainGroup: 'Finance', x: 100, y: 200 },
      { diagramId: 'inside', name: 'Inside billing', elementId: 'billing', x: 0, y: 0 },
    ])
    expect((held.decisions as { id: string }[]).map((d) => d.id)).toEqual(['adr-2'])
  })

  it('names a component’s parent', () => {
    expect(read('element.describe', { id: 'billing-api' })).toMatchObject({ parentApplication: 'Billing' })
  })

  it('refuses an id nothing has', () => {
    expect(read('element.describe', { id: 'ghost' })).toEqual({ ok: false, refusal: 'agent.unknownId', detail: 'element ghost' })
    expect(read('element.describe', {})).toMatchObject({ refusal: 'agent.badArguments', detail: '"id" is required' })
  })
})

describe('connections.list', () => {
  const ids = (args: unknown) => (read('connections.list', args) as { connections: { id: string }[] }).connections.map((c) => c.id)

  it('lists them all, or those on one element, or those drawn on one diagram', () => {
    expect(ids({})).toEqual(['c1', 'c2', 'c3'])
    expect(ids({ elementId: 'crm' })).toEqual(['c1'])
    // c2 ends on the warehouse, which is not drawn on the landscape.
    expect(ids({ diagramId: 'l7' })).toEqual(['c1'])
    expect(ids({ diagramId: 'inside' })).toEqual(['c3'])
  })

  it('refuses an element or diagram that does not exist', () => {
    expect(read('connections.list', { elementId: 'ghost' })).toMatchObject({ refusal: 'agent.unknownId' })
    expect(read('connections.list', { diagramId: 'ghost' })).toMatchObject({ refusal: 'agent.unknownId' })
  })
})

describe('diagrams.list', () => {
  it('says what each diagram is and how much it draws', () => {
    expect(read('diagrams.list', {})).toEqual({
      diagrams: [
        { id: 'l7', name: 'Landscape', kind: 'layer7', applicationElementId: undefined, elements: 3, active: true },
        { id: 'inside', name: 'Inside billing', kind: 'container', applicationElementId: 'billing', elements: 2, active: false },
      ],
    })
  })
})

describe('decisions.list and decision.read', () => {
  const ids = (args: unknown) => (read('decisions.list', args) as { decisions: { id: string; scope: string; label: string }[] }).decisions

  it('lists the three scopes together, the group first, each with the label its scope shows', () => {
    expect(ids({}).map((d) => [d.id, d.scope])).toEqual([
      ['g-1', 'group'], ['adr-1', 'landscape'], ['adr-2', 'application'],
    ])
    // Numbers are per scope, so two records share ADR-0001 and the scope tells them apart.
    expect(ids({}).map((d) => d.label)).toEqual(['ADR-0001', 'ADR-0001', 'ADR-0001'])
  })

  it('narrows to a scope or an application', () => {
    expect(ids({ scope: 'landscape' }).map((d) => d.id)).toEqual(['adr-1'])
    expect(ids({ scope: 'group' }).map((d) => d.id)).toEqual(['g-1'])
    expect(ids({ applicationId: 'billing' }).map((d) => d.id)).toEqual(['adr-2'])
  })

  it('reads a record whole, from either list, with its scope named', () => {
    expect(read('decision.read', { id: 'adr-2' })).toMatchObject({
      title: 'Billing stays on Kestrel', body: '# Billing stays on Kestrel\n\nBecause.',
      scope: 'application', application: 'Billing',
    })
    expect(read('decision.read', { id: 'g-1' })).toMatchObject({ scope: 'group' })
    expect(read('decision.read', { id: 'adr-9' })).toMatchObject({ refusal: 'agent.unknownId' })
  })
})

describe('search', () => {
  it('is the app’s own ⌘K, over elements, documentation and decisions', () => {
    const held = read('search', { query: 'billing' }) as { hits: { kind: string }[] }
    const kinds = new Set(held.hits.map((h) => h.kind))
    expect(kinds).toEqual(new Set(['element', 'adr']))
    expect(read('search', { query: 'invoices' })).toMatchObject({ hits: [{ kind: 'documentation', elementId: 'billing' }] })
    expect(read('search', { query: 'identity provider' })).toMatchObject({ hits: [{ kind: 'adr', adrId: 'g-1', scope: 'group' }] })
  })
})

describe('project.export', () => {
  it('hands over the working file’s JSON, or one markdown document with a table per kind', () => {
    expect(read('project.export', { format: 'json' })).toEqual(host)
    const markdown = answer('project.export', {}, view())
    if (!markdown.ok || markdown.content[0].type !== 'text') throw new Error('not text')
    const doc = markdown.content[0].text
    expect(doc).toContain('# Warehouse landscape')
    expect(doc).toContain('| billing | Billing | live |')
    expect(doc).toContain('| c1 | CRM (crm) | Billing (billing) | orders | REST |')
    expect(doc).toContain('| g-1 | ADR-0001 | group |')
    expect(doc).toMatch(/## Plans\n\n_None._/)
  })
})

describe('over the generated landscape', () => {
  const large = syntheticModel('large')
  const held = view(large, 'landscape')

  it('answers every read tool without a refusal', () => {
    const asks: [ReadTool, unknown][] = [
      ['project.current', {}],
      ['elements.list', { kind: 'application', limit: 5 }],
      ['element.describe', { id: 'app-0001' }],
      ['connections.list', { elementId: 'app-0001' }],
      ['diagrams.list', {}],
      ['decisions.list', {}],
      ['search', { query: 'billing' }],
    ]
    for (const [tool, args] of asks) {
      const out = answer(tool, args, held)
      expect(out.ok, tool).toBe(true)
    }
  })

  it('leaves the model as it found it', () => {
    const before = JSON.stringify(toArrays(held.model))
    answer('element.describe', { id: 'app-0001' }, held)
    answer('search', { query: 'gateway' }, held)
    expect(JSON.stringify(toArrays(held.model))).toBe(before)
  })
})

describe('plans.list (ADR-0010)', () => {
  const plan = {
    id: 'tr-1', number: 1, title: 'Replace billing', status: 'agreed' as const,
    elements: [{ elementId: 'billing', role: 'retires' as const }, { elementId: 'crm', role: 'introduces' as const }],
    decisions: [], milestones: [], body: '',
  }
  const withPlan: HostModel = {
    ...host,
    relations: [
      ...host.relations,
      { type: 'flow', id: 'c-moved', sourceId: 'crm', targetId: 'crm', isBidirectional: false, validFrom: '2027-05-01' },
    ],
    transitions: [plan],
  }

  it('lists each plan with the interfaces it moves and where each has gone', () => {
    const out = read('plans.list', {}, view(withPlan)) as { plans: { label: string; interfaces: unknown[] }[] }
    expect(out.plans[0].label).toBe('TR-0001')
    expect(out.plans[0].interfaces).toEqual(
      host.relations
        .filter((c) => c.sourceId === 'billing' || c.targetId === 'billing')
        .filter((c) => !(c.sourceId === 'crm' || c.targetId === 'crm'))
        .map((c) => expect.objectContaining({ connectionId: c.id, from: 'billing' })),
    )
  })

  it('connections.list says when a line is valid and which plan dated it', () => {
    const rows = (read('connections.list', {}, view(withPlan)) as { connections: Record<string, unknown>[] }).connections
    // A dated line nothing pairs with shows its own dates and no plan.
    expect(rows.find((c) => c.id === 'c-moved')).toMatchObject({ validFrom: '2027-05-01' })
    expect(rows.find((c) => c.id === 'c-moved')).not.toHaveProperty('plan')
    // A real port of c2 (billing ↔ warehouse) onto crm: the original closed
    // the day before the twin starts, and both are the plan's.
    const ported: HostModel = {
      ...withPlan,
      relations: [
        ...host.relations.map((c) => (c.id === 'c2' ? { ...c, validUntil: '2027-04-30' } : c)),
        { type: 'flow', id: 'twin', sourceId: 'crm', targetId: 'wh', isBidirectional: true, validFrom: '2027-05-01' },
      ],
    }
    const dated = (read('connections.list', {}, view(ported)) as { connections: Record<string, unknown>[] }).connections
    expect(dated.find((c) => c.id === 'c2')).toMatchObject({ validUntil: '2027-04-30', planId: 'tr-1', plan: 'TR-0001' })
    expect(dated.find((c) => c.id === 'twin')).toMatchObject({ validFrom: '2027-05-01', plan: 'TR-0001' })
    expect(dated.find((c) => c.id === 'c3')).not.toHaveProperty('plan')
  })

  it('search finds a plan by its title, its body or a milestone, beside the app’s own hits', () => {
    const model: HostModel = { ...withPlan, transitions: [{ ...plan, body: 'Move the **ledger** first.', milestones: [{ date: '2027-03-01', name: 'Pilot' }] }] }
    const hits = (read('search', { query: 'ledger' }, view(model)) as { hits: Record<string, unknown>[] }).hits
    expect(hits.filter((h) => h.kind === 'plan')).toEqual([expect.objectContaining({ planId: 'tr-1', label: 'TR-0001', snippet: expect.stringContaining('ledger') })])
    expect((read('search', { query: 'pilot' }, view(model)) as { hits: { kind: string }[] }).hits.map((h) => h.kind)).toEqual(['plan'])
    expect((read('search', { query: 'nothing here' }, view(model)) as { hits: unknown[] }).hits).toEqual([])
  })

  it('plan.read answers one plan by id or by label, with what its business case computes', () => {
    const body = [
      '```business-case', 'currency: EUR', '',
      '| Line | Y0 | Y1 |', '| --- | --- | --- |', '| Investment | -100 | |', '| Savings | | 150 |', '```',
    ].join('\n')
    const model: HostModel = { ...withPlan, transitions: [{ ...plan, body }] }
    const byId = read('plan.read', { id: 'tr-1' }, view(model)) as { label: string; businessCase: Record<string, unknown> }
    expect(byId.label).toBe('TR-0001')
    expect(byId.businessCase).toMatchObject({ state: 'computed', currency: 'EUR', net: [-100, 150], roi: 0.5 })
    expect(byId.businessCase).not.toHaveProperty('npv')
    expect(read('plan.read', { id: 'TR-0001' }, view(model))).toEqual(byId)
    expect(read('plan.read', { id: 'tr-1' }, view(withPlan))).toMatchObject({ businessCase: { state: 'noFence' } })
    expect(answer('plan.read', { id: 'TR-0002' }, view(withPlan))).toMatchObject({ ok: false, refusal: 'agent.unknownId' })
  })
})
