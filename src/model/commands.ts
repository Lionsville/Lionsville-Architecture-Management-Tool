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
 * **Meta rides on every command.** `label` is what the activity list and the
 * undo tooltip say; `coalesce` is what makes a run of keystrokes into one field,
 * or a live-routing follow-up and the drag that caused it, a single undo step.
 */
import type { StringKey } from '../i18n/strings'
import type { Adr } from './adr'
import type { AdrId, ConnectionId, Diagram, DiagramId } from './normalised'
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
  /** What this step is called, where a step is named. */
  label?: StringKey
  /**
   * Two commands with the same key, one after the other, are one undo step.
   * Whoever mints the key decides how wide the run is — per field for a text
   * box, per drag for a move and the routing that follows it.
   */
  coalesce?: string
}

export type Command = CommandBody & CommandMeta

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
