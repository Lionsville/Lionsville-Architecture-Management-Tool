/**
 * What belongs on a business sheet when you have just made one.
 *
 * The sibling of `model/containerDiagram.ts`, and it exists for the same
 * reason: the one place where "a new view of this kind starts out showing
 * *this*" is written down, so it is a function with a test rather than four
 * lines in the middle of a `useCallback`.
 *
 * A sheet has no geometry (ADR-0012 §6), so seeding one is not placing
 * anything — it is answering three questions the page is drawn from: which
 * journey runs across the top, which function roots are the areas, and
 * whether the stakeholder rail is drawn. A scope with one journey and some
 * areas gets a page that already says something; a scope with neither gets an
 * empty sheet that says what is missing, which is a better first screen than
 * refusing to make one.
 *
 * It lives here rather than in `model/` because *which root is a journey* is a
 * business-layer reading of `kind` and `parentId`, and this module is where
 * those trees are read.
 */
import type { DesignDiagram, DesignElement, ElementId } from '../model'
import { childrenOf } from './tree'

/** The roots of one of the business trees, in the order they are drawn. */
export function rootsOfKind(
  elements: readonly DesignElement[],
  kind: DesignElement['kind'],
): DesignElement[] {
  return childrenOf(elements, undefined).filter((element) => element.kind === kind)
}

/**
 * A fresh sheet over what the scope already holds.
 *
 * The journey is taken only when there is exactly one: with two, picking the
 * first would be a guess about which one the person means, and an empty band
 * with a picker under it is the honest version of not knowing. The areas are
 * every function root — a curated order is a decision somebody makes on the
 * page afterwards, and every root is the answer that loses nothing.
 *
 * `id` and `name` come from outside, as the container seed's do: one is a
 * counter with a clock in it, the other hangs off the language.
 */
export function seedSheet(
  elements: readonly DesignElement[],
  make: { id: string; name: string },
): DesignDiagram {
  const journeys = rootsOfKind(elements, 'step')
  const areas: ElementId[] = rootsOfKind(elements, 'function').map((element) => element.id)
  return {
    id: make.id,
    kind: 'sheet',
    name: make.name,
    ...(journeys.length === 1 ? { journeyId: journeys[0].id } : {}),
    ...(areas.length > 0 ? { areas } : {}),
    // Nothing is ON a sheet the way a card is on a board: what it draws is the
    // trees, and a member row would be a second place to keep the same fact.
    members: [],
    geometry: { nodes: [] },
  }
}
