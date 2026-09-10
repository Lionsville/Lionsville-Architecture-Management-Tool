/**
 * Going back, as going forward (ADR-0008).
 *
 * A restore is one command: the commands that make the current project hold
 * what a snapshot held, for one thing or for everything. Nothing here touches
 * a file or a repository — the command goes through the same dispatch a
 * keystroke takes, so it is one undo step, one Activity line, one dirty
 * document, and the next snapshot records it as a new entry whose tree equals
 * an old one. That is what a git user calls a revert, and the history has
 * grown rather than moved.
 *
 * Pure, over two indexed models: `then`, read back from the snapshot, and
 * `now`, what the session holds. Every answer is a value; a refusal is one of
 * three keys and never an exception. What it will NOT do is written down in
 * the record and pinned in the tests:
 *
 * - A placement of an element that no longer exists is dropped, and counted,
 *   rather than the element being brought back on the quiet — that is a
 *   whole-project restore, offered separately.
 * - A locked decision is not restored, and a whole-project restore leaves a
 *   locked one as it is, and counts it. The model's lock is kept rather than
 *   given a back door.
 * - Marks are not here at all: a project read at a snapshot has the marks the
 *   working copy has, so there is nothing to put back.
 */
import { isAdrLocked } from './adr'
import type { BoardPatch, Command, DiagramPatch, ProjectPatch, Restored } from './commands'
import type { Diagram, Model } from './normalised'
import {
  boxesOf, decisionsOf, fromDiagram, groupList, groupsOf, routesOf, toDiagram,
} from './normalised'
import { memberOf, nodeGeometryOf, placedNodes } from './placement'
import { edgeRoutesOf, splitRoutes } from './routes'
import type { DiagramSettings, Relation } from './types'

/** The same shape `projects/historyPath.ts` asks a history by; the model's own word for it. */
export type RestoreSubject = { what: 'diagram' | 'description' | 'decision'; id: string }

export type RestoreRefusal = 'restore.absentThen' | 'restore.absentNow' | 'restore.locked'

export type RestoreResult =
  | {
    ok: true
    command: Command
    /** Placements of elements that no longer exist, left out. */
    dropped: number
    /** Locked decisions a whole-project restore left as they are. */
    kept: number
  }
  | { ok: false; reason: RestoreRefusal }

/**
 * The command that makes `now` hold what `then` held — for one subject, or
 * for the whole project when there is none. `asOf` is the snapshot's day, for
 * the line that names the step.
 */
export function restoreCommand(
  then: Model, now: Model, subject: RestoreSubject | undefined, asOf: string,
): RestoreResult {
  if (!subject) return restoreProject(then, now, asOf)
  switch (subject.what) {
    case 'diagram': return restoreDiagram(then, now, subject.id, asOf)
    case 'description': return restoreDescription(then, now, subject.id, asOf)
    case 'decision': return restoreDecision(then, now, subject.id, asOf)
  }
}

// --- one thing -----------------------------------------------------------------

function restoreDiagram(then: Model, now: Model, id: string, asOf: string): RestoreResult {
  const target = then.diagrams[id]
  if (!target) return { ok: false, reason: 'restore.absentThen' }
  const { commands, dropped } = diagramCommands(target, now.diagrams[id], now)
  const restored: Restored = { what: 'diagram', id, name: target.name, asOf }
  return { ok: true, command: { type: 'restore', restored, commands }, dropped, kept: 0 }
}

function restoreDescription(then: Model, now: Model, id: string, asOf: string): RestoreResult {
  const target = then.elements[id]
  if (!target) return { ok: false, reason: 'restore.absentThen' }
  const current = now.elements[id]
  if (!current) return { ok: false, reason: 'restore.absentNow' }
  const restored: Restored = { what: 'description', id, name: current.name, asOf }
  const commands: Command[] = [{ type: 'element.update', id, patch: { description: target.description } }]
  return { ok: true, command: { type: 'restore', restored, commands }, dropped: 0, kept: 0 }
}

function restoreDecision(then: Model, now: Model, id: string, asOf: string): RestoreResult {
  const target = decisionsOf(then)[id]
  if (!target) return { ok: false, reason: 'restore.absentThen' }
  const current = decisionsOf(now)[id]
  if (current && isAdrLocked(current)) return { ok: false, reason: 'restore.locked' }
  const restored: Restored = { what: 'decision', id, name: target.title, asOf }
  const commands: Command[] = current
    ? [{ type: 'decision.update', id, patch: differing(current, target) }]
    : [{ type: 'decision.add', decision: target }]
  return { ok: true, command: { type: 'restore', restored, commands }, dropped: 0, kept: 0 }
}

