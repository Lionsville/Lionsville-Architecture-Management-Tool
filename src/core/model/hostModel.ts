/**
 * The pure side of the shell: the two functions that land a batch from the
 * editor on the model, and the shapes by which the shell recognises files.
 *
 * They live here and not in a component because they can be tested apart from
 * React and apart from the browser — `hostModel.test.ts` does exactly that. The
 * shell holds the state, the storage and the saving; only arithmetic lives here.
 */
import { hasRouteContent, isTempId } from '@lionsville/solution-design'
import type {
  DesignDiagram, DiagramContentBatch, DiagramSettings, UploadedLogo,
} from '@lionsville/solution-design'
import type { HostModel, InterchangeDoc } from './fromInterchange'
import { claimKey } from './keys'

/**
 * The working file: everything, including geometry and styling.
 *
 * A fresh definition, not a lineage. The files this tool wrote under its
 * previous name are not read — that was decided deliberately, with the rename,
 * rather than by neglect, and it is why there is no list of old tags
 * here and no migration behind it. A tool still finding its shape pays for
 * compatibility on every subsequent change; a tool with users pays for breaking
 * it. This one has no users yet, so the cheap moment is now.
 *
 * What the version is *for*, then, is the next change rather than the last one.
 * `WORKING_FILE_VERSIONS` is exactly the list {@link isWorkingFile} accepts, so
 * a file from a later version of this tool is refused rather than half-read —
 * which is the honest failure, because a newer version's file may carry meaning
 * this build would silently drop.
 */
export type WorkingFile = {
  type: typeof WORKING_FILE_TYPE
  version: WorkingFileVersion
  model: HostModel
  activeDiagramId?: string
  /** The uploaded logo library (data URLs). Absent when nothing was uploaded. */
  logoLibrary?: UploadedLogo[]
}

/**
 * What a working file calls itself on disk.
 *
 * Never shown to anybody: this is the discriminator a reader checks before
 * trusting the rest of the JSON. It names the tool, not a customer and not a
 * document type, because the tool is the thing that guarantees the shape.
 */
export const WORKING_FILE_TYPE = 'lionsville-architecture'

/**
 * The extension a working file is written with.
 *
 * One extension, not two words with a dot between them. The old
 * `.werkbestand.json` was a double extension: Windows cannot reliably associate
 * one, and the OS shows it as a `.json` file that any other program is welcome
 * to claim.
 *
 * Deliberately not `.json` either, though the contents are JSON today. The
 * container is allowed to stop being a single JSON file later — the uploaded
 * logo library is already data URLs embedded in the document, and a zip is the
 * obvious next step — and promising JSON in the extension turns that into a
 * breaking change instead of an implementation detail.
 */
export const WORKING_FILE_EXTENSION = '.lvarch'

export type WorkingFileVersion = 1

/** What this shell can read. Saving always happens in the newest. */
export const WORKING_FILE_VERSIONS: WorkingFileVersion[] = [1]
export const WORKING_FILE_VERSION: WorkingFileVersion = 1

/** tempId → permanent key, built up across flushes. */
export type Aliases = { elements: Map<string, string>; connections: Map<string, string> }

export function isWorkingFile(x: unknown): x is WorkingFile {
  if (!x || typeof x !== 'object') return false
  const file = x as WorkingFile
  if (file.type !== WORKING_FILE_TYPE) return false
  // A file without a version never existed (this shell always writes one), so an
  // unknown version is a file from the future and not an old file: refusing is
  // then more honest than half-reading it.
  return WORKING_FILE_VERSIONS.includes(file.version)
}

/** The uploaded logos from a working file; absent when nothing was uploaded. */
export function workingFileLogoLibrary(file: WorkingFile): UploadedLogo[] {
  return Array.isArray(file.logoLibrary) ? file.logoLibrary : []
}

export function isInterchange(x: unknown): x is InterchangeDoc {
  return !!x && typeof x === 'object' && 'formatVersion' in (x as object) && 'elements' in (x as object)
}

/**
 * Turn new (tmp) ids in a batch into permanent keys, and add the aliases found
 * to the maps passed in. Elements get a slug of their name; connections get a
 * c# id, because in the interchange format they carry no key.
 */
