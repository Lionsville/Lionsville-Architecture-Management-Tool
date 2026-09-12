import { describe, expect, it } from 'vitest'
import { sheetPage } from './sheet'
import { actor, area, capability, relation, shippingScope } from './testFixtures'

/**
 * The page, over the organisation `testFixtures.shippingScope` describes. The
 * arithmetic underneath is pinned in `tree`, `lanes` and `coverage`; what is
 * pinned here is the page those three make together — which band a thing ends
 * up in, at what depth, and in what order.
 */
const SHEET = { journeyId: 'ship', lanes: ['key-account', 'partner'], areas: ['fulfilment', 'billing'] }

const page = (over: Partial<typeof SHEET> & { showActors?: boolean } = {}) =>
  sheetPage(shippingScope(), { ...SHEET, ...over })

describe('the stakeholder rail', () => {
  it('is the actor tree, in order, with the outside parties marked', () => {
    expect(page().actors.map((row) => [row.element.id, row.depth, row.outside])).toEqual([
      ['warehouse-team', 0, false],
      ['key-account', 0, false],
      ['partner', 0, true],
    ])
  })

  it('draws a party of a party one step in', () => {
    const { elements, relations } = shippingScope()
    const nested = sheetPage(
      { elements: [...elements, actor('retailers', 'Retailers', { parentId: 'partner', outside: true })], relations },
      SHEET,
    )
    expect(nested.actors.map((row) => [row.element.id, row.depth])).toContainEqual(['retailers', 1])
  })

  it('is empty when the sheet says the rail is off', () => {
    expect(page({ showActors: false }).actors).toEqual([])
  })

  it('is drawn when the sheet says nothing, because a rail is what a sheet has', () => {
    expect(page({ showActors: undefined }).actors).toHaveLength(3)
  })
})

describe('the journey band', () => {
  it('reads the phases across the top in the journey’s own order', () => {
    expect(page().journey?.phases.map((phase) => phase.id))
      .toEqual(['order', 'quote', 'pick', 'deliver'])
  })

  it('puts the common path first, then a row per lane in the sheet’s order', () => {
    expect(page().journey?.lanes.map((lane) => lane.actor?.name))
      .toEqual([undefined, 'Key account', 'Marketplace partner'])
  })

  it('draws a lane only between its fork and its join', () => {
    const lane = page().journey?.lanes[1]
    expect(lane).toMatchObject({ fork: 'quote', join: 'deliver' })
    expect(lane?.cells.map((cell) => cell.inSpan)).toEqual([false, true, true, true])
  })

  it('draws the phase inside the span where a lane does nothing as a pass-through', () => {
    const cells = page().journey?.lanes[1].cells ?? []
    expect(cells.map((cell) => cell.passThrough)).toEqual([false, false, true, false])
    expect(cells[2].steps).toEqual([])
  })

  it('marks a step somebody outside does, so a phase nobody inside covers reads as one', () => {
    const partner = page().journey?.lanes[2].cells.find((cell) => cell.phaseId === 'pick')
    expect(partner?.steps.map((step) => [step.element.name, step.outside]))
      .toEqual([['Partner fulfils', true]])
  })

  it('leaves the common path’s steps unmarked', () => {
    const common = page().journey?.lanes[0].cells.map((cell) => cell.steps.map((s) => s.outside))
    expect(common).toEqual([[false], [false], [false], [false]])
  })

  it('has no band at all when the sheet names no journey', () => {
    expect(page({ journeyId: undefined }).journey).toBeUndefined()
  })

  it('has no band when the sheet names a journey this scope does not hold', () => {
    // A dangling end is kept and reported elsewhere (ADR-0012 §5); a page
    // cannot draw phases that are not there, and says so by drawing none.
    expect(page({ journeyId: 'somebody-elses-journey' }).journey).toBeUndefined()
  })
})

