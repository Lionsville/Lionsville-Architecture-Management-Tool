// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a step is called, for a list a person reads (ADR-0002, step 9).
 *
 * The log exists either way — every step is a pair of commands, and has been
 * since the reducer landed. This is the part that turns it into something worth
 * showing: one line per step, in words, so "what have I done to this project
 * since I opened it" is a question the app can answer.
 *
 * Derived rather than declared. A `label` on every dispatch would be a second
 * thing to keep true, forgotten at exactly the sites that matter — a command
 * already says what it did, and the only thing it does not carry is what the
 * row was called before the step changed it. So this is handed the model **as
 * it was before**, and resolves the name from there: a delete can still say
 * whose delete it was.
 *
 * It reads the FIRST command of a step deliberately. Every transaction the app
 * builds leads with its subject — the element before its placement, the
 * relation before its route, the group box before its members — so the lead
 * is what the step is about and the rest is what that entailed.
 */
import type { StringKey } from '../i18n/strings'
import type { Command, CommandBody, Restored } from './commands'
import {
  assignmentsOf, causesOf, checkMarksOf, citationsOf, commentsOf, evaluationsOf, decisionsOf, experimentsOf, observationsOf, principlesOf, responsibilitiesOf, rolesOf,
  solutionsOf, transitionsOf, unitTypesOf,
} from './normalised'
import { checkEntry } from './checkCatalogue'
import { commentedName } from './commentable'
import type { Model } from './normalised'
import { RELATION_LABEL } from './relations'
import type { RelationType } from './types'

export type StepSummary = {
  /** What it says. */
  key: StringKey
  /** What it was done to, where naming it helps. */
  name?: string
  /** How many, where a step touched several. */
  count?: number
  /** The day a restored version was taken, `yyyy-mm-dd` (ADR-0008). */
  asOf?: string
  /**
   * For a relation, what kind of row it was (ADR-0012 §5), as the key its
   * label is under rather than the label — a step is named at the moment it is
   * made, and read in whatever language is on screen much later.
   */
  typeKey?: StringKey
  /**
   * A move of the scope (`activity.scopeMoved`): the address it was at, and
   * the one it went to. Not a step of the model's — a move changes no record
   * — but a line of a scope's Activity all the same, read off its history.
   */
  from?: string
  to?: string
}

/**
 * A flow says "connection"; anything else says which row it was.
 *
 * A row whose type the model no longer holds — an update to something deleted
 * in the same breath — falls back to the flow's words, because that is what it
 * almost certainly was and a log line is not the place to say "unknown".
 */
function rowStep(
  type: RelationType | undefined,
  asFlow: StringKey,
  asRow: StringKey,
): StepSummary {
  return type === undefined || type === 'flow'
    ? { key: asFlow }
    : { key: asRow, typeKey: RELATION_LABEL[type] }
}

/** A step nobody can name — the empty transaction, and nothing else. */
const NOTHING: StepSummary = { key: 'activity.nothing' }

/**
 * A step made only of `uses` rows from one source, plus the stand-ins they
 * brought: what `setUses` and `technology.use` write. Anything else in it,
 * or rows from two sources, and it is not that step.
 */
function usesSet(flat: readonly CommandBody[], before: Model): StepSummary | undefined {
  let source: string | undefined
  let count = 0
  for (const command of flat) {
    if (command.type === 'element.create') continue
    const row = command.type === 'relation.create' ? command.relation
      : command.type === 'relation.delete' ? before.relations[command.id]
        : undefined
    if (row?.type !== 'uses') return undefined
    if (source !== undefined && source !== row.sourceId) return undefined
    source = row.sourceId
    count += 1
  }
  if (source === undefined) return undefined
  return { key: 'activity.usesSet', name: before.elements[source]?.name ?? source, count }
}

const RESTORED: Record<Restored['what'], StringKey> = {
  diagram: 'activity.diagramRestored',
  description: 'activity.descriptionRestored',
  decision: 'activity.decisionRestored',
  project: 'activity.projectRestored',
}

