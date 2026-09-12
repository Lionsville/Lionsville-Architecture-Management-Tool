/**
 * The one writer (ADR-0002).
 *
 * `apply` takes a model and a command and returns the model that results,
 * together with **the command that undoes it** — computed from the state it just
 * saw, which is the only moment at which the inverse is both exact and cheap.
 * Undo is `apply(model, inverse)`; redo is the original command again. Nothing
 * else in the app may change a model.
 *
 * Three properties are worth stating, because everything downstream leans on
 * them and `reducer.test.ts` pins all three:
 *
 * - **Proportional.** A command touches the path it names. Renaming a diagram
 *   copies the model, its diagram record and that one diagram; every other
 *   diagram, every element and every route comes out of it by identity, so
 *   memoisation below the reducer holds.
 * - **Reversible.** `apply(apply(m, c).model, inverse)` is `m` again, deep
 *   equal, order arrays included — which is why a delete's inverse carries the
 *   index the row was at rather than appending it back at the end.
 * - **Atomic.** A transaction that refuses anywhere changes nothing.
 *
 * **A refusal is a key**, never a sentence, and it is a value rather than a
 * throw: a command that cannot be carried out is an ordinary answer here, the
 * way `openProjectDocument`'s three refusals are.
 *
 * One rule about absence is worth knowing before reading the decision and route
 * cases. `decisions` and a diagram's `edgeRoutes` are optional in the file, and
 * emptying one **removes the key** rather than leaving an empty list behind —
 * again, a saved file should look like a hand-written one. The consequence is
 * that a list which arrives empty-but-present (only an older build wrote one)
 * becomes absent the first time anything touches it. Nothing reads the
 * difference; `decisionsOf` and `routesOf` answer the same either way.
 */
import { transaction, reverse, replacement, NOTHING } from './commands'
import { asStandIn, isLinked } from './standIn'
import type {
  BoardPatch, Command, CommandMeta, DiagramPatch, ProjectPatch, StandInCache,
} from './commands'
import type { Adr } from './adr'
import type { Transition } from './transition'
import type { RelationId, Diagram, DiagramId, GroupId, Model, ModelOrder } from './normalised'
import { boxesOf, decisionsOf, groupsOf, routesOf, transitionsOf } from './normalised'
import { datesInOrder } from './lifecycle'
import type {
  DesignElement, DiagramGroup, DiagramMember, DiagramSettings, DomainGroupRect, EdgeRoute,
  ElementId, NodeGeometry, Relation,
} from './types'

/**
 * Why a command was not carried out. A key the shell turns into words, and a
 * closed set — anything that is not one of these is a bug in the caller, not a
 * refusal to show somebody.
 */
export type CommandRefusal = 'command.gone' | 'command.lastLandscape' | 'command.datesOutOfOrder'

export type ApplyResult =
  | { ok: true; model: Model; inverse: Command }
  | { ok: false; reason: CommandRefusal }

const gone = { ok: false, reason: 'command.gone' } as const
const outOfOrder = { ok: false, reason: 'command.datesOutOfOrder' } as const

// --- indexed collections, immutably -----------------------------------------

type Rows<T> = { by: Record<string, T>; order: string[] }

/**
 * Upsert one row. An existing id keeps its place and the ORDER ARRAY ITSELF —
 * the identity is what tells the caller nothing moved, so it can leave the
 * surrounding object alone.
 */
function put<T>(by: Record<string, T>, order: string[], id: string, row: T, at?: number): Rows<T> {
  const next = { ...by, [id]: row }
  if (id in by) return { by: next, order }
  const grown = [...order]
  grown.splice(at ?? grown.length, 0, id)
  return { by: next, order: grown }
}

function drop<T>(by: Record<string, T>, order: string[], id: string): Rows<T> {
  const next = { ...by }
  delete next[id]
  return { by: next, order: order.filter((held) => held !== id) }
}

/**
 * Two rows that say the same thing.
 *
 * Rows here are small, flat and built by one writer, so this is honest — and
 * what it buys is identity: a drag that re-states the band a card is already
 * in must not hand back a fresh object, or everything memoised below it
 * re-renders and `diff.ts` reports a change nobody made.
 */
