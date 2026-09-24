// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The write tier: a request turned into one `Command` (ADR-0007).
 *
 * Every tool here is one command, usually a `transaction`, dispatched at the
 * session by the handler — so it is one undo step, one Activity line, and one
 * autosave, exactly as if a person had done it. Nothing here touches the
 * model: it builds the command against the model as it stands and hands it
 * over, and the reducer is the only writer.
 *
 * It takes the id policy and the id maker as arguments, because the session's
 * model is the truth about what is taken and a function that mints its own
 * ids cannot be called twice for the same answer. What comes back with the
 * command is what to answer once it has landed, which is where a new id is
 * told to the agent.
 */
import type { Adr, AdrSigner, AdrVerdict } from '../model/adr'
import type { Command } from '../model/commands'
import {
  causesToCommands, experimentsToCommands, observationsToCommands, placeOn, solutionsToCommands, transaction,
} from '../model/commands'
import { claimKey } from '../model/keys'
import type { IdPolicy, MakeId } from '../model/keys'
import type { Diagram, Model } from '../model/normalised'
import { toDiagram, toArrays } from '../model/normalised'
import { CANVAS_KINDS,
  canPlaceKind, clampPlacementIntoZone, defaultContainerPosition, defaultZonePosition, freeSlotIn,
  freeZonePosition, groupRectAround, memberOf, placementRect, rectCenter, rectsIntersect, unionRects,
} from '../model/placement'
import { HOME_ZONE, zoneForPoint } from '../model/zones'
import { nodeFigure } from '../model/kinds'
import { isDay } from '../model/lifecycle'
import { seedContainerDiagram } from '../model/containerDiagram'
import { isPlatformArchetype, technologyEndsRefusal } from '../model/relations'
import { mayBeHosted } from '../model/hosting'
import { COLOUR_BY, isColourBy, oneColouredBy } from '../model/overlay'
import { acceptImplied, impliedInterfaces } from '../model/implied'
import { DEFAULT_PAPER, isSheetPaper } from '../business/grid'
import { seedMap } from '../business/map'
import { rootsOfKind, seedSheet } from '../business/sheetDiagram'
import { wouldCycle } from '../business/tree'
import { seedTechnologyLandscape } from '../model/technologyLandscape'
import { portCommands, portsOf, unplannedPorts, unportCommands } from '../model/porting'
import { replacementCommands } from '../model/replacement'
import {
  findTransition, nextTransitionNumber, transitionLabel, transitionsFrom as planTransitionsFrom,
} from '../model/transition'
import type { Transition, TransitionElement, TransitionMilestone, TransitionRole, TransitionStatus } from '../model/transition'
import {
  boxesOf, causeList, decisionList, decisionsOf, experimentList, fromArrays, groupList, observationList, placedOn,
  solutionList, transitionList,
} from '../model/normalised'
import type {
  CauseLink, CauseState, CauseStrength, EarlierAttempt, ExperimentOutcome, ObservationImpact, SolutionSize, SolutionState,
} from '../model/observation'
import {
  addressCause, concludeExperiment, decisionContext, defaultStrength, dropSolution, forgetCause, formatExperimentNumber,
  formatSolutionNumber, linkRecord, moveSolution, newExperiment, newSolution, nextExperimentNumber, nextSolutionNumber,
  removeExperiment, removeSolution, restoreSolution, unaddressCause, updateExperiment, updateSolution, waiveExperiment,
} from '../observations/solution'
import type { ExperimentPatch, SolutionPatch, SolutionWork } from '../observations/solution'
import {
  absorbShared, formatCauseNumber, formatObservationNumber, linkCause, mergeObservations, newCause, newObservation,
  nextCauseNumber, nextObservationNumber, removeCause, removeObservation, seenAgain, setArchived, setShared, unlinkCause,
  updateCause, updateObservation,
} from '../observations/observation'
import type { Analysis, CausePatch, ObservationPatch } from '../observations/observation'
import { businessCaseTemplate } from '../documentation/businessCase'
import type {
  DesignDiagram, DesignElement, DiagramGroup, PlacedNode, DomainGroupRect, EdgeLineStyle,
  ElementId, Relation, RelationType,
  AspectStatus, ElementKind, Layer7Zone, Rect,
} from '../model/types'
import type { AdrStatus } from '../model/adr'
import { formatAdrNumber, isAdrDeletable, isAdrLocked, newAdr, nextAdrNumber, transitionAdr, transitionsFrom } from '../decisions/adr'
import { alignNodes, distributeNodes } from '../layout/alignDistribute'
import type { AlignAxis, DistributeAxis, NodeBounds } from '../layout/alignDistribute'
import type { Translate } from '../i18n/strings'
import {
  causeLine, experimentLine, findCause, findExperiment, findObservation, findSolution, observationLine, planEntry,
  solutionFacts, solutionLine,
} from './answer'
import type { ReadView } from './answer'
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'

/** What a write needs beyond a read: where ids come from, and the day. */
export type WriteView = ReadView & {
  readonly ids: IdPolicy
  readonly makeId: MakeId
  /** Today as `yyyy-mm-dd`, for a decision's date. */
  readonly today: () => string
  /** For the MADR template a new record starts from. */
  readonly translate: Translate
  /** What a container view is called, after its application. The shell owns the words. */
  readonly containerName: (applicationName: string) => string
  /** What a technology view is called, after its platform (ADR-0013). */
  /**
   * Does another scope answer for the fields this patch touches (ADR-0012 §10)?
   *
   * Answers with the owning scope's path — the empty string being the
   * organisation — when the write must be refused, and `undefined` when it may
   * go ahead. The refusal is the same one the inspector greys a field out for,
   * so an agent cannot write what a person is shown as read-only.
   *
   * Handed in rather than worked out here: `agent` may not import `projects`
   * and has no business learning what a scope tree is. The workspace wires
   * `projects/mayEdit.ts` to it. Absent means nothing is refused, which is what
   * a node test with two plain objects in the session wants and what a session
   * opened before the tree was read honestly knows.
   */
  readonly ownedElsewhere?: (
    id: ElementId, patch: Partial<DesignElement>,
  ) => { owner?: string } | undefined
  /**
   * Does some scope in the organisation define this id (ADR-0012 §2)? A
   * relation may reach one end into another scope — an organisation's
   * capability supported by a landscape's application (§5) — and this is how
   * the end is told from a typo. Absent means only this scope's own ids are
   * known, which is what a session with no tree honestly has.
   */
  readonly known?: (id: ElementId) => boolean
  /**
   * The stand-in this scope would keep of a platform or a service another
   * scope defines (ADR-0017, ADR-0020): the two caches and nothing of the
   * owner's detail, written in the same step as the row that names it.
   * Handed in for the reason `known` is; absent, a target this scope does
   * not hold is unknown.
   */
  readonly standInFor?: (id: ElementId) => DesignElement | undefined
}

/** A command, and what to say once it has landed. */
export type Prepared = {
  readonly command: Command
  /** Switch to this diagram with the command, the way the shell does for a new one. */
  readonly activeDiagramId?: string
  readonly answer: AgentAnswer
}

type Args = Record<string, unknown>

