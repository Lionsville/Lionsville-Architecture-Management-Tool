/**
 * The counts on the organisation's cards, as arithmetic.
 *
 * Written over a hand-built scope rather than over the shipped example: the
 * example's organisation is deliberately empty until cross-scope ids exist, so
 * it can only exercise one of the answers here.
 */
import { describe, expect, it } from 'vitest'
import { organisationPages } from './organisationPages'
import { laidOut } from '../../model/testFixtures'
import type { DesignElement } from '../../model'
import type { HostModel } from '../../model/fromInterchange'
import type { ScopeSnapshot } from '../../projects/scope'

const TODAY = '2026-09-12'

const element = (over: Partial<DesignElement> & Pick<DesignElement, 'id' | 'kind'>): DesignElement => ({
  name: over.id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

function scope(over: Partial<HostModel> = {}): ScopeSnapshot {
  const model: HostModel = {
    name: 'Acme Logistics', elements: [], relations: [], diagrams: [], ...over,
  }
  return { path: '', model, activeDiagramId: '', logoLibrary: [] }
}

describe('organisationPages', () => {
  it('says an unloaded root is empty rather than throwing', () => {
    const pages = organisationPages(undefined, TODAY)
    expect(pages.empty).toBe(true)
    expect(pages.business).toMatchObject({ journeys: 0, areas: 0, functions: 0, stakeholders: 0 })
    expect(pages.decisions.latest).toBeUndefined()
    expect(pages.roadmap.finding).toBeUndefined()
  })

  it('says a root with nothing in it is empty', () => {
    expect(organisationPages(scope(), TODAY).empty).toBe(true)
  })

  it('is no longer empty once it holds one decision', () => {
    const held = scope({ decisions: [
      { id: 'a', number: 1, title: 'Use one identity', status: 'accepted', date: '2026-09-01', body: '', signers: [] },
    ] })
    expect(organisationPages(held, TODAY).empty).toBe(false)
  })

  describe('a landscape’s two cards', () => {
    it('counts the views, and the records that have a page of their own', () => {
      const held = scope({
        elements: [
          element({ id: 'wms', kind: 'application', description: 'The warehouse system.' }),
          element({ id: 'erp', kind: 'application', description: '   ' }),
          element({ id: 'tms', kind: 'application' }),
        ],
        diagrams: [
          laidOut({ id: 'l7', kind: 'layer7' as const, name: 'L7', placements: [] }),
          laidOut({ id: 'c', kind: 'container' as const, name: 'C', placements: [] }),
        ],
      })
      const pages = organisationPages(held, TODAY)
      expect(pages.views).toBe(2)
      expect(pages.documentation).toEqual({ described: 1, elements: 3 })
    })
  })

  describe('the business card', () => {
    const held = scope({
      elements: [
        element({ id: 'ship', kind: 'step' }),
        element({ id: 'quote', kind: 'step', parentId: 'ship' }),
        element({ id: 'warehousing', kind: 'function', scopes: ['retail'] }),
        element({ id: 'picking', kind: 'function', parentId: 'warehousing' }),
        element({ id: 'billing', kind: 'function' }),
        element({ id: 'planner', kind: 'actor' }),
        element({ id: 'wms', kind: 'application' }),
      ],
    })

    it('counts journeys and areas as roots, and functions at every depth', () => {
      expect(organisationPages(held, TODAY).business).toMatchObject({
        journeys: 1, areas: 2, functions: 3, stakeholders: 1,
      })
    })

    /** The rule `business/` publishes: a function root with no `scopes`. */
    it('counts the capabilities no domain has been given', () => {
      expect(organisationPages(held, TODAY).business.unmapped).toBe(1)
    })

    it('names the sheet to open, and says nothing where there is none to', () => {
      expect(organisationPages(held, TODAY).business.sheetId).toBeUndefined()
      const withSheet = scope({ diagrams: [
        { id: 'l7', kind: 'layer7', name: 'Landscape', members: [], geometry: { nodes: [] } },
        { id: 'sh', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } },
      ] })
      expect(organisationPages(withSheet, TODAY).business.sheetId).toBe('sh')
    })

    it('names the map to open, likewise', () => {
      expect(organisationPages(held, TODAY).business.mapId).toBeUndefined()
      const withMap = scope({ diagrams: [
        { id: 'mp', kind: 'map', name: 'Enterprise map', members: [], geometry: { nodes: [] } },
      ] })
      expect(organisationPages(withMap, TODAY).business.mapId).toBe('mp')
    })
  })

  describe('the decisions card', () => {
    const held = scope({ decisions: [
      { id: 'a', number: 1, title: 'First', status: 'accepted', date: '2026-01-01', body: '', signers: [] },
      { id: 'b', number: 2, title: 'Second', status: 'proposed', date: '2026-02-01', body: '', signers: [] },
      { id: 'c', number: 3, title: 'Third', status: 'accepted', date: '2025-12-01', body: '', signers: [] },
    ] })

    /** In the vocabulary's own order, and without the statuses nothing is in. */
    it('tallies by status and leaves the zeroes out', () => {
      expect(organisationPages(held, TODAY).decisions.byStatus).toEqual([
        { status: 'proposed', count: 1 },
        { status: 'accepted', count: 2 },
      ])
    })

    /** By number: a date moves backwards when an old record is finally rejected. */
    it('takes the newest record by number, not by date', () => {
      expect(organisationPages(held, TODAY).decisions.latest?.title).toBe('Third')
      expect(organisationPages(held, TODAY).decisions.total).toBe(3)
    })
  })

  describe('the roadmap card', () => {
    const plan = (over: Record<string, unknown>) => ({
      id: 'p', number: 1, title: 'A plan', status: 'running', elements: [], decisions: [],
      milestones: [], body: '', ...over,
    }) as NonNullable<HostModel['transitions']>[number]

    it('tallies the plans by status', () => {
      const held = scope({ transitions: [plan({ id: 'p1' }), plan({ id: 'p2', status: 'draft' })] })
      expect(organisationPages(held, TODAY).roadmap).toMatchObject({
        total: 2,
        byStatus: [{ status: 'draft', count: 1 }, { status: 'running', count: 1 }],
      })
    })

    it('shows the first thing the dates disagree about', () => {
      const held = scope({ transitions: [plan({ to: '2026-08-01' })] })
      expect(organisationPages(held, TODAY).roadmap.finding).toMatchObject({
        kind: 'planOverdue', name: 'A plan',
      })
    })

    it('shows none when the dates agree', () => {
      const held = scope({ transitions: [plan({ to: '2027-08-01' })] })
      expect(organisationPages(held, TODAY).roadmap.finding).toBeUndefined()
    })
  })
})
