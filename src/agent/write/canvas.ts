// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The see tier's writes: cards moved, drawn and undrawn, filed under a domain
 * group and out of one, lined up and spread out. Each is a command over the
 * diagram's placements, never over the landscape's rows.
 */
import type { Command } from '../../model/commands'
import { placeOn, transaction } from '../../model/commands'
import type { Diagram, Model } from '../../model/normalised'
import { boxesOf, placedOn } from '../../model/normalised'
import { canPlaceKind, freeSlotIn, groupRectAround, memberOf, placementRect, rectCenter, unionRects } from '../../model/placement'
import { zoneForPoint } from '../../model/zones'
import { nodeFigure } from '../../model/kinds'
import type { DesignElement, DiagramGroup, DomainGroupRect, Layer7Zone, PlacedNode, Rect } from '../../model/types'
import { alignNodes, distributeNodes } from '../../layout/alignDistribute'
import type { AlignAxis, DistributeAxis, NodeBounds } from '../../layout/alignDistribute'
import type { ReadView } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import { groupBox, groupNameOn, groupNamed, growGroup, keptInBand, membersOf, newGroupId, seedPlacement } from './placement'
import type { Args, Handler } from './shared'
import { diagramOrRefusal, hexColour, onDiagram } from './shared'

export const moveBy: Handler = (args, view) => {
  const placed = onDiagram(args, view)
  if ('ok' in placed) return placed
  const { diagram, placements } = placed
  const dx = args.dx as number
  const dy = args.dy as number
  const moved = placements.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
  return {
    command: placeOn(diagram.id, moved, undefined, { origin: 'agent' }),
    answer: json({ diagramId: diagram.id, moved: moved.map(({ id: elementId, x, y }) => ({ id: elementId, x, y })) }),
  }
}

type Side = 'right' | 'left' | 'above' | 'below'

/** The spot `gap` away from the anchor's rectangle on that side, for a card of this size. */
function besideOf(side: Side, anchor: Rect, mine: Rect, gap: number): { x: number; y: number } {
  if (side === 'right') return { x: anchor.x + anchor.width + gap, y: anchor.y }
  if (side === 'left') return { x: anchor.x - gap - mine.width, y: anchor.y }
  if (side === 'above') return { x: anchor.x, y: anchor.y - gap - mine.height }
  return { x: anchor.x, y: anchor.y + anchor.height + gap }
}

export const placeNextTo: Handler = (args, view) => {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const elementId = args.elementId as string
  const anchorId = args.anchorId as string
  const element = model.elements[elementId]
  const anchor = model.elements[anchorId]
  if (!element) return refused('agent.unknownId', `element ${elementId}`)
  if (!anchor) return refused('agent.unknownId', `element ${anchorId}`)
  const anchorPlacement = placedOn(diagram, anchorId)
  if (!anchorPlacement) return refused('agent.notDrawn', anchorId)
  const held = placedOn(diagram, elementId)
  if (!held) return refused('agent.notDrawn', elementId)
  const gap = (args.gap as number | undefined) ?? 40
  const side = (args.side as Side | undefined) ?? 'right'
  const a = placementRect(nodeFigure(anchor, anchorPlacement.zone), anchorPlacement)
  const mine = placementRect(nodeFigure(element, held.zone), held)
  const spot = besideOf(side, a, mine, gap)
  const beside: PlacedNode = {
    ...held, ...spot,
    ...(anchorPlacement.zone !== undefined ? { zone: anchorPlacement.zone } : {}),
    ...(anchorPlacement.group !== undefined ? { group: anchorPlacement.group } : {}),
  }
  if ((beside.zone ?? 'landscape') !== 'landscape') delete beside.group
  // Beside its anchor in the anchor's band means inside that band: right of
  // the last card in a side band is outside it, and the report would say so.
  const placement = diagram.kind === 'layer7' ? keptInBand(model, diagram, element, beside) : beside
  const commands: Command[] = [placeOn(diagram.id, [placement])]
  const layout = diagram.kind === 'layer7' && placement.group !== undefined
    ? growGroup(diagram, placement.group, placementRect(nodeFigure(element, placement.zone), placement)) : undefined
  if (layout) commands.push(layout)
  const clamped = placement.x !== spot.x || placement.y !== spot.y
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, elementId, x: placement.x, y: placement.y, zone: placement.zone,
      domainGroup: groupNameOn(diagram, placement.group),
      ...(clamped ? { clamped: true, note: 'Moved to stay inside its band.' } : {}),
    }),
  }
}

