// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a sheet's poster keeps beyond its blocks (ADR-0048): a tile placed by
 * hand, and a free note or picture. A block is `node.set` and the stakeholder
 * column `box.set`, the commands a board's cards and boxes already have.
 *
 * Geometry and presentation, on this view only: none of it is a fact about the
 * model, which is why a tile moved to another area is `element.update` and this
 * only clears where it had been put.
 */
import { NOTHING, transaction } from '../commands'
import type { Command } from '../commands'
import type { Diagram } from '../normalised'
import type { ElementId, PosterCell, PosterItem, PosterItemPlace } from '../types'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { patched, same, setDiagram } from './rows'
import { each } from './writes'

/** The fields of a free item but its id. */
const ITEM_FIELDS: PatchKeys<'poster.item.update'> = { kind: true, text: true, image: true, alt: true }

const itemsOf = (diagram: Diagram): readonly PosterItem[] => diagram.poster?.items ?? []

/**
 * A view with these items. No list and no `poster` is said once they are gone,
 * so an item added and taken back leaves the view as it was found.
 */
function withItems(diagram: Diagram, items: readonly PosterItem[]): Diagram {
  const { items: _held, ...settings } = diagram.poster ?? {}
  const poster = items.length ? { ...settings, items: [...items] } : settings
  const { poster: _poster, ...rest } = diagram
  return Object.keys(poster).length ? { ...rest, poster } : rest
}

/** A view with these rows in its geometry, or with no key at all once they are gone. */
function withRows<K extends 'cells' | 'itemPlaces'>(diagram: Diagram, key: K, rows: NonNullable<Diagram[K]>): Diagram {
  const { [key]: _held, ...rest } = diagram
  return (Object.keys(rows).length ? { ...rest, [key]: rows } : rest) as Diagram
}

export const POSTER_COMMANDS = {
  'cell.set': {
    carries: { diagramId: true, cells: true },
    writes: (command) => each(`diagram/${command.diagramId}/cell`, command.cells.map((cell) => cell.id)),
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      if (diagram.kind !== 'sheet') return ok(model, NOTHING, meta)
      const cells = { ...diagram.cells }
      const restore: PosterCell[] = []
      const clear: ElementId[] = []
      for (const cell of command.cells) {
        // As with a node: a place for something the scope does not hold is about nothing.
        if (!model.elements[cell.id]) continue
        const held = cells[cell.id]
        if (held && same(held, cell)) continue
        if (held) restore.push(held)
        else clear.push(cell.id)
        cells[cell.id] = cell
      }
      if (!restore.length && !clear.length) return ok(model, NOTHING, meta)
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'cell.remove', diagramId: command.diagramId, elementIds: clear })
      if (restore.length) undo.push({ type: 'cell.set', diagramId: command.diagramId, cells: restore })
      return ok(setDiagram(model, command.diagramId, withRows(diagram, 'cells', cells)), transaction(undo, meta), meta)
    },
  },

  'cell.remove': {
    carries: { diagramId: true, elementIds: true },
    writes: (command) => each(`diagram/${command.diagramId}/cell`, command.elementIds),
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const cells = { ...diagram.cells }
      const restore: PosterCell[] = []
      for (const id of command.elementIds) {
        if (!cells[id]) continue
        restore.push(cells[id])
        delete cells[id]
      }
      if (!restore.length) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.diagramId, withRows(diagram, 'cells', cells)),
        { type: 'cell.set', diagramId: command.diagramId, cells: restore },
        meta,
      )
    },
  },

  'poster.item.add': {
    carries: { diagramId: true, item: true, place: true },
    writes: (command) => [`diagram/${command.diagramId}/poster/items/${command.item.id}`],
    apply(model, command, { meta }) {
      const { diagramId, item, place, at } = command
      const diagram = model.diagrams[diagramId]
      if (!diagram) return gone
      if (diagram.kind !== 'sheet') return ok(model, NOTHING, meta)
      const items = itemsOf(diagram)
      if (items.some((one) => one.id === item.id)) return taken
      const next = [...items]
      next.splice(at ?? next.length, 0, item)
      const placed = withRows(withItems(diagram, next), 'itemPlaces', { ...diagram.itemPlaces, [item.id]: { ...place, id: item.id } })
      return ok(setDiagram(model, diagramId, placed), { type: 'poster.item.remove', diagramId, id: item.id }, meta)
    },
  },

  'poster.item.update': {
    carries: { diagramId: true, id: true, patch: true },
    patch: { keys: ITEM_FIELDS, row: (model, command) => itemsOf(model.diagrams[command.diagramId] ?? ({} as Diagram)).find((one) => one.id === command.id) },
    writes: (command) => [`diagram/${command.diagramId}/poster/items/${command.id}`],
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      const item = diagram && itemsOf(diagram).find((one) => one.id === command.id)
      if (!diagram || !item) return gone
      const { row, inverse } = patched(item, command.patch)
      const items = itemsOf(diagram).map((one) => (one.id === command.id ? row : one))
      return ok(
        setDiagram(model, command.diagramId, withItems(diagram, items)),
        { type: 'poster.item.update', diagramId: command.diagramId, id: command.id, patch: inverse },
        meta,
      )
    },
  },

  'poster.item.place': {
    carries: { diagramId: true, place: true },
    writes: (command) => [`diagram/${command.diagramId}/item/${command.place.id}`],
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      const held = diagram?.itemPlaces?.[command.place.id]
      if (!diagram || !held) return gone
      if (same(held, command.place)) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.diagramId, withRows(diagram, 'itemPlaces', { ...diagram.itemPlaces, [held.id]: command.place })),
        { type: 'poster.item.place', diagramId: command.diagramId, place: held },
        meta,
      )
    },
  },

  'poster.item.remove': {
    carries: { diagramId: true, id: true },
    writes: (command) => [`diagram/${command.diagramId}/poster/items/${command.id}`, `diagram/${command.diagramId}/item/${command.id}`],
    apply(model, command, { meta }) {
      const { diagramId, id } = command
      const diagram = model.diagrams[diagramId]
      const items = diagram ? itemsOf(diagram) : []
      const at = items.findIndex((one) => one.id === id)
      if (!diagram || at < 0) return gone
      const places = { ...diagram.itemPlaces }
      const place: PosterItemPlace = places[id] ?? { id, x: 0, y: 0, width: 0, height: 0 }
      delete places[id]
      return ok(
        setDiagram(model, diagramId, withRows(withItems(diagram, items.filter((one) => one.id !== id)), 'itemPlaces', places)),
        { type: 'poster.item.add', diagramId, item: items[at], place, at },
        meta,
      )
    },
  },
} satisfies Partial<CommandTable>
