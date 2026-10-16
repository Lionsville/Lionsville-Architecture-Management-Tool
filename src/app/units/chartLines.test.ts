// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chart's *Reporting lines* overlay, as lines (ADR-0039 §7): from the row
 * of a role to the row it lands on, ending at the fold for a unit folded away,
 * none where both ends fold into one box, and a finding drawn on its line.
 */
import { describe, expect, it } from 'vitest'
import type { Role, UnitType } from '../../model/operatingModel'
import { orgChart } from '../../model/orgChart'
import type { DesignElement } from '../../model/types'
import type { Assignment, Organisation } from '../../model/units'
import { chartLines } from './chartLines'

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

describe('the lines the chart draws', () => {
  it('runs from a role\'s row to the row it lands on, and says where nobody holds that role', () => {
    expect(chartLines(organisation, chart, DAY, new Set())).toEqual([
      { key: 'team/ro-tl/solid', kind: 'solid', from: { unitId: 'team', roleId: 'ro-tl' }, to: { unitId: 'div', roleId: 'ro-head' }, tone: 'plain' },
      { key: 'team/ro-dev/dotted', kind: 'dotted', from: { unitId: 'team', roleId: 'ro-dev' }, to: { unitId: 'grp', roleId: 'ro-lead' }, tone: 'vacant' },
    ])
  })

  it('ends at the fold for a unit folded away, and draws none whose ends fold into one box', () => {
    expect(chartLines(organisation, chart, DAY, new Set(['grp']))).toEqual([
      { key: 'team/ro-tl/solid', kind: 'solid', from: { unitId: 'grp' }, to: { unitId: 'div', roleId: 'ro-head' }, tone: 'plain' },
    ])
    expect(chartLines(organisation, chart, DAY, new Set(['div']))).toEqual([])
  })

  it('draws a line in a loop as one', () => {
    const looped: Organisation = {
      ...organisation,
      units: organisation.units.map((one) => (one.id === 'div' ? { ...one, reportingLines: [{ role: 'ro-head', kind: 'solid' as const, to: { scope: '', unit: 'team', role: 'ro-tl' } }] } : one)),
    }
    expect(chartLines(looped, orgChart(looped, DAY), DAY, new Set()).map((line) => [line.key, line.tone])).toEqual([
      ['div/ro-head/solid', 'loop'], ['team/ro-tl/solid', 'loop'], ['team/ro-dev/dotted', 'vacant'],
    ])
  })
})