/** The command for a request, or the refusal that stops it before the reducer. */
export function commandFor(tool: ToolName, rawArgs: unknown, view: WriteView): Prepared | AgentAnswer {
  const wrong = checkArguments(toolSpec(tool).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as Args
  const { model } = view

  switch (tool) {
    case 'element.add': return addElement(args, view)
    case 'element.update': {
      const id = args.id as string
      const held = model.elements[id]
      if (!held) return refused('agent.unknownId', `element ${id}`)
      const patch = elementPatch(args, held, view)
      if ('ok' in patch) return patch
      // A stand-in's owner's detail belongs to the scope that defines it, and
      // the refusal carries that scope so a client can go and open it.
      const owned = view.ownedElsewhere?.(id, patch)
      if (owned) return refused('check.ownedElsewhere', owned.owner ?? '')
      return {
        command: { type: 'element.update', id, patch, origin: 'agent' },
        answer: json({ id, changed: Object.keys(patch) }),
      }
    }
    case 'element.remove': {
      const id = args.id as string
      const held = model.elements[id]
      if (!held) return refused('agent.unknownId', `element ${id}`)
      return { command: { type: 'element.delete', id, origin: 'agent' }, answer: json({ id, name: held.name, removed: true }) }
    }
    case 'connect': {
      const sourceId = args.sourceId as string
      const targetId = args.targetId as string
      for (const id of [sourceId, targetId]) if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
      if (sourceId === targetId) return refused('agent.badArguments', 'a connection needs two different elements')
      const bare: Relation = { id: view.ids.connection(), type: 'flow', sourceId, targetId, isBidirectional: false }
      const patch = relationPatch(args, bare)
      if ('ok' in patch) return patch
      const relation: Relation = { ...bare, ...patch }
      for (const key of Object.keys(patch) as (keyof Relation)[]) if (relation[key] === undefined) delete relation[key]
      return {
        command: { type: 'relation.create', relation, origin: 'agent' },
        answer: json({ id: relation.id, sourceId, targetId }),
      }
    }
    case 'connection.update': {
      const id = args.id as string
      const held = model.relations[id]
      if (!held) return refused('agent.unknownId', `connection ${id}`)
      const patch = relationPatch(args, held)
      if ('ok' in patch) return patch
      return {
        command: { type: 'relation.update', id, patch, origin: 'agent' },
        answer: json({ id, changed: Object.keys(patch) }),
      }
    }
    case 'connections.update': {
      const items = args.items as Args[]
      const commands: Command[] = []
      const changed: { id: string; changed: string[] }[] = []
      for (const [index, item] of items.entries()) {
        const id = item.id as string
        const held = model.relations[id]
        if (!held) return refused('agent.unknownId', `connection ${id}`)
        const patch = relationPatch(item, held)
        if ('ok' in patch) return withDetail(patch, `items[${index}]`)
        commands.push({ type: 'relation.update', id, patch })
        changed.push({ id, changed: Object.keys(patch) })
      }
      return { command: transaction(commands, { origin: 'agent' }), answer: json({ updated: changed }) }
    }
    /**
     * The application interface the container lines imply, written, with every
     * one of them landed on it (ADR-0013). One step, one undo, and the same
     * arithmetic the finding came from — so an agent that accepts a finding
     * gets exactly what a person pressing *Accept* gets.
     */
    case 'interface.accept': {
      const id = args.id as string
      if (!model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
      const relations = model.order.relations.map((held) => model.relations[held])
      const implied = impliedInterfaces(relations, (held) => model.elements[held])
        .find((one) => one.relations.some((row) => row.id === id))
      if (!implied) {
        return refused('agent.badArguments', `${id} is not a container-level line without an application interface`)
      }
      const made = view.ids.connection()
      const nameOf = (held: ElementId) => model.elements[held]?.name ?? held
      const command = acceptImplied(implied, made, nameOf)
      return {
        command: { ...command, origin: 'agent' },
        answer: json({
          id: made,
          sourceId: implied.sourceId,
          targetId: implied.targetId,
          refinements: implied.relations.map((row) => row.id),
        }),
      }
    }
    case 'connection.remove': {
      const id = args.id as string
      if (!model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
      return { command: { type: 'relation.delete', id, origin: 'agent' }, answer: json({ id, removed: true }) }
    }
    /**
     * The four types the business layer needs (ADR-0012 §5). A flow keeps
     * `connect` and `connection.*`, which are published names and say more —
     * a protocol, a direction, a colour — because only a flow has them.
     */
    case 'relation.add': {
      const type = args.type as RelationType
      const sourceId = args.sourceId as string
      const targetId = args.targetId as string
      // One end may be another scope's, as long as the tree knows it; a row
      // about nothing this scope holds is somebody else's row to write.
      for (const id of [sourceId, targetId]) {
        if (!model.elements[id] && !view.known?.(id)) return refused('agent.unknownId', `element ${id}`)
      }
      if (!model.elements[sourceId] && !model.elements[targetId]) {
        return refused('agent.badArguments', 'a relation needs at least one end this scope holds')
      }
      if (sourceId === targetId) return refused('agent.badArguments', 'a relation needs two different elements')
      // The technology rows' ends (ADR-0013, ADR-0014), judged where this scope
      // can see what an end is; an id the tree knows and this scope does not
      // is trusted, as every other row's far end is. `hostedOn` is refused
      // with the writer's own key, so a tool call hears what a person hears.
      const wrongEnds = technologyEndsRefusal({ type, sourceId, targetId }, (id) => model.elements[id])
      if (wrongEnds === 'hostedOn') {
        return refused('command.technologyEnds', `${sourceId} → ${targetId}`)
      }
      if (wrongEnds !== undefined) {
        const kindOf = (id: string) => model.elements[id]?.kind ?? 'unknown'
        return refused('agent.badArguments', `${type} does not run ${kindOf(sourceId)} → ${kindOf(targetId)}`)
      }
      // Where an application with components runs is its components' to say
      // (ADR-0013, redone). Refused here as well as by the writer, with the
      // writer's own key, so a tool call hears the sentence a person hears.
      if (type === 'hostedOn' && !mayBeHosted(Object.values(model.elements), sourceId)) {
        return refused('command.hostedOnContainers', `${sourceId} has components; write the row from one of them`)
      }
      const bare: Relation = { id: view.ids.connection(), type, sourceId, targetId }
      const patch = relationPatch(args, bare)
      if ('ok' in patch) return patch
      const relation: Relation = { ...bare, ...patch }
      for (const key of Object.keys(patch) as (keyof Relation)[]) if (relation[key] === undefined) delete relation[key]
      return {
        command: { type: 'relation.create', relation, origin: 'agent' },
        answer: json({ id: relation.id, type, sourceId, targetId }),
      }
    }
    case 'technology.use': {
      // What an application uses, as one list (ADR-0020): the editor's
      // `setUses`, said to an agent. The rows lead and any stand-in comes
      // first, as the editor writes it, so one undo takes the step back whole.
      const elementId = args.elementId as string
      const targetIds = args.targetIds as string[]
      const source = model.elements[elementId]
      if (!source) return refused('agent.unknownId', `element ${elementId}`)
      if (source.kind !== 'application' && source.kind !== 'component') {
        return refused('command.technologyEnds', `${elementId} is a ${source.kind}`)
      }
      const wanted: string[] = []
      const arrives: Command[] = []
      for (const targetId of targetIds) {
        if (wanted.includes(targetId) || targetId === elementId) continue
        const held = model.elements[targetId]
        if (held) {
          if (held.kind !== 'platform' && held.kind !== 'platformService') {
            return refused('command.technologyEnds', `${elementId} → ${targetId} is a ${held.kind}`)
          }
        } else {
          const standIn = view.standInFor?.(targetId)
          if (!standIn || (standIn.kind !== 'platform' && standIn.kind !== 'platformService')) {
            return refused('agent.unknownId', `platform or platformService ${targetId}`)
          }
          arrives.push({ type: 'element.create', element: standIn })
        }
        wanted.push(targetId)
      }
      const held = model.order.relations
        .map((id) => model.relations[id])
        .filter((row) => row.type === 'uses' && row.sourceId === elementId)
      const removed = held.filter((row) => !wanted.includes(row.targetId))
      const written = wanted
        .filter((targetId) => !held.some((row) => row.targetId === targetId))
        .map((targetId): Relation => ({ id: view.ids.connection(), type: 'uses', sourceId: elementId, targetId }))
      const answer = json({
        elementId,
        uses: wanted,
        written: written.map((row) => ({ id: row.id, targetId: row.targetId })),
        removed: removed.map((row) => ({ id: row.id, targetId: row.targetId })),
        standIns: arrives.map((command) => (command.type === 'element.create' ? command.element.id : '')).filter(Boolean),
      })
      // Saying what is already said is not a step.
      if (removed.length === 0 && written.length === 0) return answer
      return {
        command: transaction([
          ...arrives,
          ...removed.map((row): Command => ({ type: 'relation.delete', id: row.id })),
          ...written.map((relation): Command => ({ type: 'relation.create', relation })),
        ], { origin: 'agent' }),
        answer,
      }
    }
    case 'relation.update': {
      const id = args.id as string
      const held = model.relations[id]
      if (!held) return refused('agent.unknownId', `relation ${id}`)
      const patch = relationPatch(args, held)
      if ('ok' in patch) return patch
      if (typeof args.type === 'string') patch.type = args.type as RelationType
      return {
        command: { type: 'relation.update', id, patch, origin: 'agent' },
        answer: json({ id, changed: Object.keys(patch) }),
      }
    }
    case 'relation.remove': {
      const id = args.id as string
      if (!model.relations[id]) return refused('agent.unknownId', `relation ${id}`)
      return { command: { type: 'relation.delete', id, origin: 'agent' }, answer: json({ id, removed: true }) }
    }
    case 'connections.remove': {
      const ids = [...new Set(args.ids as string[])]
      for (const id of ids) if (!model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
      return {
        command: transaction(ids.map((id) => ({ type: 'relation.delete' as const, id })), { origin: 'agent' }),
        answer: json({ removed: ids }),
      }
    }
    case 'decision.propose': return proposeDecision(args, view)
    case 'observation.record':
    case 'observation.update':
    case 'observation.seen':
    case 'observation.archive':
    case 'observation.merge':
    case 'observation.remove':
    case 'cause.add':
    case 'cause.update':
    case 'cause.link':
    case 'cause.unlink':
    case 'cause.remove':
      return observationCommand(tool, args, view)
    case 'solution.propose':
    case 'solution.update':
    case 'solution.address':
    case 'solution.unaddress':
    case 'solution.move':
    case 'solution.waive':
    case 'solution.drop':
    case 'solution.restore':
    case 'solution.decide':
    case 'solution.plan':
    case 'solution.remove':
    case 'experiment.plan':
    case 'experiment.update':
    case 'experiment.conclude':
    case 'experiment.remove':
      return solutionCommand(tool, args, view)
    case 'decision.transition': return transitionDecision(args, view)
    case 'decision.update': return updateDecision(args, view)
    case 'decision.remove': {
      const id = args.id as string
      const held = ownDecision(id, view)
      if ('ok' in held) return held
      if (!isAdrDeletable(held)) return refused('agent.locked', id)
      // Whoever said it was superseded by this one is told otherwise — the
      // same rule the decisions page follows — so no record points at nothing.
      const orphaned = model.order.decisions
        .filter((other) => decisionsOf(model)[other].supersededBy === id)
        .map((other): Command => ({ type: 'decision.update', id: other, patch: { supersededBy: undefined } }))
      return {
        command: transaction([{ type: 'decision.remove', id }, ...orphaned], { origin: 'agent' }),
        answer: json({ id, label: formatAdrNumber(held.number), title: held.title, removed: true }),
      }
    }
    case 'diagram.create': return createDiagram(args, view)
    case 'diagram.update': return updateDiagram(args, view)
    case 'plan.replace': return replace(args, view)
    case 'plan.port': return port(args, view)
    case 'plan.unport': return unport(args, view)
    case 'plan.create': return createPlan(args, view)
    case 'plan.update': return updatePlan(args, view)
    case 'plan.remove': {
      const plan = planOf(args.id, view)
      if (!plan) return refused('agent.unknownId', `plan ${String(args.id)}`)
      return {
        command: { type: 'transition.remove', id: plan.id, origin: 'agent' },
        answer: json({ id: plan.id, label: transitionLabel(plan), title: plan.title, removed: true }),
      }
    }
    case 'milestone.add':
    case 'milestone.update':
    case 'milestone.remove':
      return milestone(tool, args, view)

    case 'moveBy': {
      const placed = onDiagram(args, view)
      if ('ok' in placed) return placed
      const { diagram, placements } = placed
      const dx = args.dx as number
      const dy = args.dy as number
      const moved = placements.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
      return {
        command: placeOn(diagram.id, moved, undefined, { origin: 'agent' }),
        answer: json({ diagramId: diagram.id, moved: moved.map(({ id: elementId, x, y }) => ({ id: elementId, x, y })) }),
      }
    }
    case 'placeNextTo': {
      const diagram = diagramOrRefusal(args, view)
      if ('ok' in diagram) return diagram
      const elementId = args.elementId as string
      const anchorId = args.anchorId as string
      const element = model.elements[elementId]
      const anchor = model.elements[anchorId]
      if (!element) return refused('agent.unknownId', `element ${elementId}`)
      if (!anchor) return refused('agent.unknownId', `element ${anchorId}`)
      const anchorPlacement = placedOn(diagram, anchorId)
      if (!anchorPlacement) return refused('agent.notDrawn', anchorId)
      const held = placedOn(diagram, elementId)
      if (!held) return refused('agent.notDrawn', elementId)
      const gap = (args.gap as number | undefined) ?? 40
      const side = (args.side as 'right' | 'left' | 'above' | 'below' | undefined) ?? 'right'
      const a = placementRect(nodeFigure(anchor, anchorPlacement.zone), anchorPlacement)
      const mine = placementRect(nodeFigure(element, held.zone), held)
      const spot = side === 'right' ? { x: a.x + a.width + gap, y: a.y }
        : side === 'left' ? { x: a.x - gap - mine.width, y: a.y }
        : side === 'above' ? { x: a.x, y: a.y - gap - mine.height }
        : { x: a.x, y: a.y + a.height + gap }
      const beside: PlacedNode = {
        ...held, ...spot,
        ...(anchorPlacement.zone !== undefined ? { zone: anchorPlacement.zone } : {}),
        ...(anchorPlacement.group !== undefined ? { group: anchorPlacement.group } : {}),
      }
      if ((beside.zone ?? 'landscape') !== 'landscape') delete beside.group
      // Beside its anchor in the anchor's band means inside that band: right of
      // the last card in a side band is outside it, and the report would say so.
      const placement = diagram.kind === 'layer7' ? keptInBand(model, diagram, element, beside) : beside
      const commands: Command[] = [placeOn(diagram.id, [placement])]
      const layout = diagram.kind === 'layer7' && placement.group !== undefined
        ? growGroup(diagram, placement.group, placementRect(nodeFigure(element, placement.zone), placement)) : undefined
      if (layout) commands.push(layout)
      const clamped = placement.x !== spot.x || placement.y !== spot.y
      return {
        command: transaction(commands, { origin: 'agent' }),
        answer: json({
          diagramId: diagram.id, elementId, x: placement.x, y: placement.y, zone: placement.zone,
          domainGroup: groupNameOn(diagram, placement.group),
          ...(clamped ? { clamped: true, note: 'Moved to stay inside its band.' } : {}),
        }),
      }
    }
    case 'element.place': return placeElement(args, view)
    case 'element.draw': return drawElement(args, view)
    case 'element.undraw': {
      const diagram = diagramOrRefusal(args, view)
      if ('ok' in diagram) return diagram
      const id = args.id as string
      if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
      if (!placedOn(diagram, id)) return refused('agent.notDrawn', id)
      return {
        command: { type: 'member.remove', diagramId: diagram.id, elementIds: [id], origin: 'agent' },
        answer: json({ diagramId: diagram.id, elementId: id, undrawn: true }),
      }
    }
    case 'ungroup': return ungroup(args, view)
    case 'group': return groupElements(args, view)
    case 'align':
    case 'distribute': {
      const placed = onDiagram(args, view)
      if ('ok' in placed) return placed
      const { diagram, placements } = placed
      const bounds: NodeBounds[] = placements.map((p) => ({ id: p.id, ...placementRect(nodeFigure(model.elements[p.id], p.zone), p) }))
      const updates = tool === 'align'
        ? alignNodes(bounds, args.axis as AlignAxis)
        : distributeNodes(bounds, args.axis as DistributeAxis)
      const moved = updates.map((u) => ({ ...placedOn(diagram, u.id)!, x: u.x, y: u.y }))
      return {
        command: placeOn(diagram.id, moved, undefined, { origin: 'agent' }),
        answer: json({ diagramId: diagram.id, moved: updates }),
      }
    }

    default:
      return refused('agent.unknownTool', tool)
  }
}

// --- the tools that build a row -----------------------------------------------------

function addElement(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const name = (args.name as string).trim()
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  const kind = (args.kind as ElementKind | undefined) ?? 'application'
  // Read before the row is built: it decides what the box is drawn as, and
  // therefore where it lands and how big it is (ADR-0012 §4).
  const outside = args.outside === true
  // A record kind is drawn nowhere, so it needs no diagram: an agent on a
  // scope whose home is up — nothing on screen — can still add a function or
  // a step. A diagram it names is still checked, because naming one that does
  // not exist is a mistake worth hearing about.
  const record = !CANVAS_KINDS.includes(kind)
  const diagram = record && args.diagramId === undefined ? undefined : diagramOrRefusal(args, view)
  if (diagram && 'ok' in diagram) return diagram
  const parentId = args.parentId as string | undefined
  if (parentId !== undefined && !model.elements[parentId]) {
    return refused('agent.unknownId', `element ${parentId}`)
  }

  const id = view.ids.element(name)
  const bare: DesignElement = {
    id,
    kind,
    ...(outside ? { outside: true as const } : {}),
    name,
    lifecycle: 'live',
    // Managed unless nobody here runs it: a person or a team, a
    // responsibility, a journey, or a system — or a platform, or what it
    // offers — somebody else owns.
    isManaged: (kind === 'application' || kind === 'component' || kind === 'platform' || kind === 'platformService') && !outside,
    aspects: {},
    ...(parentId !== undefined
      ? { parentId }
      : kind === 'component' && diagram?.kind === 'container' && diagram.applicationElementId
        ? { parentId: diagram.applicationElementId }
        : {}),
  }
  // The same fields, read the same way as an update, applied to the bare row.
  const patch = elementPatch(args, bare, view)
  if ('ok' in patch) return patch
  const element: DesignElement = { ...bare, ...patch }
  for (const key of Object.keys(patch) as (keyof DesignElement)[]) if (element[key] === undefined) delete element[key]

  // A record and a drawing are two acts (ADR-0012 §10). A business kind has no
  // place on a canvas — a sheet is laid out from the tree, not dragged — so the
  // record is made and nothing is drawn, and the answer says which happened
  // rather than refusing a thing that is perfectly real.
  if (!diagram || !canPlaceKind(kind, diagram.kind).ok) {
    // A root step is a journey, and a sheet draws one only when told which:
    // say so here, because the sheet that says "no journey yet" cannot.
    const journey = kind === 'step' && element.parentId === undefined
    return {
      command: transaction([{ type: 'element.create', element }], { origin: 'agent' }),
      answer: json({
        id, name, kind, drawn: false,
        reason: diagram ? `a ${kind} is not drawn on a ${diagram.kind} view` : `a ${kind} is a record and is drawn nowhere`,
        ...(journey ? { hint: `a root step is a journey; name it as a sheet's journeyId with diagram.update, and add its phases as steps under it` } : {}),
      }),
    }
  }
  const seeded = seedPlacement(model, diagram, id, element, args)
  if ('ok' in seeded) return seeded
  const { placement, layout } = seeded
  return {
    command: transaction([
      { type: 'element.create', element },
      placeOn(diagram.id, [placement]),
      ...(layout ? [layout] : []),
    ], { origin: 'agent' }),
    answer: json({ id, name, kind, diagramId: diagram.id, x: placement.x, y: placement.y, zone: placement.zone, domainGroup: placement.group }),
  }
}

/**
 * The words a replacement started by an agent carries. English, like the
 * tool vocabulary: the agent is a client of the protocol, and what it writes
 * into a plan is content it can rewrite the next moment.
 */
const REPLACE_WORDS = {
  tapLabel: 'shadow tap',
  shadowMilestone: 'Shadow run starts',
  cutoverMilestone: 'Cutover',
}

function planBody(): string {
  return ['## Goal', '', '## Scope', '', '## Approach and phases', '', '## Business case', '', businessCaseTemplate(), '', '## Risks', '', '## Rollback', ''].join('\n')
}

function replace(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const elementId = args.elementId as string
  const subject = model.elements[elementId]
  if (!subject) return refused('agent.unknownId', `element ${elementId}`)
  const newName = typeof args.newName === 'string' ? args.newName.trim() : ''
  const existingId = args.existingId as string | undefined
  if (!newName && !existingId) return refused('agent.badArguments', 'give newName or existingId')
  if (newName && existingId) return refused('agent.badArguments', 'give newName or existingId, not both')
  if (existingId !== undefined) {
    if (!model.elements[existingId]) return refused('agent.unknownId', `element ${existingId}`)
    if (existingId === elementId) return refused('agent.badArguments', 'an element cannot replace itself')
  }
  const also = (args.alsoRetiring as string[] | undefined) ?? []
  for (const id of also) if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
  const shadowFrom = args.shadowFrom as string
  const cutover = args.cutover as string
  if (!isDay(shadowFrom) || !isDay(cutover)) return refused('agent.badArguments', 'shadowFrom and cutover must be yyyy-mm-dd')
  if (cutover < shadowFrom) return refused('agent.badArguments', 'cutover must not be before shadowFrom')

  const toName = existingId !== undefined ? model.elements[existingId].name : newName
  const { commands, planId, toId } = replacementCommands(view.current(), {
    from: [
      { elementId, role: args.stays === true ? 'changes' : 'retires' },
      ...also.map((id) => ({ elementId: id, role: 'retires' as const })),
    ],
    to: existingId !== undefined ? { elementId: existingId } : { name: newName },
    shadowFrom,
    cutover,
    words: {
      ...REPLACE_WORDS,
      planTitle: `Replace ${subject.name} with ${toName}`,
      body: planBody(),
      ...(subject.owner ? { owner: subject.owner } : {}),
    },
  }, {
    element: (name) => view.ids.element(name),
    connection: () => view.ids.connection(),
    transition: view.makeId('tr'),
  }, nextTransitionNumber(transitionList(model)))
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ planId, toId, shadowFrom, cutover }),
  }
}

function port(args: Args, view: WriteView): Prepared | AgentAnswer {
  const planId = args.planId as string
  const plan = planOf(planId, view)
  if (!plan) return refused('agent.unknownId', `plan ${planId}`)
  const on = args.on as string
  if (!isDay(on)) return refused('agent.badArguments', 'on must be yyyy-mm-dd')
  const targets = plan.elements.filter((one) => one.role === 'introduces').map((one) => one.elementId)
  const toId = (args.toId as string | undefined) ?? (targets.length === 1 ? targets[0] : undefined)
  if (toId === undefined) return refused('agent.badArguments', 'the plan introduces several elements: say which with toId')
  if (!targets.includes(toId)) return refused('agent.badArguments', `${toId} is not something this plan introduces`)

  const ports = portsOf(view.current(), plan)
  const connectionId = args.connectionId as string | undefined
  // A line another plan closed is not this plan's to date: "every interface
  // not yet planned" leaves it alone and says so, and naming it is refused.
  const chosen = connectionId === undefined
    ? unplannedPorts(ports)
    : ports.filter((one) => one.from.id === connectionId)
  if (connectionId !== undefined && chosen.length === 0) return refused('agent.unknownId', `interface ${connectionId} of plan ${planId}`)
  if (connectionId !== undefined && chosen[0].closedOn !== undefined) {
    return refused('agent.planned', `${connectionId} is closed on ${chosen[0].closedOn}`)
  }
  const skipped = connectionId === undefined
    ? ports.filter((one) => one.closedOn !== undefined).map((one) => ({ connectionId: one.from.id, closedOn: one.closedOn }))
    : []
  if (chosen.length === 0) {
    return refused('agent.badArguments', skipped.length
      ? `every interface of this plan is planned already; ${skipped.length} closed by another plan or by hand`
      : 'every interface of this plan is planned already')
  }
  const commands = chosen.flatMap((one) => portCommands(one, toId, on, () => view.ids.connection()))
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      planId: plan.id, toId, on, moved: chosen.map((one) => one.from.id),
      ...(skipped.length ? { skipped, note: 'Skipped lines were closed by another plan or by hand; plan.unport them there first.' } : {}),
    }),
  }
}