function same<T extends object>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// --- patches -----------------------------------------------------------------

/**
 * A row with a patch applied, and the patch that puts it back. A key whose value
 * is `undefined` deletes the field; the inverse names the same keys, so a field
 * that was not there comes back as not there.
 */
function patched<T extends object>(row: T, patch: Partial<T>): { row: T; inverse: Partial<T> } {
  const out = { ...row }
  const inverse: Partial<T> = {}
  for (const key of Object.keys(patch) as (keyof T)[]) {
    inverse[key] = row[key]
    const value = patch[key]
    if (value === undefined) delete out[key]
    else out[key] = value
  }
  return { row: out, inverse }
}

// --- putting a model back together -------------------------------------------

function withOrder(model: Model, field: keyof ModelOrder, order: string[]): Model['order'] {
  return order === model.order[field] ? model.order : { ...model.order, [field]: order }
}

function withElements(model: Model, rows: Rows<DesignElement>): Model {
  return { ...model, elements: rows.by, order: withOrder(model, 'elements', rows.order) }
}

function withRelations(model: Model, rows: Rows<Relation>): Model {
  return { ...model, relations: rows.by, order: withOrder(model, 'relations', rows.order) }
}

function withDiagrams(model: Model, rows: Rows<Diagram>): Model {
  return { ...model, diagrams: rows.by, order: withOrder(model, 'diagrams', rows.order) }
}

function withDecisions(model: Model, rows: Rows<Adr>): Model {
  const order = withOrder(model, 'decisions', rows.order)
  // Emptied means gone, not present and empty — see the note at the top.
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.decisions
    return out
  }
  return { ...model, decisions: rows.by, order }
}

function withTransitions(model: Model, rows: Rows<Transition>): Model {
  const order = withOrder(model, 'transitions', rows.order)
  // Emptied means gone, exactly as `decisions` is — see the note at the top.
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.transitions
    return out
  }
  return { ...model, transitions: rows.by, order }
}

function setDiagram(model: Model, id: DiagramId, diagram: Diagram): Model {
  return { ...model, diagrams: { ...model.diagrams, [id]: diagram } }
}

function withMembers(diagram: Diagram, rows: Rows<DiagramMember>): Diagram {
  const order = rows.order === diagram.order.members
    ? diagram.order
    : { ...diagram.order, members: rows.order }
  return { ...diagram, members: rows.by, order }
}

/**
 * Emptied means gone in the FILE, and `fromDiagram` is where that happens —
 * the record is kept here, holding nothing (see {@link Diagram.groups}).
 */
function withGroups(diagram: Diagram, rows: Rows<DiagramGroup>): Diagram {
  const order = rows.order === diagram.order.groups
    ? diagram.order
    : { ...diagram.order, groups: rows.order }
  return { ...diagram, groups: rows.by, order }
}

function withRoutes(diagram: Diagram, rows: Rows<EdgeRoute>): Diagram {
  const order = rows.order === diagram.order.routes
    ? diagram.order
    : { ...diagram.order, routes: rows.order }
  if (rows.order.length === 0) {
    const out = { ...diagram, order }
    delete out.edgeRoutes
    return out
  }
  return { ...diagram, edgeRoutes: rows.by, order }
}

// --- the reducer --------------------------------------------------------------

