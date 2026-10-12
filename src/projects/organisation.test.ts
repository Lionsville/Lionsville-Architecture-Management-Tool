// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation as it is, across the tree (ADR-0036 §3, §4): the index
 * lists every unit and every assignment, holds the operating model the
 * organisation keeps, and never a person's name; and the checks read what
 * the units and assignments contradict off it, each finding about the scope
 * that answers for what it is about.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { DesignElement } from '../model'
import type { Role, UnitType } from '../model/operatingModel'
import type { HostModel } from '../model/hostModel'
import { fromArrays, toArrays } from '../model/normalised'
import { apply } from '../model/reducer'
import type { Assignment } from '../model/units'
import { findingSentence, organisationFindings, scopeFindings } from './checks'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

const DAY = '2026-10-11'

function actor(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'actor', name: id[0].toUpperCase() + id.slice(1), lifecycle: 'live', isManaged: false, aspects: {}, ...over }
}

const domain: UnitType = { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [{ role: 'ro-owner', min: 1, max: 1 }] }
const team: UnitType = {
  id: 'ut-team', name: 'Team', within: ['ut-domain'], limit: 1, slots: [{ role: 'ro-po', min: 1, max: 1 }],
}
const roles: Role[] = [
  { id: 'ro-owner', name: 'Domain owner', duties: [], manages: true },
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
]
const as = (id: string, unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId, person: { person }, ...over,
})

/**
 * Acme Logistics: the organisation keeps the operating model and a team that
 * sits at the top, where a team may not; the customer domain keeps its unit
 * and a team under it, two applications the team owns, and a stand-in of the
 * organisation's team. Femke holds a role in two scopes, at 150% in all.
 */
function tree(): ScopeModel[] {
  return [
    {
      path: '',
      model: {
        elements: [actor('platform', { unitTypeId: 'ut-team' }), actor('stakeholders')],
        relations: [],
        unitTypes: [domain, team], roles,
        assignments: [as('as-1', 'platform', 'ro-po', 'pe-femke', { share: 0.5 })],
      },
    },
    {
      path: 'customer',
      model: {
        elements: [
          actor('customer', { unitTypeId: 'ut-domain' }),
          actor('webshop', { unitTypeId: 'ut-team', parentId: 'customer' }),
          actor('platform', { ref: '', name: 'Platform' }),
          { id: 'shop', kind: 'application', name: 'Shop', partyId: 'webshop', lifecycle: 'live', isManaged: true, aspects: {} },
          { id: 'orders', kind: 'application', name: 'Orders', partyId: 'webshop', lifecycle: 'live', isManaged: true, aspects: {} },
        ],
        relations: [],
        assignments: [
          as('as-1', 'webshop', 'ro-po', 'pe-femke'),
          as('as-2', 'customer', 'ro-owner', 'pe-ada', { until: '2026-01-31' }),
        ],
      },
    },
  ]
}

describe('the organisation in the index', () => {
  const index = indexScopes(tree())

  it('lists every unit where it is answered for, and no stand-in of one', () => {
    expect(index.units().map(({ scope, unit }) => [scope, unit.id])).toEqual([['customer', 'customer'], ['', 'platform'], ['customer', 'webshop']])
  })

  it('lists every assignment with the scope that keeps it, in path order', () => {
    expect(index.assignments().map(({ scope, assignment }) => [scope, assignment.id])).toEqual([['', 'as-1'], ['customer', 'as-1'], ['customer', 'as-2']])
  })

  it('holds the operating model the organisation keeps, and only the organisation\'s', () => {
    expect(index.operatingModel().unitTypes.map((type) => type.id)).toEqual(['ut-domain', 'ut-team'])
    expect(index.operatingModel().roles).toEqual(roles)
    expect(indexScopes(tree().slice(1)).operatingModel()).toEqual({ unitTypes: [], roles: [], responsibilities: [], operatingRules: [] })
    expect(index.organisation().roles).toBe(index.operatingModel().roles)
  })

  it('holds a person as an id and never as a name', () => {
    expect(JSON.stringify(index.assignments())).not.toMatch(/Femke|Ada/)
    expect(index.organisation().assignments.map((one) => one.person)).toEqual([
      { person: 'pe-femke' }, { person: 'pe-femke' }, { person: 'pe-ada' },
    ])
  })
})

