// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Dashed groups on a view, and the boxes drawn for them (ADR-0012 §6). */
import { NOTHING, transaction } from '../commands'
import type { Command } from '../commands'
import type { GroupId } from '../normalised'
import { boxesOf, groupsOf } from '../normalised'
import type { DiagramGroup, DomainGroupRect } from '../types'
import { gone, ok } from './handler'
import type { CommandTable } from './handler'
import { drop, same, setDiagram, withGroups } from './rows'
import type { Rows } from './rows'

export const GROUP_COMMANDS = {
  'box.set': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const boxes = { ...boxesOf(diagram) }
      const restore: DomainGroupRect[] = []
      const clear: GroupId[] = []
      for (const box of command.boxes) {
        // A box is about a group the view holds; one for a group nobody names
        // has no label to draw and no way to be renamed or recoloured.
        if (!groupsOf(diagram)[box.id]) continue
        const held = boxes[box.id]
        if (held && same(held, box)) continue
        if (held) restore.push(held)
        else clear.push(box.id)
        boxes[box.id] = box
      }
      if (!restore.length && !clear.length) return ok(model, NOTHING, meta)
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'box.remove', diagramId: command.diagramId, groupIds: clear })
      if (restore.length) undo.push({ type: 'box.set', diagramId: command.diagramId, boxes: restore })
      return ok(setDiagram(model, command.diagramId, { ...diagram, boxes }), transaction(undo, meta), meta)
    },
  },

  'box.remove': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const boxes = { ...boxesOf(diagram) }
      const restore: DomainGroupRect[] = []
      for (const id of command.groupIds) {
        if (!boxes[id]) continue
        restore.push(boxes[id])
        delete boxes[id]
      }
      if (!restore.length) return ok(model, NOTHING, meta)
      return ok(
        setDiagram(model, command.diagramId, { ...diagram, boxes }),
        { type: 'box.set', diagramId: command.diagramId, boxes: restore },
        meta,
      )
    },
  },

  'group.set': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const by = { ...groupsOf(diagram) }
      let order = diagram.order.groups
      const restore: DiagramGroup[] = []
      const restoreAt: number[] = []
      const remove: GroupId[] = []
      command.groups.forEach((group, i) => {
        const held = by[group.id]
        if (held) {
          restore.push(held)
          restoreAt.push(order.indexOf(group.id))
        } else {
          remove.push(group.id)
          if (order === diagram.order.groups) order = [...order]
          order.splice(command.at?.[i] ?? order.length, 0, group.id)
        }
        by[group.id] = group
      })
      if (!restore.length && !remove.length) return ok(model, NOTHING, meta)
      const undo: Command[] = []
      if (remove.length) undo.push({ type: 'group.remove', diagramId: command.diagramId, groupIds: remove })
      if (restore.length) {
        undo.push({ type: 'group.set', diagramId: command.diagramId, groups: restore, at: restoreAt })
      }
      return ok(
        setDiagram(model, command.diagramId, withGroups(diagram, { by, order })),
        transaction(undo, meta),
        meta,
      )
    },
  },

  'group.remove': {
    apply(model, command, { meta }) {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const held = groupsOf(diagram)
      let rows: Rows<DiagramGroup> = { by: held, order: diagram.order.groups }
      const boxes = { ...boxesOf(diagram) }
      const restore: DiagramGroup[] = []
      const restoreAt: number[] = []
      const geometry: DomainGroupRect[] = []
      // Ascending, so putting them back one at a time lands each on its own index.
      for (const id of diagram.order.groups) {
        if (!command.groupIds.includes(id)) continue
        restore.push(held[id])
        restoreAt.push(diagram.order.groups.indexOf(id))
        if (boxes[id]) geometry.push(boxes[id])
        delete boxes[id]
        rows = drop(rows.by, rows.order, id)
      }
      if (!restore.length) return ok(model, NOTHING, meta)
      const undo: Command[] = [
        { type: 'group.set', diagramId: command.diagramId, groups: restore, at: restoreAt },
      ]
      if (geometry.length) undo.push({ type: 'box.set', diagramId: command.diagramId, boxes: geometry })
      return ok(
        setDiagram(
          model,
          command.diagramId,
          geometry.length
            ? { ...withGroups(diagram, rows), boxes }
            : withGroups(diagram, rows),
        ),
        transaction(undo, meta),
        meta,
      )
    },
  },
} satisfies Partial<CommandTable>
