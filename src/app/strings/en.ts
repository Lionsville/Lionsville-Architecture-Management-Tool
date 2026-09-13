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
  'shell.saved': 'Saved · {time}',
  'shell.notSaved': 'Not saved yet',
  /**
   * The third state of the same indicator. Distinct from `shell.notSaved`,
   * which means "nothing has happened yet": this one means a write was refused,
   * and it replaces a last-successful time that would otherwise be older than
   * the work on screen and read as reassurance.
   */
  'shell.saveRefused': 'Not saved — storage refused',
  /**
   * The rest of the same indicator, once saving is a state machine and not a
   * timestamp (ADR-0003). Each one is a different answer to "can I close this
   * window now", which is the only question the bar is really being asked.
   */
  'shell.unsaved': 'Unsaved changes',
  'shell.saving': 'Saving…',
  'shell.changedOnDisk': 'Changed on disk',
  'shell.conflict': 'Changed here and on disk',
  /**
   * The strip above the canvas when the folder has a second author. Two
   * sentences and three buttons, because the app genuinely cannot choose: there
   * is no merge, only which version survives.
   */
  'shell.diskChanged': 'This project changed on disk. Nothing here is unsaved.',
  'shell.diskConflict': 'This project changed on disk, and there are unsaved changes here.',
  'shell.takeTheirs': 'Take theirs',
  'shell.keepMine': 'Keep mine',
  'shell.saveACopy': 'Save a copy…',
  'shell.storageFailed':
    'This browser could not save the design (storage full or blocked). Save a working file, or it is gone when you close the tab.',
  'shell.storageRecovered': 'Saving in this browser works again.',
  'shell.folderNotOpened': 'The folder could not be opened: {message}',
  'shell.storageNearlyFull':
    'This browser is about {percent}% full for this app. Save your work to a folder or a '
    + 'file before it runs out — a browser stops saving without asking.',
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
  'shell.bootFailedNote':
    'Reading your settings or the project you had open did not work. Starting without that project usually gets you back in; nothing is deleted.',
  'shell.startFresh': 'Start without the last project',
  /** A throw nobody caught. Throttled: a broken loop must not paper the screen. */
  'shell.unexpectedError': 'Something unexpected went wrong. If the screen stops responding, reload the page.',
  'shell.orphanOne':
    'Container view “{name}” was removed: its application left the model. Undo does not bring that view back.',
  'shell.orphanOther':
    '{count} container views were removed: their applications left the model. Undo does not bring those views back.',
  'shell.duplicated': '“{name}” duplicated.',
  'shell.deleted': '“{name}” deleted.',
  'shell.savedInterchange':
    'Interchange document saved — topology and semantics; geometry and styling travel in the working file.',
  'shell.savedInterchangeLeftOut':
    'Interchange document saved — it carries applications and the flows between them, so this stayed behind: {left}.',
  /**
   * A count and what it counts, with no grammar between them. The label is a
   * relation's type or an element's kind, translated from the table its module
   * publishes, and no language has to pluralise a word it is handed.
   */
  'shell.leftOutPart': '{count} × {label}',
  'shell.savedWorkingFile': 'Working file saved — everything, including geometry, styling and your own logos.',
  'shell.workingFileLoaded': 'Working file “{name}” loaded.',
  'shell.interchangeLoaded': 'Interchange document “{name}” loaded; the boards will be laid out again.',
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
  'shell.newMap': 'Enterprise map',
  'shell.add': 'Add',
  'shell.imagesMissing': 'PNG exported, but these logos are missing: {labels}.',
  'shell.logoAdded': 'Logo “{name}” added to your own library.',
  /** The name a duplicated diagram gets, right after the original. */
  'shell.copyOf': '{name} (copy)',
  /** The name a newly created container view gets. */
  'shell.containerDiagram': '{name} · containers',
  'shell.deleteDiagramTitle': 'Delete view “{name}”?',
  'shell.lastLandscape': 'This is the last landscape; it cannot be deleted.',
  'shell.deleteLandscapeBody':
    'The placements, groups and routes of this landscape are lost. The elements themselves stay in the model, and container views remain.',
  'shell.deleteContainerBody':
    'The placements and routes of this container view are lost. The elements themselves stay in the model.',
  /**
   * What you are working from — the first thing on the bar, because it was
   * the one thing the bar did not say (ADR-0005). A folder by its name: the
   * name is what the person called it in their file manager.
   */
  'shell.sourceFolder': 'Folder · {name}',
  'shell.sourceBrowser': 'In this browser',
  'shell.sourceMemory': 'Not kept anywhere',
  'shell.sourceTip': 'Where this project is kept',
  'shell.projects': 'Projects\u2026',
  'shell.projectsTip': 'Back to the project list',
  'shell.exampleCopied': 'Example \u201c{name}\u201d copied to a project of your own.',

  // --- projects and the picker ---------------------------------------------
  'picker.title': 'Projects',
  'picker.subtitle': 'Pick up where you left off, or start something new.',
  'picker.empty': 'Nothing here yet. Start from an example, or create a project.',
  'picker.yours': 'Your projects',
  'picker.examples': 'Examples',
  'picker.open': 'Open',
  'picker.copy': 'Copy to a project',
  'picker.order': 'Order',
  'picker.orderName': 'Name',
  'picker.orderUpdated': 'Recently changed',
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
  'history.title': 'History',
  'history.snapshot': 'Snapshot…',
  'history.snapshotNote': 'Record the project as it stands, in the folder\u2019s own history',
  'history.open': 'History…',
  'history.openNote': 'Every snapshot of this folder, and what changed',
  'history.start': 'Start keeping history',
  'history.startBody':
    'This folder does not keep a history yet. Starting one records every snapshot you take in '
    + 'the folder itself, using git — nothing leaves this machine.',
  'history.message': 'What changed',
  /** When this session's log has nothing in it; the folder may still have. */
  'history.defaultMessage': 'Snapshot',
  'history.take': 'Take snapshot',
  'history.taken': 'Snapshot taken.',
  'history.nothingToRecord': 'Nothing has changed since the last snapshot.',
  'history.failed': 'The snapshot could not be taken: {message}',
  'history.readFailed': 'The history could not be read: {message}',
  'history.none': 'No snapshots yet.',
  'history.unavailable':
    'This machine has no git, so the app cannot keep a history. Everything else works as before.',
  'history.compare': 'Compared with the project as it is now',
  'history.unchanged': 'Nothing has changed since this snapshot.',
  'history.gone': 'This project was not in the folder at that snapshot.',
  'history.by': '{author}',
  'history.subject': 'Show the history of',
  'history.everything': 'The whole project',
  /**
   * Where a subject's history is coming from, when it is more than one scope
   * (ADR-0012 §7): an element's page is filed in every scope that holds the
   * id, and the list is the union of those files' commits.
   */
  'history.everywhere': 'Everywhere this is drawn: {scopes}',
  'history.restorePerScope': 'A restore puts back what this scope holds. The other scopes’ pages are theirs to restore.',
  'history.diagrams': 'Diagrams',
  'history.descriptions': 'Descriptions',
  'history.decisions': 'Decisions',
  'history.noneFor': 'No snapshot has touched this yet.',
  'history.unchangedFor': 'This has not changed since this snapshot.',
  'history.restore': 'Restore this version…',
  'history.restoreProject': 'Restore the whole project…',
  'history.restoreTitle': 'Restore {name} as of {date}?',
  'history.restoreProjectTitle': 'Restore the whole project as of {date}?',
  'history.restoreBody':
    'This makes {name} what it was at that snapshot, as a new change — the history keeps everything that happened since, and this step goes on top of it. It can be undone with ⌘Z until the next snapshot records it.',
  'history.restoreProjectBody':
    'Every element, connection, diagram and decision becomes what it was at that snapshot, as one new change on top of everything that happened since. Decisions that have been accepted, rejected or superseded stay as they are. It can be undone with ⌘Z until the next snapshot records it.',
  'history.restoreConfirm': 'Restore',
  'history.restored': 'Restored {name} as of {date}.',
  'history.restoredProject': 'Restored the whole project as of {date}.',
  'history.restoredDropped': ' {count} placed elements no longer exist and were left out.',
  'history.restoredKept': ' {count} locked decisions were left as they are.',
  'history.snapshotNow': 'Snapshot',
  'history.label': 'Label…',
  'history.labelTitle': 'Label this snapshot',
  'history.labelBody':
    'A word for this version — “Shown to the board” — kept beside the message, never instead of it. It travels with the history, so a colleague sees the same mark in the same place.',
  'history.labelField': 'Label',
  'history.labelConfirm': 'Label',
  'history.labelled': 'Labelled.',
  'history.labelExists': 'This folder already has a label with that name. Pick another word.',
  'history.labelUnnamed': 'A label needs a word in it.',

  // The sentences a change becomes. One per kind and subject, because "Added"
  // and "Added the diagram" are different facts and a shared word would make
  // the list read like a database.
  'change.elementAdded': 'Added {name}',
  'change.elementRemoved': 'Removed {name}',
  'change.elementChanged': 'Changed {name} ({fields})',
  'change.connectionAdded': 'Drew {name}',
  'change.connectionRemoved': 'Cut {name}',
  'change.connectionChanged': 'Changed {name} ({fields})',
  'change.rowAdded': 'Drew a row ({type}): {name}',
  'change.rowRemoved': 'Cut a row ({type}): {name}',
  'change.rowChanged': 'Changed a row ({type}): {name} ({fields})',
  'change.diagramAdded': 'Added the diagram {name}',
  'change.diagramRemoved': 'Deleted the diagram {name}',
  'change.diagramChanged': 'Changed the diagram {name} ({fields})',
  'change.decisionAdded': 'Added the decision {name}',
  'change.decisionRemoved': 'Removed the decision {name}',
  'change.decisionChanged': 'Changed the decision {name} ({fields})',
  'change.transitionAdded': 'Added the plan {name}',
  'change.transitionRemoved': 'Removed the plan {name}',
  'change.transitionChanged': 'Changed the plan {name} ({fields})',
  'change.membershipAdded': 'Put {name} on {on}',
  'change.membershipRemoved': 'Took {name} off {on}',
  'change.membershipMoved': 'Refiled {name} on {on}',
  'change.geometry': 'Moved {count} on {name}',
  // What a record IS changed (ADR-0012 §3), which is not the same news as a
  // field on it changing and does not read as one.
  'change.becameStandIn': '{name} is now a stand-in of {scope}',
  'change.becameDefinition': '{name} is now defined here',

  'folder.title': 'Where should your projects live?',
  'folder.body':
    'Pick a folder and this app keeps your projects in it as files you can read, back up, '
    + 'sync and commit. Nothing is kept inside the app itself.',
  'folder.choose': 'Choose a folder…',
  'folder.recent': 'Recently used',
  'picker.folder': 'Projects folder: {name}',
  'picker.noFolder': 'Projects are kept inside the app. Choose a folder to keep them as files.',
  'picker.chooseFolder': 'Choose folder…',
  'picker.changeFolder': 'Change…',
  'picker.never': 'Not saved yet',
  'picker.changed': 'Changed {when}',
  'picker.delete': 'Delete',
  'picker.deleteTitle': 'Delete \u201c{name}\u201d?',
  'picker.deleteBody': 'This removes the project from this browser. A working file you saved elsewhere is not affected.',
  'shell.scopeCreated': '\u201c{name}\u201d created.',
  'picker.newScope': 'New scope\u2026',
  'picker.scopeName': 'Name',
  'picker.under': 'Filed under',
  'picker.addUnder': 'New scope under {name}',
  'picker.organisation': 'This organisation',
  'picker.reservedName': 'A scope cannot be called that \u2014 the folder is already used for what a scope holds.',
  'scope.kind.organisation': 'Organisation',
  'scope.kind.domain': 'Domain',
  'scope.kind.programme': 'Programme',
  'scope.kind.landscape': 'Landscape',
  'picker.create': 'Create',
  'picker.loadFailed': 'That project could not be opened.',
  'picker.listFailed': 'Your projects could not be read.',
  'picker.deleteFailed': 'That project could not be deleted.',
  'settings.title': 'Project settings',
  'settings.open': 'Settings\u2026',
  'settings.projectName': 'Project name',
  'settings.group': 'Group',
  'settings.groupHelp': 'Moving a project files it under another group. Its content is untouched.',
  'settings.save': 'Save',
  'settings.moved': 'Moved to {name}.',
  'settings.renamed': 'Renamed to \u201c{name}\u201d.',
  'settings.defaults': 'DEFAULTS FOR THIS PROJECT',
  'settings.defaultsHelp':
    'What a diagram in this project falls back on. Changing these never rewrites a diagram that has already been configured.',
  'settings.defaultAuthor': 'Author',
  'settings.defaultAuthorHelp': 'Named on an exported diagram that has no author of its own.',
  'settings.defaultColumns': 'The maturity columns a new landscape starts with.',

  // --- preferences, in three scopes (ADR-0005) ------------------------------
  'prefs.title': 'Preferences',
  'prefs.general': 'GENERAL',
  'prefs.language': 'Language',
  'prefs.theme': 'Theme',
  'prefs.projectOrder': 'Project list order',
  'prefs.updates': 'UPDATES',
  'prefs.checkAutomatically': 'Check for updates automatically',
  'prefs.updatesNote':
    'Looks at the release page on start and every six hours. Nothing is downloaded without asking.',
  /** The channel (ADR-0006). A beta is a prerelease, published and signed like any other. */
  'prefs.channel': 'Release channel',
  'prefs.channelStable': 'Stable',
  'prefs.channelBeta': 'Beta',
  'prefs.channelNote':
    'Betas are builds ahead of a release, signed and published the same way. Leaving the beta channel keeps whatever is installed.',
  /**
   * The machine-local scope says out loud that it is not shared: the file
   * sits in the folder, and everything else in the folder travels.
   */
  'prefs.thisMachine': 'THIS FOLDER, ON THIS MACHINE',
  'prefs.thisMachineNote':
    'Kept in {path} and not shared \u2014 another machine that opens this folder decides for itself.',
  'prefs.pullOnOpen': 'Pull from the remote when this folder is opened',
  'prefs.pushAfterSnapshot': 'Push after every snapshot',
  'prefs.writeFailed': 'That setting could not be saved: {message}',

  // --- git sync (ADR-0005) --------------------------------------------------
  /** The snapshot a sync begins with, when this session has no log to draft from. */
  'history.beforeSync': 'Before syncing',
  'history.beforeUpgrade': 'Before upgrading the file format',
  /**
   * The folder and its remote have both moved on. The same two answers the
   * disk-change notice offers for one file, scaled up; both keep everything.
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

  'group.title': 'Scope settings',
  'group.open': 'Settings…',
  'group.openFor': 'Settings for {name}',
  'group.name': 'Name',
  'group.nameHelp': 'Renaming relabels it. The address ({path}) does not change — “Filed under” is what moves it.',
  'group.client': 'Client',
  'group.clientHelp': 'Named on every exported diagram. Empty means the nearest name above.',
  'group.description': 'Description',
  'group.descriptionPlaceholder': 'Who they are, what this landscape covers, who to ask.',
  'group.links': 'LINKS',
  'group.linksHelp': 'A wiki space, a ticket queue, a dashboard. Only http and https addresses.',
  'group.linkLabel': 'Label',
  'group.linkUrl': 'Address',
  'group.addLink': 'Add a link',
  'group.removeLink': 'Remove {name}',
  'group.badUrl': 'Needs to start with http:// or https://',
  'group.saved': 'Saved {name}.',
  'group.renamed': 'Renamed to “{name}”.',
  'group.saveFailed': 'Could not save this scope.',
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
    + 'name and is undone with ⌘Z. It connects over the standard Model Context Protocol, on this machine only. '
    + 'Nothing leaves the computer.',
  'agent.enable': 'Accept agent connections',
  'agent.listening': 'Listening on port {port}.',
  'agent.connected': '{name} is connected.',
  'agent.moved':
    'Port {from} was taken when the app started, so it listens on {port} now. An agent configured with the old port needs the new address.',
  /** A browser tab: the explanation stands, and this replaces the switch. */
  'agent.desktopOnly':
    'Connecting an agent needs the desktop app — only it can listen on this machine. Open this project there and the switch is here.',
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

  // --- the shell's top bar: the three pages beside the canvas -------------
  'shell.documentation': 'Documentation',
  'shell.documentationTip': 'Open the documentation page of the selected element',
  'shell.noElements': 'There is nothing to document yet \u2014 add an element first.',
  'shell.decisions': 'Decisions',
  'shell.decisionsTip': 'Architecture decision records \u2014 for the group, the landscape and each application',
  'shell.roadmap': 'Roadmap',
  'shell.roadmapTip': 'The landscape on a time axis, the plans over it, and what the dates disagree about',
  'shell.activity': 'Activity',
  'shell.activityTip': 'What has changed in this project since you opened it',
  'shell.activityEmpty': 'Nothing yet',
  /** The tag on a step an agent took, beside the time (ADR-0007). */
  'shell.activityAgent': 'AGENT',
  'shell.search': 'Search',
  'shell.searchTip': 'Search elements, documentation and decisions (\u2318K)',

  // The organisation screen: the root scope's home, which replaced the picker.
  // What a scope IS, as a word this screen shows and nothing branches on.
  'org.kind': 'What this is',
  'org.kindHelp': 'A word for the screen to show. Nothing behaves differently.',
  'org.kindNone': 'Not said',
  'org.kindOrganisation': 'Organisation',
  'org.kindDomain': 'Domain',
  'org.kindProgramme': 'Programme',
  'org.kindLandscape': 'Landscape',
  'org.filedUnder': 'Filed under',
  'org.filedUnderHelp': 'Moving changes the address of this scope and of everything under it. The content is untouched.',

  // The identity block at the top.
  'org.nameThis': 'Name this organisation',
  'org.forClient': 'For {name}',
  'org.lastChanged': 'Last changed {when}',
  'org.domainsOne': '{count} domain',
  'org.domainsOther': '{count} domains',
  'org.landscapesOne': '{count} landscape',
  'org.landscapesOther': '{count} landscapes',
  'org.diagramsOne': '{count} diagram',
  'org.diagramsOther': '{count} diagrams',

  // The organisation's own pages, as cards.
  'org.business': 'Business architecture',
  'org.businessMake': 'Make a sheet\u2026',
  'org.map': 'Map',
  'org.mapMake': 'Make a map\u2026',
  'org.journeysOne': '{count} journey',
  'org.journeysOther': '{count} journeys',
  'org.areasOne': '{count} area',
  'org.areasOther': '{count} areas',
  'org.functionsOne': '{count} function',
  'org.functionsOther': '{count} functions',
  'org.stakeholdersOne': '{count} stakeholder',
  'org.stakeholdersOther': '{count} stakeholders',
  'org.unmappedOne': '{count} function not yet mapped to a domain',
  'org.unmappedOther': '{count} functions not yet mapped to a domain',
  'org.allMapped': 'Every function is mapped to a domain.',
  'org.recordsOne': '{count} record',
  'org.recordsOther': '{count} records',
  'org.latest': 'Latest: {name}',
  'org.plansOne': '{count} plan',
  'org.plansOther': '{count} plans',
  'org.initiativesOne': '{count} initiative from below',
  'org.initiativesOther': '{count} initiatives from below',
  'org.noFindings': 'Nothing the dates disagree about.',
  /** One entry of a status tally: "3 accepted", "1 running". */
  'org.statusCount': '{count} {status}',
  'org.register': 'Register',
  'org.nothingHere': 'Nothing at this level yet.',

  // The tree of scopes beneath.
  'org.tree': 'Domains and landscapes',
  'org.treeEmpty': 'Nothing filed under this organisation yet. Create a scope, or copy an example.',
  'org.expand': 'Show what is under {name}',
  'org.collapse': 'Hide what is under {name}',

  // Examples, last and small.
  'org.copyHere': 'Copy into this folder\u2026',

  // --- the register, derived over the whole tree (ADR-0012 §2, §9) ----------
  /**
   * The register is every application definition in the tree, keyed by id, and
   * nothing commits it. These words are the page's and the card's alike, so
   * the two cannot come to say different things about the same number.
   */
  'register.title': 'Register',
  'register.what': 'Every application across the organisation, derived from the tree.',
  'register.applicationsOne': '{count} application',
  'register.applicationsOther': '{count} applications',
  'register.ownedOne': '{count} owned by a domain',
  'register.ownedOther': '{count} owned by a domain',
  'register.outsideOne': '{count} outside',
  'register.outsideOther': '{count} outside',
  'register.definedTwiceOne': '{count} defined twice',
  'register.definedTwiceOther': '{count} defined twice',
  'register.unattributedOne': '{count} outside and unattributed',
  'register.unattributedOther': '{count} outside and unattributed',
  'register.staleOne': '{count} with a stale stand-in',
  'register.staleOther': '{count} with stale stand-ins',
  'register.settled': 'Nothing the register disagrees about.',
  'register.empty': 'No application is defined anywhere in this organisation yet.',
  'register.noMatch': 'No application matches \u201c{query}\u201d.',
  'register.filter': 'Filter',
  'register.order': 'Order',
  'register.byName': 'By name',
  'register.byScope': 'By scope',
  'register.colName': 'Application',
  'register.colMaster': 'Answered for by',
  'register.colDrawn': 'Also drawn in',
  'register.colFindings': 'Findings',
  /** No scope in the tree defines it: every record of it is a stand-in. */
  'register.nobody': 'Nobody',
  'register.outsideParty': 'Outside \u00b7 {name}',
  'register.outsideUnattributed': 'Outside \u00b7 nobody said whose',
  'register.drawnNowhere': 'Nowhere else',
  'register.drawnOne': '{count} scope',
  'register.drawnOther': '{count} scopes',
  'register.openRow': 'Open {name} where it is answered for',
  'register.pageRow': 'Open the page of {name}',
  'register.linkRow': 'Link\u2026',
  'register.linkRowTip': 'Open {scope} and make its record stand in for the other one',

  // --- the four gestures that cross scopes (ADR-0012 \u00a710) --------------------
  'gesture.move': 'Move\u2026',
  'gesture.moveTip': 'Move this record to another scope, or stand in for one that is already defined elsewhere',
  'gesture.title': 'Move {name}',
  'gesture.what': 'What to do',
  'gesture.link': 'Link',
  'gesture.linkWhat': 'Give up this definition and stand in for the one another scope already holds. This scope keeps its own description of it.',
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
  'gesture.moved': '{scope} answers for {name} now',
  'gesture.linked': '{name} stands in for the record in {scope} now',
  'gesture.writeFailed': 'That scope could not be written: {message}',
  'gesture.leftCopy': '{scope} has it now, but this scope could not be written: {message}. The record is in both places.',

} as const
