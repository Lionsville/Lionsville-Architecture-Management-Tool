// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a card goes: the arithmetic `element.add` and the canvas tools share —
 * a new card's spot, a band that keeps its cards, and a domain group found by
 * its name and grown to hold what is filed under it.
 */
import type { Command } from '../../model/commands'
import { transaction } from '../../model/commands'
import { claimKey } from '../../model/keys'
import type { Diagram, Model } from '../../model/normalised'
import { boxesOf, groupList, placedOn } from '../../model/normalised'
import {
  clampPlacementIntoZone, defaultContainerPosition, defaultZonePosition, freeSlotIn, freeZonePosition,
  groupRectAround, placementRect, rectsIntersect, unionRects,
} from '../../model/placement'
import { HOME_ZONE } from '../../model/zones'
import { nodeFigure } from '../../model/kinds'
import type { DesignElement, DiagramGroup, DomainGroupRect, ElementId, Layer7Zone, PlacedNode, Rect } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { refused } from '../tools'
import type { Args } from './shared'

type Seeded = { placement: PlacedNode; layout?: Command }

/**
 * Where a new card lands: what was asked for, else the same cascade the
 * palette uses — and inside its group's box when a group is named, because a
 * card filed under a group and drawn outside its box is a card the next drag
 * re-files. A group that has no box yet gets one around the card.
 */
export function seedPlacement(
  model: Model, diagram: Diagram, elementId: ElementId,
  element: Pick<DesignElement, 'kind' | 'outside'>, args: Args,
): Seeded | AgentAnswer {
  const asked = typeof args.x === 'number' && typeof args.y === 'number'
    ? { x: args.x, y: args.y } : undefined
  if (diagram.kind !== 'layer7') {
    if (args.zone !== undefined || typeof args.domainGroup === 'string') {
      return refused('agent.badArguments', 'bands and domain groups are a landscape\'s')
    }
    return {
      placement: {
        id: elementId,
        ...(asked ?? defaultContainerPosition(nodeFigure(element), diagram.order.members.length)),
      },
    }
  }
  return seedOnLandscape(model, diagram, elementId, element, args, asked)
}

/** A new card on a landscape: in its band, and in its group's box when it names one. */
function seedOnLandscape(
  model: Model, diagram: Diagram, elementId: ElementId,
  element: Pick<DesignElement, 'kind' | 'outside'>, args: Args, asked: { x: number; y: number } | undefined,
): Seeded | AgentAnswer {
  const zone = (args.zone as Layer7Zone | undefined) ?? HOME_ZONE[nodeFigure(element)]
  const figure = nodeFigure(element, zone)
  const name = typeof args.domainGroup === 'string' && args.domainGroup.trim() ? args.domainGroup.trim() : undefined
  if (name !== undefined && zone !== 'landscape') return refused('agent.badArguments', `${name} is a domain group; only landscape cards are grouped`)
  // A name nobody has used yet makes the group, which is what a card filed
  // under a group the board does not have yet has always meant here.
  const held = name === undefined ? undefined : groupNamed(diagram, name)
  const groupId = name === undefined ? undefined : held?.id ?? newGroupId(diagram, name)
  const made: Command[] = held || name === undefined
    ? []
    : [{ type: 'group.set', diagramId: diagram.id, groups: [{ id: groupId!, name }] }]
  const box = groupId === undefined ? undefined : groupBox(diagram, groupId)
  const position = asked
    ?? (box ? freeSlotIn(box, figure, membersOf(model, diagram, groupId!).map(([, rect]) => rect))
      : defaultZonePosition(zone, figure, diagram.order.members.filter((id) => (placedOn(diagram, id)!.zone ?? 'landscape') === zone).length, diagram))
  const placement: PlacedNode = { id: elementId, zone, ...position, ...(groupId !== undefined ? { group: groupId } : {}) }
  const kept = zone === 'landscape' ? placement : clampPlacementIntoZone(placement, figure, diagram) ?? placement
  const grown = groupId === undefined ? undefined : growGroup(diagram, groupId, placementRect(figure, kept))
  return { placement: kept, layout: transaction([...made, ...(grown ? [grown] : [])]) }
}

/** What a group is CALLED, for an answer a person reads. */
export function groupNameOn(diagram: Diagram, groupId: string | undefined): string | undefined {
  if (groupId === undefined) return undefined
  return groupList(diagram).find((group) => group.id === groupId)?.name ?? groupId
}

/**
 * A card filed in a side band, kept inside it. The clamp slides it to the
 * band's edge, which is on top of whatever was already at that edge — the
 * anchor, usually — so a clamped card that would land on another one takes a
 * free slot in the band instead. A landscape card is not touched.
 */
export function keptInBand(
  model: Model, diagram: Diagram,
  element: Pick<DesignElement, 'kind' | 'outside'>, placement: PlacedNode,
): PlacedNode {
  if ((placement.zone ?? 'landscape') === 'landscape') return placement
  const figure = nodeFigure(element, placement.zone)
  const clamped = clampPlacementIntoZone(placement, figure, diagram)
  if (!clamped) return placement
  const others = diagram.order.members
    .filter((id) => id !== placement.id && model.elements[id] && (placedOn(diagram, id)!.zone ?? 'landscape') === placement.zone)
    .map((id) => placementRect(nodeFigure(model.elements[id], placedOn(diagram, id)!.zone), placedOn(diagram, id)!))
  const mine = placementRect(figure, clamped)
  if (!others.some((rect) => rectsIntersect(mine, rect))) return clamped
  return { ...clamped, ...freeZonePosition(placement.zone!, figure, others, diagram) }
}

export function groupBox(diagram: Diagram, groupId: string): DomainGroupRect | undefined {
  return boxesOf(diagram)[groupId]
}

/**
 * The group on this diagram a person means by that name.
 *
 * A group has an id of its own (ADR-0012 §6) and the tools speak names, because
 * a name is what an agent has read off the board. This is where the two meet;
 * it is the only place in the module that matches on a name.
 */
export function groupNamed(diagram: Diagram, name: string): DiagramGroup | undefined {
  return groupList(diagram).find((group) => group.name === name)
}

/** The drawn members of a group, with their rectangles. */
export function membersOf(model: Model, diagram: Diagram, groupId: string): [ElementId, Rect][] {
  return diagram.order.members
    .filter((id) => placedOn(diagram, id)!.group === groupId && model.elements[id])
    .map((id) => [id, placementRect(nodeFigure(model.elements[id], placedOn(diagram, id)!.zone), placedOn(diagram, id)!)])
}

/**
 * The layout command that makes a group's box hold this rectangle: grown to
 * the union when it has one, drawn around the card when it has none, and
 * nothing when the card is inside already. A box is never moved or shrunk.
 */
export function growGroup(diagram: Diagram, groupId: string, rect: Rect): Command | undefined {
  const existing = boxesOf(diagram)[groupId]
  const box = existing ? unionRects([existing, rect])! : groupRectAround([rect])!
  if (existing && box.x === existing.x && box.y === existing.y && box.width === existing.width && box.height === existing.height) return undefined
  const grown: DomainGroupRect = { id: groupId, x: box.x, y: box.y, width: box.width, height: box.height }
  return { type: 'box.set', diagramId: diagram.id, boxes: [grown] }
}

/** A new group's id on this diagram, minted from its name the way the editor mints one. */
export function newGroupId(diagram: Diagram, name: string): string {
  return claimKey(name, new Set(diagram.order.groups))
}
