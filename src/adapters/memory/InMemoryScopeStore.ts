// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Scopes in memory. For tests, and for a session that deliberately leaves
 * nothing behind.
 *
 * It copies on the way in and on the way out, and that is the whole reason it
 * exists. A fake store that holds on to the reference lets every
 * accidentally-shared-object bug through: the test passes because caller and
 * store are looking at the same object, and then it falls over in the real
 * adapter, which goes through JSON. Copying makes it exactly as strict.
 */
import { ShellError } from '../../platform/errors'
import { isStoredScope, scopeTree, sortScopes, summarise } from '../../projects/scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { scopeMoved } from '../../projects/revision'
import { isSafeScopePath, isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeStore } from '../../ports/ScopeStore'

export class InMemoryScopeStore implements ScopeStore {
  readonly id = 'memory'
  private held = new Map<ScopePath, ScopeSnapshot>()
  /**
   * Which save each scope is at, as its revision. One counter for the store
   * rather than one per scope, so a scope removed and saved again is never
   * back at a number somebody read before it went.
   */
  private saves = 0
  private readonly revisions = new Map<ScopePath, string>()

  constructor(initial: readonly ScopeSnapshot[] = []) {
    for (const scope of initial) this.keep(scope)
  }

  private keep(scope: ScopeSnapshot, updatedAt?: string): void {
    const { revision: _read, ...held } = structuredClone(scope)
    this.held.set(scope.path, updatedAt ? { ...held, updatedAt } : held)
    this.saves += 1
    this.revisions.set(scope.path, String(this.saves))
  }

  list(): Promise<ScopeSummary> {
    const found = [...this.held.values()].filter(isStoredScope).map(summarise)
    // Alphabetical: see the note in WebStorageScopeStore.
    const root = scopeTree(found)
    return Promise.resolve({ ...root, children: sortScopes(root.children) })
  }

  /**
   * See {@link ScopeStore.models}. This store holds whole snapshots, so there
   * is nothing cheaper to read than what it already has — the saving is in not
   * copying them, which is why the models go out by reference where a `load`
   * clones. Nothing writes to an index, and a test that mutates one of these
   * is mutating the store, which is a bug either way.
   */
  models(): Promise<ScopeModel[]> {
    const found = [...this.held.values()].filter(isStoredScope)
      .map((scope) => ({ path: scope.path, model: scope.model }))
    return Promise.resolve(found)
  }

  /** See {@link ScopeStore.descriptions}. Cheap here; present so the contract exercises the clause. */
  descriptions(path: ScopePath): Promise<Record<string, string> | undefined> {
    if (!isSafeScopePath(path)) return Promise.resolve(undefined)
    const scope = this.held.get(path)
    if (!isStoredScope(scope)) return Promise.resolve(undefined)
    const found: Record<string, string> = {}
    for (const element of scope.model.elements) {
      if (element.description !== undefined) found[element.id] = element.description
    }
    return Promise.resolve(found)
  }

  load(path: ScopePath): Promise<ScopeSnapshot | undefined> {
    if (!isSafeScopePath(path)) return Promise.resolve(undefined)
    const scope = this.held.get(path)
    if (!isStoredScope(scope)) return Promise.resolve(undefined)
    const revision = this.revisions.get(path)
    return Promise.resolve({ ...structuredClone(scope), ...(revision ? { revision } : {}) })
  }

  save(scope: ScopeSnapshot, expects?: string): Promise<void> {
    if (!isSafeScopePath(scope.path)) {
      return Promise.reject(new ShellError('shell.badScopePath', { path: String(scope.path) }))
    }
    if (expects !== undefined && this.revisions.get(scope.path) !== expects) {
      return Promise.reject(scopeMoved(scope.path))
    }
    this.keep(scope, new Date().toISOString())
    return Promise.resolve()
  }

  remove(path: ScopePath): Promise<void> {
    // The root is the folder you opened, not something this app may throw away.
    if (!isSafeScopePath(path) || path === ROOT_SCOPE) return Promise.resolve()
    // And everything filed under it: a child left behind by a removed parent is
    // addressed by nothing.
    for (const held of [...this.held.keys()]) {
      if (isWithinScope(held, path)) {
        this.held.delete(held)
        this.revisions.delete(held)
      }
    }
    return Promise.resolve()
  }
}
