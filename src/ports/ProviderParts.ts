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

export type ProviderParts = {
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
}

/** Sending the person to a scope, as a provider's chrome or menu line may (ADR-0019's destination). */
export type SourceOpen = (to: Destination) => void

/** What a provider's chrome is handed: the open scope's session where it is its source, and the way about. */
export type SourceChromeProps = {
  session?: ScopeSession
  open: SourceOpen
  screen: Screen
  movedBy: MovedBy
}

/** What a panel opened from the chip that names a source is handed: a chrome's, and the way to close it. */
export type SourceChipPanelProps = SourceChromeProps & { close: () => void }

/** What the chip's own face is handed: the word it goes by now, and whether its panel is open. */
export type SourceChipFaceProps = { label: string; open: boolean }

/** What a provider's part of *Connect an agent* is handed. */
export type SourceAgentPanelProps = { session?: ScopeSession }

/** What a provider is told when it is asked for its lines in the app's own menu. */
export type SourceMenuContext = {
  readonly session?: ScopeSession
  readonly readOnly: boolean
  readonly open: SourceOpen
}
