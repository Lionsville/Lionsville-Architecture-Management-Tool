// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The findings marked as intended, over the tree (ADR-0036, amended 11
 * October 2026): the index carries every scope's marks, so a mark kept in a
 * scope below silences its finding where the organisation lists the whole
 * tree; the open scope's session is laid over what the index read; and a
 * finding's mark is kept in the scope of its first subject.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import type { CheckMark } from '../model/checkMarks'
import { checkMarkFor, splitMarked } from '../model/checkMarks'
import type { ConwayFinding } from '../model/conway'
import type { Role, UnitType } from '../model/operatingModel'
import type { Assignment } from '../model/units'
import { checkMarkScope, checkMarksHere } from './checkMarks'
import { organisationFindings } from './checks'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

const DAY = '2026-10-11'

function actor(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'actor', name: id[0].toUpperCase() + id.slice(1), lifecycle: 'live', isManaged: false, aspects: {}, ...over }
}

const team: UnitType = { id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-po', min: 1, max: 1 }] }
const roles: Role[] = [{ id: 'ro-po', name: 'Product owner', duties: [] }]
const as = (id: string, unitId: string, person: string, share: number): Assignment => ({
  id, unitId, roleId: 'ro-po', person: { person }, share,
})
const vacant: CheckMark = { check: 'check.roleVacant', key: 'webshop ro-po', reason: 'Hired in November', on: DAY }

/**
 * Acme Logistics: the organisation keeps the operating model and a platform
 * team; the customer domain keeps the webshop team, nobody its product owner,
 * and has marked that as intended. Femke holds the platform's role and the
 * mobile team's, at 150% in all — a finding of each scope that keeps one.
 */
function tree(customerMarks: CheckMark[] = [vacant]): ScopeModel[] {
  return [
    {
      path: '',
      model: {
        elements: [actor('platform', { unitTypeId: 'ut-team' })],
        relations: [{ id: 'i-1', type: 'interacts', sourceId: 'platform', targetId: 'webshop', mode: 'service' }],
        unitTypes: [team], roles,
        assignments: [as('as-1', 'platform', 'pe-femke', 0.75)],
      },
    },
    {
      path: 'customer',
      model: {
        elements: [
          actor('webshop', { unitTypeId: 'ut-team' }), actor('mobile', { unitTypeId: 'ut-team' }),
          { id: 'shop', kind: 'application', name: 'Shop', lifecycle: 'live', isManaged: true, aspects: {} },
        ],
        relations: [],
        assignments: [as('as-2', 'mobile', 'pe-femke', 0.75)],
        checkMarks: customerMarks,
      },
    },
  ]
}

describe('marks in the index', () => {
  it('lists every scope’s marks with the scope that keeps them', () => {
    expect(indexScopes(tree()).checkMarks()).toEqual([{ scope: 'customer', mark: vacant }])
    expect(indexScopes(tree([])).checkMarks()).toEqual([])
  })

  it('silences, where the organisation lists the whole tree, a finding a scope below marked as intended', () => {
    const index = indexScopes(tree())
    const { shown, marked } = splitMarked(organisationFindings(index, DAY), index.checkMarks())
    expect(marked.map(({ finding, scope, mark }) => [finding.key, finding.scope, finding.id, scope, mark.reason]))
      .toEqual([['check.roleVacant', 'customer', 'webshop', 'customer', 'Hired in November']])
    expect(shown.map((one) => [one.key, one.scope, one.id])).toEqual([
      ['check.personOverloaded', '', 'pe-femke'],
      ['check.personOverloaded', 'customer', 'pe-femke'],
    ])
  })

  it('silences a person over all of their time only in the scope that marked it', () => {
    const femke = organisationFindings(indexScopes(tree()), DAY).find((one) => one.key === 'check.personOverloaded' && one.scope === 'customer')!
    const index = indexScopes(tree([checkMarkFor(femke, { on: DAY })]))
    const overloaded = splitMarked(organisationFindings(index, DAY), index.checkMarks())
    expect(overloaded.marked.map(({ finding }) => [finding.key, finding.scope])).toEqual([['check.personOverloaded', 'customer']])
    expect(overloaded.shown.map((one) => [one.key, one.scope])).toEqual([['check.roleVacant', 'customer'], ['check.personOverloaded', '']])
  })
})

describe('the marks that hold, with a scope open', () => {
  it('are the open scope’s as its session has them, and every other scope’s as the index read them', () => {
    const index = indexScopes([...tree(), { path: 'finance', model: { elements: [], relations: [], checkMarks: [{ ...vacant, key: 'ledger ro-po' }] } }])
    const taken = checkMarksHere(index, 'customer', {})
    expect(taken).toEqual([{ scope: 'finance', mark: { ...vacant, key: 'ledger ro-po' } }])
    const made = checkMarksHere(index, 'finance', { checkMarks: [] })
    expect(made).toEqual([{ scope: 'customer', mark: vacant }])
  })
})

describe('where a finding’s mark is kept', () => {
  const index = indexScopes(tree())

  it('is the scope a finding of the tree is about, and the scope the dates were checked in', () => {
    expect(checkMarkScope(index, { key: 'check.roleVacant', scope: 'customer', id: 'webshop', fields: ['ro-po'] })).toBe('customer')
    expect(checkMarkScope(index, { kind: 'planOverdue', subject: 'transition', id: 'tr-1', name: 'Plan', detail: '2026-06-30' }, 'finance'))
      .toBe('finance')
  })

  it('is, for the Conway map’s, where the row is kept or where the application or the unit is defined', () => {
    const findings: ConwayFinding[] = [
      { kind: 'unused', interaction: { id: 'i-1', sourceId: 'platform', targetId: 'webshop' } },
      { kind: 'unowned', applicationId: 'shop' },
      { kind: 'overLimit', unitId: 'webshop', owns: 2, limit: 1 },
      { kind: 'undeclared', flow: { id: 'f-9', sourceId: 'nowhere', targetId: 'shop' }, from: 'platform', to: 'webshop' },
    ]
    expect(findings.map((finding) => checkMarkScope(index, finding))).toEqual(['', 'customer', 'customer', undefined])
  })
})
