// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What {@link ProjectWorkspace} is handed: one object per concern, so a prop
 * says what it is about — where the scope is kept, the organisation around
 * it, the ways in and out of it, the window, the working file, the folder's
 * snapshots, the agent and the shell's services — rather than forty-five
 * values in one list that the reader has to sort into those piles.
 *
 * Every piece is typed as the narrowest shape that will do: `source.store` is
 * "something that can save", not a `ProjectStore`. The shell builds these
 * once per render, so a hook below must depend on a field and never on one
 * of these objects, which is new every time.
 */
import type { Language, Translate } from '../i18n'
import type { EditorPreferences } from '../editor'
import type { AncestorRecords } from '../decisions/adrScope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { SourceStatus, SourceWork, SourceWorkChanged } from '../platform/sourceProvider'
import type { HostCommand } from '../platform/hostCommands'
import type { WindowChrome } from '../platform/windowChrome'
import type { HostControls } from '../ports/HostControls'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { CrashTrail } from './ErrorBoundary'
import type { InitialPage } from './App'
import type { ProjectSettings } from './ProjectSettingsDialog'
import type { Crumb, ToolbarAgent, ToolbarOverflow } from './ShellToolbar'
import type { ProjectSaver } from './useDocumentSession'
import type { WorkspaceAgentView } from './useAgentShell'
import type { MakeId } from './useDiagramActions'
import type { ScopeSession } from './useModelSession'
import type { ProjectFileChannel } from './useProjectFiles'
import type { AskPassword } from './usePasswordPrompt'
import type { StorageNotice } from './useStorageNotice'
import type { Notify } from './useToasts'
import type { ChooseFolderForWorkingFile, LandingPrompts } from './workingFileFlows'

/** Where this scope is kept, and what the source it is kept in says about it. */
export type WorkspaceSource = {
  /** Save, load and the owners' prose: what this workspace does to a store. */
  store: ProjectSaver
  /**
   * Somebody else changed this project's files. Bound to this project's ref by
   * the caller, and absent in a browser tab, where nothing can watch.
   */
  watch?: (onChanged: () => void) => () => void
  /**
   * May work here be written?
   *
   * A fact about the source this scope is kept in, read rather than assumed —
   * it was the constant `false` until a source could be somewhere other than a
   * folder this machine owns, and for all three sources that ship it still is.
   */
  readOnly?: boolean
  /**
   * What this source means by *dirty*, *saving*, *clean*, *external-changed*
   * and *conflict*. Absent where the document's own machine is the whole
   * answer, which is what a file is.
   */
  status?: (work: SourceWork) => SourceStatus
  /**
   * The source says its answer to {@link WorkspaceSource.status} has moved.
   * Absent where the document's own machine is the whole answer.
   */
  onWork?: SourceWorkChanged
  /**
   * Whoever answers for the source wants the session over this scope
   * (`composition.ts`). Handed over once it exists and taken back on unmount,
   * the way the agent's view is; absent for all three sources that ship.
   */
  onSession?: (session: ScopeSession) => (() => void) | void
  /** How a save went: the shell's notice says what a refusal means (`useStorageNotice`). */
  onResult: StorageNotice
}

/** The organisation around this scope, as the shell holds it. */
export type WorkspaceTree = {
  /**
   * The organisation's index, read-only (ADR-0012 §2, §10).
   *
   * Held above this workspace because it outlives a scope switch and because
   * the first screen reads it too. Everything below takes what it needs from
   * it: the id policy the ids spoken for, `mayEdit` who answers for one, and a
   * sheet at the root the `supports` rows a landscape wrote.
   */
  index: ScopeIndex
  /** The tree as it stands, for the settings dialog's "filed under" select. */
  scopes: ScopeSummary
  /**
   * The records of every scope above this one, nearest first (ADR-0012 §7).
   *
   * One list, read up the tree. They are not this scope's to change — a record
   * is edited where it lives — so they arrive and nothing goes back: the
   * decisions page shows them in a *From …* section and offers to open the
   * scope that holds them.
   */
  ancestorDecisions: readonly AncestorRecords[]
  /**
   * What the organisation this scope sits in is called, walked up the tree
   * (`projects/scopeLabel.ts`). Shown on the bar and above a description.
   */
  groupName: string
  /**
   * Who drawings made here are addressed to. Absent = the organisation's name,
   * which is what the title block said before a scope could say otherwise.
   */
  groupClient?: string
  /**
   * Every scope's records, read when a gesture is asked for (ADR-0012 §10).
   *
   * Not the index, which keeps a summary: deciding whether the scope a
   * definition would move into already answers for the id needs the record.
   * Read on the gesture rather than held, because a gesture is a decision and
   * not a keystroke. Absent in a test, and nothing is then offered.
   */
  models?: () => Promise<ScopeModel[]>
  /**
   * Every scope in full, read when an export asks (ADR-0018). Beside `models`
   * and for the opposite reason: that one is the thin read the index wants,
   * this is the whole thing the working file is made of.
   */
  workingSet?: () => Promise<ScopeSnapshot[]>
  /**
   * Write the scopes an opened working file brought with it (ADR-0018). The
   * shell's, because it owns the store; absent where there is none, and such a
   * file is then refused rather than half-opened.
   */
  onAdoptScopes?: (scopes: readonly ScopeSnapshot[]) => Promise<void>
  /**
   * A gesture changed the tree: read the listing and the index again
   * (ADR-0012 §10). The shell owns both, and a gesture is the one thing this
   * workspace does that changes a scope other than the one it has open.
   */
  onChanged?: () => void
}

