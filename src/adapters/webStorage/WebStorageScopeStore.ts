/**
 * Scopes in the browser's storage, one key each.
 *
 * One key per scope rather than one blob holding all of them: the blob would
 * have to be rewritten in full on every autosave, and a quota failure while
 * saving one scope would take every other scope down with it. Separate keys
 * mean a scope can only ever damage itself.
 *
 * The key is the address itself (`lvarch.scope.<path>`), so `list()` is a
 * prefix scan and a store that keeps scopes in folders uses the same string as
 * its path. The root's path is empty, so the root's key is the bare prefix —
 * which is exactly right: a tab has one working tree, and that is its root.
 *
 * **Corrupt storage is a skipped entry, not an error.** Half-written JSON, a key
 * from an older version, something a human edited by hand: there is nothing the
 * user can do about it, and refusing to show the rest of their projects would be
 * a worse answer. What *does* reject is a write that fails — full, private mode,
 * strict policy — because then everything keeps working until the tab closes,
 * and somebody needs to know.
 */
import { ShellError } from '../../platform/errors'
import { isBeforeFormat4, migrateModel } from '../../projects/migrate3to4'
import { isStoredScope, scopeTree, sortScopes, summarise } from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { isSafeScopePath, isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeStore, StoragePressure } from '../../ports/ScopeStore'
import type { KeyValueStorage } from './KeyValueStorage'

/**
 * The prefix every scope key carries.
 *
 * `lvarch`, not a customer's name. It used to carry one — invisible to
 * anyone using the tool, and therefore the last place the old assumption could
 * sit unchallenged. Renaming it strands whatever is already in a browser under
 * the old prefix; that is a deliberate call taken with the rename, on the
 * grounds that the working file is the durable artefact
 * and a migration for a tool still in development outlives its usefulness by
 * years.
 */
export const SCOPE_PREFIX = 'lvarch.scope.'

/**
 * What this store will hold, near enough.
 *
 * The origin quota for browser storage is customarily five megabytes, counted
 * by most browsers in UTF-16 code units — so about two and a half million
 * characters, and characters are what this counts. An estimate on purpose: the
 * real limit is the browser's, nothing exposes it, and a number that is a
 * little pessimistic warns slightly early, which is the right direction to be
 * wrong in.
 *
 * The quota is shared with everything else on the origin — the preferences,
 * whatever a future feature keeps here — so what this counts is
 * a floor on the usage rather than the whole of it.
 */
export const STORAGE_BUDGET_CHARS = 2_500_000

/** Where a warning is worth giving: enough room left to finish the afternoon. */
export const STORAGE_WARNING_FRACTION = 0.8

