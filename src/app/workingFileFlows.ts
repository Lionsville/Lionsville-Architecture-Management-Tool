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
import { plural } from '../i18n/strings'
import type { Translate } from '../i18n'
import type { SavedDocument } from '../ports/DocumentGateway'
import type { Arrival, BringOptions, BroughtIn, CarriedOut, Interchange, Opened } from '../ports/Interchange'
import type { CarriedPeople } from '../ports/ProviderParts'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { isSealed, sealBytes, SEALED_FILE_MEDIA_TYPE, unsealBytes } from '../projects/sealedFile'
import { ShellError } from '../platform/errors'
import type { AskPassword } from './usePasswordPrompt'
import type { Notify } from './useToasts'

/** What a person chose about a copy before it is made: with the register's names, or without (ADR-0036 §8). */
export type CarryChoice = { withoutNames?: boolean }

/**
 * The working set as a sealed file, under a password the person is asked for
 * now. Nothing leaves unsealed: the whole organisation is what this holds,
 * and the save dialog is the last moment anybody is looking. What it holds,
 * and what it says it holds (ADR-0023, amended), is the interchange's
 * (`ports/Interchange.ts`); the seal is the app's.
 *
 * Carried before anybody is asked, so a copy that cannot be made is said
 * before a password is typed; and carried again where the person says, in
 * the same dialog, that it leaves *without names*: every person in the
 * register as their pseudonym (ADR-0036 §8). The file answered is the one
 * handed over, with what it was made without.
 */
export async function sealedWorkingFile(
  carry: (choice: CarryChoice) => Promise<CarriedOut>, askPassword: AskPassword,
): Promise<{ doc: SavedDocument; carried: CarriedOut } | undefined> {
  const named = await carry({})
  const answer = await askPassword('set')
  if (answer === undefined) return undefined
  const carried = answer.withoutNames ? await carry({ withoutNames: true }) : named
  return {
    carried,
    doc: {
      name: carried.name,
      bytes: await sealBytes(carried.bytes, answer.password),
      mediaType: SEALED_FILE_MEDIA_TYPE,
    },
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
  bytes: Uint8Array, askPassword: AskPassword, wrong: string, file?: string,
): Promise<Uint8Array | undefined> {
  if (!isSealed(bytes)) return bytes
  let error: string | undefined
  for (;;) {
    const answer = await askPassword('enter', error, file)
    if (answer === undefined) return undefined
    const plain = await unsealBytes(bytes, answer.password)
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
  /** The scopes written as one, then the register the file carries, where it carries one (ADR-0036 §8). */
  place(scopes: readonly ScopeSnapshot[], people?: CarriedPeople): Promise<void>
  /** One scope of the new folder as it now reads, for the check after landing (ADR-0023, amended). */
  read?: ReadScope
}

/** One scope as the store now holds it: what a landing is read back through. */
export type ReadScope = (path: ScopePath) => Promise<ScopeSnapshot | undefined>

export type ChooseDestination = () => Promise<WorkingFileDestination | undefined>

/** Where a file should go: what it holds, and what would happen here. */
export type DestinationQuestion = {
  file: string
  here: string
  canGoElsewhere: boolean
  puttingBack?: boolean
  /** What the file calls itself and what it holds, in words. */
  holdsName?: string
  holds?: string
  /** How many scopes are filed under what is here. */
  below?: number
  /** A snapshot is taken first, so *here* can be restored from History. */
  keepsHistory?: boolean
  /** Saving a copy of what is here first can be offered. */
  canSaveCopyFirst?: boolean
}

/** The two questions, as the shell's dialogs answer them. */
export type LandingPrompts = {
  /**
   * `puttingBack` where what is here could not be read whole, and replacing
   * it is putting it back from the file, keeping what could not be read
   * (`ScopeState.unreadable`).
   */
  askDestination(ask: DestinationQuestion): Promise<'here' | 'elsewhere' | 'copyFirst' | undefined>
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
  /** What is here could not be read whole, and landing the file here puts it back, as the question says. */
  puttingBack?: boolean
  /** Nothing has been made here yet, so there is nothing to ask: the file just opens. */
  untouched?: boolean
  /** How many scopes are filed under what is here. */
  below?: number
  /** Whether *here* can be restored from a history afterwards; the safeguard alone where not said. */
  keepsHistory?: () => Promise<boolean>
  /** Save a copy of what is here first, where the question offers it; answers once that is done or cancelled. */
  saveCopyFirst?: () => Promise<void>
  notify: Notify
  s: Translate
}): Promise<void> {
  const { name, bytes, into, interchange, prompts, chooseDestination, here, read, beforeReplace, notify, s } = args
  const opened = await interchange.open(bytes, into.path)
  if ('refused' in opened) { notify(s(opened.refused), 'error'); return }
  const said = (landed: OpenedWorkingFile, from?: ReadScope) => sayLanding(name, landed, from, interchange, notify, s)
  if (args.untouched) {
    if ((await inPart(() => here(opened), read)) === false) return
    await said(opened, read)
    return
  }
  const question = await destinationQuestion(args, opened)
  let choice = await prompts.askDestination(question)
  // Saving what is here first comes back to the question, with the same words.
  while (choice === 'copyFirst') {
    await args.saveCopyFirst?.()
    choice = await prompts.askDestination(question)
  }
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
  // The register goes with the scopes, as it does landing here: a new folder without it reads every picked name as nobody.
  const people = rooted.people?.length || rooted.removed?.length
    ? { people: rooted.people ?? [], removed: rooted.removed ?? [], ...(rooted.distinct?.length ? { distinct: rooted.distinct } : {}) }
    : undefined
  await inPart(() => destination.place([rooted.top, ...rooted.rest], people), destination.read)
  if (destination.read) await said(rooted, destination.read)
}

/** The question, for this place only: what the file holds and what would happen here. */
async function destinationQuestion(args: Parameters<typeof landWorkingFile>[0], opened: OpenedWorkingFile): Promise<DestinationQuestion> {
  const { name, into, chooseDestination, beforeReplace, s } = args
  const keeps = args.keepsHistory ? await args.keepsHistory() : beforeReplace !== undefined
  return {
    file: name,
    here: into.model.name.trim() || s('openInto.unnamedHere'),
    canGoElsewhere: chooseDestination !== undefined,
    holdsName: opened.top.model.name.trim() || name,
    holds: holdsInWords(opened, s),
    below: args.below ?? 0,
    ...(keeps ? { keepsHistory: true } : {}),
    ...(args.saveCopyFirst ? { canSaveCopyFirst: true } : {}),
    ...(args.puttingBack ? { puttingBack: true } : {}),
  }
}

/** What an opened file holds, as the question says it. */
export function holdsInWords(opened: OpenedWorkingFile, s: Translate): string {
  const all = [opened.top, ...opened.rest]
  const views = all.reduce((sum, scope) => sum + scope.model.diagrams.length, 0)
  return s('openInto.holds', { scopes: plural(s, { one: 'org.scopesOne', other: 'org.scopesOther' }, all.length), views: plural(s, { one: 'seal.viewsOne', other: 'seal.viewsOther' }, views) })
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
      name, files: String(totals.parts),
      scopes: plural(s, { one: 'org.scopesOne', other: 'org.scopesOther' }, totals.scopes),
      views: plural(s, { one: 'seal.viewsOne', other: 'seal.viewsOther' }, totals.views),
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
