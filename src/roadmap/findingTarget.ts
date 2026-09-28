// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a finding opens, said once for every place that lists one: the
 * roadmap's *Where the dates disagree* and the finding on a scope's roadmap
 * card at home.
 *
 * The element or the plan it names, and for a line the element it starts
 * from, whose inspector holds the line's dates — the board has no way yet to
 * be asked to select a line.
 */
import type { ElementId, Relation } from '../model'
import type { Finding } from '../model/checks'

export type FindingTarget = { page: 'element'; id: ElementId } | { page: 'plan'; id: string }

export function findingTarget(problem: Finding, relations: readonly Pick<Relation, 'id' | 'sourceId'>[]): FindingTarget | undefined {
  if (problem.subject === 'transition') return { page: 'plan', id: problem.id }
  const id = problem.subject === 'relation'
    ? relations.find((relation) => relation.id === problem.id)?.sourceId
    : problem.id
  return id === undefined ? undefined : { page: 'element', id }
}
