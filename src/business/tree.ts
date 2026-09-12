/**
 * The business layer is four trees, and this is the arithmetic over them.
 *
 * `actor`, `step`, `function` and `process` are trees made of one field —
 * `parentId`, with `order` where the order is a decision (ADR-0012 §3) — and
 * depth is what the sheet draws from: a `function` at depth 0 is an area, at
 * depth 1 a grouping, at depth 2 a capability; a `step` at depth 0 is the
 * journey, at depth 1 a phase, at depth 2 a step. The model does not know
 * those words, and neither does this file. It answers *who is under what*,
 * *how deep*, and *in what order* — and refuses a parent that would make a
 * loop.
 *
 * Pure, and over a plain list, because a scope's model is a list and the
 * cheapest correct answer is to index it once per question rather than to
 * keep a second structure in step with the first.
 */
import type { DesignElement, ElementId } from '../model'

/**
 * Siblings in the order they are drawn.
 *
 * `order` first where it is said, low to high, and the model's own list order
 * for everything else — which is what makes `order` optional worth having: a
 * journey's phases read left to right because somebody decided they do, and a
 * list of capabilities nobody has ordered is not renumbered to say so.
 *
 * Ties keep the order the list already has, so two rows that both say `3` do
 * not swap places between two reads of the same file.
 */
export function inOrder(elements: readonly DesignElement[]): DesignElement[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const left = a.element.order
      const right = b.element.order
      if (left === right) return a.index - b.index
      if (left === undefined) return 1
      if (right === undefined) return -1
      return left - right || a.index - b.index
    })
    .map(({ element }) => element)
}

/**
 * What sits directly under this one, in order.
 *
 * `parentId` of `undefined` asks for the roots — the areas of a sheet, the
 * journeys of a scope, the top of the stakeholder rail — which is the same
 * question and should not need a second function.
 */
export function childrenOf(
  elements: readonly DesignElement[],
  parentId: ElementId | undefined,
): DesignElement[] {
  return inOrder(elements.filter((element) => element.parentId === parentId))
}

/**
 * How far down this one sits, counting from 0 at a root.
 *
 * `undefined` when the chain does not end at a root: a `parentId` pointing at
 * an id this scope does not hold is a *dangling* end, which ADR-0012 §5 keeps
 * and reports rather than dropping, and a depth is not a thing that can be
 * said about it. A loop answers `undefined` too, because a cycle has no root
 * — {@link wouldCycle} is how one is kept out in the first place, and this
 * stays total for a file somebody hand-edited.
 */
export function depthOf(
  elements: readonly DesignElement[],
  id: ElementId,
): number | undefined {
  const byId = new Map(elements.map((element) => [element.id, element]))
  const seen = new Set<ElementId>()
  let at = byId.get(id)
  let depth = 0
  while (at?.parentId !== undefined) {
    if (seen.has(at.id)) return undefined
    seen.add(at.id)
    at = byId.get(at.parentId)
    if (at === undefined) return undefined
    depth += 1
  }
  return at === undefined ? undefined : depth
}

/**
 * Everything under this one, deepest last, in drawing order.
 *
 * The order a sheet reads in: each child, then everything under that child,
 * then the next child. A cycle is walked once and stopped, so a hand-edited
 * file lists what it can rather than hanging.
 */
export function descendantsOf(
  elements: readonly DesignElement[],
  id: ElementId,
): DesignElement[] {
  const out: DesignElement[] = []
  const seen = new Set<ElementId>([id])
  const walk = (parentId: ElementId): void => {
    for (const child of childrenOf(elements, parentId)) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      out.push(child)
      walk(child.id)
    }
  }
  walk(id)
  return out
}

/**
 * Would putting this one under that one make a loop?
 *
 * A **value**, never a throw: the ADR is explicit that an organisation-wide
 * fact is a finding and never a reason a save fails, and this is the one that
 * has to be refused *before* it is written rather than reported after — a
 * cycle is not a state a person can see and mend on a page that is drawn from
 * the tree the cycle broke. So the command that sets a parent asks first, and
 * the answer is `true` for the two ways of making one: a thing under itself,
 * and a thing under something already under it.
 */
export function wouldCycle(
  elements: readonly DesignElement[],
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

/**
 * Moving one thing among its neighbours: which rows change, and to what.
 *
 * The whole sibling list is renumbered from 1, not just the pair that swap.
 * `order` is optional because a list nobody ordered should not be renumbered
 * to say so (see {@link inOrder}) — but the moment somebody moves one, the
 * order of that list HAS become a decision, and half of it saying `3` while
 * the other half says nothing is how two reads of the same file disagree.
 * Renumbering once, at the moment the decision is made, is the cheap end of
 * that trade.
 *
 * Empty when the move would go off either end, or when the scope does not
 * hold it: nothing to write, and nothing to undo.
 */
export function moveAmongSiblings(
  elements: readonly DesignElement[],
  id: ElementId,
  by: -1 | 1,
): { id: ElementId; order: number }[] {
  const element = elements.find((held) => held.id === id)
  if (!element) return []
  const siblings = childrenOf(
    elements.filter((held) => held.kind === element.kind),
    element.parentId,
  )
  const at = siblings.findIndex((held) => held.id === id)
  const to = at + by
  if (at === -1 || to < 0 || to >= siblings.length) return []

  const moved = [...siblings]
  moved.splice(to, 0, ...moved.splice(at, 1))
  return moved
    .map((held, index) => ({ id: held.id, order: index + 1 }))
    .filter((row, index) => moved[index].order !== row.order)
}

/**
 * The tree under one root, flattened with each row's depth beside it.
 *
 * What a page that draws by depth actually wants, in one pass instead of a
 * `depthOf` per row — the roots are depth 0, and every child is one deeper
 * than the row it hangs from, whatever the rest of the model says.
 */
export function flatten(
  elements: readonly DesignElement[],
  rootId?: ElementId,
): { element: DesignElement; depth: number }[] {
  const out: { element: DesignElement; depth: number }[] = []
  const seen = new Set<ElementId>()
  const walk = (parentId: ElementId | undefined, depth: number): void => {
    for (const child of childrenOf(elements, parentId)) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      out.push({ element: child, depth })
      walk(child.id, depth + 1)
    }
  }
  if (rootId === undefined) {
    walk(undefined, 0)
    return out
  }
  const root = elements.find((element) => element.id === rootId)
  if (!root) return out
  seen.add(root.id)
  out.push({ element: root, depth: 0 })
  walk(root.id, 1)
  return out
}
