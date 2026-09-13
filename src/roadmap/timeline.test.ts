/**
 * The landscape on an axis (ADR-0009).
 *
 * In days rather than pixels, which is what lets the interesting part — where a
 * phase begins and ends, and which rows are worth a line at all — be checked
 * without a browser.
 */
import { describe, expect, it } from 'vitest'
import { fractionOf, monthsFrom, rangeOf, roadmapOf, shadowRunOf, spansFor, within } from './timeline'
import type { DesignElement, Relation } from '../model/types'

const TODAY = '2026-09-08'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live',
    isManaged: true, aspects: {}, ...over,
  }
}

describe('spansFor', () => {
  it('walks a hybrid run: live, then retiring, then retired', () => {
    const wms = element('wms', { lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' } })
    expect(spansFor(wms, '2026-01-01')).toEqual([
      { phase: 'live', from: '2026-01-01', to: '2027-04-01' },
      { phase: 'retiring', from: '2027-04-01', to: '2028-01-31' },
      { phase: 'retired', from: '2028-01-31' },
    ])
  })

  it('opens in the phase the element is in when the window starts', () => {
    const wms = element('wms', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } })
    expect(spansFor(wms, '2026-01-01')[0]).toEqual({ phase: 'planned', from: '2026-01-01', to: '2027-04-01' })
    // A window that opens after the go-live starts live, with no planned span.
    expect(spansFor(wms, '2027-06-01')).toEqual([{ phase: 'live', from: '2027-06-01' }])
  })

  it('makes no empty span for a phase that was skipped', () => {
    const wms = element('wms', { lifecycleDates: { retired: '2028-01-31' } })
    expect(spansFor(wms, '2026-01-01').map((s) => s.phase)).toEqual(['live', 'retired'])
  })

  it('collapses a same-day cutover into the phase it lands in', () => {
    const wms = element('wms', { lifecycleDates: { retiring: '2028-01-31', retired: '2028-01-31' } })
    expect(spansFor(wms, '2026-01-01')).toEqual([
      { phase: 'live', from: '2026-01-01', to: '2028-01-31' },
      { phase: 'retired', from: '2028-01-31' },
    ])
  })

  it('does not start a new span where the phase has not changed', () => {
    // Stored as `retiring` AND dated `retiring`: one stretch of one colour, not
    // two with a seam down the middle.
    const wms = element('wms', {
      lifecycle: 'retiring',
      lifecycleDates: { retiring: '2026-04-01', retired: '2027-06-30' },
    })
    expect(spansFor(wms, '2026-03-01')).toEqual([
      { phase: 'retiring', from: '2026-03-01', to: '2027-06-30' },
      { phase: 'retired', from: '2027-06-30' },
    ])
  })

  it('is one unbroken span for an element with no dates', () => {
    expect(spansFor(element('billing'), '2026-01-01')).toEqual([{ phase: 'live', from: '2026-01-01' }])
  })
})

describe('rangeOf', () => {
  it('covers everything with a month of air at each end', () => {
    // A month past the 31st lands in March: the padding is air, and a couple of
    // extra days of it is not worth arithmetic that special-cases February.
    expect(rangeOf(['2027-04-01', '2028-01-31'], TODAY)).toEqual({ from: '2026-08-08', to: '2028-03-02' })
  })

  it('gives a year around today when there is nothing to cover', () => {
    expect(rangeOf([], TODAY)).toEqual({ from: '2026-03-08', to: '2027-03-08' })
  })

  it('ignores a date that is not a day', () => {
    expect(rangeOf(['soon', '2027-04-01', '2028-01-31'], TODAY).to).toBe('2028-03-02')
  })
})