function unport(args: Args, view: WriteView): Prepared | AgentAnswer {
  const plan = planOf(args.planId, view)
  if (!plan) return refused('agent.unknownId', `plan ${String(args.planId)}`)
  const connectionId = args.connectionId as string
  const port = portsOf(view.current(), plan).find((one) => one.from.id === connectionId)
  if (!port) return refused('agent.unknownId', `interface ${connectionId} of plan ${transitionLabel(plan)}`)
  if (port.closedOn !== undefined) return refused('agent.planned', `${connectionId} is closed on ${port.closedOn}`)
  if (port.on === undefined) return refused('agent.badArguments', `${connectionId} has not been ported`)
  return {
    command: transaction(unportCommands(port), { origin: 'agent' }),
    answer: json({ planId: plan.id, connectionId, unported: true, ...(port.to ? { twinRemoved: port.to.id } : {}) }),
  }
}

// --- an element's fields ----------------------------------------------------------------

const DATE_FIELDS = { liveOn: 'live', retiringOn: 'retiring', retiredOn: 'retired' } as const

/**
 * The patch an element.update or element.add asks for. Null clears an
 * optional field; the reducer refuses dates out of order, so they are not
 * checked here beyond being days. The three date arguments are one field on
 * the element, merged with what it has, and gone altogether when nothing is
 * left — a saved file should look hand-written.
 */
function elementPatch(args: Args, held: DesignElement, view: ReadView): Partial<DesignElement> | AgentAnswer {
  const patch: Record<string, unknown> = {}
  if (typeof args.name === 'string') {
    if (!args.name.trim()) return refused('agent.badArguments', '"name" must not be blank')
    patch.name = args.name.trim()
  }
  for (const key of ['description', 'category', 'vendor', 'technology', 'owner'] as const) {
    if (args[key] === null || args[key] === '') patch[key] = undefined
    else if (typeof args[key] === 'string') patch[key] = args[key]
  }
  if (args.platformArchetype === null || args.platformArchetype === '') patch.platformArchetype = undefined
  else if (typeof args.platformArchetype === 'string') {
    if (held.kind !== 'platform') return refused('agent.badArguments', 'only a platform has a platformArchetype')
    if (!isPlatformArchetype(args.platformArchetype)) return refused('agent.badArguments', '"platformArchetype" is not place, service or network')
    patch.platformArchetype = args.platformArchetype
  }
  if (args.shared !== undefined) {
    if (held.kind !== 'platformService') return refused('agent.badArguments', 'only a platformService is shared')
    patch.shared = args.shared === true ? true : undefined
  }
  if (typeof args.lifecycle === 'string') patch.lifecycle = args.lifecycle
  if (typeof args.isManaged === 'boolean') patch.isManaged = args.isManaged
  if (args.successorId === null || args.successorId === '') patch.successorId = undefined
  else if (typeof args.successorId === 'string') {
    if (!view.model.elements[args.successorId]) return refused('agent.unknownId', `element ${args.successorId}`)
    if (args.successorId === held.id) return refused('agent.badArguments', 'an element cannot succeed itself')
    patch.successorId = args.successorId
  }

  if (Object.keys(DATE_FIELDS).some((key) => args[key] !== undefined)) {
    const dates: Record<string, string> = { ...held.lifecycleDates }
    for (const [key, phase] of Object.entries(DATE_FIELDS)) {
      const value = args[key]
      if (value === undefined) continue
      if (value === null || value === '') delete dates[phase]
      else if (isDay(value)) dates[phase] = value
      else return refused('agent.badArguments', `${key} must be yyyy-mm-dd`)
    }
    patch.lifecycleDates = Object.keys(dates).length ? dates : undefined
  }

  if (args.aspects !== undefined && args.aspects !== null) {
    const aspects = { ...held.aspects }
    for (const [key, status] of Object.entries(args.aspects as Record<string, string | null>)) {
      if (status === null) delete aspects[key]
      else aspects[key] = { ...aspects[key], status: status as AspectStatus }
    }
    patch.aspects = aspects
  }
  if (args.accentColor !== undefined) {
    const color = args.accentColor === null ? '' : hexColour(args.accentColor)
    if (color === false) return refused('agent.badArguments', '"accentColor" must be a hex colour like #2e86c1')
    patch.accentColor = color === '' ? undefined : color
  }
  if (args.iconKey !== undefined) {
    patch.iconKey = args.iconKey === null || args.iconKey === '' ? undefined : args.iconKey
  }

  // The tree, and the fact of ownership (ADR-0012 §3, §4). These were in the
  // schema before they were read here, which is how an agent came to set
  // `outside` thirty times and be answered `changed: []` each time.
  if (args.outside !== undefined) patch.outside = args.outside === true ? true : undefined
  if (args.partyId === null || args.partyId === '') patch.partyId = undefined
  else if (typeof args.partyId === 'string') {
    const party = view.model.elements[args.partyId]
    if (!party) return refused('agent.unknownId', `element ${args.partyId}`)
    if (party.kind !== 'actor') return refused('agent.badArguments', '"partyId" must name an actor')
    patch.partyId = args.partyId
  }
  if (args.order === null) patch.order = undefined
  else if (typeof args.order === 'number') patch.order = args.order
  if (args.lane === null || args.lane === '') patch.lane = undefined
  else if (typeof args.lane === 'string') {
    if (held.kind !== 'step') return refused('agent.badArguments', 'only a step has a lane')
    const actor = view.model.elements[args.lane]
    if (!actor) return refused('agent.unknownId', `element ${args.lane}`)
    if (actor.kind !== 'actor') return refused('agent.badArguments', '"lane" must name an actor')
    patch.lane = args.lane
  }
  if (args.parentId === null || args.parentId === '') patch.parentId = undefined
  else if (typeof args.parentId === 'string') {
    if (!view.model.elements[args.parentId]) return refused('agent.unknownId', `element ${args.parentId}`)
    // A loop is offered and refused rather than hidden, as the sheet's own
    // inspector does — a tree with a cycle in it is a page that never ends.
    if (wouldCycle(toArrays(view.model).elements, held.id, args.parentId)) {
      return refused('agent.badArguments', `"parentId" ${args.parentId} would make a loop`)
    }
    patch.parentId = args.parentId
  }
  return patch as Partial<DesignElement>
}

