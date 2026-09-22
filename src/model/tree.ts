// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One parent, always, and the one rule about it that has to be refused before
 * it is written (ADR-0012 §3, ADR-0014 §2.8).
 *
 * `parentId` is the one containment for every kind that is a tree — a
 * function's area, a step's phase, an actor's group, a namespace's cluster, a
 * service's family — and a loop in it is not a state a person can see and
 * mend on a page drawn from the tree the loop broke. So the command that sets
 * a parent asks first, and the answer is a **value**, never a throw: `true`
 * for the two ways of making one, a thing under itself and a thing under
 * something already under it.
 *
 * Here rather than in `business/tree.ts`, where it was, because the platform
 * tree is a tree too and `editor/` may not reach `business/`. The business
 * layer re-exports it, so nothing that read it there moved.
 */
import type { DesignElement, ElementId } from './types'

export function wouldCycle(
  elements: readonly Pick<DesignElement, 'id' | 'parentId'>[],
  id: ElementId,
  parentId: ElementId | undefined,
): boolean {
  if (parentId === undefined) return false
  if (parentId === id) return true
  const byId = new Map(elements.map((element) => [element.id, element]))
  const seen = new Set<ElementId>()
  let at = byId.get(parentId)
  while (at !== undefined) {
    if (at.id === id) return true
    if (seen.has(at.id)) return false
    seen.add(at.id)
    at = at.parentId === undefined ? undefined : byId.get(at.parentId)
  }
  return false
}
