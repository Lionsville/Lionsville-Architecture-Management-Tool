/**
 * A project as a folder of files, and back.
 *
 * ADR-0003: the working copy is text a person can read and git can diff, one
 * document per thing that changes independently. This file is that format —
 * pure, so the rules can be tested without a filesystem, and the only place
 * that knows the layout:
 *
 * ```
 * project.json                      what it is called and what it holds
 * model.json                        elements and connections (the model's flows)
 * diagrams/<id>.json                what a view is, and what is on it
 * diagrams/<id>.placements.json     where its elements ended up
 * docs/<elementId>.md               an element's description, as prose
 * decisions/[<applicationId>/]NNNN-<slug>.md
 * transitions/NNNN-<slug>.md        a plan, its window and what it touches
 * images/<file>.png | .jpg | .svg   pictures the documents show
 * logos/<key>.svg | .png            uploaded marks, as images
 * ```
 *
 * **Layout is separate from the model** and that is the split the format is
 * for. A drag rewrites one `.placements.json`; a rename rewrites one definition
 * and no coordinates; a deleted placement file means "not laid out yet" rather
 * than a broken project.
 *
 * ADR-0012 §6 took that split into the model as well — a view says what is on
 * it (`members`, `groups`, `lines`) and its geometry says where it ended up —
 * and format 3's two files do not line up with it: a placement row is a member
 * AND a node, a group's box carries its name and colour, and a route row
 * carries both its constraints and its waypoints. So the two shapes meet here,
 * in {@link diagramFiles} and {@link readDiagram}, and the whole of that
 * translation goes at format 4, where the files say what the model says.
 *
 * **What the format normalises, deliberately.** Elements, connections,
 * placements and routes are written in id order, because two people adding an
 * element to the same landscape should not both append to the same line. Order
 * is kept only where it is a decision somebody made: the diagram list, which is
 * the order of the tabs, and it is written out in `project.json`. Decisions are
 * read back in number order within each list, which is the order the page shows
 * them in. And a model carrying an empty `decisions` array comes back without
 * the key, because "no decisions" is a folder with no decision files in it and
 * there is nowhere to write the difference. Everything else round-trips
 * exactly, including the absent-versus-empty distinction on a diagram's routes.
 */
import { ADR_STATUSES } from '../decisions/adr'
import type { Adr } from '../decisions/adr'
import type {
  AspectConfigEntry, DesignConnection, DesignDiagram, DesignElement, DiagramGroup, DiagramMember,
  DocumentImage, DomainGroupRect, EdgeRoute, Geometry, NodeGeometry, Relation, UploadedLogo,
} from '../model'
import { edgeRoutesOf, splitRoutes } from '../model/routes'
import { placedNodes } from '../model/placement'
import type { PlacedNode } from '../model'
import { asConnections, asRelations } from '../model/relations'
import { imageMediaType, isImageFile } from '../model/documentImage'
import type { HostModel } from '../model/fromInterchange'
import type { Transition } from '../model/transition'
import { WORKING_FILE_TYPE } from '../model/hostModel'
import { claimKey, slug } from '../model/keys'
import { adrFileText, adrFromFile, adrPath, DECISIONS_FOLDER } from './adrFile'
import {
  TRANSITIONS_FOLDER, transitionFileText, transitionFromFile, transitionPath,
} from './transitionFile'
import {
  dataUrl, markdownBody, markdownFile, parseJson, readDataUrl, stableJson, textFromBytes,
} from './fileText'
import type { GroupLink, GroupProfile } from './group'
import { groupNameOf, resolveActive } from './project'
import type { ProjectSnapshot, ProjectSummary } from './project'
import type { ProjectRef } from './projectRef'

/**
 * One file in the folder. Text unless it is a bitmap — a PNG has no honest
 * text form, and base64 in a file called `.png` would fool every image viewer
 * on the machine.
 */
export type FolderFile = { path: string; text: string } | { path: string; bytes: Uint8Array }

export const PROJECT_FILE = 'project.json'
export const MODEL_FILE = 'model.json'
export const DIAGRAMS_FOLDER = 'diagrams'
export const DOCS_FOLDER = 'docs'
export const LOGOS_FOLDER = 'logos'
export const IMAGES_FOLDER = 'images'
export const GROUP_FILE = 'group.json'
export { DECISIONS_FOLDER, TRANSITIONS_FOLDER }