export class WebStorageScopeStore implements ScopeStore {
  readonly id = 'browser-storage'

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly prefix: string = SCOPE_PREFIX,
  ) {}

  private keyFor(path: ScopePath): string {
    return `${this.prefix}${path}`
  }

  /**
   * What each of our keys costs, so the total is arithmetic rather than a scan.
   *
   * Filled once, on the first save, by reading what is already there; from then
   * on a save updates one entry. The alternative — reading every scope back
   * on every autosave to add up its length — is several megabytes of string
   * copying every three seconds, to answer a question whose answer barely
   * moves.
   *
   * A key another tab wrote is therefore missing from this until this store next
   * lists or reads it, which makes the total a floor. That is the right
   * direction for a warning to be wrong in, and the same direction as the budget
   * itself.
   */
  private held: Map<string, number> | undefined

  private sizes(): Map<string, number> {
    if (this.held) return this.held
    const sizes = new Map<string, number>()
    try {
      for (const key of this.ourKeys()) sizes.set(key, this.storage.getItem(key)?.length ?? 0)
    } catch {
      // A storage that will not enumerate cannot be measured either; an empty
      // map means "nothing known yet", which reads as no pressure.
    }
    this.held = sizes
    return sizes
  }

  private ourKeys(): string[] {
    return this.storage.keys().filter((key) => key.startsWith(this.prefix))
  }

  /** See {@link ScopeStore.pressure}. */
  pressure(): StoragePressure | undefined {
    let used = 0
    for (const size of this.sizes().values()) used += size
    return { used, budget: STORAGE_BUDGET_CHARS }
  }

  /** One stored record, or `undefined` when it is missing or unreadable. */
  private read(key: string): ScopeSnapshot | undefined {
    let parsed: unknown
    try {
      const raw = this.storage.getItem(key)
      if (!raw) return undefined
      parsed = JSON.parse(raw)
    } catch {
      return undefined
    }
    if (!isStoredScope(parsed)) return undefined
    const held = parsed as ScopeSnapshot
    // A record whose path is missing or malformed cannot be addressed again, so
    // it is not a scope as far as this store is concerned.
    if (!isSafeScopePath(held.path)) return undefined
    return {
      path: held.path,
      // There is no version on a record kept here — it is a whole snapshot
      // under one key — so the fold is run over every read and is written to
      // be safe on a model that is already this shape (`migrate3to4.ts`).
      model: migrateModel(held.model),
      activeDiagramId: held.activeDiagramId ?? held.model.diagrams[0]?.id ?? '',
      // Additive field: a record written before the mark library lacks it and
      // yields an empty library, not a broken scope.
      logoLibrary: Array.isArray(held.logoLibrary) ? held.logoLibrary : [],
      ...(held.kind !== undefined ? { kind: held.kind } : {}),
      ...(held.client !== undefined ? { client: held.client } : {}),
      ...(held.links !== undefined ? { links: held.links } : {}),
      ...(held.imageLibrary !== undefined ? { imageLibrary: held.imageLibrary } : {}),
      updatedAt: typeof held.updatedAt === 'string' ? held.updatedAt : undefined,
    }
  }

  /**
   * See {@link ScopeStore.outdated}. A record here is a whole snapshot under one
   * key with no version on it, so the question is asked of the model.
   */
  outdated(): Promise<ScopePath[]> {
    const found: ScopePath[] = []
    for (const key of this.ourKeys()) {
      let parsed: unknown
      try {
        const raw = this.storage.getItem(key)
        if (!raw) continue
        parsed = JSON.parse(raw)
      } catch {
        continue
      }
      if (!isStoredScope(parsed)) continue
      const held = parsed as ScopeSnapshot
      if (isSafeScopePath(held.path) && isBeforeFormat4(held.model)) found.push(held.path)
    }
    return Promise.resolve(found)
  }

  list(): Promise<ScopeSummary> {
    let keys: string[]
    try {
      keys = this.storage.keys()
    } catch {
      return Promise.resolve(scopeTree([]))
    }
    const found = keys
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => this.read(key))
      .filter((scope): scope is ScopeSnapshot => scope !== undefined)
      .map(summarise)
    // Alphabetical, which is the default a screen shows and — more to the point
    // — an order every store can produce without depending on how its keys
    // happen to enumerate. A caller wanting recency re-sorts with `sortScopes`;
    // that is a presentation choice, not a storage one.
    const root = scopeTree(found)
    return Promise.resolve({ ...root, children: sortScopes(root.children) })
  }

  load(path: ScopePath): Promise<ScopeSnapshot | undefined> {
    if (!isSafeScopePath(path)) return Promise.resolve(undefined)
    return Promise.resolve(this.read(this.keyFor(path)))
  }

  save(scope: ScopeSnapshot): Promise<void> {
    if (!isSafeScopePath(scope.path)) {
      return Promise.reject(new ShellError('shell.badScopePath', { path: String(scope.path) }))
    }
    try {
      const stamped: ScopeSnapshot = { ...scope, updatedAt: new Date().toISOString() }
      const key = this.keyFor(scope.path)
      const text = JSON.stringify(stamped)
      this.storage.setItem(key, text)
      this.sizes().set(key, text.length)
      return Promise.resolve()
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  remove(path: ScopePath): Promise<void> {
    try {
      // The root is the tab's whole working tree, not something to throw away;
      // everything filed under a scope goes with it, because a child left
      // behind is addressed by nothing.
      if (isSafeScopePath(path) && path !== ROOT_SCOPE) {
        for (const key of this.ourKeys()) {
          if (!isWithinScope(key.slice(this.prefix.length), path)) continue
          this.storage.removeItem(key)
          this.sizes().delete(key)
        }
      }
    } catch {
      // Failing to throw something away is not a fault anybody can act on.
    }
    return Promise.resolve()
  }
}