export function summarise(commands: readonly Command[], before: Model): StepSummary {
  // A restore says what it is before its members say what it took.
  const restore = commands.find((c) => c.type === 'restore')
  if (restore?.type === 'restore') {
    const { what, name, asOf } = restore.restored
    return { key: RESTORED[what], name, asOf }
  }

  const flat = flatten(commands)
  const lead = flat[0]
  if (!lead) return NOTHING

  const many = (type: CommandBody['type']) => flat.filter((c) => c.type === type).length

  // What an application uses, set as one list (ADR-0020): the rows written
  // and taken off, and any stand-in that arrived with them. Named after the
  // application rather than the first row, because "drew a row (uses)" for
  // a step that rewrote four of them would describe a quarter of it.
  const uses = usesSet(flat, before)
  if (uses) return uses

  switch (lead.type) {
    case 'element.create':
      return { key: 'activity.elementAdded', name: lead.element.name, count: many('element.create') }
    case 'element.update':
      return {
        key: 'activity.elementChanged',
        name: before.elements[lead.id]?.name,
        count: many('element.update'),
      }
    case 'element.delete':
      return {
        key: 'activity.elementDeleted',
        name: before.elements[lead.id]?.name,
        count: many('element.delete'),
      }
    /**
     * Named by the count and not by the first row: a refresh is one gesture
     * over however many stand-ins had gone stale, and "refreshed Billing" for
     * a step that rewrote nine of them would be the log describing a ninth of
     * what happened.
     */
    case 'standin.refresh':
      return { key: 'activity.standInsRefreshed', count: lead.entries.length }
    /**
     * Named against the model as it WAS, like every other line here: a link
     * gives the record the master's name, and a log that read the new one
     * would say the step was about a thing this scope had never called that.
     */
    case 'element.link':
      return { key: 'activity.elementLinked', name: before.elements[lead.id]?.name ?? lead.name }

    // The words follow the type (ADR-0012 §5). A flow keeps the word this tool
    // has always used for it — it is the line a person draws on a board, the
    // one the file still calls a connection, and it is almost every row — and
    // the four the business layer brought say which they are, because "drew a
    // connection" for a row between a capability and a journey step would be
    // the log describing something that did not happen.
    case 'relation.create':
      return rowStep(lead.relation.type, 'activity.relationAdded', 'activity.rowAdded')
    case 'relation.update':
      return rowStep(before.relations[lead.id]?.type, 'activity.relationChanged', 'activity.rowChanged')
    case 'relation.delete':
      return rowStep(before.relations[lead.id]?.type, 'activity.relationDeleted', 'activity.rowDeleted')

    // A card put on a view and a card dragged are one step to a reader, and
    // two commands since ADR-0012 §6 — so both lead-ins count the same rows.
    case 'member.set':
    case 'node.set': {
      const count = new Set(flat.flatMap((c) => (
        c.type === 'member.set' ? c.members.map((m) => m.id)
          : c.type === 'node.set' ? c.nodes.map((n) => n.id)
            : []
      ))).size
      return { key: count === 1 ? 'activity.movedOne' : 'activity.movedMany', count }
    }
    case 'member.remove':
    case 'node.remove': {
      const count = new Set(flat.flatMap((c) => (
        c.type === 'member.remove' || c.type === 'node.remove' ? c.elementIds : []
      ))).size
      return { key: count === 1 ? 'activity.removedOne' : 'activity.removedMany', count }
    }
    case 'route.set':
    case 'route.clear':
      return { key: 'activity.routeChanged' }
    case 'box.set':
    case 'box.remove':
    case 'board.set':
      return { key: 'activity.layoutChanged' }
    case 'group.set':
      return { key: 'activity.groupChanged', name: lead.groups[0]?.name }
    case 'group.remove':
      return {
        key: 'activity.groupRemoved',
        name: before.diagrams[lead.diagramId]?.groups?.[lead.groupIds[0]]?.name,
      }

    case 'diagram.create':
      return { key: 'activity.diagramAdded', name: lead.diagram.name }
    case 'diagram.rename':
      return { key: 'activity.diagramRenamed', name: lead.name }
    case 'diagram.settings':
      return { key: 'activity.diagramSettings', name: lead.settings.name }
    case 'diagram.update':
      return { key: 'activity.diagramChanged', name: before.diagrams[lead.id]?.name }
    case 'diagram.delete':
      return { key: 'activity.diagramDeleted', name: before.diagrams[lead.id]?.name }

    case 'decision.add':
      return { key: 'activity.decisionAdded', name: lead.decision.title }
    case 'decision.update':
      return { key: 'activity.decisionChanged', name: decisionsOf(before)[lead.id]?.title }
    case 'decision.remove':
      return { key: 'activity.decisionRemoved', name: decisionsOf(before)[lead.id]?.title }

    case 'transition.add':
      return { key: 'activity.planAdded', name: lead.transition.title }
    case 'transition.update':
      return { key: 'activity.planChanged', name: transitionsOf(before)[lead.id]?.title }
    case 'transition.remove':
      return { key: 'activity.planRemoved', name: transitionsOf(before)[lead.id]?.title }

    case 'observation.add':
      return { key: 'activity.observationAdded', name: lead.observation.title }
    case 'observation.update':
      return { key: 'activity.observationChanged', name: observationsOf(before)[lead.id]?.title }
    case 'observation.remove':
      return { key: 'activity.observationRemoved', name: observationsOf(before)[lead.id]?.title }
    case 'cause.add':
      return { key: 'activity.causeAdded', name: lead.cause.title }
    case 'cause.update':
      return causeChanged(lead, before)
    case 'cause.remove':
      return { key: 'activity.causeRemoved', name: causesOf(before)[lead.id]?.title }
    case 'solution.add':
      return { key: 'activity.solutionAdded', name: lead.solution.title }
    case 'solution.update':
      return { key: 'activity.solutionChanged', name: solutionsOf(before)[lead.id]?.title }
    case 'solution.remove':
      return { key: 'activity.solutionRemoved', name: solutionsOf(before)[lead.id]?.title }
    case 'experiment.add':
      return { key: 'activity.experimentAdded', name: lead.experiment.title }
    case 'experiment.update':
      return { key: 'activity.experimentChanged', name: experimentsOf(before)[lead.id]?.title }
    case 'experiment.remove':
      return { key: 'activity.experimentRemoved', name: experimentsOf(before)[lead.id]?.title }

    case 'project.settings':
      return { key: settingsKey(lead.patch) }

    case 'transaction':
    case 'restore':
      // Unreachable: `flatten` has none left. Named so the switch is total.
      return NOTHING
    // The operating model's, the assignments' and the marks', families of their own (ADR-0036).
    default:
      return familyStep(lead, flat, before)
  }
}