/**
 * 3, and the same 3 as the working file's version — the single `.lvarch` is
 * this folder in a zip, so there is one number for one shape rather than two
 * that have to be kept in step.
 */
export const PROJECT_FORMAT_VERSION = 3

/** What may stand as a file name without escaping, quoting or surprising an OS. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function safeName(id: string, taken: Set<string>): string {
  const base = SAFE_NAME.test(id) ? id : slug(id)
  let name = base
  let n = 2
  while (taken.has(name.toLowerCase())) name = `${base}-${n++}`
  taken.add(name.toLowerCase())
  return name
}

/**
 * Where an element's description is filed as prose, or nowhere.
 *
 * Only when the element's id can BE the file name — nothing else maps the file
 * back to the element. Any other element keeps its description in `model.json`,
 * where it is at least safe. Said once, here, so the writer and anybody asking
 * "which file is this description" (`historyPath.ts`) cannot disagree.
 */
export function descriptionPath(elementId: string): string | undefined {
  return SAFE_NAME.test(elementId) ? `${DOCS_FOLDER}/${elementId}.md` : undefined
}

/**
 * The file stem each diagram is written under, by id.
 *
 * Order matters and is the model's: two ids that slug to the same name are
 * told apart by who came first, so the stems are only right when worked out
 * over the whole list, which is why this is a map and not a function of one id.
 */
export function diagramStems(diagrams: readonly { id: string }[]): Map<string, string> {
  const taken = new Set<string>()
  return new Map(diagrams.map((diagram) => [diagram.id, safeName(diagram.id, taken)]))
}

