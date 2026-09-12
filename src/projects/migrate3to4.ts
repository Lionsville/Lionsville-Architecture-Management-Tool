/**
 * The last reader of format 3, and the only file that still knows how it spelt
 * things.
 *
 * Format 4 made the file say what the model says (`folderFormat.ts`), which
 * left three folds with nowhere to live and one job still to do: every folder,
 * every browser-storage record and every working file written before the turn
 * has to keep opening. ADR-0012 §11 is the table; this is the table as code.
 *
 * | it said | it says now |
 * |---|---|
 * | `connections` | `relations`, every row `type: 'flow'` |
 * | `externalSystem` | `application` + `outside` |
 * | `inputChannel` / `managementTool` | `application`; the band is the view's |
 * | `parentApplicationId` | `parentId` |
 * | `placements[].zone` / `.domainGroup` | `members[]`, groups by id |
 * | `layoutConfig` + coordinates | the geometry file |
 * | `<id>.placements.json` | `<id>.geometry.json` |
 *
 * **It reads the old and writes through the new.** The fold ends at a
 * `DesignDiagram`, and {@link diagramFiles} — the format's own writer — turns
 * that into the pair of files. So there is one writer of format 4 and no
 * second one here to drift from it; what this file owns is the reading.
 *
 * **What it removes, it removes on purpose.** A folder's superseded placement
 * files are simply not among the files this pass hands back, so the first save
 * takes them off disk under the store's own rule — remove what matches the
 * format's grammar and is not in the list (`isFormatPath`). Saying it here
 * rather than relying on it being noticed is the point of this paragraph.
 *
 * **The fold is idempotent**, because one of its two callers has no version to
 * check: a browser-storage record is a whole `ProjectSnapshot` with nothing on
 * it that says when it was written. A model that is already format 4's shape
 * goes through unchanged.
 */
import type {
  DesignDiagram, DiagramGroup, DiagramMember, DomainGroupRect, EdgeRoute, Geometry, NodeGeometry,
  Relation,
} from '../model'
import type { HostModel } from '../model/fromInterchange'
import { FIGURE_MEANS, isNodeFigure } from '../model/kinds'
import { claimKey } from '../model/keys'
import { splitRoutes } from '../model/routes'
import { parseJson, stableJson, textFromBytes } from './fileText'
import {
  diagramFiles, DIAGRAMS_FOLDER, MODEL_FILE, PROJECT_FILE, PROJECT_FORMAT_VERSION, projectFromFolder,
} from './folderFormat'
import type { FolderFile } from './folderFormat'
import type { ProjectSnapshot } from './project'
import type { ProjectRef } from './projectRef'

/** The version this file reads. There is no 1 or 2: the folder began at 3. */
const FORMAT_3 = 3

/** What a view's second file was called before it held numbers only. */
const PLACEMENTS_SUFFIX = '.placements.json'

function rows(held: unknown): Record<string, unknown>[] {
  return Array.isArray(held)
    ? held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    : []
}

function objectIn(file: FolderFile | undefined): Record<string, unknown> | undefined {
  if (!file) return undefined
  const parsed = parseJson('text' in file ? file.text : textFromBytes(file.bytes))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined
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
function elementFromV3(row: Record<string, unknown>): Record<string, unknown> {
  const { parentApplicationId, ...rest } = row
  const meant = isNodeFigure(row.kind) ? FIGURE_MEANS[row.kind] : undefined
  return {
    ...rest,
    ...(meant ?? {}),
    ...(parentApplicationId !== undefined ? { parentId: parentApplicationId } : {}),
  }
}

/** Every line format 3 held, as what it has always been: a flow. */
function relationsFromV3(connections: unknown): Relation[] {
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
type LaidOutV3 = {
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
function viewFromV3(
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

// --- a folder ---------------------------------------------------------------

function isDefinition(path: string): boolean {
  return path.startsWith(`${DIAGRAMS_FOLDER}/`) && path.endsWith('.json')
    && !path.endsWith(PLACEMENTS_SUFFIX)
}

/**
 * A format-3 folder's files, as format 4's, or `undefined` when the folder is
 * not one — which includes every folder that is already format 4.
 *
 * Exported so a test can read the output as files rather than only through a
 * project: a migration whose result can only be inspected after it has been
 * parsed again is a migration whose bugs are invisible.
 */
export function foldFolderToFormat4(files: readonly FolderFile[]): FolderFile[] | undefined {
  const byPath = new Map(files.map((file) => [file.path, file]))
  const header = objectIn(byPath.get(PROJECT_FILE))
  if (!header || header.formatVersion !== FORMAT_3) return undefined

  const folded: FolderFile[] = []
  for (const file of files) {
    if (file.path === PROJECT_FILE) {
      folded.push({
        path: PROJECT_FILE,
        text: stableJson({ ...header, formatVersion: PROJECT_FORMAT_VERSION }),
      })
      continue
    }
    if (file.path === MODEL_FILE) {
      const model = objectIn(file) ?? {}
      const { connections, elements, ...kept } = model
      folded.push({
        path: MODEL_FILE,
        text: stableJson({
          ...kept,
          elements: rows(elements).map(elementFromV3),
          relations: relationsFromV3(connections),
        }),
      })
      continue
    }
    // The superseded half of every view. Dropped here, which is what takes it
    // off disk on the first save — see the note at the top of this file.
    if (file.path.endsWith(PLACEMENTS_SUFFIX)) continue
    if (!isDefinition(file.path)) { folded.push(file); continue }

    const definition = objectIn(file)
    // A definition that is not one is left exactly as it is: the reader ignores
    // it either way, and a migration that rewrites what it cannot read is how a
    // folder loses a file somebody was in the middle of.
    if (!definition || typeof definition.id !== 'string' || typeof definition.name !== 'string') {
      folded.push(file)
      continue
    }
    const stem = file.path.slice(DIAGRAMS_FOLDER.length + 1, -'.json'.length)
    const laid = objectIn(byPath.get(`${DIAGRAMS_FOLDER}/${stem}${PLACEMENTS_SUFFIX}`))
    folded.push(...diagramFiles(viewFromV3(definition, laid && {
      placements: rows(laid.placements),
      ...('routes' in laid ? { routes: rows(laid.routes) } : {}),
      ...(laid.needsLayout === true ? { needsLayout: true } : {}),
    }), stem))
  }
  return folded
}

/**
 * The project a folder holds, whichever version wrote it.
 *
 * The dispatch lives here rather than in `folderFormat.ts` because the
 * dependency runs one way: the migration may know the format, and the format
 * may not know the migration. Every reader of a folder — the store, the
 * container, the history — goes through this one door, so there is nowhere a
 * version can be forgotten.
 */
export function openProjectFolder(
  files: readonly FolderFile[], ref: ProjectRef,
): ProjectSnapshot | undefined {
  const now = projectFromFolder(files, ref)
  if (now) return now
  const folded = foldFolderToFormat4(files)
  return folded ? projectFromFolder(folded, ref) : undefined
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
export function migrateSnapshot(project: ProjectSnapshot): ProjectSnapshot {
  return { ...project, model: migrateModel(project.model) }
}
