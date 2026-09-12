/**
 * Two migrations, and they are not the same kind of thing.
 *
 * **Out of browser storage and into the folder** (ADR-0003). It copies, and
 * deletes nothing: three rules, on {@link copyScopesInto}.
 *
 * **Out of an older file format and into this one** (ADR-0012 §11). It rewrites
 * in place, because a folder cannot hold two versions of itself. The fold is
 * `migrate3to4.ts`; what lives here is the pass over a whole store — ask which
 * scopes are old, record the folder before touching it, then read each one and
 * write it back ({@link upgradeProjects}).
 *
 * They share a file because they share the shape a caller wants: narrow
 * structural seams rather than a `ProjectStore`, a tally of counts and never
 * names, and a failure that is one project rather than the run.
 */
import { bareScope, flattenScopes } from './scope'
import type { ScopeKind, ScopeSnapshot, ScopeSummary } from './scope'
import { ancestorScopes, ROOT_SCOPE, scopePathLabel } from './scopePath'
import type { ScopePath } from './scopePath'

/** Where the scopes are coming from: enough to see them and read them. */
export type ScopeSource = {
  list(): Promise<ScopeSummary>
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
}

/** Where they are going: enough to see what is already there, and to write. */
export type ScopeTarget = ScopeSource & {
  save(scope: ScopeSnapshot): Promise<void>
}

/** What happened, for the trail. Counts, never names — a log is not a document. */
export type MigrationTally = {
  scopes: number
  /** Already in the folder, and therefore left exactly as they were. */
  kept: number
  failed: number
}

export const NOTHING_MIGRATED: MigrationTally = { scopes: 0, kept: 0, failed: 0 }

/**
 * The projects in browser storage, copied into the folder.
 *
 * The desktop app kept its user's documents in a leveldb inside `userData`
 * (ADR-0003). The moment somebody chooses a folder, those projects have to
 * follow them there — a migration that leaves the old work behind is not a
 * migration, it is a fresh start with a confusing name.
 *
 * **Nothing is deleted.** Not the old records, not on a later run either. This
 * copies; the browser's copy stays until somebody decides it may go, and until
 * then a folder that turns out to be on an unplugged drive costs nothing.
 *
 * **Nothing already in the folder is touched.** A project the folder already
 * holds under the same ref is the newer one by definition — it is where the
 * work has been happening — and a migration that overwrote it would be the
 * worst kind of data loss: silent, and triggered by choosing a folder.
 *
 * **A failure is one project, not the run.** A landscape that will not read is
 * skipped and counted; the other eleven still arrive.
 */
export async function copyScopesInto(
  from: ScopeSource, into: ScopeTarget,
): Promise<MigrationTally> {
  const tally = { ...NOTHING_MIGRATED }
  let summaries: readonly ScopeSummary[]
  try {
    // Parents before children, which `flattenScopes` already answers in: a
    // child saved first would sit under a folder that is not a scope yet.
    summaries = flattenScopes(await from.list())
  } catch {
    return tally
  }

  for (const summary of summaries) {
    try {
      if (await into.load(summary.path)) { tally.kept += 1; continue }
      const scope = await from.load(summary.path)
      // Listed but not there: the root of a store that has never had one saved
      // is in every listing and in no store. Per the port, `undefined` is an
      // ordinary answer and a genuine failure rejects — which is counted below.
      if (!scope) continue
      await into.save(scope)
      tally.scopes += 1
    } catch {
      tally.failed += 1
    }
  }
  return tally
}

/** Everything, in one call. */
export async function migrateInto(
  from: ScopeSource, into: ScopeTarget,
): Promise<MigrationTally> {
  return copyScopesInto(from, into)
}

export function migrated(tally: MigrationTally): boolean {
  return tally.scopes > 0
}

// --- out of an older format, and into this one ------------------------------

/**
 * Where the pass reads and writes: a store that can also say which of its
 * projects an older version of this tool wrote ({@link ProjectStore.outdated}).
 *
 * A store that cannot say has nothing old in it, so the pass does nothing —
 * which is what an in-memory store and any backend written since the format
 * turned both want.
 */
export type UpgradeTarget = ScopeTarget & { outdated?(): Promise<ScopePath[]> }

/**
 * Recording the folder before the pass rewrites it (ADR-0008), or saying it
 * could not. `false` is not a failure: a folder with no git in it has nothing
 * to record, and refusing to migrate for want of a snapshot would leave a
 * project nobody can open.
 */
