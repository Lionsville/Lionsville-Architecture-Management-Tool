// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a provider hands the app when its source is opened (ADR-0022, ADR-0031
 * §4), and what the app hands the parts a provider draws for itself.
 *
 * One type for every provider: the three core registers and any composed from
 * outside implement the same parts, with the source's repositories among them
 * and required — the only way the app reaches where work is kept — and run
 * core's suites against those repositories. Nothing of the host's is here: the
 * window, the documents a person saves, the trail and the agent's door are the
 * host's to bring, whatever the source.
 *
 * Types only, and no React: a chrome is a component, and what it is handed is
 * declared here so that both the app, which draws it, and a provider, which
 * writes it, can name the same props. The component types themselves stay
 * where a component may be named.
 */
import type { Destination, MovedBy, Screen } from '../agent/screen'
import type {
  SourceFailure, SourceLanding, SourceStatus, SourceWork, SourceWorkChanged,
} from '../platform/sourceProvider'
import type { WorkingSource } from '../platform/workingSource'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { PreferencesStore } from './PreferencesStore'
import type { Repositories } from './Repositories'
import type { ScopeSession } from './ScopeSession'

/**
 * Hear when a scope changed other than through this window — or, with
 * `wholeTree`, when anything under it did — and the way to stop. What a source
 * says where it knows of a second author: a watcher, a channel.
 */
export type SourceChanges = (scope: ScopePath, onChanged: () => void, wholeTree?: boolean) => () => void

/**
 * The parts a provider hands the app, and `Own`: what its own chrome and
 * panels are handed back while its source is open — the state of a
 * conversation with the source that only the provider understands, typed by
 * the provider so its own code never has to guess at it.
 */
export type ProviderParts<Own = unknown> = {
  /** Where the source keeps work, in the domain's words. */
  repositories: Repositories
  /** What it is, and what it is called on the bar. */
  source: WorkingSource
  /** Where this install's preferences go, where the source keeps them; the host's otherwise. */
  preferences?: PreferencesStore
  /** What this source means by the five words the bar says (`platform/sourceProvider.ts`). */
  sourceStatus?: (work: SourceWork) => SourceStatus
  /** The source says its answer to `sourceStatus` has moved. */
  onSourceWork?: SourceWorkChanged
  /** What a refusal where it keeps work means, in its own sentence. */
  sourceFailure?: SourceFailure
  /** A scope has been opened: the session over it, for whoever answers for the source. */
  onScopeSession?: (session: ScopeSession) => (() => void) | void
  /** Every change of the open scope travels as a step through whoever took its session. */
  publishesSteps?: boolean
  /** Which scopes of this source may be read and not written. */
  readOnlyAt?: (scope: ScopePath) => boolean
  /** Where the address this source was reached at asked to land. */
  opensAt?: SourceLanding
  /** A change made other than through this window, where the source can hear of one. */
  changes?: SourceChanges
  /**
   * Where this source keeps the history of what is recorded, in a sentence of
   * the provider's own (a key of its table): said where a person records an
   * entry or reads the entries, because *in this browser* and *for as long as
   * this tab is open* are facts about the source a person should know first.
   */
  historyNoteKey?: string
  /**
   * Whether a history is kept here already — one somebody started, and one
   * that can take an entry on this machine. Absent where one always is. The
   * entry a replace takes first is recorded only where one is: it never
   * starts a history nobody asked for, and where none can be kept the replace
   * goes on as its question warned.
   */
  historyKept?: () => Promise<boolean>
  /**
   * What the bar, the subtitle and a removal say of this source, where it is
   * not what its registration says: a source that opened as something less
   * than it is registered as — somewhere that keeps nothing — says so.
   */
  sayings?: ProviderSayings
  /**
   * Where a source only learns what it can keep by asking: the parts it
   * settles on. The boot asks before anything is drawn, so the bar, the
   * subtitle and the history's note say what is so from the first frame.
   */
  settled?: () => Promise<ProviderParts<Own>>
  /** Handed back to this provider's own chrome and panels while its source is open. */
  own?: Own
}

