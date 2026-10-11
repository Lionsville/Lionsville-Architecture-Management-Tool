// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model at the agent (ADR-0036): three lists answered from the
 * organisation whatever scope is open, and four writes made there only — each
 * a step under the agent's name, checked against what the organisation holds.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'
import { nearestPlace, placeOf } from './place'
import { arrived, landed } from './screen'
import type { Destination, Screen } from './screen'
import { openApp } from './shell'
import type { ShellView } from './shell'

const organisation: HostModel = {
  name: 'Acme Logistics', elements: [], relations: [], diagrams: [],
  unitTypes: [
    { id: 'ut-train', name: 'Train', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] },
    { id: 'ut-team', name: 'Team', within: ['ut-train'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 3 }], limit: 3 },
  ],
  roles: [
    { id: 'ro-lead', name: 'Train lead', short: 'TL', duties: [{ responsibility: 'rs-plan', raci: 'A' }], manages: true },
    { id: 'ro-po', name: 'Product owner', short: 'PO', duties: [{ responsibility: 'rs-order', raci: 'A' }, { responsibility: 'rs-plan', raci: 'A' }] },
    { id: 'ro-dev', name: 'Developer', duties: [{ responsibility: 'rs-order', raci: 'C' }], basedOn: { library: 'scrum', entry: 'developer', version: '1', language: 'en' } },
  ],
  responsibilities: [
    { id: 'rs-order', name: 'Order the backlog', group: 'Deliver' },
    { id: 'rs-plan', name: 'Plan the interval', group: 'Plan' },
    { id: 'rs-run', name: 'Run it', group: 'Deliver' },
  ],
  operatingRules: [{ id: 'applicationOwner', role: 'ro-po' }],
}

const landscape: HostModel = { name: 'Retail', elements: [], relations: [], diagrams: [] }

function tree(): TreeView {
  return {
    scopes: () => [{ path: '', name: 'Acme Logistics', kind: 'organisation', views: 0 }, { path: 'retail', name: 'Retail', kind: 'landscape', views: 0 }],
    lookup: () => undefined,
    register: () => [],
    findings: () => [],
    initiativesBelow: () => [],
    read: async (path) => (path === '' ? { model: organisation, activeDiagramId: '', ancestorDecisions: [] } : undefined),
  }
}

function session(at: string, start: HostModel): SessionView & { model: () => Model; sent: Command[] } {
  let model: Model = fromArrays(start)
  let counter = 0
  let revision = 0
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
      void summarise([command], model)
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => model.order.elements),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-10-11',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    revision: () => revision,
    history: () => [],
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    tree: tree(),
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text)
}
const refusal = (out: AgentAnswer) => (out.ok ? undefined : [out.refusal, out.detail])
const ask = (tool: string, args: unknown, on: SessionView) => handle({ id: '1', tool, args }, on)

