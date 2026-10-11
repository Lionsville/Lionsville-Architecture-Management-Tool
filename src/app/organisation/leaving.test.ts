// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Leaving ends a person's assignments (ADR-0036 §10): every one of theirs
 * that runs past their last day ends on it — under their own id and every id
 * merged into it — as one step in each scope that keeps one, the open scope's
 * through its session. Over a tree in memory: the organisation, a customer
 * domain and a shipping domain, Acme Logistics.
 */
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { Assignment } from '../../model/units'
import { forgetPerson, leavePerson, mergePerson } from '../../people/leave'
import type { Repositories } from '../../ports/Repositories'
import { placeWhole, readScope } from '../../projects/scopeAccess'
import { emptyContent } from '../../projects/scopeState'
import { leaveConsequences } from './leaving'
import type { OpenScope } from './leaving'

const as = (id: string, unitId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId: 'ro-dev', person: { person }, ...over,
})

const content = (name: string, over: Partial<HostModel> = {}) => {
  const empty = emptyContent(name)
  return { ...empty, model: { ...empty.model, ...over } }
}

async function tree(): Promise<Repositories> {
  const repositories = memoryRepositories()
  const { scopes, people } = repositories
  await placeWhole(scopes, '', content('Acme'))
  await placeWhole(scopes, 'customer', content('Customer', {
    assignments: [as('as-1', 'webshop', 'pe-femke'), as('as-2', 'webshop', 'pe-bram'), as('as-3', 'mobile', 'pe-old', { from: '2027-01-01' })],
  }))
  await placeWhole(scopes, 'shipping', content('Shipping', {
    assignments: [as('as-1', 'parcel', 'pe-femke', { share: 0.5 }), as('as-2', 'parcel', 'pe-femke', { until: '2026-01-31' })],
  }))
  for (const [name, email] of [['Femke Bos', 'femke@acme.example'], ['Femke Boss', undefined], ['Bram de Wit', undefined]] as const) {
    await people.add({ name, ...(email ? { email } : {}), kind: 'internal' })
  }
  return repositories
}

/** The three entries, by name, and Femke's second entry merged into her first. */
async function entries(repositories: Repositories) {
  const { people } = await repositories.people.list()
  const by = (name: string) => people.find((one) => one.name === name)!.id
  const femke = by('Femke Bos')
  const old = by('Femke Boss')
  await repositories.people.merge(old, femke)
  return { femke, old, bram: by('Bram de Wit') }
}

/** The tree's assignments with the register's ids in place of the names they were placed under. */
async function withIds(repositories: Repositories, ids: Record<string, string>) {
  for (const path of ['customer', 'shipping']) {
    const held = (await readScope(repositories.scopes, path))!
    const assignments = held.model.assignments!.map((one) => ({ ...one, person: { person: ids[one.person.person] ?? one.person.person } }))
    await placeWhole(repositories.scopes, path, { ...content(held.model.name), model: { ...held.model, assignments } })
  }
}

/** An open scope held here: a session's model, changed by the model's own writer. */
function openOver(path: string, start: HostModel): OpenScope & { model: () => Model; dispatched: Command[] } {
  let model = fromArrays(start)
  const dispatched: Command[] = []
  return {
    scopePath: () => path,
    indexed: () => model,
    dispatch: (command) => {
      dispatched.push(command)
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      return model
    },
    model: () => model,
    dispatched,
  }
}

