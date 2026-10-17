// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Reporting lines (ADR-0039): where a line lands, who manages by it and why,
 * what a manager reaches, what the lines contradict and what is refused. One
 * fictional organisation: business units whose technology lead reports to the
 * head of technology, and whose architect answers to the chief architect on
 * how the work is done.
 */
import { describe, expect, it } from 'vitest'
import { managedReach, reachesAssignment, reachVia } from './managing'
import type { Role, UnitType } from './operatingModel'
import {
  loopMadeBy, refuseRoleLines, refuseSlotLine, refuseUnitLine, reportingFindings, reportingLoops, unitLinesWith, unitLinesWithout, withRoleLines,
  withUnitLines,
} from './reporting'
import type { DesignElement } from './types'
import { dottedLinesOf, managedBy, managersOf, reportingLinesOn, solidLineOf } from './units'
import type { Assignment, Organisation } from './units'

const company: UnitType = { id: 'ut-company', name: 'Company', top: true, within: [], slots: [{ role: 'ro-ceo', min: 1, max: 1 }] }
const department: UnitType = {
  id: 'ut-dept', name: 'Department', within: ['ut-company'],
  slots: [{ role: 'ro-hot', min: 0, max: 1 }, { role: 'ro-chief', min: 0, max: 1 }],
}
const business: UnitType = {
  id: 'ut-bu', name: 'Business unit', within: ['ut-company'],
  slots: [
    { role: 'ro-head', min: 1, max: 1 },
    { role: 'ro-lead', min: 1, max: 1, reportsTo: { role: 'ro-hot', kind: 'solid' } },
    { role: 'ro-arch', min: 0, reportsTo: { role: 'ro-chief', kind: 'dotted' } },
    { role: 'ro-member', min: 0 },
  ],
}
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-bu'],
  slots: [{ role: 'ro-tl', min: 1, max: 1, reportsTo: { role: 'ro-lead', kind: 'solid' } }, { role: 'ro-member', min: 0 }],
}
const roles: Role[] = [
  { id: 'ro-ceo', name: 'Chief executive', duties: [], manages: true },
  { id: 'ro-hot', name: 'Head of technology', duties: [], manages: true },
  { id: 'ro-chief', name: 'Chief architect', duties: [] },
  { id: 'ro-head', name: 'Head', duties: [], manages: true },
  { id: 'ro-lead', name: 'Technology lead', duties: [], manages: true },
  { id: 'ro-arch', name: 'Architect', duties: [] },
  { id: 'ro-member', name: 'Member', duties: [] },
  { id: 'ro-tl', name: 'Team lead', duties: [], manages: true },
]

function unit(id: string, unitTypeId: string, parentId?: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'actor', name: id, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}), ...over }
}