/** A provider's sentences about its source, as keys of its own table. */
export type ProviderSayings = {
  readonly labelKey?: string
  readonly describeKey?: string
  readonly whereKey?: string
  readonly removeKey?: string
}

/** How a provider's chrome says something in passing, as the app says its own. */
export type SourceNotify = (message: string, severity: 'success' | 'info' | 'warning' | 'error') => void

/**
 * The person's preferences, as a provider's chrome may keep something in
 * them: one blob with one writer, which is the app's, so a chrome writes
 * through it and never beside it.
 */
export type SourcePreferences = {
  /** The preferences as the app holds them now. */
  read(): unknown
  /** Merge these keys in, and write the blob. */
  write(patch: Record<string, unknown>): void
}

/**
 * Somewhere new a working file may become (ADR-0025), chosen by a way in:
 * what it is called, whether it already holds something — a scope, a board —
 * so the person is asked before anything is written over, the scopes written
 * into it as one, and one of them read back as it now stands. Moving the app
 * there afterwards is the boot's, which owns the source; `opening` is what it
 * opens it with.
 */
export type SourceDestination<Opening = unknown> = {
  name: string
  occupied: boolean
  place(scopes: readonly ScopeSnapshot[]): Promise<void>
  read(path: ScopePath): Promise<ScopeSnapshot | undefined>
  opening: Opening
}

/** Sending the person to a scope, as a provider's chrome or menu line may (ADR-0019's destination). */
export type SourceOpen = (to: Destination) => void

/**
 * What a provider's chrome is handed: the open scope's session and its own
 * parts where it is the source, the way about, and the app's ways of saying
 * something and of keeping a preference.
 */
export type SourceChromeProps<Own = unknown> = {
  /** Does this provider answer for the source that is open? */
  current: boolean
  session?: ScopeSession
  /** What this provider handed with its parts, where its source is the one open. */
  own?: Own
  open: SourceOpen
  screen: Screen
  movedBy: MovedBy
  notify: SourceNotify
  preferences: SourcePreferences
  /**
   * What the source holds changed as a whole, other than through this window
   * — another version taken in, work brought in from elsewhere: the tree, the
   * index and the open scope are read again, with nothing carried over.
   */
  reread: () => void
  /**
   * Write what the open scope holds unwritten, now — asked before a provider
   * replaces what the source keeps from outside this window (another version
   * taken in, older work brought over, a copy made), so a moment-old edit is
   * kept first and not written over what arrived. Rejects with why it was not
   * kept, and the provider then replaces nothing.
   */
  flush: () => Promise<void>
}

/** What a panel opened from the chip that names a source is handed: a chrome's, and the way to close it. */
export type SourceChipPanelProps<Own = unknown> = SourceChromeProps<Own> & { close: () => void }

/** What the chip's own face is handed: the word it goes by now, and whether its panel is open. */
export type SourceChipFaceProps = { label: string; open: boolean }

/**
 * What a provider's own button in the bar is handed: which bar it is in —
 * the workspace's, over an open scope, or a home's — the way about and where
 * the app is, and what a chrome is handed besides that costs nothing to pass.
 * Drawn only while this provider's source is the one open, so `own` is always
 * its own and `session` is the open scope's where one is.
 */
export type BarButtonProps<Own = unknown> = {
  where: 'workspace' | 'organisation'
  open: SourceOpen
  screen: Screen
  movedBy: MovedBy
  notify: SourceNotify
  /** The open scope's session, on the workspace's bar; absent on a home. */
  session?: ScopeSession
  /** What this provider handed with its parts. */
  own?: Own
}

/** What a provider's part of *Connect an agent* is handed. */
export type SourceAgentPanelProps = { session?: ScopeSession }

/** What a provider's part of *Preferences* is handed: its own parts, and the app's way of saying something. */
export type SourcePreferencesPanelProps<Own = unknown> = { own?: Own; notify: SourceNotify }

/** What a provider is told when it is asked for its lines in the app's own menu. */
export type SourceMenuContext = {
  readonly session?: ScopeSession
  readonly readOnly: boolean
  readonly open: SourceOpen
}
