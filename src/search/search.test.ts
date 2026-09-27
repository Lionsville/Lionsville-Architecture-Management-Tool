// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The search over a whole organisation: which kind of hit a match becomes, in
 * what order, from which scope, where it opens, and what the snippet shows a
 * reader about why it matched.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/hostModel'
import type { Adr } from '../decisions/adr'
import { SEARCH_KINDS } from '../model/searchable'
import { scopeSources, searchAll, snippet, treeSources } from './search'

function element(id: string, name: string, over: Partial<HostModel['elements'][number]> = {}): HostModel['elements'][number] {
  return {
    id, name, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
  } as HostModel['elements'][number]
}

function adr(id: string, title: string, over: Partial<Adr> = {}): Adr {
  return { id, number: 1, title, status: 'proposed', date: '2026-09-01', body: '', signers: [], ...over }
}

const model: HostModel = {
  name: 'Landscape', 
  elements: [
    element('crm', 'Customer CRM', { vendor: 'Salesforce', description: 'Holds every **customer** record and the sales pipeline.' }),
    element('billing', 'Billing', { technology: 'Kafka' }),
    element('warehouse', 'Warehouse', { description: 'Stock levels per site. Talks to [[Billing]] nightly.' }),
  ],
  relations: [],
  diagrams: [],
  decisions: [
    adr('adr-l', 'Use Kafka for events', { body: 'Every domain publishes events.' }),
    adr('adr-c', 'Keep the CRM as system of record', { number: 2, subjectId: 'crm', body: 'The pipeline lives in one place.' }),
  ],
}
const ancestorDecisions = [adr('adr-g', 'One identity provider for the group', { body: 'Kafka is not involved.' })]

const search = (query: string, over: Partial<{ model: HostModel; ancestorDecisions: Adr[]; limitPerKind: number }> = {}) =>
  searchAll({
    sources: scopeSources({ model: over.model ?? model, scope: 'here', ancestorDecisions: over.ancestorDecisions ?? ancestorDecisions }),
    query,
    ...(over.limitPerKind !== undefined ? { limitPerKind: over.limitPerKind } : {}),
  })

describe('searchAll', () => {
  it('returns nothing for a blank query', () => {
    expect(search('   ')).toEqual([])
  })

  it('finds elements by name, vendor and technology, names first', () => {
    const elements = search('kafka').filter((h) => h.kind === 'element')
    expect(elements).toEqual([expect.objectContaining({ id: 'billing', detail: 'Kafka', variant: 'application' })])
  })

  it('finds documentation by its prose and says where the words were', () => {
    const docs = search('pipeline').filter((h) => h.kind === 'documentation')
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ id: 'crm', title: 'Customer CRM', opens: { page: 'document', id: 'crm' } })
    expect(docs[0].snippet).toContain('sales pipeline')
    // The bold marks are gone from the snippet: it is words, not markdown.
    expect(docs[0].snippet).not.toContain('**')
  })

  it('finds decisions in this scope and above, this scope first, and names what one is about', () => {
    const hits = search('kafka').filter((h) => h.kind === 'decision')
    expect(hits.map((h) => [h.id, h.scope])).toEqual([['adr-l', 'here'], ['adr-g', undefined]])
    const about = search('system of record').filter((h) => h.kind === 'decision')
    expect(about[0]).toMatchObject({ id: 'adr-c', label: 'ADR-0002', about: ['Customer CRM'], opens: { page: 'decisions', id: 'adr-c' } })
  })

  it('lets the same element answer twice when both its name and its page match', () => {
    expect(search('customer').map((h) => h.kind)).toEqual(['element', 'documentation'])
  })

  it('folds accents, so a Dutch board is searchable from an English keyboard', () => {
    const accented = { ...model, elements: [element('x', 'Réservation')] }
    expect(search('reserv', { model: accented, ancestorDecisions: [] })).toHaveLength(1)
  })

  it('caps each kind separately', () => {
    const many = { ...model, elements: Array.from({ length: 30 }, (_, i) => element(`e${i}`, `Node ${i}`)) }
    expect(search('node', { model: many, ancestorDecisions: [], limitPerKind: 5 })).toHaveLength(5)
  })

  it('ranks a title that starts with the query above one that only contains it', () => {
    const titled = { ...model, decisions: [adr('a', 'Retire the old broker', { body: 'kafka' }), adr('b', 'Kafka everywhere', { number: 2 })] }
    expect(search('kafka', { model: titled, ancestorDecisions: [] }).filter((h) => h.kind === 'decision').map((h) => h.id))
      .toEqual(['b', 'a'])
  })
})

