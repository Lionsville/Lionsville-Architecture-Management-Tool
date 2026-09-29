// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two conversations around a working file that have a password in them
 * (ADR-0023), written once for the two places that hold one: the workspace,
 * with a scope open, and the home, with nothing open.
 *
 * Both answer `undefined` for a cancel, and a cancel is silent — a person who
 * closed a dialog does not need a toast to say they did.
 */
import type { Translate } from '../i18n'
import type { SavedDocument } from '../ports/DocumentGateway'
import { bareScope } from '../projects/scope'
import type { OpenResult, ScopeSnapshot } from '../projects/scope'
import { joinScopePath, ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { isSealed, sealBytes, SEALED_FILE_MEDIA_TYPE, unsealBytes } from '../projects/sealedFile'
import { openDocumentBytes, workingFileBytes, workingFileName } from '../projects/workingFile'
import { compareManifests, manifestOf, manifestTotals, MANIFEST_TYPE } from '../projects/workingFileManifest'
import type { ManifestDifference, WorkingFileManifest } from '../projects/workingFileManifest'
import { ShellError } from '../platform/errors'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'

/**
 * The working set as a sealed file, under a password the person is asked for
 * now. Nothing leaves unsealed: the whole organisation is what this holds,
 * and the save dialog is the last moment anybody is looking.
 */
export async function sealedWorkingFile(
  scopes: readonly ScopeSnapshot[], askPassword: AskPassword,
): Promise<SavedDocument | undefined> {
  const password = await askPassword('set')
  if (password === undefined) return undefined
  // What the file holds, said inside it (ADR-0023, amended), so opening it
  // anywhere can be held to it.
  const manifest = await manifestOf(scopes)
  return {
    name: workingFileName(scopes[0]),
    bytes: await sealBytes(workingFileBytes(scopes, manifest), password),
    mediaType: SEALED_FILE_MEDIA_TYPE,
  }
}

/**
 * What an export was made without, as a sentence — or `undefined` where
 * every scope read whole. The file says the same in its manifest; this is
 * the person being told at the moment they have it in hand.
 */
export function savedWithout(scopes: readonly ScopeSnapshot[], s: Translate): string | undefined {
  const left = scopes.flatMap((scope) => (scope.unread ?? []).map((file) => (scope.path ? `${scope.path}/${file}` : file)))
  if (!left.length) return undefined
  return s('shell.savedWorkingFileWithout', { count: String(left.length), files: listed(left, s) })
}

/**
 * The bytes a document reader can open: the file itself where it is not
 * sealed — every working file written before ADR-0023, and a JSON document —
 * and otherwise what is inside, once the password is right.
 *
 * A wrong password is asked again with the verdict under the field, as many
 * times as the person cares to try; the loop ends with the right one or with
 * a cancel. `wrong` is the sentence, decided by the caller because that is
 * where the language is.
 */
export async function unsealedBytes(
  bytes: Uint8Array, askPassword: AskPassword, wrong: string,
): Promise<Uint8Array | undefined> {
  if (!isSealed(bytes)) return bytes
  let error: string | undefined
  for (;;) {
    const password = await askPassword('enter', error)
    if (password === undefined) return undefined
    const plain = await unsealBytes(bytes, password)
    if (plain) return plain
    error = wrong
  }
}

/**
 * A folder a working file may become (ADR-0025): what it is called, whether
 * it already holds something, and how to write the file's scopes into it —
 * after which the app moves there. The boot provides one; a host that cannot
 * choose a folder provides none, and the dialog then offers only *here*.
 */
export type WorkingFileDestination = {
  name: string
  occupied: boolean
  place(scopes: readonly ScopeSnapshot[]): Promise<void>
  /** One scope of the new folder as it now reads, for the check after landing (ADR-0023, amended). */
  read?: ReadScope
}

/** One scope as the store now holds it: what a landing is read back through. */
export type ReadScope = (path: ScopePath) => Promise<ScopeSnapshot | undefined>

export type ChooseDestination = () => Promise<WorkingFileDestination | undefined>

/** The two questions, as the shell's dialogs answer them. */
export type LandingPrompts = {
  askDestination(ask: { file: string; here: string; canGoElsewhere: boolean }): Promise<'here' | 'elsewhere' | undefined>
  confirmReplace(name: string): Promise<boolean>
}

export type OpenedWorkingFile = Extract<OpenResult, { ok: true }>

/**
 * Where a working file lands (ADR-0025), asked every time.
 *
 * The file is read first, so a file that is not a working file is refused
 * before anybody is asked anything. *Here* is what opening always did, handed
 * back to the caller because the workspace and the home land a scope
 * differently; a *new folder* is chosen, checked for what it holds — and
 * written over only after a second yes — and then written with the file's
 * top scope as its root, which is what `openDocumentBytes` answers when it is
 * handed a bare root to land on. Every `undefined` and `false` on the way is
 * a cancel, and a cancel is silent.
 */
export async function landWorkingFile(args: {
  name: string
  bytes: Uint8Array
  into: ScopeSnapshot
  prompts: LandingPrompts
  chooseDestination?: ChooseDestination
  /**
   * Land the file on the scope here. `false` is *nothing was landed*, and the
   * caller has said why; anything else is landed, and then checked.
   */
  here: (opened: OpenedWorkingFile) => boolean | void | Promise<boolean | void>
  /**
   * The store *here* writes into, read back after the landing and held to the
   * file's manifest (ADR-0023, amended). Absent where there is no store to
   * read — a test, a tab with nothing to keep a scope in — and the landing is
   * then said as it always was.
   */
  read?: ReadScope
  /**
   * What happens between *Replace here* and the replacing: a snapshot of what
   * is there, where the folder keeps a history (ADR-0025, amended). `false`
   * means it could not be taken, and then nothing is replaced — the person
   * was told a snapshot would be taken, and a replace without one is the loss
   * this dialog exists to prevent.
   */
  beforeReplace?: () => Promise<boolean>
  notify: Notify
  s: Translate
}): Promise<void> {
  const { name, bytes, into, prompts, chooseDestination, here, read, beforeReplace, notify, s } = args
  const opened = openDocumentBytes(bytes, into)
  if (!opened.ok) { notify(s(opened.messageKey), 'error'); return }
  const said = (landed: OpenedWorkingFile, from?: ReadScope) => sayLanding(name, landed, from, notify, s)
  const choice = await prompts.askDestination({
    file: name,
    here: into.model.name.trim() || s('openInto.unnamedHere'),
    canGoElsewhere: chooseDestination !== undefined,
  })
  if (choice === undefined) return
  if (choice === 'here' || !chooseDestination) {
    if (beforeReplace && !(await beforeReplace())) return
    if ((await inPart(() => here(opened), read)) === false) return
    await said(opened, read)
    return
  }
  const destination = await chooseDestination()
  if (!destination) return
  if (destination.occupied && !(await prompts.confirmReplace(destination.name))) return
  const rooted = openDocumentBytes(bytes, bareScope(ROOT_SCOPE, ''))
  if (!rooted.ok) { notify(s(rooted.messageKey), 'error'); return }
  await inPart(() => destination.place([rooted.scope, ...(rooted.rest ?? [])]), destination.read)
  if (destination.read) await said(rooted, destination.read)
}

/**
 * A landing the store wrote in part (`shell.workingFileLandedInPart`: a
 * folder written one file at a time, stopped part way) goes on to the
 * read-back, which says which scopes, views and files did not arrive — in
 * the words of ADR-0023's first amendment, rather than a sentence about the
 * store. Where there is nothing to read back, the store's own sentence is
 * all there is, and it is thrown on.
 */
async function inPart<T>(land: () => T | Promise<T>, read: ReadScope | undefined): Promise<T | undefined> {
  try {
    return await land()
  } catch (cause) {
    if (read && cause instanceof ShellError && cause.key === 'shell.workingFileLandedInPart') return undefined
    throw cause
  }
}

/** What a landing is held to, and whether the file said it or it was made from the file's contents. */
export type LandingCheck = {
  expected: WorkingFileManifest
  /** The file carried a manifest of its own. */
  carried: boolean
  /** `undefined` when everything the file holds arrived. */
  difference?: ManifestDifference
}

/**
 * Read back what a working file landed as, and hold it to the file
 * (ADR-0023, amended).
 *
 * Held to the file's own manifest where it carries one; otherwise — a file
 * saved before there was one — to a manifest made from the scopes the file
 * opened to, with any scope in it that would not open counted as missing.
 * Each scope is read through `read` at the address it was landed at, and a
 * read that fails is a scope that is not there: the question is whether a
 * person can open what they were handed, and a scope that will not read is
 * the answer *no*.
 */
export async function checkLanding(opened: OpenedWorkingFile, read: ReadScope): Promise<LandingCheck> {
  const top = opened.scope.path
  const expected = opened.manifest ?? await ownManifest(opened)
  const landed = (await Promise.all(expected.scopes.map(async (want) => {
    const at = joinScopePath(top, want.path)
    const held = await read(at).catch(() => undefined)
    return held ? [{ ...held, path: at }] : []
  }))).flat()
  const difference = compareManifests(expected, await manifestOf(landed, top))
  return { expected, carried: opened.manifest !== undefined, ...(difference ? { difference } : {}) }
}

/** The manifest a file with none of its own is held to: what it opened to, and what it would not. */
async function ownManifest(opened: OpenedWorkingFile): Promise<WorkingFileManifest> {
  const made = await manifestOf([opened.scope, ...(opened.rest ?? [])])
  const unopened = (opened.unopened ?? []).map((path) => ({
    path, name: path, files: [], views: [],
    counts: {
      elements: 0, relations: 0, views: 0, decisions: 0, plans: 0, observations: 0,
      causes: 0, solutions: 0, experiments: 0, pictures: 0, marks: 0,
    },
  }))
  return { type: MANIFEST_TYPE, version: 1, scopes: [...made.scopes, ...unopened] }
}

/**
 * The toast after a landing: checked and whole, checked and not, or — with
 * nothing to read back — what was always said.
 */
async function sayLanding(
  name: string, opened: OpenedWorkingFile, read: ReadScope | undefined, notify: Notify, s: Translate,
): Promise<void> {
  if (!read) {
    const count = opened.rest?.length ?? 0
    notify(count
      ? s('shell.workingSetLoaded', { name, count: String(count) })
      : s('shell.workingFileLoaded', { name }), 'success')
    return
  }
  const check = await checkLanding(opened, read)
  notify(landingSentence(name, check, s), check.difference ? 'error' : 'success')
}

/** How many of the things that did not arrive are named before *and N more*. */
const NAMED_AT_MOST = 6

/** A check, said: the totals when whole, and what is not there, by name, when not. */
export function landingSentence(name: string, check: LandingCheck, s: Translate): string {
  if (!check.difference) {
    const totals = manifestTotals(check.expected)
    return s(check.carried ? 'shell.workingFileArrived' : 'shell.workingFileArrivedOwn', {
      name, scopes: String(totals.scopes), views: String(totals.views), files: String(totals.files),
    })
  }
  const named = check.expected.scopes
  const scopeName = (path: ScopePath) => named.find((scope) => scope.path === path)?.name ?? path
  const what: string[] = []
  for (const scope of check.difference.scopes) {
    if (scope.absent) {
      what.push(s('shell.shortScope', { name: scope.name, path: scope.path || '/' }))
      continue
    }
    for (const view of scope.views) what.push(s('shell.shortView', { view: view.name, scope: scope.name }))
    if (scope.missingFiles.length) {
      what.push(s('shell.shortFiles', { count: String(scope.missingFiles.length), scope: scope.name }))
    }
    if (scope.changedFiles.length) {
      what.push(s('shell.changedFiles', { count: String(scope.changedFiles.length), scope: scope.name }))
    }
  }
  for (const left of check.difference.omitted) {
    what.push(s('shell.shortOmitted', { count: String(left.files.length), scope: scopeName(left.path) }))
  }
  return s(check.carried ? 'shell.workingFileShort' : 'shell.workingFileShortOwn', { name, what: listed(what, s) })
}

/** A list of things for a sentence, cut after {@link NAMED_AT_MOST} with a count of the rest. */
function listed(items: readonly string[], s: Translate): string {
  if (items.length <= NAMED_AT_MOST) return items.join('; ')
  return [...items.slice(0, NAMED_AT_MOST), s('shell.shortMore', { count: String(items.length - NAMED_AT_MOST) })].join('; ')
}
