// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for what the outside world says when it cannot do as it is asked.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  /**
   * The two refusals a store makes about the address it was handed, rather than
   * about the storage underneath. They travel as keys like everything else: a
   * store has no language of its own, and these used to be English sentences
   * shown verbatim to somebody who had chosen Dutch.
   */
  'shell.badScopePath': 'That scope has no usable address ({path}), so it cannot be saved.',
  /**
   * The folder itself is gone: unplugged, unmounted, renamed out from under us,
   * or a permission withdrawn. Nothing this app can fix and everything the user
   * can, so it says which of the two it is rather than "saving failed".
   */
  'shell.folderUnavailable': 'That folder is not available. Choose it again, or reconnect the drive it is on.',
  /**
   * A save refused because of a file of the scope that did not read: a
   * `model.json` that did not parse, which writing would put an empty model in
   * place of; or a file the read left out, which the save would write over
   * (ADR-0028, amended).
   */
  'shell.unreadableNotSaved': 'This scope was not saved: a file of it could not be read, and saving would have written over it or lost what it holds. Mend the file, or take it back from the history, and open the scope again.',
  /**
   * A whole write of a scope that somebody else wrote since it was read
   * (`projects/revision.ts`). Nothing was written, which is the point: the
   * sentence says so, and what to do about it.
   */
  'shell.scopeMoved': 'Somebody changed this scope while this was being done, so nothing was written. Open it again and redo the change.',
} as const