export const placeElement: Handler = (args, view) => {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const id = args.id as string
  const element = model.elements[id]
  if (!element) return refused('agent.unknownId', `element ${id}`)
  const held = placedOn(diagram, id)!
  if (!held) return refused('agent.notDrawn', id)
  const zone = args.zone as Layer7Zone | undefined
  const group = args.domainGroup as string | null | undefined
  if (diagram.kind !== 'layer7' && (zone !== undefined || group !== undefined)) {
    return refused('agent.badArguments', 'bands and domain groups are a landscape\'s')
  }
  const asked = typeof args.x === 'number' && typeof args.y === 'number' ? { x: args.x, y: args.y } : undefined
  if (asked === undefined && (typeof args.x === 'number' || typeof args.y === 'number')) {
    return refused('agent.badArguments', 'give x and y together')
  }

  const moved: PlacedNode = { ...held, ...(asked ?? {}) }
  const next = diagram.kind === 'layer7'
    ? placedOnLandscape({ model, diagram, element, id, held, zone, group, asked }, moved)
    : moved
  if ('ok' in next) return next

  const commands: Command[] = [placeOn(diagram.id, [next])]
  const layout = next.group === undefined ? undefined : growGroup(diagram, next.group, placementRect(nodeFigure(element, next.zone), next))
  if (layout) commands.push(layout)
  const clamped = asked !== undefined && (next.x !== asked.x || next.y !== asked.y)
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, elementId: id, x: next.x, y: next.y, zone: next.zone,
      domainGroup: groupNameOn(diagram, next.group),
      ...(clamped ? { clamped: true, note: 'Moved to stay inside its band.' } : {}),
    }),
  }
}

/** What `element.place` asked of a card on a landscape. */
type LandscapeMove = {
  readonly model: Model
  readonly diagram: Diagram
  readonly element: DesignElement
  readonly id: string
  readonly held: PlacedNode
  readonly zone: Layer7Zone | undefined
  readonly group: string | null | undefined
  readonly asked: { x: number; y: number } | undefined
}

/** A card moved on a landscape: into the band it was told, under the group it was told, kept inside both. */
function placedOnLandscape(move: LandscapeMove, moved: PlacedNode): PlacedNode | AgentAnswer {
  const { model, diagram, element, id, held, zone, group, asked } = move
  let next = moved
  if (zone !== undefined) {
    next.zone = zone
    if (zone !== 'landscape') delete next.group
  } else if (asked) {
    // A spot in another band than the card is filed in is a contradiction
    // the report would flag straight away; the band has to be said.
    const filed = held.zone ?? 'landscape'
    const actually = zoneForPoint(rectCenter(placementRect(nodeFigure(element, next.zone), next)), diagram)
    if (actually !== filed) return refused('agent.badArguments', `(${asked.x}, ${asked.y}) is in the ${actually} band; say zone: ${actually} to move it there`)
  }
  if (group === null) delete next.group
  else if (typeof group === 'string') {
    const name = group.trim()
    if ((next.zone ?? 'landscape') !== 'landscape') return refused('agent.badArguments', `${id} is in the ${next.zone} band; only landscape cards can be grouped`)
    const named = groupNamed(diagram, name)
    const box = named && groupBox(diagram, named.id)
    if (!named || !box) return refused('agent.unknownId', `domain group ${name}; make one with group`)
    if (!asked) {
      const others = membersOf(model, diagram, named.id).filter(([member]) => member !== id).map(([, rect]) => rect)
      next = { ...next, ...freeSlotIn(box, nodeFigure(element, next.zone), others) }
    }
    next.group = named.id
  }
  return keptInBand(model, diagram, element, next)
}

export const drawElement: Handler = (args, view) => {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const id = args.id as string
  const element = model.elements[id]
  if (!element) return refused('agent.unknownId', `element ${id}`)
  if (placedOn(diagram, id)) return refused('agent.badArguments', `${id} is drawn on ${diagram.id} already; element.place moves it`)
  if (!canPlaceKind(element.kind, diagram.kind).ok) {
    return refused('agent.badArguments', `a ${element.kind} is not drawn on a ${diagram.kind} view`)
  }
  const seeded = seedPlacement(model, diagram, id, element, args)
  if ('ok' in seeded) return seeded
  const { placement, layout } = seeded
  return {
    command: transaction([
      placeOn(diagram.id, [placement]),
      ...(layout ? [layout] : []),
    ], { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, elementId: id, x: placement.x, y: placement.y, zone: placement.zone,
      domainGroup: groupNameOn(diagram, placement.group),
    }),
  }
}

export const undrawElement: Handler = (args, view) => {
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const id = args.id as string
  if (!view.model.elements[id]) return refused('agent.unknownId', `element ${id}`)
  if (!placedOn(diagram, id)) return refused('agent.notDrawn', id)
  return {
    command: { type: 'member.remove', diagramId: diagram.id, elementIds: [id], origin: 'agent' },
    answer: json({ diagramId: diagram.id, elementId: id, undrawn: true }),
  }
}

// --- domain groups ----------------------------------------------------------------------

/** The landscape a group tool is about, or the refusal: domain groups are drawn nowhere else. */
function landscapeOf(args: Args, view: ReadView): Diagram | AgentAnswer {
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  if (diagram.kind !== 'layer7') return refused('agent.badArguments', 'domain groups are drawn on a landscape')
  return diagram
}