export function apply(model: Model, command: Command): ApplyResult {
  const meta: CommandMeta = {}
  if (command.coalesce !== undefined) meta.coalesce = command.coalesce
  if (command.undoable !== undefined) meta.undoable = command.undoable
  if (command.origin !== undefined) meta.origin = command.origin
  const ok = (next: Model, inverse: Command): ApplyResult =>
    ({ ok: true, model: next, inverse: { ...inverse, ...meta } })

  switch (command.type) {
    // --- elements -----------------------------------------------------------
    case 'element.create': {
      const { element, at } = command
      const rows = put(model.elements, model.order.elements, element.id, element, at)
      return ok(withElements(model, rows), { type: 'element.delete', id: element.id })
    }

    case 'element.update': {
      const held = model.elements[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      // A lifecycle that runs backwards is not a landscape anybody can read,
      // and refusing here rather than in the inspector means the agent, a
      // paste and an undo all get the same answer (ADR-0009).
      if (!datesInOrder(row.lifecycleDates)) return outOfOrder
      const rows = put(model.elements, model.order.elements, command.id, row)
      return ok(withElements(model, rows), { type: 'element.update', id: command.id, patch: inverse })
    }

    case 'element.delete':
      return deleteElement(model, command.id, meta)

    /**
     * A stand-in's caches, written back to what the tree says (ADR-0012 §9).
     *
     * Every row that would change nothing is dropped, so a refresh over a
     * scope that is already up to date is one command that lands nothing and
     * therefore is not a step — which is what keeps the Activity list from
     * filling up with "refreshed 0" every time somebody presses it. A row for
     * an id this scope does not hold, or holds as a DEFINITION, is ignored:
     * turning a definition into a stand-in is *link*, a gesture of its own
     * with a confirmation, and never a side effect of refreshing.
     */
    case 'standin.refresh': {
      const wanted = command.entries.filter((entry) => {
        const row = model.elements[entry.id]
        return row?.ref !== undefined && (row.name !== entry.name || row.ref !== entry.ref)
      })
      if (wanted.length === 0) return ok(model, NOTHING)
      let rows: Rows<DesignElement> = { by: model.elements, order: model.order.elements }
      const before: StandInCache[] = []
      for (const entry of wanted) {
        const row = model.elements[entry.id]
        before.push({ id: entry.id, name: row.name, ref: row.ref! })
        rows = put(rows.by, rows.order, entry.id, { ...row, name: entry.name, ref: entry.ref })
      }
      return ok(withElements(model, rows), { type: 'standin.refresh', entries: before })
    }

    /**
     * A definition becomes a stand-in — *link* (ADR-0012 §10).
     *
     * The inverse is the whole record put back, because a link drops nine
     * fields and an undo that restored the name and the ref alone would leave
     * the lifecycle, the vendor and the aspects gone for good. A record that
     * is already exactly this stand-in is not a step, the way a refresh that
     * finds nothing stale is not one.
     */
    case 'element.link': {
      const held = model.elements[command.id]
      if (!held) return gone
      if (isLinked(held, command)) return ok(model, NOTHING)
      const next = asStandIn(held, command)
      const rows = put(model.elements, model.order.elements, command.id, next)
      return ok(
        withElements(model, rows),
        { type: 'element.update', id: command.id, patch: replacement(next, held) },
      )
    }

    // --- relations ----------------------------------------------------------
    case 'relation.create': {
      const { relation, at } = command
      if (!model.elements[relation.sourceId] || !model.elements[relation.targetId]) return gone
      const rows = put(model.relations, model.order.relations, relation.id, relation, at)
      return ok(withRelations(model, rows), { type: 'relation.delete', id: relation.id })
    }

    case 'relation.update': {
      const held = model.relations[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(model.relations, model.order.relations, command.id, row)
      return ok(withRelations(model, rows), { type: 'relation.update', id: command.id, patch: inverse })
    }

    case 'relation.delete':
      return deleteRelation(model, command.id, meta)

    // --- what is on a view (ADR-0012 §6) ------------------------------------
    case 'member.set': {
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
      if (!changed) return ok(model, NOTHING)
      const undo: Command[] = []
      if (remove.length) undo.push({ type: 'member.remove', diagramId: command.diagramId, elementIds: remove })
      if (restore.length) {
        undo.push({ type: 'member.set', diagramId: command.diagramId, members: restore, at: restoreAt })
      }
      return ok(
        setDiagram(model, command.diagramId, withMembers(diagram, { by, order })),
        transaction(undo, meta),
      )
    }

    case 'member.remove': {
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
      if (!restore.length) return ok(model, NOTHING)
      const undo: Command[] = [
        { type: 'member.set', diagramId: command.diagramId, members: restore, at: restoreAt },
      ]
      if (geometry.length) undo.push({ type: 'node.set', diagramId: command.diagramId, nodes: geometry })
      return ok(
        setDiagram(model, command.diagramId, { ...withMembers(diagram, rows), nodes }),
        transaction(undo, meta),
      )
    }

    // --- where it ended up (ADR-0012 §6) ------------------------------------
    case 'node.set': {
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
      if (!restore.length && !clear.length) return ok(model, NOTHING)
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'node.remove', diagramId: command.diagramId, elementIds: clear })
      if (restore.length) undo.push({ type: 'node.set', diagramId: command.diagramId, nodes: restore })
      return ok(
        setDiagram(model, command.diagramId, { ...diagram, nodes }),
        transaction(undo, meta),
      )
    }

    case 'node.remove': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const nodes = { ...diagram.nodes }
      const restore: NodeGeometry[] = []
      for (const id of command.elementIds) {
        if (!nodes[id]) continue
        restore.push(nodes[id])
        delete nodes[id]
      }
      if (!restore.length) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.diagramId, { ...diagram, nodes }),
        { type: 'node.set', diagramId: command.diagramId, nodes: restore },
      )
    }

    case 'box.set': {
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
      if (!restore.length && !clear.length) return ok(model, NOTHING)
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'box.remove', diagramId: command.diagramId, groupIds: clear })
      if (restore.length) undo.push({ type: 'box.set', diagramId: command.diagramId, boxes: restore })
      return ok(setDiagram(model, command.diagramId, { ...diagram, boxes }), transaction(undo, meta))
    }

    case 'box.remove': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const boxes = { ...boxesOf(diagram) }
      const restore: DomainGroupRect[] = []
      for (const id of command.groupIds) {
        if (!boxes[id]) continue
        restore.push(boxes[id])
        delete boxes[id]
      }
      if (!restore.length) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.diagramId, { ...diagram, boxes }),
        { type: 'box.set', diagramId: command.diagramId, boxes: restore },
      )
    }

    case 'board.set': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const { row, inverse } = patched(diagram, command.patch as Partial<Diagram>)
      return ok(
        setDiagram(model, command.diagramId, row),
        { type: 'board.set', diagramId: command.diagramId, patch: inverse as BoardPatch },
      )
    }

    case 'route.set': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      // One pass, for the reason `placement.set` gives: a routing pass sets every line.
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
      if (!restore.length && !clear.length) return ok(model, NOTHING)
      const rows: Rows<EdgeRoute> = { by, order }
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'route.clear', diagramId: command.diagramId, relationIds: clear })
      if (restore.length) {
        undo.push({ type: 'route.set', diagramId: command.diagramId, routes: restore, at: restoreAt })
      }
      return ok(setDiagram(model, command.diagramId, withRoutes(diagram, rows)), transaction(undo, meta))
    }

    case 'route.clear': {
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
      if (!restore.length) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.diagramId, withRoutes(diagram, rows)),
        { type: 'route.set', diagramId: command.diagramId, routes: restore, at: restoreAt },
      )
    }

    // --- dashed groups (ADR-0012 §6) ----------------------------------------
    case 'group.set': {
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
      if (!restore.length && !remove.length) return ok(model, NOTHING)
      const undo: Command[] = []
      if (remove.length) undo.push({ type: 'group.remove', diagramId: command.diagramId, groupIds: remove })
      if (restore.length) {
        undo.push({ type: 'group.set', diagramId: command.diagramId, groups: restore, at: restoreAt })
      }
      return ok(
        setDiagram(model, command.diagramId, withGroups(diagram, { by, order })),
        transaction(undo, meta),
      )
    }

    case 'group.remove': {
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
      if (!restore.length) return ok(model, NOTHING)
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
      )
    }

    // --- diagrams -----------------------------------------------------------
    case 'diagram.create': {
      const { diagram, at } = command
      const rows = put(model.diagrams, model.order.diagrams, diagram.id, diagram, at)
      return ok(withDiagrams(model, rows), { type: 'diagram.delete', id: diagram.id })
    }

    case 'diagram.rename': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      const name = command.name.trim()
      // A nameless tab is not something the caller meant to ask for.
      if (!name || name === diagram.name) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.id, { ...diagram, name }),
        { type: 'diagram.rename', id: command.id, name: diagram.name },
      )
    }

    case 'diagram.settings': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      if (!command.settings.name.trim()) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.id, applySettings(diagram, command.settings)),
        { type: 'diagram.settings', id: command.id, settings: settingsOf(diagram) },
      )
    }

    case 'diagram.update': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      const { row, inverse } = patched(diagram, command.patch as Partial<Diagram>)
      return ok(
        setDiagram(model, command.id, row),
        { type: 'diagram.update', id: command.id, patch: inverse as DiagramPatch },
      )
    }

    case 'diagram.delete': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      // The last landscape always stays; the editor disables the menu item and
      // this is the safety net underneath it.
      if (diagram.kind === 'layer7'
        && model.order.diagrams.filter((id) => model.diagrams[id].kind === 'layer7').length <= 1) {
        return { ok: false, reason: 'command.lastLandscape' }
      }
      const at = model.order.diagrams.indexOf(command.id)
      return ok(
        withDiagrams(model, drop(model.diagrams, model.order.diagrams, command.id)),
        { type: 'diagram.create', diagram, at },
      )
    }

    // --- decisions ----------------------------------------------------------
    case 'decision.add': {
      const { decision, at } = command
      const rows = put(decisionsOf(model), model.order.decisions, decision.id, decision, at)
      return ok(withDecisions(model, rows), { type: 'decision.remove', id: decision.id })
    }

    case 'decision.update': {
      const held = decisionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(decisionsOf(model), model.order.decisions, command.id, row)
      return ok(withDecisions(model, rows), { type: 'decision.update', id: command.id, patch: inverse })
    }

    case 'decision.remove': {
      const held = decisionsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.decisions.indexOf(command.id)
      const rows = drop(decisionsOf(model), model.order.decisions, command.id)
      return ok(withDecisions(model, rows), { type: 'decision.add', decision: held, at })
    }

    // --- plans (ADR-0009) ---------------------------------------------------
    case 'transition.add': {
      const { transition, at } = command
      const rows = put(transitionsOf(model), model.order.transitions, transition.id, transition, at)
      return ok(withTransitions(model, rows), { type: 'transition.remove', id: transition.id })
    }

    case 'transition.update': {
      const held = transitionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(transitionsOf(model), model.order.transitions, command.id, row)
      return ok(withTransitions(model, rows), { type: 'transition.update', id: command.id, patch: inverse })
    }

    case 'transition.remove': {
      const held = transitionsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.transitions.indexOf(command.id)
      const rows = drop(transitionsOf(model), model.order.transitions, command.id)
      return ok(withTransitions(model, rows), { type: 'transition.add', transition: held, at })
    }

    // --- the project itself -------------------------------------------------
    case 'project.settings': {
      const { row, inverse } = patched(model, command.patch as Partial<Model>)
      return ok(row, { type: 'project.settings', patch: inverse as ProjectPatch })
    }

    // --- a version put back (ADR-0008): a transaction that knows its name ---
    case 'restore':
      return apply(model, { ...meta, type: 'transaction', commands: command.commands })

    // --- several changes, one undo step -------------------------------------
    case 'transaction': {
      let next = model
      const inverses: Command[] = []
      for (const inner of command.commands) {
        const result = apply(next, inner)
        if (!result.ok) return result
        next = result.model
        inverses.push(result.inverse)
      }
      if (next === model) return ok(model, NOTHING)
      return ok(next, reverse(inverses, meta))
    }
  }
}