// --- plans as records (ADR-0009) -------------------------------------------------------

function planOf(idOrLabel: unknown, view: ReadView): Transition | undefined {
  return typeof idOrLabel === 'string' ? findTransition(transitionList(view.model), idOrLabel) : undefined
}

/**
 * The element lists a plan names, as given. Each role given replaces that
 * role's list whole; a role not given keeps what the plan had. An element may
 * hold one role only — a thing a plan both introduces and retires is two
 * plans, or a mistake — and every id has to exist.
 */
function planElements(args: Args, held: readonly TransitionElement[], view: ReadView): TransitionElement[] | AgentAnswer {
  const roles = ['introduces', 'retires', 'changes'] as const
  const out: TransitionElement[] = []
  const seen = new Map<ElementId, TransitionRole>()
  for (const role of roles) {
    const given = args[role] as string[] | undefined | null
    const ids = given ?? held.filter((one) => one.role === role).map((one) => one.elementId)
    for (const elementId of ids) {
      if (!view.model.elements[elementId]) return refused('agent.unknownId', `element ${elementId}`)
      const already = seen.get(elementId)
      if (already !== undefined && already !== role) {
        return refused('agent.badArguments', `${elementId} cannot be both ${already} and ${role}`)
      }
      if (already !== undefined) continue
      seen.set(elementId, role)
      out.push({ elementId, role })
    }
  }
  return out
}

function planDecisions(args: Args, view: ReadView): string[] | AgentAnswer | undefined {
  const ids = args.decisionIds as string[] | undefined | null
  if (ids === undefined || ids === null) return undefined
  const own = decisionsOf(view.model)
  for (const id of ids) {
    if (!own[id] && !view.ancestorDecisions.some((adr) => adr.id === id)) return refused('agent.unknownId', `decision ${id}`)
  }
  return [...new Set(ids)]
}

/** The window as given: a day, or null to clear; anything else is refused. */
function planDays(args: Args): { from?: string | null; to?: string | null } | AgentAnswer {
  const out: { from?: string | null; to?: string | null } = {}
  for (const key of ['from', 'to'] as const) {
    const value = args[key]
    if (value === undefined) continue
    if (value === null) { out[key] = null; continue }
    if (!isDay(value)) return refused('agent.badArguments', `${key} must be yyyy-mm-dd`)
    out[key] = value
  }
  return out
}

function createPlan(args: Args, view: WriteView): Prepared | AgentAnswer {
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  const elements = planElements(args, [], view)
  if ('ok' in elements) return elements
  const decisions = planDecisions(args, view)
  if (decisions !== undefined && 'ok' in decisions) return decisions
  const days = planDays(args)
  if ('ok' in days) return days
  if (days.from && days.to && days.to < days.from) return refused('agent.badArguments', 'to must not be before from')

  const plan: Transition = {
    id: view.makeId('tr'),
    number: nextTransitionNumber(transitionList(view.model)),
    title,
    status: (args.status as TransitionStatus | undefined) ?? 'draft',
    ...(days.from ? { from: days.from } : {}),
    ...(days.to ? { to: days.to } : {}),
    ...(typeof args.owner === 'string' && args.owner.trim() ? { owner: args.owner.trim() } : {}),
    ...(args.initiative === true ? { initiative: true as const } : {}),
    elements,
    decisions: decisions ?? [],
    milestones: [],
    body: typeof args.body === 'string' && args.body.trim() ? args.body : planBody(),
  }
  return {
    command: { type: 'transition.add', transition: plan, origin: 'agent' },
    answer: json(planEntry(plan, toArrays(view.model))),
  }
}

function updatePlan(args: Args, view: WriteView): Prepared | AgentAnswer {
  const held = planOf(args.id, view)
  if (!held) return refused('agent.unknownId', `plan ${String(args.id)}`)
  const patch: Partial<Transition> = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title.trim()
  }
  if (typeof args.status === 'string' && args.status !== held.status) {
    const allowed = planTransitionsFrom(held.status)
    if (!allowed.includes(args.status as TransitionStatus)) {
      return refused('agent.badArguments', `${held.status} can only move to ${allowed.join(', ')}`)
    }
    patch.status = args.status as TransitionStatus
  }
  const days = planDays(args)
  if ('ok' in days) return days
  const from = days.from === undefined ? held.from : days.from ?? undefined
  const to = days.to === undefined ? held.to : days.to ?? undefined
  if (from && to && to < from) return refused('agent.badArguments', 'to must not be before from')
  if (days.from !== undefined) patch.from = days.from ?? undefined
  if (days.to !== undefined) patch.to = days.to ?? undefined
  if (args.owner === null) patch.owner = undefined
  else if (typeof args.owner === 'string') patch.owner = args.owner.trim() || undefined
  if (typeof args.body === 'string') patch.body = args.body
  if (typeof args.initiative === 'boolean') patch.initiative = args.initiative ? true : undefined
  if (['introduces', 'retires', 'changes'].some((role) => Array.isArray(args[role]))) {
    const elements = planElements(args, held.elements, view)
    if ('ok' in elements) return elements
    patch.elements = elements
  }
  const decisions = planDecisions(args, view)
  if (decisions !== undefined) {
    if ('ok' in decisions) return decisions
    patch.decisions = decisions
  }
  const next = { ...held, ...patch }
  for (const key of Object.keys(patch) as (keyof Transition)[]) if (next[key] === undefined) delete next[key]
  return {
    command: { type: 'transition.update', id: held.id, patch, origin: 'agent' },
    answer: json({ changed: Object.keys(patch), ...planEntry(next, toArrays(view.model)) }),
  }
}

/** A milestone is found by its name: a plan has a handful, and the name is what the roadmap shows. */
function milestone(
  tool: 'milestone.add' | 'milestone.update' | 'milestone.remove', args: Args, view: WriteView,
): Prepared | AgentAnswer {
  const plan = planOf(args.planId, view)
  if (!plan) return refused('agent.unknownId', `plan ${String(args.planId)}`)
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  const at = plan.milestones.findIndex((one) => one.name === name)
  let milestones: TransitionMilestone[]
  if (tool === 'milestone.add') {
    if (!isDay(args.date)) return refused('agent.badArguments', 'date must be yyyy-mm-dd')
    if (at >= 0) return refused('agent.badArguments', `plan ${transitionLabel(plan)} already has a milestone called ${name}`)
    milestones = [...plan.milestones, { date: args.date, name }].sort((a, b) => a.date.localeCompare(b.date))
  } else {
    if (at < 0) return refused('agent.unknownId', `milestone ${name} of plan ${transitionLabel(plan)}`)
    if (tool === 'milestone.remove') {
      milestones = plan.milestones.filter((_one, index) => index !== at)
    } else {
      const held = plan.milestones[at]
      if (args.date !== undefined && args.date !== null && !isDay(args.date)) return refused('agent.badArguments', 'date must be yyyy-mm-dd')
      const newName = typeof args.newName === 'string' ? args.newName.trim() : ''
      if (newName && newName !== name && plan.milestones.some((one) => one.name === newName)) {
        return refused('agent.badArguments', `plan ${transitionLabel(plan)} already has a milestone called ${newName}`)
      }
      const moved: TransitionMilestone = { date: isDay(args.date) ? args.date : held.date, name: newName || held.name }
      milestones = plan.milestones.map((one, index) => (index === at ? moved : one))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
  }
  return {
    command: { type: 'transition.update', id: plan.id, patch: { milestones }, origin: 'agent' },
    answer: json({ planId: plan.id, label: transitionLabel(plan), milestones }),
  }
}

// --- where a card goes ---------------------------------------------------------------------

type Seeded = { placement: PlacedNode; layout?: Command }

/**
 * Where a new card lands: what was asked for, else the same cascade the
 * palette uses — and inside its group's box when a group is named, because a
 * card filed under a group and drawn outside its box is a card the next drag
 * re-files. A group that has no box yet gets one around the card.
 */
function seedPlacement(
  model: Model, diagram: Diagram, elementId: ElementId,
  element: Pick<DesignElement, 'kind' | 'outside'>, args: Args,
): Seeded | AgentAnswer {
  const asked = typeof args.x === 'number' && typeof args.y === 'number'
    ? { x: args.x, y: args.y } : undefined
  if (diagram.kind !== 'layer7') {
    if (args.zone !== undefined || typeof args.domainGroup === 'string') {
      return refused('agent.badArguments', 'bands and domain groups are a landscape\'s')
    }
    return {
      placement: {
        id: elementId,
        ...(asked ?? defaultContainerPosition(nodeFigure(element), diagram.order.members.length)),
      },
    }
  }
  const zone = (args.zone as Layer7Zone | undefined) ?? HOME_ZONE[nodeFigure(element)]
  const figure = nodeFigure(element, zone)
  const name = typeof args.domainGroup === 'string' && args.domainGroup.trim() ? args.domainGroup.trim() : undefined
  if (name !== undefined && zone !== 'landscape') return refused('agent.badArguments', `${name} is a domain group; only landscape cards are grouped`)
  // A name nobody has used yet makes the group, which is what a card filed
  // under a group the board does not have yet has always meant here.
  const held = name === undefined ? undefined : groupNamed(diagram, name)
  const groupId = name === undefined ? undefined : held?.id ?? newGroupId(diagram, name)
  const made: Command[] = held || name === undefined
    ? []
    : [{ type: 'group.set', diagramId: diagram.id, groups: [{ id: groupId!, name }] }]
  const box = groupId === undefined ? undefined : groupBox(diagram, groupId)
  const position = asked
    ?? (box ? freeSlotIn(box, figure, membersOf(model, diagram, groupId!).map(([, rect]) => rect))
      : defaultZonePosition(zone, figure, diagram.order.members.filter((id) => (placedOn(diagram, id)!.zone ?? 'landscape') === zone).length, diagram))
  const placement: PlacedNode = { id: elementId, zone, ...position, ...(groupId !== undefined ? { group: groupId } : {}) }
  const kept = zone === 'landscape' ? placement : clampPlacementIntoZone(placement, figure, diagram) ?? placement
  const grown = groupId === undefined ? undefined : growGroup(diagram, groupId, placementRect(figure, kept))
  return { placement: kept, layout: transaction([...made, ...(grown ? [grown] : [])]) }
}

/** What a group is CALLED, for an answer a person reads. */
function groupNameOn(diagram: Diagram, groupId: string | undefined): string | undefined {
  if (groupId === undefined) return undefined
  return groupList(diagram).find((group) => group.id === groupId)?.name ?? groupId
}

/**
 * A card filed in a side band, kept inside it. The clamp slides it to the
 * band's edge, which is on top of whatever was already at that edge — the
 * anchor, usually — so a clamped card that would land on another one takes a
 * free slot in the band instead. A landscape card is not touched.
 */
function keptInBand(
  model: Model, diagram: Diagram,
  element: Pick<DesignElement, 'kind' | 'outside'>, placement: PlacedNode,
): PlacedNode {
  if ((placement.zone ?? 'landscape') === 'landscape') return placement
  const figure = nodeFigure(element, placement.zone)
  const clamped = clampPlacementIntoZone(placement, figure, diagram)
  if (!clamped) return placement
  const others = diagram.order.members
    .filter((id) => id !== placement.id && model.elements[id] && (placedOn(diagram, id)!.zone ?? 'landscape') === placement.zone)
    .map((id) => placementRect(nodeFigure(model.elements[id], placedOn(diagram, id)!.zone), placedOn(diagram, id)!))
  const mine = placementRect(figure, clamped)
  if (!others.some((rect) => rectsIntersect(mine, rect))) return clamped
  return { ...clamped, ...freeZonePosition(placement.zone!, figure, others, diagram) }
}

function groupBox(diagram: Diagram, groupId: string): DomainGroupRect | undefined {
  return boxesOf(diagram)[groupId]
}

/**
 * The group on this diagram a person means by that name.
 *
 * A group has an id of its own (ADR-0012 §6) and the tools speak names, because
 * a name is what an agent has read off the board. This is where the two meet;
 * it is the only place in the module that matches on a name.
 */
function groupNamed(diagram: Diagram, name: string): DiagramGroup | undefined {
  return groupList(diagram).find((group) => group.name === name)
}

/** The drawn members of a group, with their rectangles. */
function membersOf(model: Model, diagram: Diagram, groupId: string): [ElementId, Rect][] {
  return diagram.order.members
    .filter((id) => placedOn(diagram, id)!.group === groupId && model.elements[id])
    .map((id) => [id, placementRect(nodeFigure(model.elements[id], placedOn(diagram, id)!.zone), placedOn(diagram, id)!)])
}

/**
 * The layout command that makes a group's box hold this rectangle: grown to
 * the union when it has one, drawn around the card when it has none, and
 * nothing when the card is inside already. A box is never moved or shrunk.
 */
function growGroup(diagram: Diagram, groupId: string, rect: Rect): Command | undefined {
  const existing = boxesOf(diagram)[groupId]
  const box = existing ? unionRects([existing, rect])! : groupRectAround([rect])!
  if (existing && box.x === existing.x && box.y === existing.y && box.width === existing.width && box.height === existing.height) return undefined
  const grown: DomainGroupRect = { id: groupId, x: box.x, y: box.y, width: box.width, height: box.height }
  return { type: 'box.set', diagramId: diagram.id, boxes: [grown] }
}

/** A new group's id on this diagram, minted from its name the way the editor mints one. */
function newGroupId(diagram: Diagram, name: string): string {
  return claimKey(name, new Set(diagram.order.groups))
}

function placeElement(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const id = args.id as string
  const element = model.elements[id]
  if (!element) return refused('agent.unknownId', `element ${id}`)
  const held = placedOn(diagram, id)!
  if (!held) return refused('agent.notDrawn', id)
  const zone = args.zone as Layer7Zone | undefined
  const group = args.domainGroup as string | null | undefined
  if (diagram.kind !== 'layer7' && (zone !== undefined || group !== undefined)) {
    return refused('agent.badArguments', 'bands and domain groups are a landscape\'s')
  }
  const asked = typeof args.x === 'number' && typeof args.y === 'number' ? { x: args.x, y: args.y } : undefined
  if (asked === undefined && (typeof args.x === 'number' || typeof args.y === 'number')) {
    return refused('agent.badArguments', 'give x and y together')
  }

  let next: PlacedNode = { ...held, ...(asked ?? {}) }
  if (diagram.kind === 'layer7') {
    if (zone !== undefined) {
      next.zone = zone
      if (zone !== 'landscape') delete next.group
    } else if (asked) {
      // A spot in another band than the card is filed in is a contradiction
      // the report would flag straight away; the band has to be said.
      const filed = held.zone ?? 'landscape'
      const actually = zoneForPoint(rectCenter(placementRect(nodeFigure(element, next.zone), next)), diagram)
      if (actually !== filed) return refused('agent.badArguments', `(${asked.x}, ${asked.y}) is in the ${actually} band; say zone: ${actually} to move it there`)
    }
    if (group === null) delete next.group
    else if (typeof group === 'string') {
      const name = group.trim()
      if ((next.zone ?? 'landscape') !== 'landscape') return refused('agent.badArguments', `${id} is in the ${next.zone} band; only landscape cards can be grouped`)
      const held = groupNamed(diagram, name)
      const box = held && groupBox(diagram, held.id)
      if (!held || !box) return refused('agent.unknownId', `domain group ${name}; make one with group`)
      if (!asked) {
        const others = membersOf(model, diagram, held.id).filter(([member]) => member !== id).map(([, rect]) => rect)
        next = { ...next, ...freeSlotIn(box, nodeFigure(element, next.zone), others) }
      }
      next.group = held.id
    }
    next = keptInBand(model, diagram, element, next)
  }

  const commands: Command[] = [placeOn(diagram.id, [next])]
  const layout = next.group === undefined ? undefined : growGroup(diagram, next.group, placementRect(nodeFigure(element, next.zone), next))
  if (layout) commands.push(layout)
  const clamped = asked !== undefined && (next.x !== asked.x || next.y !== asked.y)
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, elementId: id, x: next.x, y: next.y, zone: next.zone,
      domainGroup: groupNameOn(diagram, next.group),
      ...(clamped ? { clamped: true, note: 'Moved to stay inside its band.' } : {}),
    }),
  }
}

