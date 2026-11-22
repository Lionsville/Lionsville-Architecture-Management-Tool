// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the pickers that link a unit offer, and what the sheet is told of who
 * is responsible (ADR-0036, amended 11 October 2026), over one fictional
 * organisation: the units in the one order, grouped by type and saying where
 * each is filed; the scopes; the areas and capabilities by the scope that
 * defines them; and whether a unit serves a function's domain.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import type { DesignElement } from '../../model'
import type { HostModel } from '../../model/hostModel'
import type { UnitType } from '../../model/operatingModel'
import { indexScopes } from '../../projects/scopeIndex'
import { functionChoices, scopeChoices, unitChoices } from './choices'
import { sheetResponsibleFor, sheetResponsibleOf } from './sheetResponsible'

const s = translator('en')
const DAY = '2026-10-11'
const names: Record<string, string> = { '': 'the organisation', shipping: 'Shipping', warehouse: 'Warehouse', 'shipping/parcels': 'Parcels' }
const scopeName = (path: string) => names[path] ?? path

const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [] },
]
const element = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const fn = (id: string, name: string, over: Partial<DesignElement> = {}) => element(id, name, { kind: 'function', ...over })

const ROOT: HostModel = { name: 'Acme', elements: [fn('serve', 'Serve customers')], relations: [], diagrams: [], unitTypes: types }
const SHIPPING: HostModel = {
  name: 'Shipping', relations: [], diagrams: [],
  elements: [
    element('shipping', 'Shipping', { unitTypeId: 'ut-domain' }),
    element('tracking', 'Track & Trace', { unitTypeId: 'ut-team', parentId: 'shipping' }),
    element('carriers', 'Carriers', { outside: true }),
    fn('deliver', 'Deliver'), fn('plan', 'Plan a route', { parentId: 'deliver' }),
  ],
}
const WAREHOUSE: HostModel = {
  name: 'Warehouse', relations: [], diagrams: [],
  elements: [
    element('warehouse', 'Warehouse', { unitTypeId: 'ut-domain' }),
    element('robotics', 'Robotics', { unitTypeId: 'ut-team', parentId: 'warehouse' }),
    element('gone', 'Gone', { unitTypeId: 'ut-team', parentId: 'warehouse', lifecycle: 'retired' }),
    fn('store', 'Store goods'),
  ],
}
const index = indexScopes([{ path: '', model: ROOT }, { path: 'shipping', model: SHIPPING }, { path: 'warehouse', model: WAREHOUSE }])

describe('the units a picker offers', () => {
  const organisation = index.organisation()
  const kept = new Map(index.units().map(({ scope, unit }) => [unit.id, scope]))
  const filedIn = (id: string) => kept.get(id)

  it('are those there on the day, grouped by type in rank order, each saying where it is filed', () => {
    expect(unitChoices({ organisation, filedIn, day: DAY, scopeName, s })).toEqual([
      { id: 'shipping', label: 'Shipping', group: 'Domain', note: 'filed in Shipping' },
      { id: 'warehouse', label: 'Warehouse', group: 'Domain', note: 'filed in Warehouse' },
      { id: 'robotics', label: 'Robotics', group: 'Team', note: 'filed in Warehouse' },
      { id: 'tracking', label: 'Track & Trace', group: 'Team', note: 'filed in Shipping' },
    ])
  })

  it('leave some out, and show others as not to be picked with why', () => {
    const offered = unitChoices({
      organisation, filedIn, day: DAY, scopeName, s,
      leave: (unit) => unit.unitTypeId === 'ut-domain', refuse: (unit) => (unit.id === 'robotics' ? 'not now' : undefined),
    })
    expect(offered.map((one) => [one.id, one.note, one.disabled])).toEqual([['robotics', 'not now', true], ['tracking', 'filed in Shipping', undefined]])
    // A unit of a type the model does not hold is offered last, under a heading of its own; one not there on the day is not.
    const robotics = organisation.units.find((one) => one.id === 'robotics')!
    const strange = { ...organisation, units: [{ ...robotics, unitTypeId: 'ut-gone' }] }
    expect(unitChoices({ organisation: strange, filedIn: () => undefined, day: DAY, scopeName, s })).toEqual([{
      id: 'robotics', label: 'Robotics', group: 'Of a type the model does not hold',
    }])
  })
})