/** A run of commands, or the first refusal. One step, one inverse. */
export function applyAll(model: Model, commands: Command[], meta: CommandMeta = {}): ApplyResult {
  return apply(model, transaction(commands, meta))
}

/**
 * Deleting an element takes with it every relation that ends on it, its
 * membership and node on every diagram, the routes of those relations, and any
 * container view that was about it — which is exactly what the batch did,
 * spelled out.
 *
 * The inverse is a transaction that puts each of those back at the index it was
 * at, in the order that keeps the model referentially whole at every step:
 * the element, then its relations, then the diagrams, then the geometry.
 */
function deleteElement(model: Model, id: ElementId, meta: CommandMeta): ApplyResult {
  const element = model.elements[id]
  if (!element) return gone

  // A container view exists ABOUT one application; without it there is a tab
  // named after something that is not there any more. It goes whole, and comes
  // back whole — so nothing else in the undo may speak about its insides.
  const doomed = new Set(model.order.diagrams.filter((diagramId) => {
    const diagram = model.diagrams[diagramId]
    return diagram.kind === 'container' && diagram.applicationElementId === id
  }))

  const undo: Command[] = [{ type: 'element.create', element, at: model.order.elements.indexOf(id) }]
  let next = withElements(model, drop(model.elements, model.order.elements, id))

  model.order.diagrams.forEach((diagramId, at) => {
    if (!doomed.has(diagramId)) return
    undo.push({ type: 'diagram.create', diagram: model.diagrams[diagramId], at })
    next = withDiagrams(next, drop(next.diagrams, next.order.diagrams, diagramId))
  })

  // Indices are read off the ORIGINAL order, and pushed in ascending order, so
  // putting them back one at a time lands each on the index it came from.
  model.order.relations.forEach((relationId, at) => {
    const relation = model.relations[relationId]
    if (relation.sourceId !== id && relation.targetId !== id) return
    undo.push({ type: 'relation.create', relation, at })
    for (const diagramId of next.order.diagrams) {
      const diagram = model.diagrams[diagramId]
      const route = routesOf(diagram)[relationId]
      if (!route) continue
      undo.push({
        type: 'route.set', diagramId, routes: [route], at: [diagram.order.routes.indexOf(relationId)],
      })
    }
    next = removeRelation(next, relationId)
  })

  for (const diagramId of next.order.diagrams) {
    const diagram = next.diagrams[diagramId]
    if (!diagram.members[id]) continue
    undo.push({
      type: 'member.set',
      diagramId,
      members: [diagram.members[id]],
      at: [diagram.order.members.indexOf(id)],
    })
    if (diagram.nodes[id]) {
      undo.push({ type: 'node.set', diagramId, nodes: [diagram.nodes[id]] })
    }
    const nodes = { ...diagram.nodes }
    delete nodes[id]
    next = setDiagram(next, diagramId, {
      ...withMembers(diagram, drop(diagram.members, diagram.order.members, id)),
      nodes,
    })
  }

  return { ok: true, model: next, inverse: transaction(undo, meta) }
}

