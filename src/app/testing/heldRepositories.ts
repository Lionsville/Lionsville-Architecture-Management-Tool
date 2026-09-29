// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Repositories that hold what a test says, from the first call on.
 *
 * A test writes the scopes it starts from as snapshots, and the app reads them
 * through the repositories (ADR-0031 §4). The memory implementation is the one
 * every suite runs first; what this adds is the scopes put there before any
 * answer is given — each one a content that arrives whole, as an example is
 * copied in — so a test can hand the app repositories and render in the same
 * breath, and every read waits for the scopes rather than racing them.
 */
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { Repositories } from '../../ports/Repositories'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import type { ScopeSnapshot } from '../../projects/scope'
import { contentOf, picturesOf, placeTogether, readScope } from '../../projects/scopeAccess'
import type { ScopePath } from '../../projects/scopePath'

/** The repositories a test was handed, and the scopes they were made to hold, read back as the app reads them. */
export type HeldRepositories = Repositories & {
  /** Every read waits for this: the scopes the test started from, put in place. */
  readonly ready: Promise<void>
  /** A scope as it is kept now, by its address: what a test asks after the app wrote. */
  read(path: ScopePath): Promise<ScopeSnapshot | undefined>
}

/** Every member of one repository, answering only once `ready` has. */
function waiting<T extends object>(held: T, ready: Promise<void>): T {
  return new Proxy(held, {
    get(target, member, receiver) {
      const value = Reflect.get(target, member, receiver) as unknown
      if (typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        await ready
        return (value as (...given: unknown[]) => unknown).apply(target, args)
      }
    },
  })
}

export function heldRepositories(scopes: readonly ScopeSnapshot[] = []): HeldRepositories {
  const held = memoryRepositories()
  const ready: Promise<void> = scopes.length === 0 ? Promise.resolve() : placeTogether(held, scopes.map((scope) => ({
    address: scope.path, content: contentOf(scope, []), pictures: picturesOf(scope.imageLibrary),
  }))).then(() => undefined)
  // A test that seeded something unreadable learns it from its first read.
  ready.catch(() => undefined)
  const repositories: Repositories = {
    scopes: waiting(held.scopes, ready),
    index: waiting(held.index, ready),
    history: waiting(held.history, ready),
    images: waiting(held.images, ready),
    settings: waiting(held.settings, ready),
  }
  return { ...repositories, ready, read: (path) => readScope(repositories.scopes, path) }
}

/**
 * The same repositories with some of what the scopes answer answered by the
 * test: a refusal, a call counted, a write held open.
 */
export function answering(held: HeldRepositories, over: Partial<ScopeRepository>): HeldRepositories {
  const scopes = held.scopes
  const own: ScopeRepository = {
    id: scopes.id,
    tree: () => scopes.tree(),
    state: (id) => scopes.state(id),
    apply: (work) => scopes.apply(work),
    create: (at, scope) => scopes.create(at, scope),
    move: (scope, to, expects) => scopes.move(scope, to, expects),
    remove: (scope, expects) => scopes.remove(scope, expects),
  }
  return { ...held, scopes: { ...own, ...over } }
}
