// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A sheet's poster, by an agent (ADR-0048). The tools that place a card on a board
 * place a block here: an area or the journey by its element's id, the stakeholder
 * column as `rail`, a free note or picture by its own id. A tile is placed in a
 * cell of its block, or flows.
 *
 * Arithmetic on fixed sizes, so all of it needs no screen and lands alike on a
 * desktop and on a server. The first block placed writes every block, as a
 * person's first move does: the poster stops following the first layout at once,
 * rather than having the blocks nobody named move under the one that was.
 */
import type { Command } from '../../model/commands'
import { clearPlaces, transaction } from '../../model/commands'
import type { Diagram } from '../../model/normalised'
import { fromDiagram, SHEET_COLUMN_BOX, toArrays } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { PosterItem, Rect } from '../../model/types'
import { freePlace, overlapsOf, POSTER_GAP, POSTER_WIDTH } from '../../business/posterLayout'
import type { PosterBlock } from '../../business/posterLayout'
import { posterPlaces } from '../../business/posterPlaces'
import type { PosterPlaces } from '../../business/posterPlaces'
import { sheetPage } from '../../business/sheet'
import type { LaidOutSheet } from '../../business/sheet'
import { alignNodes, distributeNodes } from '../../layout/alignDistribute'
import type { AlignAxis, DistributeAxis } from '../../layout/alignDistribute'
import type { ReadView } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'
import { diagramOrRefusal, text } from './shared'

const ITEM_SIZE = { width: 220, height: 120 }

/** A sheet as an agent places on it. */
type Placing = { diagram: Diagram; page: LaidOutSheet; places: PosterPlaces }

function placingOn(diagram: Diagram, view: ReadView): Placing {
  const page = sheetPage(toArrays(view.model), diagram, [], {})
  return { diagram, page, places: posterPlaces(page, fromDiagram(diagram)) }
}

/** What an id is on this poster, and where it is. */
function found(id: string, on: Placing): { kind: 'block' | 'item'; rect: Rect } | AgentAnswer {
  const { diagram, places, page } = on
  const block = [...places.blocks, ...places.waiting].find((one) => one.id === id)
  if (block) return { kind: 'block', rect: block }
  const item = diagram.itemPlaces?.[id]
  if (item) return { kind: 'item', rect: item }
  if (isTileOn(page, id)) return refused('agent.badArguments', `${id} is a tile: it flows in its block, and element.place with cell puts it in one`)
  if (isGroupingOn(page, id)) return refused('agent.badArguments', `${id} is a grouping: it flows inside its area, so place the area`)
  return refused('agent.notDrawn', id)
}

function isTileOn(page: LaidOutSheet, id: string): boolean {
  return page.areas.some((area) => [...area.capabilities, ...area.groupings.flatMap((group) => group.capabilities)].some((tile) => tile.element.id === id))
}

function isGroupingOn(page: LaidOutSheet, id: string): boolean {
  return page.areas.some((area) => area.groupings.some((group) => group.element.id === id))
}

const isAnswer = (value: object): value is AgentAnswer => 'ok' in value

/**
 * The commands that put these where they are said to go: an item by its own, a
 * block by its node or the column's box, and every other block with them when
 * nothing has been placed yet.
 */
function moving(on: Placing, moved: ReadonlyMap<string, Rect>): Command[] {
  const { diagram, places } = on
  const diagramId = diagram.id
  const asMoved = (block: PosterBlock): PosterBlock => ({ ...block, ...moved.get(block.id), id: block.id })
  const blocks = [...places.blocks, ...places.waiting]
  const landing = (places.placed ? blocks.filter((block) => moved.has(block.id)) : blocks).map(asMoved)
  const nodes = landing.filter((block) => block.id !== SHEET_COLUMN_BOX)
  const column = landing.filter((block) => block.id === SHEET_COLUMN_BOX)
  const items = [...moved].filter(([id]) => diagram.itemPlaces?.[id])
  return [
    ...(nodes.length ? [{ type: 'node.set' as const, diagramId, nodes }] : []),
    ...(column.length ? [{ type: 'box.set' as const, diagramId, boxes: column }] : []),
    ...items.map(([id, rect]) => ({ type: 'poster.item.place' as const, diagramId, place: { id, x: rect.x, y: rect.y, width: rect.width, height: rect.height } })),
  ]
}

