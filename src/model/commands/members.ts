// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** What is on a view, and where it ended up (ADR-0012 §6). */
import { NOTHING, transaction } from '../commands'
import type { Command } from '../commands'
import type { DiagramMember, ElementId, NodeGeometry } from '../types'
import { gone, ok } from './handler'
import type { CommandTable } from './handler'
import { drop, same, setDiagram, withMembers } from './rows'
import type { Rows } from './rows'

export const MEMBER_COMMANDS = {
  'member.set': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      // Built in one pass rather than one `put` per row: a whole-board set —
      // a tidy pass, a restore — carries thousands, and a record copied per
      // row is quadratic. The order array keeps its identity when nothing
      // was inserted, which is what tells `withMembers` nothing moved.
      const by = { ...diagram.members }
      let order = diagram.order.members
      const restore: DiagramMember[] = []
      const restoreAt: number[] = []
      const remove: ElementId[] = []
      let changed = false
      command.members.forEach((member, i) => {
        const id = member.id
        if (!model.elements[id]) return
        const held = by[id]
        if (held) {
          // A drag re-states the band a card is already in; saying the same
          // thing is not a change, and a fresh object would make it look like
          // one to everything memoised below (and to `diff.ts`).
          if (same(held, member)) return
          restore.push(held)
          restoreAt.push(order.indexOf(id))
        } else {
          remove.push(id)
          if (order === diagram.order.members) order = [...order]
          order.splice(command.at?.[i] ?? order.length, 0, id)
        }
        changed = true
        by[id] = member
      })
      if (!changed) return ok(model, NOTHING, meta)
      const undo: Command[] = []
      if (remove.length) undo.push({ type: 'member.remove', diagramId: command.diagramId, elementIds: remove })
      if (restore.length) {
        undo.push({ type: 'member.set', diagramId: command.diagramId, members: restore, at: restoreAt })
      }
      return ok(
        setDiagram(model, command.diagramId, withMembers(diagram, { by, order })),
        transaction(undo, meta),
        meta,
      )
    },
  },

  'member.remove': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      let rows: Rows<DiagramMember> = { by: diagram.members, order: diagram.order.members }
      const nodes = { ...diagram.nodes }
      const restore: DiagramMember[] = []
      const restoreAt: number[] = []
      const geometry: NodeGeometry[] = []
      // Ascending, so putting them back one at a time lands each on its own index.
      for (const id of diagram.order.members) {
        if (!command.elementIds.includes(id)) continue
        restore.push(diagram.members[id])
        restoreAt.push(diagram.order.members.indexOf(id))
        if (nodes[id]) geometry.push(nodes[id])
        delete nodes[id]
        rows = drop(rows.by, rows.order, id)
      }
      if (!restore.length) return ok(model, NOTHING, meta)
      const undo: Command[] = [
        { type: 'member.set', diagramId: command.diagramId, members: restore, at: restoreAt },
      ]
      if (geometry.length) undo.push({ type: 'node.set', diagramId: command.diagramId, nodes: geometry })
      return ok(
        setDiagram(model, command.diagramId, { ...withMembers(diagram, rows), nodes }),
        transaction(undo, meta),
        meta,
      )
    },
  },

  'node.set': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const nodes = { ...diagram.nodes }
      const restore: NodeGeometry[] = []
      const clear: ElementId[] = []
      for (const node of command.nodes) {
        // A node is on a view because a MEMBER row says so; a coordinate for
        // something that is not on it has nothing to be about.
        if (!diagram.members[node.id]) continue
        const held = nodes[node.id]
        if (held && same(held, node)) continue
        if (held) restore.push(held)
        else clear.push(node.id)
        nodes[node.id] = node
      }
      if (!restore.length && !clear.length) return ok(model, NOTHING, meta)
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'node.remove', diagramId: command.diagramId, elementIds: clear })
      if (restore.length) undo.push({ type: 'node.set', diagramId: command.diagramId, nodes: restore })
      return ok(
        setDiagram(model, command.diagramId, { ...diagram, nodes }),
        transaction(undo, meta),
        meta,
      )
    },
  },

  'node.remove': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const nodes = { ...diagram.nodes }
      const restore: NodeGeometry[] = []
      for (const id of command.elementIds) {
        if (!nodes[id]) continue
        restore.push(nodes[id])
        delete nodes[id]
      }
      if (!restore.length) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.diagramId, { ...diagram, nodes }),
        { type: 'node.set', diagramId: command.diagramId, nodes: restore },
        meta,
      )
    },
  },
} satisfies Partial<CommandTable>
