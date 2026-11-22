// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Command } from '../commands'
import { fromArrays } from '../normalised'
import type { Model } from '../normalised'
import type { Role } from '../operatingModel'
import type { Context } from './handler'
import { plainFamily } from './plain'

// A family of this test's own over a real list, so what is asserted is the
// three moves and not one list's rules: a role may not be called nothing here.
const refused = { ok: false, reason: 'command.titleEmpty' } as const
const asked: string[] = []
const ROLES = plainFamily('roles', {
  fields: {
    name: true, short: true, purpose: true, duties: true, manages: true, reportsTo: true, order: true, basedOn: true, alsoBasedOn: true,
    from: true, until: true, successors: true,
  },
  refuses(_model, role, command, held) {
    asked.push(`${command.type} ${held?.name ?? '-'} → ${role.name}`)
    return role.name === '' ? refused : undefined
  },
})

const context: Context = { meta: { origin: 'agent' }, apply: () => { throw new Error('not made of other commands') } }
const lead: Role = { id: 'lead', name: 'Lead', duties: [] }
const coach: Role = { id: 'coach', name: 'Coach', duties: [] }
const scope = (roles?: Role[]): Model => fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], ...(roles ? { roles } : {}) })

function landed(result: ReturnType<typeof ROLES['role.add']['apply']>): { model: Model; inverse: Command } {
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('the plain three, built for a list', () => {
  it('answers for the three commands of the list’s kind and no other', () => {
    expect(Object.keys(ROLES)).toEqual(['role.add', 'role.update', 'role.remove'])
  })

  it('says what each carries and writes, in the kind’s own words', () => {
    expect(ROLES['role.add'].carries).toEqual({ role: true })
    expect(ROLES['role.update'].carries).toEqual({ id: true, patch: true })
    expect(ROLES['role.remove'].carries).toEqual({ id: true })
    const inner = () => []
    expect(ROLES['role.add'].writes({ type: 'role.add', role: lead }, inner)).toEqual(['role/lead'])
    expect(ROLES['role.update'].writes({ type: 'role.update', id: 'lead', patch: { name: 'Leader', short: 'L' } }, inner)).toEqual(['role/lead/name', 'role/lead/short'])
    expect(ROLES['role.remove'].writes({ type: 'role.remove', id: 'lead' }, inner)).toEqual(['role/lead'])
    expect(ROLES['role.update'].patch.row(scope([lead]), { type: 'role.update', id: 'lead', patch: {} })).toBe(lead)
  })

  it('adds at the end or where it is told, and is undone by the removal', () => {
    const added = landed(ROLES['role.add'].apply(scope([lead]), { type: 'role.add', role: coach, at: 0 }, context))
    expect(added.model.order.roles).toEqual(['coach', 'lead'])
    expect(added.inverse).toEqual({ type: 'role.remove', id: 'coach', origin: 'agent' })
    const last = landed(ROLES['role.add'].apply(scope([lead]), { type: 'role.add', role: coach }, context))
    expect(last.model.order.roles).toEqual(['lead', 'coach'])
  })

  it('patches, and is undone by the patch that names the same keys', () => {
    const before = scope([lead, coach])
    const changed = landed(ROLES['role.update'].apply(before, { type: 'role.update', id: 'lead', patch: { name: 'Leader', short: 'L' } }, context))
    expect(changed.model.roles?.lead).toEqual({ id: 'lead', name: 'Leader', short: 'L', duties: [] })
    expect(changed.model.order).toBe(before.order)
    expect(changed.inverse).toEqual({ type: 'role.update', id: 'lead', patch: { name: 'Lead', short: undefined }, origin: 'agent' })
  })

  it('removes, the last one taking the list with it, and is undone by an add where it stood', () => {
    const removed = landed(ROLES['role.remove'].apply(scope([lead, coach]), { type: 'role.remove', id: 'lead' }, context))
    expect(removed.model.order.roles).toEqual(['coach'])
    expect(removed.inverse).toEqual({ type: 'role.add', role: lead, at: 0, origin: 'agent' })
    const emptied = landed(ROLES['role.remove'].apply(removed.model, { type: 'role.remove', id: 'coach' }, context))
    expect('roles' in emptied.model).toBe(false)
  })

  it('refuses an id that is taken or gone before it asks the family anything', () => {
    asked.length = 0
    expect(ROLES['role.add'].apply(scope([lead]), { type: 'role.add', role: { ...lead, name: '' } }, context)).toEqual({ ok: false, reason: 'command.taken' })
    expect(ROLES['role.update'].apply(scope(), { type: 'role.update', id: 'lead', patch: { name: '' } }, context)).toEqual({ ok: false, reason: 'command.gone' })
    expect(ROLES['role.remove'].apply(scope(), { type: 'role.remove', id: 'lead' }, context)).toEqual({ ok: false, reason: 'command.gone' })
    expect(asked).toEqual([])
  })

  it('asks the family of a record added and of one as its patch would leave it, never of a removal', () => {
    asked.length = 0
    expect(ROLES['role.add'].apply(scope(), { type: 'role.add', role: { id: 'x', name: '', duties: [] } }, context)).toBe(refused)
    expect(ROLES['role.update'].apply(scope([lead]), { type: 'role.update', id: 'lead', patch: { name: '' } }, context)).toBe(refused)
    landed(ROLES['role.remove'].apply(scope([{ id: 'x', name: '', duties: [] }]), { type: 'role.remove', id: 'x' }, context))
    expect(asked).toEqual(['role.add - → ', 'role.update Lead → '])
  })

  it('has the add that undoes a removal carry what the family says it does', () => {
    const cited = plainFamily('citations', { fields: { about: true, principle: true, aspect: true, stance: true, reason: true, on: true }, putBack: { put: true } })
    const citation = { id: 'ci-1', about: { kind: 'observation' as const, id: 'ob-1' }, principle: { scope: '', id: 'pr-1' }, stance: 'holds' as const, on: '2026-10-25' }
    const model = fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], citations: [citation] })
    const removed = landed(cited['citation.remove'].apply(model, { type: 'citation.remove', id: 'ci-1' }, context))
    expect(removed.inverse).toEqual({ type: 'citation.add', citation, at: 0, put: true, origin: 'agent' })
    expect(Object.keys(removed.inverse)).toEqual(['type', 'citation', 'at', 'put', 'origin'])
  })
})