describe('the plans\' moves in the index', () => {
  /** A plan in the customer domain moves the webshop to the top on the first day of 2027; an abandoned one moves nothing. */
  function planned(): ScopeModel[] {
    const held = tree()
    const plan = (id: string, number: number, status: 'agreed' | 'abandoned', on: string) => ({
      id, number, title: id, status, elements: [], decisions: [], milestones: [], body: '',
      moves: [{ unitId: 'webshop', on }],
    })
    held[1].model = { ...held[1].model, transitions: [plan('tr-1', 1, 'agreed', '2027-01-01'), plan('tr-2', 2, 'abandoned', '2026-11-01')] }
    return held
  }

  it('lists every plan\'s moves but an abandoned one\'s, with the plan and the scope', () => {
    const index = indexScopes(planned())
    expect(index.moves()).toEqual([{ scope: 'customer', plan: { id: 'tr-1', number: 1 }, move: { unitId: 'webshop', on: '2027-01-01' } }])
    expect(index.organisation().moves).toEqual([{ unitId: 'webshop', on: '2027-01-01' }])
    expect(indexScopes(tree()).organisation()).not.toHaveProperty('moves')
  })

  it('checks the organisation on a day with the moves of that day', () => {
    // A team at the top is misplaced, from the day the plan puts it there.
    const index = indexScopes(planned())
    const misplaced = (day: string) => organisationFindings(index, day).filter((one) => one.key === 'check.unitMisplaced').map((one) => one.id)
    expect(misplaced(DAY)).toEqual(['platform'])
    expect(misplaced('2027-01-01')).toEqual(['platform', 'webshop'])
  })
})

describe('the plans that bring and end units, in the index', () => {
  /** The customer domain's plan brings the webshop and ends the customer unit; an abandoned one would retire the webshop. */
  function planned(): ScopeModel[] {
    const held = tree()
    const plan = (id: string, number: number, status: 'agreed' | 'abandoned', elements: { elementId: string; role: 'introduces' | 'retires' | 'changes' }[]) => ({
      id, number, title: id, status, elements, decisions: [], milestones: [], body: '',
    })
    held[1].model = {
      ...held[1].model,
      transitions: [
        plan('tr-1', 1, 'agreed', [
          { elementId: 'webshop', role: 'introduces' }, { elementId: 'customer', role: 'retires' },
          { elementId: 'shop', role: 'introduces' }, { elementId: 'orders', role: 'changes' },
        ]),
        plan('tr-2', 2, 'abandoned', [{ elementId: 'webshop', role: 'retires' }]),
      ],
    }
    return held
  }

  it('lists the actors a plan introduces and retires, with the plan and the scope, and nothing an abandoned plan names', () => {
    expect(indexScopes(planned()).unitPlans()).toEqual([
      { scope: 'customer', plan: { id: 'tr-1', number: 1 }, unitId: 'webshop', role: 'introduces' },
      { scope: 'customer', plan: { id: 'tr-1', number: 1 }, unitId: 'customer', role: 'retires' },
    ])
    expect(indexScopes(tree()).unitPlans()).toEqual([])
  })
})

