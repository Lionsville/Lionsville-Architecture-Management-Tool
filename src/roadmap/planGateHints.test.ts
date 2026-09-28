// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n/strings'
import type { DesignElement, Transition } from '../model'
import type { Adr } from '../model/adr'
import { gateElement, planGateHint } from './planGateHints'
import type { GateReading } from './planGateHints'

const t = translator('en')

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

const PLAN: Transition = {
  id: 'tr-1', number: 1, title: 'Move the depot', status: 'running', from: '2027-01-01', to: '2027-12-31',
  elements: [
    { elementId: 'dated', role: 'introduces' },
    { elementId: 'bare', role: 'introduces' },
    { elementId: 'held', role: 'introduces' },
    { elementId: 'gone', role: 'introduces' },
  ],
  decisions: [], milestones: [], body: '',
}

const reading = (over: Partial<GateReading> = {}): GateReading => ({
  plan: PLAN,
  elements: [
    element('dated', 'Yard Planner', { lifecycleDates: { live: '2027-03-01' } }),
    element('bare', 'Dock Board'),
    element('held', 'Fleet Desk', { ref: 'fleet', lifecycleDates: { live: '2027-03-01' } }),
  ],
  decisions: [],
  describe: (id) => (id === 'held' ? { where: 'Fleet', retired: '2029-01-01' } : undefined),
  t,
  ...over,
})

describe('gateElement', () => {
  it('lets a definition answer for itself', () => {
    const held = element('a', 'A', { lifecycleDates: { live: '2027-01-01' } })
    expect(gateElement(held, undefined)).toBe(held)
    expect(gateElement(undefined, undefined)).toBeUndefined()
  })

  it('dates a stand-in by the day the tree says it is gone, and by nothing it holds itself', () => {
    const held = element('a', 'A', { ref: 'elsewhere', lifecycleDates: { live: '2027-01-01', retired: '2027-02-01' } })
    expect(gateElement(held, () => ({ retired: '2028-05-01' }))).toEqual({ lifecycleDates: { retired: '2028-05-01' } })
    expect(gateElement(held, () => undefined)).toEqual({})
    expect(gateElement(held, undefined)).toEqual({})
  })
})

describe('planGateHint', () => {
  it('says only the rule while the line is clear', () => {
    expect(planGateHint('owner', true, reading())).toBe(t('plan.gateHint.owner'))
    expect(planGateHint('introducedLive', true, reading())).toBe(t('plan.gateHint.introducedLive'))
  })

  it('names what is undated here, what is kept in another scope, and says a row is no longer here', () => {
    const hint = planGateHint('introducedLive', false, reading())
    expect(hint).toContain('Still without that day: Dock Board.')
    // The stand-in's own leftover go-live day is not read: it is the owner's detail.
    expect(hint).toContain('Kept in another scope: Fleet Desk in Fleet.')
    expect(hint).toContain('no longer here')
    expect(hint).not.toContain('Yard Planner')
  })

  it('counts a stand-in the plan retires as dated once its own scope gives it a day gone', () => {
    const plan = { ...PLAN, elements: [{ elementId: 'held', role: 'retires' as const }] }
    expect(planGateHint('retiredDated', false, reading({ plan }))).toBe(t('plan.gateHint.retiredDated'))
    const hint = planGateHint('retiredDated', false, reading({ plan, describe: () => ({ where: 'Fleet' }) }))
    expect(hint).toContain('give it a “Gone on” day there')
  })

  it('names the records not accepted with their status, and one deleted since', () => {
    const decisions: Adr[] = [
      { id: 'a', number: 4, title: 'Buy a yard system', status: 'reviewing', date: '2026-01-01', body: '', signers: [] },
      { id: 'b', number: 5, title: 'Keep the scanners', status: 'accepted', date: '2026-01-01', body: '', signers: [] },
    ]
    const hint = planGateHint('decisions', false, reading({ plan: { ...PLAN, decisions: ['a', 'b', 'x'] }, decisions }))
    expect(hint).toContain('Not accepted yet: ADR-0004 Buy a yard system (under review).')
    expect(hint).not.toContain('Keep the scanners')
    expect(hint).toContain('no longer here')
  })
})
