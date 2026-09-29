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
import type { Arrival, BringOptions, BroughtIn, CarriedOut, Interchange, Opened } from '../ports/Interchange'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { isSealed, sealBytes, SEALED_FILE_MEDIA_TYPE, unsealBytes } from '../projects/sealedFile'
import { ShellError } from '../platform/errors'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'

/**
 * The working set as a sealed file, under a password the person is asked for
 * now. Nothing leaves unsealed: the whole organisation is what this holds,
 * and the save dialog is the last moment anybody is looking. What it holds,
 * and what it says it holds (ADR-0023, amended), is the interchange's
 * (`ports/Interchange.ts`); the seal is the app's.
 */
export async function sealedWorkingFile(
  carried: CarriedOut, askPassword: AskPassword,
): Promise<SavedDocument | undefined> {
  const password = await askPassword('set')
  if (password === undefined) return undefined
  return {
    name: carried.name,
    bytes: await sealBytes(carried.bytes, password),
    mediaType: SEALED_FILE_MEDIA_TYPE,
  }
}

/**
 * What an export was made without, as a sentence — or `undefined` where
 * every scope read whole. The file says the same in its manifest; this is
 * the person being told at the moment they have it in hand.
 */
export function savedWithout(without: readonly string[], s: Translate): string | undefined {
  if (!without.length) return undefined
  return s('shell.savedWorkingFileWithout', { count: String(without.length), files: listed(without, s) })
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
 * What the home's picker offers: whatever the interchange reads, and whatever
 * a browser calls an unknown file too, because the home is where a file
 * handed over by somebody else is opened first.
 */
export function anyWorkingFile(accepts: string): string {
  return `${accepts},application/octet-stream`
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

export type OpenedWorkingFile = Opened

/**
 * The scopes an opened working file brought, written by the shell, which owns
 * the store — the file's top put back over a scope that could not be read
 * whole only where `putBack` says the person asked for that
 * (`BringOptions.putBack`). Answers what it set aside first.
 */
export type AdoptScopes = (opened: OpenedWorkingFile, options?: Pick<BringOptions, 'putBack'>) => Promise<BroughtIn | void>

/**
 * Where a working file lands (ADR-0025), asked every time.
 *
 * The file is read first, so a file that is not a working file is refused
 * before anybody is asked anything. *Here* is what opening always did, handed
 * back to the caller because the workspace and the home land a scope
 * differently; a *new folder* is chosen, checked for what it holds — and
 * written over only after a second yes — and then written with the file's
 * top scope as its root, which is what the interchange opens it as when it
 * is asked to place it at the root. Every `undefined` and `false` on the way
 * is a cancel, and a cancel is silent.
 */
export async function landWorkingFile(args: {
  name: string
  bytes: Uint8Array
  into: ScopeSnapshot
  /** What reads the file, and holds a landing to it. */
  interchange: Pick<Interchange, 'open' | 'check'>
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
  const { name, bytes, into, interchange, prompts, chooseDestination, here, read, beforeReplace, notify, s } = args
  const opened = await interchange.open(bytes, into.path)
  if ('refused' in opened) { notify(s(opened.refused), 'error'); return }
  const said = (landed: OpenedWorkingFile, from?: ReadScope) => sayLanding(name, landed, from, interchange, notify, s)
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
  const rooted = await interchange.open(bytes, ROOT_SCOPE)
  if ('refused' in rooted) { notify(s(rooted.refused), 'error'); return }
  await inPart(() => destination.place([rooted.top, ...rooted.rest]), destination.read)
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

/**
 * The toast after a landing: checked and whole, checked and not, or — with
 * nothing to read back — what was always said.
 */
async function sayLanding(
  name: string, opened: OpenedWorkingFile, read: ReadScope | undefined,
  interchange: Pick<Interchange, 'check'>, notify: Notify, s: Translate,
): Promise<void> {
  if (!read) {
    const count = opened.rest.length
    notify(count
      ? s('shell.workingSetLoaded', { name, count: String(count) })
      : s('shell.workingFileLoaded', { name }), 'success')
    return
  }
  const arrival = await interchange.check(opened, read)
  notify(landingSentence(name, arrival, s), arrival.short ? 'error' : 'success')
}

/** How many of the things that did not arrive are named before *and N more*. */
const NAMED_AT_MOST = 6

/** A check, said: the totals when whole, and what is not there, by name, when not. */
export function landingSentence(name: string, arrival: Arrival, s: Translate): string {
  if (!arrival.short) {
    const { totals } = arrival
    return s(arrival.accounted ? 'shell.workingFileArrived' : 'shell.workingFileArrivedOwn', {
      name, scopes: String(totals.scopes), views: String(totals.views), files: String(totals.parts),
    })
  }
  const scopeName = (address: ScopePath) => arrival.scopes.find((scope) => scope.address === address)?.name ?? address
  const what: string[] = []
  for (const scope of arrival.short.scopes) {
    if (scope.absent) {
      what.push(s('shell.shortScope', { name: scope.name, path: scope.address || '/' }))
      continue
    }
    for (const view of scope.views) what.push(s('shell.shortView', { view: view.name, scope: scope.name }))
    if (scope.missing) what.push(s('shell.shortFiles', { count: String(scope.missing), scope: scope.name }))
    if (scope.changed) what.push(s('shell.changedFiles', { count: String(scope.changed), scope: scope.name }))
  }
  for (const left of arrival.short.omitted) {
    what.push(s('shell.shortOmitted', { count: String(left.parts), scope: scopeName(left.address) }))
  }
  return s(arrival.accounted ? 'shell.workingFileShort' : 'shell.workingFileShortOwn', { name, what: listed(what, s) })
}

/** A list of things for a sentence, cut after {@link NAMED_AT_MOST} with a count of the rest. */
function listed(items: readonly string[], s: Translate): string {
  if (items.length <= NAMED_AT_MOST) return items.join('; ')
  return [...items.slice(0, NAMED_AT_MOST), s('shell.shortMore', { count: String(items.length - NAMED_AT_MOST) })].join('; ')
}
