// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Units and assignments at the agent (ADR-0036 §3, §4, §13): an actor made a
 * unit through the element tools, `assignments.list` across the tree with the
 * open scope as it is now, and `assignment.add` and `assignment.end` as one
 * step each under the agent's name — the person by register id, someone who
 * has left refused, and nobody forgotten, removed or merged from here.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { Role, UnitType } from '../model/operatingModel'
import { apply } from '../model/reducer'
import type { DesignElement } from '../model/types'
import type { Assignment } from '../model/units'
import type { Person } from '../people/person'
import { DEFAULT_POLICY } from '../people/policy'
import type { PeoplePolicy } from '../people/policy'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { PeopleView } from './people'
import type { ShellView } from './shell'
import type { AgentAnswer } from './tools'
import { TOOL_NAMES } from './tools'
import type { TreeView } from './tree'

const TODAY = '2026-10-11'
const team: UnitType = { id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }] }
const roles: Role[] = [
  { id: 'ro-po', name: 'Product owner', duties: [], manages: true },
  { id: 'ro-dev', name: 'Developer', duties: [] },
]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const as = (id: string, unitId: string, roleId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId, person: { person }, ...over,
})

const organisation: HostModel = { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], unitTypes: [team], roles }
const customer: HostModel = {
  name: 'Customer', relations: [], diagrams: [],
  elements: [actor('webshop', 'Webshop', { unitTypeId: 'ut-team' }), actor('partners', 'Partners'), actor('shipping-team', 'Shipping team', { ref: 'shipping' })],
  assignments: [as('as-1', 'webshop', 'ro-po', 'pe-femke'), as('as-2', 'webshop', 'ro-dev', 'pe-bram', { share: 0.5, until: '2026-06-30' })],
}
const shippingAssignments = [as('as-1', 'parcel', 'ro-dev', 'pe-femke', { share: 0.5 })]

const people: Person[] = [
  { id: 'pe-femke', name: 'Femke Bos', email: 'femke@acme.example', pseudonym: 'BCDF', kind: 'internal', state: 'active' },
  { id: 'pe-bram', name: 'Bram de Wit', pseudonym: 'CDFG', kind: 'internal', state: 'active' },
  { id: 'pe-old', pseudonym: 'DFGH', kind: 'internal', state: 'active', mergedInto: 'pe-femke' },
  { id: 'pe-gijs', name: 'Gijs Mulder', pseudonym: 'FGHJ', kind: 'internal', state: 'left', leftOn: '2026-08-14' },
]

function tree(): TreeView {
  return {
    scopes: () => [],
    lookup: (id) => (id === 'parcel' ? { id, kind: 'actor', name: 'Parcel', declarations: [], drawnIn: [], stale: [] } : undefined),
    register: () => [],
    findings: () => [],
    initiativesBelow: () => [],
    read: async () => undefined,
    units: () => [
      { scope: 'customer', unit: customer.elements[0] },
      { scope: 'shipping', unit: actor('parcel', 'Parcel', { unitTypeId: 'ut-team' }) },
    ],
    assignments: () => [
      ...(customer.assignments ?? []).map((assignment) => ({ scope: 'customer', assignment })),
      ...shippingAssignments.map((assignment) => ({ scope: 'shipping', assignment })),
    ],
    operatingModel: () => ({ unitTypes: [team], roles, responsibilities: [], operatingRules: [] }),
  }
}

function session(at: string, start: HostModel, register: readonly Person[] | null = people): SessionView & { model: () => Model; sent: Command[] } {
  let model: Model = fromArrays(start)
  let counter = 0
  const sent: Command[] = []
  return {
    sent,
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => at,
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      sent.push(command)
      model = result.model
      return toArrays(model)
    },
    ids: idPolicy(() => model.order.elements),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => TODAY,
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    revision: () => sent.length,
    history: () => [],
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    tree: tree(),
    ...(register ? { people: () => register } : {}),
  }
}

function shell(policy: PeoplePolicy = DEFAULT_POLICY): ShellView {
  const view: PeopleView = {
    read: () => Promise.resolve({ people, policy }),
    add: () => Promise.reject(new Error('not here')),
    leave: () => Promise.reject(new Error('not here')),
    today: () => TODAY,
    readOnly: () => false,
  }
  return { people: view, tree: tree() } as unknown as ShellView
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text)
}
const refusal = (out: AgentAnswer) => (out.ok ? undefined : [out.refusal, out.detail])
const ask = (tool: string, args: unknown, on: SessionView | undefined, around?: ShellView) => handle({ id: '1', tool, args }, on, around)

