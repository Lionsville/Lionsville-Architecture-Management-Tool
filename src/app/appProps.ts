// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What {@link App} is handed by the composition root: the five seams every
 * build has, and one object per concern for the rest — what the boot read,
 * where work is kept and what its provider brings, the folder, the window and
 * the agent — rather than forty-two values in one list.
 *
 * Every capability is typed as the narrowest shape that will do. The groups
 * are optional wherever every field in them is, so a build (or a test) that
 * has no folder, no menu bar and no provider says nothing about any of them.
 */
import type { StringKey } from '../i18n'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { ThemeMode } from '../platform/theme'
import type { PullOutcome } from '../platform/sync'
import type { WindowChrome } from '../platform/windowChrome'
import type { WorkingSource } from '../platform/workingSource'
import type {
  SourceChip, SourceFailure, SourceStatus, SourceWayIn, SourceWork, SourceWorkChanged,
} from '../platform/sourceProvider'
import type { AgentGateway } from '../ports/AgentGateway'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { HostControls } from '../ports/HostControls'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import type {
  RegisteredChrome, RegisteredMenu, ScopeLibrary, ShellDiagnostics, SourceAgentPanel,
} from './App'
import type { ExampleProject } from './examples'
import type { MakeId } from './useDiagramActions'
import type { ScopeSession } from './useModelSession'
import type { CommandStream } from './useHostCommands'
import type { ProjectFileChannel } from './useProjectFiles'
import type { PreferencesWriter } from './useShellPreferences'
import type { ChooseFolderForWorkingFile } from './workingFileFlows'

/** What the composition root read before the first render, and what went wrong on the way. */
export type AppBoot = {
  /** Read by the composition root before the first render, so this can be sync. */
  initialProject: ScopeSnapshot | undefined
  initialPreferences: unknown
  /** What the browser reports; injected so a test can pin the starting language. */
  browserLanguages?: readonly string[] | string
  /**
   * What the boot's pull answered, when the machine asked for one. Made at
   * the edge of the app, before the project was read and before the watcher
   * started, so a fast-forward's writes are never reported as somebody
   * else's change; what is left for the shell is to say so.
   */
  initialSync?: PullOutcome
  /**
   * A folder that was picked and did not open, from the shell's attempt just
   * before this render. Said once on the toast bar, because the shell has no
   * bar of its own and a pick that ends in nothing looks like a button that
   * does nothing.
   */
  folderFailure?: unknown
  /**
   * The same, for a way in a registered provider offered: pressed, and gone
   * nowhere. Its own field rather than a second meaning for the one above,
   * because the two say different sentences — this one cannot say *folder*, and
   * the boot cannot say what a provider's own dialog was asking for.
   */
  sourceFailure?: unknown
}

/**
 * What the provider of the source work is kept in brings to this shell: the
 * words it gives the bar and the chip, its own menu lines and screens, and the
 * session it wants over an open scope. Everything here is absent for the three
 * sources core ships, and the shell then says what it has always said.
 */
