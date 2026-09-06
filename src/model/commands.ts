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
import type { Adr } from './adr'
import type { AdrId, ConnectionId, Diagram, DiagramId, Model } from './normalised'
import { decisionsOf } from './normalised'
import type {
  DesignConnection, DesignElement, DiagramLayoutConfig, DiagramPlacement, DiagramSettings,
  EdgeRoute, ElementId,
} from './types'

/** The model's own scalars — everything a project's settings dialog edits. */
export type ProjectPatch = Partial<{
  name: string
  customerName: string
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
  'autoRoute' | 'needsLayout' | 'estimatedMonthlyCost' | 'costEstimateNote' | 'applicationElementId'>>

export type CommandBody =
  // --- elements ------------------------------------------------------------
  | { type: 'element.create'; element: DesignElement; at?: number }
  | { type: 'element.update'; id: ElementId; patch: Partial<DesignElement> }
  /** Takes its connections, its placements and any container view about it. */
  | { type: 'element.delete'; id: ElementId }

  // --- connections ---------------------------------------------------------
  | { type: 'connection.create'; connection: DesignConnection; at?: number }
  | { type: 'connection.update'; id: ConnectionId; patch: Partial<DesignConnection> }
  /** Takes its routes on every diagram. */
  | { type: 'connection.delete'; id: ConnectionId }

  // --- geometry, per diagram -----------------------------------------------
  | { type: 'placement.set'; diagramId: DiagramId; placements: DiagramPlacement[]; at?: number[] }
  | { type: 'placement.remove'; diagramId: DiagramId; elementIds: ElementId[] }
  | { type: 'route.set'; diagramId: DiagramId; routes: EdgeRoute[]; at?: number[] }
  | { type: 'route.clear'; diagramId: DiagramId; connectionIds: ConnectionId[] }
  | { type: 'layout.set'; diagramId: DiagramId; layoutConfig?: DiagramLayoutConfig }

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

  // --- the project itself --------------------------------------------------
  | { type: 'project.settings'; patch: ProjectPatch }

  // --- several changes, one undo step --------------------------------------
  | { type: 'transaction'; commands: Command[] }

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
