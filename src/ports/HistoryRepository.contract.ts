// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every history repository must do — written once, run by all of them.
 *
 * Written for a history of any length: every clause that reads a list reads
 * it in pages, a thing's history is asked of the repository rather than
 * worked out by reading every entry, and the state at an entry is asked by
 * the entry. A clause makes entries with `record`, as a person's *Snapshot*
 * does, and the maker keeps anything else from closing one while the suite
 * runs (`RepositoriesUnderTest`).
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import type { EntriesWanted, HistoryEntry, HistoryRepository } from './HistoryRepository'
import type { ScopeCommand, ScopeId } from '../projects/scopeState'
import { addCrews, addDepot, held, ok, over, refusal, renameCrews, step } from './Repositories.contract'
import type { MakeRepositories } from './Repositories.contract'

/** Every entry the history answers, page by page, `size` at a time. */
async function everyEntry(history: HistoryRepository, wanted: EntriesWanted, size = 2): Promise<HistoryEntry[]> {
  const found: HistoryEntry[] = []
  let after: string | undefined
  for (let pages = 0; pages < 100; pages += 1) {
    const page = await history.entries({ ...wanted, limit: size, ...(after !== undefined ? { after } : {}) })
    expect(page.entries.length).toBeLessThanOrEqual(size)
    found.push(...page.entries)
    if (page.next === undefined) return found
    after = page.next
  }
  throw new Error('a history that never ends')
}

/** Newest first: never an entry older than the one after it. */
function newestFirst(entries: readonly HistoryEntry[]): boolean {
  return entries.every((entry, at) => at === 0 || entries[at - 1].at >= entry.at)
}