function drawElement(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const id = args.id as string
  const element = model.elements[id]
  if (!element) return refused('agent.unknownId', `element ${id}`)
  if (placedOn(diagram, id)) return refused('agent.badArguments', `${id} is drawn on ${diagram.id} already; element.place moves it`)
  if (!canPlaceKind(element.kind, diagram.kind).ok) {
    return refused('agent.badArguments', `a ${element.kind} is not drawn on a ${diagram.kind} view`)
  }
  const seeded = seedPlacement(model, diagram, id, element, args)
  if ('ok' in seeded) return seeded
  const { placement, layout } = seeded
  return {
    command: transaction([
      placeOn(diagram.id, [placement]),
      ...(layout ? [layout] : []),
    ], { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, elementId: id, x: placement.x, y: placement.y, zone: placement.zone,
      domainGroup: groupNameOn(diagram, placement.group),
    }),
  }
}

function ungroup(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  if (diagram.kind !== 'layer7') return refused('agent.badArguments', 'domain groups are drawn on a landscape')
  const name = (args.name as string).trim()
  const held = groupNamed(diagram, name)
  if (!held) return refused('agent.unknownId', `domain group ${name}`)
  const box = groupBox(diagram, held.id)
  const members = membersOf(model, diagram, held.id).map(([id]) => id)
  const named = args.elementIds as string[] | undefined
  const leaving = named ?? members
  for (const id of leaving) {
    if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    if (!placedOn(diagram, id)) return refused('agent.notDrawn', id)
    if (placedOn(diagram, id)!.group !== held.id) return refused('agent.badArguments', `${id} is not in ${name}`)
  }
  const unfiled = leaving.map((id) => {
    const { group: _group, ...rest } = placedOn(diagram, id)!
    void _group
    return rest
  })
  const commands: Command[] = []
  if (unfiled.length) commands.push({ type: 'member.set', diagramId: diagram.id, members: unfiled.map(memberOf) })
  // Dissolving takes the group's record, and `group.remove` takes its box: a
  // group nothing is in and nothing draws is not a group.
  if (named === undefined) {
    commands.push({ type: 'group.remove', diagramId: diagram.id, groupIds: [held.id] })
  }
  void box
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ diagramId: diagram.id, name, dissolved: named === undefined, unfiled: leaving }),
  }
}

/**
 * Observations and causes (ADR-0021): every verb is a rule over the two lists,
 * and the change is the difference between the lists before and after, said as
 * one transaction — one undo step, one Activity line, the way the page commits.
 */
function observationCommand(tool: ToolName, args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const before: Analysis = { observations: observationList(model), causes: causeList(model) }
  const observationOf = (idOrLabel: unknown) => findObservation(before.observations, String(idOrLabel))
  const causeOf = (idOrLabel: unknown) => findCause(before.causes, String(idOrLabel))
  const linkOf = (id: unknown, scope: unknown, strength: unknown): CauseLink | AgentAnswer => {
    const held = strength === undefined ? 'normal' : strength as CauseStrength
    if (typeof scope === 'string') {
      const shared = (view.tree?.observationsBelow?.(view.scopePath) ?? [])
        .find((one) => one.scope === scope && one.observation.id === id)
      if (!shared) return refused('agent.unknownId', `shared observation ${String(id)} in ${scope}`)
      return { id: shared.observation.id, scope, strength: held }
    }
    const target = observationOf(id) ?? causeOf(id)
    if (!target) return refused('agent.unknownId', `observation or cause ${String(id)}`)
    return { id: target.id, strength: held }
  }
  const finish = (after: Analysis, answer: unknown): Prepared | AgentAnswer => {
    const commands = [...observationsToCommands(model, after.observations), ...causesToCommands(model, after.causes)]
    if (commands.length === 0) return refused('agent.badArguments', 'nothing changed')
    return { command: transaction(commands, { origin: 'agent' }), answer: json(answer) }
  }
  const observationAnswer = (after: Analysis, id: string) => (
    observationLine(after.observations.find((one) => one.id === id)!, after.causes, after.observations)
  )
  const causeAnswer = (after: Analysis, id: string) => (
    causeLine(after.causes.find((one) => one.id === id)!, after.causes, fromArrays({ ...toArrays(model), observations: after.observations, causes: after.causes }))
  )

  switch (tool) {
    case 'observation.record': {
      const title = (args.title as string).trim()
      if (!title) return refused('agent.badArguments', '"title" must not be blank')
      const date = typeof args.date === 'string' ? args.date : view.today()
      if (!isDay(date)) return refused('agent.badArguments', `date ${date} is not yyyy-mm-dd`)
      const fresh = newObservation({
        id: view.makeId('ob'), number: nextObservationNumber(before.observations), title, date, t: view.translate,
        ...(typeof args.where === 'string' ? { where: args.where } : {}),
        ...(typeof args.by === 'string' ? { by: args.by } : {}),
        ...(typeof args.impact === 'string' ? { impact: args.impact as ObservationImpact } : {}),
        ...(args.shared === true ? { shared: true } : {}),
        ...(typeof args.body === 'string' ? { body: args.body } : {}),
      })
      const after = { ...before, observations: [...before.observations, fresh] }
      return finish(after, observationAnswer(after, fresh.id))
    }
    case 'observation.update': {
      const held = observationOf(args.id)
      if (!held) return refused('agent.unknownId', `observation ${String(args.id)}`)
      const patch: ObservationPatch = {}
      if (typeof args.title === 'string') {
        if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
        patch.title = args.title
      }
      if (typeof args.body === 'string') patch.body = args.body
      if (typeof args.where === 'string') patch.where = args.where
      if (typeof args.by === 'string') patch.by = args.by
      if (typeof args.impact === 'string') patch.impact = args.impact as ObservationImpact
      if (typeof args.date === 'string') {
        if (!isDay(args.date)) return refused('agent.badArguments', `date ${args.date} is not yyyy-mm-dd`)
        patch.date = args.date
      }
      let observations = updateObservation(before.observations, held.id, patch)
      if (typeof args.shared === 'boolean') observations = setShared(observations, held.id, args.shared, view.today())
      const after = { ...before, observations }
      return finish(after, observationAnswer(after, held.id))
    }
    case 'observation.seen': {
      const held = observationOf(args.id)
      if (!held) return refused('agent.unknownId', `observation ${String(args.id)}`)
      const after = { ...before, observations: seenAgain(before.observations, held.id, view.today(), args.note as string | undefined) }
      return finish(after, observationAnswer(after, held.id))
    }
    case 'observation.archive': {
      const held = observationOf(args.id)
      if (!held) return refused('agent.unknownId', `observation ${String(args.id)}`)
      const restore = args.restore === true
      const observations = setArchived(before.observations, held.id, !restore, view.today(), args.note as string | undefined)
      if (observations[before.observations.indexOf(held)] === held) {
        return refused('agent.badArguments', `${held.id} is ${restore ? 'not archived' : 'archived already'}`)
      }
      const after = { ...before, observations }
      return finish(after, observationAnswer(after, held.id))
    }
    case 'observation.merge': {
      const into = observationOf(args.into)
      if (!into) return refused('agent.unknownId', `observation ${String(args.into)}`)
      if (typeof args.fromScope === 'string') {
        const shared = (view.tree?.observationsBelow?.(view.scopePath) ?? [])
          .find((one) => one.scope === args.fromScope && one.observation.id === args.id)
        if (!shared) return refused('agent.unknownId', `shared observation ${String(args.id)} in ${args.fromScope}`)
        const after = absorbShared(before, shared, into.id, view.today())
        if (after === before) return refused('agent.badArguments', `${String(args.id)} cannot be merged into ${into.id}`)
        return finish(after, observationAnswer(after, into.id))
      }
      const from = observationOf(args.id)
      if (!from) return refused('agent.unknownId', `observation ${String(args.id)}`)
      const after = mergeObservations(before, from.id, into.id, view.today())
      if (after === before) return refused('agent.badArguments', `${from.id} cannot be merged into ${into.id}`)
      return finish(after, observationAnswer(after, into.id))
    }
    case 'observation.remove': {
      const held = observationOf(args.id)
      if (!held) return refused('agent.unknownId', `observation ${String(args.id)}`)
      return finish(removeObservation(before, held.id), { id: held.id, label: formatObservationNumber(held.number), title: held.title, removed: true })
    }
    case 'cause.add': {
      const title = (args.title as string).trim()
      if (!title) return refused('agent.badArguments', '"title" must not be blank')
      const fresh = newCause({
        id: view.makeId('ca'), number: nextCauseNumber(before.causes), title, t: view.translate,
        ...(typeof args.body === 'string' ? { body: args.body } : {}),
      })
      if (typeof args.state === 'string') fresh.state = args.state as CauseState
      let causes = [...before.causes, fresh]
      for (const row of (args.explains as { id: string; scope?: string; strength?: string }[] | undefined) ?? []) {
        const link = linkOf(row.id, row.scope, row.strength)
        if ('ok' in link) return link
        causes = linkCause(causes, fresh.id, link)
      }
      const after = { ...before, causes }
      return finish(after, causeAnswer(after, fresh.id))
    }
    case 'cause.update': {
      const held = causeOf(args.id)
      if (!held) return refused('agent.unknownId', `cause ${String(args.id)}`)
      const patch: CausePatch = {}
      if (typeof args.title === 'string') {
        if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
        patch.title = args.title
      }
      if (typeof args.body === 'string') patch.body = args.body
      if (typeof args.state === 'string') patch.state = args.state as CauseState
      const after = { ...before, causes: updateCause(before.causes, held.id, patch) }
      return finish(after, causeAnswer(after, held.id))
    }
    case 'cause.link': {
      const held = causeOf(args.id)
      if (!held) return refused('agent.unknownId', `cause ${String(args.id)}`)
      const link = linkOf(args.explains, args.scope, args.strength)
      if ('ok' in link) return link
      const causes = linkCause(before.causes, held.id, link)
      if (JSON.stringify(causes) === JSON.stringify(before.causes)) {
        return refused('agent.badArguments', `${held.id} cannot explain ${link.id}: a cause does not explain itself, and a loop is not an explanation`)
      }
      const after = { ...before, causes }
      return finish(after, causeAnswer(after, held.id))
    }
    case 'cause.unlink': {
      const held = causeOf(args.id)
      if (!held) return refused('agent.unknownId', `cause ${String(args.id)}`)
      const target: { id: string; scope?: string } = typeof args.scope === 'string'
        ? { id: String(args.explains), scope: args.scope }
        : { id: (observationOf(args.explains) ?? causeOf(args.explains))?.id ?? String(args.explains) }
      const after = { ...before, causes: unlinkCause(before.causes, held.id, target.id, target.scope) }
      return finish(after, causeAnswer(after, held.id))
    }
    case 'cause.remove': {
      const held = causeOf(args.id)
      if (!held) return refused('agent.unknownId', `cause ${String(args.id)}`)
      // Nothing may go on addressing a cause that is gone (ADR-0026): the
      // solutions lose the link in the same step.
      const after = removeCause(before, held.id)
      const commands = [
        ...causesToCommands(model, after.causes), ...solutionsToCommands(model, forgetCause(solutionList(model), held.id)),
      ]
      return {
        command: transaction(commands, { origin: 'agent' }),
        answer: json({ id: held.id, label: formatCauseNumber(held.number), title: held.title, removed: true }),
      }
    }
    default:
      return refused('agent.badArguments', `${tool} is not an observation tool`)
  }
}