// --- every kind the model holds (ADR-0029) ------------------------------------------

/** One record of every list, each carrying the word "harbour" somewhere a person would look. */
const everything: HostModel = {
  name: 'Port',
  elements: [
    element('crane', 'Harbour crane control', { kind: 'platformService' }),
    element('berth', 'Berth planner', { description: 'Plans the harbour berths a week out.' }),
    element('quay', 'Quay system'),
  ],
  relations: [{ id: 'r1', type: 'flow', sourceId: 'berth', targetId: 'quay', label: 'harbour slots' } as HostModel['relations'][number]],
  diagrams: [{ id: 'd1', kind: 'map', name: 'Harbour map', members: [] } as unknown as HostModel['diagrams'][number]],
  decisions: [adr('adr-h', 'One harbour master system')],
  transitions: [{
    id: 'tr-1', number: 3, title: 'Move the harbour office', status: 'running', elements: [], decisions: [],
    milestones: [{ date: '2026-11-01', name: 'Harbour cut-over' }], body: '',
  }],
  observations: [{
    id: 'ob-1', number: 7, title: 'Cranes idle at the harbour gate', date: '2026-09-01', impact: 'major', seen: 2,
    body: '', history: [],
  }],
  causes: [{ id: 'ca-1', number: 1, title: 'Harbour gate booking is manual', state: 'assumed', body: '', explains: [] }],
  solutions: [{
    id: 'so-1', number: 1, title: 'Book the harbour gate online', state: 'idea', addresses: [], validatedWith: [],
    attempts: [], body: '', history: [],
  }],
  experiments: [{
    id: 'ex-1', number: 1, title: 'A week of harbour bookings online', tests: ['so-1'], hypothesis: 'Idle time halves',
    outcome: 'planned', body: '',
  }],
}

describe('every kind of record a scope holds', () => {
  const hits = searchAll({ sources: scopeSources({ model: everything, scope: 'port' }), query: 'harbour' })

  it('is found, and says what it is', () => {
    expect(new Set(hits.map((hit) => hit.kind))).toEqual(new Set(SEARCH_KINDS))
  })

  it('opens where it lives', () => {
    const place = (kind: string) => hits.find((hit) => hit.kind === kind)?.opens
    expect(place('element')).toEqual({ page: 'element', id: 'crane' })
    expect(place('documentation')).toEqual({ page: 'document', id: 'berth' })
    expect(place('view')).toEqual({ page: 'map', id: 'd1' })
    expect(place('relation')).toEqual({ page: 'element', id: 'berth' })
    expect(place('decision')).toEqual({ page: 'decisions', id: 'adr-h' })
    expect(place('plan')).toEqual({ page: 'plan', id: 'tr-1' })
    expect(place('milestone')).toEqual({ page: 'plan', id: 'tr-1' })
    for (const kind of ['observation', 'cause', 'solution', 'experiment']) expect(place(kind)?.page).toBe('observations')
    expect(hits.every((hit) => hit.scope === 'port')).toBe(true)
  })

  it('carries the label, the status and the kind within the kind', () => {
    expect(hits.find((hit) => hit.kind === 'observation')).toMatchObject({ label: 'OB-0007', status: 'major' })
    expect(hits.find((hit) => hit.kind === 'plan')).toMatchObject({ label: 'TR-0003', status: 'running' })
    expect(hits.find((hit) => hit.kind === 'milestone')).toMatchObject({ title: 'Harbour cut-over', label: 'TR-0003' })
    expect(hits.find((hit) => hit.kind === 'element')).toMatchObject({ variant: 'platformService' })
    expect(hits.find((hit) => hit.kind === 'relation')).toMatchObject({ about: ['Berth planner', 'Quay system'], variant: 'flow' })
  })

  it('narrows to the kinds asked for', () => {
    const only = searchAll({ sources: scopeSources({ model: everything }), query: 'harbour', kinds: ['cause', 'experiment'] })
    expect(only.map((hit) => hit.kind)).toEqual(['cause', 'experiment'])
  })
})