/** The ways out of this scope, and the page it was opened for. */
export type WorkspaceNavigation = {
  /** Every scope above this one, root first, for the bar (`crumbsFor`). */
  crumbs: readonly Crumb[]
  /**
   * Leave this scope for a home: one above it from a crumb on the bar, or its
   * own when a page closes over a canvas that draws nothing. Where a home is
   * the shell's state, the same as which scope is open.
   */
  onGoHome: (path: ScopePath) => void
  /**
   * Open another scope by its path — *Open …* beside a field another scope
   * answers for (ADR-0012 §10).
   *
   * The shell's, because opening a scope is the shell's: it reads it, makes it
   * the one that is open, and remembers it. This workspace neither loads nor
   * lists. Absent where there is nowhere to go, and the button is then not
   * drawn rather than drawn and dead.
   */
  onOpenScope?: (path: ScopePath, page?: InitialPage) => void
  /**
   * Which page to show the moment this appears, when it was opened for one.
   *
   * The organisation screen's cards open the ROOT scope, which usually draws
   * nothing at all: its decisions, its plans and its business architecture are
   * what it holds, and a canvas is not. Without this a person pressing *Open*
   * on a card would land on an empty board and have to find the page again on
   * the bar. Absent is the ordinary case — a landscape opened on its canvas.
   *
   * `sheet` with no id means "the one this scope is about to be given": the
   * seeding is a `Command` through the session like any other, so it is one
   * undo step and one Activity line rather than a write from the screen.
   */
  initialPage?: InitialPage
}

/** The settings dialog's two calls into the shell. */
export type WorkspaceSettings = {
  /** Called when the dialog opens, so the caller can refresh the tree it offers. */
  onOpen: () => void
  /**
   * Apply the settings to the project as it stands, and hand back what was
   * saved so the session can take it on. Nothing comes back from a move: that
   * changes the ref, and this workspace is remounted on it.
   */
  onApply: (settings: ProjectSettings, current: ScopeSnapshot) => Promise<ScopeSnapshot | undefined>
}

/** The window around the workspace: its menu, its bar, and what it is told. */
export type WorkspaceHost = {
  /**
   * Menu items, the web's overflow and files the OS opened us with — the ones
   * about the project that is open. The shell above takes the ones about
   * folders and preferences; subscribing in both places is how each layer
   * handles what it owns.
   */
  commands?: (listener: (command: HostCommand) => void) => () => void
  /** The host has a menu bar of its own, which carries ⌘Z and ⌘⇧Z (ADR-0005, amended). */
  hostMenu?: boolean
  /**
   * The menu, for a host with no menu bar. Absent on the desktop. The
   * workspace fills in the one capability it knows — whether there is a
   * history to offer — and passes the rest through.
   */
  overflow?: Omit<ToolbarOverflow, 'can'> & { can: Omit<ToolbarOverflow['can'], 'history'> }
  /**
   * Tell the host whether closing the window would lose something. Absent in a
   * browser tab, where the window is ours and `beforeunload` says it.
   */
  onUnsavedWork?: (unsaved: boolean) => void
  /** Passed straight to the toolbar, which is the bar the window borrows. */
  windowChrome?: WindowChrome
  /** Reload, the clipboard and a field's own undo: what the host can do. */
  controls: HostControls
  /**
   * For the boundary around the canvas. The editor is the largest thing in the
   * app and the likeliest to throw; catching it here is what keeps the toolbar,
   * the save menu and the pages beside it alive when it does.
   */
  diagnostics: CrashTrail
}

/** The working file (ADR-0023, ADR-0025): the channel, and the three questions it asks. */
export type WorkspaceFiles = {
  documents: ProjectFileChannel
  /** The shell's one password dialog, behind a promise (ADR-0023). */
  askPassword: AskPassword
  /** Where a working file goes, asked before it lands (ADR-0025). */
  landing: LandingPrompts
  /** A folder it may become; absent where none can be chosen. */
  chooseFolder?: ChooseFolderForWorkingFile
}

/** The folder's snapshots (ADR-0008). */
export type WorkspaceSnapshots = {
  /**
   * The snapshots of the folder this project is in. Absent in a browser tab and
   * until a folder is chosen — there is nothing for a history to be a history
   * of — and the menu offers nothing when it is.
   */
  history?: ProjectHistory
  /** A snapshot succeeded. The shell decides whether that means a push. */
  onTaken?: () => void
}

/** The agent (ADR-0007, ADR-0019): the session handed up, and the glyph on the bar. */
export type WorkspaceAgent = {
  /**
   * The agent's view of this session, handed up as soon as it exists and
   * taken back on unmount. The shell binds the seam, because the subscription
   * must outlive a scope switch and an agent's `app.open` is what causes one;
   * what the workspace owns is the session, the page over the canvas and how
   * to show another.
   */
  onSession?: (view: WorkspaceAgentView | undefined) => void
  /** The glyph on the bar: the server's state, and the way to the dialog. */
  bar?: ToolbarAgent
}

/** What the shell lends every screen: the words, the notices, fresh ids and the clock. */
export type WorkspaceShell = {
  s: Translate
  language: Language
  notify: Notify
  makeId: MakeId
  /** Today as `yyyy-mm-dd`, for a decision's dates. Injected so a test can pin it. */
  today?: () => string
}

/** The editor's own preferences, as last stored and as changed. */
export type WorkspacePreferences = {
  initial: unknown
  onChange: (next: EditorPreferences) => void
}

export type ProjectWorkspaceProps = {
  project: ScopeSnapshot
  source: WorkspaceSource
  tree: WorkspaceTree
  navigation: WorkspaceNavigation
  settings: WorkspaceSettings
  host: WorkspaceHost
  files: WorkspaceFiles
  snapshots: WorkspaceSnapshots
  agent: WorkspaceAgent
  shell: WorkspaceShell
  preferences: WorkspacePreferences
}
