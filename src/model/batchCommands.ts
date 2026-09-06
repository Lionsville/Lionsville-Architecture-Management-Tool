/**
 * The bridge, with an end date.
 *
 * The editor still emits a `DiagramContentBatch` — a REST payload for one
 * diagram, aimed at a backend that is not here. The session no longer applies
 * one: it dispatches commands. This turns the first into the second, so undo
 * covers the whole app before the editor is touched at all (ADR-0002, step 4).
 *
 * It is deliberately a translation and not an improvement. What `applyBatch`
 * did, this asks for, including the filtering: a batch may name an element it
 * also deletes, a connection whose endpoint is going away, or a placement for
 * something that no longer exists, and all three were quietly dropped. They have
 * to keep being dropped, because a command that refuses would take the whole
 * transaction with it.
 *
 * Two things it does NOT reproduce, both improvements that fall out of the
 * commands and are pinned as such in the test beside this file:
 *
 * - An upserted element or connection **keeps its place** in the file. The batch
 *   moved every touched row to the end of the array, so editing a name reordered
 *   the document.
 * - A route for a connection the model does not hold is dropped rather than
 *   stored. The batch pushed it, and nothing could ever draw it.
 * - A diagram nobody named is not touched. `applyBatch` rebuilt every diagram in
 *   the model on every change, which stamped an empty `edgeRoutes` list onto
 *   each one that had none.
 *
 * This file goes when the editor dispatches (step 6), and `DiagramContentBatch`
 * goes with it.
 */
import { hasRouteContent } from './routes'
import { replacement } from './commands'
import type { Command } from './commands'
import type { Model } from './normalised'
import type { DiagramContentBatch } from './types'

export function batchToCommands(batch: DiagramContentBatch, model: Model): Command[] {
  const deletedElements = new Set(batch.deletedElementIds)
  const deletedConnections = new Set(batch.deletedConnectionIds)

  // Which elements the model holds once this batch has landed. Everything below
  // is filtered against it, exactly as `applyBatch` filtered against `elIds`.
  const elements = new Set(model.order.elements)
  for (const element of batch.elements) if (!deletedElements.has(element.id)) elements.add(element.id)
  for (const id of deletedElements) elements.delete(id)

  const commands: Command[] = []

  for (const element of batch.elements) {
    if (deletedElements.has(element.id)) continue
    const held = model.elements[element.id]
    if (held) commands.push({ type: 'element.update', id: element.id, patch: replacement(held, element) })
    else commands.push({ type: 'element.create', element })
  }
  for (const id of batch.deletedElementIds) {
    if (model.elements[id]) commands.push({ type: 'element.delete', id })
  }

  const connections = new Set(model.order.connections.filter((id) => {
    const held = model.connections[id]
    return elements.has(held.sourceId) && elements.has(held.targetId)
  }))
  for (const connection of batch.connections) {
    if (deletedConnections.has(connection.id)) continue
    if (!elements.has(connection.sourceId) || !elements.has(connection.targetId)) continue
    const held = model.connections[connection.id]
    if (held) {
      commands.push({ type: 'connection.update', id: connection.id, patch: replacement(held, connection) })
    } else commands.push({ type: 'connection.create', connection })
    connections.add(connection.id)
  }
  for (const id of batch.deletedConnectionIds) {
    if (model.connections[id]) commands.push({ type: 'connection.delete', id })
    connections.delete(id)
  }

  const diagram = model.diagrams[batch.diagramId]
  if (diagram) {
    const removed = new Set(batch.removedPlacementElementIds)
    const placements = batch.placements.filter(
      (p) => elements.has(p.elementId) && !removed.has(p.elementId))
    const wanted = new Set(placements.map((p) => p.elementId))
    // Only what this batch takes off the diagram; a placement whose element is
    // being deleted goes with the element and must not be asked for twice.
    const drop = diagram.order.placements.filter((id) => !wanted.has(id) && elements.has(id))
    if (drop.length) {
      commands.push({ type: 'placement.remove', diagramId: batch.diagramId, elementIds: drop })
    }
    if (placements.length) {
      commands.push({ type: 'placement.set', diagramId: batch.diagramId, placements })
    }

    const routes = batch.edgeRoutes.filter((r) => hasRouteContent(r) && connections.has(r.connectionId))
    const clear = batch.edgeRoutes.filter((r) => !hasRouteContent(r)).map((r) => r.connectionId)
    if (clear.length) {
      commands.push({ type: 'route.clear', diagramId: batch.diagramId, connectionIds: clear })
    }
    if (routes.length) commands.push({ type: 'route.set', diagramId: batch.diagramId, routes })

    // Both present only when touched this session; a batch cannot clear either.
    if (batch.layoutConfig !== undefined) {
      commands.push({ type: 'layout.set', diagramId: batch.diagramId, layoutConfig: batch.layoutConfig })
    }
    if (batch.autoRoute !== undefined) {
      commands.push({ type: 'diagram.update', id: batch.diagramId, patch: { autoRoute: batch.autoRoute } })
    }
  }

  return commands
}
