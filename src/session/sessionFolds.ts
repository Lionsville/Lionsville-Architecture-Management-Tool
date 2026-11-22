// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Folds, for the session: what is folded shut on a tree somebody is reading.
 *
 * **Never a preference.** A fold is what you are doing this minute, and a tool
 * that remembered it would open next week with half a tree hidden for a reason
 * nobody can reconstruct — the rule the organisation's scope tree was built
 * with (`organisation/ScopeTree.tsx`), and the one the organisation chart and
 * its outline keep (ADR-0036, amended 11 October 2026). So nothing here is
 * saved: it lasts as long as the app is open, and no further.
 *
 * **Keyed by what is folded.** The scope tree is one tree and holds its set
 * in its hook; a chart is a view, and a scope may hold several, each opened
 * and closed as its tab is — so the memory is the shell's, one for the window,
 * and each view's folds are kept under a key of its own (`foldKey`), the way
 * a board's viewport is kept per diagram (`editor/canvas/viewportMemory.ts`).
 * A view never opened has nothing kept, and its first open decides.
 */

/** A set with one id turned: folded where it was open, open where it was folded. */
export function toggled<T>(held: ReadonlySet<T>, id: T): ReadonlySet<T> {
  const next = new Set(held)
  if (!next.delete(id)) next.add(id)
  return next
}

/** A set with these ids open: what unfolding the way to something does. */
export function opened<T>(held: ReadonlySet<T>, ids: readonly T[]): ReadonlySet<T> {
  if (!ids.some((id) => held.has(id))) return held
  const next = new Set(held)
  for (const id of ids) next.delete(id)
  return next
}

/** Where a view's folds are kept: its scope and its id, since a view's id is its scope's. */
export function foldKey(scope: string, viewId: string, part: string): string {
  return `${scope}\u0000${viewId}\u0000${part}`
}

/** The folds each tree was left with, for as long as the window is open. */
export class SessionFolds {
  private readonly kept = new Map<string, ReadonlySet<string>>()

  keep(key: string, folded: ReadonlySet<string>): void {
    this.kept.set(key, new Set(folded))
  }

  /** What was kept under the key; nothing where the tree was never opened. */
  recall(key: string): ReadonlySet<string> | undefined {
    const held = this.kept.get(key)
    return held ? new Set(held) : undefined
  }
}
