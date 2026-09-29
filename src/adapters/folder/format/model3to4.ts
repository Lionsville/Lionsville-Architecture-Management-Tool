// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Format 3's model, read as the model says it now: the three folds of
 * ADR-0012 §11 over rows, with no file in sight (`migrate3to4.ts` has the
 * table, and the folder's fold over these).
 *
 * A file of its own because two readers want the rows and only one wants the
 * files: this browser's older storage keeps a whole record under one key, and
 * reading it must not bring the whole folder format into the first download.
 *
 * **The fold is idempotent**, because a stored record has no version to
 * check: a model that is already format 4's shape goes through unchanged.
 */
import type {
  DesignDiagram, DiagramGroup, DiagramMember, DomainGroupRect, EdgeRoute, Geometry, NodeGeometry,
  Relation,
} from '../../../model'
import type { HostModel } from '../../../model/hostModel'
import { FIGURE_MEANS, isNodeFigure } from '../../../model/kinds'
import { claimKey } from '../../../model/keys'
import { splitRoutes } from '../../../model/routes'
import type { ScopeSnapshot } from '../../../projects/scope'

/** The rows of a list, whatever else it held. */
export function rows(held: unknown): Record<string, unknown>[] {
  return Array.isArray(held)
    ? held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    : []
}

// --- the three folds, read halves ------------------------------------------

/**
 * An element row, as the model says it now.
 *
 * Two of ADR-0012's changes landed on the same row. Containment (§3): one field
 * says what a thing sits inside, whatever kind it is, where format 3 knew only
 * `parentApplicationId` — from when a component inside an application was the
 * only containment there was. And the retired kinds (§4): an external system is
 * an `application` nobody here owns, and a channel and a management tool are an
 * `application` in a band of a board, so the kind becomes what it always meant
 * plus the fact that carried it ({@link FIGURE_MEANS}).
 *
 * The band itself is not lost with the kind: it was on the placement row, and
 * it is on the member row now, which is where a zone belonged all along.
 */
export function elementFromV3(row: Record<string, unknown>): Record<string, unknown> {
  const { parentApplicationId, ...rest } = row
  const meant = isNodeFigure(row.kind) ? FIGURE_MEANS[row.kind] : undefined
  return {
    ...rest,
    ...(meant ?? {}),
    ...(parentApplicationId !== undefined ? { parentId: parentApplicationId } : {}),
  }
}

/** Every line format 3 held, as what it has always been: a flow. */
export function relationsFromV3(connections: unknown): Relation[] {
  return rows(connections)
    .filter((row) => typeof row.id === 'string')
    .map((row) => ({ ...row, type: 'flow' })) as unknown as Relation[]
}

/**
 * A dashed group's id, minted from the name it was filed under.
 *
 * Format 3 had no field for one: the NAME was the key, on the rectangle and on
 * every placement under it (ADR-0012 §6 is what gave it an id). Minted over the
 * names in the order the file has them — rectangles first, then any name a
 * placement uses that no rectangle claims, which format 3 allowed — so two
 * names that slug alike are told apart by which came first.
 */
function groupIds(
  rects: readonly Record<string, unknown>[], placements: readonly Record<string, unknown>[],
): { groups: DiagramGroup[]; idOf: Map<string, string> } {
  const taken = new Set<string>()
  const idOf = new Map<string, string>()
  const groups: DiagramGroup[] = []
  const claim = (name: string, color?: unknown) => {
    if (idOf.has(name)) return
    const id = claimKey(name, taken)
    idOf.set(name, id)
    groups.push({ id, name, ...(typeof color === 'string' ? { color } : {}) })
  }
  for (const rect of rects) if (typeof rect.name === 'string') claim(rect.name, rect.color)
  for (const row of placements) if (typeof row.domainGroup === 'string') claim(row.domainGroup)
  return { groups, idOf }
}

/** A route row named for the list it points into, rather than for one type. */
function edgeRouteFromV3(row: Record<string, unknown>): EdgeRoute {
  const { connectionId, ...rest } = row
  return { relationId: connectionId as string, ...rest } as unknown as EdgeRoute
}

/** Where a view's coordinates came from: its own file, or the diagram object. */
export type LaidOutV3 = {
  placements: Record<string, unknown>[]
  /** Absent and empty are different: an emptied `routes` key comes back empty. */
  routes?: Record<string, unknown>[]
  needsLayout?: boolean
}

/**
 * A view, as the two questions ADR-0012 §6 takes it apart into.
 *
 * A placement row was a member AND a node, a group's box carried its name and
 * colour, and a route row carried its constraints and its waypoints together.
 * Each of those splits here, once, whether the halves arrived as two files or
 * as one object in a stored record.
 */
export function viewFromV3(
  definition: Record<string, unknown>, laid: LaidOutV3 | undefined,
): DesignDiagram {
  const {
    layoutConfig, placements: _placed, edgeRoutes: _routed, needsLayout: _fresh, ...rest
  } = definition
  const held = layoutConfig as Record<string, unknown> | undefined
  const rects = rows(held?.domainGroups)
  const placements = (laid?.placements ?? []).filter((row) => typeof row.elementId === 'string')
  const { groups, idOf } = groupIds(rects, placements)

  const members: DiagramMember[] = placements.map((row) => ({
    id: row.elementId as string,
    ...(typeof row.zone === 'string' ? { zone: row.zone as DiagramMember['zone'] } : {}),
    ...(typeof row.domainGroup === 'string' ? { group: idOf.get(row.domainGroup) } : {}),
  }))
  const nodes: NodeGeometry[] = placements.map((row) => ({
    id: row.elementId as string,
    x: typeof row.x === 'number' ? row.x : 0,
    y: typeof row.y === 'number' ? row.y : 0,
    ...(typeof row.width === 'number' ? { width: row.width } : {}),
    ...(typeof row.height === 'number' ? { height: row.height } : {}),
  }))
  const stored = laid?.routes
    ? laid.routes.filter((row) => typeof row.connectionId === 'string').map(edgeRouteFromV3)
    : undefined
  const { lines, routes } = stored ? splitRoutes(stored) : { lines: undefined, routes: undefined }

  const geometry: Geometry = { nodes }
  // No coordinates at all: somebody deleted the file, or a hand-made folder
  // never had one. Either way the geometry is not a decision anybody made yet.
  if (laid?.needsLayout === true || !laid) geometry.needsLayout = true
  if (held?.canvas !== undefined) geometry.canvas = held.canvas as Geometry['canvas']
  if (held?.zones !== undefined) geometry.zones = held.zones as Geometry['zones']
  if (rects.length) {
    geometry.groups = rects.map(({ name, color: _shade, ...box }) => ({
      id: idOf.get(name as string)!, ...box,
    })) as unknown as DomainGroupRect[]
  }
  if (stored) geometry.routes = routes ?? []

  return {
    ...(rest as unknown as Omit<DesignDiagram, 'members' | 'geometry'>),
    ...(groups.length ? { groups } : {}),
    ...(lines ? { lines } : {}),
    members,
    geometry,
  }
}

// --- a record stored whole --------------------------------------------------

/**
 * A model that was stored as one object rather than as files, in the shape it
 * says it is.
 *
 * Browser storage keeps a whole `ProjectSnapshot` under one key and a working
 * file of version 1 or 2 is one JSON document, and neither carries a format
 * number — so the fold has to be safe to run over anything, and is: a list
 * already called `relations` is kept, a view that already has `members` and
 * geometry is left alone, and a kind that is a kind stays one.
 */
export function migrateModel(model: HostModel): HostModel {
  const held = model as unknown as Record<string, unknown>
  const diagrams = rows(held.diagrams).map((diagram) => (
    Array.isArray(diagram.members) && diagram.geometry
      ? diagram as unknown as DesignDiagram
      : viewFromV3(diagram, {
        placements: rows(diagram.placements),
        ...('edgeRoutes' in diagram ? { routes: rows(diagram.edgeRoutes) } : {}),
        ...(diagram.needsLayout === true ? { needsLayout: true } : {}),
      })
  ))
  const { connections, ...kept } = held
  return {
    ...kept,
    elements: rows(held.elements).map(elementFromV3),
    relations: Array.isArray(held.relations)
      ? held.relations as Relation[]
      : relationsFromV3(connections),
    diagrams,
  } as unknown as HostModel
}

/** The same, for a whole stored record. */
export function migrateSnapshot(scope: ScopeSnapshot): ScopeSnapshot {
  return { ...scope, model: migrateModel(scope.model) }
}

/**
 * Was this model stored before the format said it this way?
 *
 * The question a store that keeps a whole snapshot has to answer for
 * {@link ../ports/ProjectStore.outdated}, and it is answered off the two fields
 * that changed name rather than off a version, because there is none to read.
 * {@link migrateModel} leaves exactly the models this says `false` about alone.
 */
export function isBeforeFormat4(model: HostModel): boolean {
  const held = model as unknown as Record<string, unknown>
  if (!Array.isArray(held.relations)) return true
  return rows(held.diagrams).some((view) => !Array.isArray(view.members) || !view.geometry)
}
