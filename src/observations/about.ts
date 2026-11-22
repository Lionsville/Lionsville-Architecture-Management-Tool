// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What is said about one element: the decisions about it and the observations
 * on it (ADR-0032, amended 22 November 2026). An element's record and the
 * agent's `element.describe` ask the same two questions, so they are answered
 * once, here, over lists the caller already holds.
 *
 * A decision is about an element by its `subjectId`, kept on the scope's own
 * list; a scope's decisions are read where the scope is open, so the answer
 * is this scope's. An observation names the elements it is about, and every
 * scope's analysis is on the tree's index (ADR-0032 §1), so the answer reads
 * across the scopes read with no load per row (ADR-0004): the open scope's
 * from its session, which is newer than the index, and every other's from
 * the index. A merged, moved or archived observation is history and is left
 * out: the question is what is open on it.
 *
 * Pure: lists in, lists out.
 */
import type { Adr } from '../model/adr'
import type { Observation, ScopeAnalysis } from '../model/observation'
import { isAbout, isArchived, liveObservations } from './observation'

/** An observation on an element, and the scope it lives in where that is not the one asked from. */
export type ObservationOn = { readonly observation: Observation; readonly scope?: string }

/** The decisions of one list about an element, by number. */
export function decisionsAbout(decisions: readonly Adr[] | undefined, elementId: string): Adr[] {
  return (decisions ?? []).filter((adr) => adr.subjectId === elementId).sort((a, b) => a.number - b.number)
}

/**
 * The open observations on an element: this scope's first, by number, then
 * every other scope's in path order. `here` is this scope's path, whose entry
 * in `tree` is passed over for `own`, the newer list.
 */
export function observationsOn(
  own: readonly Observation[] | undefined, tree: readonly ScopeAnalysis[], here: string, elementId: string,
): ObservationOn[] {
  const open = (list: readonly Observation[]) => liveObservations(list).filter((one) => !isArchived(one) && isAbout(one, elementId))
    .sort((a, b) => a.number - b.number)
  const elsewhere = [...tree].filter((one) => one.scope !== here).sort((a, b) => a.scope.localeCompare(b.scope))
    .flatMap((one) => open(one.observations).map((observation) => ({ observation, scope: one.scope })))
  return [...open(own ?? []).map((observation) => ({ observation })), ...elsewhere]
}
