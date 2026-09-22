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
import { ROOT_SCOPE } from '../projects/scopePath'
import { isSealed, sealBytes, SEALED_FILE_MEDIA_TYPE, unsealBytes } from '../projects/sealedFile'
import { openDocumentBytes, workingFileBytes, workingFileName } from '../projects/workingFile'
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
  return {
    name: workingFileName(scopes[0]),
    bytes: await sealBytes(workingFileBytes(scopes), password),
    mediaType: SEALED_FILE_MEDIA_TYPE,
  }
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
}

export type ChooseFolderForWorkingFile = () => Promise<WorkingFileDestination | undefined>

/** The two questions, as the shell's dialogs answer them. */
export type LandingPrompts = {
  askDestination(ask: { file: string; here: string; canChooseFolder: boolean }): Promise<'here' | 'folder' | undefined>
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
  chooseFolder?: ChooseFolderForWorkingFile
  here: (opened: OpenedWorkingFile) => void | Promise<void>
  notify: Notify
  s: Translate
}): Promise<void> {
  const { name, bytes, into, prompts, chooseFolder, here, notify, s } = args
  const opened = openDocumentBytes(bytes, into)
  if (!opened.ok) { notify(s(opened.messageKey), 'error'); return }
  const choice = await prompts.askDestination({
    file: name,
    here: into.model.name.trim() || s('openInto.unnamedHere'),
    canChooseFolder: chooseFolder !== undefined,
  })
  if (choice === undefined) return
  if (choice === 'here' || !chooseFolder) { await here(opened); return }
  const destination = await chooseFolder()
  if (!destination) return
  if (destination.occupied && !(await prompts.confirmReplace(destination.name))) return
  const rooted = openDocumentBytes(bytes, bareScope(ROOT_SCOPE, ''))
  if (!rooted.ok) { notify(s(rooted.messageKey), 'error'); return }
  await destination.place([rooted.scope, ...(rooted.rest ?? [])])
}