let next = 0
function held(unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment {
  next += 1
  return { id: `as-${next}`, unitId, roleId, person: { person }, ...over }
}

const units = [
  unit('co', 'ut-company'),
  unit('tech', 'ut-dept', 'co'),
  unit('retail', 'ut-bu', 'co'),
  unit('wholesale', 'ut-bu', 'co'),
  unit('checkout', 'ut-team', 'retail'),
]
const assignments = [
  held('co', 'ro-ceo', 'pe-ceo'),
  held('tech', 'ro-hot', 'pe-hot'),
  held('tech', 'ro-chief', 'pe-chief'),
  held('retail', 'ro-head', 'pe-head'),
  held('retail', 'ro-lead', 'pe-lead'),
  held('retail', 'ro-arch', 'pe-arch'),
  held('retail', 'ro-member', 'pe-member'),
  held('wholesale', 'ro-head', 'pe-head2'),
  held('checkout', 'ro-tl', 'pe-tl'),
  held('checkout', 'ro-member', 'pe-dev'),
]
const organisation: Organisation = { units, assignments, roles, unitTypes: [company, department, business, team] }
const TODAY = '2026-10-16'

const people = (found: { person: string; via: string }[]) => found.map((one) => `${one.person}:${one.via}`)

describe('where a line lands', () => {
  it('lands a type\'s line on the nearest unit above with the role, else on the one unit that has it', () => {
    const lines = reportingLinesOn(organisation, TODAY)
    expect(lines.find((one) => one.unitId === 'retail' && one.roleId === 'ro-lead')).toMatchObject({
      kind: 'solid', source: 'type', state: 'lands', to: { unitId: 'tech', roleId: 'ro-hot' },
    })
    expect(lines.find((one) => one.unitId === 'retail' && one.roleId === 'ro-arch')).toMatchObject({
      kind: 'dotted', state: 'lands', to: { unitId: 'tech', roleId: 'ro-chief' },
    })
    // A team's lead reports to the technology lead of the business unit it sits in, not to another's.
    expect(lines.find((one) => one.unitId === 'checkout')).toMatchObject({ state: 'lands', to: { unitId: 'retail', roleId: 'ro-lead' } })
  })

  it('says nothing where nothing is said, and so nesting answers everywhere', () => {
    const plain: Organisation = { ...organisation, unitTypes: organisation.unitTypes.map((type) => ({ ...type, slots: type.slots.map(({ reportsTo: _gone, ...slot }) => slot) })) }
    expect(reportingLinesOn(plain, TODAY)).toEqual([])
    expect(people(managersOf(plain, 'retail', TODAY, 'ro-lead'))).toEqual(['pe-head:nesting', 'pe-lead:nesting', 'pe-ceo:nesting'])
  })

  it('is dangling where no unit has the role, and ambiguous where several have it and none is above', () => {
    const noTech: Organisation = { ...organisation, units: units.filter((one) => one.id !== 'tech' && one.id !== 'checkout') }
    expect(reportingLinesOn(noTech, TODAY).find((one) => one.roleId === 'ro-lead')?.state).toBe('dangling')
    const twoTech: Organisation = { ...organisation, units: [...units, unit('tech2', 'ut-dept', 'co')] }
    expect(reportingLinesOn(twoTech, TODAY).find((one) => one.unitId === 'retail' && one.roleId === 'ro-lead')).toMatchObject({
      state: 'ambiguous', candidates: ['tech', 'tech2'],
    })
  })

  it('runs on its days, as the slot says them', () => {
    const later: Organisation = {
      ...organisation,
      unitTypes: [company, department, { ...business, slots: business.slots.map((slot) => (slot.role === 'ro-lead' ? { ...slot, reportsTo: { role: 'ro-hot', kind: 'solid' as const, from: '2027-01-01' } } : slot)) }, team],
    }
    expect(solidLineOf(later, 'retail', 'ro-lead', TODAY)).toBeUndefined()
    expect(solidLineOf(later, 'retail', 'ro-lead', '2027-01-01')?.to).toEqual({ unitId: 'tech', roleId: 'ro-hot' })
  })

  it('takes a unit\'s own line over its type\'s, and a line with no target as nesting here', () => {
    const nesting = withUnitLines(organisation, 'wholesale', [{ role: 'ro-lead', kind: 'solid' }])
    expect(reportingLinesOn(nesting, TODAY).find((one) => one.unitId === 'wholesale' && one.roleId === 'ro-lead')).toMatchObject({ source: 'unit', state: 'nesting' })
    const elsewhere = withUnitLines(organisation, 'wholesale', [{ role: 'ro-lead', kind: 'solid', to: { scope: 'operations', unit: 'co', role: 'ro-ceo' } }])
    expect(solidLineOf(elsewhere, 'wholesale', 'ro-lead', TODAY)?.to).toEqual({ unitId: 'co', roleId: 'ro-ceo' })
    // The dotted line of the type still runs beside a solid one of the unit's own.
    expect(dottedLinesOf(elsewhere, 'wholesale', TODAY).map((one) => one.roleId)).toEqual(['ro-arch'])
  })
})

describe('who manages, and why', () => {
  it('manages the holders of a role with a solid line by the target\'s holders, and then by whoever manages them', () => {
    expect(people(managersOf(organisation, 'retail', TODAY, 'ro-lead'))).toEqual(['pe-hot:line', 'pe-ceo:nesting'])
    expect(people(managersOf(organisation, 'checkout', TODAY, 'ro-tl'))).toEqual(['pe-lead:line', 'pe-hot:line', 'pe-ceo:nesting'])
  })

  it('manages the rest of the unit by nesting, and says a dotted line apart', () => {
    expect(people(managersOf(organisation, 'retail', TODAY, 'ro-member'))).toEqual(['pe-head:nesting', 'pe-lead:nesting', 'pe-hot:line', 'pe-ceo:nesting'])
    expect(people(managersOf(organisation, 'retail', TODAY, 'ro-arch'))).not.toContain('pe-chief:line')
    expect(dottedLinesOf(organisation, 'retail', TODAY, 'ro-arch')[0].to).toEqual({ unitId: 'tech', roleId: 'ro-chief' })
  })

  it('stops a chain at the first role it meets twice, so a loop still answers', () => {
    const loop = withUnitLines(organisation, 'tech', [{ role: 'ro-hot', kind: 'solid', to: { scope: '', unit: 'retail', role: 'ro-lead' } }])
    expect(people(managersOf(loop, 'retail', TODAY, 'ro-lead'))).toEqual(['pe-hot:line', 'pe-lead:line'])
  })
})

describe('what a manager reaches', () => {
  it('reaches a role by a line that lands on theirs, and nesting no longer reaches it', () => {
    const hot = managedBy(organisation, 'pe-hot', TODAY)
    // Wholesale's lead too, though nobody holds it yet: a line reaches a role, whoever holds it later.
    expect(hot.lines).toEqual([{ unitId: 'retail', roleId: 'ro-lead' }, { unitId: 'wholesale', roleId: 'ro-lead' }, { unitId: 'checkout', roleId: 'ro-tl' }])
    // The lead manages, so a team below the business unit is the head of technology's by the line in turn.
    expect(hot.units).toEqual(['tech', 'retail', 'checkout', 'wholesale'])
    const head = managedBy(organisation, 'pe-head', TODAY)
    expect(head.elsewhere).toEqual([{ unitId: 'retail', roleId: 'ro-lead' }, { unitId: 'checkout', roleId: 'ro-tl' }])
  })

  it('lets the manager by a line change that role, managing or not, and the head by nesting no longer', () => {
    const managing = new Set(roles.filter((role) => role.manages).map((role) => role.id))
    const lead = assignments.find((one) => one.roleId === 'ro-lead')!
    const hot = managedReach(organisation, 'pe-hot', TODAY)!
    const head = managedReach(organisation, 'pe-head', TODAY)!
    expect(reachesAssignment(hot, lead, managing)).toBe(true)
    expect(reachVia(hot, 'retail', 'ro-lead')).toBe('line')
    expect(reachesAssignment(head, lead, managing)).toBe(false)
    expect(reachesAssignment(head, { unitId: 'retail', roleId: 'ro-member' }, managing)).toBe(true)
    // The chief executive reaches the lead too: the line lands on a role the nesting gives them.
    expect(reachesAssignment(managedReach(organisation, 'pe-ceo', TODAY)!, lead, managing)).toBe(true)
  })

  it('reaches by a line a person who holds no managing role at all, and never their own', () => {
    const owned: Organisation = { ...organisation, roles: roles.map((role) => (role.id === 'ro-hot' ? { ...role, manages: undefined } : role)) }
    const hot = managedReach(owned, 'pe-hot', TODAY)!
    expect(hot.held).toEqual([])
    expect(reachVia(hot, 'retail', 'ro-lead')).toBe('line')
    const both: Organisation = { ...organisation, assignments: [...assignments, held('retail', 'ro-lead', 'pe-hot')] }
    expect(managedBy(both, 'pe-hot', TODAY).lines).toEqual([{ unitId: 'wholesale', roleId: 'ro-lead' }, { unitId: 'checkout', roleId: 'ro-tl' }])
  })

  it('gives a dotted line no reach', () => {
    expect(managedReach(organisation, 'pe-chief', TODAY)).toBeUndefined()
  })
})

describe('what the lines contradict', () => {
  it('finds a line on a role nobody holds, one that lands nowhere and one with several places to land', () => {
    const vacant: Organisation = { ...organisation, assignments: assignments.filter((one) => one.roleId !== 'ro-chief') }
    expect(reportingFindings(vacant, TODAY).map((one) => one.kind === 'vacant' && one.line.unitId)).toEqual(['retail', 'wholesale'])
    const twoTech: Organisation = { ...organisation, units: [...units, unit('tech2', 'ut-dept', 'co')] }
    expect(reportingFindings(twoTech, TODAY).map((one) => one.kind)).toEqual(['ambiguous', 'ambiguous', 'ambiguous', 'ambiguous'])
    const noTech: Organisation = { ...organisation, units: units.filter((one) => one.id !== 'tech') }
    expect(reportingFindings(noTech, TODAY).map((one) => one.kind)).toEqual(['dangling', 'dangling', 'dangling', 'dangling'])
  })

  it('finds a loop that time makes, with the first day it is there', () => {
    const later = withUnitLines(organisation, 'tech', [{ role: 'ro-hot', kind: 'solid', to: { scope: '', unit: 'retail', role: 'ro-lead' }, from: '2027-03-01' }])
    expect(reportingLoops(later, TODAY)).toEqual([])
    const [found] = reportingFindings(later, TODAY)
    expect(found).toEqual({ kind: 'loop', day: '2027-03-01', chain: [{ unitId: 'tech', roleId: 'ro-hot' }, { unitId: 'retail', roleId: 'ro-lead' }] })
  })

  it('finds a loop through nesting: a line up to a role whose holder is managed from below', () => {
    const up = withUnitLines(organisation, 'co', [{ role: 'ro-ceo', kind: 'solid', to: { scope: '', unit: 'retail', role: 'ro-lead' } }])
    expect(reportingLoops(up, TODAY)).toEqual([[{ unitId: 'co', roleId: 'ro-ceo' }, { unitId: 'retail', roleId: 'ro-lead' }, { unitId: 'tech', roleId: 'ro-hot' }]])
  })
})

describe('a line written', () => {
  it('refuses a line from a role to itself in the same unit', () => {
    expect(refuseUnitLine(organisation, 'retail', { role: 'ro-head', kind: 'solid', to: { scope: '', unit: 'retail', role: 'ro-head' } }, TODAY))
      .toEqual({ refusal: 'reportingLine.self' })
  })

  it('refuses a solid line that closes a loop on its day or its first day, and not a dotted one', () => {
    const back = { role: 'ro-hot', kind: 'solid' as const, to: { scope: '', unit: 'retail', role: 'ro-lead' } }
    expect(refuseUnitLine(organisation, 'tech', back, TODAY)).toMatchObject({ refusal: 'reportingLine.loop', day: TODAY })
    expect(refuseUnitLine(organisation, 'tech', { ...back, from: '2027-01-01' }, TODAY)).toMatchObject({ refusal: 'reportingLine.loop', day: '2027-01-01' })
    expect(refuseUnitLine(organisation, 'tech', { ...back, kind: 'dotted' }, TODAY)).toBeUndefined()
    // Said on the slot it lands on the one business unit there is, and closes the same loop.
    const one: Organisation = { ...organisation, units: units.filter((held) => held.id !== 'wholesale') }
    const slots = [{ role: 'ro-hot', min: 0, reportsTo: { role: 'ro-lead', kind: 'solid' as const } }]
    expect(refuseSlotLine(one, 'ut-dept', slots, TODAY, slots[0].reportsTo)).toMatchObject({ refusal: 'reportingLine.loop' })
    // With two business units it would be ambiguous, which lands nowhere and closes nothing.
    expect(refuseSlotLine(organisation, 'ut-dept', slots, TODAY, slots[0].reportsTo)).toBeUndefined()
  })

  it('does not refuse a line because of a loop that was there before it', () => {
    const looped = withUnitLines(organisation, 'tech', [{ role: 'ro-hot', kind: 'solid', to: { scope: '', unit: 'retail', role: 'ro-lead' } }])
    expect(loopMadeBy(looped, withUnitLines(looped, 'wholesale', [{ role: 'ro-lead', kind: 'solid' }]), TODAY)).toBeUndefined()
  })

  it('replaces the unit\'s line of the same role and kind, and takes it away again', () => {
    const solid = { role: 'ro-lead', kind: 'solid' as const, to: { scope: '', unit: 'co', role: 'ro-ceo' } }
    const dotted = { role: 'ro-lead', kind: 'dotted' as const, to: { scope: '', unit: 'tech', role: 'ro-chief' } }
    const nesting = { role: 'ro-lead', kind: 'solid' as const }
    expect(unitLinesWith(unitLinesWith([solid], dotted), nesting)).toEqual([nesting, dotted])
    expect(unitLinesWithout([solid, dotted], 'ro-lead', 'dotted')).toEqual([solid])
    expect(unitLinesWithout([solid, dotted], 'ro-lead')).toEqual([])
  })
})

describe('a line said on the role, and one in the same unit (ADR-0039 §2, §3, amended 17 October 2026)', () => {
  /** Members report to the team lead of their own unit, wherever a member is; a team's lead answers to the chief architect on the side. */
  const amended: Organisation = withRoleLines(organisation, 'ro-member', [{ role: 'ro-tl', kind: 'solid', within: true }])

  it('lands a role\'s line in every unit that holds the role, on the unit itself where it says within', () => {
    const lines = reportingLinesOn(amended, TODAY)
    expect(lines.find((one) => one.unitId === 'checkout' && one.roleId === 'ro-member')).toMatchObject({
      kind: 'solid', source: 'role', within: true, state: 'lands', to: { unitId: 'checkout', roleId: 'ro-tl' },
    })
    // A business unit holds members but no team lead: the line lands nowhere there, and nesting answers.
    expect(lines.find((one) => one.unitId === 'retail' && one.roleId === 'ro-member')).toMatchObject({ source: 'role', state: 'dangling' })
    expect(people(managersOf(amended, 'checkout', TODAY, 'ro-member'))).toEqual(['pe-tl:line', 'pe-lead:line', 'pe-hot:line', 'pe-ceo:nesting'])
    expect(people(managersOf(amended, 'retail', TODAY, 'ro-member'))).toEqual(['pe-head:nesting', 'pe-lead:nesting', 'pe-hot:line', 'pe-ceo:nesting'])
  })

  it('lets a unit type\'s slot say otherwise for its units — another role, or by nesting — kind by kind', () => {
    const teamSays = (said: UnitType['slots'][number]['reportsTo']): Organisation => ({
      ...amended, unitTypes: amended.unitTypes.map((type) => (type.id !== 'ut-team' ? type : { ...type, slots: type.slots.map((slot) => (slot.role === 'ro-member' ? { ...slot, reportsTo: said } : slot)) })),
    })
    // The slot's dotted line stands beside the role's solid one.
    const both = reportingLinesOn(teamSays([{ role: 'ro-chief', kind: 'dotted' }]), TODAY).filter((one) => one.unitId === 'checkout' && one.roleId === 'ro-member')
    expect(both.map((one) => [one.kind, one.source, one.to?.roleId])).toEqual([['solid', 'role', 'ro-tl'], ['dotted', 'type', 'ro-chief']])
    // The slot's solid line replaces the role's.
    const other = reportingLinesOn(teamSays([{ role: 'ro-lead', kind: 'solid' }]), TODAY).filter((one) => one.unitId === 'checkout' && one.roleId === 'ro-member')
    expect(other.map((one) => [one.source, one.to?.unitId, one.to?.roleId])).toEqual([['type', 'retail', 'ro-lead']])
    // By nesting in this type: the role's line does not apply to teams, and is drawn as nesting there.
    const nesting = teamSays([{ kind: 'solid' }])
    expect(reportingLinesOn(nesting, TODAY).find((one) => one.unitId === 'checkout' && one.roleId === 'ro-member')).toMatchObject({ source: 'type', state: 'nesting' })
    expect(people(managersOf(nesting, 'checkout', TODAY, 'ro-member'))).toEqual(['pe-tl:nesting', 'pe-lead:line', 'pe-hot:line', 'pe-ceo:nesting', 'pe-head:nesting'])
    // One object on a slot still reads as one line, as the first 13 folders wrote it.
    expect(reportingLinesOn(teamSays({ role: 'ro-chief', kind: 'dotted' }), TODAY).filter((one) => one.unitId === 'checkout' && one.roleId === 'ro-member')).toHaveLength(2)
  })

  it('gives the team lead reach over the members by the role\'s line, whether or not the lead manages by nesting', () => {
    const noManage: Organisation = { ...amended, roles: amended.roles.map((role) => (role.id === 'ro-tl' ? { ...role, manages: false } : role)) }
    const reach = managedReach(noManage, 'pe-tl', TODAY)!
    expect(reachVia(reach, 'checkout', 'ro-member')).toBe('line')
    expect(reachesAssignment(reach, { unitId: 'checkout', roleId: 'ro-member' }, new Set(['ro-tl']))).toBe(true)
    expect(reachesAssignment(reach, { unitId: 'checkout', roleId: 'ro-tl' }, new Set(['ro-tl']))).toBe(false)
  })

  it('refuses a role\'s line to itself in the same unit, and a solid one that closes a loop, as a slot\'s', () => {
    expect(refuseRoleLines(amended, 'ro-member', [{ role: 'ro-member', kind: 'solid', within: true }], TODAY)).toEqual({ refusal: 'reportingLine.self' })
    // The chief executive reporting to the one team lead, who reports up to the head of technology, who is managed by the chief executive: a loop.
    expect(refuseRoleLines(amended, 'ro-ceo', [{ role: 'ro-tl', kind: 'solid' }], TODAY)).toMatchObject({ refusal: 'reportingLine.loop' })
    expect(refuseRoleLines(amended, 'ro-ceo', [{ role: 'ro-tl', kind: 'dotted' }], TODAY)).toBeUndefined()
    // The team type's slot says where its lead reports, so a line on the lead's role changes nothing in a team, and closes no loop there.
    expect(refuseRoleLines(amended, 'ro-tl', [{ role: 'ro-member', kind: 'solid', within: true }], TODAY)).toBeUndefined()
    const slots = [{ role: 'ro-tl', min: 1, max: 1, reportsTo: [{ role: 'ro-tl', kind: 'solid' as const, within: true as const }] }, { role: 'ro-member', min: 0 }]
    expect(refuseSlotLine(amended, 'ut-team', slots, TODAY, slots[0].reportsTo, 'ro-tl')).toEqual({ refusal: 'reportingLine.self' })
  })

  it('finds a role\'s line that lands nowhere, once per unit it is held in', () => {
    const found = reportingFindings(amended, TODAY).flatMap((one) => (one.kind === 'dangling' && one.line.roleId === 'ro-member' ? [one.line.unitId] : []))
    expect(found).toEqual(['retail', 'wholesale'])
  })
})