/** A relation's own delete: the row, and its route on every diagram. */
function deleteRelation(model: Model, id: RelationId, meta: CommandMeta): ApplyResult {
  if (!model.relations[id]) return gone
  const undo: Command[] = [{
    type: 'relation.create',
    relation: model.relations[id],
    at: model.order.relations.indexOf(id),
  }]
  for (const diagramId of model.order.diagrams) {
    const diagram = model.diagrams[diagramId]
    const route = routesOf(diagram)[id]
    if (!route) continue
    undo.push({
      type: 'route.set', diagramId, routes: [route], at: [diagram.order.routes.indexOf(id)],
    })
  }
  return { ok: true, model: removeRelation(model, id), inverse: transaction(undo, meta) }
}

/** The relation and its geometry, gone from the model and from every diagram. */
function removeRelation(model: Model, id: RelationId): Model {
  let next = withRelations(model, drop(model.relations, model.order.relations, id))
  for (const diagramId of next.order.diagrams) {
    const diagram = next.diagrams[diagramId]
    if (!routesOf(diagram)[id]) continue
    next = setDiagram(next, diagramId, withRoutes(diagram, drop(routesOf(diagram), diagram.order.routes, id)))
  }
  return next
}

/** The fields the settings dialog owns; see {@link DiagramSettings}. */
const SETTING_FIELDS = [
  'author', 'client', 'documentDate', 'showTitleBlock', 'aspectConfig', 'showAspects',
] as const

function applySettings(diagram: Diagram, settings: DiagramSettings): Diagram {
  const next = { ...diagram, name: settings.name.trim() }
  // Written out one by one, and deleted rather than set to undefined, so what
  // lands in a saved file is what a hand-written one would look like.
  const writable = next as unknown as Record<string, unknown>
  for (const field of SETTING_FIELDS) {
    if (settings[field] === undefined) delete writable[field]
    else writable[field] = settings[field]
  }
  return next
}

function settingsOf(diagram: Diagram): DiagramSettings {
  const settings: DiagramSettings = { name: diagram.name }
  const writable = settings as unknown as Record<string, unknown>
  for (const field of SETTING_FIELDS) {
    if (diagram[field] !== undefined) writable[field] = diagram[field]
  }
  return settings
}
