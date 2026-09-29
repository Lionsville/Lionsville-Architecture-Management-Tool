// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The working file for a process with no screen (ADR-0031 §2, §4): a server
 * that keeps an organisation in repositories of its own — a database, say —
 * and hands it out as a working file, or takes one in.
 *
 * Nothing here needs a browser, Electron, React or a file system: the bytes
 * come in and go out as bytes, and everything else is asked of the
 * repositories handed in. Hand it the `Repositories` value the server built
 * (or the parts named below) and it reads out of them and writes into them
 * exactly as the app does, through the working file's own interchange.
 *
 * **Sealed files are the caller's.** The app seals what it hands a person
 * under a password (ADR-0023, `projects/sealedFile.ts`); these write the file
 * unsealed and read only one that is not sealed — `isSealed` and
 * `unsealBytes` there open one first, and `sealBytes` closes one after.
 */
import { readWhole } from '../../projects/scopeAccess'
import type { OpenRefusal } from '../../projects/scope'
import type { ScopePath } from '../../projects/scopePath'
import { bringIn, carryOut, check, open } from '../../adapters/folder/format/interchange'
import type { Arrival, BroughtInto, CarriedFrom, CarriedOut } from '../../adapters/folder/format/interchange'

export type { Arrival, CarriedOut }

/**
 * The organisation the repositories hold — or, `from` an address, the scope
 * there and every scope under it — as a working file: its bytes, the name to
 * give it, its media type, and what it was made without. Rejects with a
 * `ShellError` where a scope will not read (`shell.exportUnreadable`) or
 * `from` names none (`shell.scopeGone`).
 */
export function writeWorkingFile(repositories: CarriedFrom, options: { from?: ScopePath } = {}): Promise<CarriedOut> {
  return carryOut(repositories, options.from !== undefined ? { from: options.from } : {})
}

/** What reading one in may also do. */
export type ReadOptions = {
  /** Where the file's top scope lands: the organisation where absent. */
  at?: ScopePath
  /** The subject of an entry recorded of every scope about to be replaced, before anything is. */
  before?: string
  /** The subject of the entry each landed scope's replacing becomes. */
  subject?: string
}

/** A working file read in: the addresses it landed at, top first, and what was found when it was read back. */
export type ReadIn = { landed: readonly ScopePath[]; arrival: Arrival }

/**
 * A working file, landed in the repositories: every scope it holds replaced
 * as one `scope.replace` step each, all in one apply — every scope or none —
 * with each picture's bytes put before the step that names it, then read back
 * and held to what the file says it holds. Bytes that are not a working file
 * are refused with the key that says why, and nothing is written. A landing
 * the repositories refuse (a scope somebody changed meanwhile) rejects with
 * the `ShellError` they refused it with, and no scope's content is written —
 * but the entry `before` asked for was recorded first, and stays: it is the
 * history of what was there, and says nothing that did not happen.
 */
export async function readWorkingFile(
  repositories: BroughtInto, bytes: Uint8Array, options: ReadOptions = {},
): Promise<ReadIn | { refused: OpenRefusal }> {
  const opened = await open(bytes, options.at ?? '')
  if ('refused' in opened) return opened
  await bringIn(repositories, opened, {
    ...(options.before !== undefined ? { before: options.before } : {}),
    ...(options.subject !== undefined ? { subject: options.subject } : {}),
  })
  const arrival = await check(opened, (address) => readWhole(repositories, address))
  return { landed: [opened.top.path, ...opened.rest.map((scope) => scope.path)], arrival }
}