/**
 * Solutions and experiments (ADR-0026), the way the page does them: every
 * verb a rule over the lists, the change their difference, one transaction.
 * A move the gate refuses is answered with what the gate still needs, so the
 * agent can say what is missing rather than guess.
 */
function solutionCommand(tool: ToolName, args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const before: SolutionWork = { solutions: solutionList(model), experiments: experimentList(model) }
  const causes = causeList(model)
  const solutionOf = (idOrLabel: unknown) => findSolution(before.solutions, String(idOrLabel))
  const experimentOf = (idOrLabel: unknown) => findExperiment(before.experiments, String(idOrLabel))
  /** The change as one transaction, and the answer read off the lists as they will be. */
  const finish = (after: SolutionWork, answer: (facts: ReturnType<typeof solutionFacts>) => unknown, extra: Command[] = []): Prepared | AgentAnswer => {
    const commands = [...extra, ...solutionsToCommands(model, after.solutions), ...experimentsToCommands(model, after.experiments)]
    if (commands.length === 0) return refused('agent.badArguments', 'nothing changed')
    const next = fromArrays({ ...toArrays(model), solutions: after.solutions, experiments: after.experiments })
    return { command: transaction(commands, { origin: 'agent' }), answer: json(answer(solutionFacts({ ...view, model: next }))) }
  }
  const solutionAnswer = (id: string) => (facts: ReturnType<typeof solutionFacts>) => solutionLine(facts.solutions.find((one) => one.id === id)!, facts)
  const experimentAnswer = (after: SolutionWork, id: string) => () => experimentLine(after.experiments.find((one) => one.id === id)!, after.solutions)
  const held = tool.startsWith('solution.') && tool !== 'solution.propose' ? solutionOf(args.id) : undefined
  if (tool.startsWith('solution.') && tool !== 'solution.propose' && !held) return refused('agent.unknownId', `solution ${String(args.id)}`)
  const solution = held!
  const day = view.today()
  const withSolutions = (solutions: typeof before.solutions): SolutionWork => ({ ...before, solutions })

  switch (tool) {
    case 'solution.propose': {
      const title = (args.title as string).trim()
      if (!title) return refused('agent.badArguments', '"title" must not be blank')
      const addresses = []
      for (const row of (args.addresses as { id: string; strength?: CauseStrength }[] | undefined) ?? []) {
        const cause = findCause(causes, row.id)
        if (!cause) return refused('agent.unknownId', `cause ${row.id}`)
        addresses.push({ id: cause.id, strength: row.strength ?? defaultStrength(cause.id, causes) })
      }
      const fresh = newSolution({
        id: view.makeId('so'), number: nextSolutionNumber(before.solutions), title, date: day, t: view.translate, addresses,
        ...(typeof args.body === 'string' ? { body: args.body } : {}),
      })
      return finish(withSolutions([...before.solutions, fresh]), solutionAnswer(fresh.id))
    }
    case 'solution.update': {
      const patch: SolutionPatch = {}
      if (typeof args.title === 'string') {
        if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
        patch.title = args.title
      }
      if (typeof args.body === 'string') patch.body = args.body
      if (typeof args.benefit === 'string') patch.benefit = args.benefit as SolutionSize
      if (typeof args.cost === 'string') patch.cost = args.cost as SolutionSize
      if (Array.isArray(args.validatedWith)) patch.validatedWith = args.validatedWith as string[]
      if (Array.isArray(args.attempts)) patch.attempts = args.attempts as EarlierAttempt[]
      if (typeof args.noneKnown === 'boolean') patch.noneKnown = args.noneKnown
      if (typeof args.whyNow === 'string') patch.whyNow = args.whyNow
      return finish(withSolutions(updateSolution(before.solutions, solution.id, patch)), solutionAnswer(solution.id))
    }
    case 'solution.address': {
      const cause = findCause(causes, String(args.cause))
      if (!cause) return refused('agent.unknownId', `cause ${String(args.cause)}`)
      const strength = (args.strength as CauseStrength | undefined) ?? defaultStrength(cause.id, causes)
      return finish(withSolutions(addressCause(before.solutions, solution.id, { id: cause.id, strength })), solutionAnswer(solution.id))
    }
    case 'solution.unaddress': {
      const cause = findCause(causes, String(args.cause))
      const id = cause?.id ?? String(args.cause)
      if (!solution.addresses.some((address) => address.id === id)) return refused('agent.badArguments', `${solution.id} does not address ${id}`)
      return finish(withSolutions(unaddressCause(before.solutions, solution.id, id)), solutionAnswer(solution.id))
    }
    case 'solution.move': {
      const facts = solutionFacts(view)
      const result = moveSolution(before.solutions, solution.id, args.to as SolutionState, day, facts.context)
      if (!result.ok) {
        const why = result.refusal === 'gate'
          ? `the gate to ${String(args.to)} still needs: ${result.open.join(', ')}`
          : result.refusal === 'decided'
            ? `${solution.id} is adopted and its decision record is accepted; supersede the record before moving it back`
            : `${solution.id} is ${solution.state}; it moves one step at a time, and not while dropped`
        return refused('agent.badArguments', why)
      }
      return finish(withSolutions(result.solutions), solutionAnswer(solution.id))
    }
    case 'solution.waive': {
      const reason = String(args.reason)
      if (!reason.trim() && !solution.waived) return refused('agent.badArguments', '"reason" must not be blank: a waiver is a reason a person gave')
      return finish(withSolutions(waiveExperiment(before.solutions, solution.id, reason, day)), solutionAnswer(solution.id))
    }
    case 'solution.drop': {
      if (solution.state === 'adopted') return refused('agent.badArguments', `${solution.id} is adopted: supersede its decision record, move it back, then drop it`)
      if (solution.state === 'dropped') return refused('agent.badArguments', `${solution.id} is dropped already`)
      if (!String(args.note).trim()) return refused('agent.badArguments', '"note" must not be blank')
      return finish(withSolutions(dropSolution(before.solutions, solution.id, String(args.note), day)), solutionAnswer(solution.id))
    }
    case 'solution.restore': {
      if (solution.state !== 'dropped') return refused('agent.badArguments', `${solution.id} is not dropped`)
      return finish(withSolutions(restoreSolution(before.solutions, solution.id, day)), solutionAnswer(solution.id))
    }
    case 'solution.decide': {
      if (solution.decision) return refused('agent.badArguments', `${solution.id} already rests on ${solution.decision}`)
      const adr = newAdr({ id: view.makeId('adr'), number: nextAdrNumber(decisionList(model)), title: solution.title, date: day, t: view.translate })
      if (typeof args.body === 'string' && args.body.trim()) adr.body = args.body
      else {
        const opening = adr.body.indexOf('\n\n') + 2
        adr.body = `${adr.body.slice(0, opening)}${decisionContext(solution, causes, before.solutions, view.translate)}\n${adr.body.slice(opening)}`
      }
      const after = withSolutions(linkRecord(before.solutions, solution.id, 'decision', adr.id, day))
      return finish(after, (facts) => ({
        ...solutionLine(facts.solutions.find((one) => one.id === solution.id)!, facts),
        proposed: { id: adr.id, label: formatAdrNumber(adr.number), status: adr.status },
      }), [{ type: 'decision.add', decision: adr }])
    }
    case 'solution.plan': {
      if (solution.state !== 'adopted') return refused('agent.badArguments', `${solution.id} is ${solution.state}: a plan builds an adopted solution`)
      if (solution.plan) return refused('agent.badArguments', `${solution.id} is built by ${solution.plan} already`)
      const plan: Transition = {
        id: view.makeId('tr'), number: nextTransitionNumber(transitionList(model)), title: solution.title, status: 'draft',
        elements: [], decisions: solution.decision ? [solution.decision] : [], milestones: [], body: planBody(),
      }
      const after = withSolutions(linkRecord(before.solutions, solution.id, 'plan', plan.id, day))
      return finish(after, (facts) => ({
        ...solutionLine(facts.solutions.find((one) => one.id === solution.id)!, facts),
        started: { id: plan.id, label: transitionLabel(plan), status: plan.status },
      }), [{ type: 'transition.add', transition: plan }])
    }
    case 'solution.remove': {
      return finish(removeSolution(before, solution.id), () => ({
        id: solution.id, label: formatSolutionNumber(solution.number), title: solution.title, removed: true,
      }))
    }
    case 'experiment.plan': {
      const title = String(args.title).trim()
      const hypothesis = String(args.hypothesis).trim()
      if (!title) return refused('agent.badArguments', '"title" must not be blank')
      if (!hypothesis) return refused('agent.badArguments', '"hypothesis" must not be blank')
      const tests: string[] = []
      for (const idOrLabel of args.tests as string[]) {
        const tested = solutionOf(idOrLabel)
        if (!tested) return refused('agent.unknownId', `solution ${idOrLabel}`)
        tests.push(tested.id)
      }
      if (tests.length === 0) return refused('agent.badArguments', '"tests" must name a solution')
      for (const key of ['from', 'to'] as const) {
        if (typeof args[key] === 'string' && !isDay(args[key] as string)) return refused('agent.badArguments', `${key} ${String(args[key])} is not yyyy-mm-dd`)
      }
      const text = (key: string) => (typeof args[key] === 'string' ? { [key]: args[key] as string } : {})
      const fresh = newExperiment({
        id: view.makeId('ex'), number: nextExperimentNumber(before.experiments), title, tests, hypothesis, t: view.translate,
        from: typeof args.from === 'string' ? args.from : day,
        ...text('measure'), ...text('where'), ...text('by'), ...text('to'), ...text('body'),
      })
      const after = { ...before, experiments: [...before.experiments, fresh] }
      return finish(after, experimentAnswer(after, fresh.id))
    }
    case 'experiment.update':
    case 'experiment.conclude':
    case 'experiment.remove': {
      const experiment = experimentOf(args.id)
      if (!experiment) return refused('agent.unknownId', `experiment ${String(args.id)}`)
      if (tool === 'experiment.remove') {
        return finish({ ...before, experiments: removeExperiment(before.experiments, experiment.id) }, () => ({
          id: experiment.id, label: formatExperimentNumber(experiment.number), title: experiment.title, removed: true,
        }))
      }
      if (tool === 'experiment.conclude') {
        const after = { ...before, experiments: concludeExperiment(before.experiments, experiment.id, args.outcome as ExperimentOutcome, args.result as string | undefined) }
        return finish(after, experimentAnswer(after, experiment.id))
      }
      const patch: ExperimentPatch = {}
      for (const key of ['title', 'hypothesis', 'measure', 'where', 'by', 'from', 'to', 'result', 'body'] as const) {
        if (typeof args[key] === 'string') patch[key] = args[key] as string
      }
      if (patch.title !== undefined && !patch.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
      if (patch.hypothesis !== undefined && !patch.hypothesis.trim()) return refused('agent.badArguments', '"hypothesis" must not be blank')
      for (const key of ['from', 'to'] as const) {
        if (patch[key] && !isDay(patch[key]!)) return refused('agent.badArguments', `${key} ${patch[key]} is not yyyy-mm-dd`)
      }
      if (Array.isArray(args.tests)) {
        const tests: string[] = []
        for (const idOrLabel of args.tests as string[]) {
          const tested = solutionOf(idOrLabel)
          if (!tested) return refused('agent.unknownId', `solution ${idOrLabel}`)
          tests.push(tested.id)
        }
        patch.tests = tests
      }
      const after = { ...before, experiments: updateExperiment(before.experiments, experiment.id, patch) }
      return finish(after, experimentAnswer(after, experiment.id))
    }
    default:
      return refused('agent.badArguments', `${tool} is not a solution tool`)
  }
}

function proposeDecision(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  // `applicationId` is accepted as an alias for one beta (ADR-0012 §7): every
  // agent that learnt the old word keeps working, and `tools.ts` says which is
  // the name.
  const subjectId = (args.subjectId ?? args.applicationId) as string | undefined
  if (subjectId !== undefined && !model.elements[subjectId]) return refused('agent.unknownId', `element ${subjectId}`)
  // Numbers are per list: the scope's own, and each subject's.
  const list = model.order.decisions
    .map((id) => model.decisions![id])
    .filter((adr) => (adr.subjectId ?? undefined) === subjectId)
  const decision: Adr = newAdr({
    id: view.makeId('adr'), number: nextAdrNumber(list), title, date: view.today(), t: view.translate, subjectId,
  })
  if (typeof args.body === 'string' && args.body.trim()) decision.body = args.body
  const signers = signersOf(args)
  if (signers !== undefined) {
    if ('ok' in signers) return signers
    decision.signers = signers
  }
  // Linked from the plan's side, because that is where the link lives: a
  // plan names the decisions it rests on, and a decision names nothing.
  const linked: Command[] = []
  for (const idOrLabel of (args.planIds as string[] | undefined) ?? []) {
    const plan = planOf(idOrLabel, view)
    if (!plan) return refused('agent.unknownId', `plan ${idOrLabel}`)
    if (plan.decisions.includes(decision.id) || linked.some((c) => c.type === 'transition.update' && c.id === plan.id)) continue
    linked.push({ type: 'transition.update', id: plan.id, patch: { decisions: [...plan.decisions, decision.id] } })
  }
  return {
    command: transaction([{ type: 'decision.add', decision }, ...linked], { origin: 'agent' }),
    answer: json({
      id: decision.id, number: decision.number, label: formatAdrNumber(decision.number), title, status: decision.status, subjectId,
      ...(linked.length ? { plans: linked.map((c) => (c.type === 'transition.update' ? c.id : '')) } : {}),
    }),
  }
}

/** A project's own record, or why it cannot be had: a group's is read-only here, and a stranger's is unknown. */
function ownDecision(id: string, view: ReadView): Adr | AgentAnswer {
  const held = decisionsOf(view.model)[id]
  if (held) return held
  return view.ancestorDecisions.some((adr) => adr.id === id)
    ? refused('agent.readOnly', 'a group\'s records are changed on the decisions page')
    : refused('agent.unknownId', `decision ${id}`)
}

/** The signers as given, or nothing when they were not. */
function signersOf(args: Args): AdrSigner[] | AgentAnswer | undefined {
  const given = args.signers as Record<string, unknown>[] | undefined | null
  if (given === undefined || given === null) return undefined
  const out: AdrSigner[] = []
  for (const [index, one] of given.entries()) {
    const name = typeof one.name === 'string' ? one.name.trim() : ''
    if (!name) return refused('agent.badArguments', `signers[${index}].name must not be blank`)
    if (one.signedAt !== undefined && one.signedAt !== null && !isDay(one.signedAt)) {
      return refused('agent.badArguments', `signers[${index}].signedAt must be yyyy-mm-dd`)
    }
    out.push({
      name,
      ...(typeof one.role === 'string' && one.role.trim() ? { role: one.role.trim() } : {}),
      ...(typeof one.verdict === 'string' ? { verdict: one.verdict as AdrVerdict } : {}),
      ...(isDay(one.signedAt) ? { signedAt: one.signedAt } : {}),
    })
  }
  return out
}

function updateDecision(args: Args, view: WriteView): Prepared | AgentAnswer {
  const id = args.id as string
  const held = ownDecision(id, view)
  if ('ok' in held) return held
  if (isAdrLocked(held)) return refused('agent.locked', id)
  const patch: Partial<Adr> = {}
  if (typeof args.title === 'string') {
    if (!args.title.trim()) return refused('agent.badArguments', '"title" must not be blank')
    patch.title = args.title.trim()
  }
  if (typeof args.body === 'string') patch.body = args.body
  if (args.date !== undefined && args.date !== null) {
    if (!isDay(args.date)) return refused('agent.badArguments', 'date must be yyyy-mm-dd')
    patch.date = args.date
  }
  const signers = signersOf(args)
  if (signers !== undefined) {
    if ('ok' in signers) return signers
    patch.signers = signers
  }
  return {
    command: { type: 'decision.update', id, patch, origin: 'agent' },
    answer: json({ id, label: formatAdrNumber(held.number), changed: Object.keys(patch) }),
  }
}

function transitionDecision(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const id = args.id as string
  // A group's record is known but not this project's to change: it is kept
  // with the group, and the page is where it is moved.
  const held = ownDecision(id, view)
  if ('ok' in held) return held
  const status = args.status as AdrStatus
  if (isAdrLocked(held)) return refused('agent.locked', id)
  if (!transitionsFrom(held.status).includes(status)) {
    return refused('agent.badArguments', `${held.status} can only move to ${transitionsFrom(held.status).join(', ') || 'nothing'}`)
  }
  const supersededBy = args.supersededBy as string | undefined
  if (status === 'superseded') {
    if (!supersededBy) return refused('agent.badArguments', '"supersededBy" is required for superseded')
    if (!model.decisions?.[supersededBy] || supersededBy === id) return refused('agent.unknownId', `decision ${supersededBy}`)
  }
  const next = transitionAdr(held, status, view.today(), { supersededBy })
  if (next === held) return refused('agent.badArguments', 'that transition is not allowed')
  const patch: Partial<Adr> = { status: next.status, date: next.date }
  if (next.supersededBy !== undefined) patch.supersededBy = next.supersededBy
  return {
    command: { type: 'decision.update', id, patch, origin: 'agent' },
    answer: json({ id, number: held.number, status: next.status, date: next.date, supersededBy: next.supersededBy }),
  }
}

/**
 * What a laid-out view is OF (ADR-0012 §6), and a board's day. Each id is
 * checked for being the sort of thing the field means — a journey is a root
 * step, a lane an actor, an area a function root — because a sheet given a
 * capability as its journey draws an empty band and says nothing.
 */
function updateDiagram(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const id = args.id as string
  const diagram = model.diagrams[id]
  if (!diagram) return refused('agent.unknownId', `diagram ${id}`)
  const laidOut = diagram.kind === 'sheet' || diagram.kind === 'map' || diagram.kind === 'technology'
  const patch: Record<string, unknown> = {}

  const only = (field: string, allowed: boolean, what: string): AgentAnswer | undefined =>
    (args[field] !== undefined && !allowed ? refused('agent.badArguments', `"${field}" is for ${what}`) : undefined)
  const wrong = only('journeyId', diagram.kind === 'sheet', 'a sheet')
    ?? only('lanes', diagram.kind === 'sheet', 'a sheet')
    ?? only('showActors', diagram.kind === 'sheet', 'a sheet')
    ?? only('columns', diagram.kind === 'sheet', 'a sheet')
    ?? only('areaSpans', diagram.kind === 'sheet', 'a sheet')
    ?? only('paper', diagram.kind === 'sheet', 'a sheet')
    ?? only('areas', diagram.kind === 'sheet' || diagram.kind === 'map', 'a sheet or a map')
    ?? only('asOf', !laidOut, 'a board')
    ?? only('showDeployment', diagram.kind === 'container', 'a container diagram')
    ?? only('colourBy', diagram.kind === 'layer7', 'a landscape')
  if (wrong) return wrong

  // What the cards are tinted by (ADR-0013): presentation, kept on the view,
  // so a reader opening it gets the picture it was left showing.
  if (args.colourBy === null || args.colourBy === '') patch.colourBy = undefined
  else if (typeof args.colourBy === 'string') {
    if (!isColourBy(args.colourBy)) {
      return refused('agent.badArguments', `"colourBy" is one of ${COLOUR_BY.join(', ')}, or one:<id>`)
    }
    // The one thing asked about (ADR-0020) has to be a platform or an
    // offering this scope holds; the picker offers nothing else.
    const one = oneColouredBy(args.colourBy)
    if (one !== undefined) {
      const kind = model.elements[one]?.kind
      if (kind !== 'platform' && kind !== 'platformService') return refused('agent.unknownId', `platform or platformService ${one}`)
    }
    patch.colourBy = args.colourBy
  }

  // Whether the deployment boxes are drawn (ADR-0013): a view setting, kept on
  // the view too.
  if (typeof args.showDeployment === 'boolean') patch.showDeployment = args.showDeployment
  else if (args.showDeployment === null) patch.showDeployment = undefined

  if (args.journeyId === null || args.journeyId === '') patch.journeyId = undefined
  else if (typeof args.journeyId === 'string') {
    const root = model.elements[args.journeyId]
    if (!root) return refused('agent.unknownId', `element ${args.journeyId}`)
    if (root.kind !== 'step' || root.parentId !== undefined) {
      return refused('agent.badArguments', '"journeyId" must name a root step: the journey, whose children are its phases')
    }
    patch.journeyId = args.journeyId
  }
  if (args.lanes === null) patch.lanes = undefined
  else if (Array.isArray(args.lanes)) {
    for (const laneId of args.lanes as string[]) {
      const actor = model.elements[laneId]
      if (!actor) return refused('agent.unknownId', `element ${laneId}`)
      if (actor.kind !== 'actor') return refused('agent.badArguments', `"lanes" must name actors; ${laneId} is a ${actor.kind}`)
    }
    patch.lanes = args.lanes.length ? [...(args.lanes as string[])] : undefined
  }
  if (args.areas === null) patch.areas = undefined
  else if (Array.isArray(args.areas)) {
    const roots = new Set(rootsOfKind(toArrays(model).elements, 'function').map((root) => root.id))
    for (const areaId of args.areas as string[]) {
      if (!model.elements[areaId]) return refused('agent.unknownId', `element ${areaId}`)
      if (!roots.has(areaId)) return refused('agent.badArguments', `"areas" must name function roots; ${areaId} is not one`)
    }
    patch.areas = args.areas.length ? [...(args.areas as string[])] : undefined
  }
  if (args.showActors !== undefined) patch.showActors = args.showActors === false ? false : undefined
  if (args.columns === null) patch.columns = undefined
  else if (args.columns !== undefined) {
    if (!Number.isInteger(args.columns) || (args.columns as number) < 1) {
      return refused('agent.badArguments', '"columns" must be a whole number of at least 1')
    }
    patch.columns = args.columns
  }
  if (args.paper === null) patch.paper = undefined
  else if (args.paper !== undefined) {
    if (!isSheetPaper(args.paper)) return refused('agent.badArguments', '"paper" is A4, A3, A2, A1, A0 or fit')
    patch.paper = args.paper === DEFAULT_PAPER ? undefined : args.paper
  }
  if (args.areaSpans === null) patch.areaSpans = undefined
  else if (args.areaSpans !== undefined) {
    if (typeof args.areaSpans !== 'object' || Array.isArray(args.areaSpans)) {
      return refused('agent.badArguments', '"areaSpans" must map area ids to a number of columns')
    }
    const spans: Record<string, number> = {}
    for (const [areaId, span] of Object.entries(args.areaSpans as Record<string, unknown>)) {
      if (!model.elements[areaId]) return refused('agent.unknownId', `element ${areaId}`)
      if (!Number.isInteger(span) || (span as number) < 1) {
        return refused('agent.badArguments', `"areaSpans" for ${areaId} must be a whole number of at least 1`)
      }
      if ((span as number) > 1) spans[areaId] = span as number
    }
    patch.areaSpans = Object.keys(spans).length ? spans : undefined
  }
  if (args.asOf === null || args.asOf === '') patch.asOf = undefined
  else if (typeof args.asOf === 'string') {
    if (!isDay(args.asOf)) return refused('agent.badArguments', 'asOf must be yyyy-mm-dd')
    patch.asOf = args.asOf
  }

  return {
    command: { type: 'diagram.update', id, patch, origin: 'agent' },
    answer: json({ id, kind: diagram.kind, changed: Object.keys(patch) }),
  }
}

function createDiagram(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  if (args.kind === 'sheet') {
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return refused('agent.badArguments', '"name" is required for a sheet')
    const sheet = seedSheet(toArrays(model).elements, { id: view.makeId('sh'), name })
    // Switched to, as a board is: a laid-out view is drawn in the tab (ADR-0016).
    return {
      command: { type: 'diagram.create', diagram: toDiagram(sheet), origin: 'agent' },
      activeDiagramId: sheet.id,
      answer: json({
        id: sheet.id, kind: 'sheet', name,
        journeyId: sheet.journeyId, areas: sheet.areas ?? [],
      }),
    }
  }
  if (args.kind === 'map') {
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return refused('agent.badArguments', '"name" is required for a map')
    const map = seedMap({ id: view.makeId('mp'), name })
    return {
      command: { type: 'diagram.create', diagram: toDiagram(map), origin: 'agent' },
      activeDiagramId: map.id,
      answer: json({ id: map.id, kind: 'map', name }),
    }
  }
  if (args.kind === 'technology') {
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return refused('agent.badArguments', '"name" is required for a technology landscape')
    const landscape = seedTechnologyLandscape({ id: view.makeId('tl'), name })
    return {
      command: { type: 'diagram.create', diagram: toDiagram(landscape), origin: 'agent' },
      activeDiagramId: landscape.id,
      answer: json({ id: landscape.id, kind: 'technology', name }),
    }
  }
  if (args.kind === 'layer7') {
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return refused('agent.badArguments', '"name" is required for a landscape')
    const diagram: DesignDiagram = {
      id: view.makeId('l7'), kind: 'layer7', name, members: [], geometry: { nodes: [] },
      ...(model.defaultAspectConfig ? { aspectConfig: [...model.defaultAspectConfig] } : {}),
    }
    return {
      command: { type: 'diagram.create', diagram: toDiagram(diagram), origin: 'agent' },
      activeDiagramId: diagram.id,
      answer: json({ id: diagram.id, kind: 'layer7', name }),
    }
  }
  const applicationId = args.applicationId as string | undefined
  if (!applicationId) return refused('agent.badArguments', '"applicationId" is required for a container view')
  if (!model.elements[applicationId]) return refused('agent.unknownId', `element ${applicationId}`)
  const existing = model.order.diagrams.find((id) =>
    model.diagrams[id].kind === 'container' && model.diagrams[id].applicationElementId === applicationId)
  if (existing) {
    return {
      command: transaction([]),
      activeDiagramId: existing,
      answer: json({ id: existing, kind: 'container', name: model.diagrams[existing].name, existed: true }),
    }
  }
  const diagram = seedContainerDiagram(toArrays(model), applicationId, { id: view.makeId('cd'), name: view.containerName })
  if (!diagram) return refused('agent.unknownId', `element ${applicationId}`)
  return {
    command: { type: 'diagram.create', diagram: toDiagram(diagram), origin: 'agent' },
    activeDiagramId: diagram.id,
    answer: json({ id: diagram.id, kind: 'container', name: diagram.name, applicationId }),
  }
}

/**
 * File elements under a domain group and draw its box. The box is the
 * editor's own "Group into new domain group" maths around the members, and an
 * existing box is never moved or shrunk: it grows to the union of itself and
 * what it now holds, so a card already inside stays inside.
 */
function groupElements(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  if (diagram.kind !== 'layer7') return refused('agent.badArguments', 'domain groups are drawn on a landscape')
  const name = (args.name as string).trim()
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  const color = args.color === undefined || args.color === null ? undefined : hexColour(args.color)
  if (color === false) return refused('agent.badArguments', '"color" must be a hex colour like #2e86c1')

  const placements: PlacedNode[] = []
  for (const id of (args.elementIds as string[] | undefined) ?? []) {
    if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    const held = placedOn(diagram, id)!
    if (!held) return refused('agent.notDrawn', id)
    if ((held.zone ?? 'landscape') !== 'landscape') {
      return refused('agent.badArguments', `${id} is in the ${held.zone} band; only landscape cards can be grouped`)
    }
    placements.push(held)
  }

  const known = groupNamed(diagram, name)
  const groupId = known?.id ?? newGroupId(diagram, name)
  const existing = boxesOf(diagram)[groupId]
  if (!known && placements.length === 0) return refused('agent.badArguments', 'a new group needs at least one element')

  const around = groupRectAround(placements.map((p) => placementRect(nodeFigure(model.elements[p.id], p.zone), p)))
  const box = unionRects([...(existing ? [existing] : []), ...(around ? [around] : [])])!
  const rect: DomainGroupRect = { id: groupId, x: box.x, y: box.y, width: box.width, height: box.height }

  // The colour is the group's, not its box's (ADR-0012 §6): `''` clears it,
  // absent leaves whatever the group already says.
  const tint = color === undefined ? known?.color : color === '' ? undefined : color
  const record: DiagramGroup = { id: groupId, name, ...(tint !== undefined ? { color: tint } : {}) }

  const filed = placements.filter((p) => p.group !== groupId).map((p) => ({ ...p, group: groupId }))
  return {
    command: transaction([
      { type: 'group.set', diagramId: diagram.id, groups: [record] },
      { type: 'box.set', diagramId: diagram.id, boxes: [rect] },
      ...(filed.length ? [{ type: 'member.set' as const, diagramId: diagram.id, members: filed.map(memberOf) }] : []),
    ], { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, name, created: !known, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      members: placements.map((p) => p.id),
    }),
  }
}

// --- helpers ----------------------------------------------------------------------------

function diagramOf(args: Args, view: ReadView): Diagram | undefined {
  const id = typeof args.diagramId === 'string' ? args.diagramId : view.activeDiagramId
  return view.model.diagrams[id]
}

/**
 * The diagram a tool is about, or the refusal that says why there is none.
 * Two different mistakes get two different answers: a diagram that was named
 * and does not exist is an unknown id, while nothing named on a scope whose
 * home is up — no diagram on screen — is a missing argument, and the detail
 * says which one to pass. Eight tools used to answer `diagram undefined` to
 * the second, which an agent read as a bug rather than as a question.
 */
function diagramOrRefusal(args: Args, view: ReadView): Diagram | AgentAnswer {
  const diagram = diagramOf(args, view)
  if (diagram) return diagram
  return typeof args.diagramId === 'string'
    ? refused('agent.unknownId', `diagram ${args.diagramId}`)
    : refused('agent.badArguments', 'no diagram is on screen: pass diagramId (see diagrams.list)')
}

/** The named elements' placements on the diagram, or the first refusal. */
function onDiagram(args: Args, view: ReadView): { diagram: Diagram; placements: PlacedNode[] } | AgentAnswer {
  const diagram = diagramOrRefusal(args, view)
  if ('ok' in diagram) return diagram
  const placements: PlacedNode[] = []
  for (const id of args.elementIds as string[]) {
    if (!view.model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    const held = placedOn(diagram, id)!
    if (!held) return refused('agent.notDrawn', id)
    placements.push(held)
  }
  return { diagram, placements }
}

/** A refusal, with where in a list it came from put in front of its detail. */
function withDetail(answer: AgentAnswer, where: string): AgentAnswer {
  if (answer.ok) return answer
  return refused(answer.refusal, answer.detail === undefined ? where : `${where}: ${answer.detail}`)
}


/** A hex colour as the model keeps it, '' for "none", or false for something else. */
function hexColour(value: unknown): string | '' | false {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : false
}

/**
 * What connect, connection.update and connections.update change on a line:
 * the words, the direction, the window and the look. Null clears a field;
 * the window has to be days and run forwards, checked against what the line
 * keeps for the half that was not given.
 */
function relationPatch(args: Args, held: Relation): Partial<Relation> | AgentAnswer {
  const look = lineLook(args)
  if ('ok' in look) return look
  const patch: Partial<Relation> = { ...look }
  for (const key of ['label', 'protocol', 'technology'] as const) {
    if (args[key] === null || args[key] === '') patch[key] = undefined
    else if (typeof args[key] === 'string') patch[key] = args[key] as string
  }
  // Which interface this one is part of (ADR-0013). Whether the ends satisfy
  // the rule is the reducer's to say, and is left to it: it is the writer, and
  // a second copy of the rule here is a second place for it to be wrong.
  if (args.refines !== undefined) {
    if (args.refines === null || args.refines === '') patch.refines = undefined
    else if (typeof args.refines === 'string') patch.refines = args.refines
    else return refused('agent.badArguments', '"refines" is the id of an interface, or null')
  }
  if (typeof args.isBidirectional === 'boolean') patch.isBidirectional = args.isBidirectional
  for (const key of ['validFrom', 'validUntil'] as const) {
    const value = args[key]
    if (value === undefined) continue
    if (value === null || value === '') patch[key] = undefined
    else if (isDay(value)) patch[key] = value
    else return refused('agent.badArguments', `${key} must be yyyy-mm-dd`)
  }
  const from = 'validFrom' in patch ? patch.validFrom : held.validFrom
  const until = 'validUntil' in patch ? patch.validUntil : held.validUntil
  if (from && until && until < from) return refused('agent.badArguments', 'validUntil must not be before validFrom')
  return patch
}

/**
 * The look of a line as a patch: a colour or a style that was asked for, and
 * `undefined` — a deletion, to the reducer — for solid and for an empty colour.
 */
function lineLook(args: Args): { color?: string; lineStyle?: EdgeLineStyle } | AgentAnswer {
  const out: { color?: string; lineStyle?: EdgeLineStyle } = {}
  if (args.color !== undefined && args.color !== null) {
    const color = hexColour(args.color)
    if (color === false) return refused('agent.badArguments', '"color" must be a hex colour like #c0392b')
    out.color = color === '' ? undefined : color
  }
  if (typeof args.lineStyle === 'string') out.lineStyle = args.lineStyle === 'solid' ? undefined : args.lineStyle as EdgeLineStyle
  return out
}

