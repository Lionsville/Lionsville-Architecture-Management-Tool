// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a scope holds, by kind, and whether that is nothing (ADR-0040 §2).
 *
 * Said once, because two hosts remove a scope on an agent's word and both
 * must agree on what *empty* means: no views, no elements, no relations, no
 * decisions, no plans, no observations, causes, solutions or experiments, no
 * assignments, no comments, no marks, nothing of the operating model and no
 * pictures. What a scope says about itself — its name, its description, its
 * kind or type, its client and its links — is not work, and is not counted.
 * The scopes filed under it are the tree's to say, not the content's, and the
 * caller counts those.
 *
 * The shape is the agent's `ScopeHolds` (`agent/scopeTree.ts`), structurally:
 * `agent` may not import `projects`, so neither names the other.
 */
import type { ImageEntry } from '../model/imageName'
import type { HostModel } from '../model/hostModel'

/** What a scope holds, by kind. All zero is empty. */
export type ScopeHolds = {
  readonly views: number
  readonly elements: number
  readonly relations: number
  readonly decisions: number
  readonly plans: number
  readonly observations: number
  readonly causes: number
  readonly solutions: number
  readonly experiments: number
  readonly assignments: number
  readonly comments: number
  readonly marks: number
  /** Unit types, roles, responsibilities and operating rules. */
  readonly operatingModel: number
  /** The image library and the uploaded logos. */
  readonly pictures: number
  /** The views' names, at most {@link VIEW_NAMES_SAID}, for a refusal to say. */
  readonly viewNames: readonly string[]
}

/** How many views a count names: enough to recognise the scope by, few enough to read. */
export const VIEW_NAMES_SAID = 10

/** The part of a scope a count reads: its model, and its pictures where it has any. */
export type CountedScope = {
  readonly model: HostModel
  readonly images?: readonly ImageEntry[]
  readonly logoLibrary?: readonly unknown[]
}

const sized = (list: readonly unknown[] | undefined) => list?.length ?? 0

/** What the scope holds, by kind. */
export function holdsOf(scope: CountedScope): ScopeHolds {
  const { model } = scope
  return {
    views: model.diagrams.length,
    elements: model.elements.length,
    relations: model.relations.length,
    decisions: sized(model.decisions),
    plans: sized(model.transitions),
    observations: sized(model.observations),
    causes: sized(model.causes),
    solutions: sized(model.solutions),
    experiments: sized(model.experiments),
    assignments: sized(model.assignments),
    comments: sized(model.comments),
    marks: sized(model.checkMarks),
    operatingModel: sized(model.unitTypes) + sized(model.roles) + sized(model.responsibilities) + sized(model.operatingRules),
    pictures: sized(scope.images) + sized(scope.logoLibrary),
    viewNames: model.diagrams.slice(0, VIEW_NAMES_SAID).map((diagram) => diagram.name),
  }
}

/** Nothing of any kind: what a scope that may go on request holds. */
export function isEmpty(holds: ScopeHolds): boolean {
  return Object.entries(holds).every(([key, value]) => key === 'viewNames' || value === 0)
}

/** Nothing at all, for a scope with no document to count. */
export const HOLDS_NOTHING: ScopeHolds = {
  views: 0, elements: 0, relations: 0, decisions: 0, plans: 0, observations: 0, causes: 0, solutions: 0, experiments: 0,
  assignments: 0, comments: 0, marks: 0, operatingModel: 0, pictures: 0, viewNames: [],
}
