/**
 * A scope: the document at one path, and the arithmetic over a tree of them.
 *
 * **Every scope is the same document** (ADR-0012 §1). The organisation at the
 * root, a domain under it, a landscape under that: one shape, one reader, one
 * writer. What a scope *is* — organisation, domain, programme, landscape — is a
 * label in its `scope.json` for a screen to show, not a type anything switches
 * on; the root is the organisation by position, because it is the root.
 *
 * That replaces three records with one. A project was a `project.json` and a
 * model; a group was a `group.json` and whatever could be derived from the
 * projects filed under it; the organisation was a key in a settings file. They
 * differed in what they could hold and in nothing else worth keeping, and the
 * levels the landscapes now need are more than two.
 *
 * Everything here is arithmetic without an outside world: no storage, no React,
 * no `File`. What arrives has already been read and already `JSON.parse`d.
 */
import type { AspectConfigEntry, DocumentImage, Transition, UploadedLogo } from '../model'
import type { Adr } from '../model/adr'
import { fromInterchange } from '../model/fromInterchange'
import type { HostModel, InterchangeDoc } from '../model/fromInterchange'
import {
  WORKING_FILE_TYPE, WORKING_FILE_VERSION, isInterchange, isWorkingFile, workingFileLogoLibrary,
} from '../model/hostModel'
import type { WorkingFile } from '../model/hostModel'
import type { RecordLink } from './links'
import { ancestorScopes, ROOT_SCOPE } from './scopePath'
import type { ScopePath } from './scopePath'

/**
 * What a scope is called in the picker — a **label**, not a type.
 *
 * Nothing branches on it and nothing may start to: the moment code asks "is
 * this a domain" instead of "does this scope hold a diagram", a folder that
 * says the wrong word about itself stops working, and a folder saying the wrong
 * word about itself is a person's business and not a fault.
 */
export type ScopeKind = 'organisation' | 'domain' | 'programme' | 'landscape'

export const SCOPE_KINDS: readonly ScopeKind[] = [
  'organisation', 'domain', 'programme', 'landscape',
]

export function isScopeKind(value: unknown): value is ScopeKind {
  return typeof value === 'string' && (SCOPE_KINDS as readonly string[]).includes(value)
}

/**
 * One scope, complete.
 *
 * `logoLibrary` belongs here and not with the preferences: the marks sit in the
 * working file as data URLs, so they travel with the document to another
 * machine. Preferences deliberately do not.
 */
export type ScopeSnapshot = {
  path: ScopePath
  /** The document. `model.name` is what this scope is called — there is one name. */
  model: HostModel
  activeDiagramId: string
  logoLibrary: UploadedLogo[]
  /** See {@link ScopeKind}: a word for a screen, never a branch. */
  kind?: ScopeKind
  /**
   * Who a drawing made here is addressed to, when that is not this scope's own
   * name. Absent = the nearest ancestor that says (`scopeLabel.ts`), which is
   * what the title block has always meant by "the client".
   */
  client?: string
  /** A ticket queue, a wiki space, a dashboard. */
  links?: RecordLink[]
  /**
   * The pictures the documents show (ADR-0009).
   *
   * Optional, and absent rather than empty: a scope with no pictures has no
   * `images/` folder, and there is nowhere to write the difference between the
   * two — the same reasoning as a model carrying no decisions.
   */
  imageLibrary?: DocumentImage[]
  /** ISO timestamp of the last save. Absent until a store has written it once. */
  updatedAt?: string
}

/**
 * What a screen shows without loading a whole model — and, since the scopes
 * nest, the scopes filed under it.
 *
 * A tree rather than a flat list because that is what a store can answer
 * cheaply and what every reader wants: the folder layout IS the structure, and
 * flattening it only to group it again is how two orderings come to disagree.
 *
 * `diagrams` is the one count in here, and deliberately the only one. It comes
 * off `scope.json`, which is the file a listing already reads; a count of
 * elements or decisions would cost a second file per scope on every open, which
 * is the shape ADR-0004 caught four times over. A screen that wants those can
 * load the scope it is actually showing.
 */
export type ScopeSummary = {
  path: ScopePath
  /** What it is called. Its own name, never an ancestor's. */
  name: string
  kind?: ScopeKind
  /** Its own answer only; {@link scopeClient} is what walks up for the rest. */
  client?: string
  description?: string
  /** A ticket queue, a wiki space, a dashboard — a screen shows these. */
  links?: RecordLink[]
  /** How many views it holds. Zero is ordinary: a domain need draw nothing. */
  diagrams: number
  /** The scopes filed directly under it, in the order the store listed them. */
  children: ScopeSummary[]
  updatedAt?: string
}

