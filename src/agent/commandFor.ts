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
import { transaction } from '../model/commands'
import type { IdPolicy, MakeId } from '../model/keys'
import type { Diagram, Model } from '../model/normalised'
import { toDiagram, toArrays } from '../model/normalised'
import {
  clampPlacementIntoZone, defaultContainerPosition, defaultZonePosition, freeSlotIn, freeZonePosition, groupRectAround,
  placementRect, rectCenter, rectsIntersect, unionRects,
} from '../model/placement'
import { HOME_ZONE, zoneForPoint } from '../model/zones'
import { isDay } from '../model/lifecycle'
import { seedContainerDiagram } from '../model/containerDiagram'
import { portCommands, portsOf, unplannedPorts, unportCommands } from '../model/porting'
import { replacementCommands } from '../model/replacement'
import {
  findTransition, nextTransitionNumber, transitionLabel, transitionsFrom as planTransitionsFrom,
} from '../model/transition'
import type { Transition, TransitionElement, TransitionMilestone, TransitionRole, TransitionStatus } from '../model/transition'
import { decisionsOf, transitionList } from '../model/normalised'
import { businessCaseTemplate } from '../documentation/businessCase'
import type {
  DesignDiagram, DesignElement, DiagramPlacement, DomainGroupRect, EdgeLineStyle, ElementId, Relation,
  AspectStatus, ElementKind, Layer7Zone, Rect,
} from '../model/types'
import type { AdrStatus } from '../model/adr'
import { formatAdrNumber, isAdrDeletable, isAdrLocked, newAdr, nextAdrNumber, transitionAdr, transitionsFrom } from '../decisions/adr'
import { alignNodes, distributeNodes } from '../layout/alignDistribute'
import type { AlignAxis, DistributeAxis, NodeBounds } from '../layout/alignDistribute'
import type { Translate } from '../i18n/strings'
import { planEntry } from './answer'
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
    case 'connection.remove': {
      const id = args.id as string
      if (!model.relations[id]) return refused('agent.unknownId', `connection ${id}`)
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
        command: { type: 'placement.set', diagramId: diagram.id, placements: moved, origin: 'agent' },
        answer: json({ diagramId: diagram.id, moved: moved.map(({ elementId, x, y }) => ({ elementId, x, y })) }),
      }
    }
    case 'placeNextTo': {
      const diagram = diagramOf(args, view)
      if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
      const elementId = args.elementId as string
      const anchorId = args.anchorId as string
      const element = model.elements[elementId]
      const anchor = model.elements[anchorId]
      if (!element) return refused('agent.unknownId', `element ${elementId}`)
      if (!anchor) return refused('agent.unknownId', `element ${anchorId}`)
      const anchorPlacement = diagram.placements[anchorId]
      if (!anchorPlacement) return refused('agent.notDrawn', anchorId)
      const held = diagram.placements[elementId]
      if (!held) return refused('agent.notDrawn', elementId)
      const gap = (args.gap as number | undefined) ?? 40
      const side = (args.side as 'right' | 'left' | 'above' | 'below' | undefined) ?? 'right'
      const a = placementRect(anchor.kind, anchorPlacement)
      const mine = placementRect(element.kind, held)
      const spot = side === 'right' ? { x: a.x + a.width + gap, y: a.y }
        : side === 'left' ? { x: a.x - gap - mine.width, y: a.y }
        : side === 'above' ? { x: a.x, y: a.y - gap - mine.height }
        : { x: a.x, y: a.y + a.height + gap }
      const beside: DiagramPlacement = {
        ...held, ...spot,
        ...(anchorPlacement.zone !== undefined ? { zone: anchorPlacement.zone } : {}),
        ...(anchorPlacement.domainGroup !== undefined ? { domainGroup: anchorPlacement.domainGroup } : {}),
      }
      if ((beside.zone ?? 'landscape') !== 'landscape') delete beside.domainGroup
      // Beside its anchor in the anchor's band means inside that band: right of
      // the last card in a side band is outside it, and the report would say so.
      const placement = diagram.kind === 'layer7' ? keptInBand(model, diagram, element.kind, beside) : beside
      const commands: Command[] = [{ type: 'placement.set', diagramId: diagram.id, placements: [placement] }]
      const layout = diagram.kind === 'layer7' && placement.domainGroup !== undefined
        ? growGroup(diagram, placement.domainGroup, placementRect(element.kind, placement)) : undefined
      if (layout) commands.push(layout)
      const clamped = placement.x !== spot.x || placement.y !== spot.y
      return {
        command: transaction(commands, { origin: 'agent' }),
        answer: json({
          diagramId: diagram.id, elementId, x: placement.x, y: placement.y, zone: placement.zone, domainGroup: placement.domainGroup,
          ...(clamped ? { clamped: true, note: 'Moved to stay inside its band.' } : {}),
        }),
      }
    }
    case 'element.place': return placeElement(args, view)
    case 'element.draw': return drawElement(args, view)
    case 'element.undraw': {
      const diagram = diagramOf(args, view)
      if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
      const id = args.id as string
      if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
      if (!diagram.placements[id]) return refused('agent.notDrawn', id)
      return {
        command: { type: 'placement.remove', diagramId: diagram.id, elementIds: [id], origin: 'agent' },
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
      const bounds: NodeBounds[] = placements.map((p) => ({ id: p.elementId, ...placementRect(model.elements[p.elementId].kind, p) }))
      const updates = tool === 'align'
        ? alignNodes(bounds, args.axis as AlignAxis)
        : distributeNodes(bounds, args.axis as DistributeAxis)
      const moved = updates.map((u) => ({ ...diagram.placements[u.elementId], x: u.x, y: u.y }))
      return {
        command: { type: 'placement.set', diagramId: diagram.id, placements: moved, origin: 'agent' },
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
  const diagram = diagramOf(args, view)
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
  const parentApplicationId = args.parentApplicationId as string | undefined
  if (parentApplicationId !== undefined && !model.elements[parentApplicationId]) {
    return refused('agent.unknownId', `element ${parentApplicationId}`)
  }

  const id = view.ids.element(name)
  const bare: DesignElement = {
    id,
    kind,
    name,
    lifecycle: 'live',
    isManaged: kind !== 'externalSystem' && kind !== 'actor',
    aspects: {},
    ...(parentApplicationId !== undefined
      ? { parentApplicationId }
      : kind === 'component' && diagram.kind === 'container' && diagram.applicationElementId
        ? { parentApplicationId: diagram.applicationElementId }
        : {}),
  }
  // The same fields, read the same way as an update, applied to the bare row.
  const patch = elementPatch(args, bare, view)
  if ('ok' in patch) return patch
  const element: DesignElement = { ...bare, ...patch }
  for (const key of Object.keys(patch) as (keyof DesignElement)[]) if (element[key] === undefined) delete element[key]

  const seeded = seedPlacement(model, diagram, id, kind, args)
  if ('ok' in seeded) return seeded
  const { placement, layout } = seeded
  return {
    command: transaction([
      { type: 'element.create', element },
      { type: 'placement.set', diagramId: diagram.id, placements: [placement] },
      ...(layout ? [layout] : []),
    ], { origin: 'agent' }),
    answer: json({ id, name, kind, diagramId: diagram.id, x: placement.x, y: placement.y, zone: placement.zone, domainGroup: placement.domainGroup }),
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
    if (!own[id] && !view.groupDecisions.some((adr) => adr.id === id)) return refused('agent.unknownId', `decision ${id}`)
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

type Seeded = { placement: DiagramPlacement; layout?: Command }

/**
 * Where a new card lands: what was asked for, else the same cascade the
 * palette uses — and inside its group's box when a group is named, because a
 * card filed under a group and drawn outside its box is a card the next drag
 * re-files. A group that has no box yet gets one around the card.
 */
function seedPlacement(model: Model, diagram: Diagram, elementId: ElementId, kind: ElementKind, args: Args): Seeded | AgentAnswer {
  const asked = typeof args.x === 'number' && typeof args.y === 'number'
    ? { x: args.x, y: args.y } : undefined
  if (diagram.kind !== 'layer7') {
    if (args.zone !== undefined || typeof args.domainGroup === 'string') {
      return refused('agent.badArguments', 'bands and domain groups are a landscape\'s')
    }
    return { placement: { elementId, ...(asked ?? defaultContainerPosition(kind, diagram.order.placements.length)) } }
  }
  const zone = (args.zone as Layer7Zone | undefined) ?? HOME_ZONE[kind]
  const group = typeof args.domainGroup === 'string' && args.domainGroup.trim() ? args.domainGroup.trim() : undefined
  if (group !== undefined && zone !== 'landscape') return refused('agent.badArguments', `${group} is a domain group; only landscape cards are grouped`)
  const box = group === undefined ? undefined : groupBox(diagram, group)
  const position = asked
    ?? (box ? freeSlotIn(box, kind, membersOf(model, diagram, group!).map(([, rect]) => rect))
      : defaultZonePosition(zone, kind, diagram.order.placements.filter((id) => (diagram.placements[id].zone ?? 'landscape') === zone).length, diagram.layoutConfig))
  const placement: DiagramPlacement = { elementId, zone, ...position, ...(group !== undefined ? { domainGroup: group } : {}) }
  const kept = zone === 'landscape' ? placement : clampPlacementIntoZone(placement, kind, diagram.layoutConfig) ?? placement
  return { placement: kept, layout: group === undefined ? undefined : growGroup(diagram, group, placementRect(kind, kept)) }
}

/**
 * A card filed in a side band, kept inside it. The clamp slides it to the
 * band's edge, which is on top of whatever was already at that edge — the
 * anchor, usually — so a clamped card that would land on another one takes a
 * free slot in the band instead. A landscape card is not touched.
 */
function keptInBand(model: Model, diagram: Diagram, kind: ElementKind, placement: DiagramPlacement): DiagramPlacement {
  if ((placement.zone ?? 'landscape') === 'landscape') return placement
  const clamped = clampPlacementIntoZone(placement, kind, diagram.layoutConfig)
  if (!clamped) return placement
  const others = diagram.order.placements
    .filter((id) => id !== placement.elementId && model.elements[id] && (diagram.placements[id].zone ?? 'landscape') === placement.zone)
    .map((id) => placementRect(model.elements[id].kind, diagram.placements[id]))
  const mine = placementRect(kind, clamped)
  if (!others.some((rect) => rectsIntersect(mine, rect))) return clamped
  return { ...clamped, ...freeZonePosition(placement.zone!, kind, others, diagram.layoutConfig) }
}

function groupBox(diagram: Diagram, name: string): DomainGroupRect | undefined {
  return (diagram.layoutConfig?.domainGroups ?? []).find((one) => one.name === name)
}

/** The drawn members of a group, with their rectangles. */
function membersOf(model: Model, diagram: Diagram, name: string): [ElementId, Rect][] {
  return diagram.order.placements
    .filter((id) => diagram.placements[id].domainGroup === name && model.elements[id])
    .map((id) => [id, placementRect(model.elements[id].kind, diagram.placements[id])])
}

/**
 * The layout command that makes a group's box hold this rectangle: grown to
 * the union when it has one, drawn around the card when it has none, and
 * nothing when the card is inside already. A box is never moved or shrunk.
 */
function growGroup(diagram: Diagram, name: string, rect: Rect): Command | undefined {
  const current = diagram.layoutConfig ?? {}
  const groups = [...(current.domainGroups ?? [])]
  const index = groups.findIndex((one) => one.name === name)
  const existing = index >= 0 ? groups[index] : undefined
  const box = existing ? unionRects([existing, rect])! : groupRectAround([rect])!
  if (existing && box.x === existing.x && box.y === existing.y && box.width === existing.width && box.height === existing.height) return undefined
  const grown: DomainGroupRect = { ...(existing ?? { name }), x: box.x, y: box.y, width: box.width, height: box.height }
  if (index >= 0) groups[index] = grown
  else groups.push(grown)
  return { type: 'layout.set', diagramId: diagram.id, layoutConfig: { ...current, domainGroups: groups } }
}

function placeElement(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOf(args, view)
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
  const id = args.id as string
  const element = model.elements[id]
  if (!element) return refused('agent.unknownId', `element ${id}`)
  const held = diagram.placements[id]
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

  let next: DiagramPlacement = { ...held, ...(asked ?? {}) }
  if (diagram.kind === 'layer7') {
    if (zone !== undefined) {
      next.zone = zone
      if (zone !== 'landscape') delete next.domainGroup
    } else if (asked) {
      // A spot in another band than the card is filed in is a contradiction
      // the report would flag straight away; the band has to be said.
      const filed = held.zone ?? 'landscape'
      const actually = zoneForPoint(rectCenter(placementRect(element.kind, next)), diagram.layoutConfig)
      if (actually !== filed) return refused('agent.badArguments', `(${asked.x}, ${asked.y}) is in the ${actually} band; say zone: ${actually} to move it there`)
    }
    if (group === null) delete next.domainGroup
    else if (typeof group === 'string') {
      const name = group.trim()
      if ((next.zone ?? 'landscape') !== 'landscape') return refused('agent.badArguments', `${id} is in the ${next.zone} band; only landscape cards can be grouped`)
      const box = groupBox(diagram, name)
      if (!box) return refused('agent.unknownId', `domain group ${name}; make one with group`)
      if (!asked) {
        const others = membersOf(model, diagram, name).filter(([member]) => member !== id).map(([, rect]) => rect)
        next = { ...next, ...freeSlotIn(box, element.kind, others) }
      }
      next.domainGroup = name
    }
    next = keptInBand(model, diagram, element.kind, next)
  }

  const commands: Command[] = [{ type: 'placement.set', diagramId: diagram.id, placements: [next] }]
  const layout = next.domainGroup === undefined ? undefined : growGroup(diagram, next.domainGroup, placementRect(element.kind, next))
  if (layout) commands.push(layout)
  const clamped = asked !== undefined && (next.x !== asked.x || next.y !== asked.y)
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, elementId: id, x: next.x, y: next.y, zone: next.zone, domainGroup: next.domainGroup,
      ...(clamped ? { clamped: true, note: 'Moved to stay inside its band.' } : {}),
    }),
  }
}

function drawElement(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOf(args, view)
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
  const id = args.id as string
  const element = model.elements[id]
  if (!element) return refused('agent.unknownId', `element ${id}`)
  if (diagram.placements[id]) return refused('agent.badArguments', `${id} is drawn on ${diagram.id} already; element.place moves it`)
  const seeded = seedPlacement(model, diagram, id, element.kind, args)
  if ('ok' in seeded) return seeded
  const { placement, layout } = seeded
  return {
    command: transaction([
      { type: 'placement.set', diagramId: diagram.id, placements: [placement] },
      ...(layout ? [layout] : []),
    ], { origin: 'agent' }),
    answer: json({ diagramId: diagram.id, elementId: id, x: placement.x, y: placement.y, zone: placement.zone, domainGroup: placement.domainGroup }),
  }
}

function ungroup(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const diagram = diagramOf(args, view)
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
  if (diagram.kind !== 'layer7') return refused('agent.badArguments', 'domain groups are drawn on a landscape')
  const name = (args.name as string).trim()
  const box = groupBox(diagram, name)
  const members = membersOf(model, diagram, name).map(([id]) => id)
  if (!box && members.length === 0) return refused('agent.unknownId', `domain group ${name}`)
  const named = args.elementIds as string[] | undefined
  const leaving = named ?? members
  for (const id of leaving) {
    if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    if (!diagram.placements[id]) return refused('agent.notDrawn', id)
    if (diagram.placements[id].domainGroup !== name) return refused('agent.badArguments', `${id} is not in ${name}`)
  }
  const unfiled = leaving.map((id) => {
    const { domainGroup: _group, ...rest } = diagram.placements[id]
    void _group
    return rest
  })
  const commands: Command[] = []
  if (unfiled.length) commands.push({ type: 'placement.set', diagramId: diagram.id, placements: unfiled })
  if (named === undefined && box) {
    const current = diagram.layoutConfig ?? {}
    commands.push({ type: 'layout.set', diagramId: diagram.id, layoutConfig: { ...current, domainGroups: (current.domainGroups ?? []).filter((one) => one.name !== name) } })
  }
  return {
    command: transaction(commands, { origin: 'agent' }),
    answer: json({ diagramId: diagram.id, name, dissolved: named === undefined, unfiled: leaving }),
  }
}

function proposeDecision(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const title = (args.title as string).trim()
  if (!title) return refused('agent.badArguments', '"title" must not be blank')
  const applicationId = args.applicationId as string | undefined
  if (applicationId !== undefined && !model.elements[applicationId]) return refused('agent.unknownId', `element ${applicationId}`)
  // Numbers are per list: the landscape's own, and each application's.
  const list = model.order.decisions
    .map((id) => model.decisions![id])
    .filter((adr) => (adr.applicationId ?? undefined) === applicationId)
  const decision: Adr = newAdr({
    id: view.makeId('adr'), number: nextAdrNumber(list), title, date: view.today(), t: view.translate, applicationId,
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
      id: decision.id, number: decision.number, label: formatAdrNumber(decision.number), title, status: decision.status, applicationId,
      ...(linked.length ? { plans: linked.map((c) => (c.type === 'transition.update' ? c.id : '')) } : {}),
    }),
  }
}

