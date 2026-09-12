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
 * model.json                        elements and relations
 * diagrams/<id>.json                what a view is, and what is on it
 * diagrams/<id>.geometry.json       where its elements ended up
 * docs/<elementId>.md               an element's description, as prose
 * decisions/[<applicationId>/]NNNN-<slug>.md
 * transitions/NNNN-<slug>.md        a plan, its window and what it touches
 * images/<file>.png | .jpg | .svg   pictures the documents show
 * logos/<key>.svg | .png            uploaded marks, as images
 * ```
 *
 * **The file says what the model says.** That is what format 4 is: the three
 * folds this file used to carry — connections against typed relations,
 * placements against members plus geometry, the retired kinds against an
 * application and a band — are gone, and with them every refusal that existed
 * because the model could say more than the file could hold. What is left is a
 * writer and a reader that name the same fields the model does, so a person
 * reading `model.json` is reading the model. `projects/migrate3to4.ts` is the
 * last reader of format 3 and the only place that still knows those spellings.
 *
 * **Layout is separate from the model** and that is the split the format is
 * for (ADR-0012 §6). A drag rewrites one `.geometry.json`; a rename rewrites
 * one definition and no coordinates; a deleted geometry file means "not laid
 * out yet" — and, since format 4, the view is laid out again from a membership
 * list that is still complete, because what is ON a view is the definition's.
 *
 * **What the format normalises, deliberately.** Elements, relations, members
 * and routes are written in id order, because two people adding an
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
  AspectConfigEntry, DesignDiagram, DesignElement, DiagramGroup, DiagramLine, DiagramMember,
  DocumentImage, DomainGroupRect, Geometry, NodeGeometry, Relation, RouteGeometry, UploadedLogo,
} from '../model'
import { imageMediaType, isImageFile } from '../model/documentImage'
import type { HostModel } from '../model/fromInterchange'
import type { Transition } from '../model/transition'
import { WORKING_FILE_TYPE } from '../model/hostModel'
import { slug } from '../model/keys'
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
 * 4, and the same 4 as the working file's version — the single `.lvarch` is
 * this folder in a zip, so there is one number for one shape rather than two
 * that have to be kept in step.
 *
 * It turned from 3 the moment the model stopped fitting in it (ADR-0012 §11,
 * and the rule on formats at the top of `docs/plan-2.0.0.md`): 2.x breaks the
 * format as often as the model needs it to, as long as every older version
 * opens and migrates. An older build meeting one of these sees no project,
 * which is the same honest answer `isWorkingFile` gives a file it does not know.
 */
export const PROJECT_FORMAT_VERSION = 4

/**
 * The second half of a view's pair of files: where it ended up.
 *
 * Named rather than spelled twice, because two readers have to agree about it —
 * this file's, and the one that lists a folder's diagrams and has to tell a
 * definition from its geometry.
 */
export const GEOMETRY_SUFFIX = '.geometry.json'

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

/** The same rule for the two lists keyed by a relation rather than by an id. */
function byRelation<T extends { relationId: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.relationId < b.relationId ? -1 : a.relationId > b.relationId ? 1 : 0))
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
  return [
    {
      path: `${DIAGRAMS_FOLDER}/${name}.json`,
      text: stableJson({
        ...definition,
        members: byId(members),
        ...(groups !== undefined ? { groups: byId(groups) } : {}),
        ...(lines !== undefined ? { lines: byRelation(lines) } : {}),
      }),
    },
    // Always written, even empty: a diagram that has no geometry file is one
    // whose file was deleted, and that has to mean "lay it out again" rather
    // than "nothing has coordinates", which is a thing a diagram can genuinely
    // be. What is ON the view survives that deletion either way — it is in the
    // definition, which is the point of the split.
    {
      path: `${DIAGRAMS_FOLDER}/${name}${GEOMETRY_SUFFIX}`,
      text: stableJson({
        ...(geometry.needsLayout ? { needsLayout: geometry.needsLayout } : {}),
        ...(geometry.canvas !== undefined ? { canvas: geometry.canvas } : {}),
        ...(geometry.zones !== undefined ? { zones: geometry.zones } : {}),
        nodes: byId(geometry.nodes),
        ...(geometry.groups !== undefined ? { groups: byId(geometry.groups) } : {}),
        ...(geometry.routes !== undefined ? { routes: byRelation(geometry.routes) } : {}),
      }),
    },
  ]
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
    return {
      ...(filed.has(element.id) ? rest : element),
      ...(explicit ? { explicit } : {}),
    }
  })

  files.push({
    path: MODEL_FILE,
    text: stableJson({ elements, relations: byId(model.relations) }),
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
 *
 * It is a **grammar and not a list**, which is what lets a superseded file
 * leave a folder: a name this format has stopped writing but that still matches
 * the shape is no longer among the files a save hands over, so the same rule
 * that removes a deleted diagram removes it. The format-4 migration relies on
 * exactly that, and says so (`migrate3to4.ts`).
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

function headerOf(held: Record<string, unknown> | undefined): ProjectHeader | undefined {
  if (!held) return undefined
  if (held.type !== undefined && held.type !== WORKING_FILE_TYPE) return undefined
  return held as ProjectHeader
}

/**
 * Which version a folder is written in, or `undefined` when it is not one this
 * build can get a project out of at all.
 *
 * Two different refusals, and they are not symmetrical. A version this build is
 * **older** than is refused rather than half-read, for the reason
 * `isWorkingFile` gives: it may carry meaning this build would silently drop on
 * its next save. A version this build is **newer** than is not a refusal at
 * all — it is a folder to migrate, which is what `migrate3to4.ts` is for. A
 * folder with no version is somebody's hand-made project and is read as best we
 * can, so it answers with the version this build writes.
 */
export function folderFormatVersion(text: string): number | undefined {
  const parsed = parseJson(text)
  const held = headerOf(
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : undefined,
  )
  if (!held) return undefined
  const version = held.formatVersion
  if (version === undefined) return PROJECT_FORMAT_VERSION
  return typeof version === 'number' && version <= PROJECT_FORMAT_VERSION ? version : undefined
}

/**
 * Is this a header this build reads *as it stands*, rather than one it would
 * have to migrate first? {@link folderFormatVersion} is the wider question.
 */
function readableHeader(held: Record<string, unknown> | undefined): ProjectHeader | undefined {
  const header = headerOf(held)
  if (!header) return undefined
  const version = header.formatVersion
  if (version !== undefined && version !== PROJECT_FORMAT_VERSION) return undefined
  return header
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
 *
 * The picker lists a folder this build would have to migrate, because the name
 * and the group are in the same three fields in every version of the header,
 * and a project you cannot see is a project you cannot ask to be migrated.
 */
export function projectSummaryFrom(
  text: string, ref: ProjectRef, updatedAt?: string,
): ProjectSummary | undefined {
  const parsed = parseJson(text)
  const held = folderFormatVersion(text) === undefined ? undefined : headerOf(
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
  const laid = jsonAt(folder, `${DIAGRAMS_FOLDER}/${name}${GEOMETRY_SUFFIX}`)
  const { members, groups, lines, ...rest } = definition

  const geometry: Geometry = {
    nodes: listOf(laid?.nodes).filter((row) => typeof row.id === 'string') as unknown as NodeGeometry[],
  }
  // No geometry file at all: somebody deleted it, or a hand-made folder never
  // had one. Either way the geometry is not a decision anybody made yet — and
  // the view is still a complete list of what is on it.
  if (laid?.needsLayout === true || !laid) geometry.needsLayout = true
  if (laid?.canvas !== undefined) geometry.canvas = laid.canvas as Geometry['canvas']
  if (laid?.zones !== undefined) geometry.zones = laid.zones as Geometry['zones']
  // Present-versus-absent survives on both lists: an empty `routes` key in the
  // file is a diagram somebody emptied, and comes back as one.
  if (laid && 'groups' in laid) {
    geometry.groups = listOf(laid.groups)
      .filter((row) => typeof row.id === 'string') as unknown as DomainGroupRect[]
  }
  if (laid && 'routes' in laid) {
    geometry.routes = listOf(laid.routes)
      .filter((row) => typeof row.relationId === 'string') as unknown as RouteGeometry[]
  }

  return {
    ...(rest as unknown as Omit<DesignDiagram, 'members' | 'groups' | 'lines' | 'geometry'>),
    ...('groups' in definition
      ? { groups: listOf(groups).filter((row) => typeof row.id === 'string') as unknown as DiagramGroup[] }
      : {}),
    ...('lines' in definition
      ? { lines: listOf(lines).filter((row) => typeof row.relationId === 'string') as unknown as DiagramLine[] }
      : {}),
    members: listOf(members).filter((row) => typeof row.id === 'string') as unknown as DiagramMember[],
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
      ...(rest as unknown as DesignElement),
      ...(prose !== undefined ? { description: markdownBody(prose) } : {}),
    }]
  })
  return {
    elements,
    ...(Object.keys(explicitFields).length ? { explicitFields } : {}),
  }
}

/** Every row that joins two elements, of whatever type it says it is. */
function readRelations(folder: Folder): Relation[] {
  return listOf(jsonAt(folder, MODEL_FILE)?.relations)
    .filter((row) => typeof row.id === 'string') as unknown as Relation[]
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
      && !path.endsWith(GEOMETRY_SUFFIX))
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
