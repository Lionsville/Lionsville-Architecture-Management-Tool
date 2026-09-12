/**
 * Making and unmaking things on the sheet: where a new one goes, and when an
 * old one may go.
 *
 * Beta 1 shipped a page that draws and an inspector that edits one existing
 * thing; the only authors were a file and an agent. These are the two pieces
 * of arithmetic the gestures that close that gap need, kept here rather than
 * in the page for the reason everything else in this module is: they are
 * questions about the trees, answerable in node, and a page that worked them
 * out itself would be a second opinion about the same model.
 *
 * Both are **values**, never throws. A refusal to delete is an ordinary
 * answer — somebody asked, and the honest reply is "not while there is
 * something inside it" — so it travels as a key the page says out loud, the
 * way `tree.wouldCycle` refuses a parent rather than repairing one.
 */
import type { DesignElement, ElementId } from '../model'
import { childrenOf } from './tree'

/**
 * The `order` a new last sibling should carry, or nothing.
 *
 * `order` is optional because a list nobody ordered must not be renumbered to
 * say so (`tree.inOrder`), and `inOrder` sorts the unordered after the
 * ordered. So there are exactly two safe answers: when every sibling carries
 * an order, one past the highest, which lands the new one last; otherwise
 * nothing at all, which lands it last as well because the model's own list
 * order appends. Anything in between — a number among siblings that have none
 * — would put a phase somebody just added at the *front* of the journey.
 */
export function nextOrder(
  elements: readonly DesignElement[],
  kind: DesignElement['kind'],
  parentId: ElementId | undefined,
): number | undefined {
  const siblings = childrenOf(elements.filter((held) => held.kind === kind), parentId)
  if (siblings.length === 0) return undefined
  const orders = siblings.map((held) => held.order)
  if (orders.some((order) => order === undefined)) return undefined
  return Math.max(...(orders as number[])) + 1
}

/** Why a thing cannot simply go. A key, as every refusal from a pure module is. */
export type RemovalRefusal = 'sheet.deleteChildrenFirst'

export type Removal =
  | { ok: true }
  | { ok: false; reason: RemovalRefusal; count: number }

/**
 * May this go, as it stands?
 *
 * Not while something names it as its parent. Deleting an element takes its
 * relations with it (`model/reducer`), which is right — a line to a thing
 * that is gone is not a line — but nothing cascades down a tree, and nothing
 * should: a person who asks to delete an area is not asking to delete the
 * twenty capabilities inside it, and a tool that reads the request that way
 * is one keystroke from an afternoon lost. "Delete what is inside it first"
 * costs the person the clicks they would have spent deciding anyway, and it
 * leaves every step undoable on its own.
 *
 * The count comes back with the refusal so the page can say how many, which
 * is the difference between a rule and a rebuke.
 */
export function mayRemove(elements: readonly DesignElement[], id: ElementId): Removal {
  const children = elements.filter((held) => held.parentId === id)
  return children.length === 0
    ? { ok: true }
    : { ok: false, reason: 'sheet.deleteChildrenFirst', count: children.length }
}