export type AppProvider = {
  /**
   * What this source means by the five words the bar says (ADR-0005; the
   * source provider says the rest). Absent where the document's own machine is
   * the whole answer, which is what all three built-in sources are, and the
   * bar then says exactly what it has always said.
   */
  status?: (work: SourceWork) => SourceStatus
  /**
   * The source says its answer to {@link AppProvider.status} has moved, so
   * the bar asks again. Absent for all three sources that ship, whose every
   * answer moves with the document's own machine.
   */
  onWork?: SourceWorkChanged
  /**
   * The sentence this source's provider gives for where work is kept, as the key
   * of its own string — what the organisation's home says about the chip that
   * names the source.
   *
   * Absent for the three that ship, whose sentences this tree holds already
   * (`ShellToolbar`'s `sourceTipKey`), and absent for a registered provider that
   * gives none: the chip then says nothing rather than a sentence of ours about
   * somewhere this shell has never heard of. Read from the registration by the
   * boot, which is the one place that may ask (`composition.ts`).
   */
  description?: StringKey | (string & {})
  /**
   * What this source's provider calls the chip that names it, at this moment,
   * and what pressing it does (`platform/sourceProvider.ts`'s `chip`).
   *
   * Read again whenever {@link AppProvider.onWork} fires, because the word
   * worth putting there — who is signed in, and whether anybody is — is an
   * answer that arrives after the source was opened and moves again while the
   * window is open. Absent for the three that ship, and for a registered
   * provider that gave none, and then the chip says the name the source was
   * opened under, exactly as it always has. Read from the registration by the
   * boot, which is the one place that may ask (`composition.ts`).
   */
  chip?: (work?: SourceWork) => SourceChip
  /**
   * What this source says a refusal where it keeps work means, in its own
   * sentence (`platform/sourceProvider.ts`'s `SourceFailure`).
   *
   * Named for the notice it feeds rather than for the source that gives it,
   * because {@link AppBoot.sourceFailure} is already a source that would not
   * OPEN — one cause, said once, about a press that went nowhere — and this is
   * a sentence-maker asked every time a write is not taken.
   *
   * Absent for the three that ship, and for a registered provider that gives
   * none, and a refused save then says what it has always said: that this
   * browser could not save the design.
   */
  storageFailure?: SourceFailure
  /**
   * The lines the source providers put in the app's own menu, one entry per
   * registration (`SourceMenu`).
   *
   * Every registered provider's and not the open source's, for the reason
   * {@link AppProvider.chrome} is: a provider that is not the source yet is
   * exactly the one with something to offer — *sign in*, *connect to…* — and
   * the one whose provider answers for the open source is the only one handed
   * the session.
   *
   * Empty for every build in this repository: a folder, this browser's storage
   * and memory have nothing to add to a menu that already says what can be done
   * to a folder.
   */
  menu?: readonly RegisteredMenu[]
  /**
   * A scope has been opened, and here is the session over it: for whoever
   * answers for the source (`composition.ts`). Passed straight through to the
   * workspace, which is where a session exists; absent for all three sources
   * that ship, and then nothing subscribes to anything.
   */
  onScopeSession?: (session: ScopeSession) => (() => void) | void
  /** See `Shell.publishesSteps`: the open scope's changes travel as steps, and are not written whole. */
  publishesSteps?: boolean
  /**
   * Whatever the source providers draw for themselves (`SourceChrome`),
   * one entry per registration and not per open source.
   *
   * Every registered provider's, because a provider that is not the source yet
   * is exactly the one with something to ask: its way in has to be able to draw
   * a dialog, and before this there was nowhere for it to go. The one whose
   * provider answers for the open source is handed the session; the rest are
   * drawn with nothing.
   *
   * Empty for every build in this repository: a folder, this browser's storage
   * and memory have nothing to say that the bar does not say for them.
   */
  chrome?: readonly RegisteredChrome[]
  /**
   * What the provider answering for the open source puts inside *Connect an
   * agent* (`SourceAgentPanel`).
   *
   * The open source's alone, unlike the two above — that dialog is about
   * reaching the landscape that is open, so a panel from a provider that answers
   * for nothing would be a way in to nowhere. Read from the registration by the
   * boot, which is the one place that may ask (`composition.ts`).
   *
   * Absent for every build in this repository, and the dialog is then what it
   * has always been: the switch on the desktop, and the sentence about the
   * desktop in a tab.
   */
  agentPanel?: SourceAgentPanel
  /**
   * The other places this build can work from: what each button says, and what
   * pressing it does (`platform/sourceProvider.ts`).
   *
   * Built at the boot from the providers this build registered, so it is empty
   * for every build in this repository — core registers a folder, this
   * browser's storage and memory, and only the first of those is something a
   * person goes to. Offered on the root's home and on the first-run screen,
   * which are the two screens that ask where work should live; everything
   * below them is about work that already has somewhere to be.
   */
  waysIn?: readonly SourceWayIn[]
}