describe('assignments.list', () => {
  it('lists who holds which role today across the tree, named by the register, and the open scope as it is now', async () => {
    const open = session('customer', { ...customer, assignments: [...customer.assignments!, as('as-3', 'webshop', 'ro-dev', 'pe-old')] })
    const out = parsed(await ask('assignments.list', {}, open, shell()))
    expect(out.day).toBe(TODAY)
    expect((out.assignments as Record<string, unknown>[]).map((one) => [one.scope, one.id, one.unit, one.role, one.person, one.share])).toEqual([
      ['shipping', 'as-1', 'Parcel', 'Developer', 'Femke Bos', 50],
      ['customer', 'as-1', 'Webshop', 'Product owner', 'Femke Bos', 100],
      ['customer', 'as-3', 'Webshop', 'Developer', 'Femke Bos', 100],
    ])
    expect(JSON.stringify(out)).not.toContain('femke@acme.example')
  })

  it('filters by scope, person — an id merged into theirs counting — and day, and lists everything when asked', async () => {
    const open = session('customer', customer)
    expect((parsed(await ask('assignments.list', { scope: 'shipping' }, open, shell())).total)).toBe(1)
    const mine = parsed(await ask('assignments.list', { personId: 'pe-old' }, session('customer', { ...customer, assignments: [as('as-9', 'webshop', 'ro-dev', 'pe-old')] }), shell()))
    expect((mine.assignments as { id: string }[]).map((one) => one.id)).toEqual(['as-1', 'as-9'])
    expect(parsed(await ask('assignments.list', { on: '2026-01-01' }, open, shell())).total).toBe(3)
    expect(parsed(await ask('assignments.list', { all: true, roleId: 'ro-dev' }, open, shell())).total).toBe(2)
  })

  it('gives pseudonyms where the organisation\'s policy says so', async () => {
    const out = parsed(await ask('assignments.list', { scope: 'customer' }, session('customer', customer), shell({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' })))
    expect((out.assignments as { person: string }[])[0].person).toBe('Person BCDF')
  })

  it('says a unit\'s slots against who holds them, and who manages it — granting nothing', async () => {
    const out = parsed(await ask('assignments.list', { unitId: 'webshop' }, session('customer', customer), shell()))
    expect(out.unit).toEqual({
      id: 'webshop', name: 'Webshop', unitTypeId: 'ut-team', unitType: 'Team',
      slots: [
        { roleId: 'ro-po', role: 'Product owner', min: 1, max: 1, held: 1, manages: true },
        { roleId: 'ro-dev', role: 'Developer', min: 2, held: 0 },
      ],
      managedBy: [{ personId: 'pe-femke', person: 'Femke Bos', roleId: 'ro-po', role: 'Product owner', unitId: 'webshop', unit: 'Webshop' }],
    })
  })

  it('answers with nothing open, from the tree alone, and without names where there is no register', async () => {
    const out = parsed(await ask('assignments.list', { scope: 'customer' }, undefined, { tree: tree() } as unknown as ShellView))
    expect((out.assignments as Record<string, unknown>[])[0]).toEqual({
      id: 'as-1', scope: 'customer', unitId: 'webshop', unit: 'Webshop', roleId: 'ro-po', role: 'Product owner', personId: 'pe-femke', share: 100, runs: true,
    })
    expect(refusal(await ask('assignments.list', { nonsense: true }, undefined, shell()))?.[0]).toBe('agent.badArguments')
  })
})

describe('assignment.add and assignment.end', () => {
  it('puts a person in a role of a unit here as one step under the agent\'s name, by their id', async () => {
    const open = session('customer', customer)
    const out = parsed(await ask('assignment.add', { unitId: 'webshop', roleId: 'ro-dev', personId: 'pe-old', share: 50, acting: true }, open))
    expect(out).toEqual({ id: 'as-new-1', unitId: 'webshop', roleId: 'ro-dev', personId: 'pe-femke', from: TODAY, revision: 1 })
    expect(open.sent).toEqual([{
      type: 'assignment.add', origin: 'agent',
      assignment: { id: 'as-new-1', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-femke' }, share: 0.5, from: TODAY, acting: true },
    }])
  })

  it('refuses a unit that is not one, one kept elsewhere, a role nobody holds, and someone who has left or is unknown', async () => {
    const open = session('customer', customer)
    const tried = async (args: Record<string, unknown>) => refusal(await ask('assignment.add', { unitId: 'webshop', roleId: 'ro-po', personId: 'pe-bram', ...args }, open))
    expect((await tried({ unitId: 'partners' }))?.[0]).toBe('agent.badArguments')
    expect((await tried({ unitId: 'shipping-team' }))?.[0]).toBe('agent.scopeNotOpen')
    expect((await tried({ unitId: 'nowhere' }))?.[0]).toBe('agent.unknownId')
    expect((await tried({ roleId: 'ro-gone' }))?.[0]).toBe('agent.unknownId')
    expect(await tried({ personId: 'pe-gijs' })).toEqual(['agent.badArguments', 'pe-gijs has left: only someone still with the organisation is assigned'])
    expect((await tried({ personId: 'pe-nobody' }))?.[0]).toBe('agent.unknownId')
    expect((await tried({ from: 'soon' }))?.[0]).toBe('agent.badArguments')
    expect(open.sent).toEqual([])
  })

  it('takes an id as given where there is no register to ask, and roles from the organisation\'s own model there', async () => {
    const root = session('', { ...organisation, elements: [actor('board', 'Board', { unitTypeId: 'ut-team' })] }, null)
    expect(parsed(await ask('assignment.add', { unitId: 'board', roleId: 'ro-po', personId: 'pe-anyone', from: '2026-11-01', until: '2027-10-31' }, root)).personId)
      .toBe('pe-anyone')
  })

  it('ends an assignment on a day, and refuses one over already or not begun', async () => {
    const open = session('customer', { ...customer, assignments: [...customer.assignments!, as('as-3', 'webshop', 'ro-dev', 'pe-bram', { from: '2027-01-01' })] })
    expect(parsed(await ask('assignment.end', { id: 'as-1', on: '2026-10-31' }, open))).toEqual({ id: 'as-1', until: '2026-10-31', revision: 1 })
    expect(open.sent[0]).toEqual({ type: 'assignment.update', id: 'as-1', patch: { until: '2026-10-31' }, origin: 'agent' })
    expect(parsed(await ask('assignment.end', { id: 'as-1' }, open)).until).toBe(TODAY)
    expect(refusal(await ask('assignment.end', { id: 'as-2' }, open))?.[1]).toBe('as-2 ended on 2026-06-30 already')
    expect(refusal(await ask('assignment.end', { id: 'as-3' }, open))?.[1]).toMatch(/begins on 2027-01-01/)
    expect(refusal(await ask('assignment.end', { id: 'as-9' }, open))?.[0]).toBe('agent.unknownId')
    expect(refusal(await ask('assignment.end', { id: 'as-1', on: 'later' }, open))?.[0]).toBe('agent.badArguments')
  })

  it('offers no tool that forgets, removes or merges a person, or removes an assignment', () => {
    for (const name of ['person.forget', 'person.remove', 'person.merge', 'people.merge', 'assignment.remove']) expect(TOOL_NAMES).not.toContain(name)
  })
})

describe('an actor made a unit through the element tools', () => {
  it('takes a unit type, the domains it serves and its roles beyond its type\'s', async () => {
    const open = session('customer', customer)
    parsed(await ask('element.update', {
      id: 'partners', unitTypeId: 'ut-team', scopes: ['customer', 'shipping', 'customer'], extraSlots: [{ roleId: 'ro-po', min: 0, max: 1 }],
    }, open))
    expect(open.sent[0]).toEqual({
      type: 'element.update', id: 'partners', origin: 'agent',
      patch: { unitTypeId: 'ut-team', scopes: ['customer', 'shipping'], extraSlots: [{ role: 'ro-po', min: 0, max: 1 }] },
    })
    parsed(await ask('element.update', { id: 'partners', unitTypeId: null, scopes: null, extraSlots: null }, open))
    expect(open.model().elements.partners).toEqual(actor('partners', 'Partners'))
  })

  it('refuses a type nobody holds, a type on what is not an actor, and a role or a count that does not stand', async () => {
    const open = session('customer', { ...customer, elements: [...customer.elements, { ...actor('crm', 'CRM'), kind: 'application' }] })
    expect(refusal(await ask('element.update', { id: 'partners', unitTypeId: 'ut-gone' }, open))?.[0]).toBe('agent.unknownId')
    expect(refusal(await ask('element.update', { id: 'crm', unitTypeId: 'ut-team' }, open))?.[0]).toBe('agent.badArguments')
    expect(refusal(await ask('element.update', { id: 'partners', extraSlots: [{ roleId: 'ro-gone', min: 0 }] }, open))?.[0]).toBe('agent.unknownId')
    expect(refusal(await ask('element.update', { id: 'partners', extraSlots: [{ roleId: 'ro-po', min: 2, max: 1 }] }, open))?.[0]).toBe('agent.badArguments')
    expect(open.sent).toEqual([])
  })
})

describe('a reorganisation at the agent (ADR-0036 §6)', () => {
  /** A plan of the customer domain, to put units under another parent on a day. */
  const PLAN = { id: 'tr-1', number: 1, title: 'Webshop under Parcel', status: 'draft' as const, elements: [], decisions: [], milestones: [], body: '' }
  const planned = (over: Partial<typeof PLAN & { moves: { unitId: string; parentId?: string; on: string }[] }> = {}): HostModel => ({
    ...customer, transitions: [{ ...PLAN, ...over }],
  })

  it('puts a unit under a new parent on a day as one step on the plan, moves it again, and takes the move off', async () => {
    const open = session('customer', planned())
    expect(parsed(await ask('plan.move', { planId: 'TR-1', unitId: 'webshop', parentId: 'parcel', on: '2027-01-01' }, open)))
      .toEqual({ planId: 'tr-1', label: 'TR-0001', moves: [{ unitId: 'webshop', parentId: 'parcel', on: '2027-01-01' }], revision: 1 })
    expect(open.sent[0]).toEqual({
      type: 'transition.update', id: 'tr-1', origin: 'agent', patch: { moves: [{ unitId: 'webshop', parentId: 'parcel', on: '2027-01-01' }] },
    })
    expect(parsed(await ask('plan.move', { planId: 'tr-1', unitId: 'webshop', on: '2027-02-01' }, open)).moves)
      .toEqual([{ unitId: 'webshop', on: '2027-02-01' }])
    expect(parsed(await ask('plan.move', { planId: 'tr-1', unitId: 'webshop', remove: true }, open)).moves).toEqual([])
    expect(open.model().transitions?.['tr-1']).not.toHaveProperty('moves')
    const read = parsed(await ask('plan.read', { id: 'tr-1' }, session('customer', planned({ moves: [{ unitId: 'webshop', on: '2027-01-01' }] }))))
    expect(read.moves).toEqual([{ unitId: 'webshop', on: '2027-01-01' }])
  })

  it('refuses a plan or a unit nobody holds, a day that is not one, itself as its parent, and a loop', async () => {
    const open = session('customer', planned({ moves: [{ unitId: 'parcel', parentId: 'webshop', on: '2026-12-01' }] }))
    const tried = async (args: Record<string, unknown>) => refusal(await ask('plan.move', { planId: 'tr-1', unitId: 'webshop', on: '2027-01-01', ...args }, open))
    expect((await tried({ planId: 'tr-9' }))?.[0]).toBe('agent.unknownId')
    expect((await tried({ unitId: 'partners' }))?.[0]).toBe('agent.unknownId')
    expect((await tried({ parentId: 'nowhere' }))?.[0]).toBe('agent.unknownId')
    expect((await tried({ on: 'soon' }))?.[0]).toBe('agent.badArguments')
    expect((await tried({ parentId: 'webshop' }))?.[0]).toBe('agent.badArguments')
    // Parcel sits under the webshop from December, so the webshop under Parcel in January is a loop; in November it is not.
    expect(await tried({ parentId: 'parcel' }))
      .toEqual(['agent.badArguments', 'parcel sits below webshop on 2027-01-01, or on a later day the plans\' moves reach: the move would make a loop'])
    // And in November: from December the move already on the plan would close the loop.
    expect((await tried({ parentId: 'parcel', on: '2026-11-01' }))?.[0]).toBe('agent.badArguments')
    expect(await tried({ on: '2026-11-01' })).toBeUndefined()
    expect((await tried({ unitId: 'webshop', remove: true, planId: 'tr-1' }))).toBeUndefined()
  })

  it('reads the organisation on a day with every plan\'s moves of that day, and the checks of that day', async () => {
    const open = session('customer', planned({ moves: [{ unitId: 'webshop', parentId: 'parcel', on: '2027-01-01' }] }))
    expect(parsed(await ask('assignments.list', { unitId: 'webshop' }, open, shell())).unit).not.toHaveProperty('parentId')
    const later = parsed(await ask('assignments.list', { unitId: 'webshop', on: '2027-01-01' }, open, shell()))
    expect(later.unit).toMatchObject({ parentId: 'parcel', parent: 'Parcel' })
    const days: (string | undefined)[] = []
    const withChecks = session('customer', customer)
    const asked = { ...withChecks, tree: { ...tree(), findings: (day?: string) => { days.push(day); return [] } } }
    expect(parsed(await ask('checks.list', { on: '2027-01-01' }, asked))).toEqual({ day: '2027-01-01', total: 0, some: [] })
    expect(parsed(await ask('checks.list', {}, asked))).toEqual({ total: 0, some: [] })
    expect(days).toEqual(['2027-01-01', undefined])
  })
})
