// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { bareScope } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { isScopeMoved } from '../projects/revision'
import { rewriteScope, REWRITE_TRIES } from './rewriteScope'

/** A store whose scope somebody else saves just before each of the first `times` saves of ours. */
function busy(times: number): { store: InMemoryScopeStore; scopes: Parameters<typeof rewriteScope>[0]; saves: () => number } {
  const store = new InMemoryScopeStore([bareScope('acme', 'Acme', 'domain')])
  let saves = 0
  let theirs = 0
  return {
    store,
    saves: () => saves,
    scopes: {
      load: (path) => store.load(path),
      async save(scope: ScopeSnapshot, expects?: string) {
        saves += 1
        if (theirs < times) {
          theirs += 1
          const held = await store.load(scope.path)
          await store.save({ ...held!, client: `Client ${theirs}` })
        }
        await store.save(scope, expects)
      },
    },
  }
}

const describe_ = (held: ScopeSnapshot | undefined): ScopeSnapshot | undefined =>
  held && { ...held, model: { ...held.model, description: 'Ours' } }

describe('rewriteScope', () => {
  it('writes what was read, changed, when nobody else wrote', async () => {
    const { store, scopes, saves } = busy(0)
    await rewriteScope(scopes, 'acme', describe_)
    expect((await store.load('acme'))?.model.description).toBe('Ours')
    expect(saves()).toBe(1)
  })

  /** The point of it: their save is kept, and ours is made over it rather than instead of it. */
  it('reads again and makes the change again over a scope that moved in between', async () => {
    const { store, scopes, saves } = busy(1)
    await rewriteScope(scopes, 'acme', describe_)
    const back = await store.load('acme')
    expect(back?.client).toBe('Client 1')
    expect(back?.model.description).toBe('Ours')
    expect(saves()).toBe(2)
  })

  it('gives the refusal to the caller once a scope moves under every attempt', async () => {
    const { store, scopes, saves } = busy(REWRITE_TRIES)
    const refused = await rewriteScope(scopes, 'acme', describe_).then(() => undefined, (cause: unknown) => cause)
    expect(isScopeMoved(refused)).toBe(true)
    expect(saves()).toBe(REWRITE_TRIES)
    expect((await store.load('acme'))?.model.description).toBeUndefined()
  })

  it('writes nothing where the change says there is nothing to write', async () => {
    const { scopes, saves } = busy(0)
    await expect(rewriteScope(scopes, 'nowhere', describe_)).resolves.toBeUndefined()
    expect(saves()).toBe(0)
  })
})
