/**
 * The search over a whole project: which kind of hit a match becomes, in what
 * order, and what the snippet shows a reader about why it matched.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from './model/fromInterchange'
import type { Adr } from './adr'
import { searchAll, snippet } from './search'

function element(id: string, name: string, over: Partial<HostModel['elements'][number]> = {}): HostModel['elements'][number] {
  return {
    id, name, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {}, ...over,
  } as HostModel['elements'][number]
}

function adr(id: string, title: string, over: Partial<Adr> = {}): Adr {
  return { id, number: 1, title, status: 'proposed', date: '2026-09-01', body: '', signers: [], ...over }
}

const model: HostModel = {
  name: 'Landscape', customerName: 'Acme',
  elements: [
    element('crm', 'Customer CRM', { vendor: 'Salesforce', description: 'Holds every **customer** record and the sales pipeline.' }),
    element('billing', 'Billing', { technology: 'Kafka' }),
    element('warehouse', 'Warehouse', { description: 'Stock levels per site. Talks to [[Billing]] nightly.' }),
  ],
  connections: [],
  diagrams: [],
  decisions: [
    adr('adr-l', 'Use Kafka for events', { body: 'Every domain publishes events.' }),
    adr('adr-c', 'Keep the CRM as system of record', { number: 2, applicationId: 'crm', body: 'The pipeline lives in one place.' }),
  ],
}
const groupDecisions = [adr('adr-g', 'One identity provider for the group', { body: 'Kafka is not involved.' })]

describe('searchAll', () => {
  it('returns nothing for a blank query', () => {
    expect(searchAll({ model, groupDecisions, query: '   ' })).toEqual([])
  })

  it('finds elements by name, vendor and technology, names first', () => {
    const hits = searchAll({ model, groupDecisions, query: 'kafka' })
    const elements = hits.filter((h) => h.kind === 'element')
    expect(elements).toEqual([expect.objectContaining({ elementId: 'billing', detail: 'Kafka' })])
  })

  it('finds documentation by its prose and says where the words were', () => {
    const hits = searchAll({ model, groupDecisions, query: 'pipeline' })
    const docs = hits.filter((h) => h.kind === 'documentation')
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ elementId: 'crm', name: 'Customer CRM' })
    expect((docs[0] as { snippet: string }).snippet).toContain('sales pipeline')
    // The bold marks are gone from the snippet: it is words, not markdown.
    expect((docs[0] as { snippet: string }).snippet).not.toContain('**')
  })

  it('finds decisions at all three levels and labels the scope', () => {
    const hits = searchAll({ model, groupDecisions, query: 'kafka' }).filter((h) => h.kind === 'adr')
    expect(hits.map((h) => (h as { scope: string }).scope)).toEqual(['group', 'landscape'])
    expect(hits[0]).toMatchObject({ adrId: 'adr-g', scope: 'group' })
    const app = searchAll({ model, groupDecisions, query: 'system of record' }).filter((h) => h.kind === 'adr')
    expect(app[0]).toMatchObject({ scope: 'application', applicationId: 'crm', applicationName: 'Customer CRM' })
  })

  it('lets the same element answer twice when both its name and its page match', () => {
    const hits = searchAll({ model, groupDecisions, query: 'customer' })
    expect(hits.map((h) => h.kind)).toEqual(['element', 'documentation'])
  })

  it('folds accents, so a Dutch board is searchable from an English keyboard', () => {
    const accented = { ...model, elements: [element('x', 'Réservation')] }
    expect(searchAll({ model: accented, groupDecisions: [], query: 'reserv' })).toHaveLength(1)
  })

  it('caps each kind separately', () => {
    const many = { ...model, elements: Array.from({ length: 30 }, (_, i) => element(`e${i}`, `Node ${i}`)) }
    const hits = searchAll({ model: many, groupDecisions: [], query: 'node', limitPerKind: 5 })
    expect(hits).toHaveLength(5)
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