describe('across the tree', () => {
  const tree = [
    { path: '', model: { elements: [element('erp', 'ERP harbour ledger')], observations: [] } },
    { path: 'retail', model: { elements: [element('erp', 'ERP harbour ledger', { ref: '' })], observations: [everything.observations![0]] } },
    { path: 'port', model: { elements: [] } },
  ]
  const sources = treeSources({
    scope: 'port', model: everything,
    above: [{ path: '', decisions: [adr('g-1', 'Harbour dues are the organisation\'s')] }],
    tree,
    masterOf: (id) => (id === 'erp' ? '' : undefined),
  })
  const hits = searchAll({ sources, query: 'harbour' })

  it('reads this scope first, then the scopes above, then the rest', () => {
    expect(sources.map((one) => one.scope)).toEqual(['port', '', 'retail'])
  })

  it('finds a record above, and one elsewhere, and says which scope holds it', () => {
    expect(hits.find((hit) => hit.id === 'g-1')).toMatchObject({ kind: 'decision', scope: '' })
    const observations = hits.filter((hit) => hit.kind === 'observation')
    expect(observations.map((hit) => hit.scope)).toEqual(['port', 'retail'])
  })

  it('names an element the scope does not hold by its id, rather than leaving the line blank', () => {
    const dangling = { ...everything, decisions: [adr('adr-x', 'Harbour pilots', { subjectId: 'gone' })] }
    const hit = searchAll({ sources: scopeSources({ model: dangling }), query: 'pilots' })[0]
    expect(hit.about).toEqual(['gone'])
  })

  it('keeps one list object per scope above while its records are the same, so its folds are kept', () => {
    const again = treeSources({ scope: 'port', model: everything, above: [{ path: '', decisions: sources[1].model.decisions ?? [] }], tree })
    expect(again[1].model).toBe(sources[1].model)
    expect(treeSources({ scope: 'port', model: everything, above: [] }).map((one) => one.scope)).toEqual(['port'])
  })

  it('finds an element once, where it is answered for, and not at every scope that draws it', () => {
    expect(hits.filter((hit) => hit.id === 'erp').map((hit) => [hit.kind, hit.scope])).toEqual([['element', '']])
  })
})

describe('snippet', () => {
  it('centres on the first matching word and marks the cut ends', () => {
    const text = `${'a '.repeat(100)}needle ${'b '.repeat(100)}`
    const out = snippet(text, 'needle', 20)
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(out).toContain('needle')
    expect(out.length).toBeLessThan(50)
  })

  it('shows the opening when no word of the query occurs in the text', () => {
    expect(snippet('Short text.', 'elsewhere')).toBe('Short text.')
  })

  it('strips headings, code fences and link syntax', () => {
    const out = snippet('## Heading\n\n```mermaid\nflowchart LR\n```\n\nSee [[Billing]] and [docs](https://x).', 'billing')
    expect(out).not.toContain('#')
    expect(out).not.toContain('flowchart')
    expect(out).toContain('See Billing and docs.')
  })
})