// --- the whole project ---------------------------------------------------------

/**
 * Everything, in the order that keeps the model referentially whole at every
 * step: elements before the relations between them, both before the
 * diagrams that place them, deletions after the creations so a landscape is
 * never the last one at the wrong moment.
 */
function restoreProject(then: Model, now: Model, asOf: string): RestoreResult {
  const commands: Command[] = []
  let dropped = 0
  let kept = 0

  const settings = differing(projectSettings(now), projectSettings(then)) as ProjectPatch
  if (Object.keys(settings).length) commands.push({ type: 'project.settings', patch: settings })

  for (const id of then.order.elements) {
    const target = then.elements[id]
    const current = now.elements[id]
    if (!current) commands.push({ type: 'element.create', element: target })
    else {
      const patch = differing(current, target)
      if (Object.keys(patch).length) commands.push({ type: 'element.update', id, patch })
    }
  }
  // Deleting an element takes its relations and any container view about
  // it along (the reducer's cascade), so those are not deleted twice.
  const deleted = new Set(now.order.elements.filter((id) => !then.elements[id]))
  for (const id of deleted) commands.push({ type: 'element.delete', id })
  const cascaded = (relation: Relation) =>
    deleted.has(relation.sourceId) || deleted.has(relation.targetId)

  for (const id of then.order.relations) {
    const target = then.relations[id]
    const current = now.relations[id]
    if (!current) commands.push({ type: 'relation.create', relation: target })
    else {
      const patch = differing(current, target)
      if (Object.keys(patch).length) commands.push({ type: 'relation.update', id, patch })
    }
  }
  for (const id of now.order.relations) {
    if (!then.relations[id] && !cascaded(now.relations[id])) commands.push({ type: 'relation.delete', id })
  }

  // Against `then` rather than `now`: by the time these run, the elements
  // and relations are the snapshot's, so a placement is dropped only when
  // the snapshot itself had one for an element it did not hold.
  for (const id of then.order.diagrams) {
    const held = diagramCommands(then.diagrams[id], now.diagrams[id], then)
    commands.push(...held.commands)
    dropped += held.dropped
  }
  for (const id of now.order.diagrams) {
    const diagram = now.diagrams[id]
    const cascadedView = diagram.kind === 'container'
      && diagram.applicationElementId !== undefined && deleted.has(diagram.applicationElementId)
    if (!then.diagrams[id] && !cascadedView) commands.push({ type: 'diagram.delete', id })
  }

  const thenDecisions = decisionsOf(then)
  const nowDecisions = decisionsOf(now)
  for (const id of then.order.decisions) {
    const target = thenDecisions[id]
    const current = nowDecisions[id]
    if (!current) commands.push({ type: 'decision.add', decision: target })
    else {
      const patch = differing(current, target)
      if (!Object.keys(patch).length) continue
      if (isAdrLocked(current)) kept += 1
      else commands.push({ type: 'decision.update', id, patch })
    }
  }
  for (const id of now.order.decisions) {
    if (thenDecisions[id]) continue
    if (isAdrLocked(nowDecisions[id])) kept += 1
    else commands.push({ type: 'decision.remove', id })
  }

  const restored: Restored = { what: 'project', name: then.name, asOf }
  return { ok: true, command: { type: 'restore', restored, commands }, dropped, kept }
}

// --- a diagram, as commands ----------------------------------------------------

const SETTING_FIELDS = [
  'name', 'author', 'client', 'documentDate', 'showTitleBlock', 'aspectConfig', 'showAspects',
] as const satisfies readonly (keyof DiagramSettings)[]

const PATCH_FIELDS = [
  'autoRoute', 'applicationElementId', 'asOf',
] as const satisfies readonly (keyof DiagramPatch)[]

/** The board's own numbers — the geometry file's, minus the per-thing rows. */
const BOARD_FIELDS = [
  'canvas', 'zones', 'needsLayout',
] as const satisfies readonly (keyof BoardPatch)[]

/**
 * What brings `current` to `target`, or creates it when there is none.
 * `against` is the model the placements are checked against: an element that
 * is not in it has no place on the board, and its placement is dropped.
 */