describe('the operating model\'s three lists', () => {
  it('answer from the organisation while it is open', async () => {
    const out = parsed(await ask('unitTypes.list', {}, session('', organisation)))
    expect(out.scope).toBe('')
    expect(out.unitTypes).toEqual([
      { id: 'ut-train', name: 'Train', lane: 1, top: true, within: [], slots: [{ roleId: 'ro-lead', role: 'Train lead', min: 1, max: 1 }] },
      {
        id: 'ut-team', name: 'Team', lane: 2, within: [{ id: 'ut-train', name: 'Train' }], limit: 3,
        slots: [{ roleId: 'ro-po', role: 'Product owner', min: 1, max: 1 }, { roleId: 'ro-dev', role: 'Developer', min: 3 }],
      },
    ])
  })

  it('list the unit types as the structure stands: by lane, then order, then name, and those that sit nowhere last', async () => {
    const shuffled: HostModel = {
      ...organisation,
      unitTypes: [
        { id: 'ut-guild', name: 'Guild', within: [], slots: [] },
        ...organisation.unitTypes!.slice().reverse(),
        { id: 'ut-desk', name: 'Desk', top: true, within: [], slots: [], order: 1 },
      ],
    }
    const out = parsed(await ask('unitTypes.list', {}, session('', shuffled)))
    const lines = out.unitTypes as Record<string, unknown>[]
    expect(lines.map((one) => [one.id, one.lane, one.order, one.sitsNowhere])).toEqual([
      ['ut-desk', 1, 1, undefined], ['ut-train', 1, undefined, undefined], ['ut-team', 2, undefined, undefined], ['ut-guild', undefined, undefined, true],
    ])
  })

  it('answer from the organisation\'s document while another scope is open, and whatever scope is asked', async () => {
    const out = parsed(await ask('roles.list', { scope: 'retail' }, session('retail', landscape)))
    expect((out.roles as { id: string }[]).map((role) => role.id)).toEqual(['ro-lead', 'ro-po', 'ro-dev'])
    expect(out.rules).toEqual([{ kind: 'applicationOwner', roleId: 'ro-po', role: 'Product owner' }])
    const developer = (out.roles as Record<string, unknown>[])[2]
    expect(developer).toMatchObject({
      duties: [{ responsibilityId: 'rs-order', responsibility: 'Order the backlog', raci: 'C' }],
      heldIn: [{ id: 'ut-team', name: 'Team' }],
      basedOn: { library: 'scrum', entry: 'developer', version: '1' },
    })
  })

  it('say the name an item was given when it came in, where a unit type was put then, and beside it the entries a bring-in matched it to', async () => {
    const matched = { library: 'safe', entry: 'agile-release-train', version: '6.0', language: 'en' }
    const recorded: HostModel = {
      ...organisation,
      unitTypes: [
        { ...organisation.unitTypes![0], alsoBasedOn: [matched] },
        {
          ...organisation.unitTypes![1],
          basedOn: { library: 'scrum', entry: 'scrum-team', version: '1', language: 'nl', name: 'Team', placed: { top: false, within: ['ut-train'] } },
        },
      ],
      roles: organisation.roles!.map((role) => (role.id === 'ro-po' ? { ...role, alsoBasedOn: [{ library: 'scrum', entry: 'product-owner', version: '1', language: 'en' }] } : role)),
    }
    const types = parsed(await ask('unitTypes.list', {}, session('', recorded))).unitTypes as Record<string, unknown>[]
    expect(types.map((one) => [one.id, one.basedOn, one.alsoBasedOn])).toEqual([
      ['ut-train', undefined, [{ library: 'safe', entry: 'agile-release-train', version: '6.0' }]],
      ['ut-team', { library: 'scrum', entry: 'scrum-team', version: '1', name: 'Team', placed: { within: [{ id: 'ut-train', name: 'Train' }] } }, undefined],
    ])
    const roles = parsed(await ask('roles.list', {}, session('', recorded))).roles as Record<string, unknown>[]
    expect(roles.map((one) => [one.id, one.basedOn, one.alsoBasedOn])).toEqual([
      ['ro-lead', undefined, undefined],
      ['ro-po', undefined, [{ library: 'scrum', entry: 'product-owner', version: '1' }]],
      ['ro-dev', { library: 'scrum', entry: 'developer', version: '1' }, undefined],
    ])
  })

  it('narrow the roles to a unit type or a responsibility, and refuse one that is not there', async () => {
    const on = session('', organisation)
    const ids = (out: AgentAnswer) => (parsed(out).roles as { id: string }[]).map((role) => role.id)
    expect(ids(await ask('roles.list', { unitTypeId: 'ut-team' }, on))).toEqual(['ro-po', 'ro-dev'])
    expect(ids(await ask('roles.list', { responsibilityId: 'rs-plan' }, on))).toEqual(['ro-lead', 'ro-po'])
    expect(refusal(await ask('roles.list', { unitTypeId: 'nope' }, on))).toEqual(['agent.unknownId', 'unit type nope'])
    expect(refusal(await ask('roles.list', { responsibilityId: 'nope' }, on))).toEqual(['agent.unknownId', 'responsibility nope'])
  })

  it('say every role\'s part in a responsibility, and the finding where it is not one role\'s A', async () => {
    const out = parsed(await ask('responsibilities.list', { group: 'Deliver' }, session('', organisation)))
    expect(out.responsibilities).toEqual([
      {
        id: 'rs-order', name: 'Order the backlog', group: 'Deliver',
        raci: [{ roleId: 'ro-po', role: 'Product owner', raci: 'A' }, { roleId: 'ro-dev', role: 'Developer', raci: 'C' }],
        accountable: [{ id: 'ro-po', name: 'Product owner' }],
      },
      { id: 'rs-run', name: 'Run it', group: 'Deliver', raci: [], accountable: [], finding: 'nobody is accountable' },
    ])
    const plan = (parsed(await ask('responsibilities.list', {}, session('', organisation))).responsibilities as Record<string, unknown>[])[1]
    expect(plan.finding).toBe('2 roles are accountable')
  })

  it('say so where there is no organisation to read', async () => {
    const lost = { ...session('retail', landscape), tree: { ...tree(), read: async () => undefined } }
    expect(refusal(await ask('unitTypes.list', {}, lost))).toEqual(['agent.unknownScope', 'the organisation'])
    expect(refusal(await ask('unitTypes.list', { nonsense: 1 }, session('', organisation)))?.[0]).toBe('agent.badArguments')
  })
})

