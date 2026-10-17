// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The reporting lines drawn between the structure's cards (ADR-0039 §7, amended): where each runs from and to, and its path. */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { roleLinePath, roleLinePaths, roleLines } from './roleLines'

const types: UnitType[] = [
  { id: 'company', name: 'Company', top: true, within: [], slots: [{ role: 'ceo', min: 1, max: 1 }] },
  { id: 'tech', name: 'Technology', within: ['company'], slots: [{ role: 'hot', min: 1, max: 1 }, { role: 'lead', min: 0 }] },
  { id: 'bu', name: 'Business unit', within: ['company'], slots: [{ role: 'head', min: 1, max: 1 }, { role: 'tm', min: 0, max: 1, reportsTo: [{ role: 'hot', kind: 'solid' }] }, { role: 'lead', min: 0 }] },
  { id: 'team', name: 'Team', within: ['bu', 'tech'], slots: [{ role: 'lead', min: 1, max: 1 }, { role: 'dev', min: 0 }, { role: 'sm', min: 0, max: 1 }, { role: 'po', min: 0, max: 1 }] },
  { id: 'guild', name: 'Guild', within: [], slots: [{ role: 'lead', min: 1 }] },
]
const roles: Role[] = [
  { id: 'ceo', name: 'CEO', duties: [] }, { id: 'hot', name: 'Head of technology', duties: [] }, { id: 'head', name: 'Head', duties: [] },
  { id: 'tm', name: 'Technology manager', duties: [] }, { id: 'lead', name: 'Lead', duties: [], reportsTo: [{ role: 'lead', kind: 'solid' }] },
  { id: 'dev', name: 'Developer', duties: [], reportsTo: [{ role: 'lead', kind: 'solid', within: true }, { role: 'hot', kind: 'dotted' }] },
  { id: 'sm', name: 'Scrum master', duties: [], reportsTo: [{ role: 'po', kind: 'solid', within: true }] }, { id: 'po', name: 'Product owner', duties: [] },
]
const structure = unitTypeLanes(types)

describe('the lines between the cards', () => {
  it('draws a slot\'s line to the types that hold the role, a role\'s line from every type that holds it, and a within line on the card itself', () => {
    const lines = roleLines(structure, types, roles)
    const said = (from: string, role: string) => lines.filter((line) => line.from.typeId === from && line.from.roleId === role)
      .map((line) => `${line.kind}>${line.to.typeId}/${line.to.roleId}${line.within ? ' within' : ''}${line.ambiguous ? ' ?' : ''}`)
    expect(said('bu', 'tm')).toEqual(['solid>tech/hot'])
    expect(said('team', 'dev')).toEqual(['solid>team/lead within', 'dotted>tech/hot'])
    expect(said('team', 'sm')).toEqual(['solid>team/po within'])
    // A lead reports to the lead above: from a team, to the business unit's and the technology department's; from those, nowhere above holds one.
    expect(said('team', 'lead')).toEqual(['solid>bu/lead', 'solid>tech/lead'])
    expect(said('bu', 'lead')).toEqual(['solid>tech/lead ?', 'solid>team/lead ?'])
    // A type that sits nowhere draws none, and nothing is drawn to it.
    expect(said('guild', 'lead')).toEqual([])
    expect(lines.some((line) => line.to.typeId === 'guild')).toBe(false)
    expect(lines.every((line) => line.source === (line.from.roleId === 'tm' ? 'type' : 'role'))).toBe(true)
  })

  it('runs across to a card beside, out of the right side and back for one above or below, and as a bulge on one card', () => {
    const a = { left: 0, top: 10, right: 50, bottom: 20 }
    expect(roleLinePath(a, { left: 100, top: 30, right: 150, bottom: 40 }, false)).toBe('M50,15 C75,15 75,35 100,35')
    expect(roleLinePath({ left: 100, top: 30, right: 150, bottom: 40 }, a, false)).toBe('M100,35 C75,35 75,15 50,15')
    expect(roleLinePath(a, { left: 0, top: 50, right: 50, bottom: 60 }, false)).toBe('M50,15 C74,15 74,55 50,55')
    expect(roleLinePath(a, { left: 0, top: 50, right: 50, bottom: 60 }, true)).toBe('M50,15 C66,15 66,55 50,55')
    const drawn = roleLinePaths(roleLines(structure, types, roles), (end) => (end.typeId === 'team' ? { left: 0, top: 0, right: 40, bottom: 10 } : undefined))
    // Only the lines with both chips on the stage.
    expect(drawn.map((line) => line.key)).toEqual(['team/dev/solid>team', 'team/sm/solid>team'])
  })
})
