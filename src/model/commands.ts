/**
 * What a change to a project IS (ADR-0002).
 *
 * One vocabulary, for every mutation the app can make — a node dragged, a
 * diagram renamed, a decision accepted, a project's default author cleared.
 * Nothing else may change a model: the reducer in `reducer.ts` is the only
 * writer, and this is everything it accepts.
 *
 * Three conventions run through the list.
 *
 * **A patch names its keys.** A key present with `undefined` DELETES the field,
 * a key absent leaves it alone. That is the same rule the rest of the model
 * follows — a saved file should look like a hand-written one, so a cleared field
 * is gone rather than present and empty — and it is what makes the inverse of an
 * update exact: it names the same keys with what was there before.
 *
 * **`at` is for putting something back.** A create appends; a create that
 * carries an index inserts there. Undoing a delete is the only caller that needs
 * it, which is why it is optional everywhere and absent everywhere in normal
 * use. `diagram.create` is the exception — a duplicate lands next to its
 * original, so it passes one going forwards too.
 *
 * **Meta rides on every command.** `coalesce` is what makes a run of keystrokes
 * into one field, or a live-routing follow-up and the drag that caused it, one
 * undo step; `undoable` is what keeps a change that is not a person's edit off
 * the stack. What a step is CALLED is not here — `activity.ts` works that out
 * from the commands, so there is no second thing to keep true.
 */
import type { StringKey } from '../i18n/strings'
import type { Adr } from './adr'
import type { Transition } from './transition'
import type {
  AdrId, RelationId, Diagram, DiagramId, GroupId, Model, TransitionId,
} from './normalised'
import { decisionsOf } from './normalised'
import type {
  DesignElement, DiagramGroup, DiagramMember, DiagramSettings, DomainGroupRect,
  EdgeRoute, ElementId, Geometry, NodeGeometry, PlacedNode, Relation,
} from './types'
import { memberOf, nodeGeometryOf } from './placement'

/** The model's own scalars — everything a project's settings dialog edits. */
export type ProjectPatch = Partial<{
  name: string
  description: string
  defaultAuthor: string
  defaultAspectConfig: NonNullable<Diagram['aspectConfig']>
}>

/**
 * A diagram's machine-facing fields: the auto-route toggle, the "a machine drew
 * this" flag, the cost annotations, which application a container view is about.
 * The user-facing ones have commands of their own — {@link CommandBody}'s
 * `diagram.rename` and `diagram.settings` — because they carry rules.
 */
export type DiagramPatch = Partial<Pick<Diagram,
  'autoRoute' | 'applicationElementId' | 'asOf'
  // A sheet is laid out from these four the way a landscape is laid out from
  // its coordinates (ADR-0012 §6): they say what the page is OF, so they are
  // the sheet's equivalent of a drag and belong on the same patch.
  | 'journeyId' | 'lanes' | 'areas' | 'showActors' | 'areaSpans' | 'columns' | 'paper'>>

/**
 * The board's own numbers: how big it is, how wide its bands are, and whether
 * a person has looked at the layout yet (ADR-0012 §6). A patch, with the same
 * rule as every other: a key present with `undefined` clears it.
 */
export type BoardPatch = Partial<Pick<Geometry, 'canvas' | 'zones' | 'needsLayout'>>

