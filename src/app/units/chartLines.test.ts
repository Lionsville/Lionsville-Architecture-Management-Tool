// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chart's *Reporting lines* overlay, as lines (ADR-0039 §7, amended 17
 * October 2026): for the person picked, the lines they report along and the
 * lines into them, each saying which way it runs and whether it is an
 * override; from chips to chips, ending at the fold for a unit folded away,
 * none where both ends fold into one box, and a finding drawn on its line.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from '../../model/operatingModel'
import { orgChart } from '../../model/orgChart'
import type { DesignElement } from '../../model/types'
import type { Assignment, Organisation } from '../../model/units'
import { holderLines } from './chartLines'

const DAY = '2026-10-16'
const division: UnitType = { id: 'ut-division', name: 'Division', top: true, within: [], slots: [{ role: 'ro-head', min: 1 }] }
const group: UnitType = { id: 'ut-group', name: 'Group', within: ['ut-division'], slots: [{ role: 'ro-lead', min: 1 }] }
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-group'],
  slots: [{ role: 'ro-tl', min: 1, reportsTo: { role: 'ro-head', kind: 'solid' } }, { role: 'ro-dev', min: 0, reportsTo: { role: 'ro-lead', kind: 'dotted' } }],
}
const roles: Role[] = ['ro-head', 'ro-lead', 'ro-tl', 'ro-dev'].map((id) => ({ id, name: id, duties: [], manages: id !== 'ro-dev' }))
const unit = (id: string, unitTypeId: string, parentId?: string): DesignElement => ({
  id, kind: 'actor', name: id, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId, ...(parentId ? { parentId } : {}),
})
const held = (unitId: string, roleId: string): Assignment => ({ id: `${unitId}-${roleId}`, unitId, roleId, person: { person: `pe-${unitId}` } })
const organisation: Organisation = {
  units: [unit('div', 'ut-division'), unit('grp', 'ut-group', 'div'), unit('team', 'ut-team', 'grp')],
  assignments: [held('div', 'ro-head'), held('team', 'ro-tl')],
  roles, unitTypes: [division, group, team],
}
const chart = orgChart(organisation, DAY)

const tl = organisation.assignments.find((one) => one.id === 'team-ro-tl')!
const headOf = organisation.assignments.find((one) => one.id === 'div-ro-head')!

describe('the lines the chart draws for the person picked', () => {
  it('draws the line they report along, up, from their chip to whoever holds the role it lands on', () => {
    expect(holderLines(organisation, chart, DAY, new Set(), tl)).toEqual([{
      key: 'up/team/ro-tl/solid/', kind: 'solid', direction: 'up', override: false,
      from: { unitId: 'team', roleId: 'ro-tl', holders: ['team-ro-tl'] }, to: { unitId: 'div', roleId: 'ro-head' },
      at: { unitId: 'team', roleId: 'ro-tl' }, lands: { unitId: 'div', roleId: 'ro-head' }, tone: 'plain',
    }])
  })

  it('draws the lines into them, from the holders who report along them, and nothing for nobody picked', () => {
    expect(holderLines(organisation, chart, DAY, new Set(), headOf).map((line) => [line.direction, line.from, line.to])).toEqual([
      ['into', { unitId: 'team', roleId: 'ro-tl', holders: ['team-ro-tl'] }, { unitId: 'div', roleId: 'ro-head', holders: ['div-ro-head'] }],
    ])
    expect(holderLines(organisation, chart, DAY, new Set(), undefined)).toEqual([])
  })

  it('ends at the fold for a unit folded away, and draws none whose ends fold into one box', () => {
    expect(holderLines(organisation, chart, DAY, new Set(['grp']), tl).map((line) => [line.from, line.to])).toEqual([
      [{ unitId: 'grp' }, { unitId: 'div', roleId: 'ro-head' }],
    ])
    expect(holderLines(organisation, chart, DAY, new Set(['div']), tl)).toEqual([])
  })

  it('draws a line in a loop as one, and one to nobody as vacant', () => {
    const looped: Organisation = {
      ...organisation,
      units: organisation.units.map((one) => (one.id === 'div' ? { ...one, reportingLines: [{ role: 'ro-head', kind: 'solid' as const, to: { scope: '', unit: 'team', role: 'ro-tl' } }] } : one)),
    }
    expect(holderLines(looped, orgChart(looped, DAY), DAY, new Set(), tl).map((line) => [line.direction, line.tone, line.override])).toEqual([
      ['up', 'loop', false], ['into', 'loop', true],
    ])
    const dev = held('team', 'ro-dev')
    const withDev: Organisation = { ...organisation, assignments: [...organisation.assignments, dev] }
    expect(holderLines(withDev, orgChart(withDev, DAY), DAY, new Set(), dev).map((line) => [line.kind, line.tone])).toEqual([['dotted', 'vacant']])
  })

  it('draws a holder\'s own line in place of their role\'s, as an override, and leaves them out of the role\'s line into its target', () => {
    const own: Organisation = {
      ...organisation,
      assignments: organisation.assignments.map((one) => (one.id === tl.id ? { ...one, reportsTo: [{ to: { scope: '', unit: 'div', role: 'ro-head', person: 'pe-div' }, kind: 'solid' as const }] } : one)),
    }
    const picked = own.assignments.find((one) => one.id === tl.id)!
    expect(holderLines(own, chart, DAY, new Set(), picked).map((line) => [line.direction, line.override, line.to.holders])).toEqual([['up', true, ['div-ro-head']]])
    expect(holderLines(own, chart, DAY, new Set(), headOf).map((line) => [line.direction, line.override, line.from.holders])).toEqual([['into', true, ['team-ro-tl']]])
    // A line to one person is drawn into them, and into nobody else who holds the role.
    const other = held('div', 'ro-head')
    const two: Organisation = { ...own, assignments: [...own.assignments, { ...other, id: 'div-2', person: { person: 'pe-two' } }] }
    expect(holderLines(two, orgChart(two, DAY), DAY, new Set(), two.assignments.find((one) => one.id === 'div-2'))).toEqual([])
  })
})
