// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The working file as the interchange every source carries work out in and
 * takes it in from (ADR-0031 §2): the folder format, zipped, read out of and
 * written back into whatever repositories are handed in.
 *
 * The app reaches this only through `ports/Interchange.ts`, and loads it only
 * when a person exports, imports or opens a working file (`app/composition.ts`):
 * the codec, the readers of the older formats and the zip are nothing a first
 * screen needs. A process with no screen — a server over a database — reaches
 * it through `platform/node/workingFile.ts`, with repositories of its own.
 */
import { bareScope } from '../../../projects/scope'
import type { OpenRefusal, ScopeSnapshot } from '../../../projects/scope'
import { carriedOf, contentOf, everyScope, nodeAt, picturesOf, placeTogether } from '../../../projects/scopeAccess'
import { isWithinScope, joinScopePath, ROOT_SCOPE } from '../../../projects/scopePath'
import type { ScopeAddress, ScopeId } from '../../../projects/scopeState'
import type {
  Arrival, BringOptions, CarriedOut, CarryOptions, Interchange, Opened, ReadBack,
} from '../../../ports/Interchange'
import type { Repositories } from '../../../ports/Repositories'
import { openDocumentBytes, WORKING_FILE_MEDIA_TYPE, workingFileBytes, workingFileName } from './workingFile'
import {
  compareManifests, manifestOf, manifestTotals, MANIFEST_TYPE,
} from './workingFileManifest'
import type { ManifestDifference, WorkingFileManifest } from './workingFileManifest'
import { WORKING_FILE_ACCEPTS } from './workingFileKinds'

/** What a working file is read out of: a source's scopes, and its pictures' bytes. */
export type CarriedFrom = Pick<Repositories, 'scopes' | 'images'>

/** What one is brought into: the same, and the history a landing may record in. */
export type BroughtInto = Pick<Repositories, 'scopes' | 'images' | 'history'>

export type { Arrival, BringOptions, CarriedOut, CarryOptions, Opened } from '../../../ports/Interchange'

/**
 * The organisation, or the scope at `from` and every scope under it, as a
 * working file. Where the organisation holds nothing yet and nothing is
 * held, it is still an organisation with a name, and that is what is carried.
 */
export async function carryOut(
  from: CarriedFrom, options: CarryOptions = {},
): Promise<CarriedOut> {
  const at = options.from ?? ROOT_SCOPE
  const read = await everyScope(from, at)
  const held = await Promise.all((options.held ?? [])
    .filter((scope) => isWithinScope(scope.path, at))
    .map((scope) => pictured(from, scope, read.find((one) => one.path === scope.path))))
  const scopes = withHeld(read, held).map(saysWhatItLacks)
  if (scopes.length) return carryScopes(scopes)
  const tree = await from.scopes.tree()
  return carryScopes([bareScope(ROOT_SCOPE, tree.root.name)])
}

/**
 * These scopes as a working file, the shallowest at its top and the rest
 * after it by address — one order, whatever order a source lists its tree
 * in, so two sources holding the same organisation write the same bytes.
 */
export async function carryScopes(scopes: readonly ScopeSnapshot[]): Promise<CarriedOut> {
  const ordered = [...scopes].sort((one, other) => byAddress(one.path, other.path))
  const manifest = await manifestOf(ordered)
  return {
    name: workingFileName(ordered[0]),
    bytes: workingFileBytes(ordered, manifest),
    mediaType: WORKING_FILE_MEDIA_TYPE,
    without: ordered.flatMap((scope) => (scope.unread ?? []).map((file) => (scope.path ? `${scope.path}/${file}` : file))),
  }
}

/**
 * A scope the caller holds, with its pictures' bytes: a session holds its
 * library's entries and never the bytes, which are read here from where the
 * source keeps them, under the scope's identity — the held one's, or the one
 * read at its address.
 */
async function pictured(from: CarriedFrom, scope: ScopeSnapshot, read: ScopeSnapshot | undefined): Promise<ScopeSnapshot> {
  if (scope.imageLibrary !== undefined || !scope.images?.length) return scope
  const id = scope.id ?? read?.id
  if (!id) return scope
  const carried = await carriedOf(from.images, id, scope.images)
  return carried.length ? { ...scope, imageLibrary: carried } : scope
}

/**
 * A scope whose library names a picture whose bytes did not come with it,
 * saying so: the file is made without it, and the person is told, as for a
 * part of a scope that would not read.
 */
function saysWhatItLacks(scope: ScopeSnapshot): ScopeSnapshot {
  const carried = new Set((scope.imageLibrary ?? []).map((image) => image.file))
  const lacking = (scope.images ?? []).filter((entry) => !carried.has(entry.name)).map((entry) => `images/${entry.name}`)
  return lacking.length ? { ...scope, unread: [...(scope.unread ?? []), ...lacking] } : scope
}

/** Each scope held in place of the one read at its address; one read nowhere, added. */
function withHeld(read: readonly ScopeSnapshot[], held: readonly ScopeSnapshot[]): ScopeSnapshot[] {
  const byPath = new Map(held.map((scope) => [scope.path, scope]))
  const replaced = read.map((scope) => byPath.get(scope.path) ?? scope)
  const added = held.filter((scope) => !read.some((one) => one.path === scope.path))
  return [...added, ...replaced]
}

