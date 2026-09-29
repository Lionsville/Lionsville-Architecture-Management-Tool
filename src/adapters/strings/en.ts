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
   * A step refused on a scope a later version of the app wrote
   * (`ScopeState.later`), a put back included: what this version cannot read
   * is somebody's newer work.
   */
  'shell.laterNotReplaced': 'This scope was not changed: a later version of the app wrote it, and this one cannot read all of it. Update the app, and open the scope again.',
  /**
   * A step refused on a scope a part of which did not read
   * (`ScopeState.unreadable`): a change would have written the scope without
   * that part. Putting it back whole is the step it takes, and the sentence
   * names the two ways to one.
   */
  'shell.unreadableNotSaved': 'This scope was not saved: part of it could not be read, and a change would have lost what it holds. Put it back from the history, or bring in a working file.',
  /**
   * A whole write of a scope that somebody else wrote since it was read
   * (`projects/revision.ts`). Nothing was written, which is the point: the
   * sentence says so, and what to do about it.
   */
  'shell.scopeMoved': 'Somebody changed this scope while this was being done, so nothing was written. Open it again and redo the change.',
  /**
   * A record of the history the folder's git is in no state to take: part way
   * through a merge, a rebase, a cherry-pick or a revert, or with a file left
   * unmerged. Nothing was recorded; the person finishes or abandons that first.
   */
  'shell.historyMidway': 'Nothing was recorded: the history of this folder is part way through a merge, a rebase or another change of its own. Finish or abandon that first, then record again.',
  /** A record on a history that is on no branch, where a version would belong to none. Nothing was recorded. */
  'shell.historyDetached': 'Nothing was recorded: the history of this folder is not on a branch, so a version recorded now would belong to none. Switch to a branch first, then record again.',
  /** There is no git on this machine, where the folder's history is kept in git. */
  'shell.gitMissing': 'The history needs git on this machine. Install git, then try again.',
  /**
   * The git on this machine is older than the history needs (2.26): the one
   * minimum the history and the guard over a folder's configuration both say.
   */
  'shell.gitTooOld': 'The history needs git 2.26 or newer on this machine. Update git, then try again.',
  /**
   * A git the app would not run in the folder at all, with the refusal's own
   * words, which name the setting in the folder's configuration
   * (`platform/node/gitGuard.ts`). Set after a sentence that says what did not
   * happen, as the sync's refusals are.
   */
  'shell.gitRefused': 'git was not run in this folder: {reason}',
  /** The history could not be read or written for a reason the trail holds and a person cannot act on here. */
  'shell.historyFailed': 'The history of this folder could not be read or written. The diagnostics say why.',
  /**
   * This browser's database, when it cannot do as it is asked
   * (`webStorage/IndexedDbStore.ts`). Full: the browser refused the write for
   * want of room, and nothing of it landed. Reload: a newer version of the app
   * took the database over in another tab, or the browser lost it for good, so
   * this page writes nothing more until it is loaded again. Blocked: this page
   * waits for another tab that holds an older version open.
   */
  'shell.storageFull': 'This browser has no room left for this app, so nothing was saved. Save a working file, then free some space for this site in the browser’s settings.',
  'shell.storageReload': 'This page can no longer save in this browser: the app was updated in another tab, or the browser let go of its saved work. Reload the page to carry on.',
  'shell.storageBlocked': 'Another tab still has an older version of this app open. Close or reload it, and this one carries on.',
} as const
