/**
 * The two conversations around a working file that have a password in them
 * (ADR-0023), written once for the two places that hold one: the workspace,
 * with a scope open, and the home, with nothing open.
 *
 * Both answer `undefined` for a cancel, and a cancel is silent — a person who
 * closed a dialog does not need a toast to say they did.
 */
import type { SavedDocument } from '../ports/DocumentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { isSealed, sealBytes, SEALED_FILE_MEDIA_TYPE, unsealBytes } from '../projects/sealedFile'
import { workingFileBytes, workingFileName } from '../projects/workingFile'
import type { AskPassword } from './usePasswordPrompt'

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
