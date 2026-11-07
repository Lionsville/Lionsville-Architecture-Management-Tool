// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The landscape on an axis (ADR-0009).
 *
 * In days rather than pixels, which is what lets the interesting part — where a
 * phase begins and ends, and which rows are worth a line at all — be checked
 * without a browser.
 */
import { describe, expect, it } from 'vitest'
import { monthsFrom, rangeOf, roadmapOf, shadowRunOf, spansFor } from './timeline'
import type { DesignElement, Relation } from '../model/types'

const TODAY = '2026-09-08'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live',
    isManaged: true, aspects: {}, ...over,
  }
}

describe('spansFor', () => {
  it('walks a hybrid run, skipping the phases that were, and collapsing a same-day cutover', () => {
    const wms = element('wms', { lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' } })
    expect(spansFor(wms, '2026-01-01')).toEqual([
      { phase: 'live', from: '2026-01-01', to: '2027-04-01' },
      { phase: 'retiring', from: '2027-04-01', to: '2028-01-31' },
      { phase: 'retired', from: '2028-01-31' },
    ])
    const wms2 = element('wms2', { lifecycleDates: { retired: '2028-01-31' } })
    expect(spansFor(wms2, '2026-01-01').map((s) => s.phase)).toEqual(['live', 'retired'])
    const wms3 = element('wms3', { lifecycleDates: { retiring: '2028-01-31', retired: '2028-01-31' } })
    expect(spansFor(wms3, '2026-01-01')).toEqual([
      { phase: 'live', from: '2026-01-01', to: '2028-01-31' },
      { phase: 'retired', from: '2028-01-31' },
    ])
    expect(spansFor(element('billing'), '2026-01-01')).toEqual([{ phase: 'live', from: '2026-01-01' }])
  })

  it('opens in the phase the element is in when the window starts', () => {
    const wms = element('wms', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } })
    expect(spansFor(wms, '2026-01-01')[0]).toEqual({ phase: 'planned', from: '2026-01-01', to: '2027-04-01' })
    // A window that opens after the go-live starts live, with no planned span.
    expect(spansFor(wms, '2027-06-01')).toEqual([{ phase: 'live', from: '2027-06-01' }])
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

})

describe('rangeOf', () => {
  it('covers everything with a month of air at each end, and a year around today for nothing', () => {
    // A month past the 31st lands in March: the padding is air, and a couple of
    // extra days of it is not worth arithmetic that special-cases February.
    expect(rangeOf(['2027-04-01', '2028-01-31'], TODAY)).toEqual({ from: '2026-08-08', to: '2028-03-02' })
    expect(rangeOf([], TODAY)).toEqual({ from: '2026-03-08', to: '2027-03-08' })
    expect(rangeOf(['soon', '2027-04-01', '2028-01-31'], TODAY).to).toBe('2028-03-02')
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

  it('gives a row only to what has something to say, and carries the plans through untouched', () => {
    // A landscape of four thousand elements with nine dates is a roadmap of a
    // handful of rows. The rest is on the canvas, where it belongs. Both change
    // first on the cutover day, so the tie falls to the name.
    expect(roadmapOf(model, TODAY).tracks.map((t) => t.element.id)).toEqual(['wms-new', 'wms-old'])
    expect(roadmapOf(model, TODAY).transitions).toEqual(model.transitions)
  })

  it('covers the plans as well as the elements', () => {
    const { from, to } = roadmapOf(model, TODAY)
    expect(from <= '2027-01-15').toBe(true)
    expect(to >= '2028-01-31').toBe(true)
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

  it('gives a row to what says something about time, by name, keeping an id nobody holds', () => {
    expect(roadmapOf(model, TODAY).relations.map((r) => r.relation.id)).toEqual(['sync', 'supports'])
    const [first] = roadmapOf(model, TODAY).relations
    expect(first).toMatchObject({ sourceName: 'wms', targetName: 'fulfilment' })
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
