// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** Views: made — a board, a laid-out page, a container diagram — and what one is of. */
import { transaction } from '../../model/commands'
import type { Diagram, Model } from '../../model/normalised'
import { toDiagram, toArrays } from '../../model/normalised'
import { isDay } from '../../model/lifecycle'
import { seedContainerDiagram } from '../../model/containerDiagram'
import { COLOUR_BY, isColourBy, oneColouredBy } from '../../model/overlay'
import { seedTechnologyLandscape } from '../../model/technologyLandscape'
import { DEFAULT_PAPER, isSheetPaper } from '../../business/grid'
import { seedMap } from '../../business/map'
import { rootsOfKind, seedSheet } from '../../business/sheetDiagram'
import type { DesignDiagram } from '../../model/types'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import type { Args, Handler, Prepared, WriteView } from './shared'

// --- a new view -------------------------------------------------------------------------

/** The name a laid-out view or a board is given, or the refusal that says it is required. */
function nameFor(args: Args, what: string): string | AgentAnswer {
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  return name || refused('agent.badArguments', `"name" is required for ${what}`)
}

/** A new view, switched to, as a board is: a laid-out view is drawn in the tab (ADR-0016). */
function made(diagram: DesignDiagram, answer: Record<string, unknown>): Prepared {
  return {
    command: { type: 'diagram.create', diagram: toDiagram(diagram), origin: 'agent' },
    activeDiagramId: diagram.id,
    answer: json(answer),
  }
}

/** Each kind that is made from a name alone, and how. */
const BY_NAME: Record<string, { what: string; make: (name: string, view: WriteView) => Prepared }> = {
  sheet: {
    what: 'a sheet',
    make: (name, view) => {
      const sheet = seedSheet(toArrays(view.model).elements, { id: view.makeId('sh'), name })
      return made(sheet, { id: sheet.id, kind: 'sheet', name, journeyId: sheet.journeyId, areas: sheet.areas ?? [] })
    },
  },
  map: {
    what: 'a map',
    make: (name, view) => {
      const map = seedMap({ id: view.makeId('mp'), name })
      return made(map, { id: map.id, kind: 'map', name })
    },
  },
  technology: {
    what: 'a technology landscape',
    make: (name, view) => {
      const landscape = seedTechnologyLandscape({ id: view.makeId('tl'), name })
      return made(landscape, { id: landscape.id, kind: 'technology', name })
    },
  },
  layer7: {
    what: 'a landscape',
    make: (name, view) => {
      const diagram: DesignDiagram = {
        id: view.makeId('l7'), kind: 'layer7', name, members: [], geometry: { nodes: [] },
        ...(view.model.defaultAspectConfig ? { aspectConfig: [...view.model.defaultAspectConfig] } : {}),
      }
      return made(diagram, { id: diagram.id, kind: 'layer7', name })
    },
  },
}

export const createDiagram: Handler = (args, view) => {
  const byName = typeof args.kind === 'string' && Object.hasOwn(BY_NAME, args.kind) ? BY_NAME[args.kind] : undefined
  if (byName) {
    const name = nameFor(args, byName.what)
    return typeof name === 'string' ? byName.make(name, view) : name
  }
  return containerDiagram(args, view)
}