describe('the operating model\'s four writes', () => {
  it('add a unit type at the top where nothing it sits in is named, as the agent\'s step', async () => {
    const on = session('', organisation)
    const out = parsed(await ask('unitType.add', { name: ' Platform team ', slots: [{ roleId: 'ro-dev', min: 2 }], limit: 2 }, on))
    expect(out).toMatchObject({ id: 'ut-new-1', name: 'Platform team', top: true, slots: [{ roleId: 'ro-dev', role: 'Developer', min: 2 }], limit: 2 })
    expect(on.sent.at(-1)).toMatchObject({ type: 'unitType.add', origin: 'agent' })
    expect(toArrays(on.model()).unitTypes?.at(-1)).toEqual({ id: 'ut-new-1', name: 'Platform team', top: true, within: [], slots: [{ role: 'ro-dev', min: 2 }], limit: 2 })
  })

  it('change a unit type: the place, the slots, and null clearing the limit', async () => {
    const on = session('', organisation)
    const out = parsed(await ask('unitType.update', { id: 'ut-team', top: true, within: [], limit: null, slots: [{ roleId: 'ro-po', min: 1, max: 1 }] }, on))
    expect(out).toMatchObject({ id: 'ut-team', top: true, within: [], slots: [{ roleId: 'ro-po', min: 1, max: 1 }] })
    expect('limit' in out).toBe(false)
    expect(on.model().unitTypes?.['ut-team']).toEqual({ id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-po', min: 1, max: 1 }] })
  })

  it('set where a unit type stands in its lane, and null takes it away', async () => {
    const on = session('', organisation)
    expect(parsed(await ask('unitType.update', { id: 'ut-train', order: 2 }, on))).toMatchObject({ id: 'ut-train', lane: 1, order: 2 })
    expect(on.model().unitTypes?.['ut-train'].order).toBe(2)
    const cleared = parsed(await ask('unitType.update', { id: 'ut-train', order: null }, on))
    expect('order' in cleared).toBe(false)
    expect('order' in on.model().unitTypes!['ut-train']).toBe(false)
  })

  it('refuse what names nothing the organisation holds, or says nothing sensible', async () => {
    const on = session('', organisation)
    expect(refusal(await ask('unitType.add', { name: '  ' }, on))).toEqual(['agent.badArguments', '"name" must not be blank'])
    expect(refusal(await ask('unitType.add', { name: 'X', within: ['nope'] }, on))).toEqual(['agent.unknownId', 'within: unit type nope'])
    expect(refusal(await ask('unitType.add', { name: 'X', slots: [{ roleId: 'nope', min: 1 }] }, on))).toEqual(['agent.unknownId', 'slots[0]: role nope'])
    expect(refusal(await ask('unitType.add', { name: 'X', slots: [{ roleId: 'ro-po', min: 3, max: 1 }] }, on))?.[0]).toBe('agent.badArguments')
    expect(refusal(await ask('unitType.update', { id: 'ut-team', within: ['ut-team'] }, on))).toEqual(['agent.badArguments', 'a unit type cannot sit in itself'])
    expect(refusal(await ask('unitType.update', { id: 'nope', name: 'X' }, on))).toEqual(['agent.unknownId', 'unit type nope'])
    expect(refusal(await ask('role.add', { name: 'X', duties: [{ responsibilityId: 'nope', raci: 'A' }] }, on))).toEqual(['agent.unknownId', 'duties[0]: responsibility nope'])
    expect(refusal(await ask('role.add', { name: 'X', duties: [{ responsibilityId: 'rs-run', raci: 'A' }, { responsibilityId: 'rs-run', raci: 'R' }] }, on))?.[0]).toBe('agent.badArguments')
    expect(refusal(await ask('role.add', { name: 'X', duties: [{ responsibilityId: 'rs-run', raci: 'X' }] }, on))?.[0]).toBe('agent.badArguments')
    expect(refusal(await ask('role.update', { id: 'nope' }, on))).toEqual(['agent.unknownId', 'role nope'])
    expect(on.sent).toEqual([])
  })

  it('add and change a role, its duties replacing the list and null taking text away', async () => {
    const on = session('', organisation)
    const added = parsed(await ask('role.add', { name: 'Coach', short: 'C', manages: true, duties: [{ responsibilityId: 'rs-run', raci: 'A' }] }, on))
    expect(added).toMatchObject({ id: 'ro-new-1', name: 'Coach', manages: true, duties: [{ responsibilityId: 'rs-run', responsibility: 'Run it', raci: 'A' }], heldIn: [] })
    const changed = parsed(await ask('role.update', { id: 'ro-po', short: null, manages: true, duties: [{ responsibilityId: 'rs-order', raci: 'A' }] }, on))
    expect(changed).toMatchObject({ id: 'ro-po', name: 'Product owner', manages: true, duties: [{ responsibilityId: 'rs-order', raci: 'A' }] })
    expect(on.model().roles?.['ro-po']).toEqual({ id: 'ro-po', name: 'Product owner', manages: true, duties: [{ responsibility: 'rs-order', raci: 'A' }] })
    // The rest of the lists see it at once.
    const plan = (parsed(await ask('responsibilities.list', {}, on)).responsibilities as Record<string, unknown>[])[1]
    expect(plan.finding).toBeUndefined()
  })

  it('date a role and a unit type and name what follows each, and take either away with null (ADR-0036 §6)', async () => {
    const on = session('', organisation)
    const role = parsed(await ask('role.update', { id: 'ro-lead', until: '2026-12-31', successors: ['ro-po', 'ro-po'] }, on))
    expect(role).toMatchObject({ until: '2026-12-31', successors: [{ id: 'ro-po', name: 'Product owner' }] })
    expect(on.model().roles?.['ro-lead']).toMatchObject({ until: '2026-12-31', successors: ['ro-po'] })
    const type = parsed(await ask('unitType.update', { id: 'ut-team', from: '2025-01-01', successors: ['ut-train'] }, on))
    expect(type).toMatchObject({ from: '2025-01-01', successors: [{ id: 'ut-train', name: 'Train' }] })
    parsed(await ask('role.update', { id: 'ro-lead', until: null, successors: null }, on))
    expect(on.model().roles?.['ro-lead']).not.toHaveProperty('until')
    expect(on.model().roles?.['ro-lead']).not.toHaveProperty('successors')
    expect(refusal(await ask('role.update', { id: 'ro-lead', until: 'soon' }, on))).toEqual(['agent.badArguments', '"until" must be yyyy-mm-dd'])
    expect(refusal(await ask('unitType.update', { id: 'ut-team', until: '2024-12-31' }, on))).toEqual(['agent.badArguments', '"until" must not be before "from"'])
    expect(refusal(await ask('role.update', { id: 'ro-lead', successors: ['ro-lead'] }, on))).toEqual(['agent.badArguments', 'nothing follows itself'])
    expect(refusal(await ask('role.add', { name: 'X', successors: ['ut-team'] }, on))).toEqual(['agent.unknownId', 'successors: ut-team'])
  })

  it('are made at the organisation only', async () => {
    const elsewhere = session('retail', landscape)
    for (const [tool, args] of [['unitType.add', { name: 'X' }], ['role.add', { name: 'X' }], ['role.update', { id: 'ro-po', name: 'X' }]] as const) {
      expect(refusal(await ask(tool, args, elsewhere))?.[0], tool).toBe('agent.scopeNotOpen')
    }
    // Asking for the organisation by name while another scope is open is the
    // same answer every write gives for a scope that is not open.
    expect(refusal(await ask('unitType.add', { name: 'X', scope: '' }, elsewhere))?.[0]).toBe('agent.scopeNotOpen')
    expect(elsewhere.sent).toEqual([])
  })
})

describe('the operating model\'s page, as a place', () => {
  /** A shell whose screen is wherever it was last sent. */
  function shell(): ShellView & { sent: Destination[] } {
    let screen: Screen = { home: { path: 'retail', name: 'Retail' } }
    const sent: Destination[] = []
    return {
      sent,
      tree: tree(),
      screen: () => screen,
      open: (to) => {
        sent.push(to)
        screen = { open: { path: to.scope, name: 'Acme Logistics' }, page: { page: 'operating', ...(to.id !== undefined ? { id: to.id } : {}) } }
      },
      client: () => 'test',
      driving: { current: () => ({}) } as unknown as ShellView['driving'],
    }
  }

  it('opens at the organisation, on an item where one is named, whatever scope is up', async () => {
    const app = shell()
    const out = parsed(await openApp({ page: 'operating', id: 'ro-po' }, undefined, app))
    expect(app.sent).toEqual([{ scope: '', page: 'operating', id: 'ro-po' }])
    expect(out.page).toEqual({ page: 'operating', id: 'ro-po' })
    expect(refusal(await openApp({ page: 'operating', id: 'nope' }, undefined, app))?.[0]).toBe('agent.unknownId')
  })

  it('is refused anywhere but the organisation', async () => {
    expect(refusal(await openApp({ page: 'operating', scope: 'retail' }, undefined, shell()))?.[0]).toBe('agent.badArguments')
  })

  it('has arrived, landed and is a place the history keeps', () => {
    const up: Screen = { open: { path: '', name: 'Acme Logistics' }, page: { page: 'operating', id: 'ro-po' } }
    expect(arrived(up, { page: 'operating' }, '')).toBe(true)
    expect(arrived(up, { page: 'operating', id: 'ro-po' }, '')).toBe(true)
    expect(arrived(up, { page: 'operating', id: 'ro-dev' }, '')).toBe(false)
    expect(landed(up, { scope: '', page: 'operating' })).toBe(true)
    expect(placeOf(up)).toEqual({ scope: '', page: 'operating', id: 'ro-po' })
    // An item that is gone lands on the page without it.
    expect(nearestPlace({ scope: '', page: 'operating', id: 'gone' }, { scopeIs: () => true, holds: () => false }))
      .toEqual({ scope: '', page: 'operating' })
  })
})