describe('fractionOf', () => {
  it('puts a day where it belongs in the window', () => {
    expect(fractionOf('2026-01-01', '2027-01-01', '2026-01-01')).toBe(0)
    expect(fractionOf('2026-01-01', '2027-01-01', '2027-01-01')).toBe(1)
    expect(fractionOf('2026-01-01', '2027-01-01', '2026-07-02')).toBeCloseTo(0.5, 2)
  })

  it('clamps rather than drawing off the end', () => {
    expect(fractionOf('2026-01-01', '2027-01-01', '2020-01-01')).toBe(0)
    expect(fractionOf('2026-01-01', '2027-01-01', '2030-01-01')).toBe(1)
    expect(fractionOf('2026-01-01', '2026-01-01', '2026-01-01')).toBe(0)
  })
})

describe('monthsFrom', () => {
  it('moves whole months, and lands inside the month it reaches', () => {
    expect(monthsFrom('2026-09-08', 1)).toBe('2026-10-08')
    expect(monthsFrom('2026-01-31', 1)).toBe('2026-03-03')
    expect(monthsFrom('2026-01-01', -1)).toBe('2025-12-01')
  })
})

describe('roadmapOf', () => {
  const model = {
    elements: [
      element('billing'),
      element('wms-old', { lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' } }),
      element('wms-new', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } }),
    ],
    relations: [],
    transitions: [{
      id: 'tr-1', number: 1, title: 'Replace it', status: 'agreed' as const,
      from: '2027-01-15', to: '2028-01-31', elements: [], decisions: [],
      milestones: [{ date: '2027-04-01', name: 'Cutover' }], body: '',
    }],
  }

  it('gives a row only to what has something to say', () => {
    // A landscape of four thousand elements with nine dates is a roadmap of a
    // handful of rows. The rest is on the canvas, where it belongs. Both change
    // first on the cutover day, so the tie falls to the name.
    expect(roadmapOf(model, TODAY).tracks.map((t) => t.element.id)).toEqual(['wms-new', 'wms-old'])
  })

  it('covers the plans as well as the elements', () => {
    const { from, to } = roadmapOf(model, TODAY)
    expect(from <= '2027-01-15').toBe(true)
    expect(to >= '2028-01-31').toBe(true)
  })

  it('carries the plans through untouched', () => {
    expect(roadmapOf(model, TODAY).transitions).toEqual(model.transitions)
  })

  it('has no rows at all for a landscape with no dates', () => {
    const bare = roadmapOf({ elements: [element('a'), element('b')], relations: [] }, TODAY)
    expect(bare.tracks).toEqual([])
    expect(bare.from).toBe('2026-03-08')
  })
})

/**
 * An initiative a scope below flagged brings the elements it names (ADR-0012
 * §7): they are plotted beside this scope's own, marked with where they came
 * from, and the axis reaches them.
 */
