/**
 * The project: where it lives, the model, which diagram is open, and the
 * uploaded marks.
 *
 * This is the unit that gets saved and opened, and therefore the only shape a
 * {@link ProjectStore} knows. Everything here is arithmetic without an outside
 * world: no storage, no React, no `File`. What arrives has already been read and
 * already `JSON.parse`d.
 *
 * **The group's name is `model.customerName`.** That field belongs to the
 * package's model, and this shell reads it as "the name of the group this
 * project belongs to" — a customer for a customer engagement, a department or a
 * programme elsewhere. Mapping it here rather than carrying a second copy keeps
 * the export title block, the picker and the stored file from ever disagreeing.
 */
import type { AspectConfigEntry, UploadedLogo } from '../model'
import { fromInterchange } from '../model/fromInterchange'
import type { HostModel, InterchangeDoc } from '../model/fromInterchange'
import {
  WORKING_FILE_TYPE, WORKING_FILE_VERSION, isInterchange, isWorkingFile, workingFileLogoLibrary,
} from '../model/hostModel'
import type { WorkingFile } from '../model/hostModel'
import type { ProjectRef } from './projectRef'

/**
 * One project, complete.
 *
 * `logoLibrary` belongs here and not with the preferences: the marks sit in the
 * working file as data URLs, so they travel with the document to another
 * machine. Preferences deliberately do not.
 */
export type ProjectSnapshot = {
  ref: ProjectRef
  model: HostModel
  activeDiagramId: string
  logoLibrary: UploadedLogo[]
  /** ISO timestamp of the last save. Absent until a store has written it once. */
  updatedAt?: string
}

/** What the picker shows without loading a whole model. */
export type ProjectSummary = {
  ref: ProjectRef
  /** The design's name. */
  name: string
  /** The group's name — see the note at the top of this file. */
  groupName: string
  updatedAt?: string
}

/** The group's display name, as this shell reads the model. */
export function groupNameOf(model: HostModel): string {
  return model.customerName || ''
}

export function summarise(project: ProjectSnapshot): ProjectSummary {
  return {
    ref: project.ref,
    name: project.model.name,
    groupName: groupNameOf(project.model),
    updatedAt: project.updatedAt,
  }
}

/**
 * The diagram that should be open.
 *
 * A stored `activeDiagramId` can point at a diagram that no longer exists —
 * deleted in another session, or somebody else's file. The first diagram is then
 * a better answer than a blank canvas.
 */
export function resolveActive(model: HostModel, preferred?: string): string {
  if (preferred && model.diagrams.some((d) => d.id === preferred)) return preferred
  return model.diagrams[0]?.id ?? ''
}

/**
 * A project from an interchange document — how an example, or an import, becomes
 * something you can work in and save.
 *
 * The group's name is supplied rather than read from the document: the document
 * describes a landscape, the group says whose namespace it is filed under, and
 * those are not the same decision.
 */
export function projectFromDocument(
  doc: InterchangeDoc,
  ref: ProjectRef,
  groupName: string,
): ProjectSnapshot {
  const model = fromInterchange(doc, groupName)
  return { ref, model, activeDiagramId: resolveActive(model), logoLibrary: [] }
}

/** An empty project with one landscape, for "new project". */
export function emptyProject(
  ref: ProjectRef,
  groupName: string,
  names: { design: string; diagram: string },
): ProjectSnapshot {
  const model: HostModel = {
    name: names.design,
    customerName: groupName,
    elements: [],
    connections: [],
    diagrams: [{ id: 'landscape', kind: 'layer7', name: names.diagram, placements: [] }],
  }
  return { ref, model, activeDiagramId: 'landscape', logoLibrary: [] }
}

/**
 * The project as a working file, ready to be written out.
 *
 * `logoLibrary` is left out when empty: a file without uploaded marks then stays
 * textually identical to a v1 file apart from the version number, which saves
 * noise in a diff or a version control system.
 *
 * The ref does not go in. A working file is something you hand to somebody else,
 * and where it was filed in your store is none of their business — they open it
 * into a project of their own.
 */
