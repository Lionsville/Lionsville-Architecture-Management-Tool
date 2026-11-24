// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The rest of the operating model at the agent (ADR-0036, amended 24 November
 * 2026): responsibilities, rules and cells of the RACI written, and a role or
 * a unit type taken out only where nothing in any scope uses it — alone, in a
 * batch and in a script.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/hostModel'
import type { Assignment } from '../model/units'
import type { DesignElement } from '../model/types'
import { codeMode } from './code/query'
import { hostOver, said, sessionOver, shellOver } from './code/testing/codeHost'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'
import { MOST_CELLS } from './write/operatingRecords'

const ORGANISATION: HostModel = {
  name: 'Acme Logistics', elements: [], relations: [], diagrams: [],
  unitTypes: [
    { id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-po', min: 1 }] },
    { id: 'ut-old', name: 'Desk', within: [], slots: [] },
  ],
  roles: [
    { id: 'ro-po', name: 'Product owner', duties: [{ responsibility: 'rs-order', raci: 'A' }, { responsibility: 'rs-plan', raci: 'R' }] },
    { id: 'ro-dev', name: 'Developer', duties: [{ responsibility: 'rs-order', raci: 'C' }] },
    { id: 'ro-old', name: 'Coordinator', duties: [{ responsibility: 'rs-plan', raci: 'I' }] },
  ],
  responsibilities: [{ id: 'rs-order', name: 'Order the backlog', group: 'Deliver' }, { id: 'rs-plan', name: 'Plan the interval' }],
  operatingRules: [{ id: 'applicationOwner', role: 'ro-po' }],
}

type Elsewhere = { units?: { scope: string; unit: DesignElement }[]; assignments?: { scope: string; assignment: Assignment }[]; scopeType?: string }

function tree(over: Partial<TreeView> = {}, at: Elsewhere = {}): TreeView {
  return {
    scopes: () => [
      { path: '', name: 'Acme Logistics', views: 0 },
      { path: 'retail', name: 'Retail', views: 0, ...(at.scopeType ? { unitTypeId: at.scopeType } : {}) },
    ],
    lookup: () => undefined, register: () => [], findings: () => [], initiativesBelow: () => [],
    unread: () => [], units: () => at.units ?? [], assignments: () => at.assignments ?? [],
    read: () => Promise.resolve(undefined),
    ...over,
  }
}

const open = (host: HostModel = ORGANISATION, seen: TreeView | undefined = tree(), path = '') => sessionOver(host, path, { tree: seen })
const ask = (tool: string, args: unknown, on: SessionView): Promise<AgentAnswer> => handle({ id: '1', tool, args }, on)
const refusal = (out: AgentAnswer) => (out.ok ? undefined : { key: out.refusal, detail: out.detail ?? '' })
const roleOf = (on: ReturnType<typeof open>, id: string) => on.current().roles!.find((one) => one.id === id)
const unit = (id: string, over: Partial<DesignElement>): DesignElement => ({ id, kind: 'actor', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over })

describe('a responsibility', () => {
  it('is added, changed and taken out, with every part in it', async () => {
    const on = open()
    const added = said(await ask('responsibility.add', { name: ' Release ', description: 'Brings it live.', group: 'Deliver', order: 3 }, on))
    expect(added).toMatchObject({ name: 'Release', description: 'Brings it live.', group: 'Deliver', order: 3, finding: 'nobody is accountable' })
    expect(said(await ask('responsibility.update', { id: added.id, name: 'Ship', group: null, order: null }, on))).not.toHaveProperty('group')
    expect(on.current().responsibilities!.at(-1)).toEqual({ id: added.id, name: 'Ship', description: 'Brings it live.' })
    const gone = said(await ask('responsibility.remove', { id: 'rs-plan' }, on))
    expect(gone.partsRemoved).toEqual([
      { roleId: 'ro-po', role: 'Product owner', raci: 'R' }, { roleId: 'ro-old', role: 'Coordinator', raci: 'I' },
    ])
    expect(roleOf(on, 'ro-po')!.duties).toEqual([{ responsibility: 'rs-order', raci: 'A' }])
    expect(on.history().at(-1)).toMatchObject({ origin: 'agent', summary: { key: 'activity.responsibilityRemoved', name: 'Plan the interval' } })
  })

  it('needs a name, an id that is there, and the organisation', async () => {
    expect(refusal(await ask('responsibility.add', { name: ' ' }, open()))?.key).toBe('agent.badArguments')
    expect(refusal(await ask('responsibility.update', { id: 'nope', name: 'x' }, open()))?.key).toBe('agent.unknownId')
    expect(refusal(await ask('responsibility.remove', { id: 'nope' }, open()))?.key).toBe('agent.unknownId')
    const elsewhere = open({ name: 'Retail', elements: [], relations: [], diagrams: [] }, tree(), 'retail')
    for (const [tool, args] of [
      ['responsibility.add', { name: 'x' }], ['responsibility.update', { id: 'x' }], ['responsibility.remove', { id: 'x' }], ['role.remove', { id: 'x' }],
      ['unitType.remove', { id: 'x' }], ['operatingRule.set', { kind: 'domainOwner', roleId: null }], ['raci.set', { cells: [] }],
    ] as const) expect(refusal(await ask(tool, args, elsewhere))?.key, tool).toBe('agent.scopeNotOpen')
  })

  it('and a role keep the organisation\'s order, answered and cleared', async () => {
    const on = open()
    expect(said(await ask('role.add', { name: 'Coach', order: 2 }, on))).toMatchObject({ order: 2 })
    expect(said(await ask('role.update', { id: 'ro-dev', order: 1 }, on))).toMatchObject({ order: 1 })
    expect((said(await ask('roles.list', {}, on)).roles as { id: string; order?: number }[]).find((one) => one.id === 'ro-dev')?.order).toBe(1)
    await ask('role.update', { id: 'ro-dev', order: null }, on)
    expect(roleOf(on, 'ro-dev')).not.toHaveProperty('order')
  })
})

describe('a rule', () => {
  it('is set, changed and cleared, and says where there is nothing to clear', async () => {
    const on = open()
    expect(said(await ask('operatingRule.set', { kind: 'domainOwner', roleId: 'ro-dev' }, on))).toMatchObject({ roleId: 'ro-dev', role: 'Developer' })
    expect(said(await ask('operatingRule.set', { kind: 'domainOwner', roleId: 'ro-po' }, on))).toMatchObject({ was: 'ro-dev' })
    expect(said(await ask('operatingRule.set', { kind: 'domainOwner', roleId: null }, on))).toMatchObject({ cleared: true })
    expect(on.current().operatingRules).toEqual([{ id: 'applicationOwner', role: 'ro-po' }])
    expect(refusal(await ask('operatingRule.set', { kind: 'domainOwner', roleId: null }, on))?.key).toBe('agent.unknownId')
    expect(refusal(await ask('operatingRule.set', { kind: 'domainOwner', roleId: 'nope' }, on))?.key).toBe('agent.unknownId')
    expect(refusal(await ask('operatingRule.set', { kind: 'other', roleId: 'ro-po' }, on))?.key).toBe('agent.badArguments')
  })
})

describe('cells of the RACI', () => {
  it('are set in one step, the others untouched', async () => {
    const on = open()
    const out = said(await ask('raci.set', {
      cells: [
        { roleId: 'ro-dev', responsibilityId: 'rs-plan', raci: 'R' },
        { roleId: 'ro-po', responsibilityId: 'rs-plan', raci: 'A' },
        { roleId: 'ro-old', responsibilityId: 'rs-plan', raci: null },
        { roleId: 'ro-po', responsibilityId: 'rs-order', raci: 'A' },
      ],
    }, on))
    expect(out).toMatchObject({ set: 3, unchanged: 1 })
    expect(out.changed).toContainEqual({ roleId: 'ro-po', responsibilityId: 'rs-plan', raci: 'A', was: 'R' })
    expect(out).not.toHaveProperty('findings')
    expect(roleOf(on, 'ro-dev')!.duties).toEqual([{ responsibility: 'rs-order', raci: 'C' }, { responsibility: 'rs-plan', raci: 'R' }])
    expect(roleOf(on, 'ro-old')!.duties).toEqual([])
    expect(on.history()).toHaveLength(1)
    const { summary, origin } = on.history()[0]
    expect({ summary, origin }).toEqual({ summary: { key: 'activity.raciSet', count: 3 }, origin: 'agent' })
  })

  it('say the finding they leave, and land where nothing changes', async () => {
    const on = open()
    expect(said(await ask('raci.set', { cells: [{ roleId: 'ro-po', responsibilityId: 'rs-order', raci: null }] }, on)).findings)
      .toEqual([{ responsibilityId: 'rs-order', finding: 'nobody is accountable' }])
    expect(said(await ask('raci.set', { cells: [{ roleId: 'ro-dev', responsibilityId: 'rs-order', raci: 'C' }] }, on))).toMatchObject({ set: 0, unchanged: 1 })
  })

  it('name every bad id before anything is written, and refuse a cell twice and too many', async () => {
    const on = open()
    const bad = refusal(await ask('raci.set', {
      cells: [
        { roleId: 'ro-po', responsibilityId: 'rs-plan', raci: 'C' },
        { roleId: 'ro-x', responsibilityId: 'rs-plan', raci: 'A' },
        { roleId: 'ro-y', responsibilityId: 'rs-z', raci: null },
      ],
    }, on))
    expect(bad).toEqual({ key: 'agent.unknownId', detail: 'role ro-x; role ro-y; responsibility rs-z' })
    const cell = { roleId: 'ro-po', responsibilityId: 'rs-plan', raci: 'C' }
    expect(refusal(await ask('raci.set', { cells: [cell, cell] }, on))).toMatchObject({ key: 'agent.badArguments', detail: expect.stringContaining('cells[1]') as string })
    expect(refusal(await ask('raci.set', { cells: Array(MOST_CELLS + 1).fill(cell) }, on))?.detail).toContain(`the most is ${MOST_CELLS}`)
    expect(refusal(await ask('raci.set', { cells: [] }, on))?.key).toBe('agent.badArguments')
    expect(refusal(await ask('raci.set', { cells: [{ ...cell, raci: 'X' }] }, on))?.key).toBe('agent.badArguments')
    expect(refusal(await ask('raci.set', { cells: [{ ...cell, roleId: null }] }, on))?.key).toBe('agent.badArguments')
    expect(refusal(await ask('raci.set', { cells: [cell], ifRevision: 9 }, on))?.key).toBe('agent.stale')
    expect(on.history()).toHaveLength(0)
  })

  it('name what earlier steps of a batch made', async () => {
    const on = open()
    said(await ask('batch', { steps: [
      { tool: 'responsibility.add', args: { name: 'Release' } },
      { tool: 'role.add', args: { name: 'Release manager' } },
      { tool: 'raci.set', args: { cells: [{ roleId: { $ref: 'steps[1].id' }, responsibilityId: { $ref: 'steps[0].id' }, raci: 'A' }] } },
      { tool: 'operatingRule.set', args: { kind: 'domainOwner', roleId: { $ref: 'steps[1].id' } } },
    ] }, on))
    expect(on.history()).toHaveLength(1)
    expect(on.current().roles!.at(-1)).toMatchObject({ name: 'Release manager', duties: [{ responsibility: on.current().responsibilities!.at(-1)!.id, raci: 'A' }] })
  })

  it('are tried and run by a script with the role and the responsibility it makes', async () => {
    const on = open()
    const host = hostOver({ session: on, shell: shellOver() })
    const mode = codeMode()
    const tried = said(await mode.answer({ id: '1', tool: 'simulate', args: { script: `
      const duty = await lv.responsibilities.add({ name: "Release", group: "Deliver" })
      const role = await lv.roles.add({ name: "Release manager", order: 4 })
      const cells = await lv.raci.set({ cells: [
        { roleId: role.id, responsibilityId: duty.id, raci: "A" },
        { roleId: "ro-dev", responsibilityId: duty.id, raci: "R" },
      ] })
      await lv.operatingRules.set({ kind: "domainOwner", roleId: role.id })
      await lv.roles.remove({ id: "ro-old" })
      return { set: cells.set, listed: (await lv.responsibilities.list()).responsibilities.length }
    ` } }, host))
    expect(tried).toMatchObject({ result: { set: 2, listed: 3 }, refusals: [] })
    expect((tried.steps as { call: string }[]).map((step) => step.call))
      .toEqual(['responsibilities.add', 'roles.add', 'raci.set', 'operatingRules.set', 'roles.remove'])
    expect(on.history()).toHaveLength(0)
    expect(said(await mode.answer({ id: '2', tool: 'run', args: { token: tried.token } }, host))).toMatchObject({ landed: [{ scope: '', writes: 5 }] })
    expect(on.history()).toHaveLength(1)
    expect(on.current().roles!.map((one) => one.name)).toEqual(['Product owner', 'Developer', 'Release manager'])
  })
})

describe('a role or a unit type taken out', () => {
  it('goes where nothing uses it, with its own parts', async () => {
    const on = open()
    expect(said(await ask('role.remove', { id: 'ro-old' }, on))).toMatchObject({ removed: true, partsRemoved: [{ responsibilityId: 'rs-plan', raci: 'I' }] })
    expect(said(await ask('unitType.remove', { id: 'ut-old' }, on))).toMatchObject({ removed: true, name: 'Desk' })
    expect(roleOf(on, 'ro-old')).toBeUndefined()
    expect(refusal(await ask('role.remove', { id: 'ro-old' }, on))?.key).toBe('agent.unknownId')
    expect(refusal(await ask('unitType.remove', { id: 'ut-old' }, on))?.key).toBe('agent.unknownId')
  })

  it('is not refused for what the role says of itself', async () => {
    const roles = ORGANISATION.roles!.map((one) => (one.id === 'ro-old' ? { ...one, reportsTo: [{ role: 'ro-old', kind: 'dotted' as const }] } : one))
    expect((await ask('role.remove', { id: 'ro-old' }, open({ ...ORGANISATION, roles }))).ok).toBe(true)
  })

  it('names every use of a role in the model', async () => {
    const on = open({
      ...ORGANISATION,
      unitTypes: [{ id: 'ut-team', name: 'Team', within: [], slots: [{ role: 'ro-po', min: 1 }, { role: 'ro-dev', min: 1, reportsTo: { role: 'ro-po', kind: 'solid' } }] }],
      roles: ORGANISATION.roles!.map((one) => (one.id === 'ro-old' ? { ...one, until: '2025-01-01', successors: ['ro-po'], reportsTo: { role: 'ro-po', kind: 'solid' as const } } : one)),
    })
    const { key, detail } = refusal(await ask('role.remove', { id: 'ro-po' }, on))!
    expect(key).toBe('agent.inUse')
    for (const part of ['Team (ut-team) has a slot', 'has ro-dev report to it', 'Coordinator (ro-old) reports to it', 'successor', 'the rule applicationOwner']) {
      expect(detail).toContain(part)
    }
  })

  it('names every use of a role in any scope, the organisation\'s and ended ones among them', async () => {
    const line = { to: { scope: 'retail', unit: 'u-1', role: 'ro-old' }, kind: 'solid' as const }
    const uses: [Elsewhere, string][] = [
      [{ units: [{ scope: 'retail', unit: unit('u-1', { unitTypeId: 'ut-team', extraSlots: [{ role: 'ro-old', min: 1 }] }) }] }, 'unit u-1 (u-1) in retail has a slot'],
      [{ units: [{ scope: 'retail', unit: unit('u-1', { unitTypeId: 'ut-team', reportingLines: [{ role: 'ro-old', kind: 'solid' }] }) }] }, 'reporting line'],
      [{ units: [{ scope: 'retail', unit: unit('u-1', { unitTypeId: 'ut-team', reportingLines: [{ role: 'ro-dev', ...line }] }) }] }, 'reporting line'],
      [{ assignments: [{ scope: 'retail', assignment: { id: 'as-1', unitId: 'u-1', roleId: 'ro-old', person: { person: 'pe-1' }, until: '2020-01-01' } }] }, 'as-1 in retail holds it in unit u-1, until 2020-01-01'],
      [{ assignments: [{ scope: 'retail', assignment: { id: 'as-1', unitId: 'u-1', roleId: 'ro-dev', person: { person: 'pe-1' }, reportsTo: [line] } }] }, 'as-1 in retail reports to it'],
    ]
    for (const [at, part] of uses) {
      const out = refusal(await ask('role.remove', { id: 'ro-old' }, open(ORGANISATION, tree({}, at))))
      expect(out?.key).toBe('agent.inUse')
      expect(out?.detail).toContain(part)
      // Nobody's name or id is in it.
      expect(out?.detail).not.toContain('pe-1')
    }
    const here = open({ ...ORGANISATION, assignments: [{ id: 'as-2', unitId: 'u-9', roleId: 'ro-old', person: { person: 'pe-1' } }] })
    expect(refusal(await ask('role.remove', { id: 'ro-old' }, here))?.detail).toContain('as-2 in the organisation')
  })

  it('names every use of a unit type: a place, a successor, a unit, a scope', async () => {
    const types = [...ORGANISATION.unitTypes!, { id: 'ut-x', name: 'Cell', within: ['ut-old'], successors: ['ut-old'], slots: [] }]
    const detail = async (on: ReturnType<typeof open>) => refusal(await ask('unitType.remove', { id: 'ut-old' }, on))?.detail
    expect(await detail(open({ ...ORGANISATION, unitTypes: types }))).toBe('unit type Cell (ut-x) may sit in it; unit type Cell (ut-x) names it as a successor')
    expect(await detail(open(ORGANISATION, tree({}, { units: [{ scope: 'retail', unit: unit('u-1', { unitTypeId: 'ut-old' }) }] })))).toContain('in retail is one')
    expect(await detail(open({ ...ORGANISATION, elements: [unit('u-2', { unitTypeId: 'ut-old' })] }))).toContain('in the organisation is one')
    expect(await detail(open(ORGANISATION, tree({}, { scopeType: 'ut-old' })))).toContain('scope retail is one')
  })

  it('is refused where the host cannot say every scope was read', async () => {
    const blind: Partial<TreeView>[] = [
      { unread: undefined }, { units: undefined }, { assignments: undefined }, { unread: () => ['retail/closed'] }, { listed: () => false },
    ]
    for (const over of blind) {
      for (const [tool, id] of [['role.remove', 'ro-old'], ['unitType.remove', 'ut-old']]) {
        expect(refusal(await ask(tool, { id }, open(ORGANISATION, tree(over))))?.key).toBe('agent.notAllRead')
      }
    }
    expect(refusal(await ask('role.remove', { id: 'ro-old' }, open(ORGANISATION, tree({ unread: () => ['retail/closed'] }))))?.detail).toBe('retail/closed')
    const none = sessionOver(ORGANISATION, '', {})
    expect(refusal(await ask('role.remove', { id: 'ro-old' }, none))?.key).toBe('agent.notAllRead')
  })

  it('counts what a long list leaves out, and goes in a batch that clears the uses first', async () => {
    const many = Array.from({ length: 30 }, (_, n) => ({ scope: 'retail', assignment: { id: `as-${n}`, unitId: 'u-1', roleId: 'ro-old', person: { person: 'pe-1' } } }))
    expect(refusal(await ask('role.remove', { id: 'ro-old' }, open(ORGANISATION, tree({}, { assignments: many }))))?.detail).toMatch(/; and 5 more$/)
    const on = open()
    said(await ask('batch', { steps: [
      { tool: 'unitType.update', args: { id: 'ut-team', slots: [] } },
      { tool: 'operatingRule.set', args: { kind: 'applicationOwner', roleId: null } },
      { tool: 'role.remove', args: { id: 'ro-po' } },
    ] }, on))
    expect(roleOf(on, 'ro-po')).toBeUndefined()
  })
})
