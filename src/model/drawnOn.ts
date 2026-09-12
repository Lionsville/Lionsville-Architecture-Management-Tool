/**
 * Which boards actually draw a thing, on their own day.
 *
 * "Show me this application" stopped having one answer the moment a project
 * could hold two landscapes over the same model on two days (ADR-0009): the
 * board somebody last had open may not hold the element at all, and a board
 * dated on or after the day the element retires does not draw it even when it
 * does hold it (ADR-0010). A caller that picks the active board and points at
 * it lands a person on a page with nothing selected, and that is what the
 * sheet's coverage links did.
 *
 * Both halves of the answer already exist — what is on a view is the view's
 * own membership (ADR-0012 §6), and whether a dated element is drawn on a day
 * is `lifecycle.isGoneOn`, the rule the canvas itself projects with
 * (`editor/graph.ts`). This is the join, written once so nobody writes a
 * second copy of the second rule.
 */
import { isGoneOn, today } from './lifecycle'
import type { DesignDiagram, DesignModel, ElementId } from './types'

/**
 * The views that draw this element, in tab order.
 *
 * Only the two kinds a canvas draws: a sheet holds no members and is laid out
 * from the trees, so "which board draws it" is not a question about one.
 *
 * `day` is what a board with no `asOf` shows — today, read at the edge as
 * every other clock in this model is, and passed in by a test that is about
 * time.
 */
export function boardsDrawing(
  model: Pick<DesignModel, 'elements' | 'diagrams'>,
  elementId: ElementId,
  day: string = today(),
): DesignDiagram[] {
  const element = model.elements.find((held) => held.id === elementId)
  if (!element) return []
  return model.diagrams.filter((diagram) => {
    if (diagram.kind !== 'layer7' && diagram.kind !== 'container') return false
    if (!diagram.members.some((member) => member.id === elementId)) return false
    return !isGoneOn(element, diagram.asOf ?? day)
  })
}
