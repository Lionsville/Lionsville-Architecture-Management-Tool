// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for what the providers that ship say for themselves: where each
 * keeps work, what it asks a person, and what it answers when that place
 * says no. The app's own words say none of it (ADR-0031 §4); a provider's
 * chrome is where a person is told about their folder, their browser and
 * what either costs them.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  // --- a folder's remote (ADR-0005) ------------------------------------------
  /**
   * The folder and its remote have both moved on. The same two answers the
   * changed-elsewhere notice offers for one scope, scaled up; both keep
   * everything.
   */
  'sync.diverged':
    'This folder and its remote have both moved on. Nothing is merged: choose which version stands. '
    + 'Ours is kept on a branch either way.',
  'sync.takeTheirs': 'Take theirs',
  'sync.keepOurs': 'Keep ours',
  'sync.pulled': 'Up to date with the remote.',
  'sync.pushed': 'Pushed to the remote.',
  'sync.tookTheirs': 'The remote\u2019s version stands; ours is on a branch.',
  'sync.keptOurs': 'Our version stands, recorded as a merge.',
  'sync.noRemote': 'This folder has no remote to sync with.',
  'sync.unreachable': 'The remote could not be reached.',
  'sync.credentials':
    'The remote refused this machine\u2019s credentials. The app asks for none; sign in with your git client.',
  'sync.timeout': 'The remote did not answer in time.',
  'sync.pullRefused': 'The folder was not pulled: {reason}',
  'sync.pushRefused': 'The snapshot was not pushed: {reason}',
  'sync.resolveRefused': 'Nothing was changed: {reason}',

  /**
   * The machine-local scope says out loud that it is not shared: the file
   * sits in the folder, and everything else in the folder travels.
   */
  'prefs.thisMachine': 'THIS FOLDER, ON THIS MACHINE',
  'prefs.thisMachineNote':
    'Kept by this install and not shared \u2014 nothing is written into the folder, and another machine that opens it decides for itself.',
  'prefs.pullOnOpen': 'Pull from the remote when this folder is opened',
  'prefs.pushAfterSnapshot': 'Push after every snapshot',
  /** The entries a folder records before it is pulled, and before its format is brought up to date. */
  'history.beforeSync': 'Before syncing',
  'history.beforeUpgrade': 'Before upgrading the file format',

  // --- the way into a folder -------------------------------------------------
  'folder.body':
    'Pick a folder and this app keeps your projects in it as files you can read, back up, '
    + 'sync and commit. Nothing is kept inside the app itself.',
  'folder.choose': 'Choose a folder…',
  /**
   * The folder pick asks before it copies. Both answers are safe and the body
   * says so: the app keeps its own copy until somebody moves it on purpose.
   */
  'folder.adoptTitle': 'Bring your work into this folder?',
  'folder.adoptBody':
    'Your projects are kept inside the app at the moment. “{name}” can take a copy of '
    + 'them, or open as it is. Nothing is deleted either way — the app keeps its copy until '
    + 'you move it on purpose.',
  'folder.adoptCopy': 'Copy my work in',
  'folder.adoptSkip': 'Open the folder as it is',
  'picker.chooseFolder': 'Choose folder…',
  'picker.changeFolder': 'Work from another folder…',
  'shell.folderNotOpened': 'The folder could not be opened: {message}',
  'shell.sourceFolder': 'Folder · {name}',
  'shell.sourceBrowser': 'In this browser',
  'shell.sourceMemory': 'Not kept anywhere',
  'shell.sourceTipFolder': 'Your projects are files in this folder. Snapshots go into its history.',
  'shell.sourceTipBrowser': 'Your projects are kept in this browser\'s storage. Save a working file to keep them anywhere else.',
  'shell.sourceTipMemory': 'Nothing is being kept: storage refused. Save a working file before you close this tab.',
  'picker.deleteBodyFolder': 'This deletes {name}, everything filed under it, and its folder on disk. A working file you saved elsewhere is not touched.',
  'picker.deleteBodyBrowser': 'This deletes {name} and everything filed under it from this browser. A working file you saved elsewhere is not touched.',
  /** The organisation's subtitle, first sentence: where everything here is kept. */
  'folder.where': 'Everything here is kept as files in the folder above.',
  'browser.where': 'Everything here is kept in this browser.',
  'memory.where': 'Everything here is kept nowhere yet \u2014 save a working file to keep it.',
  'shell.storageNearlyFull':
    'This browser is about {percent}% full for this app. Save your work to a folder or a '
    + 'file before it runs out — a browser stops saving without asking.',
  // --- where a history is kept -----------------------------------------------
  /** Said where a person takes the first snapshot: where the history they are starting is kept. */
  'folder.historyNote': 'Every snapshot you take is recorded in the folder itself, using git \u2014 nothing leaves this machine.',
  'folder.historyNoteBrowser': 'Every snapshot you take is recorded in this browser, beside the folder \u2014 nothing is written into the folder for it.',
  'browser.historyNote': 'Every snapshot you take is recorded in this browser \u2014 nothing leaves this machine.',
  'memory.historyNote': 'Snapshots are kept for as long as this tab is open, and go with it.',

  // --- the work this browser kept before -------------------------------------
  /**
   * The work the older storage kept, and what could not be brought over from
   * it. Both answers keep everything: bringing the older copy over records
   * what is here first, and leaving it brings it over only once it changes.
   */
  'browser.earlierAsking': 'This browser lost the work it kept, and an older copy of it is still here. Bring the older copy back, or carry on from what is here now?',
  'browser.earlierDiverged': '\u201c{path}\u201d changed both here and in this browser\u2019s older copy. Which one stands?',
  'browser.earlierBring': 'Bring the older copy over',
  'browser.earlierLeave': 'Keep what is here',
  'browser.earlierBrought': 'The older copy was brought over; what was here is in the history.',
  'browser.earlierLeft': 'What is here stands. The older copy is brought over only once it changes again.',
  'browser.earlierLeftBehind': 'Some of what this browser kept before could not be read, and is left where it was: {paths}.',
  'browser.earlierRefused': 'Nothing was brought over {paths}: what is here could not be read whole.',

  // --- who made an entry, and what a bringing's entries say -------------------
  /** Kept in a history: the entry's author where no person is named, and its subject. */
  'browser.historyAuthor': 'this browser',
  'memory.historyAuthor': 'this tab',
  'browser.broughtOver': 'Brought over from this browser\u2019s earlier storage',
  'browser.broughtOverAgain': 'Brought over again from this browser\u2019s earlier storage',
  'browser.beforeBringingAgain': 'Before bringing this over again from this browser\u2019s earlier storage',
  /** The work shown from the older storage, where this browser\u2019s database will not open. */
  'browser.shownFromOlder': 'Your work is shown from this browser\u2019s older storage; changes here are not kept. Save a working file to keep them.',
  /** A button of the earlier-work strip, named for the scope it answers about. */
  'browser.earlierBringAt': 'Bring the older copy of \u201c{path}\u201d over',
  'browser.earlierLeaveAt': 'Keep \u201c{path}\u201d as it is here',

  // --- bringing the browser\u2019s work into a folder, as it happens ------------
  'folder.adoptCopying': 'Copying your work into \u201c{name}\u201d\u2026',
  'folder.adoptDone': '{copied} copied into \u201c{name}\u201d.',
  'folder.adoptPartly': '{copied} copied; {failed} could not be copied: {paths}.',
  'folder.adoptFailed': 'Nothing was copied: {message}',
  'folder.adoptClose': 'Close',
} as const