/** One scope's own summary, with nothing under it. A store fills in the tree. */
export function summarise(scope: ScopeSnapshot): ScopeSummary {
  return {
    path: scope.path,
    name: scope.model.name,
    ...(scope.kind !== undefined ? { kind: scope.kind } : {}),
    ...(scope.client !== undefined ? { client: scope.client } : {}),
    ...(scope.model.description !== undefined ? { description: scope.model.description } : {}),
    ...(scope.links !== undefined ? { links: scope.links } : {}),
    diagrams: scope.model.diagrams.length,
    children: [],
    ...(scope.updatedAt ? { updatedAt: scope.updatedAt } : {}),
  }
}

/**
 * A flat listing, as the tree it describes.
 *
 * Written once, here, because three of the four stores hold their scopes flat
 * and would otherwise each grow their own nesting — and two of them would be
 * subtly different by the second bug.
 *
 * **The root is always there**, named by `rootName` when nothing in the listing
 * named it: the root is the folder you opened, not a record somebody made, and
 * a screen with nowhere to put the first scope is a dead end. **A scope whose
 * parent is not in the listing hangs off the nearest one that is** — a folder
 * somebody made by hand between two scopes is not a reason to hide what is
 * under it, and its path still says where it really lives.
 */
export function scopeTree(
  summaries: readonly ScopeSummary[], rootName = '',
): ScopeSummary {
  const byPath = new Map(summaries.map((scope) => [scope.path, { ...scope, children: [] as ScopeSummary[] }]))
  const root = byPath.get(ROOT_SCOPE)
    ?? { path: ROOT_SCOPE, name: rootName, diagrams: 0, children: [] as ScopeSummary[] }
  byPath.set(ROOT_SCOPE, root)

  for (const path of [...byPath.keys()].filter((held) => held !== ROOT_SCOPE).sort()) {
    const scope = byPath.get(path)!
    const parent = ancestorScopes(path).map((held) => byPath.get(held)).find(Boolean) ?? root
    parent.children.push(scope)
  }
  return root
}

/** Every scope in a tree, depth first, the root first. */
export function flattenScopes(root: ScopeSummary): ScopeSummary[] {
  return [root, ...root.children.flatMap(flattenScopes)]
}

/**
 * Does this scope hold a document somebody can open?
 *
 * A scope with no views is an ordinary scope — a domain that files landscapes
 * under it and draws nothing itself is exactly what ADR-0012 §1 describes — but
 * the canvas has nothing to show for one, so the shell declines to enter it
 * rather than the store declining to read it. Where the line is drawn changed
 * at format 5: a store that answered `undefined` for such a folder would make
 * a domain's decisions, documents and plans unreachable.
 */
export function isOpenableScope(scope: ScopeSnapshot | undefined): scope is ScopeSnapshot {
  return !!scope && scope.model.diagrams.length > 0
}

/**
 * Is this something a store read back and can hand over as a scope?
 *
 * Weaker than {@link isOpenableScope} on purpose, and about shape rather than
 * content: a record with no model at all is a broken record, and a record with
 * no diagrams is a domain.
 */
