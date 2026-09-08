/**
 * The landscape on an axis (ADR-0009).
 *
 * In days rather than pixels, which is what lets the interesting part — where a
 * phase begins and ends, and which rows are worth a line at all — be checked
 * without a browser.
 */
import { describe, expect, it } from 'vitest'
import { fractionOf, monthsFrom, rangeOf, roadmapOf, spansFor } from './timeline'
import type { DesignElement } from '../model/types'

const TODAY = '2026-09-08'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live',
    isManaged: true, aspects: {}, parameters: {}, ...over,
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
    const bare = roadmapOf({ elements: [element('a'), element('b')] }, TODAY)
    expect(bare.tracks).toEqual([])
    expect(bare.from).toBe('2026-03-08')
  })
})
