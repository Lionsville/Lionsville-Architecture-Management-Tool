/**
 * The enterprise map, in rows and columns (ADR-0012 §6, §9).
 *
 * Over the shipping organisation every sheet test uses: two areas, a grouping
 * each, four capabilities covering all three answers coverage can give. What
 * is pinned is the roll-up — a section says what everything under it leans
 * on — the columns as the rows name them and in that order, the gap counted
 * on the leaves, and the two things the page cannot know on its own: a name
 * for an id it does not hold, and the day it shows.
 */
import { describe, expect, it } from 'vitest'
import { mapPage, seedMap } from './map'
import { application, area, capability, grouping, relation, shippingScope } from './testFixtures'

const rowOf = (page: ReturnType<typeof mapPage>, id: string) =>
  page.rows.find((row) => row.element.id === id)!

describe('the rows', () => {
  it('walks every function root in tree order, one row per function, with its depth', () => {
    const page = mapPage(shippingScope(), {})
    expect(page.rows.map((row) => [row.element.id, row.depth])).toEqual([
      ['fulfilment', 0], ['warehousing', 1], ['picking', 2], ['packing', 2],
      ['billing', 0], ['invoicing', 1], ['invoice', 2], ['dunning', 2],
    ])
  })

  it('draws the roots the map names, in the map’s order, and only those', () => {
    const page = mapPage(shippingScope(), { areas: ['billing'] })
    expect(page.rows.map((row) => row.element.id)).toEqual(['billing', 'invoicing', 'invoice', 'dunning'])
  })

  it('gives a leaf its own coverage', () => {
    const page = mapPage(shippingScope(), {})
    expect(rowOf(page, 'picking')).toMatchObject({
      leaf: true, supportedBy: ['wms', 'scanner'], assignedTo: [], coverage: 'covered', gaps: 0,
    })
    expect(rowOf(page, 'packing')).toMatchObject({ coverage: 'manual', assignedTo: ['warehouse-team'], gaps: 0 })
    expect(rowOf(page, 'dunning')).toMatchObject({ coverage: 'uncovered', gaps: 1 })
  })

  it('rolls a section up: the union of what is under it, and the gaps counted on the leaves', () => {
    const page = mapPage(shippingScope(), {})
    expect(rowOf(page, 'warehousing')).toMatchObject({
      leaf: false, supportedBy: ['wms', 'scanner'], assignedTo: ['warehouse-team'], coverage: 'covered', gaps: 0,
    })
    // Invoicing is covered by the finance system through one capability and
    // has a gap through the other: both are true, and the row says both.
    expect(rowOf(page, 'invoicing')).toMatchObject({ supportedBy: ['erp'], coverage: 'covered', gaps: 1 })
    expect(rowOf(page, 'billing').gaps).toBe(1)
  })

  it('counts the leaves and not the sections', () => {
    expect(mapPage(shippingScope(), {}).counts).toEqual({ covered: 2, manual: 1, uncovered: 1 })
  })

  it('does not count an application twice when two capabilities under one section share it', () => {
    const scope = shippingScope()
    scope.relations.push(relation('s4', 'supports', 'wms', 'packing'))
    expect(rowOf(mapPage(scope, {}), 'warehousing').supportedBy).toEqual(['wms', 'scanner'])
  })
})

describe('the columns', () => {
  it('are the applications the rows name, by first appearance down the page', () => {
    const page = mapPage(shippingScope(), {})
    expect(page.columns.map((column) => column.id)).toEqual(['wms', 'scanner', 'erp'])
    expect(page.columns.every((column) => column.known)).toBe(true)
  })

  it('leave out an application that supports nothing', () => {
    const scope = shippingScope()
    scope.elements.push(application('crm', 'Customer system'))
    expect(mapPage(scope, {}).columns.map((column) => column.id)).not.toContain('crm')
  })

  it('name an id this scope does not hold through the description handed in, and group by owner', () => {
    // The organisation’s own map: its functions, and the rows and systems in
    // a landscape below it.
    const scope = shippingScope()
    scope.elements = scope.elements.filter((element) => element.kind !== 'application')
    scope.relations = scope.relations.filter((row) => row.type !== 'supports')
    const elsewhere = shippingScope().relations.filter((row) => row.type === 'supports')
    const page = mapPage(scope, {}, {
      elsewhere,
      describe: (id) => ({
        wms: { name: 'Warehouse system', where: 'Retail' },
        scanner: { name: 'Handheld scanners', where: 'Retail' },
        erp: { name: 'Finance system', where: 'Finance' },
      })[id],
    })
    expect(page.groups).toEqual([
      { where: 'Retail', columns: [
        { id: 'wms', name: 'Warehouse system', where: 'Retail', known: true },
        { id: 'scanner', name: 'Handheld scanners', where: 'Retail', known: true },
      ] },
      { where: 'Finance', columns: [{ id: 'erp', name: 'Finance system', where: 'Finance', known: true }] },
    ])
    expect(rowOf(page, 'picking').coverage).toBe('covered')
  })

  it('keep a column nobody can describe, said by its id and marked unknown', () => {
    const scope = shippingScope()
    scope.relations.push(relation('s5', 'supports', 'ghost', 'dunning'))
    const page = mapPage(scope, {})
    expect(page.columns.at(-1)).toEqual({ id: 'ghost', name: 'ghost', known: false })
    expect(rowOf(page, 'dunning').coverage).toBe('covered')
  })

  it('prefer the description over a cached name this scope holds', () => {
    const page = mapPage(shippingScope(), {}, { describe: (id) => (id === 'wms' ? { name: 'WMS' } : undefined) })
    expect(page.columns[0]).toMatchObject({ id: 'wms', name: 'WMS', known: true })
    expect(page.columns[0].where).toBeUndefined()
  })
})

describe('the day it shows', () => {
  const dated = () => {
    const scope = shippingScope()
    scope.relations = scope.relations.map((row) => (row.id === 's3' ? { ...row, validFrom: '2027-03-01' } : row))
    return scope
  }

  it('counts every row when no day is given', () => {
    expect(rowOf(mapPage(dated(), {}), 'invoice').coverage).toBe('covered')
  })

  it('counts the rows live on the map’s own day', () => {
    expect(rowOf(mapPage(dated(), { asOf: '2027-02-01' }), 'invoice').coverage).toBe('uncovered')
    expect(rowOf(mapPage(dated(), { asOf: '2027-03-01' }), 'invoice').coverage).toBe('covered')
  })

  it('takes today where the map names no day', () => {
    expect(rowOf(mapPage(dated(), {}, { today: '2027-02-01' }), 'invoice').coverage).toBe('uncovered')
  })
})

describe('a tree that is not one', () => {
  it('draws a root that is not a function nowhere, and a loop once', () => {
    const elements = [
      area('a', 'A', { parentId: 'b' }),
      grouping('b', 'B', 'a'),
      capability('c', 'C', 'b'),
    ]
    const page = mapPage({ elements, relations: [] }, { areas: ['a', 'wms'] })
    expect(page.rows.map((row) => row.element.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('a new one', () => {
  it('names no areas, so an area made later is drawn without asking', () => {
    expect(seedMap({ id: 'mp-1', name: 'Map' })).toEqual({
      id: 'mp-1', kind: 'map', name: 'Map', members: [], geometry: { nodes: [] },
    })
  })
})