/** The commands `summarise` hands on: the operating model's, the assignments' and the marks'. */
type FamilyCommand = OperatingCommand | AssignmentCommand | CheckMarkCommand | CommentCommand | PrincipleCommand | CitationCommand | EvaluationCommand

function familyStep(lead: FamilyCommand, flat: readonly CommandBody[], before: Model): StepSummary {
  if (isCommentCommand(lead)) return commentStep(lead, before)
  if (isPrincipleCommand(lead)) return principleStep(lead, before)
  if (isCitationCommand(lead)) return citationStep(lead, before)
  if (isEvaluationCommand(lead)) return evaluationStep(lead, before)
  if (isCheckMarkCommand(lead)) return checkMarkStep(lead, before)
  return isAssignmentCommand(lead) ? assignmentStep(lead, flat, before) : operatingStep(lead, flat, before)
}

/** The scope's settings, or its groups of principles alone (ADR-0041 §3), which a person changes on their own page. */
function settingsKey(patch: Record<string, unknown>): StringKey {
  return Object.keys(patch).length === 1 && 'principleGroups' in patch ? 'activity.principleGroups' : 'activity.projectSettings'
}

/** A principle's commands (ADR-0041). */
type PrincipleCommand = Extract<CommandBody, { type: `principle.${'add' | 'update' | 'remove'}` }>

function isPrincipleCommand(command: CommandBody): command is PrincipleCommand {
  return command.type.startsWith('principle.')
}

function principleStep(lead: PrincipleCommand, before: Model): StepSummary {
  if (lead.type === 'principle.add') return { key: 'activity.principleAdded', name: lead.principle.title }
  const name = principlesOf(before)[lead.id]?.title
  return { key: lead.type === 'principle.update' ? 'activity.principleChanged' : 'activity.principleRemoved', name }
}

/** A citation's commands (ADR-0041 §7): named by the record that cites. */
type CitationCommand = Extract<CommandBody, { type: `citation.${'add' | 'update' | 'remove'}` }>

function isCitationCommand(command: CommandBody): command is CitationCommand {
  return command.type.startsWith('citation.')
}

const CITATION_STEP: Record<CitationCommand['type'], StringKey> = {
  'citation.add': 'activity.citationAdded',
  'citation.update': 'activity.citationChanged',
  'citation.remove': 'activity.citationRemoved',
}

function citationStep(lead: CitationCommand, before: Model): StepSummary {
  const citation = lead.type === 'citation.add' ? lead.citation : citationsOf(before)[lead.id]
  return { key: CITATION_STEP[lead.type], name: citation ? commentedName(before, citation.about) : undefined }
}

/** An evaluation's commands (ADR-0043 §4): named by the block, where this scope knows it, and by its id where not. */
type EvaluationCommand = Extract<CommandBody, { type: `evaluation.${'add' | 'update' | 'remove'}` }>