export type RecordBefore = () => Promise<boolean>

export type UpgradeTally = {
  /** Scopes read in an older format and written back in this one. */
  upgraded: number
  /**
   * Scopes the pass had to invent, because format 4 had folders that were not
   * records: the group folder somebody never gave a `group.json`, and the root.
   */
  created: number
  failed: number
  /** Whether what the folder looked like first was kept. */
  recorded: 'taken' | 'unavailable' | 'nothing to record'
}

export const NOTHING_UPGRADED: UpgradeTally = {
  upgraded: 0, created: 0, failed: 0, recorded: 'nothing to record',
}

/** What the pass needs beyond the store. */
export type UpgradeOptions = {
  /** Keep what the folder looked like first (ADR-0008), where there is a git. */
  record?: RecordBefore
  /**
   * What to call the root when the tree has never had one.
   *
   * The organisation's name, which at format 4 lived in `folder.json` and
   * otherwise nowhere (ADR-0012 §1) — so the caller reads it from there, and
   * falls back to the folder's own name, which is what a person called it.
   */
  rootName?: string
}

/**
 * Every project this store holds in an older format, rewritten in this one.
 *
 * Eager rather than lazy, and the reason is the superseded files: reading an
 * old project upgrades what is in memory, but only a save takes the files the
 * format has stopped writing off disk, and a folder half in one version and
 * half in another is a folder whose diffs nobody can read.
 *
 * Not guarded by a preference either, which the browser-storage copy needs and
 * this does not: the question it asks is the state itself, so a folder that has
 * already been through the pass answers with an empty list and costs one header
 * read per project. A project dropped into the folder next month is migrated
 * next month, without anybody having to remember it.
 */
export async function upgradeProjects(
  store: UpgradeTarget, options: UpgradeOptions = {},
): Promise<UpgradeTally> {
  const tally: UpgradeTally = { ...NOTHING_UPGRADED }
  let outdated: readonly ScopePath[]
  try {
    outdated = await store.outdated?.() ?? []
  } catch {
    // A store that cannot be asked is a store nothing can be done about here;
    // opening a scope will fail loudly enough on its own.
    return tally
  }
  if (outdated.length === 0) return tally

  const { record, rootName } = options
  tally.recorded = record && await record().catch(() => false) ? 'taken' : 'unavailable'
  for (const path of outdated) {
    try {
      const scope = await store.load(path)
      if (!scope) { tally.failed += 1; continue }
      await store.save(scope)
      tally.upgraded += 1
    } catch {
      tally.failed += 1
    }
  }
  await nameTheFolders(store, tally, rootName)
  return tally
}

/**
 * The folders format 4 had that were not records, given one.
 *
 * Two of them. A group with projects under it and no `group.json` was still a
 * group, because a group was derived from what was filed under it; a scope is
 * not derived from anything, so that folder has to say its own name or the
 * scopes inside it are filed under nothing. And the root was never a record at
 * all — its name was a key in `folder.json`, which is where `rootName` comes
 * from.
 *
 * Named from the folder, which is what a person called it. A slug is a poor
 * name and a better one than none; it is one rename away, and the alternative
 * is a tree with holes in it.
 */
async function nameTheFolders(
  store: UpgradeTarget, tally: UpgradeTally, rootName?: string,
): Promise<void> {
  const make = async (path: ScopePath, name: string, kind: ScopeKind) => {
    try {
      await store.save(bareScope(path, name, kind))
      tally.created += 1
    } catch {
      tally.failed += 1
    }
  }

  try {
    if (!await store.load(ROOT_SCOPE)) {
      const tree = await store.list()
      await make(ROOT_SCOPE, rootName?.trim() || tree.name, 'organisation')
    }
    // Read after the root, so a scope the pass has just written is in it.
    const held = flattenScopes(await store.list())
    const known = new Set(held.map((scope) => scope.path))
    const missing = new Set(held
      .flatMap((scope) => ancestorScopes(scope.path))
      .filter((path) => !known.has(path)))
    // Shallowest first: a parent has to exist before its own parent is asked
    // for, or the second write lands under a folder that is not a scope yet.
    for (const path of [...missing].sort()) await make(path, scopePathLabel(path), 'domain')
  } catch {
    // A store that will not list is a store the rest of the app will complain
    // about loudly enough; the scopes that were rewritten are still rewritten.
    tally.failed += 1
  }
}