/** How the page stands once these commands have landed, for an answer to say what they did to it. */
function overlapsAfter(on: Placing, commands: readonly Command[], view: ReadView): { id: string; overlaps?: { a: string; b: string }[] } {
  const trial = apply(view.model, transaction([...commands]))
  const diagram = trial.ok ? trial.model.diagrams[on.diagram.id] : undefined
  if (!trial.ok || !diagram) return { id: on.diagram.id }
  const overlaps = overlapsOf(posterPlaces(on.page, fromDiagram(diagram)).blocks)
  return { id: on.diagram.id, ...(overlaps.length ? { overlaps } : {}) }
}

function landed(on: Placing, commands: Command[], view: ReadView, said: Record<string, unknown>): Prepared {
  const { id: diagramId, overlaps } = overlapsAfter(on, commands, view)
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ diagramId, ...said, ...(overlaps ? { overlaps, note: 'These blocks now lie over one another: a place is yours to change, and nothing moves them by itself.' } : {}) }),
  }
}

/** The named blocks and items with where they are, or the first refusal. */
function named(ids: readonly string[], on: Placing): { id: string; rect: Rect }[] | AgentAnswer {
  const held: { id: string; rect: Rect }[] = []
  for (const id of ids) {
    const thing = found(id, on)
    if (isAnswer(thing)) return thing
    held.push({ id, rect: thing.rect })
  }
  return held
}

export function moveByOnSheet(args: Args, diagram: Diagram, view: ReadView): Prepared | AgentAnswer {
  const on = placingOn(diagram, view)
  const things = named(args.elementIds as string[], on)
  if (isAnswer(things as object)) return things as AgentAnswer
  const dx = args.dx as number
  const dy = args.dy as number
  const moved = new Map((things as { id: string; rect: Rect }[]).map(({ id, rect }) => [id, { ...rect, x: rect.x + dx, y: rect.y + dy }]))
  return landed(on, moving(on, moved), view, { moved: [...moved].map(([id, rect]) => ({ id, x: rect.x, y: rect.y })) })
}

type Side = 'right' | 'left' | 'above' | 'below'

export function placeNextToOnSheet(args: Args, diagram: Diagram, view: ReadView): Prepared | AgentAnswer {
  const on = placingOn(diagram, view)
  const mine = found(args.elementId as string, on)
  if (isAnswer(mine)) return mine
  const anchor = found(args.anchorId as string, on)
  if (isAnswer(anchor)) return anchor
  const gap = (args.gap as number | undefined) ?? POSTER_GAP
  const side = (args.side as Side | undefined) ?? 'right'
  const { rect: a } = anchor
  const { rect: m } = mine
  const spot = side === 'right' ? { x: a.x + a.width + gap, y: a.y }
    : side === 'left' ? { x: a.x - gap - m.width, y: a.y }
      : side === 'above' ? { x: a.x, y: a.y - gap - m.height }
        : { x: a.x, y: a.y + a.height + gap }
  const moved = new Map([[args.elementId as string, { ...m, ...spot }]])
  return landed(on, moving(on, moved), view, { elementId: args.elementId, ...spot })
}