/** The named cards, drawn in the landscape band, or the first refusal. */
function groupable(args: Args, model: Model, diagram: Diagram): PlacedNode[] | AgentAnswer {
  const placements: PlacedNode[] = []
  for (const id of (args.elementIds as string[] | undefined) ?? []) {
    if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    const held = placedOn(diagram, id)!
    if (!held) return refused('agent.notDrawn', id)
    if ((held.zone ?? 'landscape') !== 'landscape') {
      return refused('agent.badArguments', `${id} is in the ${held.zone} band; only landscape cards can be grouped`)
    }
    placements.push(held)
  }
  return placements
}

/**
 * File elements under a domain group and draw its box. The box is the
 * editor's own "Group into new domain group" maths around the members, and an
 * existing box is never moved or shrunk: it grows to the union of itself and
 * what it now holds, so a card already inside stays inside.
 */
export const groupElements: Handler = (args, view) => {
  const { model } = view
  const diagram = landscapeOf(args, view)
  if ('ok' in diagram) return diagram
  const name = (args.name as string).trim()
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  const color = args.color === undefined || args.color === null ? undefined : hexColour(args.color)
  if (color === false) return refused('agent.badArguments', '"color" must be a hex colour like #2e86c1')
  const placements = groupable(args, model, diagram)
  if ('ok' in placements) return placements

  const known = groupNamed(diagram, name)
  const groupId = known?.id ?? newGroupId(diagram, name)
  const existing = boxesOf(diagram)[groupId]
  if (!known && placements.length === 0) return refused('agent.badArguments', 'a new group needs at least one element')

  const around = groupRectAround(placements.map((p) => placementRect(nodeFigure(model.elements[p.id], p.zone), p)))
  const box = unionRects([...(existing ? [existing] : []), ...(around ? [around] : [])])!
  const rect: DomainGroupRect = { id: groupId, x: box.x, y: box.y, width: box.width, height: box.height }

  // The colour is the group's, not its box's (ADR-0012 §6): `''` clears it,
  // absent leaves whatever the group already says.
  const tint = color === undefined ? known?.color : color === '' ? undefined : color
  const record: DiagramGroup = { id: groupId, name, ...(tint !== undefined ? { color: tint } : {}) }

  const filed = placements.filter((p) => p.group !== groupId).map((p) => ({ ...p, group: groupId }))
  return {
    command: transaction([
      { type: 'group.set', diagramId: diagram.id, groups: [record] },
      { type: 'box.set', diagramId: diagram.id, boxes: [rect] },
      ...(filed.length ? [{ type: 'member.set' as const, diagramId: diagram.id, members: filed.map(memberOf) }] : []),
    ], { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, name, created: !known, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      members: placements.map((p) => p.id),
    }),
  }
}

export const ungroup: Handler = (args, view) => {
  const { model } = view
  const diagram = landscapeOf(args, view)
  if ('ok' in diagram) return diagram
  const name = (args.name as string).trim()
  const held = groupNamed(diagram, name)
  if (!held) return refused('agent.unknownId', `domain group ${name}`)
  const members = membersOf(model, diagram, held.id).map(([id]) => id)
  const named = args.elementIds as string[] | undefined
  const leaving = named ?? members
  for (const id of leaving) {
    if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    if (!placedOn(diagram, id)) return refused('agent.notDrawn', id)
    if (placedOn(diagram, id)!.group !== held.id) return refused('agent.badArguments', `${id} is not in ${name}`)
  }
  const unfiled = leaving.map((id) => {
    const { group: _group, ...rest } = placedOn(diagram, id)!
    void _group
    return rest
  })
  const commands: Command[] = []
  if (unfiled.length) commands.push({ type: 'member.set', diagramId: diagram.id, members: unfiled.map(memberOf) })
  // Dissolving takes the group's record, and `group.remove` takes its box: a
  // group nothing is in and nothing draws is not a group.
  if (named === undefined) {
    commands.push({ type: 'group.remove', diagramId: diagram.id, groupIds: [held.id] })
  }
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ diagramId: diagram.id, name, dissolved: named === undefined, unfiled: leaving }),
  }
}

// --- lining up --------------------------------------------------------------------------

/** `align` and `distribute`: the layout's own arithmetic over the named cards' rectangles. */
function arrange(how: 'align' | 'distribute'): Handler {
  return (args, view) => {
    const placed = onDiagram(args, view)
    if ('ok' in placed) return placed
    const { diagram, placements } = placed
    const bounds: NodeBounds[] = placements.map((p) => ({ id: p.id, ...placementRect(nodeFigure(view.model.elements[p.id], p.zone), p) }))
    const updates = how === 'align'
      ? alignNodes(bounds, args.axis as AlignAxis)
      : distributeNodes(bounds, args.axis as DistributeAxis)
    const moved = updates.map((u) => ({ ...placedOn(diagram, u.id)!, x: u.x, y: u.y }))
    return {
      command: placeOn(diagram.id, moved, undefined, { origin: 'agent' }),
      answer: json({ diagramId: diagram.id, moved: updates }),
    }
  }
}

export const align = arrange('align')
export const distribute = arrange('distribute')
