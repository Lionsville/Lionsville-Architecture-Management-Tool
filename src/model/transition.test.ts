/**
 * A plan (ADR-0009).
 *
 * Two things here are deliberate departures from the decision record beside it,
 * and both get a test: a plan does not lock when it ends, and a plan can be
 * reopened. The rest is the arithmetic a roadmap reads.
 */
import { describe, expect, it } from 'vitest'
import {
  addDays, elementsWithRole, isTransitionFinished, nextTransitionNumber, setTransitionStatus,
  shiftDays, sortTransitions, transitionDays, transitionLabel, transitionsForElement,
  transitionsFrom,
} from './transition'
import type { Transition, TransitionStatus } from './transition'

function plan(over: Partial<Transition> = {}): Transition {
  return {
    id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed',
    from: '2027-01-15', to: '2028-01-31', owner: 'Logistics IT',
    elements: [
      { elementId: 'wms-new', role: 'introduces' },
      { elementId: 'wms-old', role: 'retires' },
      { elementId: 'billing', role: 'changes' },
    ],
    decisions: ['adr-4'],
    milestones: [
      { date: '2027-04-01', name: 'Cutover begins' },
      { date: '2028-01-31', name: 'Old system off' },
    ],
    body: '## Goal\n\nOne warehouse system.',
    ...over,
  }
}

describe('the status machine', () => {
  it('runs forwards through the work', () => {
    expect(transitionsFrom('draft')).toContain('agreed')
    expect(transitionsFrom('agreed')).toContain('running')
    expect(transitionsFrom('running')).toContain('done')
  })

  it('lets every step be taken back, unlike a decision', () => {
    // A decision that turned out not to be decided is a contradiction; a plan
    // that turned out not to be finished is a Tuesday.
    expect(transitionsFrom('agreed')).toContain('draft')
    expect(transitionsFrom('running')).toContain('agreed')
    expect(transitionsFrom('done')).toContain('running')
    expect(transitionsFrom('abandoned')).toContain('draft')
  })

  it('can be abandoned from anywhere it is still alive', () => {
    for (const status of ['draft', 'agreed', 'running'] as TransitionStatus[]) {
      expect(transitionsFrom(status), status).toContain('abandoned')
    }
  })

  it('moves only where the machine allows', () => {
    expect(setTransitionStatus(plan({ status: 'draft' }), 'running').status).toBe('draft')
    expect(setTransitionStatus(plan({ status: 'draft' }), 'agreed').status).toBe('agreed')
  })

  it('knows which plans are over, without sealing them', () => {
    expect(isTransitionFinished(plan({ status: 'done' }))).toBe(true)
    expect(isTransitionFinished(plan({ status: 'abandoned' }))).toBe(true)
    expect(isTransitionFinished(plan({ status: 'running' }))).toBe(false)
    // Nothing here refuses an edit to a finished plan: what locking protected —
    // knowing what it said last week — is the folder's history (ADR-0008).
  })
})

describe('numbering and naming', () => {
  it('never reuses a number, even after the highest is removed', () => {
    const list = [plan({ id: 'a', number: 1 }), plan({ id: 'b', number: 7 })]
    expect(nextTransitionNumber(list)).toBe(8)
    expect(nextTransitionNumber(list.filter((one) => one.number !== 7))).toBe(2)
    expect(nextTransitionNumber([])).toBe(1)
  })

  it('says the name people say out loud', () => {
    expect(transitionLabel({ number: 3 })).toBe('TR-0003')
    expect(transitionLabel({ number: 1234 })).toBe('TR-1234')
  })

  it('reads oldest first, which is the order work happens in', () => {
    const list = [plan({ id: 'b', number: 2 }), plan({ id: 'a', number: 1 })]
    expect(sortTransitions(list).map((one) => one.id)).toEqual(['a', 'b'])
  })
})

describe('what a plan touches', () => {
  it('answers which plans name an element', () => {
    const list = [plan(), plan({ id: 'tr-2', number: 2, elements: [{ elementId: 'other', role: 'changes' }] })]
    expect(transitionsForElement(list, 'wms-old').map((one) => one.id)).toEqual(['tr-1'])
    expect(transitionsForElement(list, 'nobody')).toEqual([])
  })

  it('separates what arrives from what goes', () => {
    expect(elementsWithRole(plan(), 'introduces')).toEqual(['wms-new'])
    expect(elementsWithRole(plan(), 'retires')).toEqual(['wms-old'])
    expect(elementsWithRole(plan(), 'changes')).toEqual(['billing'])
  })

  it('collects its own days, once and in order', () => {
    expect(transitionDays(plan())).toEqual(['2027-01-15', '2027-04-01', '2028-01-31'])
  })

  it('has no days when nobody has dated it', () => {
    expect(transitionDays(plan({ from: undefined, to: undefined, milestones: [] }))).toEqual([])
  })
})

describe('a plan that slips', () => {
  it('moves its window and its milestones together', () => {
    const later = shiftDays(plan(), 30)
    expect(later.from).toBe('2027-02-14')
    expect(later.to).toBe('2028-03-01')
    expect(later.milestones.map((m) => m.date)).toEqual(['2027-05-01', '2028-03-01'])
  })

  it('moves backwards too, and leaves everything else alone', () => {
    const earlier = shiftDays(plan(), -14)
    expect(earlier.from).toBe('2027-01-01')
    expect(earlier.title).toBe(plan().title)
    expect(earlier.elements).toEqual(plan().elements)
  })

  it('leaves a plan with no dates untouched', () => {
    const undated = plan({ from: undefined, to: undefined, milestones: [] })
    expect(shiftDays(undated, 30)).toEqual(undated)
  })

  it('does not touch the elements it only names', () => {
    // The dates on an element belong to the element, so the canvas can draw a
    // day without knowing plans exist. The caller moves those in the same
    // transaction; this function moving them would be writing where it reads.
    expect(shiftDays(plan(), 30).elements).toEqual(plan().elements)
  })
})

describe('addDays', () => {
  it('crosses a month and a year', () => {
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01')
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('crosses a daylight-saving boundary without losing a day', () => {
    // The reason this is UTC: a local Date built from a calendar day and moved
    // across the March or October change lands on the day before.
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28')
    expect(addDays('2027-10-30', 1)).toBe('2027-10-31')
  })

  it('goes backwards', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})
