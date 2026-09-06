/**
 * Projects in the browser's storage, one key each.
 *
 * One key per project rather than one blob holding all of them: the blob would
 * have to be rewritten in full on every autosave, and a quota failure while
 * saving one project would take every other project down with it. Separate keys
 * mean a project can only ever damage itself.
 *
 * The key is the ref as a path (`lvarch.project.<group>/<project>`), so
 * `list()` is a prefix scan and a store that later keeps projects in folders
 * uses the same string as its path.
 *
 * **Corrupt storage is a skipped entry, not an error.** Half-written JSON, a key
 * from an older version, something a human edited by hand: there is nothing the
 * user can do about it, and refusing to show the rest of their projects would be
 * a worse answer. What *does* reject is a write that fails — full, private mode,
 * strict policy — because then everything keeps working until the tab closes,
 * and somebody needs to know.
 */
import { ShellError } from '../../platform/errors'
import { isUsableProject, sortProjects, summarise } from '../../projects/project'
import type { ProjectSnapshot, ProjectSummary } from '../../projects/project'
import { isProjectRef, refPath } from '../../projects/projectRef'
import type { ProjectRef } from '../../projects/projectRef'
import type { ProjectStore, StoragePressure } from '../../ports/ProjectStore'
import type { KeyValueStorage } from './KeyValueStorage'

/**
 * The prefix every project key carries.
 *
 * `lvarch`, not a customer's name. It used to carry one — invisible to
 * anyone using the tool, and therefore the last place the old assumption could
 * sit unchallenged. Renaming it strands whatever is already in a browser under
 * the old prefix; that is a deliberate call taken with the rename, on the
 * grounds that the working file is the durable artefact
 * and a migration for a tool still in development outlives its usefulness by
 * years.
 */
export const PROJECT_PREFIX = 'lvarch.project.'

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
 * The quota is shared with everything else on the origin — preferences, the
 * group records, whatever a future feature keeps here — so what this counts is
 * a floor on the usage rather than the whole of it.
 */
export const STORAGE_BUDGET_CHARS = 2_500_000

/** Where a warning is worth giving: enough room left to finish the afternoon. */
export const STORAGE_WARNING_FRACTION = 0.8

export class WebStorageProjectStore implements ProjectStore {
  readonly id = 'browser-storage'

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly prefix: string = PROJECT_PREFIX,
  ) {}

  private keyFor(ref: ProjectRef): string {
    return `${this.prefix}${refPath(ref)}`
  }

  /**
   * What each of our keys costs, so the total is arithmetic rather than a scan.
   *
   * Filled once, on the first save, by reading what is already there; from then
   * on a save updates one entry. The alternative — reading every project back
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

  /** See {@link ProjectStore.pressure}. */
  pressure(): StoragePressure | undefined {
    let used = 0
    for (const size of this.sizes().values()) used += size
    return { used, budget: STORAGE_BUDGET_CHARS }
  }

  /** One stored record, or `undefined` when it is missing or unreadable. */
  private read(key: string): ProjectSnapshot | undefined {
    let parsed: unknown
    try {
      const raw = this.storage.getItem(key)
      if (!raw) return undefined
      parsed = JSON.parse(raw)
    } catch {
      return undefined
    }
    if (!isUsableProject(parsed)) return undefined
    const held = parsed as ProjectSnapshot
    // A record whose ref is missing or malformed cannot be addressed again, so
    // it is not a project as far as this store is concerned.
    if (!isProjectRef(held.ref)) return undefined
    return {
      ref: held.ref,
      model: held.model,
      activeDiagramId: held.activeDiagramId ?? held.model.diagrams[0].id,
      // Additive field: a record written before the mark library lacks it and
      // yields an empty library, not a broken project.
      logoLibrary: Array.isArray(held.logoLibrary) ? held.logoLibrary : [],
      updatedAt: typeof held.updatedAt === 'string' ? held.updatedAt : undefined,
    }
  }

  list(): Promise<ProjectSummary[]> {
    let keys: string[]
    try {
      keys = this.storage.keys()
    } catch {
      return Promise.resolve([])
    }
    const found = keys
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => this.read(key))
      .filter((project): project is ProjectSnapshot => project !== undefined)
      .map(summarise)
    // Alphabetical, which is the default the picker shows and — more to the
    // point — an order every store can produce without depending on how its
    // keys happen to enumerate. A caller wanting recency re-sorts with
    // `sortProjects`; that is a presentation choice, not a storage one.
    return Promise.resolve(sortProjects(found))
  }

  load(ref: ProjectRef): Promise<ProjectSnapshot | undefined> {
    if (!isProjectRef(ref)) return Promise.resolve(undefined)
    return Promise.resolve(this.read(this.keyFor(ref)))
  }

  save(project: ProjectSnapshot): Promise<void> {
    if (!isProjectRef(project.ref)) {
      return Promise.reject(new ShellError('shell.badProjectRef', { path: JSON.stringify(project.ref) }))
    }
    try {
      const stamped: ProjectSnapshot = { ...project, updatedAt: new Date().toISOString() }
      const key = this.keyFor(project.ref)
      const text = JSON.stringify(stamped)
      this.storage.setItem(key, text)
      this.sizes().set(key, text.length)
      return Promise.resolve()
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)))
    }
  }

  remove(ref: ProjectRef): Promise<void> {
    try {
      if (isProjectRef(ref)) {
        const key = this.keyFor(ref)
        this.storage.removeItem(key)
        this.sizes().delete(key)
      }
    } catch {
      // Failing to throw something away is not a fault anybody can act on.
    }
    return Promise.resolve()
  }
}