describe('the areas', () => {
  it('draws the roots the sheet names, in the order it names them', () => {
    expect(page({ areas: ['billing', 'fulfilment'] }).areas.map((a) => a.element.id))
      .toEqual(['billing', 'fulfilment'])
  })

  it('draws every root in the model’s own order when the sheet says nothing', () => {
    expect(page({ areas: undefined }).areas.map((a) => a.element.id))
      .toEqual(['fulfilment', 'billing'])
  })

  it('is a grouping per child, and a capability per thing under that', () => {
    const fulfilment = page().areas[0]
    expect(fulfilment.groupings.map((g) => g.element.id)).toEqual(['warehousing'])
    expect(fulfilment.groupings[0].capabilities.map((c) => [c.element.id, c.depth]))
      .toEqual([['picking', 1], ['packing', 1]])
  })

  it('draws a capability straight under an area as a card, not as an empty grouping', () => {
    // A leaf is a leaf at any depth. Without this, "add a capability to this
    // area" makes a box with nothing in it and the person cannot tell why.
    const { elements, relations } = shippingScope()
    const loose = sheetPage(
      { elements: [...elements, capability('tracking', 'Track a consignment', 'fulfilment')], relations },
      SHEET,
    )
    const fulfilment = loose.areas[0]
    expect(fulfilment.groupings.map((g) => g.element.id)).toEqual(['warehousing'])
    expect(fulfilment.capabilities.map((c) => [c.element.id, c.depth])).toEqual([['tracking', 1]])
  })

  it('says what covers a loose capability, as it does for one in a grouping', () => {
    const { elements, relations } = shippingScope()
    const loose = sheetPage(
      {
        elements: [...elements, capability('tracking', 'Track a consignment', 'fulfilment')],
        relations: [...relations, relation('s9', 'supports', 'wms', 'tracking')],
      },
      SHEET,
    )
    expect(loose.areas[0].capabilities[0].coverage)
      .toMatchObject({ supportedBy: ['wms'], coverage: 'covered' })
  })

  it('draws a grouping whose last capability went as a card again', () => {
    // The same rule read backwards: a grouping is a child of an area with
    // something under it, and an empty one has stopped being one.
    const { elements, relations } = shippingScope()
    const emptied = elements.filter((e) => e.id !== 'picking' && e.id !== 'packing')
    const page2 = sheetPage({ elements: emptied, relations }, SHEET)
    expect(page2.areas[0].groupings).toEqual([])
    expect(page2.areas[0].capabilities.map((c) => c.element.id)).toEqual(['warehousing'])
  })

  it('draws a capability somebody refined one step further in, rather than dropping it', () => {
    const { elements, relations } = shippingScope()
    const deeper = sheetPage(
      { elements: [...elements, capability('bulk', 'Bulk picking', 'picking')], relations },
      SHEET,
    )
    expect(deeper.areas[0].groupings[0].capabilities.map((c) => [c.element.id, c.depth]))
      .toEqual([['picking', 1], ['bulk', 2], ['packing', 1]])
  })

  it('says what covers each capability: systems, people, or nothing yet', () => {
    const [fulfilment, billing] = page().areas
    const coverage = (id: string) => [...fulfilment.groupings, ...billing.groupings]
      .flatMap((g) => g.capabilities).find((c) => c.element.id === id)?.coverage
    expect(coverage('picking')).toMatchObject({ supportedBy: ['wms', 'scanner'], coverage: 'covered' })
    expect(coverage('packing')).toMatchObject({ assignedTo: ['warehouse-team'], coverage: 'manual' })
    expect(coverage('dunning')).toEqual({ supportedBy: [], assignedTo: [], coverage: 'uncovered' })
  })

  it('carries the domain an area is assigned to, when its record says one', () => {
    const { elements, relations } = shippingScope()
    const assigned = elements.map((element) => (
      element.id === 'billing' ? { ...element, scopes: ['finance', 'shared'] } : element))
    const areas = sheetPage({ elements: assigned, relations }, SHEET).areas
    expect(areas.map((a) => a.domain)).toEqual([undefined, 'finance'])
  })

  it('leaves out an area the sheet names and the scope does not hold', () => {
    expect(page({ areas: ['fulfilment', 'gone'] }).areas.map((a) => a.element.id)).toEqual(['fulfilment'])
  })
})

describe('the unmapped band', () => {
  it('holds the roots nobody has said where to put', () => {
    const { elements, relations } = shippingScope()
    const withStray = { elements: [...elements, area('compliance', 'Compliance')], relations }
    expect(sheetPage(withStray, SHEET).unmapped.map((e) => e.id)).toEqual(['compliance'])
  })

  it('leaves out one a domain has been given, which is what the band is about', () => {
    const { elements, relations } = shippingScope()
    const withStray = {
      elements: [...elements, area('compliance', 'Compliance', { scopes: ['risk'] })],
      relations,
    }
    expect(sheetPage(withStray, SHEET).unmapped).toEqual([])
  })

  it('is empty when the sheet draws every root it holds', () => {
    expect(page().unmapped).toEqual([])
  })

  it('holds no grouping and no capability — a band about roots', () => {
    const { elements, relations } = shippingScope()
    const page2 = sheetPage({ elements, relations }, { ...SHEET, areas: [] })
    expect(page2.unmapped.map((e) => e.id)).toEqual(['fulfilment', 'billing'])
    expect(page2.unmapped.map((e) => e.id)).not.toContain('warehousing')
  })
})