function byPath(a: FolderFile, b: FolderFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

function byId<T extends { id: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

const LOGO_EXTENSIONS: Record<string, string> = { 'image/svg+xml': 'svg', 'image/png': 'png' }
const LOGO_MEDIA_TYPES: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png' }

/** What `project.json` carries. Written by this file, read by this file. */
type ProjectHeader = {
  type: string
  formatVersion: number
  name: string
  groupName: string
  description?: string
  activeDiagramId: string
  /** Diagram ids in tab order — the one list whose order is a decision. */
  diagrams: string[]
  defaults?: { author?: string; aspectConfig?: AspectConfigEntry[] }
  logos?: { key: string; label: string; file?: string; url?: string }[]
  /**
   * What an imported interchange document carried and this tool does not use,
   * kept so the export can hand it back unchanged. In one place rather than
   * spread through the model, because that is all it is: the import's luggage.
   */
  interchange?: { formatVersion?: unknown; adrLinks?: unknown[] }
}

/**
 * One diagram, as the two files it owns: what it IS, and where its elements
 * ended up.
 *
 * Named separately from {@link projectFiles} because this pair is the unit that
 * changes on its own — a drag rewrites the placements and nothing else, and a
 * store that means to write only what moved needs the format to have a word for
 * it. `name` is the file stem, which is the diagram's id wherever the id can be
 * a file name.
 */
export function diagramFiles(diagram: DesignDiagram, name = diagram.id): FolderFile[] {
  const { members, groups, lines, geometry, ...definition } = diagram
  const nameOf = new Map((groups ?? []).map((group) => [group.id, group]))
  const layoutConfig = {
    ...(geometry?.zones !== undefined ? { zones: geometry.zones } : {}),
    ...(geometry?.groups !== undefined
      ? { domainGroups: geometry.groups.map((rect) => asStoredGroup(rect, nameOf)) }
      : {}),
    ...(geometry?.canvas !== undefined ? { canvas: geometry.canvas } : {}),
  }
  const hasRoutes = lines !== undefined || geometry?.routes !== undefined
  return [
    {
      path: `${DIAGRAMS_FOLDER}/${name}.json`,
      text: stableJson(
        Object.keys(layoutConfig).length ? { ...definition, layoutConfig } : definition,
      ),
    },
    // Always written, even empty: a diagram that has no placement file is one
    // whose file was deleted, and that has to mean "lay it out again" rather
    // than "it has no placements", which is a thing a diagram can genuinely be.
    {
      path: `${DIAGRAMS_FOLDER}/${name}.placements.json`,
      text: stableJson({
        ...(geometry?.needsLayout ? { needsLayout: geometry.needsLayout } : {}),
        placements: placedNodes(diagram)
          .slice()
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((placement) => asStoredPlacement(placement, nameOf)),
        ...(hasRoutes
          ? {
            routes: edgeRoutesOf(diagram)
              .slice()
              .sort((a, b) => (a.relationId < b.relationId ? -1 : 1))
              .map(asStoredRoute),
          }
          : {}),
      }),
    },
  ]
}

/**
 * A dashed group's two identities, and where they meet.
 *
 * ADR-0012 §6 gives a group an id of its own, so that renaming one is a line in
 * the definition rather than a rewrite of every row that named it. Format 3 has
 * no such field: the NAME is the key there, on the rectangle and on every
 * placement filed under it. So the ids are **minted on read and folded back on
 * write**, and a file that goes through this build unchanged comes out byte for
 * byte the file that went in.
 *
 * Minted with {@link claimKey}, over the names in the order the file has them —
 * rectangles first, then any name a placement uses that has no rectangle, which
 * format 3 allows and this build still does. The same name therefore always
 * yields the same id, and two names that slug alike are told apart by which
 * came first, exactly as {@link diagramStems} tells two diagram ids apart.
 *
 * **This pair is deleted at format 4**, where a group is written with its id
 * and neither half has anything to do.
 */
function readGroups(
  rects: readonly Record<string, unknown>[], placements: readonly Record<string, unknown>[],
): { groups: DiagramGroup[]; idOf: Map<string, string> } {
  const taken = new Set<string>()
  const idOf = new Map<string, string>()
  const groups: DiagramGroup[] = []
  const claim = (groupName: string, color?: unknown) => {
    if (idOf.has(groupName)) return
    const id = claimKey(groupName, taken)
    idOf.set(groupName, id)
    groups.push({
      id, name: groupName, ...(typeof color === 'string' ? { color } : {}),
    })
  }
  for (const rect of rects) {
    if (typeof rect.name === 'string') claim(rect.name, rect.color)
  }
  for (const placement of placements) {
    if (typeof placement.domainGroup === 'string') claim(placement.domainGroup)
  }
  return { groups, idOf }
}

/**
 * One node, as format 3 files it: a placement row, which is its membership and
 * its coordinates in one object (ADR-0012 §6 is what separates them).
 *
 * The keys are written in the order format 3 had them, so a file that goes
 * through this build unchanged is the bytes that went in — `stableJson` sorts
 * them anyway, and this keeps the two readable side by side.
 */
function asStoredPlacement(
  placement: PlacedNode, nameOf: Map<string, DiagramGroup>,
): Record<string, unknown> {
  const { id, zone, group, ...rest } = placement
  return {
    elementId: id,
    ...(zone !== undefined ? { zone } : {}),
    ...(group !== undefined ? { domainGroup: nameOf.get(group)?.name ?? group } : {}),
    ...rest,
  }
}

function asStoredGroup(
  rect: DomainGroupRect, nameOf: Map<string, DiagramGroup>,
): Record<string, unknown> {
  const { id, ...box } = rect
  const held = nameOf.get(id)
  return {
    name: held?.name ?? id, ...box, ...(held?.color !== undefined ? { color: held.color } : {}),
  }
}

/**
 * A route row's two names for the same thing.
 *
 * The model calls a line's row `relationId`, because that is the list it points
 * into (ADR-0012 §5) and what §6's geometry file will call it. Format 3 called
 * it `connectionId` and a 1.x build still reads it that way, so the name is
 * translated here — the same seam `asConnections` occupies for the model's own
 * list, one file down. Both halves go at format 4.
 */
function asStoredRoute(route: EdgeRoute): Record<string, unknown> {
  const { relationId, ...rest } = route
  return { connectionId: relationId, ...rest }
}

function asEdgeRoute(row: Record<string, unknown>): EdgeRoute {
  const { connectionId, ...rest } = row
  return { relationId: connectionId as string, ...rest } as unknown as EdgeRoute
}

/**
 * What an element is contained BY, under format 3's name for it.
 *
 * ADR-0012 §3 gave containment one field for every kind — a component's
 * application, a function's area, a step's phase, an actor's group — so the
 * name lost the word that described only the first of them. Format 3 knows only
 * `parentApplicationId`, and a 1.x build reads nothing else, so the spelling is
 * translated here: the same seam the dashed groups and the route rows occupy,
 * one function each way, and a folder that goes through this build unchanged
 * comes out byte for byte the folder that went in.
 *
 * **Both halves are deleted at format 4**, where the file says what the model
 * says.
 */
function asStoredParent(element: Record<string, unknown>): Record<string, unknown> {
  const { parentId, ...rest } = element
  return parentId === undefined ? rest : { ...rest, parentApplicationId: parentId }
}

function readStoredParent(row: Record<string, unknown>): Record<string, unknown> {
  const { parentApplicationId, ...rest } = row
  return parentApplicationId === undefined ? rest : { ...rest, parentId: parentApplicationId }
}

/**
 * The project, as files, sorted by path so two saves of the same project are
 * the same list in the same order.
 */
export function projectFiles(project: ProjectSnapshot): FolderFile[] {
  const model = project.model
  const files: FolderFile[] = []

  const filed = new Set<string>()
  const elements = byId(model.elements).map((element) => {
    const explicit = model.explicitFields?.[element.id]
    const description = element.description
    const page = descriptionPath(element.id)
    if (description !== undefined && page) {
      filed.add(element.id)
      files.push({ path: page, text: markdownFile(description) })
    }
    const { description: _filed, ...rest } = element
    return asStoredParent({
      ...(filed.has(element.id) ? rest : element),
      ...(explicit ? { explicit } : {}),
    })
  })

  files.push({
    path: MODEL_FILE,
    // `connections`, not `relations`: format 3 has one kind of line and this is
    // the one place the two names meet (ADR-0012 §11). A relation of any other
    // type is refused here rather than written into a list a 1.x build reads as
    // connections — see `model/relations.ts`.
    text: stableJson({ connections: byId(asConnections(model.relations)), elements }),
  })

  const stems = diagramStems(model.diagrams)
  for (const diagram of model.diagrams) {
    files.push(...diagramFiles(diagram, stems.get(diagram.id)))
  }

  for (const adr of model.decisions ?? []) {
    files.push({ path: adrPath(adr), text: adrFileText(adr) })
  }

  for (const transition of model.transitions ?? []) {
    files.push({ path: transitionPath(transition), text: transitionFileText(transition) })
  }

  files.push(...imageFiles(project.imageLibrary ?? []))

  files.push({ path: PROJECT_FILE, text: stableJson(header(project, files)) })
  return files.sort(byPath)
}

/**
 * The pictures, as files.
 *
 * Unlike the marks, nothing in `project.json` names these: the file name IS the
 * reference, because that is what the markdown holds (ADR-0009). So there is no
 * list to keep in step with the folder, and a picture somebody drops into
 * `images/` by hand is a picture their documents can use immediately.
 *
 * An SVG is written as text and everything else as bytes, which is the rule the
 * marks already follow: an SVG is XML and should diff as XML.
 */
function imageFiles(library: readonly DocumentImage[]): FolderFile[] {
  const files: FolderFile[] = []
  const written = new Set<string>()
  for (const image of library) {
    // A name with a slash in it is not a file in `images/`, and a duplicate
    // would be two entries fighting over one path.
    if (!isImageFile(image.file) || image.file.includes('/') || written.has(image.file)) continue
    const held = readDataUrl(image.url)
    if (!held) continue
    written.add(image.file)
    const path = `${IMAGES_FOLDER}/${image.file}`
    files.push(image.file.toLowerCase().endsWith('.svg')
      ? { path, text: textFromBytes(held.bytes) }
      : { path, bytes: held.bytes })
  }
  return files
}

/** Every picture in the folder, by name. The folder is the whole index. */
function readImages(folder: Folder): DocumentImage[] {
  const images: DocumentImage[] = []
  for (const path of [...folder.keys()].sort()) {
    if (!path.startsWith(`${IMAGES_FOLDER}/`)) continue
    const file = path.slice(IMAGES_FOLDER.length + 1)
    if (file.includes('/')) continue
    const mediaType = imageMediaType(file)
    if (!mediaType) continue
    images.push({ file, url: markFor(folder.get(path)!, mediaType) })
  }
  return images
}

/**
 * The header, and the marks it names.
 *
 * The mark files are pushed as a side effect of building the list that names
 * them, because the two have to agree: a `logos` entry without its file is a
 * broken mark, and a file nothing names is an orphan.
 */
function header(project: ProjectSnapshot, files: FolderFile[]): ProjectHeader {
  const model = project.model
  const names = new Set<string>()
  const logos = project.logoLibrary.map((logo) => {
    const held = readDataUrl(logo.url)
    const extension = held && LOGO_EXTENSIONS[held.mediaType]
    if (!held || !extension) {
      // Not something we can write as an image — a URL somebody typed, or a
      // format this build does not know. It stays in the header as a URL
      // rather than being dropped.
      return { key: logo.key, label: logo.label, url: logo.url }
    }
    const file = `${safeName(logo.key.replace(/^lib:/, '') || 'mark', names)}.${extension}`
    // An SVG is text and is written as text: a mark should diff like the XML it
    // is, and a store that keeps text files as text can leave it alone.
    files.push(extension === 'svg'
      ? { path: `${LOGOS_FOLDER}/${file}`, text: textFromBytes(held.bytes) }
      : { path: `${LOGOS_FOLDER}/${file}`, bytes: held.bytes })
    return { key: logo.key, label: logo.label, file }
  })

  return {
    type: WORKING_FILE_TYPE,
    formatVersion: PROJECT_FORMAT_VERSION,
    name: model.name,
    groupName: groupNameOf(model),
    ...(model.description !== undefined ? { description: model.description } : {}),
    activeDiagramId: project.activeDiagramId,
    diagrams: model.diagrams.map((diagram) => diagram.id),
    ...(model.defaultAuthor !== undefined || model.defaultAspectConfig !== undefined
      ? {
        defaults: {
          ...(model.defaultAuthor !== undefined ? { author: model.defaultAuthor } : {}),
          ...(model.defaultAspectConfig !== undefined ? { aspectConfig: model.defaultAspectConfig } : {}),
        },
      }
      : {}),
    ...(logos.length ? { logos } : {}),
    ...(model.formatVersion !== undefined || model.adrLinks !== undefined
      ? {
        interchange: {
          ...(model.formatVersion !== undefined ? { formatVersion: model.formatVersion } : {}),
          ...(model.adrLinks !== undefined ? { adrLinks: model.adrLinks } : {}),
        },
      }
      : {}),
  }
}

/**
 * Is this a file the format itself writes?
 *
 * The question a store has to be able to answer before it deletes anything. A
 * project folder belongs to the user: a `README.md`, a `.git`, a spreadsheet
 * somebody keeps beside the landscape are all allowed to be there, and a save
 * that tidied them away would be unforgivable. So a store replaces and removes
 * exactly what this grammar matches and leaves the rest of the folder alone.
 *
 * The decision files carry their number in the name for this reason as much as
 * for ordering: `decisions/README.md` does not match, and survives.
 */
export function isFormatPath(path: string): boolean {
  if (path === PROJECT_FILE || path === MODEL_FILE || path === GROUP_FILE) return true
  const parts = path.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) return false
  const [folder, ...rest] = parts
  const name = rest[rest.length - 1]
  if (folder === DIAGRAMS_FOLDER) return rest.length === 1 && name.endsWith('.json')
  if (folder === DOCS_FOLDER) return rest.length === 1 && name.endsWith('.md')
  if (folder === LOGOS_FOLDER) return rest.length === 1 && /\.(svg|png)$/.test(name)
  if (folder === IMAGES_FOLDER) return rest.length === 1 && isImageFile(name)
  if (folder === DECISIONS_FOLDER) return rest.length <= 2 && /^\d{1,6}-.*\.md$/.test(name)
  if (folder === TRANSITIONS_FOLDER) return rest.length === 1 && /^\d{1,6}-.*\.md$/.test(name)
  return false
}

/** A record of the files, by path, for the readers below. */
type Folder = Map<string, FolderFile>

function folderOf(files: readonly FolderFile[]): Folder {
  return new Map(files.map((file) => [file.path, file]))
}

function textAt(folder: Folder, path: string): string | undefined {
  const file = folder.get(path)
  if (!file) return undefined
  return 'text' in file ? file.text : textFromBytes(file.bytes)
}

function jsonAt(folder: Folder, path: string): Record<string, unknown> | undefined {
  const text = textAt(folder, path)
  if (text === undefined) return undefined
  const parsed = parseJson(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined
}

/**
 * Is this a header this build may read?
 *
 * A version it does not know is refused rather than half-read, for the reason
 * `isWorkingFile` gives: a newer format may carry meaning this build would
 * silently drop on its next save. A folder with no version at all is somebody's
 * hand-made project and is read as best we can.
 */
function readableHeader(held: Record<string, unknown> | undefined): ProjectHeader | undefined {
  if (!held) return undefined
  if (held.type !== undefined && held.type !== WORKING_FILE_TYPE) return undefined
  const version = held.formatVersion
  if (version !== undefined && version !== PROJECT_FORMAT_VERSION) return undefined
  return held as ProjectHeader
}

function listOf(held: unknown): Record<string, unknown>[] {
  return Array.isArray(held)
    ? held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    : []
}

/**
 * The summary the picker needs, from `project.json` alone.
 *
 * The point of a header file: listing a working directory reads one small
 * document per project rather than a whole landscape. A project with no
 * diagrams is not listed, for the same reason it does not load — there is
 * nothing to show.
 */
export function projectSummaryFrom(
  text: string, ref: ProjectRef, updatedAt?: string,
): ProjectSummary | undefined {
  const parsed = parseJson(text)
  const held = readableHeader(
    parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined,
  )
  if (!held || !Array.isArray(held.diagrams) || held.diagrams.length === 0) return undefined
  return {
    ref,
    name: typeof held.name === 'string' ? held.name : ref.project,
    groupName: typeof held.groupName === 'string' ? held.groupName : '',
    ...(updatedAt ? { updatedAt } : {}),
  }
}

function readDiagram(folder: Folder, name: string): DesignDiagram | undefined {
  const definition = jsonAt(folder, `${DIAGRAMS_FOLDER}/${name}.json`)
  if (!definition || typeof definition.id !== 'string' || typeof definition.name !== 'string') {
    return undefined
  }
  const laid = jsonAt(folder, `${DIAGRAMS_FOLDER}/${name}.placements.json`)
  const rows = listOf(laid?.placements).filter((row) => typeof row.elementId === 'string')
  const { layoutConfig, ...rest } = definition
  const held = layoutConfig as Record<string, unknown> | undefined
  const rects = listOf(held?.domainGroups)
  const { groups, idOf } = readGroups(rects, rows)

  // A placement row is a member AND a node, and format 3 keeps them in one
  // object; ADR-0012 §6 is what takes them apart.
  const members: DiagramMember[] = rows.map((row) => ({
    id: row.elementId as string,
    ...(typeof row.zone === 'string' ? { zone: row.zone as DiagramMember['zone'] } : {}),
    ...(typeof row.domainGroup === 'string' ? { group: idOf.get(row.domainGroup) } : {}),
  }))
  const nodes: NodeGeometry[] = rows.map((row) => ({
    id: row.elementId as string,
    x: typeof row.x === 'number' ? row.x : 0,
    y: typeof row.y === 'number' ? row.y : 0,
    ...(typeof row.width === 'number' ? { width: row.width } : {}),
    ...(typeof row.height === 'number' ? { height: row.height } : {}),
  }))
  const stored = laid && 'routes' in laid
    ? listOf(laid.routes).filter((row) => typeof row.connectionId === 'string').map(asEdgeRoute)
    : undefined
  const { lines, routes } = stored ? splitRoutes(stored) : { lines: undefined, routes: undefined }

  const geometry: Geometry = { nodes }
  // No placement file at all: somebody deleted it, or a hand-made folder never
  // had one. Either way the geometry is not a decision anybody made yet.
  if (laid?.needsLayout === true || !laid) geometry.needsLayout = true
  if (held?.canvas !== undefined) geometry.canvas = held.canvas as Geometry['canvas']
  if (held?.zones !== undefined) geometry.zones = held.zones as Geometry['zones']
  if (rects.length) {
    geometry.groups = rects.map(({ name: groupName, color: _color, ...box }) => ({
      id: idOf.get(groupName as string)!, ...box,
    })) as unknown as DomainGroupRect[]
  }
  // Present-versus-absent survives: an empty `routes` key in the file is a
  // diagram somebody emptied, and comes back as one.
  if (stored) geometry.routes = routes ?? []

  return {
    ...(rest as unknown as Omit<DesignDiagram, 'members' | 'geometry'>),
    ...(groups.length ? { groups } : {}),
    ...(lines ? { lines } : {}),
    members,
    geometry,
  }
}

function readElements(folder: Folder): {
  elements: DesignElement[]
  explicitFields?: HostModel['explicitFields']
} {
  const held = jsonAt(folder, MODEL_FILE)
  const explicitFields: NonNullable<HostModel['explicitFields']> = {}
  const elements = listOf(held?.elements).flatMap((row) => {
    if (typeof row.id !== 'string') return []
    const { explicit, ...rest } = row
    if (explicit && typeof explicit === 'object') {
      explicitFields[row.id] = explicit as NonNullable<HostModel['explicitFields']>[string]
    }
    const prose = textAt(folder, `${DOCS_FOLDER}/${row.id}.md`)
    return [{
      ...(readStoredParent(rest) as unknown as DesignElement),
      ...(prose !== undefined ? { description: markdownBody(prose) } : {}),
    }]
  })
  return {
    elements,
    ...(Object.keys(explicitFields).length ? { explicitFields } : {}),
  }
}

/** Every line the file holds, as what format 3 says it is: a flow. */
function readRelations(folder: Folder): Relation[] {
  return asRelations(listOf(jsonAt(folder, MODEL_FILE)?.connections)
    .filter((row) => typeof row.id === 'string') as unknown as DesignConnection[])
}

/**
 * Every decision file in the folder, in the order the pages want them: by list,
 * then by number. A file that is not a record is skipped rather than refused —
 * the folder belongs to the user and may have a `README.md` in it.
 */
export function readDecisions(files: readonly FolderFile[], within = ''): Adr[] {
  const prefix = within ? `${within}/${DECISIONS_FOLDER}/` : `${DECISIONS_FOLDER}/`
  const found: Adr[] = []
  for (const file of files) {
    if (!file.path.startsWith(prefix) || !file.path.endsWith('.md')) continue
    if (!('text' in file)) continue
    const adr = adrFromFile(file.text, file.path.slice(within ? within.length + 1 : 0))
    if (adr && ADR_STATUSES.includes(adr.status)) found.push(adr)
  }
  return found.sort((a, b) =>
    (a.applicationId ?? '').localeCompare(b.applicationId ?? '') || a.number - b.number)
}

/**
 * Every plan in the folder, in number order (ADR-0009).
 *
 * Flat, and skipping what is not one — a `README.md` in `transitions/` is
 * somebody's note about the plans, not a plan.
 */
export function readTransitions(files: readonly FolderFile[]): Transition[] {
  const prefix = `${TRANSITIONS_FOLDER}/`
  const found: Transition[] = []
  for (const file of files) {
    if (!file.path.startsWith(prefix) || !file.path.endsWith('.md')) continue
    if (!('text' in file)) continue
    const transition = transitionFromFile(file.text, file.path)
    if (transition) found.push(transition)
  }
  return found.sort((a, b) => a.number - b.number)
}

function readLogos(folder: Folder, held: ProjectHeader): UploadedLogo[] {
  const named = new Set<string>()
  const library: UploadedLogo[] = []
  for (const entry of held.logos ?? []) {
    if (typeof entry?.key !== 'string') continue
    const label = typeof entry.label === 'string' ? entry.label : entry.key
    if (typeof entry.url === 'string') {
      library.push({ key: entry.key, label, url: entry.url })
      continue
    }
    if (typeof entry.file !== 'string') continue
    const path = `${LOGOS_FOLDER}/${entry.file}`
    const file = folder.get(path)
    if (!file) continue
    named.add(path)
    const mediaType = LOGO_MEDIA_TYPES[entry.file.split('.').pop() ?? ''] ?? 'application/octet-stream'
    library.push({ key: entry.key, label, url: markFor(file, mediaType) })
  }

  // A mark dropped into `logos/` by hand is simply there — the same rule the
  // folder store follows for a project dropped into the working directory.
  const extras = [...folder.keys()]
    .filter((path) => path.startsWith(`${LOGOS_FOLDER}/`) && !named.has(path))
    .sort()
  for (const path of extras) {
    const name = path.slice(LOGOS_FOLDER.length + 1)
    const extension = name.split('.').pop() ?? ''
    const mediaType = LOGO_MEDIA_TYPES[extension]
    if (!mediaType) continue
    const label = name.slice(0, -(extension.length + 1))
    library.push({ key: `lib:${slug(label)}`, label, url: markFor(folder.get(path)!, mediaType) })
  }
  return library
}

function markFor(file: FolderFile, mediaType: string): string {
  return 'bytes' in file
    ? dataUrl(mediaType, file.bytes)
    : dataUrl(mediaType, new TextEncoder().encode(file.text))
}

/**
 * The project a folder holds, or `undefined` when it does not hold one.
 *
 * `ref` comes from where the folder IS and not from anything inside it: a
 * project moved in the file manager is the project at its new address, which is
 * what anybody moving it would expect.
 */
export function projectFromFolder(
  files: readonly FolderFile[], ref: ProjectRef,
): ProjectSnapshot | undefined {
  const folder = folderOf(files)
  const held = readableHeader(jsonAt(folder, PROJECT_FILE))
  if (!held) return undefined

  const names = [...folder.keys()]
    .filter((path) => path.startsWith(`${DIAGRAMS_FOLDER}/`) && path.endsWith('.json')
      && !path.endsWith('.placements.json'))
    .map((path) => path.slice(DIAGRAMS_FOLDER.length + 1, -'.json'.length))
    .sort()

  // The header says the order; the folder says what is there. A diagram file
  // somebody added by hand comes last rather than not at all.
  const byName = new Map(names.map((name) => [name, readDiagram(folder, name)]))
  const ordered: DesignDiagram[] = []
  const seen = new Set<string>()
  for (const id of Array.isArray(held.diagrams) ? held.diagrams : []) {
    for (const [name, diagram] of byName) {
      if (diagram?.id !== id || seen.has(name)) continue
      seen.add(name)
      ordered.push(diagram)
      break
    }
  }
  for (const [name, diagram] of byName) {
    if (diagram && !seen.has(name)) ordered.push(diagram)
  }
  if (ordered.length === 0) return undefined

  const decisions = readDecisions(files)
  const transitions = readTransitions(files)
  const { elements, explicitFields } = readElements(folder)
  const model: HostModel = {
    name: typeof held.name === 'string' ? held.name : ref.project,
    customerName: typeof held.groupName === 'string' ? held.groupName : '',
    ...(typeof held.description === 'string' ? { description: held.description } : {}),
    ...(held.defaults?.author !== undefined ? { defaultAuthor: held.defaults.author } : {}),
    ...(held.defaults?.aspectConfig !== undefined
      ? { defaultAspectConfig: held.defaults.aspectConfig } : {}),
    ...(held.interchange?.formatVersion !== undefined
      ? { formatVersion: held.interchange.formatVersion } : {}),
    ...(held.interchange?.adrLinks !== undefined ? { adrLinks: held.interchange.adrLinks } : {}),
    ...(decisions.length ? { decisions } : {}),
    ...(transitions.length ? { transitions } : {}),
    ...(explicitFields ? { explicitFields } : {}),
    elements,
    relations: readRelations(folder),
    diagrams: ordered,
  }

  // Absent rather than empty when there are none, so a project with no
  // pictures round-trips to exactly the snapshot it came from.
  const images = readImages(folder)

  return {
    ref,
    model,
    activeDiagramId: resolveActive(model, typeof held.activeDiagramId === 'string'
      ? held.activeDiagramId : undefined),
    logoLibrary: readLogos(folder, held),
    ...(images.length ? { imageLibrary: images } : {}),
  }
}

/**
 * A group's own record, as files.
 *
 * `group.json` beside the project folders, and the group's decisions in a
 * `decisions/` folder of its own — the same shape as a project's, because a
 * decision record is a decision record wherever it is filed.
 *
 * The path is not written into the file: a group is where its folder is, which
 * is the same rule as the project ref and for the same reason. A group folder
 * moved or renamed is the group at its new address.
 */
export function groupFiles(profile: GroupProfile): FolderFile[] {
  const files: FolderFile[] = [{
    path: GROUP_FILE,
    text: stableJson({
      name: profile.name,
      ...(profile.client !== undefined ? { client: profile.client } : {}),
      ...(profile.description !== undefined ? { description: profile.description } : {}),
      ...(profile.links !== undefined ? { links: profile.links } : {}),
    }),
  }]
  for (const adr of profile.decisions ?? []) {
    files.push({ path: adrPath(adr), text: adrFileText(adr) })
  }
  return files.sort(byPath)
}

/**
 * The profile a group folder holds, or `undefined` when there is no record.
 *
 * A group with projects and no `group.json` is still a group — it is derived
 * from what is filed under it — so "no profile" is an ordinary answer and not
 * a failure.
 */
export function groupFromFolder(
  files: readonly FolderFile[], group: string,
): GroupProfile | undefined {
  const held = jsonAt(folderOf(files), GROUP_FILE)
  const decisions = readDecisions(files)
  if (!held && decisions.length === 0) return undefined
  const links = Array.isArray(held?.links)
    ? held.links.filter((link): link is GroupLink =>
      !!link && typeof link === 'object'
      && typeof (link as GroupLink).label === 'string' && typeof (link as GroupLink).url === 'string')
    : undefined
  return {
    group,
    name: typeof held?.name === 'string' ? held.name : '',
    ...(typeof held?.client === 'string' ? { client: held.client } : {}),
    ...(typeof held?.description === 'string' ? { description: held.description } : {}),
    ...(links ? { links } : {}),
    ...(decisions.length ? { decisions } : {}),
  }
}