export function isStoredScope(value: unknown): value is ScopeSnapshot {
  if (!value || typeof value !== 'object') return false
  const held = value as ScopeSnapshot
  return !!held.model && Array.isArray(held.model.diagrams)
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
 * A scope from an interchange document — how an import becomes something you
 * can work in and save.
 *
 * The document describes a landscape and says what it is called; where it is
 * filed is this call's to decide, and nothing in the document has an opinion.
 */
export function scopeFromDocument(
  doc: InterchangeDoc,
  path: ScopePath,
  /** Plans to open with, which the interchange format does not carry (ADR-0009). */
  transitions?: readonly Transition[],
  /** Decision records, kept beside the document for the same reason. */
  decisions?: readonly Adr[],
): ScopeSnapshot {
  const model = fromInterchange(doc)
  if (transitions?.length) model.transitions = [...transitions]
  if (decisions?.length) model.decisions = [...decisions]
  return { path, model, activeDiagramId: resolveActive(model), logoLibrary: [] }
}

/** A scope with one landscape in it, for "new scope". */
export function emptyScope(
  path: ScopePath,
  names: { design: string; diagram: string },
  kind?: ScopeKind,
): ScopeSnapshot {
  const model: HostModel = {
    name: names.design,
    elements: [],
    relations: [],
    diagrams: [{
      id: 'landscape', kind: 'layer7', name: names.diagram, members: [], geometry: { nodes: [] },
    }],
  }
  return { path, model, activeDiagramId: 'landscape', logoLibrary: [], ...(kind ? { kind } : {}) }
}

/**
 * A scope that holds nothing but its own name — what a parent is, before
 * anybody draws in it.
 *
 * Creating a scope creates the ones above it that are not there yet, because a
 * folder with no `scope.json` is not a scope and its children would be filed
 * under nothing.
 */
export function bareScope(path: ScopePath, name: string, kind?: ScopeKind): ScopeSnapshot {
  return {
    path,
    model: { name, elements: [], relations: [], diagrams: [] },
    activeDiagramId: '',
    logoLibrary: [],
    ...(kind ? { kind } : {}),
  }
}

/**
 * The scope as a working file, ready to be written out.
 *
 * `logoLibrary` is left out when empty: a file without uploaded marks then stays
 * textually identical to a v1 file apart from the version number, which saves
 * noise in a diff or a version control system.
 *
 * The path does not go in. A working file is something you hand to somebody
 * else, and where it was filed in your store is none of their business — they
 * open it into a scope of their own.
 */
export function toWorkingFile(scope: ScopeSnapshot): WorkingFile {
  return {
    type: WORKING_FILE_TYPE,
    version: WORKING_FILE_VERSION,
    model: scope.model,
    activeDiagramId: scope.activeDiagramId,
    ...(scope.logoLibrary.length ? { logoLibrary: scope.logoLibrary } : {}),
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
  | { ok: true; scope: ScopeSnapshot; relayout: boolean; kind: 'workingFile' | 'interchange' }
  | { ok: false; messageKey: 'shell.workingFileNoDiagrams' | 'shell.interchangeNoDiagrams' | 'shell.unknownFile' }

/**
 * A read and parsed file, landed into the scope it was opened from.
 *
 * `into` is the scope being replaced: the file supplies the content, the open
 * scope supplies where it is filed and — for an interchange document, which by
 * agreement carries neither marks nor pictures — the two libraries, which
 * belong to this scope rather than to the document.
 */
export function openScopeDocument(
  parsed: unknown,
  into: ScopeSnapshot,
): OpenResult {
  if (isWorkingFile(parsed)) {
    if (!parsed.model?.diagrams?.length) return { ok: false, messageKey: 'shell.workingFileNoDiagrams' }
    return {
      ok: true,
      kind: 'workingFile',
      relayout: false,
      scope: {
        path: into.path,
        model: parsed.model,
        activeDiagramId: resolveActive(parsed.model, parsed.activeDiagramId),
        logoLibrary: workingFileLogoLibrary(parsed),
      },
    }
  }
  if (isInterchange(parsed)) {
    const model = fromInterchange(parsed)
    if (!model.diagrams.length) return { ok: false, messageKey: 'shell.interchangeNoDiagrams' }
    return {
      ok: true,
      kind: 'interchange',
      relayout: true,
      scope: {
        path: into.path,
        model,
        activeDiagramId: resolveActive(model),
        logoLibrary: [...into.logoLibrary],
        ...(into.imageLibrary?.length ? { imageLibrary: [...into.imageLibrary] } : {}),
      },
    }
  }
  return { ok: false, messageKey: 'shell.unknownFile' }
}

/**
 * How a list of scopes is ordered.
 *
 * Alphabetical by default. A list you scan for a name you already know should
 * hold still — recency reorders itself under you every time you save, and the
 * scope you want is rarely the one you touched last once there are more than a
 * handful. Recency is offered because it is genuinely the right answer while
 * you are moving between two or three of them in a session.
 *
 * The type and the stored key still say "project": the setting is a person's
 * and was written to their preferences long before scopes, and renaming it
 * would silently reset everybody's choice to buy nothing.
 */
export type ProjectOrder = 'name' | 'updated'

export const PROJECT_ORDERS: readonly ProjectOrder[] = ['name', 'updated']

export function isProjectOrder(value: unknown): value is ProjectOrder {
  return value === 'name' || value === 'updated'
}

/**
 * One level of the tree in the requested order, named or newest-first, with
 * every level below it ordered the same way.
 *
 * Pure, and a copy: the store hands back its own arrays and a screen that
 * sorted them in place would be reordering somebody else's data. Both orders
 * fall back on the name and then the path, so the result is total — two scopes
 * saved in the same millisecond still come out in the same order every time.
 */
export function sortScopes(
  scopes: readonly ScopeSummary[],
  order: ProjectOrder = 'name',
): ScopeSummary[] {
  const byName = (a: ScopeSummary, b: ScopeSummary) =>
    a.name.localeCompare(b.name) || a.path.localeCompare(b.path)
  const compare = order === 'name'
    ? byName
    : (a: ScopeSummary, b: ScopeSummary) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || byName(a, b)
  return [...scopes]
    .map((scope) => ({ ...scope, children: sortScopes(scope.children, order) }))
    .sort(compare)
}

/** The names already taken directly under one scope — what `scopePathFor` needs. */
export function namesUnder(parent: ScopeSummary | undefined): string[] {
  return (parent?.children ?? []).map((child) => child.path.split('/').pop() ?? '')
}

/**
 * The scope's own name, changed.
 *
 * The name lives on the model and not on the path: renaming should not re-file
 * the scope, or every rename would break the link the picker and the
 * `lastScope` preference hold. A path is an address, a name is a label, and
 * they are allowed to drift.
 */
export function renameScope(scope: ScopeSnapshot, name: string): ScopeSnapshot {
  return { ...scope, model: { ...scope.model, name } }
}

/**
 * The scope's fallbacks: who an unattributed diagram names, and what columns a
 * new landscape starts with.
 *
 * Deleted rather than set to `undefined` when cleared, so a scope nobody has
 * given defaults to keeps a model that says so — the same shape a hand-written
 * file would have.
 */
export function setScopeDefaults(
  scope: ScopeSnapshot,
  defaults: { author?: string; aspectConfig?: AspectConfigEntry[] },
): ScopeSnapshot {
  const model = { ...scope.model }
  if (defaults.author === undefined) delete model.defaultAuthor
  else model.defaultAuthor = defaults.author
  if (defaults.aspectConfig === undefined) delete model.defaultAspectConfig
  else model.defaultAspectConfig = defaults.aspectConfig
  return { ...scope, model }
}

/**
 * The scope, filed somewhere else.
 *
 * This changes the address, which is exactly why moving is a store operation —
 * save there, remove here, in that order — and not a field edit. Removing first
 * and then failing to save would lose the scope.
 */
export function moveScope(scope: ScopeSnapshot, path: ScopePath): ScopeSnapshot {
  return { ...scope, path }
}

/**
 * What a tree of scopes adds up to, for the line under an organisation's name.
 *
 * **A domain is a scope with scopes filed under it; a landscape is a scope that
 * holds a view.** Two readings and not one classification, because a scope can
 * honestly be both — a domain that also draws a board of its own is counted in
 * each, which is what it is — and because a scope that is neither yet is an
 * ordinary thing somebody made a minute ago.
 *
 * The `kind` label is deliberately not consulted. It is a word for a screen to
 * show and never a branch ({@link ScopeKind}), so counting by it would make a
 * folder that says the wrong word about itself count wrong.
 *
 * The root is left out: it is the organisation, and the screen this line
 * belongs to is its home rather than a row in its own list.
 */
export function countScopes(root: ScopeSummary): { domains: number; landscapes: number } {
  const under = flattenScopes(root).slice(1)
  return {
    domains: under.filter((scope) => scope.children.length > 0).length,
    landscapes: under.filter((scope) => scope.diagrams > 0).length,
  }
}

/**
 * One scope and everything filed under it, as the two numbers a row says.
 *
 * The scope itself is included: a domain that draws two boards of its own and
 * holds three landscapes has five landscapes' worth of drawing in its folder,
 * and a total that left out the one you are looking at would be a total of
 * something nobody asked about.
 */
export function subtreeTotals(scope: ScopeSummary): { landscapes: number; diagrams: number } {
  const all = flattenScopes(scope)
  return {
    landscapes: all.filter((held) => held.diagrams > 0).length,
    diagrams: all.reduce((total, held) => total + held.diagrams, 0),
  }
}

/**
 * The newest `updatedAt` anywhere in the tree — when the organisation last
 * changed, whichever scope it happened in.
 *
 * ISO timestamps, so the newest is the largest string. Absent where no scope
 * has been written yet, which a store answers for a folder nobody has saved
 * into; the caller says "not yet" rather than inventing a day.
 */
export function newestChange(root: ScopeSummary): string | undefined {
  return flattenScopes(root)
    .map((scope) => scope.updatedAt)
    .filter((at): at is string => at !== undefined)
    .sort()
    .pop()
}