function isEvaluationCommand(command: CommandBody): command is EvaluationCommand {
  return command.type.startsWith('evaluation.')
}

const EVALUATION_STEP: Record<EvaluationCommand['type'], StringKey> = {
  'evaluation.add': 'activity.evaluationAdded',
  'evaluation.update': 'activity.evaluationChanged',
  'evaluation.remove': 'activity.evaluationRemoved',
}

function evaluationStep(lead: EvaluationCommand, before: Model): StepSummary {
  const evaluation = lead.type === 'evaluation.add' ? lead.evaluation : evaluationsOf(before)[lead.id]
  const block = evaluation?.block.id
  return { key: EVALUATION_STEP[lead.type], name: block === undefined ? undefined : before.elements[block]?.name ?? block }
}

/** A comment's commands (ADR-0037). */
type CommentCommand = Extract<CommandBody, { type: `comment.${'add' | 'update' | 'remove' | 'take' | 'put'}` }>

function isCommentCommand(command: CommandBody): command is CommentCommand {
  return command.type.startsWith('comment.')
}

const COMMENT_STEP: Record<CommentCommand['type'], StringKey> = {
  'comment.add': 'activity.commentAdded',
  'comment.update': 'activity.commentEdited',
  'comment.remove': 'activity.commentRemoved',
  'comment.take': 'activity.commentTaken',
  'comment.put': 'activity.commentPut',
}

/**
 * A comment written, edited or removed (ADR-0037 §7): named by the record it
 * is about, as that record was called before the step — *Commented on
 * Webshop*.
 */
function commentStep(lead: CommentCommand, before: Model): StepSummary {
  const about = lead.type === 'comment.add' || lead.type === 'comment.put' ? lead.comment.about : commentsOf(before)[lead.id]?.about
  return { key: COMMENT_STEP[lead.type], ...(about ? { name: commentedName(before, about) } : {}) }
}

/** A mark's commands (ADR-0036, amended). */
type CheckMarkCommand = Extract<CommandBody, { type: `checkMark.${'add' | 'remove'}` }>

function isCheckMarkCommand(command: CommandBody): command is CheckMarkCommand {
  return command.type.startsWith('checkMark.')
}

/**
 * A finding marked as intended, or taken back: named by its check, in the
 * language on screen when the line is read — the check's name is a key, as a
 * row's kind is. The instance is not named: a mark holds ids, and the line is
 * kept for as long as the history is.
 */
function checkMarkStep(lead: CheckMarkCommand, before: Model): StepSummary {
  const check = lead.type === 'checkMark.add' ? lead.mark.check : checkMarksOf(before)[lead.id]?.check
  const name = check === undefined ? undefined : checkEntry(check)?.name
  return {
    key: lead.type === 'checkMark.add' ? 'activity.checkMarkAdded' : 'activity.checkMarkRemoved',
    ...(name !== undefined ? { typeKey: name } : {}),
  }
}

/** An assignment's commands (ADR-0036 §4). */
type AssignmentCommand = Extract<CommandBody, { type: `assignment.${'add' | 'update' | 'remove'}` }>

function isAssignmentCommand(command: CommandBody): command is AssignmentCommand {
  return command.type.startsWith('assignment.')
}

/**
 * A step about who holds which role. The line names the unit and never the
 * person: a step is kept for as long as the history is, and a name in it is
 * one a forget could not reach (ADR-0036 §8). Several ends in one step — a
 * person leaving, a plan moving its people — are counted rather than named.
 */
function assignmentStep(lead: AssignmentCommand, flat: readonly CommandBody[], before: Model): StepSummary {
  const held = (id: string) => assignmentsOf(before)[id]
  const unitName = (unitId: string | undefined) => (unitId === undefined ? undefined : before.elements[unitId]?.name ?? unitId)
  const ends = flat.filter((command) => command.type === 'assignment.update' && isEnd(command.patch)).length
  if (ends > 1) return { key: 'activity.assignmentsEnded', count: ends }
  const adds = flat.filter((command) => command.type === 'assignment.add').length
  if (adds > 1) return { key: 'activity.assignmentsAdded', count: adds }
  switch (lead.type) {
    case 'assignment.add': return { key: 'activity.assignmentAdded', name: unitName(lead.assignment.unitId) }
    case 'assignment.update':
      return { key: isEnd(lead.patch) ? 'activity.assignmentEnded' : 'activity.assignmentChanged', name: unitName(held(lead.id)?.unitId) }
    case 'assignment.remove': return { key: 'activity.assignmentRemoved', name: unitName(held(lead.id)?.unitId) }
  }
}

