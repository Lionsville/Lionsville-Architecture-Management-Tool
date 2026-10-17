// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's type from the operating model, as the agent reads and follows it
 * (ADR-0036, amended 17 October 2026): `scopes.list` says the type, who
 * serves the scope and how the two stand; a unit's `scopes` written by
 * `element.update` gives each domain the unit's type where the host writes
 * other scopes' headers, and says so either way.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { StepSummary } from '../model/activity'
import type { Command } from '../model/commands'
import type { DesignElement } from '../model'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import type { UnitType } from '../model/operatingModel'
import { apply } from '../model/reducer'
import { handle } from './handle'
import type { SessionView } from './handle'
import { scopeTypesToFollow } from './scopeTypes'
import type { AgentAnswer } from './tools'
import { listScopes } from './tree'
import type { TreeView } from './tree'

const DAY = '2026-10-17'
const types: UnitType[] = [
  { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] },
  { id: 'ut-team', name: 'Team', within: ['ut-domain'], slots: [] },
]
const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const root: HostModel = { name: 'Acme', elements: [actor('ops', 'Operations', { unitTypeId: 'ut-team' })], relations: [], diagrams: [], unitTypes: types, roles: [] }

function tree(): TreeView {
  return {
    scopes: () => [
      { path: '', name: 'Acme', kind: 'organisation', views: 0 },
      { path: 'shipping', name: 'Shipping', unitTypeId: 'ut-team', views: 0 },
      { path: 'parcels', name: 'Parcels', kind: 'domain', views: 0 },
      { path: 'returns', name: 'Returns', unitTypeId: 'ut-gone', views: 0 },
    ],
    lookup: () => undefined,
    register: () => [],
    findings: () => [],
    initiativesBelow: () => [],
    read: async () => undefined,
    units: () => [
      { scope: 'shipping', unit: actor('shipping', 'Shipping', { unitTypeId: 'ut-domain' }) },
      { scope: '', unit: actor('ops', 'Operations', { unitTypeId: 'ut-team' }) },
    ],
    assignments: () => [],
    operatingModel: () => ({ unitTypes: types, roles: [], responsibilities: [], operatingRules: [] }),
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text)
}

describe('scopes.list says each scope\'s type and who serves it', () => {
  it('names the unit type, lists the serving units with theirs, and says how the two stand', () => {
    const { scopes } = parsed(listScopes(tree(), undefined, DAY)) as { scopes: Record<string, unknown>[] }
    expect(scopes.find((one) => one.path === 'shipping')).toEqual({
      path: 'shipping', name: 'Shipping', unitTypeId: 'ut-team', unitType: 'Team', views: 0, open: false,
      servedBy: [{ id: 'shipping', name: 'Shipping', unitTypeId: 'ut-domain', unitType: 'Domain' }], typeLink: 'disagrees',
    })
    expect(scopes.find((one) => one.path === 'parcels')).toMatchObject({ kind: 'domain', servedBy: [], typeLink: 'unsaid' })
    expect(scopes.find((one) => one.path === 'returns')).toMatchObject({ unitTypeId: 'ut-gone', typeLink: 'gone' })
    // The organisation is no domain: nothing serves it, and nothing is said.
    expect(scopes.find((one) => one.path === '')).not.toHaveProperty('typeLink')
  })

  it('works out which domains follow a unit\'s type: not one that says it already, nor the organisation, nor one the tree does not list', () => {
    const follow = scopeTypesToFollow(tree(), { id: 'ops', unitTypeId: 'ut-team' }, ['shipping', 'parcels', '', 'nowhere'], DAY)
    expect([...follow.values()]).toEqual([{ scope: 'parcels', unitTypeId: 'ut-team', unitType: 'Team', set: false }])
    expect(scopeTypesToFollow(tree(), { id: 'ops' }, ['parcels'], DAY).size).toBe(0)
    expect(scopeTypesToFollow(undefined, { id: 'ops', unitTypeId: 'ut-team' }, ['parcels'], DAY).size).toBe(0)
  })
})

function session(over: Partial<SessionView> = {}): SessionView {
  let model: Model = fromArrays(root)
  let counter = 0
  let revision = 0
  const past: { at: number; summary: StepSummary; commands: Command[]; inverse: Command }[] = []
  return {
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => '',
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      past.push({ at: 1, summary: summarise([command], model), commands: [command], inverse: result.inverse })
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => DAY,
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => revision,
    history: () => past,
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    tree: tree(),
    ...over,
  }
}

describe('a unit\'s domains written by the agent give each the unit\'s type', () => {
  it('writes the type through the host where it can, and says which scopes took it', async () => {
    const asked: ReadonlyMap<string, string>[] = []
    const held = session({ followScopeTypes: (follow) => { asked.push(follow); return Promise.resolve([...follow.keys()]) } })
    const out = parsed(await handle({ id: '1', tool: 'element.update', args: { id: 'ops', scopes: ['parcels', 'shipping'] } }, held))
    expect(held.current().elements.find((one) => one.id === 'ops')?.scopes).toEqual(['parcels', 'shipping'])
    expect(asked).toEqual([new Map([['parcels', 'ut-team']])])
    expect(out.scopeTypes).toEqual([{ scope: 'parcels', unitTypeId: 'ut-team', unitType: 'Team', set: true }])
    expect(out).not.toHaveProperty('hint')
  })

  it('names the type not set where the host writes only the scope open, and says where it is set', async () => {
    const out = parsed(await handle({ id: '1', tool: 'element.update', args: { id: 'ops', scopes: ['parcels'] } }, session()))
    expect(out.scopeTypes).toEqual([{ scope: 'parcels', unitTypeId: 'ut-team', unitType: 'Team', set: false }])
    expect(out.hint).toContain('parcels')
    // Nothing to follow: no scopes written, or an actor that is no unit.
    expect(parsed(await handle({ id: '2', tool: 'element.update', args: { id: 'ops', name: 'Ops' } }, session()))).not.toHaveProperty('scopeTypes')
  })
})
