// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for the shell around the editor: the picker, the toolbar, the dialogs, the toasts.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  /** The rail pack's picker heading. The pack is registered in composition.ts. */
  'logo.category.rail': 'Rail',

  // --- the shell around the editor -----------------------------------------
  'shell.nothingToUndo': 'Nothing to undo',
  'shell.nothingToRedo': 'Nothing to redo',
  'shell.saved': 'Saved {time}',
  'shell.notSaved': 'Not saved yet',
  /**
   * The third state of the same indicator. Distinct from `shell.notSaved`,
   * which means "nothing has happened yet": this one means a write was refused,
   * and it replaces a last-successful time that would otherwise be older than
   * the work on screen and read as reassurance.
   */
  'shell.saveRefused': 'Not saved — the change was refused',
  /**
   * The rest of the same indicator, once saving is a state machine and not a
   * timestamp (ADR-0003). Each one is a different answer to "can I close this
   * window now", which is the only question the bar is really being asked.
   */
  'shell.unsaved': 'Unsaved changes',
  'shell.saving': 'Saving…',
  'shell.savingBeforeClose': 'The window closes as soon as your changes are written.',
  'shell.changedElsewhere': 'Changed elsewhere',
  'shell.conflict': 'Changed here and elsewhere',
  /**
   * The same indicator for a source whose changes travel as steps: there is
   * no save, so no time — what is still on its way, and when it has all gone.
   */
  'shell.stepsSending': 'Sending\u2026',
  'shell.stepsSent': 'All changes sent',
  /**
   * The strip above the canvas when the folder has a second author. Two
   * sentences and three buttons, because the app genuinely cannot choose: there
   * is no merge, only which version survives.
   */
  'shell.changedThere': 'This scope changed elsewhere. Nothing here is unsaved.',
  /**
   * A scope a part of which did not read — its model, a mark its header names
   * (`ScopeSnapshot.unreadable`, ADR-0028). What was read is shown and nothing
   * may be changed, because a change would write the scope without that part;
   * but it can be put back whole (`ScopeState.unreadable`), and the notice
   * says the two ways, which are its buttons. A source that has more to say —
   * a file a person can mend — says it in its own words (`unreadableKey`).
   */
  'shell.unreadableScope': '{files} in this scope could not be read, so it is open to be looked at and not changed: a change would lose what it holds. Put it back from the history, or bring in a saved file.',
  /** A scope a later version of the app wrote (`ScopeState.later`): nothing here changes it, or puts it back. */
  'shell.unreadableLater': 'A later version of the app wrote this scope, and this one cannot read all of it ({files}), so it is open to be looked at and not changed. Update the app to change it.',
  'shell.putBackFromHistory': 'Put back from the history…',
  'shell.bringInWorkingFile': 'Bring in a saved file…',
  /**
   * A move refused because a file of a scope in it could not be read: the
   * old folder is removed after the move, and that file would go with it.
   */
  'shell.unreadNotMoved': 'This scope was not moved: a file in it could not be read, and moving would have removed it with the old folder. Mend the file, or take it back from the history, and try again.',
  /**
   * A scope created, or moved, at an address the listing could not read: a
   * scope is there whose `scope.json` would not read or is not one this build
   * reads (`ScopeSummary.unreadable`), and writing would have replaced it.
   */
  'shell.unreadableInTheWay': 'Nothing was written there: a scope that could not be read is already at that address, and writing would have replaced it. Mend its scope.json, or take it back from the history, and try again.',
  /**
   * A change refused because the scope is only read: a viewer's, or one a
   * file of which did not read. Said by the session, whichever way the change
   * came in, so a control that forgot to hide itself still changes nothing.
   */
  'shell.readOnlyRefused': 'This scope is open to be read and not changed, so nothing was done.',
  'shell.conflictThere': 'This scope changed elsewhere, and there are unsaved changes here.',
  'shell.unsettledFirst': 'This scope changed elsewhere while changes here are unsaved. Choose which version stands on the bar first.',
  'shell.takeTheirs': 'Take theirs',
  'shell.keepMine': 'Keep mine',
  'shell.saveACopy': 'Save a copy…',
  /**
   * A change where work is kept would not take, in words that name no place:
   * what is said for a source that gave no sentence of its own
   * (`SourceProvider.keepFailedKey`). The refusal's reason follows it.
   */
  'shell.keepFailed': 'Where your work is kept did not take the change, so it is not saved.',
  'shell.keptAgain': 'Saving works again.',
  /** A refusal's reason where it came with no sentence of ours: its own words. */
  'shell.refusalSaid': 'It said: {message}',
  /** The toast's way to the two ways out (Try again, Put back). */
  'work.seeYourWork': 'See Your work',
  /**
   * The same sentence for a source that is not a folder: a way in a
   * registered provider offered, pressed, and gone nowhere. It says nothing
   * about where the work would have been kept, because only the provider
   * knows and this is the shell talking.
   */
  'shell.sourceNotOpened': 'That source could not be opened: {message}',
  'shell.sourceNotOpenedFault': 'That source could not be opened: something went wrong in the app. Reload, and report it if it happens again.',
  'shell.problemDetails': 'Details',
  /**
   * The crash fallback. One key for both boundaries — the one around the whole
   * app and the one around the canvas — because what the reader can do about it
   * is the same either way.
   */
  'shell.crashed': 'Something went wrong on this screen.',
  'shell.crashedNote':
    'Your work up to the last save is still there. Reload to carry on; the diagnostics say what happened.',
  'shell.reload': 'Reload',
  'shell.copyDiagnostics': 'Copy diagnostics',
  'shell.diagnosticsCopied': 'Copied',
  'shell.copyFailed': 'Could not copy',
  /**
   * Boot. Reading the preferences or the last project can fail before there is
   * an app to put a toast in — and a boot that fails the same way on every
   * reload is an app nobody can get back into, which is why the way out is a
   * button rather than advice.
   */
  'shell.bootFailed': 'The app could not start.',
  'shell.bootFailedNote': 'Reading your settings or the scope you had open did not work. Starting without that scope usually gets you back in; nothing is deleted.',
  'shell.startFresh': 'Start without the last scope',
  /** A throw nobody caught. Throttled: a broken loop must not paper the screen. */
  'shell.unexpectedError': 'Something unexpected went wrong. If the screen stops responding, reload the page.',
  'shell.orphanOne':
    'Container view “{name}” was deleted: its application left the model. Undo does not bring that view back.',
  'shell.orphanOther':
    '{count} container views were deleted: their applications left the model. Undo does not bring those views back.',
  'shell.duplicated': '“{name}” duplicated.',
  'shell.deleted': '“{name}” deleted.',
  'shell.undoPassed': 'Other changes came after it. Undo those first, or bring the view back from History.',
  /**
   * A count and what it counts, with no grammar between them. The label is a
   * relation's type or an element's kind, translated from the table its module
   * publishes, and no language has to pluralise a word it is handed.
   */
  'shell.leftOutPart': '{count} × {label}',
  'shell.savedPicture': 'Picture saved.',
  'shell.savedWorkingFile': 'Saved {name}.',
  'shell.downloadedWorkingFile': 'Downloaded {name} to your Downloads folder.',
  /**
   * The password a working file leaves under, and the one it is opened with
   * (ADR-0023). `seal.wrong` does double duty on purpose: a wrong password and
   * a damaged file are one answer from the cipher, and one next move.
   */
  'seal.setTitle': 'Save a copy of {name}',
  'seal.setBody': 'The whole organisation in one file: {holds}. It carries everything, whichever screen you are on.',
  'seal.enterTitle': 'Open {name}',
  'seal.enterBody': 'This file was saved with a password.',
  'seal.password': 'Password',
  'seal.repeat': 'Repeat the password',
  'seal.mismatch': 'The two do not match.',
  'seal.wrong': 'That password does not open this file. Check it and try again. If it keeps failing, the file may be damaged.',
  'seal.confirmSet': 'Choose where to save…',
  'seal.confirmDownload': 'Download…',
  'seal.confirmEnter': 'Open',
  'seal.setWarning': 'Nothing can recover a lost password. Whoever opens the file needs it too.',
  'seal.withoutNames': 'Every person leaves as their pseudonym, with no address. Signed decisions lose the names they were signed with, and observations lose who recorded them.',
  /**
   * Where a working file goes (ADR-0025): a folder of its own, or over what
   * is open here — said before anything is written, every time.
   */
  'openInto.title': 'Where should “{name}” go?',
  'openInto.body': 'A working file is a whole organisation. It can become a working folder of its own, or replace what is open here.',
  'openInto.hereWarning': 'Replacing writes over “{scope}” and every scope filed under it. Where a history is kept here, a snapshot is taken first and what is there now can be restored from it; where none is, what is there now is gone.',
  /** Over a scope that could not be read whole: replacing it is putting it back (`ScopeState.unreadable`). */
  'openInto.herePutsBack': '“{scope}” could not be read whole; this puts it back from the file, and keeps what could not be read.',
  'openInto.here': 'Replace “{scope}” here',
  'openInto.elsewhere': 'A new folder…',
  'openInto.unnamedHere': 'the working folder',
  'openInto.occupiedTitle': 'This folder is not empty',
  'openInto.occupiedBody': 'The folder already holds “{name}”. Opening the file there writes over it.',
  'openInto.occupiedConfirm': 'Write over {name}',
  'shell.workingFileLoaded': 'Saved copy “{name}” loaded.',
  'shell.workingSetLoaded': 'Saved copy “{name}” loaded, with {count} scopes filed under it.',
  'shell.workingFileArrived': 'Opened {name}: {scopes}, {views}, all there.',
  'shell.workingFileArrivedOwn': 'Opened {name}: {scopes}, {views}, all there. An older version saved it, so it was checked against what it holds.',
  'shell.workingFileShort': 'Saved copy “{name}” did not arrive whole. Not there after loading: {what}.',
  'shell.workingFileShortOwn': 'Saved copy “{name}” did not arrive whole. It has no manifest, because an older version saved it, so it was checked against what it holds. Not there after loading: {what}.',
  'shell.workingFilePartMissing': 'The part of the app that reads and writes saved copies did not load: this page may be older than the app on the server, or the connection is gone. Nothing was changed. Keep your work, then reload the page and try again.',
  'shell.workingFileNotLanded': 'The saved copy was not loaded, and nothing of it was written: every scope in it lands together or none does. {reason}',
  'shell.workingFileLandedInPart': 'Only part of the saved copy may have been written: this folder is written one file at a time, and the writing stopped part way. {reason}',
  'shell.shortScope': 'the scope “{name}” ({path})',
  'shell.shortView': 'the view “{view}” in “{scope}”',
  'shell.shortFiles': '{count} files of “{scope}”',
  'shell.changedFiles': '{count} files of “{scope}” that arrived different',
  'shell.shortOmitted': '{count} files “{scope}” was saved without, because they would not read',
  'shell.shortMore': 'and {count} more',
  'shell.exportUnreadable': 'The saved copy was not saved: {paths} could not be read, and a file without them would not be the whole organisation.',
  'shell.savedWorkingFileWithout': 'Copy saved under your password, without {count} files that would not read: {files}. The file says so, and opening it will say so again.',
  'shell.workingSetNotHere': 'This file holds a whole organisation, which can only be opened into a folder.',
  'shell.processFailed': 'The document could not be processed: {message}',
  /**
   * A save that did not happen. Separate from `shell.notSaved`, which is the
   * toolbar's standing indicator: this one is about the file you just asked for.
   */
  'shell.saveFileFailed': 'The file could not be saved: {message}',
  /**
   * A move is save-then-remove, in that order — removing first and then failing
   * to save would lose the project outright. When the remove is the half that
   * fails, the project is filed twice, and saying nothing would leave the user
   * to discover a duplicate in the picker later.
   */
  'shell.moveLeftCopy': 'Moved — but the copy in the old group could not be removed: {message}',
  /**
   * Renaming a group relabels every project under it, and the sweep can fail
   * partway. Naming what it did not reach is the difference between a job half
   * done and a job half done in silence.
   */
  'shell.newDiagram': 'New landscape',
  'shell.newSheet': 'Business architecture',
  'shell.newMap': 'Coverage',
  'shell.newTechnology': 'Technology landscape',
  'shell.newDrawing': 'Drawing',
  'shell.newChart': 'Organisation chart',
  'shell.newConway': 'Conway map',
  'shell.drawingOf': '{name} · drawing',
  'shell.drawingNotDrawn': 'Nothing drawn yet',
  /** The palette the editor opens with: the scope's elements. */
  'shell.drawingElements': 'Elements',
  /** A file exported from the editor, once it is where the person said. */
  'shell.drawingExported': '{name} saved.',
  'shell.drawingPrintFailed': 'This drawing could not be printed.',
  /** What the frame sent was not a file this side knows how to save. */
  'shell.drawingExportFailed': 'The editor sent no file that could be saved.',
  /** A shape on the picture that points at an element: what the area is called. */
  'shell.drawingOpenElement': 'Open {name}',
  'shell.add': 'Add',
  'shell.imagesMissing': 'PNG exported, but these logos are missing: {labels}.',
  'shell.logoAdded': 'Logo “{name}” added to your own library.',
  /** The name a duplicated diagram gets, right after the original. */
  'shell.copyOf': '{name} (copy)',
  /** The name a newly created container view gets. */
  'shell.containerDiagram': '{name} · containers',
  'shell.deleteDiagramTitle': 'Delete view “{name}”?',
  /** What deleting a view takes with it, said of its own kind: a laid-out view loses nothing but itself. */
  'shell.deleteBody.layer7':
    'The placements, groups and routes of this landscape are lost. The elements themselves stay in the model, and container views remain.',
  'shell.deleteBody.container':
    'The containers on this view go with it, and the interfaces they carried move up to the application. The application itself stays on the landscape.',
  'shell.deleteBody.sheet':
    'The sheet goes, with where its blocks were placed on its poster. The functions, steps and stakeholders on it stay in the model.',
  'shell.deleteBody.map':
    'The map goes. It is laid out from the functions and the rows, which all stay in the model.',
  'shell.deleteBody.technology':
    'The technology landscape goes. It is read from the records, so every application, service and platform on it stays in the model.',
  'shell.deleteBody.drawing':
    'The drawing goes, with everything drawn on it. What it points at stays in the model.',
  'shell.deleteBody.chart':
    'The organisation chart goes. It is laid out from the units, so every unit, role and assignment on it stays.',
  'shell.deleteBody.conway':
    'The Conway map goes. It is read from the units and the applications they own, which all stay in the model.',
  /**
   * What you are working from — the first thing on the bar, because it was
   * the one thing the bar did not say (ADR-0005). A folder by its name: the
   * name is what the person called it in their file manager.
   */
  /**
   * The bar's way back. Each scope above the open one is a crumb, and the
   * organisation is the first: pressing one lands on that scope's home.
   */
  'shell.chooseBoard': 'Which board?',
  'shell.chooseBoardHint': '{name} is drawn on more than one board.',
  'shell.chooseBoardAsOf': 'As of {day}',
  'shell.crumbTip': 'Go to {name}',
  'shell.crumbsBetween': 'Scopes in between',
  'shell.exampleCopied': 'Example “{name}” copied to an organisation of your own.',
  /**
   * Where the projects are kept, on a desktop that can say. The folder's own
   * name and not its path: the path is long, and the name is what the user
   * called it in their file manager.
   */
  /**
   * The desktop's first screen. There is no "somewhere in the app" on the
   * desktop any more, so this is not an offer — it is the question that has to
   * be answered before there is anything to show.
   */
  // --- history (ADR-0003, layer two) ---------------------------------------
  /**
   * A snapshot is a commit, and the words avoid saying so. "Commit" is exact
   * and means nothing to half the people this tool is for; a snapshot is what
   * the act IS, and the person who knows git will recognise it anyway.
   */
  'history.since': 'Since this snapshot: {what}',
  'history.nAdded': '{count} added',
  'history.nRemoved': '{count} removed',
  'history.nChanged': '{count} changed',
  'history.nMoved': '{count} moved on the board',
  'history.repeated': '{line} ({count} times)',
  'history.lockedDecision': 'This decision is {status}, so it stays as it is. To change it, write one that replaces it.',
  'history.when': 'When',
  'history.who': 'Who',
  'history.labels': 'Labels',
  'history.title': 'History',
  'history.snapshot': 'Snapshot…',
  'history.open': 'History…',
  'history.start': 'Start keeping history',
  'history.startBody': 'Nothing here keeps a history yet. The first snapshot starts one.',
  'history.message': 'What changed',
  /** When this session's log has nothing in it; the folder may still have. */
  'history.defaultMessage': 'Snapshot',
  'history.take': 'Take snapshot',
  'history.taken': 'Snapshot taken.',
  'history.nothingToRecord': 'Nothing has changed since the last snapshot.',
  'history.beforeReplace': 'Before a saved copy replaced this',
  'history.takenBeforeReplace': 'A snapshot was taken first: what was here can be restored from the history.',
  'history.failedBeforeReplace': 'Nothing was replaced: a snapshot of what is here could not be taken first. {message}',
  'history.failed': 'The snapshot could not be taken: {message}',
  'history.readFailed': 'The history could not be read: {message}',
  'history.none': 'No snapshots yet.',
  'history.unavailable': 'No history can be kept here. Everything else works as before.',
  'history.unchanged': 'Nothing has changed since this snapshot.',
  'history.gone': 'This scope did not exist yet at that snapshot.',
  'history.by': '{author}',
  'history.subject': 'Show the history of',
  'history.everything': 'The whole scope',
  /**
   * Where a subject's history is coming from, when it is more than one scope
   * (ADR-0012 §7): an element's page is filed in every scope that holds the
   * id, and the list is the union of those files' commits.
   */
  'history.everywhere': 'Everywhere this is drawn: {scopes}',
  'history.restorePerScope': 'A restore puts back what this scope holds. The other scopes’ pages are theirs to restore.',
  'history.diagrams': 'Views',
  'history.descriptions': 'Descriptions',
  'history.decisions': 'Decisions',
  'history.noneFor': 'No snapshot has touched this yet.',
  'history.unchangedFor': 'This has not changed since this snapshot.',
  'history.restore': 'Restore this version…',
  'history.restoreProject': 'Restore the whole scope…',
  'history.restoreTitle': 'Restore {name} as of {date}?',
  'history.restoreProjectTitle': 'Restore the whole scope as of {date}?',
  'history.restoreBody':
    'This makes {name} what it was at that snapshot, as a new change — the history keeps everything that happened since, and this step goes on top of it. It can be undone with {key:Mod+Z} until the next snapshot records it.',
  'history.restoreProjectBody':
    'Every element, connection, diagram and decision becomes what it was at that snapshot, as one new change on top of everything that happened since. Decisions that have been accepted, rejected or superseded stay as they are. It can be undone with {key:Mod+Z} until the next snapshot records it.',
  'history.restoreConfirm': 'Restore',
  'history.restored': 'Restored {name} as of {date}.',
  'history.restoredProject': 'Restored the whole scope as of {date}.',
  'history.restoredDropped': ' {count} placed elements no longer exist and were left out.',
  'history.restoredKept': ' {count} locked decisions were left as they are.',
  /**
   * Going back on a scope that could not be read whole: the whole scope put
   * back as the snapshot held it (`projects/putBack.ts`), not a restore.
   */
  'history.beforePutBack': 'Before it was put back from the history',
  'history.putBack': 'Put back the whole scope…',
  'history.putBackTitle': 'Put the whole scope back as it was on {date}?',
  'history.putBackBody':
    'Part of this scope could not be read. This makes all of it what it was at that snapshot, the part that could not be read included, and it can be changed again afterwards. What could not be read is kept first — as an entry of the history, or set aside beside the scope — and where it cannot be, nothing is put back.',
  'history.putBackConfirm': 'Put back',
  'history.putBackDone': 'The scope is back as it was on {date}, and reads whole again.',
  'history.putBackSetAside': ' What could not be read was set aside first, beside the scope: {files}.',
  'history.putBackKept': ' An entry of the scope as it stood, what could not be read included, was recorded first.',
  /** An entry that kept what could not be read of its scope (`HistoryEntry.unread`), saved as a file of the person's own. */
  'history.saveUnread': 'Save what could not be read…',
  'history.savedUnread': 'Saved what could not be read.',
  'history.putBackWithout': ' {count} pictures it held then are no longer kept, and were left out.',
  'history.putBackFailed': 'The scope was not put back: {message}',
  'history.snapshotNow': 'Snapshot',
  'history.label': 'Label…',
  'history.labelTitle': 'Label this snapshot',
  'history.labelBody':
    'A word for this version — “Shown to the board” — kept beside the message, never instead of it. It travels with the history, so a colleague sees the same mark in the same place.',
  'history.labelField': 'Label',
  'history.labelConfirm': 'Label',
  'history.labelled': 'Labelled.',
  'history.labelFailed': 'The label could not be added: {reason}',
  'history.labelExists': 'A label with that name is already here. Pick another word.',
  'history.labelUnnamed': 'A label needs a word in it.',

  // The sentences a change becomes. One per kind and subject, because "Added"
  // and "Added the diagram" are different facts and a shared word would make
  // the list read like a database.
  'change.elementAdded': 'Added {name}',
  'change.elementRemoved': 'Deleted {name}',
  'change.elementChanged': 'Changed {name} ({fields})',
  'change.connectionAdded': 'Drew {name}',
  'change.connectionRemoved': 'Cut {name}',
  'change.connectionChanged': 'Changed {name} ({fields})',
  'change.rowAdded': 'Drew a row ({type}): {name}',
  'change.rowRemoved': 'Cut a row ({type}): {name}',
  'change.rowChanged': 'Changed a row ({type}): {name} ({fields})',
  'change.diagramAdded': 'Added the view {name}',
  'change.diagramRemoved': 'Deleted the view {name}',
  'change.diagramChanged': 'Changed the view {name} ({fields})',
  'change.decisionAdded': 'Added the decision {name}',
  'change.decisionRemoved': 'Deleted the decision {name}',
  'change.decisionChanged': 'Changed the decision {name} ({fields})',
  'change.transitionAdded': 'Added the plan {name}',
  'change.transitionRemoved': 'Deleted the plan {name}',
  'change.transitionChanged': 'Changed the plan {name} ({fields})',
  'change.observationAdded': 'Recorded the observation {name}',
  'change.observationRemoved': 'Deleted the observation {name}',
  'change.observationChanged': 'Changed the observation {name} ({fields})',
  'change.causeAdded': 'Added the cause {name}',
  'change.causeRemoved': 'Deleted the cause {name}',
  'change.causeChanged': 'Changed the cause {name} ({fields})',
  'change.solutionAdded': 'Added the solution {name}',
  'change.solutionRemoved': 'Deleted the solution {name}',
  'change.solutionChanged': 'Changed the solution {name} ({fields})',
  'change.experimentAdded': 'Added the experiment {name}',
  'change.experimentRemoved': 'Deleted the experiment {name}',
  'change.experimentChanged': 'Changed the experiment {name} ({fields})',
  'change.unitTypeAdded': 'Added the unit type {name}',
  'change.unitTypeRemoved': 'Deleted the unit type {name}',
  'change.unitTypeChanged': 'Changed the unit type {name} ({fields})',
  'change.roleAdded': 'Added the role {name}',
  'change.roleRemoved': 'Deleted the role {name}',
  'change.roleChanged': 'Changed the role {name} ({fields})',
  'change.responsibilityAdded': 'Added the responsibility {name}',
  'change.responsibilityRemoved': 'Deleted the responsibility {name}',
  'change.responsibilityChanged': 'Changed the responsibility {name} ({fields})',
  'change.operatingRuleAdded': 'Added the operating rule {name}',
  'change.operatingRuleRemoved': 'Deleted the operating rule {name}',
  'change.operatingRuleChanged': 'Changed the operating rule {name} ({fields})',
  'change.assignmentAdded': 'Added an assignment in {name}',
  'change.assignmentRemoved': 'Deleted an assignment in {name}',
  'change.assignmentChanged': 'Changed an assignment in {name} ({fields})',
  'change.checkMarkAdded': 'Marked a finding about {name} as intended',
  'change.checkMarkRemoved': 'Took back a finding about {name} marked as intended',
  'change.checkMarkChanged': 'Changed a finding about {name} marked as intended ({fields})',
  'change.commentAdded': 'Commented on {name}',
  'change.commentRemoved': 'Removed a comment from {name}',
  'change.commentChanged': 'Changed a comment on {name} ({fields})',
  'change.principleAdded': 'Wrote principle {name}',
  'change.principleRemoved': 'Deleted principle {name}',
  'change.principleChanged': 'Changed principle {name} ({fields})',
  'change.citationAdded': 'Cited a principle from {name}',
  'change.citationRemoved': 'Removed a citation from {name}',
  'change.citationChanged': 'Changed a citation on {name} ({fields})',
  'change.evaluationAdded': 'Started evaluating {name}',
  'change.evaluationRemoved': 'Deleted the evaluation of {name}',
  'change.evaluationChanged': 'Changed the evaluation of {name}',
  'change.membershipAdded': 'Put {name} on {on}',
  'change.membershipRemoved': 'Removed {name} from {on}',
  'change.membershipMoved': 'Refiled {name} on {on}',
  'change.geometry': 'Moved {count} on {name}',
  // What a record IS changed (ADR-0012 §3), which is not the same news as a
  // field on it changing and does not read as one.
  'change.becameStandIn': '{name} is now a stand-in of {scope}',
  'change.becameDefinition': '{name} is now defined here',
  'shell.scopeCreated': '\u201c{name}\u201d created.',
  'scope.kind.organisation': 'Organisation',
  'scope.kind.domain': 'Domain',
  'scope.kind.programme': 'Programme',
  'scope.kind.team': 'Team',
  'scope.kind.landscape': 'Landscape scope',

  // --- preferences, in three scopes (ADR-0005) ------------------------------
  'prefs.title': 'Preferences',
  'prefs.general': 'General',
  'prefs.language': 'Language',
  'prefs.theme': 'Theme',
  'prefs.projectOrder': 'Scope list order',
  'prefs.updates': 'Updates',
  'prefs.checkAutomatically': 'Check for updates automatically',
  'prefs.updatesNote':
    'Looks at the release page on start and every six hours. Nothing is downloaded without asking.',
  /** The channel (ADR-0006). A beta is a prerelease, published and signed like any other. */
  'prefs.channel': 'Release channel',
  'prefs.channelStable': 'Stable',
  'prefs.channelBeta': 'Beta',
  'prefs.channelNote':
    'Betas are builds ahead of a release, signed and published the same way. Leaving the beta channel keeps whatever is installed.',
  'prefs.writeFailed': 'That setting could not be saved: {message}',
  // --- an agent as a peer of the menu (ADR-0007) ------------------------------
  'agent.title': 'Connect an agent',
  /** The glyph's three states, as its tooltip names them. */
  'agent.tipOff': 'Connect an agent…',
  'agent.tipListening': 'Waiting for an agent on port {port}',
  'agent.tipConnected': '{name} connected',
  /** Four sentences in a person's language: what this is, before any switch. */
  'agent.what':
    'Your coding agent — Claude Code, Codex, Cursor or any other MCP client — can read this landscape, '
    + 'propose changes and look at diagrams while you work. Everything it does shows in Activity under its '
    + 'name and is undone with {key:Mod+Z}. It connects over the standard Model Context Protocol, on this machine only. '
    + 'Nothing leaves the computer.',
  'agent.enable': 'Accept agent connections',
  'agent.listening': 'Listening on port {port}.',
  'agent.connected': '{name} is connected.',
  'agent.moved':
    'Port {from} was taken when the app started, so it listens on {port} now. An agent configured with the old port needs the new address.',
  /** A browser tab: the explanation stands, and this replaces the switch. */
  'agent.desktopOnly': 'Connecting an agent needs the desktop app — only it can listen on this machine. Open this scope in the desktop app; the switch is in this dialog there.',
  'agent.recipes': 'CONNECT YOUR CLIENT',
  'agent.recipesNote': 'The port and the token below are this machine\u2019s. Pick your client and paste.',
  'agent.tabClaude': 'Claude Code',
  'agent.tabClaudeDesktop': 'Claude Desktop',
  'agent.tabCodex': 'Codex',
  'agent.tabCursor': 'Cursor',
  'agent.tabOther': 'Other',
  /**
   * The recipes. One string each with placeholders, because a recipe is the
   * kind of thing that is wrong six months later, and a string is what can be
   * corrected without a build of the dialog.
   */
  'agent.recipeClaude': 'claude mcp add --transport http lvarch {endpoint} --header "Authorization: Bearer {token}"',
  /**
   * The desktop app launches local servers over stdio and its "Add custom
   * connector" screen is for servers on the internet, so the way in is a
   * bridge in its developer settings. Two ways to get it there: a sentence to
   * hand Claude Code, which can edit the file, or the entry to paste yourself.
   */
  'agent.recipeClaudeDesktop':
    '# Not the "Add custom connector" screen: that is for servers on the internet and cannot reach this machine.\n'
    + '# Claude Desktop launches local servers over stdio, so it needs the mcp-remote bridge in its developer settings.\n'
    + '#\n'
    + '# Easiest: paste this to Claude Code, which has the settings already, then restart Claude Desktop:\n'
    + 'Add the MCP server "lvarch" to my Claude Desktop developer settings (claude_desktop_config.json): '
    + 'command "npx", args ["-y", "mcp-remote", "{endpoint}", "--transport", "http-only", "--header", '
    + '"Authorization: Bearer {token}"].\n'
    + '#\n'
    + '# Or add it yourself, in Claude Desktop under Settings → Developer → Edit Config:\n'
    + '{\n  "mcpServers": {\n    "lvarch": {\n      "command": "npx",\n'
    + '      "args": ["-y", "mcp-remote", "{endpoint}", "--transport", "http-only", "--header", "Authorization: Bearer {token}"]\n'
    + '    }\n  }\n}',
  'agent.recipeCodex':
    '# ~/.codex/config.toml\n[mcp_servers.lvarch]\nurl = "{endpoint}"\nhttp_headers = { Authorization = "Bearer {token}" }',
  'agent.recipeCursor':
    '// .cursor/mcp.json\n{\n  "mcpServers": {\n    "lvarch": {\n      "url": "{endpoint}",\n'
    + '      "headers": { "Authorization": "Bearer {token}" }\n    }\n  }\n}',
  'agent.recipeOther': 'Transport: Streamable HTTP\nEndpoint: {endpoint}\nHeader: Authorization: Bearer {token}',
  'agent.copy': 'Copy',
  'agent.copied': 'Copied',
  'agent.newToken': 'New token',
  'agent.newTokenNote': 'Every agent configured before now needs the new token.',
  'agent.changeFailed': 'That could not be changed: {message}',
  /** The banner while an agent moves the app or changes the model (ADR-0019). */
  'agent.someone': 'An agent',
  'agent.driving': '{name} is driving the app.',
  'agent.drivingFor': '{name} is driving the app: {purpose}',
  'agent.drivingHint': 'What you click meanwhile can change what it does. Stop ends its session and tells it so.',
  'agent.stop': 'Stop',
  'agent.stoppedToast': '{name} was stopped. It hears so on its next call, and may ask to continue.',
  /** A scope removed with what it held, at the person's word (ADR-0040 §3): there is no ⌘Z for it. */
  'agent.scopeRemoved': '{agent} deleted {name} with {what}, as you said: “{said}”. This cannot be undone.',
  'agent.scopeRemovedWhat': '{views} views and {records} other records',

  // --- Share with a Link… (ADR-0033, amended) --------------------------------
  'share.title': 'Share with a link',
  'share.what': 'Anyone who may read this work opens it here with this link: the same scope, page and record. Somebody who is not signed in yet signs in first and lands here after.',
  'share.linkLabel': 'Link to this place',
  'share.copy': 'Copy link',
  'share.copied': 'Link copied',
  'share.copyFailed': 'The link could not be copied. Select it in the dialog and copy it from there.',
  'share.noAddress': 'Work kept here — in a folder, in this browser or nowhere at all — cannot be opened from a link: nobody else reaches it at an address. A link can be shared where work is kept on a server everybody who may read it signs in to.',
  'share.noPlace': 'There is no place on screen to link to yet. Open a scope or a home, and try again.',

  // --- the shell's top bar: the three pages beside the canvas -------------
  'shell.documentation': 'Documentation',
  'shell.documentationTip': 'Open the documentation page of the selected element',
  'shell.noElements': 'There is nothing to document yet \u2014 add an element first.',
  /** The address the app opened from named a page it has no such thing as, or a view or record that is not there (ADR-0033). */
  'shell.placeUnknown': 'The address names a page this app does not have, so it opened where it was.',
  'shell.placeGone': 'What the address pointed at is not there, so it opened the nearest place.',
  'shell.placeNoScope': 'There is no scope “{scope}”, so this is the organisation’s home.',
  'shell.placeNoScopeSettings': 'There is no scope “{scope}”, so these are the organisation’s settings.',
  'shell.pendingRecovered': 'Recovered a change that hadn’t finished saving.',
  'shell.pendingPartly': 'A change from a tab that closed before it was saved could not be put back, because this scope has changed since.',
  'shell.decisions': 'Decisions',
  'shell.decisionsTip': 'Architecture decision records \u2014 for the group, the landscape and each application',
  'shell.observations': 'Observations',
  'shell.observationsTip': 'What was seen here and in the scopes below, analysed into causes and root causes',
  'shell.roadmap': 'Roadmap',
  'shell.roadmapTip': 'The landscape on a time axis, the plans over it, and what the dates disagree about',
  'shell.activity': 'Activity',
  'shell.activityTip': 'What has changed in this scope since you opened it',
  'shell.activityEmpty': 'What is changed here from now on shows in this list.',
  /** The tag on a step an agent took, beside the time (ADR-0007). */
  'shell.activityAgent': 'Agent',
  /** The tag on a step another author made, beside the time: their name. */
  'shell.activityBy': 'By {name}',
  /**
   * The same tag where the step also said which client the person made it with
   * — one author working from two is two different things to read a log about,
   * and a line that said only the name would flatten them into one.
   */
  'shell.activityByVia': 'By {name} via {client}',
  /** What that tag says when the step arrived with no author's name on it. */
  'shell.activityElsewhere': 'another author',
  /**
   * The tag on the person's own step, where the list also holds everybody
   * else's because the source keeps a log of the scope (`SourceRecentActivity`).
   */
  'shell.activityYou': 'You',
  /** The same, where the step said which client the person made it with. */
  'shell.activityYouVia': 'You via {client}',
  /** The list while the source's log of the scope is being read, with nothing else to show yet. */
  'shell.activityReading': 'Reading what was done here…',
  /** The button's tip where the list is the source's log and not only this session's steps. */
  'shell.activityTipKept': 'What was lately done in this scope, and by whom',
  /** The tag on a step nobody made: a board the editor laid out by itself as it opened. */
  'shell.activityUnattended': 'Laid out automatically',
  /**
   * Who else has the open scope in front of them, on the bar beside the status.
   * Names only, as the source said them, and nothing at all when there is
   * nobody: a bar that says a scope is yours alone is a bar answering a
   * question nobody asked.
   */
  'shell.alsoHere': 'Also here: {names}',
  'shell.search': 'Search',
  /** The desktop bar's two (ADR-0033): the window's own Back and Forward, pressed from inside the page. */
  'shell.back': 'Back',
  'shell.forward': 'Forward',
  'shell.searchTip': 'Search elements, documentation and decisions ({key:Mod+K})',

  // --- the four gestures that cross scopes (ADR-0012 \u00a710) --------------------
  'gesture.move': 'Move\u2026',
  'gesture.moveTip': 'Move this record to another scope, or stand in for one that is already defined elsewhere',
  'gesture.title': 'Move {name}',
  'gesture.what': 'What to do',
  'gesture.link': 'Link',
  'gesture.linkWhat': 'Give up this definition and stand in for the one another scope already holds. Its description, dates and owner are then that scope\'s: shown here, and changed there.',
  'gesture.promote': 'Promote',
  'gesture.promoteWhat': 'Move the definition up to a scope this one is filed under, and stand in for it here.',
  'gesture.demote': 'Demote',
  'gesture.demoteWhat': 'Move the definition down to a scope filed under this one, and stand in for it here.',
  'gesture.transfer': 'Transfer',
  'gesture.transferWhat': 'Move the definition to another scope.',
  'gesture.to': 'To',
  'gesture.keepStandIn': 'Keep a stand-in here',
  'gesture.keepStandInHelp': 'Without one this scope stops drawing it altogether.',
  'gesture.go': 'Move',
  'gesture.confirmTitle': 'Let {scope} answer for {name}?',
  'gesture.confirmBody': 'This writes two scopes: {scope} first, then this one. Undo stops there \u2014 move the record again to put it back.',
  'gesture.confirmAssignmentsOne': 'Its assignment goes with it, under the same id, so the person\'s past stays linked; a stand-in here holds none.',
  'gesture.confirmAssignmentsOther': 'Its {count} assignments go with it, ended ones included, under the same ids, so each person\'s past stays linked; a stand-in here holds none.',
  'gesture.moved': '{scope} answers for {name} now',
  'gesture.linked': '{name} stands in for the record in {scope} now',
  'gesture.writeFailed': 'That scope could not be written: {message}',
  'gesture.leftCopy': '{scope} has it now, but this scope could not be written, so the record is in both places. {message}',

  /**
   * Adding an application the organisation already has to a board — the
   * register as a library (ADR-0012 §2, §3). Drawing never moves ownership;
   * the one question asked is about an application nobody defines.
   */
  'library.inScope': 'in {scope}',
  'library.title': 'Add an existing application',
  'library.hint': 'Every application in the organisation that is not on this board yet.',
  'library.search': 'Find in the register',
  'library.searchPlaceholder': 'Name or id…',
  'library.none': 'Every application in the organisation is on this board already.',
  'library.noMatches': 'Nothing matches “{query}”',
  'library.heldHere': 'In this scope, not on this board',
  'library.definedIn': 'Defined in {scope}',
  'library.nobodyDefines': 'Nobody defines it',
  'library.ownTitle': 'Let this scope answer for {name}?',
  'library.chosenAs': 'Chosen as {block} for {scope}',
  'library.ownBody': 'No scope in the organisation defines {name}. Answer for it here and this scope becomes its owner; draw it only and the question stays open.',
  'library.placeTitle': 'How should {name} appear here?',
  'library.placeDomain': 'An application from another domain',
  'library.placeDomainWhat': 'On the landscape, drawn as the application it is. Double-click opens it where it is defined.',
  'library.placeExternal': 'An external reference',
  'library.placeExternalWhat': 'In the external band, drawn as a system outside this landscape.',
  'library.own': 'Answer for it here',
  'library.drawOnly': 'Draw it only',
  'library.drawn': '{name} is on the board',
  'library.standsIn': '{name} is on the board, standing in for the record in {scope}',
  'library.owned': 'This scope answers for {name} now',
  'pick.filedIn': 'filed in {scope}',
  'pick.in': 'in {name}',
  'pick.otherUnits': 'Of a type the model does not hold',
  'pick.otherActors': 'Others in this scope',
  'sheetClaim.already': '{name} is taken up here already.',
  'sheetClaim.refused': '{name} was not taken up: it is no longer a function of a scope above this one.',
  'pick.servesOne': 'a {type} serves one domain',
  'pick.readOnly': 'kept where you may only read',
  'pick.notWritten': 'Nothing was written.',
  'pick.findUnit': 'Find a unit',
  'pick.noUnit': 'No unit by that name',
  'pick.findScope': 'Find a scope',
  'pick.noScope': 'No scope by that name',
  'pick.findFunction': 'Find an area, grouping or capability',
  'pick.noFunction': 'Nothing by that name',
  /**
   * The Conway map's findings, each under its check (`model/checkCatalogue.ts`),
   * which says what the kind is; its over-limit is the tree's
   * `check.unitOverLimit`, said from `projects/checks.ts`'s table.
   */
  'check.interfaceUndeclared': '{source} → {target} runs from {from} to {to}, and no interaction is declared between them.',
  'check.interactionUnused': '{a} and {b} declare {mode}, and no interface runs between them.',
  'check.applicationUnowned': '{name} has no unit: nobody owns it.',
  'check.applicationOwnerNamed': '{name} is owned by a name, not a unit.',
  'blockDecision.title': 'Choose {name} as {block} for {scope}',
  'blockDecision.outcome': 'Chosen option: {name}, which covers {fit} of what is needed here.',
  'blockDecision.driver': '{capability}: needed at {level} of 4 here',
  'blockDecision.context': 'Which solution {scope} uses as its {block}, weighed in its evaluation of the block: what each usage context that applies here needs, and how far each option covers it.',
  'blockDecision.failsMust': 'fails a must',
  'agent.download': 'Download the desktop app ↗',
  // --- the frame (decision 1) --------------------------------------------------
  'frame.find': 'Find or run a command',
  'frame.findShort': 'Find…',
  'frame.findTip': 'Places, records, people and commands',
  'frame.treeToggle': 'Keep the scope tree open',
  'frame.treeOnHome': 'A home always shows the tree',
  'frame.treeOnPage': 'This page always shows the tree, counting its records by scope',
  'frame.treeOnEmpty': 'A scope with no view yet always shows the tree, the way on from it',
  'frame.tallyElements': 'Elements',
  'frame.tallyDecisions': 'Decisions',
  'frame.tallyObservations': 'Observations',
  'frame.tallyPlans': 'Plans',
  'frame.tallyPrinciples': 'Principles',
  'frame.tallyBlocks': 'Blocks',
  'frame.tallyWithElements': 'With elements',
  'frame.tallyWithDecisions': 'With decisions',
  'frame.tallyWithObservations': 'With observations',
  'frame.tallyWithPlans': 'With plans',
  'frame.tallyWithPrinciples': 'With principles',
  'frame.tallyWithBlocks': 'With blocks',
  'frame.tallyElementOne': '{count} element kept here',
  'frame.tallyElementOther': '{count} elements kept here',
  'frame.tallyBlockOne': '{count} building block kept here',
  'frame.tallyBlockOther': '{count} building blocks kept here',
  'frame.switchScope': 'Switch scope',
  'frame.orderBy': 'Order by',
  'frame.settingsOf': 'Settings of {name}…',
  'frame.home': 'Home',
  'frame.lastView': 'Back to {name}',
  'frame.lastViewIn': 'Back to {name} in {scope}',
  'frame.more': 'More',
  'frame.moreOn': 'More: {place}',
  'frame.newView': 'New view',
  'drawing.editing': 'Editing {name}',
  'drawing.save': 'Save',
  'drawing.saveAgain': 'Save again',
  'drawing.done': 'Done',
  'drawing.saveFailed': 'Could not save. Your changes are still here.',
  'drawing.merged': 'Someone else’s save was merged in. Save to keep both.',
  'drawing.silentTitle': 'The drawing editor did not answer',
  'drawing.silentWho': 'It is a separate service and it',
  'drawing.silentAsk': 'If this keeps happening, ask whoever runs this server to check the drawing service.',
  'drawing.backToPicture': 'Back to the picture',
  'drawing.leaveTitle': 'Save your changes to this drawing?',
  'drawing.leaveGoing': 'You are going to {name}.',
  'drawing.leaveBody': 'Your drawing has changes nobody has saved. If you leave without saving, they are gone: undo cannot bring them back.',
  'drawing.leaveUnsaved': 'Leave without saving',
  'drawing.leaveStay': 'Stay',
  'drawing.leaveSave': 'Save and leave',
  'drawing.stripLabel': 'What this shape points at',
  'drawing.stripNothing': 'This shape points at nothing in the model.',
  'drawing.stripPoints': 'This shape points at',
  'drawing.stripGone': 'This shape points at something no longer in this scope.',
  'drawing.stripName': 'Its name comes from the model.',
  'drawing.openPage': 'Open page',
  'drawing.pointAt': 'Point at an element…',
  'drawing.pointAnother': 'Point at another…',
  'drawing.unlink': 'Unlink',
  'drawing.pointTitle': 'Point this shape at an element',
  'drawing.pointFind': 'Find an element',
  'drawing.pointConfirm': 'Point at {name}',
  'drawing.pointNote': 'The shape takes the element’s name each time the drawing is opened for editing. Elements of this scope only.',
  'drawing.barLabel': 'This drawing',
  'drawing.youDraw': 'You draw this.',
  'drawing.youRead': 'You may read this.',
  'drawing.nothingYet': 'Nothing drawn yet.',
  'drawing.readOnlyHere': 'No editor in this browser, so it is read-only here.',
  'drawing.reach': '{links} of {shapes} shapes point at the model.',
  'drawing.firstPageOnly': 'The first of {pages} pages is shown.',
  'drawing.links': '{count} links',
  'drawing.linksTrouble': '{links} · {trouble} need a look',
  'drawing.linksTroubleOne': '{links} · 1 needs a look',
  'drawing.oneLink': '1 link',
  'drawing.export': 'Export…',
  'drawing.print': 'Print…',
  'drawing.exportFailed': 'The picture could not be turned into a file.',
  'drawing.edit': 'Edit drawing',
  'drawing.editInDesktop': 'Edit in the desktop app…',
  'drawing.letTheModel': 'Let the model draw it instead: new view…',
  'drawing.emptyBody': 'A drawing is yours: any shape, any layout, and it changes only when you save it. Shapes taken from Elements point at the model, so a reader can open them.',
  'drawing.emptyChoose': 'Choose a view the model draws when the picture must follow the model. A drawing does not change when the model does; it only tells you when it has fallen behind.',
  'drawing.start': 'Start drawing',
  'drawing.notPicturedTitle': 'Written, but not pictured yet',
  'drawing.notPicturedBody': 'This drawing was written without its editor: {shapes} shapes, {links} of them pointing at the model. A picture is made when someone opens it in the editor and saves.',
  'drawing.pointsAt': 'It points at',
  'drawing.makePicture': 'Open and make the picture',
  'drawing.noEditorTitle': 'This drawing cannot be edited in this browser',
  'drawing.noEditorBody': 'Drawings are made in the desktop app, or on a shared server. Here you can read one, not change it. Your work in this browser is not affected.',
  'drawing.noEditorEmpty': 'Nothing has been drawn on this one yet, so there is no picture to show.',
  'drawing.getDesktop': 'Get the desktop app',
  'drawing.linksKind': 'Links',
  'drawing.linksTitle': 'What this drawing points at',
  'drawing.needsLook': 'Needs a look ({count})',
  'drawing.goneHere': 'No longer in this scope. The shape links to nothing.',
  'drawing.stale': 'The picture still says {label}. Edit and save to bring it up to date.',
  'drawing.read': 'Read',
  'drawing.inStep': 'In step ({count})',
  'drawing.onlyDrawn': 'Only drawn ({count})',
  'drawing.onlyDrawnBody': 'These point at nothing, which is allowed: they are part of the picture, not of the model. {names}.',
  'drawing.readerNote': 'A drawing shows this element; it does not change it. Change it on its page.',
  'drawing.shownOn': 'Shown on',
  'drawing.aboutThis': 'Drawings about this',
  'drawing.groupCount': '{kind} ({count})',
  'drawing.manyApplications': 'Applications',
  'drawing.manyFunctions': 'Functions',
  'drawing.manyActors': 'Actors',
  'drawing.manySteps': 'Steps',
  'drawing.manyProcesses': 'Processes',
  'drawing.manyComponents': 'Components',
  'drawing.manyPlatforms': 'Platforms',
  'drawing.manyPlatformServices': 'Platform services',
  'drawing.manyOthers': 'Others',
  'frame.ownClean': 'No changes yet',
  'frame.ownFailed': 'Could not save',
  'newView.landscape': 'Landscape',
  'newView.landscapeLine': 'Applications and how they connect.',
  'newView.sheetLine': 'Journeys, areas and functions.',
  'newView.mapLine': 'A grid, laid out from the rows.',
  'newView.technologyLine': 'Platforms, services and who relies on them.',
  'newView.chartLine': 'Units, laid out from the tree.',
  'newView.conwayLine': 'Whether teams and systems line up.',
  'newView.modelDraws': 'The model draws these, and they follow it',
  'newView.youDraw': 'You draw this one',
  'newView.drawingLine': 'Any shape, any layout. Shapes can point at the model.',
  'newView.drawingLineNoEditor': 'Any shape, any layout. In this browser you can make one, not draw on it.',
  'newView.name': 'Name',
  'newView.about': 'About (optional)',
  'newView.aboutHint': 'An element this drawing explains',
  'newView.aboutOther': 'Another',
  'newView.makeDrawing': 'Make the drawing',
  'newView.drawingFits': 'Good for a one-off explanation, a notation the boards do not have, or a layout that carries the message. It will not follow the model; it tells you when it has fallen behind.',
  'newView.drawingLimit': 'You need the desktop app or a shared server to draw it. Until then it stays empty, and an agent can still write to it.',
  'frame.help': 'Help',
  'frame.helpHere': 'Help on this page',
  'frame.agent': 'Agent',
  'frame.agents': 'Agents',
  'frame.findScope': 'Find a scope',
  'frame.treeMenu': 'Tree options',
  'frame.scopeMenu': 'More for {name}',
  'frame.acrossOrganisation': 'Across the organisation',
  'frame.place.register': 'Register',
  'frame.place.people': 'People',
  'frame.place.operating': 'Operating model',
  'frame.place.principles': 'Principles',
  'frame.place.guidance': 'Guidance',
  'frame.place.checks': 'Checks',
  'frame.place.technology': 'Technology register',
  'frame.place.topics': 'Topics',
  'frame.place.blocks': 'Building blocks',
  'frame.offline': 'Working offline',
  'frame.offlineWaiting': 'Offline: changes are waiting',
  'frame.nothingWaiting': 'Nothing waiting',
  'frame.yourWork': 'Your work',
  'frame.keepIt': 'Keep it',
  'frame.moveIt': 'Change where it is kept',
  'frame.lookBack': 'Look back',
  'frame.appliesToAll': 'Applies to the whole organisation',
  'frame.sessionChanges': 'Changes this session: {count}',
  'frame.activityUndo': 'Your newest change is undone with {key:Mod+Z}.',
  'frame.lookingAt': 'Looking at {day}',
  'frame.lookingDetail': 'Only on your screen. Nothing can be changed while you look, so undo is off.',
  'frame.lookingToday': 'Back to today',
  'frame.lookingKeep': 'Make this the view’s day',
  'frame.lookingKept': '{view} now shows {day}',
  'frame.lookingUndo': 'Undo',
  'frame.lookingDayToday': 'today',
  'frame.lookingBack': 'Back to {day}',
  'frame.agentCountOne': '{count} change so far.',
  'frame.agentCount': '{count} changes so far.',
  'frame.agentFinishedOne': '{name} finished: {count} change.',
  'frame.agentFinished': '{name} finished: {count} changes.',
  'frame.agentStopped': '{name} was stopped. It hears so on its next call, and may ask to continue.',
  'frame.undoThem': 'Undo them',
  'frame.putThemBack': 'Put back',
  'frame.dismiss': 'Dismiss',
  'frame.group.file': 'File',
  'frame.group.edit': 'Edit',
  'frame.group.go': 'Go',
  'frame.group.view': 'View',
  'frame.group.help': 'Help',
  'frame.group.frame': 'Everywhere',
  'frame.group.canvas': 'On a board',
  'frame.shortcutsTitle': 'Keyboard shortcuts',
  'frame.keysOr': 'or',
  'frame.places': 'Places',
  'frame.commands': 'Commands',
  'frame.close': 'Close',
  'frame.pagesLabel': 'Places in this scope',
  'frame.findNothing': 'No scope has that name.',
  'first.brand': 'Lionsville Architect',
  'first.title': 'Start with your organisation, or look around first',
  'first.intro': 'An organisation is a tree of scopes: domains and teams, each with its own boards, decisions and plans.',
  'first.startOwn': 'Start your own',
  'first.nameLabel': 'Name of your organisation',
  'first.start': 'Start',
  'first.started': '“{name}” is started.',
  'first.keptAt': 'Your work: {place}',
  'first.lookAround': 'Look around an example',
  /** The example's own description, which is in English, and where the language is not English a word that it is. */
  'first.exampleSaid': '{description}',
  'first.exampleApart': 'Try anything: your own work stays apart.',
  'first.openExample': 'Open the example',
  'first.carryOn': 'Carry on with work you have',
  'first.carryOnBody': 'A saved file, or a folder of work.',
  'first.carryOnFile': 'A saved file.',
  'first.nothingLeaves': 'Nothing leaves this machine: no account and no telemetry.',
  'first.emptyFine': 'An empty folder is fine. You can create one in the next window, and change folder at any time.',
  'first.whereWorkLives': 'Where your work lives',
  'example.kept': 'The example is now your start. It is kept here, and yours to change.',
  'example.band': 'You are in the example. Try anything: nothing here is kept, and your own work is untouched.',
  'example.keep': 'Keep this as my start',
  'example.keepCopy': 'Keep a copy in my organisation',
  'example.leave': 'Leave the example',
  'example.keptUnder': 'The example is kept under your organisation, as “{name}”, a scope of its own, without its operating model. Your own work is untouched.',
  'example.keepAsk': 'Your organisation already holds work, so the example is kept under it.',
  'example.keepAskDetail': 'It becomes a scope of its own, and nothing of yours changes. Its operating model and rating scales stay behind: only an organisation has those, and yours is yours to shape. Its units come as plain actors, without types or reporting lines. Everything else comes, its principles too.',
  'example.keepUnder': 'Keep it under my organisation',
  'example.keepNot': 'Not now',
  'example.titleWord': 'Example',
  'example.keepUnwritten': 'Nothing was kept: the latest change could not be written first. {reason}',
  'example.markedBecause': 'Came with the example',
  'work.today': 'Today, {time}',
  'work.manual': 'Where your work is kept, in the help',
  'work.couldNotSave': 'Could not save',
  /** After what was not kept and why: the two ways out, beside it. */
  'work.notKeptWays': 'Try it again, or put it back and leave what is kept as it is.',
  'work.putBack': 'Put back',
  'work.tryAgainAll': 'Try all again',
  'work.putBackAll': 'Put all back',
  /** After a *Try again* the place refused once more: said where the button is, so the press is seen to have done something. */
  'work.stillNotTaken': 'Still not taken: {reason}',
  /** The open scope's changes that the place did not take, a row each under this. */
  'work.notWrittenHere': 'Not written yet in this scope:',
  'work.refusedChange': 'A change',
  'work.refusedNewScope': 'New scope {name}',
  'work.refusedMoveScope': 'Move a scope',
  'work.refusedRemoveScope': 'Remove a scope',
  'work.refusedPicture': 'Picture {name}',
  'work.refusedSetting': 'A setting',
  'work.refusedPeople': 'A change to the people register',
  'work.lastSaved': 'Last saved',
  'work.lastCopy': 'Last copy saved',
  'work.keptNow': 'Now kept in',
  'work.workFrom': 'Work from {name}',
  'work.never': 'Never',
  'work.history': 'History',
  'work.historyKept': 'Kept',
  'work.historyNot': 'Not started',
  'work.unreadableTitle': 'Could not be read whole',
  'work.unreadableBody': '{files} could not be read, so the scope is open to look at. Nothing here can be changed until it is mended.',
  'seal.thisFile': 'this file',
  'seal.viewsOne': '{count} view',
  'seal.viewsOther': '{count} views',
  'seal.holds': '{scopes}, {views}',
  'seal.people': 'People in the copy',
  'seal.peopleNamed': 'Keep their names',
  'seal.peopleWithout': 'Leave the names out',
  'seal.peopleWithoutHint': 'For a copy that leaves the organisation.',
  'openInto.inFile': 'In the file: {name}',
  'openInto.holds': '{scopes}, {views}',
  'openInto.newPlace': 'A new folder',
  'openInto.newPlaceEffect': 'It becomes a working folder of its own and opens there. What you have open stays as it is.',
  'openInto.writesOver': 'Writes over {scope}.',
  'openInto.writesOverBelow': 'Writes over {scope} and the {count} scopes under it.',
  'openInto.snapshotFirst': 'A snapshot is taken first, so you can restore it from History.',
  'openInto.noWayBack': 'No history is kept here yet, so it cannot be restored.',
  'openInto.replaceTitle': 'Replace your work with {name}?',
  'openInto.gone': '{scope} will be gone.',
  'openInto.goneBelow': '{scope} and the {count} scopes under it will be gone.',
  'openInto.noHistoryHere': 'This browser holds one organisation, and no history is kept here yet, so it cannot be restored.',
  'openInto.copyFirst': 'Save a copy of {scope} first…',
  'openInto.replaceAndLose': 'Replace and lose what is here',
  'share.noAddressAt': 'This work is kept here: {place}. Nobody else can reach it at an address. A link works where work is kept on a server that people sign in to.',
  'share.example': 'This is the example. It is not kept anywhere, so there is no address to share.',
  'share.noLinkTitle': 'No link to share from here',
  'share.handOver': 'To hand it to someone, save a copy and send the file.',
  'history.snapshotOf': 'Take a snapshot of {name}',
  'history.snapshotWhy': 'A named point in this history, to look back at or go back to.',
  'history.messageHint': 'Suggested from your changes',
  'prefs.owner': 'Yours, on this computer. They apply at once and do not travel with your work.',
  'prefs.ownerBrowser': 'Yours, in this browser and for this site only. They apply at once and do not travel with your work.',
  'prefs.canvas': 'Canvas',
  'prefs.canvasNote': 'Also switched on the canvas itself, which remembers them here.',
  'prefs.grid': 'Grid',
  'prefs.snap': 'Snap to grid',
  'prefs.minimap': 'Minimap',
  'prefs.badges': 'Lifecycle badges',
  'prefs.lineLabels': 'All line labels',
  'prefs.tidyDirection': 'Reading direction',
  'prefs.tidyHybrid': 'Groups across',
  'prefs.tidyHorizontal': 'Across',
  'prefs.tidyVertical': 'Down',
  'prefs.tidyAuto': 'Automatic',
  'prefs.tidyDensity': 'Spacing',
  'prefs.tidyCompact': 'Compact',
  'prefs.tidyNormal': 'Normal',
  'prefs.tidySpacious': 'Spacious',
  'prefs.canvasReset': 'Canvas back to the defaults',
  'prefs.textSize': 'Text size',
  'prefs.textSizeHint': 'Bars, panels, lists and pages. A canvas keeps its own type: zoom it to make it larger.',
  'prefs.densityHint': 'How much a list or a tree holds on one screen.',
} as const
