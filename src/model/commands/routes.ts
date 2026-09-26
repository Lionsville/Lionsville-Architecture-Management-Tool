// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Where a line runs on a view: set, and cleared back to the router's own. */
import { NOTHING, transaction } from '../commands'
import type { Command } from '../commands'
import type { RelationId } from '../normalised'
import { routesOf } from '../normalised'
import type { EdgeRoute } from '../types'
import { gone, ok } from './handler'
import type { CommandTable } from './handler'
import { drop, setDiagram, withRoutes } from './rows'
import type { Rows } from './rows'

export const ROUTE_COMMANDS = {
  'route.set': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      // One pass, for the reason `member.set` gives: a routing pass sets every line.
      const by = { ...routesOf(diagram) }
      let order = diagram.order.routes
      const restore: EdgeRoute[] = []
      const restoreAt: number[] = []
      const clear: RelationId[] = []
      command.routes.forEach((route, i) => {
        const id = route.relationId
        if (!model.relations[id]) return
        const held = by[id]
        if (held) {
          restore.push(held)
          restoreAt.push(order.indexOf(id))
        } else {
          clear.push(id)
          if (order === diagram.order.routes) order = [...order]
          order.splice(command.at?.[i] ?? order.length, 0, id)
        }
        by[id] = route
      })
      if (!restore.length && !clear.length) return ok(model, NOTHING, meta)
      const rows: Rows<EdgeRoute> = { by, order }
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'route.clear', diagramId: command.diagramId, relationIds: clear })
      if (restore.length) {
        undo.push({ type: 'route.set', diagramId: command.diagramId, routes: restore, at: restoreAt })
      }
      return ok(setDiagram(model, command.diagramId, withRoutes(diagram, rows)), transaction(undo, meta), meta)
    },
  },

  'route.clear': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const held = routesOf(diagram)
      let rows: Rows<EdgeRoute> = { by: held, order: diagram.order.routes }
      const restore: EdgeRoute[] = []
      const restoreAt: number[] = []
      for (const id of diagram.order.routes) {
        if (!command.relationIds.includes(id)) continue
        restore.push(held[id])
        restoreAt.push(diagram.order.routes.indexOf(id))
        rows = drop(rows.by, rows.order, id)
      }
      if (!restore.length) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.diagramId, withRoutes(diagram, rows)),
        { type: 'route.set', diagramId: command.diagramId, routes: restore, at: restoreAt },
        meta,
      )
    },
  },
} satisfies Partial<CommandTable>
