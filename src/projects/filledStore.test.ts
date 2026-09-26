// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A store with some answers of the caller's own, held to the store's contract.
 *
 * The first case is the reason the helper exists: a copy made from a live store
 * by its prototype calls the store's methods with the copy as `this`, and a
 * store that keeps a private field fails on the first line that reads it. This
 * one calls them as the store.
 */
import { describe, expect, it } from 'vitest'
import { FakeDirectory, refusingReads } from '../adapters/fileSystem/fakeDirectory'
import { FileSystemScopeStore } from '../adapters/fileSystem/FileSystemScopeStore'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { describeScopeStore, sampleScope, SAMPLE_PATH } from '../ports/ScopeStore.contract'
import type { ScopeStore } from '../ports/ScopeStore'
import { filledStore } from './filledStore'
import type { ScopeSnapshot, ScopeSummary } from './scope'
import type { ScopePath } from './scopePath'

/** A store that keeps what it holds where no copy of it can reach. */
class PrivateStore implements ScopeStore {
  readonly id = 'private'
  readonly #held = new InMemoryScopeStore()
  list(): Promise<ScopeSummary> { return this.#held.list() }
  load(path: ScopePath): Promise<ScopeSnapshot | undefined> { return this.#held.load(path) }
  save(scope: ScopeSnapshot): Promise<void> { return this.#held.save(scope) }
  remove(path: ScopePath): Promise<void> { return this.#held.remove(path) }
}

describeScopeStore('a folder store with an index of its own', () => {
  const built = new FileSystemScopeStore(new FakeDirectory())
  return filledStore(built, (store) => ({ models: () => store.models!() }))
}, {
  refusing: () => {
    const held = refusingReads(new FakeDirectory())
    return {
      store: filledStore(new FileSystemScopeStore(held.handle), (store) => ({ models: () => store.models!() })),
      refuse: (path, file) => held.refuse(file === undefined ? undefined : [path, file].filter(Boolean).join('/')),
    }
  },
})

describe('filledStore', () => {
  it('calls the store\'s own members as the store, so a store with private fields still works', async () => {
    const filled = filledStore(new PrivateStore(), () => ({ models: () => Promise.resolve([]) }))
    await filled.save(sampleScope())
    expect((await filled.load(SAMPLE_PATH))?.model.name).toBe('Application landscape')
    expect(await filled.models!()).toEqual([])
  })

  it('answers with the filling where it gave one, and may fall back on the store', async () => {
    const skipped: ScopePath[] = []
    const filled = filledStore(new InMemoryScopeStore(), (built) => ({
      save: (scope) => {
        if (scope.path !== SAMPLE_PATH) return built.save(scope)
        skipped.push(scope.path)
        return Promise.resolve()
      },
    }))

    await filled.save(sampleScope())
    await filled.save({ ...sampleScope(), path: 'elsewhere' })

    expect(skipped).toEqual([SAMPLE_PATH])
    expect(await filled.load(SAMPLE_PATH)).toBeUndefined()
    expect(await filled.load('elsewhere')).toBeDefined()
  })

  /** Absent means something for an optional member, and a stub would say something else. */
  it('leaves an optional member absent where neither the store nor the filling has it', () => {
    const filled = filledStore(new PrivateStore(), () => ({}))
    expect(filled.outdated).toBeUndefined()
    expect(filled.models).toBeUndefined()
    expect(filled.id).toBe('private')
  })

  it('takes the filling\'s word for what the store is called, where it gives one', () => {
    expect(filledStore(new PrivateStore(), () => ({ id: 'over a wire' })).id).toBe('over a wire')
  })
})
