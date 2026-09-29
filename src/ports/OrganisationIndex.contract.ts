// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every organisation index must do — written once, run by all of them.
 *
 * The index is read after every step anybody makes, so what matters most is
 * the question it answers cheaply: what changed since the revision a reader
 * holds. These clauses hold an implementation to the two halves of that — it
 * never leaves out a scope that changed, and it says when it cannot answer
 * rather than answering short.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model/types'
import type { IndexedScope } from './OrganisationIndex'
import type { ScopeId } from '../projects/scopeState'
import { addCrews, addDepot, addLandscape, ok, over, renameCrews } from './Repositories.contract'
import type { MakeRepositories } from './Repositories.contract'

/** An element as the index is allowed to hold it: prose is not what an index is for. */
function withoutProse(element: DesignElement): Omit<DesignElement, 'description'> {
  const { description: _prose, ...rest } = element
  return rest
}

function part(scopes: readonly IndexedScope[], id: ScopeId): IndexedScope | undefined {
  return scopes.find((scope) => scope.id === id)
}

export function describeOrganisationIndex(name: string, make: MakeRepositories): void {
  describe(`OrganisationIndex contract — ${name}`, () => {
    const fresh = async () => over(await make())

    it('names itself', async () => {
      const { index } = await fresh()
      expect(index.id).toMatch(/\S/)
    })

    it('holds the organisation alone on an empty repository', async () => {
      const repositories = await fresh()
      const read = await repositories.index.read()
      expect(read.scopes.map((scope) => [scope.id, scope.address])).toEqual([[await repositories.root(), '']])
      expect(read.scopes[0].model.elements).toEqual([])
    })

    it('holds every scope’s records and rows, where the scope is, as its steps left them', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      const rail = await repositories.scope('acme/rail', 'Rail')
      await repositories.steps(acme, addCrews, renameCrews)
      await repositories.steps(rail, addDepot, addLandscape)
      const read = await repositories.index.read()
      expect(read.scopes.map((scope) => scope.address).sort()).toEqual(['', 'acme', 'acme/rail'])
      const state = await repositories.state(acme)
      expect(part(read.scopes, acme)?.address).toBe('acme')
      expect(part(read.scopes, acme)?.model.elements.map(withoutProse)).toEqual(state.model.elements.map(withoutProse))
      expect(part(read.scopes, rail)?.model.elements.map((element) => element.id)).toEqual(['depot'])
      expect(part(read.scopes, rail)?.model.relations).toEqual([])
    })

    it('answers one revision while nothing changes, and another once a step lands', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      const first = (await repositories.index.read()).revision
      expect((await repositories.index.read()).revision).toBe(first)
      await repositories.steps(acme, addCrews)
      expect((await repositories.index.read()).revision).not.toBe(first)
    })

    it('says nothing changed since the revision it answers now', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      await repositories.steps(acme, addCrews)
      const now = (await repositories.index.read()).revision
      expect(await repositories.index.since(now)).toEqual({ revision: now, changed: [], removed: [] })
    })

    it('names a scope a step changed since a revision, as it is now, and not one nobody touched', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      const globex = await repositories.scope('globex', 'Globex')
      const from = (await repositories.index.read()).revision
      await repositories.steps(acme, addCrews)
      const changes = await repositories.index.since(from)
      expect(changes?.revision).toBe((await repositories.index.read()).revision)
      expect(changes?.changed.map((scope) => scope.id)).toContain(acme)
      expect(changes?.changed.map((scope) => scope.id)).not.toContain(globex)
      expect(part(changes?.changed ?? [], acme)?.model.elements.map((element) => element.id)).toEqual(['crews'])
      expect(changes?.removed).toEqual([])
    })

    it('names a scope created, and every scope a move took somewhere else, at its new address', async () => {
      const repositories = await fresh()
      const from = (await repositories.index.read()).revision
      const rail = await repositories.scope('acme/rail', 'Rail')
      const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
      const created = await repositories.index.since(from)
      expect(created?.changed.map((scope) => scope.id)).toEqual(expect.arrayContaining([rail, stock]))

      const beforeMove = (await repositories.index.read()).revision
      ok(await repositories.move(rail, 'globex/rail'))
      const moved = await repositories.index.since(beforeMove)
      expect(part(moved?.changed ?? [], rail)?.address).toBe('globex/rail')
      expect(part(moved?.changed ?? [], stock)?.address).toBe('globex/rail/rolling-stock')
      expect(part((await repositories.index.read()).scopes, stock)?.address).toBe('globex/rail/rolling-stock')
    })

    it('names every scope removed since a revision, and holds them no longer', async () => {
      const repositories = await fresh()
      const rail = await repositories.scope('acme/rail', 'Rail')
      const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
      const from = (await repositories.index.read()).revision
      ok(await repositories.remove(rail))
      const changes = await repositories.index.since(from)
      expect([...(changes?.removed ?? [])].sort()).toEqual([rail, stock].sort())
      expect(changes?.changed.map((scope) => scope.id)).not.toContain(rail)
      expect((await repositories.index.read()).scopes.map((scope) => scope.id)).not.toContain(stock)
    })

    it('answers nothing for a revision it never gave, rather than a change set that is short', async () => {
      const repositories = await fresh()
      await repositories.scope('acme', 'Acme Logistics')
      expect(await repositories.index.since('a revision nobody was given')).toBeUndefined()
    })
  })
}