describe('roadmapOf — the initiatives from below', () => {
  const plan = {
    id: 'tr-r', number: 1, title: 'One warehouse', status: 'agreed' as const,
    from: '2029-01-01', to: '2029-12-31',
    elements: [{ elementId: 'wms-r', role: 'retires' as const }, { elementId: 'crm', role: 'changes' as const }],
    decisions: [], milestones: [], body: '',
  }
  const retail = {
    scope: 'acme/retail', plan,
    elements: [
      element('wms-r', { lifecycleDates: { retired: '2029-06-30' } }),
      element('crm'),
    ],
  }
  const own = {
    elements: [element('wms-old', { lifecycleDates: { retiring: '2027-04-01' } })],
    relations: [],
  }

  it('gives the dated elements a row each, saying which scope and which plan brought them', () => {
    const { tracks } = roadmapOf(own, TODAY, [retail])
    expect(tracks.map((t) => t.element.id)).toEqual(['wms-old', 'wms-r'])
    expect(tracks[1].below).toEqual({ scope: 'acme/retail', planId: 'tr-r' })
    expect(tracks[0].below).toBeUndefined()
    expect(tracks[1].spans.map((s) => s.phase)).toEqual(['live', 'retired'])
  })

  it('reaches the plan and the elements it brings, and keeps the plan out of this scope\u2019s own', () => {
    const roadmap = roadmapOf(own, TODAY, [retail])
    expect(roadmap.to >= '2029-12-31').toBe(true)
    expect(roadmap.transitions).toEqual([])
  })

  it('draws one row per id: this scope\u2019s own wins, and the first plan below wins over the second', () => {
    const twice = { ...retail, plan: { ...plan, id: 'tr-2' }, scope: 'acme/finance' }
    const ownToo = { ...own, elements: [...own.elements, element('wms-r', { lifecycleDates: { retired: '2030-01-01' } })] }
    const { tracks } = roadmapOf(ownToo, TODAY, [retail, twice])
    const brought = tracks.filter((t) => t.element.id === 'wms-r')
    expect(brought).toHaveLength(1)
    expect(brought[0].below).toBeUndefined()
    const other = roadmapOf(own, TODAY, [retail, twice]).tracks.filter((t) => t.element.id === 'wms-r')
    expect(other).toHaveLength(1)
    expect(other[0].below?.planId).toBe('tr-r')
  })

  it('survives a window cut with its origin intact', () => {
    const cut = within(roadmapOf(own, TODAY, [retail]), '2029-01-01', '2029-12-31')
    expect(cut.tracks.map((t) => [t.element.id, t.below?.scope]))
      .toEqual([['wms-old', undefined], ['wms-r', 'acme/retail']])
  })
})

/**
 * A relation carries a window whatever it means (ADR-0012 §5), so the axis has
 * to draw "the WMS supports fulfilment from March" the same way it draws the
 * temporary sync of a hybrid run.
 */
describe('roadmapOf — the relations with a window', () => {
  const relation = (id: string, type: Relation['type'], over: Partial<Relation> = {}): Relation =>
    ({ id, type, sourceId: 'wms', targetId: 'fulfilment', ...over })

  const model = {
    elements: [element('wms'), element('fulfilment')],
    relations: [
      relation('undated', 'flow'),
      relation('supports', 'supports', { validFrom: '2027-03-01' }),
      relation('sync', 'flow', { validFrom: '2026-06-01', validUntil: '2027-02-28', label: 'sync' }),
    ],
  }

  it('gives a row to the rows that say something about time, and to no others', () => {
    expect(roadmapOf(model, TODAY).relations.map((r) => r.relation.id)).toEqual(['sync', 'supports'])
  })

  it('carries both ends by name, so the row has a label without a second lookup', () => {
    const [first] = roadmapOf(model, TODAY).relations
    expect(first).toMatchObject({ sourceName: 'wms', targetName: 'fulfilment' })
  })

  it('keeps an id nobody holds rather than drawing a blank row', () => {
    const dangling = { elements: [], relations: [relation('r', 'supports', { validFrom: '2027-03-01' })] }
    expect(roadmapOf(dangling, TODAY).relations[0])
      .toMatchObject({ sourceName: 'wms', targetName: 'fulfilment' })
  })

  it('widens the axis to reach a window nothing else covers', () => {
    const { from, to } = roadmapOf(model, TODAY)
    expect(from <= '2026-06-01').toBe(true)
    expect(to >= '2027-03-01').toBe(true)
  })
})

