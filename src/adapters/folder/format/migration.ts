// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Out of an older file format and into this one (ADR-0012 §11). It rewrites
 * in place, because a folder cannot hold two versions of itself. The fold is
 * `migrate3to4.ts`; what lives here is the pass over a whole store — ask which
 * scopes are old, record the folder before touching it, then read each one and
 * write it back ({@link upgradeProjects}).
 *
 * A narrow structural seam rather than a whole store, a tally of counts and
 * never names, and a failure that is one scope rather than the run. Copying
 * what a browser kept into a folder is the repositories' now
 * (`projects/copyScopes.ts`).
 */
import { bareScope, flattenScopes } from '../../../projects/scope'
import type { ScopeKind, ScopeSnapshot, ScopeSummary } from '../../../projects/scope'
import { ancestorScopes, ROOT_SCOPE, scopePathLabel } from '../../../projects/scopePath'
import type { ScopePath } from '../../../projects/scopePath'

/**
 * Where the pass reads and writes: a store that can see its scopes, read and
 * write one, and say which of them an older version of this tool wrote.
 *
 * A store that cannot say has nothing old in it, so the pass does nothing —
 * which is what any store written since the format turned wants.
 */
export type UpgradeTarget = {
  list(): Promise<ScopeSummary>
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
  save(scope: ScopeSnapshot): Promise<void>
  outdated?(): Promise<ScopePath[]>
}

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
   *
   * May be a question rather than an answer, and then it is asked only when
   * there is something to rewrite: reading it is a read of the folder's
   * settings, and a boot over a folder that is already this format — which is
   * almost every boot — has no use for the name and should not wait for it.
   */
  rootName?: string | (() => Promise<string | undefined>)
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
  await nameTheFolders(store, tally, typeof rootName === 'function' ? await rootName().catch(() => undefined) : rootName)
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