/** An application's container view: the one it has, switched to, or a new one seeded from what it holds. */
function containerDiagram(args: Args, view: WriteView): Prepared | AgentAnswer {
  const { model } = view
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

// --- what a view is of ------------------------------------------------------------------

type Kind = Diagram['kind']

/**
 * Which fields belong to which kind of view, in the order a request is
 * checked: a field given to a view that has no such thing is refused before
 * anything is read.
 */
const ONLY: readonly [field: string, allowed: (kind: Kind) => boolean, what: string][] = [
  ['journeyId', (kind) => kind === 'sheet', 'a sheet'],
  ['lanes', (kind) => kind === 'sheet', 'a sheet'],
  ['showActors', (kind) => kind === 'sheet', 'a sheet'],
  ['columns', (kind) => kind === 'sheet', 'a sheet'],
  ['areaSpans', (kind) => kind === 'sheet', 'a sheet'],
  ['paper', (kind) => kind === 'sheet', 'a sheet'],
  ['areas', (kind) => kind === 'sheet' || kind === 'map', 'a sheet or a map'],
  ['asOf', (kind) => kind !== 'sheet' && kind !== 'map' && kind !== 'technology', 'a board'],
  ['showDeployment', (kind) => kind === 'container', 'a container diagram'],
  ['colourBy', (kind) => kind === 'layer7', 'a landscape'],
]

/** One group of a view's fields, read into the patch, or the refusal that stops the request. */
type ViewField = (args: Args, model: Model, patch: Record<string, unknown>) => AgentAnswer | undefined

/**
 * What the cards are tinted by (ADR-0013): presentation, kept on the view, so
 * a reader opening it gets the picture it was left showing. The one thing
 * asked about (ADR-0020) has to be a platform or an offering this scope
 * holds; the picker offers nothing else.
 */
const colourBy: ViewField = (args, model, patch) => {
  if (args.colourBy === null || args.colourBy === '') patch.colourBy = undefined
  else if (typeof args.colourBy === 'string') {
    if (!isColourBy(args.colourBy)) {
      return refused('agent.badArguments', `"colourBy" is one of ${COLOUR_BY.join(', ')}, or one:<id>`)
    }
    const one = oneColouredBy(args.colourBy)
    if (one !== undefined) {
      const kind = model.elements[one]?.kind
      if (kind !== 'platform' && kind !== 'platformService') return refused('agent.unknownId', `platform or platformService ${one}`)
    }
    patch.colourBy = args.colourBy
  }
  return undefined
}

/** Whether the deployment boxes are drawn (ADR-0013): a view setting, kept on the view too. */
const showDeployment: ViewField = (args, _model, patch) => {
  if (typeof args.showDeployment === 'boolean') patch.showDeployment = args.showDeployment
  else if (args.showDeployment === null) patch.showDeployment = undefined
  return undefined
}

const journey: ViewField = (args, model, patch) => {
  if (args.journeyId === null || args.journeyId === '') patch.journeyId = undefined
  else if (typeof args.journeyId === 'string') {
    const root = model.elements[args.journeyId]
    if (!root) return refused('agent.unknownId', `element ${args.journeyId}`)
    if (root.kind !== 'step' || root.parentId !== undefined) {
      return refused('agent.badArguments', '"journeyId" must name a root step: the journey, whose children are its phases')
    }
    patch.journeyId = args.journeyId
  }
  return undefined
}

const lanes: ViewField = (args, model, patch) => {
  if (args.lanes === null) patch.lanes = undefined
  else if (Array.isArray(args.lanes)) {
    for (const laneId of args.lanes as string[]) {
      const actor = model.elements[laneId]
      if (!actor) return refused('agent.unknownId', `element ${laneId}`)
      if (actor.kind !== 'actor') return refused('agent.badArguments', `"lanes" must name actors; ${laneId} is a ${actor.kind}`)
    }
    patch.lanes = args.lanes.length ? [...(args.lanes as string[])] : undefined
  }
  return undefined
}

const areas: ViewField = (args, model, patch) => {
  if (args.areas === null) patch.areas = undefined
  else if (Array.isArray(args.areas)) {
    const roots = new Set(rootsOfKind(toArrays(model).elements, 'function').map((root) => root.id))
    for (const areaId of args.areas as string[]) {
      if (!model.elements[areaId]) return refused('agent.unknownId', `element ${areaId}`)
      if (!roots.has(areaId)) return refused('agent.badArguments', `"areas" must name function roots; ${areaId} is not one`)
    }
    patch.areas = args.areas.length ? [...(args.areas as string[])] : undefined
  }
  return undefined
}

const page: ViewField = (args, _model, patch) => {
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
  return undefined
}

const areaSpans: ViewField = (args, model, patch) => {
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
  return undefined
}

const asOf: ViewField = (args, _model, patch) => {
  if (args.asOf === null || args.asOf === '') patch.asOf = undefined
  else if (typeof args.asOf === 'string') {
    if (!isDay(args.asOf)) return refused('agent.badArguments', 'asOf must be yyyy-mm-dd')
    patch.asOf = args.asOf
  }
  return undefined
}

const VIEW_FIELDS: readonly ViewField[] = [colourBy, showDeployment, journey, lanes, areas, page, areaSpans, asOf]

/**
 * What a laid-out view is OF (ADR-0012 §6), and a board's day. Each id is
 * checked for being the sort of thing the field means — a journey is a root
 * step, a lane an actor, an area a function root — because a sheet given a
 * capability as its journey draws an empty band and says nothing.
 */
export const updateDiagram: Handler = (args, view) => {
  const { model } = view
  const id = args.id as string
  const diagram = model.diagrams[id]
  if (!diagram) return refused('agent.unknownId', `diagram ${id}`)
  for (const [field, allowed, what] of ONLY) {
    if (args[field] !== undefined && !allowed(diagram.kind)) return refused('agent.badArguments', `"${field}" is for ${what}`)
  }
  const patch: Record<string, unknown> = {}
  for (const read of VIEW_FIELDS) {
    const wrong = read(args, model, patch)
    if (wrong) return wrong
  }
  return {
    command: { type: 'diagram.update', id, patch, origin: 'agent' },
    answer: json({ id, kind: diagram.kind, changed: Object.keys(patch) }),
  }
}
