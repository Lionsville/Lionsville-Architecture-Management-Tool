/**
 * Structurizr\'s deployment diagram, over the canvas that already exists
 * (ADR-0013, redone).
 *
 * A container diagram says what an application is made of. Where those things
 * RUN is a second fact about the same picture, and every model in the market
 * draws it the same way: boxes inside boxes, the containers sitting in the
 * namespace inside the cluster inside the account.
 *
 * **Derived, never stored, never dragged.** The boxes are read off the
 * `hostedOn` rows and the platform tree, so they are right the moment a row
 * changes and there is nothing to keep in step — which is also why they cannot
 * be moved: a box is where its members are. This file works out which
 * containers are in which box and how deep each box sits; the layer that draws
 * them turns that into rectangles around the members\' own, and re-measures
 * whenever a card moves.
 *
 * A container hosted on nothing sits outside every box, which is the honest
 * drawing of a container nobody has said where to run. Context applications
 * are outside them too: somebody else\'s deployment is not this picture.
 *
 * Environments — *this container, in production, on that node* — are the open
 * question ADR-0013 keeps. The shape here takes them without changing: a
 * second grouping level is one more entry in the chain each container walks.
 */
import { platformCategoryOf } from './relations'
import type { DesignDiagram, DesignElement, ElementId, PlatformCategory, Relation } from './types'

export type DeploymentBox = {
  /** The platform the box IS. */
  id: ElementId
  name: string
  platformCategory: PlatformCategory
  /** How deep it sits: 0 is outermost, a namespace inside a cluster is 1. */
  depth: number
  /** Every container inside it, its nested boxes\' members included. */
  memberIds: ElementId[]
}

/**
 * The boxes this container diagram draws, outermost first — so a box is
 * painted before anything nested in it.
 *
 * `placed` is what the board actually draws on the day it shows, so a
 * container that is retired by then takes its box with it rather than leaving
 * an empty rectangle behind.
 */
export function deploymentBoxes(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  diagram: Pick<DesignDiagram, 'kind' | 'applicationElementId'>,
  placed: ReadonlySet<ElementId>,
): DeploymentBox[] {
  const subject = diagram.applicationElementId
  if (diagram.kind !== 'container' || subject === undefined) return []
  const byId = new Map(model.elements.map((element) => [element.id, element]))

  /** The platform, then what it sits in, outermost last. A loop stops itself. */
  const chainOf = (platformId: ElementId): DesignElement[] => {
    const chain: DesignElement[] = []
    const seen = new Set<ElementId>()
    let held = byId.get(platformId)
    while (held?.kind === 'platform' && !seen.has(held.id)) {
      seen.add(held.id)
      chain.push(held)
      held = held.parentId === undefined ? undefined : byId.get(held.parentId)
    }
    return chain
  }

  const boxes = new Map<ElementId, { platform: DesignElement; depth: number; memberIds: ElementId[] }>()
  for (const element of model.elements) {
    if (element.kind !== 'component' || element.parentId !== subject) continue
    if (!placed.has(element.id)) continue
    // One container runs in one place: a second row is a migration window the
    // model allows, and drawing the card in two boxes at once would be two
    // pictures over each other. The first is what the record shows too.
    const row = model.relations.find((held) => held.type === 'hostedOn' && held.sourceId === element.id)
    if (!row) continue
    const chain = chainOf(row.targetId)
    // Outermost first, so depth counts down the nesting the way a reader sees it.
    chain.reverse().forEach((platform, depth) => {
      const held = boxes.get(platform.id)
      if (held) {
        held.memberIds.push(element.id)
        // The shallowest place it was ever asked for: a platform reached
        // through two different chains is drawn where it fits both.
        held.depth = Math.min(held.depth, depth)
        return
      }
      boxes.set(platform.id, { platform, depth, memberIds: [element.id] })
    })
  }

  return [...boxes.values()]
    .sort((a, b) => a.depth - b.depth || a.platform.name.localeCompare(b.platform.name))
    .map(({ platform, depth, memberIds }) => ({
      id: platform.id,
      name: platform.name,
      platformCategory: platformCategoryOf(platform),
      depth,
      memberIds,
    }))
}
