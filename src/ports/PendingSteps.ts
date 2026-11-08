// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The steps of the open scope that are made and not yet written, kept at once
 * and synchronously where a page going away cannot take them along: a
 * write-ahead line beside a source whose writes are asynchronous and which no
 * window waits for — this browser's own place, a folder in a tab.
 *
 * A write lands a moment after a change, and a page reloaded or closed in that
 * moment took the change with it, prompt accepted. What is held here is read
 * back when the source opens again and put where it belonged, expecting the
 * revision it was made against: where the scope has moved since — the write
 * did land after all, or another tab changed it — it is refused, and nothing
 * is put over anybody's work.
 *
 * Absent where the window itself waits for the last write (the desktop), and
 * where nothing is kept at all (memory, the example).
 */
import type { Revision, ScopeAddress, ScopeStep } from '../projects/scopeState'

/** Which scope: its identity where the session knew it, and its address to find it by where not. */
export type PendingScope = { id?: string; address: ScopeAddress }

/** What one page held for one scope when it went. */
export type HeldSteps = {
  scope: PendingScope
  /** The revision the steps were made against: what they expect to land on. */
  base: Revision
  steps: readonly ScopeStep[]
  /**
   * Each record the steps change, by `kind:id`, with a print of what it was at
   * `base` (`null` where it was not there): where the scope moved since, the
   * steps that touch only records nobody else changed are still put back.
   * Absent where the page could not say, and then none is.
   */
  touched?: Readonly<Record<string, string | null>>
  /** When it was held, epoch milliseconds. */
  at: number
}

export type PendingSteps = {
  /**
   * Hold what is still to be written for a scope, in place of what was held
   * for it before; nothing to write clears it. Synchronous, and answers
   * whether it was held: too large, or refused where it is kept, is `false`,
   * and the scope's earlier line is cleared rather than left to say less than
   * is so.
   */
  hold(scope: PendingScope, base: Revision, steps: readonly ScopeStep[], touched?: HeldSteps['touched']): boolean
  /** Nothing is waiting for this scope any more: its write landed. */
  clear(scope: PendingScope): void
  /**
   * What pages no longer open held for this source — a page reloaded, a tab
   * closed — each with the way to let it go once it is put back or refused.
   * Never what a page still open holds: that page writes its own.
   */
  left(): Promise<readonly (HeldSteps & { release: () => void })[]>
}