export type CommandBody =
  // --- elements ------------------------------------------------------------
  | { type: 'element.create'; element: DesignElement; at?: number }
  | { type: 'element.update'; id: ElementId; patch: Partial<DesignElement> }
  /** Takes its relations, its placements and any container view about it. */
  | { type: 'element.delete'; id: ElementId }
  /**
   * Write a stand-in's caches back to what the tree says (ADR-0012 §9).
   *
   * A stand-in's `name` and `ref` are caches of the master's, and they go
   * stale when the owning scope renames the thing or the definition moves. A
   * person does not type either of them — a *refresh* rewrites them, several
   * at a time, as one undo step and one Activity line that says what it was.
   *
   * The fresh values come IN, because the model has no idea what a scope is:
   * the index says what the tree holds (`projects/scopeIndex.ts`) and this
   * carries the answer. A row for an id this scope does not hold, or holds as
   * a definition, is ignored — a refresh must never turn a definition into a
   * stand-in, which is *link*, a different gesture with a confirmation.
   */
  | { type: 'standin.refresh'; entries: StandInCache[] }
  /**
   * A definition here becomes a stand-in of a record another scope answers
   * for — *link*, the first of ADR-0012 §10's four gestures and the only one
   * that writes one scope.
   *
   * This scope keeps what it answers for — its perspective, its presentation,
   * where the thing sits on its own trees, and every child whose `parentId`
   * names it — and gives up the owner's detail, because from now on somebody
   * else says what the thing IS (`model/standIn.ts`). The `name` and `ref`
   * come in for the same reason a refresh's do: the model has no idea what a
   * scope is, and the index says what the tree holds.
   *
   * Its own command rather than an `element.update` with nine cleared fields,
   * so the Activity list can say what the step was and so the rule about what
   * a stand-in carries lives in one place.
   */
  | { type: 'element.link'; id: ElementId; name: string; ref: string }

  // --- relations (ADR-0012 §5) ---------------------------------------------
  | { type: 'relation.create'; relation: Relation; at?: number }
  | { type: 'relation.update'; id: RelationId; patch: Partial<Relation> }
  /** Takes its routes on every diagram. */
  | { type: 'relation.delete'; id: RelationId }

  // --- what is on a view, per diagram (ADR-0012 §6) -------------------------
  /** Upsert by element id: on this view, in this band, under this group. */
  | { type: 'member.set'; diagramId: DiagramId; members: DiagramMember[]; at?: number[] }
  /** Takes each member's node geometry with it. */
  | { type: 'member.remove'; diagramId: DiagramId; elementIds: ElementId[] }
  /** Upsert by id. Renaming a group is this command and nothing else. */
  | { type: 'group.set'; diagramId: DiagramId; groups: DiagramGroup[]; at?: number[] }
  /** Takes the group's box with it; the members it held are the caller's to unfile. */
  | { type: 'group.remove'; diagramId: DiagramId; groupIds: GroupId[] }
  /** A route, both halves at once — the line's constraints and its waypoints. */
  | { type: 'route.set'; diagramId: DiagramId; routes: EdgeRoute[]; at?: number[] }
  | { type: 'route.clear'; diagramId: DiagramId; relationIds: RelationId[] }

  // --- where it ended up, per diagram (ADR-0012 §6) -------------------------
  /** Upsert by element id. A node that is not a member is ignored. */
  | { type: 'node.set'; diagramId: DiagramId; nodes: NodeGeometry[] }
  /** Back to "on the view, not laid out". The inverse of setting a node that had none. */
  | { type: 'node.remove'; diagramId: DiagramId; elementIds: ElementId[] }
  /** Upsert by group id. A box whose group is not on the view is ignored. */
  | { type: 'box.set'; diagramId: DiagramId; boxes: DomainGroupRect[] }
  | { type: 'box.remove'; diagramId: DiagramId; groupIds: GroupId[] }
  | { type: 'board.set'; diagramId: DiagramId; patch: BoardPatch }

  // --- diagrams ------------------------------------------------------------
  | { type: 'diagram.create'; diagram: Diagram; at?: number }
  | { type: 'diagram.rename'; id: DiagramId; name: string }
  /** The whole answer, not a patch: an absent field clears the diagram's own. */
  | { type: 'diagram.settings'; id: DiagramId; settings: DiagramSettings }
  | { type: 'diagram.update'; id: DiagramId; patch: DiagramPatch }
  | { type: 'diagram.delete'; id: DiagramId }

  // --- decisions -----------------------------------------------------------
  | { type: 'decision.add'; decision: Adr; at?: number }
  | { type: 'decision.update'; id: AdrId; patch: Partial<Adr> }
  | { type: 'decision.remove'; id: AdrId }

  // --- plans (ADR-0009) ----------------------------------------------------
  | { type: 'transition.add'; transition: Transition; at?: number }
  | { type: 'transition.update'; id: TransitionId; patch: Partial<Transition> }
  | { type: 'transition.remove'; id: TransitionId }

  // --- the project itself --------------------------------------------------
  | { type: 'project.settings'; patch: ProjectPatch }

  // --- several changes, one undo step --------------------------------------
  | { type: 'transaction'; commands: Command[] }

  // --- a version put back (ADR-0008) ---------------------------------------
  /**
   * The commands that make one thing — or the whole project — what a
   * snapshot held. Applied exactly as a transaction; a type of its own only so
   * the activity list can say what the step WAS: not "changed the settings of
   * Warehouse" but "restored Warehouse as of the 3rd". `restore.ts` builds it.
   */
  | { type: 'restore'; restored: Restored; commands: Command[] }