export function rekeyBatch(
  batch: DiagramContentBatch,
  model: HostModel,
  aliases: Aliases,
): DiagramContentBatch {
  const taken = new Set<string>([
    ...model.elements.map((e) => e.id),
    ...model.diagrams.map((d) => d.id),
    ...aliases.elements.values(),
  ])
  let connSeq = model.connections.length + aliases.connections.size
  const el = (id: string | undefined): string | undefined => {
    if (id == null || !isTempId(id)) return id
    let real = aliases.elements.get(id)
    if (!real) {
      const name = batch.elements.find((e) => e.id === id)?.name ?? 'element'
      real = claimKey(name, taken)
      aliases.elements.set(id, real)
    }
    return real
  }
  const conn = (id: string): string => {
    if (!isTempId(id)) return id
    let real = aliases.connections.get(id)
    if (!real) {
      real = `c#${++connSeq}-${Date.now().toString(36)}`
      aliases.connections.set(id, real)
    }
    return real
  }
  return {
    ...batch,
    elements: batch.elements.map((e) => ({
      ...e, id: el(e.id)!, parentApplicationId: el(e.parentApplicationId),
    })),
    deletedElementIds: batch.deletedElementIds.map((id) => el(id)!),
    connections: batch.connections.map((c) => ({
      ...c, id: conn(c.id), sourceId: el(c.sourceId)!, targetId: el(c.targetId)!,
    })),
    deletedConnectionIds: batch.deletedConnectionIds.map(conn),
    placements: batch.placements.map((p) => ({ ...p, elementId: el(p.elementId)! })),
    removedPlacementElementIds: batch.removedPlacementElementIds.map((id) => el(id)!),
    edgeRoutes: batch.edgeRoutes.map((r) => ({ ...r, connectionId: conn(r.connectionId) })),
  }
}

/**
 * Apply a (re-keyed) batch to the model. Batches are cumulative and idempotent
 * (see the package README): upserts repeat until the model reflects them,
 * placements are always the complete set for that diagram.
 */
export function applyBatch(model: HostModel, b: DiagramContentBatch): HostModel {
  const deletedEl = new Set(b.deletedElementIds)
  const deletedConn = new Set(b.deletedConnectionIds)

  const elements = [
    ...model.elements.filter((e) => !deletedEl.has(e.id) && !b.elements.some((u) => u.id === e.id)),
    ...b.elements.filter((e) => !deletedEl.has(e.id)),
  ]
  const elIds = new Set(elements.map((e) => e.id))

  const connections = [
    ...model.connections.filter((c) => !deletedConn.has(c.id) && !b.connections.some((u) => u.id === c.id)),
    ...b.connections.filter((c) => !deletedConn.has(c.id)),
  ].filter((c) => elIds.has(c.sourceId) && elIds.has(c.targetId))
  const connIds = new Set(connections.map((c) => c.id))

  const removedPlacement = new Set(b.removedPlacementElementIds)
  const diagrams = model.diagrams.filter(orphanFilter(deletedEl, elIds)).map((d) => {
    // deleted elements disappear from every diagram
    let placements = d.placements.filter((p) => elIds.has(p.elementId))
    let edgeRoutes = (d.edgeRoutes ?? []).filter((r) => connIds.has(r.connectionId))
    if (d.id !== b.diagramId) {
      return { ...d, placements, edgeRoutes }
    }
    placements = b.placements.filter((p) => elIds.has(p.elementId) && !removedPlacement.has(p.elementId))
    for (const route of b.edgeRoutes) {
      edgeRoutes = edgeRoutes.filter((r) => r.connectionId !== route.connectionId)
      // One definition of "this route has content" — one without is the delete
      // marker; a pinned empty route stays put.
      if (hasRouteContent(route)) edgeRoutes.push(route)
    }
    return {
      ...d,
      placements,
      edgeRoutes,
      ...(b.layoutConfig !== undefined ? { layoutConfig: b.layoutConfig } : {}),
      ...(b.autoRoute !== undefined ? { autoRoute: b.autoRoute } : {}),
    }
  })

  return { ...model, elements, connections, diagrams }
}

/**
 * A container diagram belongs to one application. If that application leaves the
 * model, what remains otherwise is a diagram with an empty inside, a tab named
 * after something that no longer exists, and a breadcrumb pointing nowhere.
 *
 * Only when THIS batch removes the application, and not the moment it is
 * missing: a model in which a diagram points at an unknown element is a fault
 * you want to be able to see, and quietly tidying it away on the first change
 * that comes along is precisely what makes it impossible to find.
 */
function orphanFilter(
  deleted: ReadonlySet<string>,
  alive: ReadonlySet<string>,
): (d: HostModel['diagrams'][number]) => boolean {
  return (d) => {
    if (d.kind !== 'container' || !d.applicationElementId) return true
    return !(deleted.has(d.applicationElementId) && !alive.has(d.applicationElementId))
  }
}

/**
 * Diagram management from the editor's tab menu. Three pure steps on the model;
 * the shell picks which diagram is active afterwards and shows the confirmation
 * for deleting.
 */

export function renameDiagram(model: HostModel, diagramId: string, name: string): HostModel {
  const trimmed = name.trim()
  if (!trimmed) return model
  return {
    ...model,
    diagrams: model.diagrams.map((d) => (d.id === diagramId && d.name !== trimmed ? { ...d, name: trimmed } : d)),
  }
}

