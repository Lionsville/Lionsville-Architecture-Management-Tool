// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An agent and the two views of the organisation (ADR-0036 §7): it makes an
 * organisation chart and a Conway map, reads what each draws, and declares an
 * interaction between two units as a row. One fictional organisation, Acme
 * Logistics: a customer domain open, a platform cluster at the root.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { Role, UnitType } from '../model/operatingModel'
import { apply } from '../model/reducer'
import type { DesignElement } from '../model/types'
import { laidOut } from '../model/testFixtures'
import { DEFAULT_POLICY } from '../people/policy'
import type { PeoplePolicy } from '../people/policy'
import { Driving } from './driving'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { ShellView } from './shell'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'

const team: UnitType = { id: 'ut-team', name: 'Team', within: [], top: true, limit: 1, slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 2 }] }
const roles: Role[] = [{ id: 'ro-po', name: 'Product owner', duties: [], manages: true }, { id: 'ro-dev', name: 'Developer', duties: [] }]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const app = (id: string, name: string, partyId?: string): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...(partyId ? { partyId } : {}),
})

function host(): HostModel {
  return {
    name: 'Customer',
    elements: [actor('web', 'Webshop', { unitTypeId: 'ut-team' }), actor('mob', 'Mobile', { unitTypeId: 'ut-team' }), app('shop', 'Shop', 'web'), app('orders', 'Orders', 'web'), app('phone', 'Phone app', 'mob'), app('bill', 'Billing')],
    relations: [
      { id: 'f-1', type: 'flow', sourceId: 'phone', targetId: 'orders', isBidirectional: false },
      { id: 'f-2', type: 'flow', sourceId: 'orders', targetId: 'bill', isBidirectional: false },
    ],
    diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })],
    assignments: [{ id: 'as-1', unitId: 'web', roleId: 'ro-po', person: { person: 'pe-sara' } }],
  }
}

/** The tree around the open scope: the operating model at the root, nothing else kept elsewhere. */
const tree = {
  scopes: () => [], lookup: () => undefined, register: () => [], findings: () => [], initiativesBelow: () => [],
  units: () => [], assignments: () => [], rowsTo: () => [],
  operatingModel: () => ({ unitTypes: [team], roles, responsibilities: [], operatingRules: [] }),
  read: () => Promise.resolve(undefined),
} as unknown as TreeView

function session(): SessionView & { model(): Model } {
  let model: Model = fromArrays(host())
  let counter = 0
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    scopePath: () => 'customer',
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-10-11',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => 0,
    history: () => [],
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    tree,
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(JSON.stringify(out))
  return JSON.parse(out.content[0].text) as Record<string, unknown>
}