/** Addresses by UTF-16 code unit, which puts a scope before every scope under it. */
function byAddress(one: ScopeAddress, other: ScopeAddress): number {
  if (one === other) return 0
  return one < other ? -1 : 1
}

/** A working file's scopes, the top placed at `at`; or why it did not open. */
export function open(bytes: Uint8Array, at: ScopeAddress): Promise<Opened | { refused: OpenRefusal }> {
  const opened = openDocumentBytes(bytes, bareScope(at, ''))
  if (!opened.ok) return Promise.resolve({ refused: opened.messageKey })
  return Promise.resolve({
    top: opened.scope,
    rest: opened.rest ?? [],
    unopened: opened.unopened ?? [],
    ...(opened.manifest ? { account: opened.manifest } : {}),
  })
}

/**
 * What was opened, landed as `scope.replace` steps, every scope or none,
 * each picture's bytes put before the step that names it (`placeTogether`).
 * With `before`, every scope about to be replaced that is there is recorded
 * first; with `subject`, the replacing of every scope becomes an entry.
 */
export async function bringIn(
  into: BroughtInto, opened: Opened, options: BringOptions = {},
): Promise<void> {
  const held = [opened.top, ...opened.rest]
  const addresses = held.map((scope) => scope.path)
  if (options.before) {
    const there = await idsAt(into, addresses)
    if (there.length) await into.history.record({ scopes: there, subject: options.before })
  }
  await placeTogether(into, held.map((scope) => ({
    address: scope.path, content: contentOf(scope, []), pictures: picturesOf(scope.imageLibrary),
  })))
  if (options.subject) await into.history.record({ scopes: await idsAt(into, addresses), subject: options.subject })
}

/** The identities of the scopes at these addresses, where there are any. */
async function idsAt(into: Pick<Repositories, 'scopes'>, addresses: readonly ScopeAddress[]): Promise<ScopeId[]> {
  const tree = await into.scopes.tree()
  return addresses.flatMap((address) => {
    const node = nodeAt(tree, address)
    return node ? [node.id] : []
  })
}

/**
 * What landed, read back through `read` and held to the file (ADR-0023,
 * amended): to its manifest where it carries one; otherwise to a manifest made
 * from the scopes it opened to, with any scope in it that would not open
 * counted as missing. A read that fails is a scope that is not there.
 */
export async function check(opened: Opened, read: ReadBack): Promise<Arrival> {
  const top = opened.top.path
  const carried = accountOf(opened)
  const expected = carried ?? await ownManifest(opened)
  const landed = (await Promise.all(expected.scopes.map(async (want) => {
    const at = joinScopePath(top, want.path)
    const held = await read(at).catch(() => undefined)
    return held ? [{ ...held, path: at }] : []
  }))).flat()
  const difference = compareManifests(expected, await manifestOf(landed, top))
  return arrivalOf(expected, carried !== undefined, difference)
}

/** The manifest an opening carried: what {@link open} put there, read when the file was. */
function accountOf(opened: Opened): WorkingFileManifest | undefined {
  const said = opened.account as Partial<WorkingFileManifest> | undefined
  return said?.type === MANIFEST_TYPE ? said as WorkingFileManifest : undefined
}

/** The manifest a file with none of its own is held to: what it opened to, and what it would not. */
async function ownManifest(opened: Opened): Promise<WorkingFileManifest> {
  const made = await manifestOf([opened.top, ...opened.rest], opened.top.path)
  const unopened = opened.unopened.map((path) => ({
    path, name: path, files: [], views: [],
    counts: {
      elements: 0, relations: 0, views: 0, decisions: 0, plans: 0, observations: 0,
      causes: 0, solutions: 0, experiments: 0, pictures: 0, marks: 0,
    },
  }))
  return { type: MANIFEST_TYPE, version: 1, scopes: [...made.scopes, ...unopened] }
}

/** A comparison, in the seam's words. */
function arrivalOf(expected: WorkingFileManifest, accounted: boolean, difference: ManifestDifference | undefined): Arrival {
  const totals = manifestTotals(expected)
  return {
    accounted,
    scopes: expected.scopes.map((scope) => ({ address: scope.path, name: scope.name })),
    totals: { scopes: totals.scopes, views: totals.views, parts: totals.files },
    ...(difference ? {
      short: {
        scopes: difference.scopes.map((scope) => ({
          address: scope.path,
          name: scope.name,
          absent: scope.absent,
          views: scope.views.map((view) => ({ id: view.id, name: view.name })),
          missing: scope.missingFiles.length,
          changed: scope.changedFiles.length,
        })),
        omitted: difference.omitted.map((left) => ({ address: left.path, parts: left.files.length })),
      },
    } : {}),
  }
}

/** The working file, as the seam the app and a server ask for it by. */
export const WORKING_FILE_INTERCHANGE: Interchange = {
  accepts: WORKING_FILE_ACCEPTS,
  carryOut,
  open,
  bringIn,
  check,
}