/**
 * Apply a diagram's settings: its name and everything about how it presents
 * itself — the exported title block, and which maturity columns its
 * applications carry.
 *
 * The settings are the whole answer, not a patch, so an absent field **clears**
 * the one on the diagram. That is what lets somebody empty the author field and
 * have the export go back to saying nothing, rather than the old value living
 * on because "undefined means leave it alone".
 *
 * An empty name is refused rather than applied, the same as {@link renameDiagram}
 * — a nameless tab is not something the caller meant to ask for.
 */
export function applyDiagramSettings(
  model: HostModel,
  diagramId: string,
  settings: DiagramSettings,
): HostModel {
  const name = settings.name.trim()
  if (!name) return model
  return {
    ...model,
    diagrams: model.diagrams.map((d) => {
      if (d.id !== diagramId) return d
      const next: DesignDiagram = { ...d, name }
      // Written out one by one, and deleted rather than set to undefined, so
      // what lands in a saved file is what a hand-written one would look like.
      assign(next, 'author', settings.author)
      assign(next, 'client', settings.client)
      assign(next, 'documentDate', settings.documentDate)
      assign(next, 'showTitleBlock', settings.showTitleBlock)
      assign(next, 'aspectConfig', settings.aspectConfig)
      assign(next, 'showAspects', settings.showAspects)
      return next
    }),
  }
}

function assign<K extends keyof DesignDiagram>(
  diagram: DesignDiagram,
  key: K,
  value: DesignDiagram[K],
): void {
  if (value === undefined) delete diagram[key]
  else diagram[key] = value
}

/**
 * A copy with a new id and the name "… (copy)", directly after the original.
 * Geometry and styling travel along as a deep copy, so a change in the copy
 * never touches the original; `needsLayout` does not come along, because the
 * drawing is already laid out.
 *
 * The name comes from the shell's string table (`shell.copyOf`) and therefore in
 * the user's language: it is a name that ends up in the model, not a label on
 * screen. `copyName` is optional and falls back to what used to be hardcoded
 * here, so a call without a translator does exactly what it always did.
 */
export function duplicateDiagram(
  model: HostModel,
  diagramId: string,
  newId: string,
  copyName: (name: string) => string = (name) => `${name} (kopie)`,
): HostModel {
  const index = model.diagrams.findIndex((d) => d.id === diagramId)
  if (index < 0) return model
  const source = model.diagrams[index]
  const copy = {
    ...structuredClone(source),
    id: newId,
    name: copyName(source.name),
  }
  delete copy.needsLayout
  const diagrams = [...model.diagrams]
  diagrams.splice(index + 1, 0, copy)
  return { ...model, diagrams }
}

/**
 * Delete a diagram. The last landscape always stays — the editor already
 * disables the menu item, and this is the safety net underneath it.
 */
export function deleteDiagram(model: HostModel, diagramId: string): HostModel {
  const target = model.diagrams.find((d) => d.id === diagramId)
  if (!target) return model
  if (target.kind === 'layer7' && model.diagrams.filter((d) => d.kind === 'layer7').length <= 1) {
    return model
  }
  return { ...model, diagrams: model.diagrams.filter((d) => d.id !== diagramId) }
}

/**
 * Which diagram is active after the model changed: the current one if it still
 * exists, otherwise the first one left.
 *
 * Needed since `applyBatch` cleans up orphaned container diagrams: you can
 * delete the application of the very diagram you are standing on, and then the
 * diagram vanishes from under your feet. Without this the editor falls back on
 * its own "Diagram not found".
 */
export function resolveActiveDiagramId(model: HostModel, preferred: string): string {
  if (model.diagrams.some((d) => d.id === preferred)) return preferred
  return model.diagrams[0]?.id ?? preferred
}

/** The diagrams that vanished between two model versions — so we can say what went. */
export function removedDiagrams(before: HostModel, after: HostModel): HostModel['diagrams'] {
  const kept = new Set(after.diagrams.map((d) => d.id))
  return before.diagrams.filter((d) => !kept.has(d.id))
}

/**
 * Does the editor have to remount now that the shell is loading another document?
 *
 * Two reasons, and no others. The package's settle pass runs once per diagram id
 * per editor instance, so a document that has to be laid out again under ids
 * this instance already laid out only gets through with a fresh mount. And a
 * different set of ids is a different drawing: the viewport and selection you
 * would be preserving no longer refer to anything.
 *
 * What remains — and this is the ordinary case — is opening a working file with
 * the same diagrams. That does not need a remount, and used to get one anyway:
 * zoom, selection and collapsed panels all jumped back to the start. The undo
 * stack *is* wrong in that case; `historyResetToken` clears that.
 */
export function needsRemount(before: HostModel, after: HostModel, relayout: boolean): boolean {
  if (relayout) return true
  const a = before.diagrams.map((d) => d.id).sort()
  const b = after.diagrams.map((d) => d.id).sort()
  return a.length !== b.length || a.some((id, i) => id !== b[i])
}
