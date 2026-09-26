// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One move of a scope to another address, and everything filed under it.
 *
 * Two dialogs move a scope — the organisation screen's settings and the open
 * workspace's — and they used to be two moves. The workspace's wrote only the
 * open scope at its new address and then removed the old folder, which a
 * removal takes with everything under it, and removed it expecting nothing.
 * It is the same act from a different dialog, so it is one function.
 *
 * `ScopeStore.remove` takes a scope AND everything under it, so the move is:
 * read the subtree and refuse what it cannot carry, carry the refs pointing
 * into it (`carryRefs.ts`), write the scope and then each scope under it at
 * the new address, parents first — and only then remove the old addresses,
 * deepest first, each expecting the revision this move read of it. Removing
 * first and failing to save would lose the lot; removing without expecting
 * would take a change somebody landed under the old address meanwhile.
 */
import { flattenScopes, movedPaths, unreadableAt } from '../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../projects/scope'
import { applyRefPatch } from '../projects/readdress'
import type { RefPatch } from '../projects/readdress'
import { ShellError } from '../platform/errors'
import type { ScopePath } from '../projects/scopePath'
import { carryRefs } from './carryRefs'
import type { ScopeLibrary } from './App'

/** A scope filed under one being moved, as read, and where it goes. */
type MovedScope = { from: ScopePath; to: ScopePath; scope: ScopeSnapshot }

/**
 * What a move writes under the scope it moves, read before anything is
 * written. A move removes the old folder once the subtree stands at its new
 * address, so a scope whose read left a file out (`ScopeSnapshot.unread`,
 * ADR-0028) would lose that file with it: the move is refused before it
 * starts, the moved scope's own read (`held`) included.
 */
async function readTheMove(
  scopes: Pick<ScopeLibrary, 'load'>, held: ScopeSnapshot | undefined, subtree: ScopeSummary | undefined, to: ScopePath,
  listing: ScopeSummary,
): Promise<MovedScope[]> {
  if (held?.unread?.length) throw new ShellError('shell.unreadNotMoved')
  const read: MovedScope[] = []
  for (const pair of subtree ? movedPaths(subtree, to).slice(1) : []) {
    const scope = await scopes.load(pair.from)
    if (scope?.unread?.length) throw new ShellError('shell.unreadNotMoved')
    if (scope) read.push({ ...pair, scope })
  }
  // And every address it writes, against what the listing could not read: a
  // scope there that nobody could see would be written over by the move.
  if ([to, ...read.map((child) => child.to)].some((path) => unreadableAt(listing, path) !== undefined)) {
    throw new ShellError('shell.unreadableInTheWay')
  }
  return read
}

/** What to say about a move that did not start: its own refusal, or that saving failed. */
export function moveRefusal(cause: unknown): 'shell.unreadNotMoved' | 'shell.unreadableInTheWay' | undefined {
  if (!(cause instanceof ShellError)) return undefined
  return cause.key === 'shell.unreadNotMoved' || cause.key === 'shell.unreadableInTheWay' ? cause.key : undefined
}

export type MoveOutcome =
  /**
   * The subtree stands at its new address; `scope` is the moved scope as
   * written. `leftCopy` is why the old address could not be removed, where it
   * could not: two copies rather than a loss, and the caller says so.
   */
  | { stage: 'moved'; scope: ScopeSnapshot; leftCopy?: unknown }
  /** Nothing was written in the subtree: a refusal ({@link moveRefusal}), or the refs could not be carried. */
  | { stage: 'notStarted'; cause: unknown }
  /** A write at the new address failed; the old address is untouched. */
  | { stage: 'notSaved'; cause: unknown }

/**
 * Move the scope at `from`, as `next` says it should read, to `next.path`.
 *
 * `held` is the old address as this move read it: its revision is what the
 * removal expects, and a file its read left out refuses the move. `listing`
 * is the tree as read before the move, for the subtree and for the addresses
 * nobody could read.
 */
export async function moveSubtree(scopes: ScopeLibrary, move: {
  from: ScopePath
  next: ScopeSnapshot
  held: ScopeSnapshot | undefined
  listing: ScopeSummary
}): Promise<MoveOutcome> {
  const { from, next, held, listing } = move
  const to = next.path
  const subtree = flattenScopes(listing).find((scope) => scope.path === from)
  let beneath: readonly MovedScope[]
  let carried: Map<ScopePath, RefPatch>
  try {
    beneath = await readTheMove(scopes, held, subtree, to, listing)
    carried = await carryRefs({ scopes, from, to })
  } catch (cause) {
    return { stage: 'notStarted', cause }
  }

  const written = applyRefPatch(next, carried.get(from))
  try {
    // A new address: there is nothing there to expect.
    await scopes.save(written)
    for (const child of beneath) {
      await scopes.save(applyRefPatch({ ...child.scope, path: child.to }, carried.get(child.from)))
    }
  } catch (cause) {
    return { stage: 'notSaved', cause }
  }

  // The saves have landed, so the subtree exists at both addresses, and a
  // removal that is refused leaves a duplicate rather than a loss. Deepest
  // first, each expecting what was read of it: a removal checks only the
  // scope it names, and a change made under the old address since would
  // otherwise go with it unannounced.
  try {
    for (const child of [...beneath].reverse()) await scopes.remove(child.from, child.scope.revision)
    await scopes.remove(from, held?.revision)
  } catch (cause) {
    return { stage: 'moved', scope: written, leftCopy: cause }
  }
  return { stage: 'moved', scope: written }
}
