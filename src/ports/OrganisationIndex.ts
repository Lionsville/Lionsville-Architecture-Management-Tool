// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The index over every scope of one source (ADR-0031 §1; ADR-0012 §2).
 *
 * An id names one thing across the whole organisation, so "who owns this",
 * "who else draws it" and "which plans reach this scope from above" are
 * questions about the tree rather than about the scope that is open. They are
 * answered from what every scope holds of its records and rows, and nothing
 * else: no description, no view, no decision, no picture — the input
 * `projects/scopeIndex.ts` folds, and the reason that input is thin.
 *
 * **It follows the steps.** Nothing writes to it: a step applied through
 * `ScopeRepository`, and a scope created, moved or removed there, is what
 * changes it.
 *
 * **It has a revision, and says what changed since one.** A reader that holds
 * the index asks for what changed since the revision it holds rather than for
 * the whole of it again, which is the difference between a question about one
 * scope and a question about every scope, asked after every step anybody
 * makes.
 *
 * `OrganisationIndex.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { ScopeModel } from '../projects/scope'
import type { Revision, ScopeAddress, ScopeId } from '../projects/scopeState'

/** One scope's part of the index: where it is, and what it holds that the index reads. */
export type IndexedScope = {
  id: ScopeId
  address: ScopeAddress
  model: ScopeModel['model']
}

/** The whole index, at a revision. */
export type IndexRead = {
  revision: Revision
  /** Every scope, the organisation included. */
  scopes: readonly IndexedScope[]
}

/**
 * What changed since a revision: every scope whose part may have changed —
 * created, moved, or changed by a step — as it is now, and every scope removed.
 * It may name a scope whose part is as it was; it never leaves out one whose
 * part is not.
 */
export type IndexChanges = {
  revision: Revision
  changed: readonly IndexedScope[]
  removed: readonly ScopeId[]
}

export interface OrganisationIndex {
  readonly id: string

  /** The whole index, and its revision. Equal revisions are the same index. */
  read(): Promise<IndexRead>

  /**
   * What changed since `revision`, which this index answered with before. A
   * revision it cannot answer from — one it never gave, or one further back
   * than it keeps — is answered `undefined`, and the reader reads the whole
   * index again rather than holding one that is quietly incomplete.
   */
  since(revision: Revision): Promise<IndexChanges | undefined>
}