export function arrangeOnSheet(how: 'align' | 'distribute', args: Args, diagram: Diagram, view: ReadView): Prepared | AgentAnswer {
  const on = placingOn(diagram, view)
  const things = named(args.elementIds as string[], on)
  if (isAnswer(things as object)) return things as AgentAnswer
  const list = things as { id: string; rect: Rect }[]
  const bounds = list.map(({ id, rect }) => ({ id, ...rect }))
  const updates = how === 'align' ? alignNodes(bounds, args.axis as AlignAxis) : distributeNodes(bounds, args.axis as DistributeAxis)
  const rects = new Map(list.map(({ id, rect }) => [id, rect]))
  const moved = new Map(updates.map((update) => [update.id, { ...rects.get(update.id)!, x: update.x, y: update.y }]))
  return landed(on, moving(on, moved), view, { moved: updates })
}

/** A tile's cell: a whole column and row from the block's top left, and how many columns it takes. */
function cellOf(args: Args, id: string): { col: number; row: number; span?: number } | AgentAnswer {
  const cell = args.cell as { col: number; row: number; span?: number }
  if (cell.col < 0 || cell.row < 0) return refused('agent.badArguments', `${id}: a cell counts from 0, top left`)
  if (cell.span !== undefined && cell.span !== null && cell.span < 1) return refused('agent.badArguments', `${id}: a cell spans at least one column`)
  return { col: cell.col, row: cell.row, ...(typeof cell.span === 'number' && cell.span > 1 ? { span: cell.span } : {}) }
}

export function placeOnSheet(args: Args, diagram: Diagram, view: ReadView): Prepared | AgentAnswer {
  const id = args.id as string
  const on = placingOn(diagram, view)
  if (args.zone !== undefined || args.domainGroup !== undefined) return refused('agent.badArguments', 'bands and domain groups are a landscape\'s')
  if (args.cell !== undefined) {
    if (!isTileOn(on.page, id)) return refused('agent.badArguments', `${id} is no tile on this sheet: only a tile has a cell`)
    if (args.cell === null) {
      return landed(on, [{ type: 'cell.remove', diagramId: diagram.id, elementIds: [id] }], view, { elementId: id, flows: true })
    }
    const cell = cellOf(args, id)
    if (isAnswer(cell)) return cell
    return landed(on, [{ type: 'cell.set', diagramId: diagram.id, cells: [{ id, ...cell }] }], view, { elementId: id, cell })
  }
  const thing = found(id, on)
  if (isAnswer(thing)) return thing
  const asked = typeof args.x === 'number' && typeof args.y === 'number' ? { x: args.x, y: args.y } : undefined
  if (asked === undefined && (typeof args.x === 'number' || typeof args.y === 'number')) return refused('agent.badArguments', 'give x and y together')
  for (const side of ['width', 'height'] as const) {
    if (typeof args[side] === 'number' && (args[side] as number) <= 0) return refused('agent.badArguments', `"${side}" must be more than nothing`)
  }
  const rect: Rect = {
    ...thing.rect, ...(asked ?? {}),
    ...(typeof args.width === 'number' ? { width: args.width } : {}),
    ...(typeof args.height === 'number' ? { height: args.height } : {}),
  }
  return landed(on, moving(on, new Map([[id, rect]])), view, { elementId: id, x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

/**
 * First layout, or with `tiles` Reset tiles: what a sheet has been told is taken
 * back, as one step, and it computes again. Free items stay.
 */
export function tidySheet(args: Args, diagram: Diagram, view: ReadView): Prepared {
  const commands = args.tiles === true
    ? clearPlaces(view.model, diagram.id).filter((command) => command.type === 'cell.remove')
    : clearPlaces(view.model, diagram.id)
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ diagramId: diagram.id, cleared: args.tiles === true ? 'tiles' : 'places', changed: commands.length > 0 }),
  }
}

// --- free items -------------------------------------------------------------------------

/** A picture's address, held to the scope's images where the host says which there are. */
function imageOf(value: unknown, view: WriteView): string | AgentAnswer {
  if (typeof value !== 'string' || !value.startsWith('sha256:')) return refused('agent.badArguments', '"image" is a content address from images.list (sha256:…)')
  const held = view.imageAddresses?.()
  if (held && !held.has(value)) return refused('agent.unknownId', `image ${value}; upload it first with image.upload`)
  return value
}

