// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model at the writer (ADR-0036): each record added, patched and
 * removed, with the inverse that puts it back, the write key it names, and the
 * line the Activity list says for it.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from '../activity'
import { transaction } from '../commands'
import type { Command } from '../commands'
import { diffModels } from '../diff'
import { fromArrays, toArrays } from '../normalised'
import type { Model } from '../normalised'
import type { Role, UnitType } from '../operating'
import { recordsChanged } from '../recordKey'
import { apply, writesOf } from '../reducer'
import { restoreCommand } from '../restore'

const owner: Role = { id: 'ro-po', name: 'Product owner', duties: [{ responsibility: 'rs-1', raci: 'A' }] }
const team: UnitType = { id: 'ut-team', name: 'Team', within: [], top: true, slots: [{ role: 'ro-po', min: 1, max: 1 }] }

function organisation(over: Partial<Parameters<typeof fromArrays>[0]> = {}): Model {
  return fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], ...over })
}

function applied(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return result.model
}

describe('a unit type, a role, a responsibility and a rule at the writer', () => {
  it('adds a role, and undoing it leaves no list behind', () => {
    const empty = organisation()
    const result = apply(empty, { type: 'role.add', role: owner })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toArrays(result.model).roles).toEqual([owner])
    const undone = apply(result.model, result.inverse)
    expect(undone.ok && undone.model).toStrictEqual(empty)
    expect(undone.ok && 'roles' in toArrays(undone.model)).toBe(false)
  })

  it('refuses a second record on an id that is taken', () => {
    const held = organisation({ roles: [owner] })
    expect(apply(held, { type: 'role.add', role: { ...owner, name: 'Another' } })).toEqual({ ok: false, reason: 'command.taken' })
    expect(apply(held, { type: 'operatingRule.add', rule: { id: 'applicationOwner', role: 'x' } }).ok).toBe(true)
  })

  it('patches a role\'s duties and gives back the ones it had', () => {
    const held = organisation({ roles: [owner] })
    const result = apply(held, { type: 'role.update', id: 'ro-po', patch: { duties: [], manages: true } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.roles?.['ro-po']).toEqual({ ...owner, duties: [], manages: true })
    expect(result.inverse).toEqual({ type: 'role.update', id: 'ro-po', patch: { duties: owner.duties, manages: undefined } })
  })

  it('refuses a field a unit type does not have', () => {
    const held = organisation({ unitTypes: [team] })
    expect(apply(held, { type: 'unitType.update', id: 'ut-team', patch: { colour: 'red' } as never }))
      .toEqual({ ok: false, reason: 'command.notAField' })
  })

  it('removes a record and puts it back where it stood', () => {
    const second: UnitType = { ...team, id: 'ut-2', name: 'Platform' }
    const held = organisation({ unitTypes: [team, second] })
    const result = apply(held, { type: 'unitType.remove', id: 'ut-team' })
    expect(result.ok && result.inverse).toEqual({ type: 'unitType.add', unitType: team, at: 0 })
    const undone = result.ok ? apply(result.model, result.inverse) : result
    expect(undone.ok && undone.model.order.unitTypes).toEqual(['ut-team', 'ut-2'])
  })

  it('answers a record that is gone as gone', () => {
    expect(apply(organisation(), { type: 'responsibility.update', id: 'nope', patch: { name: 'X' } }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })

  it('writes the fields it names, and the whole record where it adds or removes', () => {
    expect(writesOf({ type: 'role.update', id: 'ro-po', patch: { name: 'PO', duties: [] } })).toEqual(['role/ro-po/name', 'role/ro-po/duties'])
    expect(writesOf({ type: 'unitType.add', unitType: team })).toEqual(['unitType/ut-team'])
    expect(writesOf({ type: 'responsibility.remove', id: 'rs-1' })).toEqual(['responsibility/rs-1'])
    expect(writesOf({ type: 'operatingRule.update', id: 'applicationOwner', patch: { role: 'ro-po' } }))
      .toEqual(['operatingRule/applicationOwner/role'])
  })
})

describe('what a step of the operating model is called', () => {
  const held = organisation({ roles: [owner], unitTypes: [team] })

  it('names the record, by the name it had before the step', () => {
    expect(summarise([{ type: 'role.update', id: 'ro-po', patch: { name: 'PO' } }], held))
      .toEqual({ key: 'activity.roleChanged', name: 'Product owner' })
    expect(summarise([{ type: 'unitType.remove', id: 'ut-team' }], held)).toEqual({ key: 'activity.unitTypeRemoved', name: 'Team' })
    expect(summarise([{ type: 'responsibility.add', responsibility: { id: 'rs-2', name: 'Release' } }], held))
      .toEqual({ key: 'activity.responsibilityAdded', name: 'Release' })
    expect(summarise([{ type: 'operatingRule.add', rule: { id: 'domainOwner', role: 'ro-po' } }], held))
      .toEqual({ key: 'activity.operatingRuleChanged' })
  })

  it('says a library brought in as one step, with how many items came', () => {
    const basedOn = { library: 'scrum', entry: 'developers', version: '1', language: 'en' }
    const step = transaction([
      { type: 'responsibility.add', responsibility: { id: 'rs-2', name: 'Build', basedOn } },
      { type: 'role.add', role: { id: 'ro-2', name: 'Developers', duties: [], basedOn } },
    ])
    expect(summarise([step], held)).toEqual({ key: 'activity.broughtIn', count: 2 })
  })
})

describe('the operating model in a version\'s history', () => {
  it('is a record each, in the diff, in what a step touched and in a restore', () => {
    const before = organisation({ roles: [owner] })
    const after = applied(applied(before, { type: 'role.update', id: 'ro-po', patch: { name: 'PO' } }), { type: 'unitType.add', unitType: team })
    expect(recordsChanged(before, after)).toEqual([{ kind: 'unitType', id: 'ut-team' }, { kind: 'role', id: 'ro-po' }])
    expect(diffModels(toArrays(before), toArrays(after)).map((change) => [change.kind, change.what, change.name]))
      .toEqual([['added', 'unitType', 'Team'], ['changed', 'role', 'PO']])
    const back = restoreCommand(before, after, undefined, '2026-10-01')
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(applied(after, back.command)).toStrictEqual({ ...before, order: { ...before.order } })
  })
})
