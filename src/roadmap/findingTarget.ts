// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a finding opens, said once for every place that lists one: the
 * roadmap's *Where the dates disagree* and the finding on a scope's roadmap
 * card at home.
 *
 * The element or the plan it names, and for a line the element it starts
 * from, with the line itself to select, whose inspector holds its dates.
 */
import type { ElementId, Relation } from '../model'
import type { Finding } from '../model/checks'

export type FindingTarget = { page: 'element'; id: ElementId; line?: string; field?: string } | { page: 'plan'; id: string }

export function findingTarget(problem: Finding, relations: readonly Pick<Relation, 'id' | 'sourceId'>[]): FindingTarget | undefined {
  if (problem.subject === 'transition') return { page: 'plan', id: problem.id }
  const id = problem.subject === 'relation'
    ? relations.find((relation) => relation.id === problem.id)?.sourceId
    : problem.id
  if (id === undefined) return undefined
  return problem.subject === 'relation' ? { page: 'element', id, line: problem.id } : { page: 'element', id }
}
