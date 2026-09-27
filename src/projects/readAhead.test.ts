// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { scopeAt } from '../ports/ScopeStore.contract'
import type { ScopeStore } from '../ports/ScopeStore'
import { modelsAhead } from './readAhead'
import type { ScopeModel } from './scope'

/** A store over memory that counts its reads of the tree. */
function counted(): { store: ScopeStore; models: ReturnType<typeof vi.fn> } {
  const held = new InMemoryScopeStore([scopeAt('acme', 'Acme')])
  const models = vi.fn(async (): Promise<ScopeModel[]> => [{ path: 'acme', model: { elements: [], relations: [] } }])
  const store: ScopeStore = {
    id: held.id,
    list: () => held.list(),
    load: (path) => held.load(path),
    save: (scope, expects) => held.save(scope, expects),
    remove: (path, expects) => held.remove(path, expects),
    models,
  }
  return { store, models }
}

describe('modelsAhead', () => {
  it('starts reading the tree at once, before anybody asks', () => {
    const { store, models } = counted()
    modelsAhead(store)
    expect(models).toHaveBeenCalledTimes(1)
  })

  it('answers the first question with the read already in flight, and the next with a new one', async () => {
    const { store, models } = counted()
    const ahead = modelsAhead(store)
    expect(await ahead.models!()).toHaveLength(1)
    expect(models).toHaveBeenCalledTimes(1)
    await ahead.models!()
    expect(models).toHaveBeenCalledTimes(2)
  })

  it('reads again after a write, rather than answer with the tree before it', async () => {
    const { store, models } = counted()
    const ahead = modelsAhead(store)
    await ahead.save(scopeAt('acme/rail', 'Rail'))
    await ahead.models!()
    expect(models).toHaveBeenCalledTimes(2)
  })

  it('hands a failed read to whoever asks first, and to nobody before', async () => {
    const { store } = counted()
    const failing: ScopeStore = { ...store, models: () => Promise.reject(new Error('the tree would not read')) }
    const ahead = modelsAhead(failing)
    await expect(ahead.models!()).rejects.toThrow('the tree would not read')
  })

  it('leaves a store with no read of the tree exactly as it was', () => {
    const { store } = counted()
    const without: ScopeStore = { ...store, models: undefined }
    expect(modelsAhead(without)).toBe(without)
  })
})