export function toWorkingFile(project: ProjectSnapshot): WorkingFile {
  return {
    type: WORKING_FILE_TYPE,
    version: WORKING_FILE_VERSION,
    model: project.model,
    activeDiagramId: project.activeDiagramId,
    ...(project.logoLibrary.length ? { logoLibrary: project.logoLibrary } : {}),
  }
}

/**
 * What comes back from an opened file.
 *
 * `relayout` belongs to the outcome and not to the caller: a working file
 * carries its own geometry and must be left alone, an interchange document has
 * none and has to be laid out again. That is a property of what you opened.
 *
 * A refusal carries a KEY and not a sentence. This layer does not know the
 * shell's language; the shell turns it into words at the moment of showing it.
 */
export type OpenResult =
  | { ok: true; project: ProjectSnapshot; relayout: boolean; kind: 'workingFile' | 'interchange' }
  | { ok: false; messageKey: 'shell.workingFileNoDiagrams' | 'shell.interchangeNoDiagrams' | 'shell.unknownFile' }

/**
 * A read and parsed file, landed into the project it was opened from.
 *
 * `into` is the project being replaced: the file supplies the content, the open
 * project supplies where it is filed and — for an interchange document, which
 * by agreement carries no marks — the mark library, which belongs to this
 * browser rather than to the document.
 */
export function openProjectDocument(
  parsed: unknown,
  into: ProjectSnapshot,
): OpenResult {
  if (isWorkingFile(parsed)) {
    if (!parsed.model?.diagrams?.length) return { ok: false, messageKey: 'shell.workingFileNoDiagrams' }
    return {
      ok: true,
      kind: 'workingFile',
      relayout: false,
      project: {
        ref: into.ref,
        model: parsed.model,
        activeDiagramId: resolveActive(parsed.model, parsed.activeDiagramId),
        logoLibrary: workingFileLogoLibrary(parsed),
      },
    }
  }
  if (isInterchange(parsed)) {
    const model = fromInterchange(parsed, groupNameOf(into.model))
    if (!model.diagrams.length) return { ok: false, messageKey: 'shell.interchangeNoDiagrams' }
    return {
      ok: true,
      kind: 'interchange',
      relayout: true,
      project: {
        ref: into.ref,
        model,
        activeDiagramId: resolveActive(model),
        logoLibrary: [...into.logoLibrary],
      },
    }
  }
  return { ok: false, messageKey: 'shell.unknownFile' }
}

/**
 * Does a stored project carry enough to open?
 *
 * Storage holding a model without diagrams is not half a project but a broken
 * one: the editor has nothing to show. That verdict belongs here and not in an
 * adapter — every store has to reach it the same way.
 */
export function isUsableProject(x: unknown): x is ProjectSnapshot {
  if (!x || typeof x !== 'object') return false
  const p = x as ProjectSnapshot
  return !!p.model && Array.isArray(p.model.diagrams) && p.model.diagrams.length > 0
}

/**
 * How a list of projects is ordered.
 *
 * Alphabetical by default. A list you scan for a name you already know should
 * hold still — recency reorders itself under you every time you save, and the
 * project you want is rarely the one you touched last once there are more than
 * a handful. Recency is offered because it is genuinely the right answer while
 * you are moving between two or three projects in a session.
 */
export type ProjectOrder = 'name' | 'updated'

export const PROJECT_ORDERS: readonly ProjectOrder[] = ['name', 'updated']

export function isProjectOrder(value: unknown): value is ProjectOrder {
  return value === 'name' || value === 'updated'
}

/**
 * Projects in the requested order, grouped-then-named or newest-first.
 *
 * Pure, and a copy: the store hands back its own array and a picker that sorted
 * it in place would be reordering somebody else's data. Both orders fall back on
 * group and name so the result is total — two projects saved in the same
 * millisecond still come out in the same order every time.
 */