describe('leaving ends a person\'s assignments', () => {
  it('as one step in each scope that keeps one, under every id that is theirs, and says how many it ended', async () => {
    const repositories = await tree()
    const { femke, old, bram } = await entries(repositories)
    await withIds(repositories, { 'pe-femke': femke, 'pe-old': old, 'pe-bram': bram })
    const before = await readScope(repositories.scopes, 'customer')
    const left = await leavePerson(repositories.people, leaveConsequences({ repositories }), femke, '2026-10-31')
    expect(left).toMatchObject({ person: { state: 'left', leftOn: '2026-10-31' }, ended: 3 })
    const customer = (await readScope(repositories.scopes, 'customer'))!
    expect(customer.model.assignments).toEqual([
      as('as-1', 'webshop', femke, { until: '2026-10-31' }), as('as-2', 'webshop', bram),
    ])
    expect(customer.revision).not.toBe(before?.revision)
    const shipping = (await readScope(repositories.scopes, 'shipping'))!
    expect(shipping.model.assignments).toEqual([
      as('as-1', 'parcel', femke, { share: 0.5, until: '2026-10-31' }), as('as-2', 'parcel', femke, { until: '2026-01-31' }),
    ])
  })

  it('writes the open scope\'s part through its session, and the others through the repository', async () => {
    const repositories = await tree()
    const { femke, old, bram } = await entries(repositories)
    await withIds(repositories, { 'pe-femke': femke, 'pe-old': old, 'pe-bram': bram })
    const held = (await readScope(repositories.scopes, 'customer'))!
    const open = openOver('customer', held.model)
    const before = held.revision
    const left = await forgetPerson(repositories.people, leaveConsequences({ repositories, openScope: () => open, origin: 'agent' }), femke, '2026-10-31')
    expect(left).toMatchObject({ ended: 3 })
    expect(open.dispatched).toHaveLength(1)
    expect(open.dispatched[0]).toMatchObject({ type: 'transaction', origin: 'agent' })
    expect((await readScope(repositories.scopes, 'customer'))!.revision).toBe(before)
    expect(open.model().assignments?.['as-1'].until).toBe('2026-10-31')
    expect(open.model().assignments?.['as-3']).toBeUndefined()
  })

  it('marks nobody as left where a scope will not take its part, so the leave can be asked again', async () => {
    const repositories = await tree()
    const { femke, old, bram } = await entries(repositories)
    await withIds(repositories, { 'pe-femke': femke, 'pe-old': old, 'pe-bram': bram })
    const scopes = new Proxy(repositories.scopes, {
      get: (held, key) => (key === 'apply'
        ? () => Promise.resolve({ refused: 'shell.scopeReadOnly' })
        : (Reflect.get(held, key, held) as (...args: unknown[]) => unknown).bind(held)),
    })
    const refusing = { ...repositories, scopes }
    await expect(leavePerson(refusing.people, leaveConsequences({ repositories: refusing }), femke, '2026-10-31'))
      .rejects.toMatchObject({ key: 'shell.scopeReadOnly' })
    expect((await repositories.people.read(femke))?.state).toBe('active')
    expect((await readScope(repositories.scopes, 'customer'))!.model.assignments?.[0].until).toBeUndefined()
    // An open scope that may not be changed refuses it before any other scope is written.
    const held = (await readScope(repositories.scopes, 'customer'))!
    const open = { ...openOver('customer', held.model), blocked: () => 'agent.readOnly' }
    await expect(forgetPerson(repositories.people, leaveConsequences({ repositories, openScope: () => open }), femke, '2026-10-31'))
      .rejects.toMatchObject({ key: 'shell.scopeReadOnly' })
    expect((await repositories.people.read(femke))?.state).toBe('active')
    expect((await readScope(repositories.scopes, 'shipping'))!.model.assignments?.[0].until).toBeUndefined()
    // Asked again where it can be written, it is made.
    expect(await leavePerson(repositories.people, leaveConsequences({ repositories }), femke, '2026-10-31')).toMatchObject({ ended: 3 })
  })

  it('puts a barrier on the open scope\'s part, and has the tree read again where it wrote other scopes', async () => {
    const repositories = await tree()
    const { femke, old, bram } = await entries(repositories)
    await withIds(repositories, { 'pe-femke': femke, 'pe-old': old, 'pe-bram': bram })
    const held = (await readScope(repositories.scopes, 'customer'))!
    const open = openOver('customer', held.model)
    let changed = 0
    await leavePerson(repositories.people, leaveConsequences({ repositories, openScope: () => open, onTreeChanged: () => { changed += 1 } }), femke, '2026-10-31')
    expect(open.dispatched[0]).toMatchObject({ barrier: 'leave.barrier' })
    expect(changed).toBe(1)
  })

  it('ends nothing for someone who holds nothing', async () => {
    const repositories = await tree()
    const { bram } = await entries(repositories)
    const left = await leavePerson(repositories.people, leaveConsequences({ repositories }), bram, '2026-10-31')
    expect(left).toMatchObject({ ended: 0 })
  })
})

/**
 * Somebody active merged into an entry that has left (ADR-0036 §9), told
 * *left*: the absorbed entry's roles end on the leaving day by leaving's own
 * path, the scopes first and the register after — one that ran past it ends on
 * it, one that began after it is taken away and never ended before it began,
 * one already over is left as it was. Told *still here*, no scope moves.
 */
describe('a merge into an entry that has left', () => {
  async function merging() {
    const repositories = memoryRepositories()
    await placeWhole(repositories.scopes, '', content('Acme'))
    const vos = (await repositories.people.add({ name: 'Lea Vos' }))
    const voss = (await repositories.people.add({ name: 'Lea Voss' }))
    if ('refused' in vos || 'refused' in voss) throw new Error('refused')
    await repositories.people.leave(vos.person.id, '2026-03-31')
    await placeWhole(repositories.scopes, 'customer', content('Customer', {
      assignments: [
        as('as-run', 'webshop', voss.person.id, { from: '2025-01-01' }),
        as('as-back', 'webshop', voss.person.id, { from: '2026-06-01' }),
        as('as-over', 'webshop', voss.person.id, { from: '2025-01-01', until: '2025-12-31' }),
      ],
    }))
    return { repositories, kept: vos.person.id, absorbed: voss.person.id }
  }

  it('ends the absorbed entry\'s roles on the leaving day first, takes away one that began after it, and merges after', async () => {
    const { repositories, kept, absorbed } = await merging()
    const merged = await mergePerson(repositories.people, leaveConsequences({ repositories }), absorbed, kept, 'left')
    expect(merged).toMatchObject({ person: { id: kept, state: 'left', leftOn: '2026-03-31' }, ended: 2 })
    const held = (await readScope(repositories.scopes, 'customer'))!.model.assignments!
    expect(held).toEqual([
      as('as-run', 'webshop', absorbed, { from: '2025-01-01', until: '2026-03-31' }),
      as('as-over', 'webshop', absorbed, { from: '2025-01-01', until: '2025-12-31' }),
    ])
    expect(held.every((one) => one.until === undefined || one.from === undefined || one.until >= one.from)).toBe(true)
    expect((await repositories.people.read(absorbed))?.mergedInto).toBe(kept)
  })

  it('moves no scope when told still here, and the person is active again', async () => {
    const { repositories, kept, absorbed } = await merging()
    const before = (await readScope(repositories.scopes, 'customer'))!
    const merged = await mergePerson(repositories.people, leaveConsequences({ repositories }), absorbed, kept, 'stillHere')
    expect(merged).toMatchObject({ person: { id: kept, state: 'active' }, ended: 0 })
    expect((await repositories.people.read(kept))?.leftOn).toBeUndefined()
    expect((await readScope(repositories.scopes, 'customer'))!.revision).toBe(before.revision)
  })
})
