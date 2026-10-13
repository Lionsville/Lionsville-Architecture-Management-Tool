// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who answers for a function, as the sheet reads it (ADR-0036, amended 13
 * October 2026): the units always, with the scopes they serve; the other
 * actors only behind the toggle; and where a label leads.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import type { DesignModel } from '../../model'
import { actor, area, relation } from '../testFixtures'
import type { SheetResponsible } from './FunctionInspector'
import { unitTargets, whoOf } from './Responsible'

const t = translator('en')
const model: DesignModel = {
  elements: [area('pack', 'Pack'), actor('team', 'Team'), actor('visitor', 'Visitor')],
  relations: [relation('a1', 'assigned', 'team', 'pack'), relation('a2', 'assigned', 'visitor', 'pack')],
} as DesignModel
const responsible: SheetResponsible = {
  choices: [],
  name: () => undefined,
  serves: () => true,
  unit: (id) => (id === 'team' ? { name: 'Team', serves: [{ scope: 'warehouse', name: 'Warehouse' }] } : undefined),
}

describe('who answers for a function', () => {
  it('names the units always, and the other actors only while the toggle is on', () => {
    const off = whoOf(model, undefined, responsible, false)
    expect(off.units('pack')).toEqual([{ id: 'team', name: 'Team', outside: false, serves: [{ scope: 'warehouse', name: 'Warehouse' }] }])
    expect(off.of('pack')).toEqual([])
    expect(whoOf(model, undefined, responsible, true).of('pack')).toEqual([{ id: 'visitor', name: 'Visitor', outside: false }])
    expect(off.anybody('pack')).toBe(true)
    expect(off.anybody('nothing')).toBe(false)
    // A host that says nothing of units: every holder is a chip, as before.
    const plain = whoOf(model, undefined, { ...responsible, unit: undefined }, true)
    expect(plain.of('pack').map((one) => one.id)).toEqual(['team', 'visitor'])
    expect(plain.units('pack')).toEqual([])
  })
})

describe('where a label leads', () => {
  it('is each scope a unit serves, or the unit where it is kept, and nothing the host cannot open', () => {
    const went: string[] = []
    const open = { openScope: (scope: string) => went.push(scope), openUnit: (id: string) => went.push(`unit ${id}`) }
    const units = [
      { id: 'team', name: 'Team', outside: false, serves: [{ scope: 'warehouse', name: 'Warehouse' }] },
      { id: 'lone', name: 'Lone', outside: true, serves: [] },
    ]
    const targets = unitTargets(units, open, t)
    expect(targets.map((one) => [one.label, one.note])).toEqual([['Warehouse', 'Team'], ['Lone', 'where it is kept']])
    targets.forEach((one) => one.go())
    expect(went).toEqual(['warehouse', 'unit lone'])
    expect(unitTargets([units[0]], open, t).map((one) => one.note)).toEqual([undefined])
    expect(unitTargets(units, {}, t)).toEqual([])
  })
})