/** A patch that sets an assignment's last day and nothing else: an end. */
function isEnd(patch: object): boolean {
  const keys = Object.keys(patch)
  return keys.length === 1 && keys[0] === 'until' && typeof (patch as { until?: unknown }).until === 'string'
}

/** The operating model's commands: what `summarise` hands on. */
type OperatingCommand = Extract<CommandBody, {
  type: `${'unitType' | 'role' | 'responsibility' | 'operatingRule'}.${'add' | 'update' | 'remove'}`
}>

/**
 * A step of the operating model (ADR-0036). Bringing items in from a library
 * is one step of several adds, each saying where it came from, and the line
 * says that rather than naming the first of them. One that brings nothing in
 * and only matches entries to the organisation's own items says that.
 */
function operatingStep(lead: OperatingCommand, flat: readonly CommandBody[], before: Model): StepSummary {
  const brought = flat.filter((command) => basedOnOf(command) !== undefined).length
  if (brought > 0 && lead.type.endsWith('.add')) return { key: 'activity.broughtIn', count: brought }
  const matched = matchesRecorded(flat, before)
  if (matched > 0) return { key: 'activity.matchedIn', count: matched }
  switch (lead.type) {
    case 'unitType.add': return { key: 'activity.unitTypeAdded', name: lead.unitType.name }
    case 'unitType.update': return { key: 'activity.unitTypeChanged', name: unitTypesOf(before)[lead.id]?.name }
    case 'unitType.remove': return { key: 'activity.unitTypeRemoved', name: unitTypesOf(before)[lead.id]?.name }
    case 'role.add': return { key: 'activity.roleAdded', name: lead.role.name }
    case 'role.update': return { key: 'activity.roleChanged', name: rolesOf(before)[lead.id]?.name }
    case 'role.remove': return { key: 'activity.roleRemoved', name: rolesOf(before)[lead.id]?.name }
    case 'responsibility.add': return { key: 'activity.responsibilityAdded', name: lead.responsibility.name }
    case 'responsibility.update':
      return { key: 'activity.responsibilityChanged', name: responsibilitiesOf(before)[lead.id]?.name }
    case 'responsibility.remove':
      return { key: 'activity.responsibilityRemoved', name: responsibilitiesOf(before)[lead.id]?.name }
    case 'operatingRule.add':
    case 'operatingRule.update':
    case 'operatingRule.remove':
      return { key: 'activity.operatingRuleChanged' }
  }
}

/**
 * How many library entries a step records as matched to the organisation's
 * own unit types and roles (`alsoBasedOn`), where that is all it does: a
 * bring-in in which everything asked for was reused. Nothing otherwise.
 */
function matchesRecorded(flat: readonly CommandBody[], before: Model): number {
  let count = 0
  for (const command of flat) {
    if (command.type !== 'unitType.update' && command.type !== 'role.update') return 0
    if (Object.keys(command.patch).join() !== 'alsoBasedOn') return 0
    const held = command.type === 'role.update' ? rolesOf(before)[command.id] : unitTypesOf(before)[command.id]
    count += (command.patch.alsoBasedOn?.length ?? 0) - (held?.alsoBasedOn?.length ?? 0)
  }
  return count
}

/** Where an added item of the operating model came from, if a library. */
function basedOnOf(command: CommandBody): object | undefined {
  switch (command.type) {
    case 'unitType.add': return command.unitType.basedOn
    case 'role.add': return command.role.basedOn
    case 'responsibility.add': return command.responsibility.basedOn
    default: return undefined
  }
}

/**
 * A cause changed. Becoming a root cause, and going back, are claims somebody
 * made (ADR-0032 §3), and the line says which rather than "changed"; a patch
 * that names `root` and says what it already was is an ordinary change.
 */
function causeChanged(lead: Extract<CommandBody, { type: 'cause.update' }>, before: Model): StepSummary {
  const held = causesOf(before)[lead.id]
  const name = held?.title
  if ('root' in lead.patch && Boolean(lead.patch.root) !== Boolean(held?.root)) {
    return { key: lead.patch.root ? 'activity.causeMadeRoot' : 'activity.causeMadeCause', name }
  }
  return { key: 'activity.causeChanged', name }
}

/** Every command of a step, transactions opened out, in the order they ran. */
function flatten(commands: readonly Command[]): CommandBody[] {
  const out: CommandBody[] = []
  for (const command of commands) {
    if (command.type === 'transaction' || command.type === 'restore') out.push(...flatten(command.commands))
    else out.push(command)
  }
  return out
}
