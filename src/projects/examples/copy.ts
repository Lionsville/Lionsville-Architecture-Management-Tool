// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an example is, and copying one in: everything about the examples but
 * the examples themselves.
 *
 * The domain's, not a screen's: where a copy lands is a rule about the tree
 * it lands in, and whoever copies one — the organisation's page, or a
 * process with no screen seeding an organisation — asks the same rule and
 * writes the copy the same way. What each example holds is kept apart and
 * fetched when one is copied (`catalogue.ts`).
 */
import type { ImageRepository } from '../../ports/ImageRepository'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import { namesUnder } from '../scope'
import type { ScopeSnapshot, ScopeSummary } from '../scope'
import { organisationHoldsWork } from '../organisationWork'
import { contentOf, nodesOf, picturesOf, placeTogether, readScope, summaryOf } from '../scopeAccess'
import type { ScopeReader } from '../scopeAccess'
import { checkMarkFor, checkMarkId } from '../../model/checkMarks'
import type { CheckMark } from '../../model/checkMarks'
import { today } from '../../model/lifecycle'
import { identityFindings } from '../checks'
import { carryAddresses } from '../readdress'
import { indexScopes } from '../scopeIndex'
import { isWithinScope, joinScopePath, ROOT_SCOPE, scopePathFor, scopePathLabel } from '../scopePath'
import type { ScopePath } from '../scopePath'

export type ExampleProject = {
  /** Stable key, for the picker and for tests. */
  key: string
  /** Where a copy lands. The user may be offered a different parent later. */
  path: ScopePath
  /** What the picker calls it. */
  label: string
  /** One line on what it shows. */
  description: string
  /** The scopes it holds, parents first, at their own paths under `path`. */
  scopes: readonly ScopeSnapshot[]
  /** What it is filed under where `path` says nothing: a visit, whose scopes stand at the root. */
  fileAs?: ScopePath
}

/**
 * Where a copy lands, which depends on what the root already is.
 *
 * **A root nobody has named, with nothing in it, BECOMES the example.** That is
 * the common case by a long way: somebody has just pointed the app at an empty
 * folder and wants to see what this thing does. Filing the example one level
 * down would leave them with an unnamed organisation sitting above a named one
 * for ever, and a home screen whose heading is blank — so the example's own
 * organisation takes the root, name and record and all, and the scopes under it
 * become the root's children.
 *
 * **A root that is already something takes it as a child.** A name, a scope
 * filed under it, or a board of its own: each is work somebody did, and writing
 * the example's organisation record over it would be losing it. The tree is
 * re-addressed under one new scope named after the example, with the ordinary
 * collision rule, so copying twice gives two rather than one overwritten one.
 *
 * **A root that holds records is something too**, with no name and no board:
 * an application an agent added, a decision left after its only view was
 * removed. A listing does not say what a scope holds, so the caller reads the
 * root and says (`rootHoldsWork`); the example is filed under it, never over it.
 *
 * **Whose a name is, is the listing's to say** (`organisationWork`): a folder
 * lists its organisation under the folder's own name until something is
 * written there, and that name is nobody's. Read as one, an example kept into
 * an empty folder was filed under an organisation called after the folder.
 *
 * A board of its own is not in the sentence the design asked for — it says "a
 * name or children" — and is here anyway: an unnamed root with a landscape
 * drawn in it is rare, and overwriting it would be the one mistake on this
 * screen nothing can undo.
 */