describe('within', () => {
  const model = {
    elements: [
      element('early', { lifecycleDates: { retired: '2026-01-01' } }),
      element('late', { lifecycle: 'planned', lifecycleDates: { live: '2029-06-01' } }),
      element('long', { lifecycleDates: { retiring: '2025-01-01', retired: '2030-01-01' } }),
    ],
    relations: [],
    transitions: [
      { id: 'a', number: 1, title: 'Before', status: 'done' as const, from: '2025-01-01', to: '2025-12-31', elements: [], decisions: [], milestones: [], body: '' },
      { id: 'b', number: 2, title: 'During', status: 'agreed' as const, from: '2027-01-01', to: '2027-12-31', elements: [], decisions: [], milestones: [], body: '' },
      { id: 'c', number: 3, title: 'Undated', status: 'draft' as const, elements: [], decisions: [], milestones: [], body: '' },
      { id: 'd', number: 4, title: 'Only a milestone', status: 'draft' as const, elements: [], decisions: [], milestones: [{ date: '2027-06-01', name: 'x' }], body: '' },
    ],
  }
  const cut = within(roadmapOf(model, TODAY), '2027-01-01', '2028-12-31')

  it('becomes the window', () => {
    expect([cut.from, cut.to]).toEqual(['2027-01-01', '2028-12-31'])
  })

  it('keeps what is there during the window, and drops what is gone or not yet arrived', () => {
    // `early` was retired a year before the window opens; `late` does not go
    // live until after it closes. Neither has anything to say about 2027.
    expect(cut.tracks.map((t) => t.element.id)).toEqual(['long'])
  })

  it('keeps a track for a change inside the window even if the element is planned before it', () => {
    const arriving = within(roadmapOf(model, TODAY), '2029-01-01', '2029-12-31')
    expect(arriving.tracks.map((t) => t.element.id).sort()).toEqual(['late', 'long'])
    // And its spans start at the frame, not at the natural axis start.
    const late = arriving.tracks.find((t) => t.element.id === 'late')!
    expect(late.spans[0]).toEqual({ phase: 'planned', from: '2029-01-01', to: '2029-06-01' })
  })

  it('keeps a relation whose window overlaps, and an open end is open', () => {
    const model_ = {
      elements: [],
      relations: [
        { id: 'before', type: 'flow' as const, sourceId: 'a', targetId: 'b', validFrom: '2025-01-01', validUntil: '2025-12-31' },
        { id: 'during', type: 'supports' as const, sourceId: 'a', targetId: 'b', validFrom: '2027-06-01', validUntil: '2027-12-31' },
        { id: 'onwards', type: 'supports' as const, sourceId: 'a', targetId: 'b', validFrom: '2026-01-01' },
        { id: 'after', type: 'flow' as const, sourceId: 'a', targetId: 'b', validFrom: '2030-01-01' },
      ],
    }
    const window_ = within(roadmapOf(model_, TODAY), '2027-01-01', '2028-12-31')
    expect(window_.relations.map((r) => r.relation.id)).toEqual(['onwards', 'during'])
  })

  it('keeps the plans that touch the window, and the ones that say nothing about time', () => {
    expect(cut.transitions.map((p) => p.id)).toEqual(['b', 'c', 'd'])
  })
})

describe('shadowRunOf', () => {
  const plan = (elements: { elementId: string; role: 'introduces' | 'retires' | 'changes' }[]) => ({
    id: 'tr', number: 1, title: 'Replace', status: 'agreed' as const, elements, decisions: [], milestones: [], body: '',
  })
  const model = {
    elements: [
      element('old', { lifecycleDates: { retiring: '2027-03-01', retired: '2027-09-01' } }),
      element('new', { lifecycle: 'planned', lifecycleDates: { live: '2027-03-01' } }),
      element('undated'),
    ],
  }

  it('runs from the new one going live to the old one being gone', () => {
    expect(shadowRunOf(model, plan([{ elementId: 'old', role: 'retires' }, { elementId: 'new', role: 'introduces' }])))
      .toEqual({ from: '2027-03-01', to: '2027-09-01' })
  })

  it('is absent when either end has no date, or the plan is not a replacement', () => {
    expect(shadowRunOf(model, plan([{ elementId: 'undated', role: 'retires' }, { elementId: 'new', role: 'introduces' }]))).toBeUndefined()
    expect(shadowRunOf(model, plan([{ elementId: 'old', role: 'changes' }, { elementId: 'new', role: 'introduces' }]))).toBeUndefined()
  })
})