function sheetNamed(args: Args, view: ReadView): Diagram | AgentAnswer {
  const diagram = diagramOrRefusal(args, view)
  if (isAnswer(diagram)) return diagram
  if (diagram.kind !== 'sheet') return refused('agent.badArguments', 'a free item is on a sheet\'s poster')
  return diagram
}

export const addPosterItem: Handler = (args, view) => {
  const diagram = sheetNamed(args, view)
  if (isAnswer(diagram)) return diagram
  const kind = args.kind as PosterItem['kind']
  const id = view.makeId('item')
  let item: PosterItem
  if (kind === 'note') {
    const words = text(args.text)
    if (!words) return refused('agent.badArguments', 'a note says something: "text"')
    item = { id, kind, text: words }
  } else {
    const alt = text(args.alt)
    if (!alt) return refused('agent.badArguments', 'a picture says in words what it shows: "alt"')
    const image = imageOf(args.image, view)
    if (typeof image !== 'string') return image
    item = { id, kind, image, alt }
  }
  const on = placingOn(diagram, view)
  const size = { width: (args.width as number | undefined) ?? ITEM_SIZE.width, height: (args.height as number | undefined) ?? ITEM_SIZE.height }
  const others = [...on.places.blocks, ...Object.values(diagram.itemPlaces ?? {})]
  const free = freePlace(others, size, { width: POSTER_WIDTH, height: Math.max(on.places.height, size.height) })
  const spot = typeof args.x === 'number' && typeof args.y === 'number' ? { x: args.x, y: args.y } : free ?? { x: 0, y: on.places.height + POSTER_GAP }
  const place = { id, ...spot, ...size }
  return {
    command: { type: 'poster.item.add', diagramId: diagram.id, item, place, origin: 'agent' },
    answer: json({ diagramId: diagram.id, id, kind, x: place.x, y: place.y, width: place.width, height: place.height }),
  }
}

export const updatePosterItem: Handler = (args, view) => {
  const diagram = sheetNamed(args, view)
  if (isAnswer(diagram)) return diagram
  const id = args.id as string
  const held = diagram.poster?.items?.find((one) => one.id === id)
  if (!held) return refused('agent.unknownId', `item ${id}`)
  const patch: Partial<Omit<PosterItem, 'id'>> = {}
  if (held.kind === 'note') {
    if (args.image !== undefined || args.alt !== undefined) return refused('agent.badArguments', `${id} is a note: it has "text"`)
    if (args.text !== undefined) {
      const words = text(args.text)
      if (!words) return refused('agent.badArguments', 'a note says something: remove it with posterItem.remove')
      patch.text = words
    }
  } else {
    if (args.text !== undefined) return refused('agent.badArguments', `${id} is a picture: it has "image" and "alt"`)
    if (args.alt !== undefined) {
      const alt = text(args.alt)
      if (!alt) return refused('agent.badArguments', 'a picture says in words what it shows: "alt"')
      patch.alt = alt
    }
    if (args.image !== undefined) {
      const image = imageOf(args.image, view)
      if (typeof image !== 'string') return image
      patch.image = image
    }
  }
  return {
    command: { type: 'poster.item.update', diagramId: diagram.id, id, patch, origin: 'agent' },
    answer: json({ diagramId: diagram.id, id, changed: Object.keys(patch) }),
  }
}

export const removePosterItem: Handler = (args, view) => {
  const diagram = sheetNamed(args, view)
  if (isAnswer(diagram)) return diagram
  const id = args.id as string
  if (!diagram.poster?.items?.some((one) => one.id === id)) return refused('agent.unknownId', `item ${id}`)
  return {
    command: { type: 'poster.item.remove', diagramId: diagram.id, id, origin: 'agent' },
    answer: json({ diagramId: diagram.id, id, removed: true }),
  }
}