export function sortProjects(
  projects: readonly ProjectSummary[],
  order: ProjectOrder = 'name',
): ProjectSummary[] {
  const byName = (a: ProjectSummary, b: ProjectSummary) =>
    a.groupName.localeCompare(b.groupName)
    || a.name.localeCompare(b.name)
    || a.ref.project.localeCompare(b.ref.project)
  if (order === 'name') return [...projects].sort(byName)
  return [...projects].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || byName(a, b))
}

/**
 * A group, as the picker sees it.
 *
 * Derived from the projects in it rather than stored on its own. A group is a
 * namespace, and a namespace with nothing in it has nothing to keep and nothing
 * to show — so "create a group" is really "create the first project in one",
 * which is why the dialog for it asks for both names.
 *
 * `group` is the slug that addresses it; `name` is what people call it, taken
 * from the projects filed under it. They can disagree if somebody edits storage
 * by hand, and the slug wins — it is what everything is keyed on.
 */
export type ProjectGroup = {
  group: string
  name: string
  projects: ProjectSummary[]
}

/** The groups present in a list of projects, in the order the list is already in. */
export function groupsOf(projects: readonly ProjectSummary[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>()
  for (const summary of projects) {
    const held = groups.get(summary.ref.group)
    if (held) held.projects.push(summary)
    else {
      groups.set(summary.ref.group, {
        group: summary.ref.group,
        name: summary.groupName || summary.ref.group,
        projects: [summary],
      })
    }
  }
  return [...groups.values()]
}

/** The project keys already used inside one group — what `refFor` needs. */
export function keysInGroup(projects: readonly ProjectSummary[], group: string): string[] {
  return projects.filter((p) => p.ref.group === group).map((p) => p.ref.project)
}

/**
 * The project's own name, changed.
 *
 * The name lives on the model and not on the ref: renaming should not re-file
 * the project, or every rename would break the link the picker and the
 * `lastProject` preference hold. A ref is an address, a name is a label, and
 * they are allowed to drift.
 */
export function renameProject(project: ProjectSnapshot, name: string): ProjectSnapshot {
  return { ...project, model: { ...project.model, name } }
}

/**
 * The project, relabelled with its group's new name.
 *
 * The group's display name lives on every project in the group
 * (`model.customerName`) because that is the field the editor reads. Renaming a
 * group is therefore a sweep over its projects, not one write — and it changes
 * no ref, because the group path is an address and a rename is not a move.
 */
export function relabelGroup(project: ProjectSnapshot, groupName: string): ProjectSnapshot {
  if (groupNameOf(project.model) === groupName) return project
  return { ...project, model: { ...project.model, customerName: groupName } }
}

/**
 * The project's fallbacks: who an unattributed diagram names, and what columns a
 * new landscape starts with.
 *
 * Deleted rather than set to `undefined` when cleared, so a project nobody has
 * given defaults to keeps a model that says so — the same shape a hand-written
 * file would have.
 */
export function setProjectDefaults(
  project: ProjectSnapshot,
  defaults: { author?: string; aspectConfig?: AspectConfigEntry[] },
): ProjectSnapshot {
  const model = { ...project.model }
  if (defaults.author === undefined) delete model.defaultAuthor
  else model.defaultAuthor = defaults.author
  if (defaults.aspectConfig === undefined) delete model.defaultAspectConfig
  else model.defaultAspectConfig = defaults.aspectConfig
  return { ...project, model }
}

/**
 * The project, filed under a different group.
 *
 * This DOES change the ref, because the group is half the address — which is
 * exactly why moving is a store operation (remove there, save here) and not a
 * field edit. Both halves change together so a project cannot end up addressed
 * by one group while labelled with another.
 */
export function moveToGroup(
  project: ProjectSnapshot,
  group: string,
  groupName: string,
): ProjectSnapshot {
  return {
    ...project,
    ref: { ...project.ref, group },
    model: { ...project.model, customerName: groupName },
  }
}
