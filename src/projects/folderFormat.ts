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
 * model.json                        elements and connections
 * diagrams/<id>.json                what a diagram is
 * diagrams/<id>.placements.json     where its elements ended up
 * docs/<elementId>.md               an element's description, as prose
 * decisions/[<applicationId>/]NNNN-<slug>.md
 * logos/<key>.svg | .png            uploaded marks, as images
 * ```
 *
 * **Layout is separate from the model** and that is the split the format is
 * for. A drag rewrites one `.placements.json`; a rename rewrites one definition
 * and no coordinates; a deleted placement file means "not laid out yet" rather
 * than a broken project.
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
  AspectConfigEntry, DesignConnection, DesignDiagram, DesignElement, DiagramPlacement, EdgeRoute,
  UploadedLogo,
} from '../model'
import type { HostModel } from '../model/fromInterchange'
import { WORKING_FILE_TYPE } from '../model/hostModel'
import { slug } from '../model/keys'
import { adrFileText, adrFromFile, adrPath, DECISIONS_FOLDER } from './adrFile'
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
export const GROUP_FILE = 'group.json'
export { DECISIONS_FOLDER }

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
    // A description is filed as prose only when the element's id can BE the
    // file name — nothing else maps the file back to the element. Anything
    // else keeps its description in `model.json`, where it is at least safe.
    if (description !== undefined && SAFE_NAME.test(element.id)) {
      filed.add(element.id)
      files.push({ path: `${DOCS_FOLDER}/${element.id}.md`, text: markdownFile(description) })
    }
    const { description: _filed, ...rest } = element
    return {
      ...(filed.has(element.id) ? rest : element),
      ...(explicit ? { explicit } : {}),
    }
  })

  files.push({
    path: MODEL_FILE,
    text: stableJson({ connections: byId(model.connections), elements }),
  })

  const diagramNames = new Set<string>()
  for (const diagram of model.diagrams) {
    const name = safeName(diagram.id, diagramNames)
    const { placements, edgeRoutes, needsLayout, ...definition } = diagram
    files.push({ path: `${DIAGRAMS_FOLDER}/${name}.json`, text: stableJson(definition) })
    // Always written, even empty: a diagram that has no placement file is one
    // whose file was deleted, and that has to mean "lay it out again" rather
    // than "it has no placements", which is a thing a diagram can genuinely be.
    files.push({
      path: `${DIAGRAMS_FOLDER}/${name}.placements.json`,
      text: stableJson({
        ...(needsLayout ? { needsLayout } : {}),
        placements: [...placements].sort((a, b) => (a.elementId < b.elementId ? -1 : 1)),
        ...(edgeRoutes
          ? { routes: [...edgeRoutes].sort((a, b) => (a.connectionId < b.connectionId ? -1 : 1)) }
          : {}),
      }),
    })
  }

  for (const adr of model.decisions ?? []) {
    files.push({ path: adrPath(adr), text: adrFileText(adr) })
  }

  files.push({ path: PROJECT_FILE, text: stableJson(header(project, files)) })
  return files.sort(byPath)
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
  if (folder === DECISIONS_FOLDER) return rest.length <= 2 && /^\d{1,6}-.*\.md$/.test(name)
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
  const placements = listOf(laid?.placements)
    .filter((row) => typeof row.elementId === 'string') as unknown as DiagramPlacement[]
  const routes = laid && 'routes' in laid
    ? listOf(laid.routes).filter((row) => typeof row.connectionId === 'string') as unknown as EdgeRoute[]
    : undefined
  return {
    ...(definition as unknown as Omit<DesignDiagram, 'placements'>),
    // A missing placement file is a diagram nobody has laid out yet, not a
    // broken one: the editor lays it out and saves the result.
    placements,
    ...(routes ? { edgeRoutes: routes } : {}),
    // No file at all: somebody deleted it, or a hand-made folder never had
    // one. Either way the geometry is not a decision anybody made yet.
    ...(laid?.needsLayout === true || !laid ? { needsLayout: true } : {}),
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

function readConnections(folder: Folder): DesignConnection[] {
  return listOf(jsonAt(folder, MODEL_FILE)?.connections)
    .filter((row) => typeof row.id === 'string') as unknown as DesignConnection[]
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
    ...(explicitFields ? { explicitFields } : {}),
    elements,
    connections: readConnections(folder),
    diagrams: ordered,
  }

  return {
    ref,
    model,
    activeDiagramId: resolveActive(model, typeof held.activeDiagramId === 'string'
      ? held.activeDiagramId : undefined),
    logoLibrary: readLogos(folder, held),
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
    ...(typeof held?.description === 'string' ? { description: held.description } : {}),
    ...(links ? { links } : {}),
    ...(decisions.length ? { decisions } : {}),
  }
}