function diagramCommands(
  target: Diagram, current: Diagram | undefined, against: Model,
): { commands: Command[]; dropped: number } {
  const wanted = fromDiagram(target)
  const placed = placedNodes(wanted).filter((node) => against.elements[node.id])
  const dropped = wanted.members.length - placed.length
  const routes = edgeRoutesOf(wanted).filter((route) => against.relations[route.relationId])

  if (!current) {
    const diagram = toDiagram({
      ...wanted,
      members: placed.map(memberOf),
      geometry: {
        ...wanted.geometry,
        nodes: placed.map(nodeGeometryOf),
        ...(wanted.geometry.routes !== undefined || wanted.lines !== undefined
          ? splitRoutes(routes)
          : {}),
      },
      ...(wanted.lines !== undefined || wanted.geometry.routes !== undefined
        ? { lines: splitRoutes(routes).lines }
        : {}),
    })
    return { commands: [{ type: 'diagram.create', diagram }], dropped }
  }

  const commands: Command[] = []
  const id = target.id

  const settings = pick(target, SETTING_FIELDS) as DiagramSettings
  if (!same(settings, pick(current, SETTING_FIELDS))) commands.push({ type: 'diagram.settings', id, settings })

  const patch = differing(pick(current, PATCH_FIELDS), pick(target, PATCH_FIELDS)) as DiagramPatch
  if (Object.keys(patch).length) commands.push({ type: 'diagram.update', id, patch })

  const board = differing(pick(current, BOARD_FIELDS), pick(target, BOARD_FIELDS)) as BoardPatch
  if (Object.keys(board).length) commands.push({ type: 'board.set', diagramId: id, patch: board })

  const goneGroups = current.order.groups.filter((groupId) => !groupsOf(target)[groupId])
  if (goneGroups.length) commands.push({ type: 'group.remove', diagramId: id, groupIds: goneGroups })
  const groups = groupList(target).filter((group) => !same(groupsOf(current)[group.id], group))
  if (groups.length) commands.push({ type: 'group.set', diagramId: id, groups })
  const boxes = Object.values(boxesOf(target)).filter((box) => !same(boxesOf(current)[box.id], box))
  if (boxes.length) commands.push({ type: 'box.set', diagramId: id, boxes })
  const goneBoxes = Object.keys(boxesOf(current)).filter((groupId) => !boxesOf(target)[groupId])
  if (goneBoxes.length) commands.push({ type: 'box.remove', diagramId: id, groupIds: goneBoxes })

  const gone = current.order.members.filter((elementId) => !target.members[elementId])
  if (gone.length) commands.push({ type: 'member.remove', diagramId: id, elementIds: gone })
  const members = placed.map(memberOf).filter((member) => !same(current.members[member.id], member))
  if (members.length) commands.push({ type: 'member.set', diagramId: id, members })
  const nodes = placed.map(nodeGeometryOf).filter((node) => !same(current.nodes[node.id], node))
  if (nodes.length) commands.push({ type: 'node.set', diagramId: id, nodes })

  const currentRoutes = routesOf(current)
  const targetRoutes = routesOf(target)
  const cleared = current.order.routes.filter((connectionId) => !targetRoutes[connectionId])
  if (cleared.length) commands.push({ type: 'route.clear', diagramId: id, relationIds: cleared })
  const rerouted = routes.filter((route) => !same(currentRoutes[route.relationId], route))
  if (rerouted.length) commands.push({ type: 'route.set', diagramId: id, routes: rerouted })

  return { commands, dropped }
}

// --- comparing -----------------------------------------------------------------

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function pick<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const key of keys) if (row[key] !== undefined) out[key] = row[key]
  return out
}

/**
 * The patch that turns `from` into `to`: every key that differs, with `to`'s
 * value — `undefined` where `to` has none, which the reducer reads as delete.
 */
function differing<T extends object>(from: T, to: T): Partial<T> {
  const patch: Partial<T> = {}
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof T>
  for (const key of keys) {
    if (!same(from[key], to[key])) patch[key] = to[key]
  }
  return patch
}

const PROJECT_FIELDS = ['name', 'customerName', 'description', 'defaultAuthor', 'defaultAspectConfig'] as const

function projectSettings(model: Model): ProjectPatch {
  return pick(model, PROJECT_FIELDS) as ProjectPatch
}