/** One stand-in's caches, as the tree currently has them (ADR-0012 §3). */
export type StandInCache = {
  id: ElementId
  /** The master's name. */
  name: string
  /** Where the master is — the path, as `DesignElement.ref` spells it. */
  ref: string
}

/** What a restore put back, for the line that names the step. */
export type Restored = {
  what: 'diagram' | 'description' | 'decision' | 'project'
  /** The thing's id; absent for the project. */
  id?: string
  /** What a person calls it; the project's name for a project. */
  name: string
  /** The snapshot's day, `yyyy-mm-dd`. */
  asOf: string
}

export type CommandMeta = {
  /**
   * Two commands with the same key, one after the other, are one undo step.
   * Whoever mints the key decides how wide the run is — per field for a text
   * box, per drag for a move and the routing that follows it.
   */
  coalesce?: string
  /**
   * Off for a change that is not a person's edit: the auto-route toggle, or the
   * editor reporting that it has laid a diagram out. It lands on the model and
   * not on the stack, because ⌘Z should not ask a mode back or undo a layout
   * nobody asked for.
   *
   * Only the outermost command's answer counts — a transaction is one step or
   * none, and what its members say about themselves does not change that.
   */
  undoable?: boolean
  /**
   * Who took the step, when it was not the person at the keyboard (ADR-0007).
   * The activity list says so; the reducer and the stack treat the step like
   * any other, which is the point — ⌘Z after an agent's step undoes the
   * agent's step.
   */
  origin?: 'agent'
  /**
   * The stack may not undo this step, and this key says why (ADR-0012 §10).
   *
   * What a gesture that wrote TWO scopes leaves behind. Only one of the two
   * writes is on this session's stack — the other scope was written through
   * the store, by a session that does not exist — so an undo would put this
   * scope's definition back beside the one now standing in the other scope,
   * which is a conflict the person did not ask for. Confirm-and-forbid is
   * ADR-0012's own first answer to two-scope undo, and a stack that spans
   * scopes is an open question there rather than a thing to build in passing.
   *
   * The reducer neither reads nor carries it: applying a command is the same
   * act either way, and it is the stack above that refuses.
   */
  barrier?: StringKey
}

export type Command = CommandBody & CommandMeta

/**
 * The key that makes a run of edits into one field a single undo step.
 *
 * Typing a name is one decision, not eleven. ⌘Z after writing one should give
 * back the name you had, and without this it gives back the last character.
 *
 * The other way to get there — hold the text in a draft and write it to the
 * model on blur or after a pause — is what the documentation page does, and it
 * is the wrong trade here: the card on the canvas is drawn from the model, so a
 * draft means watching the name you are typing not appear. Keeping every
 * keystroke live and telling the stack they belong together costs one string
 * and changes nothing about what is on screen.
 *
 * One key per row and field, so name and description are two steps, and the
 * same field on two elements never folds into one.
 */
export function fieldEdit(id: string, field: string): string {
  return `field:${id}:${field}`
}

/** Several commands, one undo step. */
export function transaction(commands: Command[], meta: CommandMeta = {}): Command {
  return { type: 'transaction', commands, ...meta }
}