export function copyExampleInto(
  example: ExampleProject,
  root: ScopeSummary,
  rootHoldsWork = false,
): ScopeSnapshot[] {
  const base = !rootHoldsWork && !organisationHoldsWork(root)
    ? ROOT_SCOPE
    : scopePathFor(ROOT_SCOPE, scopePathLabel(example.fileAs ?? example.path), namesUnder(root))
  // Every address in the example is the example's own: nothing in it can mean
  // the organisation it lands in. The shipped folder says some from where it
  // ships (`example.path/…`, a stand-in's `ref`, a cause's link) and some from
  // its own root (`''`, a unit's line, a topic's link, an evaluation's block),
  // as a visit says all of them; both are read from the example's root, and
  // land under `base`. An address said the second way that read as the first
  // would be a scope of the example named after where it ships.
  const fromItsRoot = (path: ScopePath): ScopePath => {
    if (example.path === ROOT_SCOPE || !isWithinScope(path, example.path)) return path
    return path === example.path ? ROOT_SCOPE : path.slice(example.path.length + 1)
  }
  const readdress = (path: ScopePath): ScopePath => joinScopePath(base, fromItsRoot(path))
  return example.scopes.map((scope) => ({
    // A stand-in's `ref` is an address too (ADR-0012 §3), and so is every
    // line, link and citation that names a scope (`carryAddresses`): one not
    // carried points at a scope that is not there — or, filed under an
    // organisation, at one of the organisation's own.
    ...carryAddresses(scope, readdress),
    path: readdress(scope.path),
  }))
}

/**
 * Where a copy lands on the tree as it is kept now: {@link copyExampleInto}
 * over the root's listing, and over what the root holds, read — a listing
 * does not say that. Decided at the moment of copying, never on a tree read
 * earlier: a root read before its listing answered is nameless and empty,
 * and would be taken over whatever it holds.
 *
 * **A root that could not be read whole holds work**, whatever could be read
 * of it: what could not may be anything — a later version's organisation
 * reads as nameless and empty here — and so may a scope the listing could not
 * read.
 */
export async function exampleCopyOver(scopes: ScopeReader, example: ExampleProject): Promise<ScopeSnapshot[]> {
  const [tree, root] = await Promise.all([scopes.tree(), readScope(scopes, ROOT_SCOPE)])
  const listed = summaryOf(tree)
  return copyExampleInto(example, listed, organisationHoldsWork(listed, root))
}

/**
 * A copy written: each scope a content that arrives whole, the pictures'
 * bytes first, every one of them landed together or none
 * (`placeTogether`).
 */
export async function placeCopy(
  repositories: { scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'remove'>; images: Pick<ImageRepository, 'put'> },
  copy: readonly ScopeSnapshot[],
): Promise<void> {
  await placeTogether(repositories, copy.map((scope) => ({
    address: scope.path, content: contentOf(scope, []), pictures: picturesOf(scope.imageLibrary),
  })))
}

/**
 * What only the organisation reads (ADR-0036, ADR-0046): the operating model
 * and the numeric scales. In a scope filed under the organisation nothing
 * reads them, so a visit kept there leaves them behind, and the question
 * before it says so (`keepAsks`). Never merged into the organisation's own:
 * an organisation that holds work is somebody's, and its operating model —
 * an empty one included — is theirs to shape.
 *
 * Principles are not among them: a scope's own are read there and in every
 * scope below (ADR-0041), so they come along with the rest.
 */
export const ORGANISATION_ONLY = ['unitTypes', 'roles', 'responsibilities', 'operatingRules', 'aspectScales'] as const

/** Where a visit was kept: as the organisation itself, or under it, as a scope of its own at `under`. */
export type KeptVisit = { under?: ScopePath }

/**
 * Whether keeping a visit now would file it under the organisation rather than
 * make it the organisation — and so whether there is anything to ask first:
 * where it lands, and what it leaves behind. Read now, as the keep reads it.
 */
export async function keepAsks(scopes: ScopeReader): Promise<boolean> {
  const [tree, root] = await Promise.all([scopes.tree(), readScope(scopes, ROOT_SCOPE)])
  return organisationHoldsWork(summaryOf(tree), root)
}

/**
 * A visit kept: every scope the visit holds, as it stands with whatever was tried
 * there, placed where the example would land. Over work that appeared meanwhile it
 * is filed under a scope of its own, as a copy is, never over it — and without
 * what only the organisation reads ({@link ORGANISATION_ONLY}). Answers where it
 * landed, decided as it was written: the question asked before may be older.
 */