export function describeHistoryRepository(name: string, make: MakeRepositories): void {
  describe(`HistoryRepository contract — ${name}`, () => {
    const fresh = async () => over(await make())

    /** A scope with an entry per command, one record after each, newest last. */
    async function withEntries(...runs: ScopeCommand[]) {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      await repositories.record('created')
      for (const [at, command] of runs.entries()) {
        await repositories.steps(acme, command)
        await repositories.record(`step ${at + 1}`)
      }
      return { repositories, acme }
    }

    it('names itself', async () => {
      const { history } = await fresh()
      expect(history.id).toMatch(/\S/)
    })

    it('records what the steps did as an entry, whose state is the one read then', async () => {
      const { repositories, acme } = await withEntries(addCrews)
      const now = await repositories.state(acme)
      const [newest] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
      expect(newest.scope).toBe(acme)
      expect(typeof newest.by).toBe('string')
      expect(newest.labels).toEqual([])
      expect(held(await repositories.history.stateAt(acme, newest.id))).toEqual(held(now))
    })

    it('answers the entries a record made, with the subject it was given', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      await repositories.record()
      await repositories.steps(acme, addCrews)
      const made = await repositories.record('Crews added')
      expect(made.map((entry) => [entry.scope, entry.subject])).toEqual([[acme, 'Crews added']])
      const [newest] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
      expect(newest).toEqual(made[0])
    })

    it('records only the scopes it is asked to, and leaves the others’ entries open', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      const globex = await repositories.scope('globex', 'Globex')
      await repositories.record()
      await repositories.steps(acme, addCrews)
      await repositories.steps(globex, addDepot)
      const theirs = (await everyEntry(repositories.history, { scopes: [globex] })).length
      const made = await repositories.history.record({ scopes: [acme], subject: 'Before the replace' })
      expect(made.map((entry) => entry.scope)).toEqual([acme])
      expect(await everyEntry(repositories.history, { scopes: [globex] })).toHaveLength(theirs)
      const later = await repositories.record('Later')
      expect(later.map((entry) => entry.scope)).toEqual([globex])
      expect((await repositories.history.stateAt(globex, later[0].id))?.model.elements.map((one) => one.id)).toEqual(['depot'])
    })

    it('makes no entry where nothing changed since the last, and says so', async () => {
      const { repositories, acme } = await withEntries(addCrews)
      const before = await everyEntry(repositories.history, { scopes: [acme] })
      expect(await repositories.record('nothing')).toEqual([])
      expect(await everyEntry(repositories.history, { scopes: [acme] })).toEqual(before)
    })

    it('makes no entry for a step that changes nothing', async () => {
      const { repositories, acme } = await withEntries(addCrews)
      const before = await everyEntry(repositories.history, { scopes: [acme] })
      await repositories.steps(acme, { type: 'element.update', id: 'crews', patch: { name: 'Crews' } })
      expect(await repositories.record('nothing')).toEqual([])
      expect(await everyEntry(repositories.history, { scopes: [acme] })).toEqual(before)
    })

    it('answers entries newest first, in pages that cover every one once', async () => {
      const { repositories, acme } = await withEntries(addCrews, addDepot, renameCrews,
        { type: 'element.update', id: 'depot', patch: { name: 'Depot planning' } })
      const all = await everyEntry(repositories.history, { scopes: [acme] })
      expect(all.length).toBeGreaterThanOrEqual(4)
      expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length)
      expect(newestFirst(all)).toBe(true)
      expect(await everyEntry(repositories.history, { scopes: [acme] }, 3)).toEqual(all)
      const names = async (entry: HistoryEntry) =>
        (await repositories.history.stateAt(acme, entry.id))?.model.elements.map((element) => element.name)
      expect(await names(all[0])).toEqual(['Crew planning', 'Depot planning'])
      expect(await names(all[1])).toEqual(['Crew planning', 'Depot'])
      expect(await names(all[2])).toEqual(['Crews', 'Depot'])
      expect(await names(all[3])).toEqual(['Crews'])
    })

    it('answers a thing’s history: the entries with a step that wrote it, and no others', async () => {
      const { repositories, acme } = await withEntries(addCrews, addDepot, renameCrews,
        { type: 'element.update', id: 'depot', patch: { name: 'Depot planning' } })
      const crews = await everyEntry(repositories.history, { scopes: [acme], record: { kind: 'element', id: 'crews' } })
      expect(crews).toHaveLength(2)
      const states = await Promise.all(crews.map((entry) => repositories.history.stateAt(acme, entry.id)))
      expect(states.map((state) => state?.model.elements.find((element) => element.id === 'crews')?.name))
        .toEqual(['Crew planning', 'Crews'])
      expect(await everyEntry(repositories.history, { scopes: [acme], record: { kind: 'decision', id: 'adr-1' } })).toEqual([])
    })

    /**
     * Deleting an element takes the relations that end on it: the relation's
     * history ends with the entry that removed it, though the step named only
     * the element.
     */
    it('answers a thing’s history with the entries whose steps reached it without naming it', async () => {
      const { repositories, acme } = await withEntries(addCrews, addDepot,
        { type: 'relation.create', relation: { id: 'r1', type: 'flow', sourceId: 'crews', targetId: 'depot', isBidirectional: false } },
        { type: 'element.delete', id: 'depot' })
      const relation = await everyEntry(repositories.history, { scopes: [acme], record: { kind: 'relation', id: 'r1' } })
      expect(relation).toHaveLength(2)
      expect((await repositories.history.stateAt(acme, relation[0].id))?.model.relations).toEqual([])
    })

    it('answers a thing’s history across the scopes that hold it, merged newest first', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      const globex = await repositories.scope('globex', 'Globex')
      await repositories.steps(acme, addCrews)
      await repositories.record()
      await repositories.steps(globex, addCrews)
      await repositories.record()
      await repositories.steps(acme, renameCrews)
      await repositories.record()
      const both = await everyEntry(repositories.history, { scopes: [acme, globex], record: { kind: 'element', id: 'crews' } })
      expect(both.map((entry) => entry.scope)).toEqual([acme, globex, acme])
      expect(newestFirst(both)).toBe(true)
    })

    it('keeps each scope’s entries to itself', async () => {
      const repositories = await fresh()
      const acme = await repositories.scope('acme', 'Acme Logistics')
      const globex = await repositories.scope('globex', 'Globex')
      await repositories.steps(globex, addDepot)
      await repositories.record()
      const mine = await everyEntry(repositories.history, { scopes: [acme] })
      expect(mine.every((entry) => entry.scope === acme)).toBe(true)
      const theirs = await everyEntry(repositories.history, { scopes: [globex] })
      expect(theirs.length).toBeGreaterThan(0)
      expect(await repositories.history.stateAt(acme, theirs[0].id)).toBeUndefined()
    })

    it('follows a scope through a move: its entries stay its own, and read as they were', async () => {
      const { repositories, acme } = await withEntries(addCrews)
      const before = await everyEntry(repositories.history, { scopes: [acme] })
      ok(await repositories.move(acme, 'globex/acme'))
      await repositories.steps(acme, addDepot)
      await repositories.record()
      const after = await everyEntry(repositories.history, { scopes: [acme] })
      expect(after.slice(1).map((entry) => entry.id)).toEqual(before.map((entry) => entry.id))
      expect((await repositories.history.stateAt(acme, before[0].id))?.model.elements.map((element) => element.id)).toEqual(['crews'])
    })

    it('follows the scopes under a moved one too: each keeps its entries, and reads them as they were', async () => {
      const repositories = await fresh()
      const rail = await repositories.scope('acme/rail', 'Rail')
      const stock = await repositories.scope('acme/rail/rolling-stock', 'Rolling stock')
      await repositories.steps(stock, addCrews)
      await repositories.record('before the move')
      const before = await everyEntry(repositories.history, { scopes: [stock] })
      ok(await repositories.move(rail, 'globex/rail'))
      const after = await everyEntry(repositories.history, { scopes: [stock] })
      expect(after.map((entry) => entry.id)).toEqual(expect.arrayContaining(before.map((entry) => entry.id)))
      const [newest] = before
      expect((await repositories.history.stateAt(stock, newest.id))?.model.elements.map((element) => element.id)).toEqual(['crews'])
    })

    it('starts a scope created where a removed one was with a history of its own', async () => {
      const { repositories, acme } = await withEntries(addCrews)
      const old = await everyEntry(repositories.history, { scopes: [acme] })
      ok(await repositories.remove(acme))
      const again = await repositories.scope('acme', 'Acme again')
      const fresh = await everyEntry(repositories.history, { scopes: [again] })
      expect(fresh.map((entry) => entry.id)).not.toEqual(expect.arrayContaining(old.map((entry) => entry.id)))
    })

    it('starts a scope created under a removed one’s address with none of the entries of the scopes that were under it', async () => {
      const repositories = await fresh()
      await repositories.scope('acme', 'Acme Logistics')
      const rail = await repositories.scope('acme/rail', 'Rail')
      await repositories.steps(rail, addCrews)
      await repositories.record('rail')
      const old = await everyEntry(repositories.history, { scopes: [rail] })
      ok(await repositories.remove(await repositories.scopeAt('acme')))
      const again = await repositories.scope('acme/rail', 'Rail again')
      const mine = await everyEntry(repositories.history, { scopes: [again] })
      expect(mine.map((entry) => entry.id)).not.toEqual(expect.arrayContaining(old.map((entry) => entry.id)))
      for (const entry of old) expect(await repositories.history.stateAt(again, entry.id)).toBeUndefined()
    })

    it('answers nothing for an entry the scope does not have', async () => {
      const { repositories, acme } = await withEntries(addCrews)
      expect(await repositories.history.stateAt(acme, 'no such entry')).toBeUndefined()
    })

    it('refuses a step that expects a past state’s revision once the scope has moved on', async () => {
      const { repositories, acme } = await withEntries(addCrews, addDepot)
      const [, older] = (await repositories.history.entries({ scopes: [acme], limit: 2 })).entries
      const past = await repositories.history.stateAt(acme, older.id)
      expect(refusal(await repositories.apply([{ scope: acme, steps: [step(renameCrews)], expects: past!.revision }])))
        .toBe('shell.scopeMoved')
    })

    it('goes back by a step, which adds an entry and takes none away', async () => {
      const { repositories, acme } = await withEntries(addCrews, renameCrews)
      const before = await everyEntry(repositories.history, { scopes: [acme] })
      await repositories.steps(acme, { type: 'element.update', id: 'crews', patch: { name: 'Crews' } })
      await repositories.record('back to how it was')
      const after = await everyEntry(repositories.history, { scopes: [acme] })
      expect(after).toHaveLength(before.length + 1)
      expect(after.slice(1).map((entry) => entry.id)).toEqual(before.map((entry) => entry.id))
    })

    describe('labels', () => {
      it('marks an entry, and the mark is read with it', async () => {
        const { repositories, acme } = await withEntries(addCrews)
        const [newest] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
        expect(await repositories.history.label(acme, newest.id, 'Shown to the board')).toBe('done')
        const [marked] = (await repositories.history.entries({ scopes: [acme], limit: 1 })).entries
        expect(marked.id).toBe(newest.id)
        expect(marked.labels).toEqual(['Shown to the board'])
      })

      it('refuses a label the scope has, one that says nothing, and an entry it does not have', async () => {
        const { repositories, acme } = await withEntries(addCrews, addDepot)
        const [newest, older] = (await repositories.history.entries({ scopes: [acme], limit: 2 })).entries
        expect(await repositories.history.label(acme, newest.id, 'Shown to the board')).toBe('done')
        expect(await repositories.history.label(acme, older.id, 'shown to the BOARD!')).toBe('exists')
        expect(await repositories.history.label(acme, older.id, '!!!')).toBe('unnamed')
        expect(await repositories.history.label(acme, 'no such entry', 'Later')).toBe('gone')
      })

      it('keeps a scope’s labels its own: another scope may use the same one', async () => {
        const repositories = await fresh()
        const ids: ScopeId[] = []
        for (const address of ['acme', 'globex']) {
          const id = await repositories.scope(address, address)
          await repositories.steps(id, addCrews)
          ids.push(id)
        }
        await repositories.record()
        for (const id of ids) {
          const [newest] = (await repositories.history.entries({ scopes: [id], limit: 1 })).entries
          expect(await repositories.history.label(id, newest.id, 'Baseline')).toBe('done')
        }
      })
    })
  })
}