describe('what the organisation contradicts, from the index', () => {
  const index = indexScopes(tree())

  it('says each finding about the scope that answers for what it is about', () => {
    const found = organisationFindings(index, DAY)
    expect(found.map((one) => [one.key, one.scope, one.id])).toEqual([
      ['check.roleVacant', 'customer', 'customer'],
      ['check.unitMisplaced', '', 'platform'],
      ['check.unitOverLimit', 'customer', 'webshop'],
      ['check.personOverloaded', '', 'pe-femke'],
      ['check.personOverloaded', 'customer', 'pe-femke'],
    ])
    expect(found[0]).toMatchObject({ name: 'Customer', detail: 'Domain owner', fields: ['ro-owner'], count: 0, limit: 1 })
    expect(found[2]).toMatchObject({ detail: 'Team', count: 2, limit: 1 })
    expect(found[3]).toMatchObject({ person: 'pe-femke', name: 'pe-femke', count: 150 })
  })

  it('finds a unit still of a unit type that has ended', () => {
    const ending = tree()
    ending[0].model = { ...ending[0].model, unitTypes: [domain, { ...team, until: '2026-06-30' }] }
    const found = organisationFindings(indexScopes(ending), DAY).filter((one) => one.key === 'check.unitTypeEnded')
    expect(found.map((one) => [one.scope, one.id, one.detail, one.fields])).toEqual([
      ['', 'platform', 'Team', ['ut-team']], ['customer', 'webshop', 'Team', ['ut-team']],
    ])
    expect(findingSentence(found[1], translator('en'), () => 'Customer')).toBe(
      'Webshop is still a Team, a kind of unit that has ended: give it another type, or end it',
    )
  })

  it('finds an assignment in a unit that has ended, about the scope that keeps it', () => {
    const ended = tree()
    ended[1].model = { ...ended[1].model, elements: ended[1].model.elements.map((one) => (one.id === 'webshop' ? { ...one, lifecycleDates: { retired: '2026-06-01' } } : one)) }
    const found = organisationFindings(indexScopes(ended), DAY).filter((one) => one.key === 'check.assignmentEnded')
    expect(found).toEqual([{ key: 'check.assignmentEnded', scope: 'customer', id: 'webshop', name: 'Webshop', detail: 'Product owner', fields: ['as-1'] }])
  })

  // A unit deleted takes its assignments now; one deleted before that did left them naming nothing (ADR-0036, amended 12 October 2026).
  it('finds an assignment whose unit is not there, ended or not, about the scope that keeps it and naming the person', () => {
    const left = tree()
    left[1].model = {
      ...left[1].model,
      elements: left[1].model.elements.filter((one) => one.id !== 'customer'),
    }
    const found = organisationFindings(indexScopes(left), DAY).filter((one) => one.key === 'check.assignmentOrphaned')
    // as-2 ended in January and is found all the same: nobody held a role in a unit that was never there.
    expect(found).toEqual([{
      key: 'check.assignmentOrphaned', scope: 'customer', id: 'as-2', name: 'pe-ada', person: 'pe-ada', detail: 'Domain owner', fields: ['as-2'],
    }])
    expect(findingSentence(found[0], translator('en'), () => '', (id) => (id === 'pe-ada' ? 'Ada Lovelace' : id)))
      .toBe('Ada Lovelace still holds Domain owner in a unit that is not there')
  })

  it('finds nothing left behind when the unit is deleted as a step: its assignments went with it', () => {
    const held = tree()[1].model
    const scope = fromArrays({ name: 'Customer', diagrams: [], elements: [...held.elements], relations: [], assignments: [...held.assignments ?? []] } satisfies HostModel)
    const result = apply(scope, { type: 'element.delete', id: 'customer' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const after = tree()
    after[1].model = toArrays(result.model)
    expect(organisationFindings(indexScopes(after), DAY).filter((one) => one.key === 'check.assignmentOrphaned')).toEqual([])
  })

  it('has nothing to say of a tree with no units and no assignments', () => {
    expect(organisationFindings(indexScopes([{ path: '', model: { elements: [], relations: [] } }]), DAY)).toEqual([])
  })

  it('is part of what one scope is told about itself', () => {
    const findings = scopeFindings({
      scope: '', index, model: { name: 'Acme', elements: tree()[0].model.elements as DesignElement[], relations: [], diagrams: [] },
    }).filter((one) => one.key.startsWith('check.unit') || one.key.startsWith('check.person') || one.key.startsWith('check.role'))
    expect(findings.map((one) => one.key)).toContain('check.unitMisplaced')
    expect(findings.every((one) => one.scope === '')).toBe(true)
  })

  it('reads as a sentence, the person named by the register where a screen has one', () => {
    const s = translator('en')
    const found = organisationFindings(index, DAY)
    expect(findingSentence(found[0], s, () => 'Customer')).toBe('Customer is short of Domain owner: 0 hold the role, and its type asks for at least 1')
    expect(findingSentence(found[3], s, () => '', (id) => (id === 'pe-femke' ? 'Femke Bos' : id))).toBe('Femke Bos holds 150% across their roles')
    expect(findingSentence(found[3], s, () => '')).toBe('pe-femke holds 150% across their roles')
  })
})

describe('a capability assigned to a unit outside its domain', () => {
  /**
   * The organisation keeps a top-level Data cluster serving Shipping by name;
   * Shipping keeps its domain, a team under it and a sheet's capabilities;
   * Warehouse keeps Robotics, which says nothing and so serves Warehouse.
   */
  const fn = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
    id, kind: 'function', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  })
  const assigned = (id: string, sourceId: string, targetId: string) => ({ id, type: 'assigned' as const, sourceId, targetId })
  const models = (): ScopeModel[] => [
    {
      path: '',
      model: {
        elements: [actor('data', { unitTypeId: 'ut-domain', scopes: ['shipping'] }), fn('serve', 'Serve customers')],
        relations: [assigned('r-0', 'robotics', 'serve')],
        unitTypes: [domain, team], roles,
      },
    },
    {
      path: 'shipping',
      model: {
        elements: [
          actor('shipping', { unitTypeId: 'ut-domain' }),
          actor('tracking', { unitTypeId: 'ut-team', parentId: 'shipping' }),
          fn('plan', 'Plan a route'), fn('loads', 'Optimise loads'), fn('track', 'Track a shipment'), fn('price', 'Price freight'),
        ],
        relations: [
          assigned('r-1', 'tracking', 'track'), assigned('r-2', 'robotics', 'loads'),
          assigned('r-3', 'data', 'plan'), assigned('r-4', 'partner', 'price'),
        ],
      },
    },
    { path: 'warehouse', model: { elements: [actor('robotics', { unitTypeId: 'ut-team' })], relations: [] } },
  ]

  it('is a finding about the scope that keeps the row, naming the unit and the domain', () => {
    const found = organisationFindings(indexScopes(models()), DAY).filter((one) => one.key === 'check.unitNotServing')
    expect(found).toEqual([{
      key: 'check.unitNotServing', scope: 'shipping', id: 'loads', name: 'Optimise loads', detail: 'Robotics',
      fields: ['robotics', 'r-2'], scopes: ['shipping'],
    }])
    expect(findingSentence(found[0], translator('en'), (path) => (path === 'shipping' ? 'Shipping' : path))).toBe(
      'Robotics is responsible for Optimise loads, but neither it nor a unit above it serves Shipping',
    )
  })

  it('is nothing for a unit serving the domain through the unit above it, by name from elsewhere, or a capability of the whole organisation', () => {
    const found = organisationFindings(indexScopes(models()), DAY).filter((one) => one.key === 'check.unitNotServing')
    expect(found.map((one) => one.id)).not.toContain('track')
    expect(found.map((one) => one.id)).not.toContain('plan')
    expect(found.map((one) => one.id)).not.toContain('serve')
    // An actor that is not a unit is not asked.
    expect(found.map((one) => one.id)).not.toContain('price')
  })

  it('is nothing once a plan moves the unit under one that serves the domain', () => {
    const moved = models()
    moved[0].model = {
      ...moved[0].model,
      transitions: [{
        id: 'tr-1', number: 1, title: 'Robotics to shipping', status: 'agreed', elements: [], decisions: [], milestones: [], body: '',
        moves: [{ unitId: 'robotics', parentId: 'shipping', on: '2026-11-01' }],
      }],
    }
    const index = indexScopes(moved)
    expect(organisationFindings(index, DAY).some((one) => one.key === 'check.unitNotServing')).toBe(true)
    expect(organisationFindings(index, '2026-11-02').some((one) => one.key === 'check.unitNotServing' && one.id === 'loads')).toBe(false)
  })
})