/**
 * Put elements on a view, at a spot: what it means to be on it, and where
 * (ADR-0012 §6).
 *
 * The two halves are two commands because they are two questions — a drag
 * writes only geometry, and a card told to join a group writes only
 * membership. Placing something writes both, and almost every caller that
 * does is placing exactly one card, so this is the one line that says so.
 */
export function placeOn(
  diagramId: DiagramId,
  placed: readonly PlacedNode[],
  at?: number[],
  meta: CommandMeta = {},
): Command {
  return transaction([
    {
      type: 'member.set',
      diagramId,
      members: placed.map(memberOf),
      ...(at ? { at } : {}),
    },
    { type: 'node.set', diagramId, nodes: placed.map(nodeGeometryOf) },
  ], meta)
}

/** A command that changed nothing — what the reducer returns as the inverse of one. */
export const NOTHING: Command = { type: 'transaction', commands: [] }

export function isNothing(command: Command): boolean {
  return command.type === 'transaction' && command.commands.length === 0
}

/**
 * The commands of a transaction, undone: each one's inverse, in reverse order.
 * Written down here rather than in the reducer because it is the definition of
 * what a transaction is, not a step in applying one.
 */
export function reverse(inverses: Command[], meta: CommandMeta = {}): Command {
  const kept = inverses.filter((c) => !isNothing(c))
  if (kept.length === 1) return { ...kept[0], ...meta }
  return transaction([...kept].reverse(), meta)
}

// --- commands built from a model ---------------------------------------------

/**
 * The patch that makes one row into another whole row: every key the old one
 * had cleared, every key the new one has set.
 *
 * Callers that hand over a finished row rather than a change — the editor's
 * batch, the decisions page's list — need this to say the same thing as a
 * patch, and they must not accidentally leave a field behind that the new row
 * does not have.
 */
export function replacement<T extends object>(held: T, next: T): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(held) as (keyof T)[]) patch[key] = undefined
  for (const key of Object.keys(next) as (keyof T)[]) patch[key] = next[key]
  return patch
}

/**
 * A copy of a diagram, directly after the original, named "… (copy)".
 *
 * A constructor rather than a command of its own: duplicating is `diagram.create`
 * with a cloned diagram and an index, and the reducer stays a set of primitives.
 * The clone is deep, so a change in the copy never touches the original;
 * `needsLayout` does not come along, because the drawing is already laid out.
 */
export function duplicateDiagram(
  model: Model,
  id: DiagramId,
  newId: DiagramId,
  copyName: (name: string) => string,
): Command | undefined {
  const source = model.diagrams[id]
  if (!source) return undefined
  const copy: Diagram = { ...structuredClone(source), id: newId, name: copyName(source.name) }
  delete copy.needsLayout
  return { type: 'diagram.create', diagram: copy, at: model.order.diagrams.indexOf(id) + 1 }
}

/**
 * A whole list of decision records, said as the changes that get there.
 *
 * The decisions page edits a list and hands the result back, which is the shape
 * that suited a model you replaced wholesale. Until it dispatches for itself,
 * this works out what actually moved — so undo puts back one record rather than
 * a list, and an untouched record keeps its identity.
 */
export function decisionsToCommands(model: Model, next: readonly Adr[]): Command[] {
  const held = decisionsOf(model)
  const wanted = new Set(next.map((adr) => adr.id))
  const commands: Command[] = []
  for (const id of model.order.decisions) {
    if (!wanted.has(id)) commands.push({ type: 'decision.remove', id })
  }
  for (const adr of next) {
    const before = held[adr.id]
    if (!before) commands.push({ type: 'decision.add', decision: adr })
    else if (!sameAdr(before, adr)) {
      commands.push({ type: 'decision.update', id: adr.id, patch: replacement(before, adr) })
    }
  }
  return commands
}

/**
 * Records are small, flat and built by one factory, so this is honest: what it
 * cannot tell apart, nothing downstream can either.
 */
function sameAdr(a: Adr, b: Adr): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