export async function keepVisit(
  from: ScopeReader,
  to: { scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'remove'>; images: Pick<ImageRepository, 'put'> },
  named: { key: string; label: string; description: string; path: ScopePath },
): Promise<KeptVisit> {
  const paths = nodesOf((await from.tree()).root).map((node) => node.address)
  const read = await Promise.all(paths.map((path) => readScope(from, path)))
  const scopes = read.filter((one): one is ScopeSnapshot => one !== undefined)
  const copy = await exampleCopyOver(to.scopes, { ...named, path: ROOT_SCOPE, fileAs: named.path, scopes })
  // Parents first, so the visit's organisation is the first scope placed, wherever it went.
  const under = copy[0] && copy[0].path !== ROOT_SCOPE ? copy[0].path : undefined
  if (under === undefined) {
    await placeCopy(to, copy)
    return {}
  }
  await placeCopy(to, filedUnder(copy, under, await readScope(to.scopes, ROOT_SCOPE), today()))
  return { under }
}

/**
 * A visit as it is filed under an organisation that holds work, rather than
 * made it: without what only the organisation reads, without what named that,
 * and with the capability map it brought marked as its own.
 *
 * **Its units come as plain actors.** A unit's type, its own reporting lines,
 * a holder's role and a scope's type are all said in the operating model left
 * behind (`ORGANISATION_ONLY`), and read against the organisation's instead
 * they name types and roles it does not have — or, worse, ones of its own
 * that happen to share an id and mean something else. So they go, and the
 * units stay where they were nested, under the same names; the question
 * before the keep says so (`example.keepAsk`).
 *
 * **Its capabilities are not proposals.** A function a scope below defines
 * and the organisation never named is one the domain proposes (`check.proposal`),
 * which is right of a domain's map and wrong of this one: the example's map was
 * its own organisation's, and it is kept here to be looked at, not to propose
 * forty capabilities to somebody else's. Each such finding is marked as
 * intended, as a person would, in the scope it is about — read off the copy
 * over the organisation as it is, so a function the organisation does name is
 * no finding and is not marked — and stays under *Accepted*, to be taken back.
 */
export function filedUnder(
  copy: readonly ScopeSnapshot[], under: ScopePath, organisation: ScopeSnapshot | undefined, on: string,
): ScopeSnapshot[] {
  const plain = copy.map((scope) => withoutOperatingModel(scope.path === under ? withoutOrganisationOnly(scope) : scope))
  const index = indexScopes([...(organisation ? [{ ...organisation, path: ROOT_SCOPE }] : []), ...plain])
  const marks = new Map<ScopePath, CheckMark[]>()
  for (const finding of identityFindings(index)) {
    if (finding.key !== 'check.proposal' || !isWithinScope(finding.scope, under)) continue
    marks.set(finding.scope, [...marks.get(finding.scope) ?? [], checkMarkFor(finding, { on })])
  }
  return plain.map((scope) => {
    const marked = marks.get(scope.path)
    if (!marked) return scope
    const held = scope.model.checkMarks ?? []
    const known = new Set(held.map(checkMarkId))
    return { ...scope, model: { ...scope.model, checkMarks: [...held, ...marked.filter((mark) => !known.has(checkMarkId(mark)))] } }
  })
}

/** A scope with none of what only the organisation reads. */
function withoutOrganisationOnly(scope: ScopeSnapshot): ScopeSnapshot {
  const model = { ...scope.model }
  for (const list of ORGANISATION_ONLY) delete model[list]
  return { ...scope, model }
}

/** A scope with nothing that names the operating model left behind: its type, its units' types and lines, and who held which role. */
function withoutOperatingModel(scope: ScopeSnapshot): ScopeSnapshot {
  const { unitTypeId: _type, ...rest } = scope
  const { assignments: _held, ...model } = scope.model
  const elements = model.elements.map((element) => {
    if (element.unitTypeId === undefined && element.reportingLines === undefined) return element
    const { unitTypeId: _unit, reportingLines: _lines, ...plain } = element
    return plain
  })
  return { ...rest, model: { ...model, elements } }
}