describe('an agent and the views of the organisation', () => {
  it('makes an organisation chart and a Conway map by name, each switched to', async () => {
    const held = session()
    const chart = parsed(await handle({ id: '1', tool: 'diagram.create', args: { kind: 'chart', name: 'Who holds what' } }, held))
    expect(chart).toMatchObject({ kind: 'chart', name: 'Who holds what' })
    expect(held.model().diagrams[chart.id as string]).toMatchObject({ kind: 'chart', name: 'Who holds what' })
    const conway = parsed(await handle({ id: '2', tool: 'diagram.create', args: { kind: 'conway', name: 'Teams and systems' } }, held))
    expect(held.model().diagrams[conway.id as string]?.kind).toBe('conway')
    const refused = await handle({ id: '3', tool: 'diagram.create', args: { kind: 'chart' } }, held)
    expect(refused).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('refuses a picture of either where the organisation withholds names from agents, and leaves it to the renderer where it does not', async () => {
    const held = session()
    const around = (policy: PeoplePolicy): ShellView => ({
      screen: () => ({ home: { path: '', name: 'Acme Logistics' } }),
      open: () => {},
      client: () => 'Claude Code',
      driving: new Driving(() => '2026-10-11T10:00:00.000Z'),
      people: {
        read: () => Promise.resolve({ people: [], policy }), add: () => Promise.reject(new Error('no')), leave: () => Promise.reject(new Error('no')),
        today: () => '2026-10-11', readOnly: () => false,
      },
    }) as unknown as ShellView
    for (const kind of ['chart', 'conway']) {
      const made = parsed(await handle({ id: '1', tool: 'diagram.create', args: { kind, name: kind } }, held))
      const render = { id: '2', tool: 'diagram.render', args: { diagramId: made.id } }
      expect(await handle(render, held, around({ ...DEFAULT_POLICY, agentsSee: 'pseudonyms' }))).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
      // Where agents see names, the picture is the renderer's to take, and this test has none.
      expect(await handle(render, held, around(DEFAULT_POLICY))).toMatchObject({ ok: false, refusal: 'agent.noScreen' })
    }
  })

  it('reads an organisation chart as its units, roles, holders and vacancies on the view\'s day', async () => {
    const held = session()
    const made = parsed(await handle({ id: '1', tool: 'diagram.create', args: { kind: 'chart', name: 'Chart' } }, held))
    const report = parsed(await handle({ id: '2', tool: 'diagram.inspect', args: { diagramId: made.id } }, held))
    expect(report).toMatchObject({ kind: 'chart', day: '2026-10-11', units: 2, people: 1 })
    const roots = report.roots as { id: string; slots: { roleId: string; holders: { personId: string }[]; vacant?: number }[] }[]
    expect(roots.map((one) => one.id)).toEqual(['mob', 'web'])
    const web = roots.find((one) => one.id === 'web')!
    expect(web.slots).toEqual([
      { roleId: 'ro-po', role: 'Product owner', min: 1, max: 1, holders: [{ personId: 'pe-sara', share: 100 }] },
      { roleId: 'ro-dev', role: 'Developer', min: 2, holders: [], vacant: 2 },
    ])
  })

  it('reads a Conway map as its columns, the crossings and the findings, and an interaction declared answers one', async () => {
    const held = session()
    const made = parsed(await handle({ id: '1', tool: 'diagram.create', args: { kind: 'conway', name: 'Map' } }, held))
    const report = parsed(await handle({ id: '2', tool: 'diagram.inspect', args: { diagramId: made.id } }, held))
    expect((report.groups as { unitId?: string }[]).map((one) => one.unitId ?? null)).toEqual(['mob', 'web', null])
    expect((report.findings as { kind: string }[]).map((one) => one.kind)).toEqual(['undeclared', 'unowned', 'overLimit'])
    const row = parsed(await handle({ id: '3', tool: 'relation.add', args: { type: 'interacts', sourceId: 'mob', targetId: 'web', mode: 'service' } }, held))
    expect(held.model().relations[row.id as string]).toMatchObject({ type: 'interacts', mode: 'service' })
    const after = parsed(await handle({ id: '4', tool: 'diagram.inspect', args: { diagramId: made.id } }, held))
    expect((after.findings as { kind: string }[]).map((one) => one.kind)).toEqual(['unowned', 'overLimit'])
    expect((after.crossing as { status: string; mode?: string }[]).find((one) => one.status === 'declared')).toMatchObject({ mode: 'service' })
  })

  /** An application is on the map while it is there by its lifecycle on the map's day (ADR-0009), as on the page. */
  it('reads a Conway map without an application not yet live or gone on its day, and without what it would find about one', async () => {
    const held = session()
    held.dispatch({ type: 'element.update', id: 'orders', patch: { lifecycleDates: { retired: '2026-10-01' } } })
    held.dispatch({ type: 'element.update', id: 'bill', patch: { lifecycle: 'planned', lifecycleDates: { live: '2027-01-01' } } })
    const made = parsed(await handle({ id: '1', tool: 'diagram.create', args: { kind: 'conway', name: 'Map' } }, held))
    const report = parsed(await handle({ id: '2', tool: 'diagram.inspect', args: { diagramId: made.id } }, held))
    const drawn = (report.groups as { applications: { id: string }[] }[]).flatMap((one) => one.applications.map((app) => app.id))
    expect(drawn.sort()).toEqual(['phone', 'shop'])
    expect(report.crossing).toEqual([])
    expect(report.findings).toEqual([])
  })

  it('lists an interaction with its mode, keeps a mode on no other row, and takes a day on either view', async () => {
    const held = session()
    const row = parsed(await handle({ id: '1', tool: 'relation.add', args: { type: 'interacts', sourceId: 'mob', targetId: 'web', mode: 'facilitating' } }, held))
    const listed = parsed(await handle({ id: '2', tool: 'connections.list', args: {} }, held))
    expect(JSON.stringify(listed)).toContain('"mode":"facilitating"')
    const other = parsed(await handle({ id: '3', tool: 'relation.add', args: { type: 'assigned', sourceId: 'mob', targetId: 'shop', mode: 'service' } }, held))
    expect(held.model().relations[other.id as string]).not.toHaveProperty('mode')
    await handle({ id: '4', tool: 'relation.update', args: { id: row.id, type: 'assigned' } }, held)
    expect(held.model().relations[row.id as string]).not.toHaveProperty('mode')
    const chart = parsed(await handle({ id: '5', tool: 'diagram.create', args: { kind: 'chart', name: 'Chart' } }, held))
    expect((await handle({ id: '6', tool: 'diagram.update', args: { id: chart.id, asOf: '2027-01-01' } }, held)).ok).toBe(true)
    expect(held.model().diagrams[chart.id as string]?.asOf).toBe('2027-01-01')
  })

  it('refuses an interaction that is not between two units', async () => {
    const held = session()
    const out = await handle({ id: '1', tool: 'relation.add', args: { type: 'interacts', sourceId: 'mob', targetId: 'shop' } }, held)
    expect(out).toMatchObject({ ok: false, refusal: 'command.interactsEnds' })
  })
})