/** The folder work is kept in, where there is one, and the machine's own folders. */
export type AppFolder = {
  /**
   * Does this host keep projects ONLY in folders?
   *
   * True on the desktop, where keeping them anywhere else means a leveldb
   * inside `userData` (ADR-0003) and the app therefore asks for a folder before
   * it shows anything. A browser tab keeps them itself and merely *may* have a
   * folder, so it is offered one and never made to choose.
   */
  needed?: boolean
  /**
   * How to change the folder. Absent in a browser tab whose browser cannot
   * give one: an app that showed the button anyway would be offering what it
   * cannot do.
   */
  onChoose?: () => void
  /** Work in a folder the user has already granted. The Recent submenu. */
  onOpen?: (root: string) => void
  /**
   * A folder a working file may become (ADR-0025). Absent where no folder
   * can be chosen, and the dialog then offers only to replace what is open.
   */
  onChooseForWorkingFile?: ChooseFolderForWorkingFile
  /** Folders this machine has worked in before, for the first-run screen. */
  recent?: readonly { root: string; name: string }[]
  /**
   * Tell me when a project's folder changed under us. Absent where nothing can
   * watch, and the workspace then never leaves the states it can reach alone.
   */
  watch?: (path: ScopePath, onChanged: () => void, wholeTree?: boolean) => () => void
  /** The snapshots of the working directory. Absent where there can be none. */
  history?: ProjectHistory
  /**
   * The two folder scopes of ADR-0005. Absent where there is no folder; the
   * machine section of the preferences dialog needs this AND a history.
   */
  settings?: FolderSettingsStore
}

/** The window around the app: its menu bar, its title, and what it is told. */
export type AppHost = {
  /**
   * Menu items and files the OS opened us with. Subscribed to here for the
   * commands about folders, and handed to the workspace for the ones about the
   * project that is open — each layer taking what it owns.
   */
  commands?: CommandStream
  /**
   * Does the host draw a menu bar of its own? When it does not, the toolbar
   * carries the menu in an overflow (ADR-0005). A browser tab never has one.
   */
  hostMenu?: boolean
  /** Tell the host whether closing the window would lose something. */
  onUnsavedWork?: (unsaved: boolean) => void
  /** Tell the host which theme is on, so its View menu's radio can be right. */
  onThemeMode?: (mode: ThemeMode) => void
  /** Whether a scope is open, for the menu bar's items that act on one (ADR-0005, amended). */
  onScopeOpen?: (open: boolean) => void
  /**
   * What the window around the app leaves to us. On the desktop the title bar
   * is hidden, so our own top bar has to keep clear of the window controls and
   * be the thing you drag the window by. A browser tab needs neither.
   */
  windowChrome?: WindowChrome
  /**
   * Say what this window is about. Absent in a test, which has no window to
   * name and would otherwise rename the runner's.
   */
  onTitle?: (organisation: string, scope?: string) => void
  /** The desktop's own update settings. Absent on the web, and the section with it. */
  updateSettings?: UpdateSettingsStore
}

export type AppProps = {
  scopes: ScopeLibrary
  preferences: PreferencesWriter
  documents: ProjectFileChannel
  diagnostics: ShellDiagnostics
  /** The host's three: reload and the clipboard for the crash page, and a way out to the manual. */
  hostControls: HostControls
  boot: AppBoot
  /**
   * What you are working from (ADR-0005): a folder by name, the browser's
   * storage, or memory. `memory` means storage refused at boot — a private
   * window, a strict policy — and nothing typed here will be there tomorrow.
   * That is worth a standing notice rather than a toast, because it is true
   * for the whole session and not an event within it; the top bar says it too.
   */
  source?: WorkingSource
  provider?: AppProvider
  folder?: AppFolder
  host?: AppHost
  /**
   * Where an agent's tool calls arrive (ADR-0007). Absent in a browser tab.
   * The open workspace answers them; with no project open, this shell does,
   * with a refusal.
   */
  agent?: AgentGateway
  examples: readonly ExampleProject[]
  /** Fresh ids. Injected because a clock inside a component cannot be tested. */
  makeId: MakeId
  /** Today as `yyyy-mm-dd`. Injected so a card's finding is not at the clock's mercy. */
  today?: () => string
}