/** A project's own record, or why it cannot be had: a group's is read-only here, and a stranger's is unknown. */
function ownDecision(id: string, view: ReadView): Adr | AgentAnswer {
  const held = decisionsOf(view.model)[id]
  if (held) return held
  return view.groupDecisions.some((adr) => adr.id === id)
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

function createDiagram(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  if (args.kind === 'layer7') {
    const name = typeof args.name === 'string' ? args.name.trim() : ''
    if (!name) return refused('agent.badArguments', '"name" is required for a landscape')
    const diagram: DesignDiagram = {
      id: view.makeId('l7'), kind: 'layer7', name, placements: [],
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
  const diagram = diagramOf(args, view)
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
  if (diagram.kind !== 'layer7') return refused('agent.badArguments', 'domain groups are drawn on a landscape')
  const name = (args.name as string).trim()
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  const color = args.color === undefined || args.color === null ? undefined : hexColour(args.color)
  if (color === false) return refused('agent.badArguments', '"color" must be a hex colour like #2e86c1')

  const placements: DiagramPlacement[] = []
  for (const id of (args.elementIds as string[] | undefined) ?? []) {
    if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    const held = diagram.placements[id]
    if (!held) return refused('agent.notDrawn', id)
    if ((held.zone ?? 'landscape') !== 'landscape') {
      return refused('agent.badArguments', `${id} is in the ${held.zone} band; only landscape cards can be grouped`)
    }
    placements.push(held)
  }

  const current = diagram.layoutConfig ?? {}
  const groups = [...(current.domainGroups ?? [])]
  const index = groups.findIndex((g) => g.name === name)
  const existing: DomainGroupRect | undefined = index >= 0 ? groups[index] : undefined
  if (!existing && placements.length === 0) return refused('agent.badArguments', 'a new group needs at least one element')

  const around = groupRectAround(placements.map((p) => placementRect(model.elements[p.elementId].kind, p)))
  const box = unionRects([...(existing ? [existing] : []), ...(around ? [around] : [])])!
  const rect: DomainGroupRect = { name, x: box.x, y: box.y, width: box.width, height: box.height }
  const tint = color === undefined ? existing?.color : color === '' ? undefined : color
  if (tint !== undefined) rect.color = tint
  if (index >= 0) groups[index] = rect
  else groups.push(rect)

  const filed = placements.filter((p) => p.domainGroup !== name).map((p) => ({ ...p, domainGroup: name }))
  return {
    command: transaction([
      { type: 'layout.set', diagramId: diagram.id, layoutConfig: { ...current, domainGroups: groups } },
      ...(filed.length ? [{ type: 'placement.set' as const, diagramId: diagram.id, placements: filed }] : []),
    ], { origin: 'agent' }),
    answer: json({
      diagramId: diagram.id, name, created: !existing, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      members: placements.map((p) => p.elementId),
    }),
  }
}

// --- helpers ----------------------------------------------------------------------------

function diagramOf(args: Args, view: ReadView): Diagram | undefined {
  const id = typeof args.diagramId === 'string' ? args.diagramId : view.activeDiagramId
  return view.model.diagrams[id]
}

/** The named elements' placements on the diagram, or the first refusal. */
function onDiagram(args: Args, view: ReadView): { diagram: Diagram; placements: DiagramPlacement[] } | AgentAnswer {
  const diagram = diagramOf(args, view)
  if (!diagram) return refused('agent.unknownId', `diagram ${String(args.diagramId)}`)
  const placements: DiagramPlacement[] = []
  for (const id of args.elementIds as string[]) {
    if (!view.model.elements[id]) return refused('agent.unknownId', `element ${id}`)
    const held = diagram.placements[id]
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
  for (const key of ['label', 'protocol'] as const) {
    if (args[key] === null || args[key] === '') patch[key] = undefined
    else if (typeof args[key] === 'string') patch[key] = args[key] as string
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

