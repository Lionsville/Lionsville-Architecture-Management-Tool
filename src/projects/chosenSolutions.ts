// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the choice of a building block's solution is seen (ADR-0043 §8),
 * off the index: which landscape elements are a solution some scope chose,
 * and which are the solutions chosen for a scope — by itself or by a scope
 * above it, the nearest first — for the pickers to offer first.
 *
 * Pure: the index in, answers out. In `projects/` because the answer is
 * about which scope chose what, which `model/` may not know.
 */
import type { ElementId } from '../model/types'
import type { ScopeIndex } from './scopeIndex'
import { ancestorScopes } from './scopePath'
import type { ScopePath } from './scopePath'

/** One solution chosen in a scope's evaluation, as an element that is it says so. */
export type ChosenSolution = {
  /** The block, and where it is kept. */
  readonly block: { readonly id: string; readonly name: string; readonly scope: ScopePath }
  /** The solution chosen, by its name in the block's catalogue. */
  readonly sbb: string
  /** The scope whose evaluation chose it. */
  readonly scope: ScopePath
}

type Reads = Pick<ScopeIndex, 'buildingBlocks' | 'evaluations'>

/** Every choice made anywhere, by each element that is the solution chosen. */
function choices(index: Reads): { element: ElementId; chosen: ChosenSolution }[] {
  const blocks = new Map(index.buildingBlocks().map((one) => [one.block.id, one]))
  return index.evaluations().flatMap(({ scope, evaluation }) => {
    const kept = blocks.get(evaluation.block.id)
    const sbb = kept?.block.sbbs?.find((one) => one.id === evaluation.chosen)
    if (!kept || !sbb) return []
    const chosen: ChosenSolution = { block: { id: kept.block.id, name: kept.block.name, scope: kept.scope }, sbb: sbb.name, scope }
    return (sbb.elements ?? []).map((element) => ({ element, chosen }))
  })
}

/** What an element is, as a chosen solution, in every scope that chose it (§8, the inspector's line). */
export function solutionsChosenAs(index: Reads, element: ElementId): ChosenSolution[] {
  return choices(index).filter((one) => one.element === element).map((one) => one.chosen)
    .sort((a, b) => a.scope.localeCompare(b.scope) || a.block.name.localeCompare(b.block.name))
}

/**
 * The elements chosen for a scope (§8, the pickers): those a solution chosen
 * in its own evaluations is, and in those of the scopes above it — the
 * nearest choice of a block wins, so a domain that chose otherwise than the
 * organisation is answered with the domain's.
 */
export function chosenFor(index: Reads, scope: ScopePath): Map<ElementId, ChosenSolution> {
  const order = [scope, ...ancestorScopes(scope)]
  const all = choices(index).filter((one) => order.includes(one.chosen.scope))
  const nearest = new Map<string, ScopePath>()
  for (const one of all) {
    const held = nearest.get(one.chosen.block.id)
    if (held === undefined || order.indexOf(one.chosen.scope) < order.indexOf(held)) nearest.set(one.chosen.block.id, one.chosen.scope)
  }
  return new Map(all.filter((one) => nearest.get(one.chosen.block.id) === one.chosen.scope).map((one) => [one.element, one.chosen]))
}