describe('the scopes a unit may serve', () => {
  it('are every scope but those it serves, each by its path from the organisation down', () => {
    // Flipped 13 October 2026: the organisation is no domain, so it is not offered.
    expect(scopeChoices({ scopes: ['', 'shipping', 'shipping/parcels', 'warehouse'], leave: ['warehouse'], scopeName, s })).toEqual([
      { id: 'shipping', label: 'Shipping' },
      { id: 'shipping/parcels', label: 'Shipping › Parcels' },
    ])
  })

  it('tell two scopes of one name apart by their paths', () => {
    const twice: Record<string, string> = { north: 'North', 'north/cameras': 'Cameras', south: 'South', 'south/cameras': 'Cameras' }
    const labels = scopeChoices({ scopes: ['north', 'north/cameras', 'south', 'south/cameras'], leave: [], scopeName: (path) => twice[path] ?? path, s })
      .map((one) => one.label)
    expect(labels).toEqual(['North', 'North › Cameras', 'South', 'South › Cameras'])
  })
})

describe('the areas and capabilities a unit may be made responsible for', () => {
  it('are this scope\'s own first, then the tree\'s by the scope that defines them, each with what it sits in', () => {
    expect(functionChoices({ index, scope: 'shipping', model: SHIPPING, leave: new Set(['deliver']), scopeName, s })).toEqual([
      { id: 'plan', label: 'Plan a route', group: 'Shipping', note: 'in Deliver' },
      { id: 'serve', label: 'Serve customers', group: 'the organisation' },
      { id: 'store', label: 'Store goods', group: 'Warehouse' },
    ])
  })
})

describe('who is responsible, as the sheet is told', () => {
  const at = { index, scope: 'shipping', model: SHIPPING, day: DAY, scopeName, s }

  it('offers the units, then this scope\'s other actors, and names a unit kept elsewhere', () => {
    const responsible = sheetResponsibleOf(at)
    expect(responsible.choices.map((one) => [one.label, one.group])).toEqual([
      ['Shipping', 'Domain'], ['Warehouse', 'Domain'], ['Robotics', 'Team'], ['Track & Trace', 'Team'], ['Carriers', 'Others in this scope'],
    ])
    expect(responsible.name('robotics')).toBe('Robotics')
    expect(responsible.name('serve')).toBe('Serve customers')
    expect(responsible.name('nobody')).toBeUndefined()
  })

  it('says whether a unit serves the domain of the function, itself or through the unit above it', () => {
    const responsible = sheetResponsibleOf(at)
    expect(responsible.serves('tracking', 'plan')).toBe(true)
    expect(responsible.serves('robotics', 'plan')).toBe(false)
    // A capability of the whole organisation is served by every unit in it.
    expect(responsible.serves('robotics', 'serve')).toBe(true)
    // An actor that is not a unit has nothing to say about it.
    expect(responsible.serves('carriers', 'plan')).toBe(true)
  })

  it('is the same answer for the same model, index and day, and a new one when one moves', () => {
    const first = sheetResponsibleFor(at)
    expect(sheetResponsibleFor({ ...at })).toBe(first)
    expect(sheetResponsibleFor({ ...at, day: '2026-10-12' })).not.toBe(first)
  })

  it('names each unit with the scopes it serves, never the organisation, and nothing for an actor that is not one', () => {
    const top = indexScopes([
      { path: '', model: { ...ROOT, elements: [...ROOT.elements, element('ops', 'Operations', { unitTypeId: 'ut-domain' })] } },
      { path: 'shipping', model: SHIPPING }, { path: 'warehouse', model: WAREHOUSE },
    ])
    const responsible = sheetResponsibleOf({ ...at, index: top })
    expect(responsible.unit?.('robotics')).toEqual({ name: 'Robotics', serves: [{ scope: 'warehouse', name: 'Warehouse' }] })
    expect(responsible.unit?.('ops')).toEqual({ name: 'Operations', serves: [] })
    expect(responsible.unit?.('carriers')).toBeUndefined()
    // No ways out handed in: the label opens nothing.
    expect(responsible.openScope).toBeUndefined()
  })

  it('opens a scope\'s home, and a unit in the scope that keeps it, by the latest ways out the host handed in', () => {
    const went: string[] = []
    const ways = (tag: string) => ({ home: (path: string) => went.push(`${tag} home ${path}`), unit: (kept: string, id: string) => went.push(`${tag} unit ${kept} ${id}`) })
    const model: HostModel = { ...SHIPPING }
    const first = sheetResponsibleFor({ ...at, model, open: ways('a') })
    first.openScope?.('warehouse')
    first.openUnit?.('robotics')
    // A fresh pair per render keeps the answer, so the sheet is not laid out again, and is the pair used.
    const again = sheetResponsibleFor({ ...at, model, open: ways('b') })
    expect(again).toBe(first)
    again.openUnit?.('tracking')
    first.openUnit?.('nowhere')
    expect(went).toEqual(['a home warehouse', 'a unit warehouse robotics', 'b unit shipping tracking'])
    expect(sheetResponsibleFor({ ...at, model })).not.toBe(first)
  })
})
