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
import type { Adr } from '../model/adr'
import type { Command } from '../model/commands'
import { transaction } from '../model/commands'
import type { IdPolicy, MakeId } from '../model/keys'
import type { Diagram } from '../model/normalised'
import { toDiagram, toArrays } from '../model/normalised'
import {
  defaultContainerPosition, defaultZonePosition, groupRectAround, placementRect, unionRects,
} from '../model/placement'
import { HOME_ZONE } from '../model/zones'
import { seedContainerDiagram } from '../model/containerDiagram'
import type {
  DesignConnection, DesignDiagram, DesignElement, DiagramPlacement, DomainGroupRect, EdgeLineStyle, ElementId,
  ElementKind, Layer7Zone, Lifecycle,
} from '../model/types'
import type { AdrStatus } from '../model/adr'
import { isAdrLocked, newAdr, nextAdrNumber, transitionAdr, transitionsFrom } from '../decisions/adr'
import { alignNodes, distributeNodes } from '../layout/alignDistribute'
import type { AlignAxis, DistributeAxis, NodeBounds } from '../layout/alignDistribute'
import type { Translate } from '../i18n/strings'
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
      if (!model.elements[id]) return refused('agent.unknownId', `element ${id}`)
      const patch = fieldsOf(args, ['name', 'description', 'category', 'vendor', 'technology', 'lifecycle', 'isManaged'])
      if (typeof patch.name === 'string' && !patch.name.trim()) return refused('agent.badArguments', '"name" must not be blank')
      return {
        command: { type: 'element.update', id, patch: patch as Partial<DesignElement>, origin: 'agent' },
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
      const look = lineLook(args)
      if ('ok' in look) return look
      const connection: DesignConnection = {
        id: view.ids.connection(),
        sourceId,
        targetId,
        isBidirectional: args.isBidirectional === true,
        ...strings(args, ['label', 'protocol']),
        ...(look.color !== undefined ? { color: look.color } : {}),
        ...(look.lineStyle !== undefined ? { lineStyle: look.lineStyle } : {}),
      }
      return {
        command: { type: 'connection.create', connection, origin: 'agent' },
        answer: json({ id: connection.id, sourceId, targetId }),
      }
    }
    case 'connection.update': {
      const id = args.id as string
      if (!model.connections[id]) return refused('agent.unknownId', `connection ${id}`)
      const look = lineLook(args)
      if ('ok' in look) return look
      // Solid and an empty colour are asked for by name and land as deletions,
      // so the line falls back to the theme rather than carrying a default.
      const patch = { ...fieldsOf(args, ['label', 'protocol', 'isBidirectional']), ...look }
      return {
        command: { type: 'connection.update', id, patch: patch as Partial<DesignConnection>, origin: 'agent' },
        answer: json({ id, changed: Object.keys(patch) }),
      }
    }
    case 'connection.remove': {
      const id = args.id as string
      if (!model.connections[id]) return refused('agent.unknownId', `connection ${id}`)
      return { command: { type: 'connection.delete', id, origin: 'agent' }, answer: json({ id, removed: true }) }
    }
    case 'decision.propose': return proposeDecision(args, view)
    case 'decision.transition': return transitionDecision(args, view)
    case 'diagram.create': return createDiagram(args, view)

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
      const placement: DiagramPlacement = {
        ...held, ...spot,
        ...(anchorPlacement.zone !== undefined ? { zone: anchorPlacement.zone } : {}),
        ...(anchorPlacement.domainGroup !== undefined ? { domainGroup: anchorPlacement.domainGroup } : {}),
      }
      return {
        command: { type: 'placement.set', diagramId: diagram.id, placements: [placement], origin: 'agent' },
        answer: json({ diagramId: diagram.id, elementId, x: placement.x, y: placement.y, zone: placement.zone, domainGroup: placement.domainGroup }),
      }
    }
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
  const element: DesignElement = {
    id,
    kind,
    name,
    lifecycle: (args.lifecycle as Lifecycle | undefined) ?? 'live',
    isManaged: kind !== 'externalSystem' && kind !== 'actor',
    aspects: {},
    parameters: {},
    ...strings(args, ['description', 'category', 'vendor', 'technology']),
    ...(parentApplicationId !== undefined
      ? { parentApplicationId }
      : kind === 'component' && diagram.kind === 'container' && diagram.applicationElementId
        ? { parentApplicationId: diagram.applicationElementId }
        : {}),
  }

  const placement = seedPlacement(diagram, id, kind, args)
  return {
    command: transaction([
      { type: 'element.create', element },
      { type: 'placement.set', diagramId: diagram.id, placements: [placement] },
    ], { origin: 'agent' }),
    answer: json({ id, name, kind, diagramId: diagram.id, x: placement.x, y: placement.y, zone: placement.zone }),
  }
}

/** Where a new element lands: what was asked for, else the same cascade the palette uses. */
function seedPlacement(diagram: Diagram, elementId: ElementId, kind: ElementKind, args: Args): DiagramPlacement {
  const asked = typeof args.x === 'number' && typeof args.y === 'number'
    ? { x: args.x, y: args.y } : undefined
  if (diagram.kind === 'layer7') {
    const zone = (args.zone as Layer7Zone | undefined) ?? HOME_ZONE[kind]
    const placed = diagram.order.placements.filter((id) => (diagram.placements[id].zone ?? 'landscape') === zone).length
    const position = asked ?? defaultZonePosition(zone, kind, placed, diagram.layoutConfig)
    return {
      elementId, zone, ...position,
      ...(typeof args.domainGroup === 'string' ? { domainGroup: args.domainGroup } : {}),
    }
  }
  return { elementId, ...(asked ?? defaultContainerPosition(kind, diagram.order.placements.length)) }
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
  return {
    command: { type: 'decision.add', decision, origin: 'agent' },
    answer: json({ id: decision.id, number: decision.number, title, status: decision.status, applicationId }),
  }
}

function transitionDecision(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
  const id = args.id as string
  const held = model.decisions?.[id]
  if (!held) {
    // A group's record is known but not this project's to change: it is kept
    // with the group, and the page is where it is moved.
    return view.groupDecisions.some((adr) => adr.id === id)
      ? refused('agent.readOnly', 'a group\'s records are changed on the decisions page')
      : refused('agent.unknownId', `decision ${id}`)
  }
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

/** The named keys that were given, as a patch. A key not given is not touched. */
function fieldsOf(args: Args, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) if (args[key] !== undefined && args[key] !== null) out[key] = args[key]
  return out
}

/** A hex colour as the model keeps it, '' for "none", or false for something else. */
function hexColour(value: unknown): string | '' | false {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : false
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

function strings(args: Args, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of keys) if (typeof args[key] === 'string' && args[key]) out[key] = args[key] as string
  return out
}
