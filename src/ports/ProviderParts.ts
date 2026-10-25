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
import type { PersonId } from '../model/person'
import type { DistinctPair } from '../people/distinct'
import type { PeopleAction, Person, PolicyHold } from '../people/person'
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
  /**
   * The address a link to this source starts from, where there is one: where
   * somebody else who may read the same work reaches it — a server's public
   * address, never a folder's path or this browser's storage. The app adds
   * the place the person is at as the fragment (ADR-0033, amended), so the
   * provider says where and the app says what is there. Asked each time a
   * link is made; `undefined` is *not now*. Absent where work kept here
   * cannot be reached from a link, which is all three core registers.
   */
  shareAddress?: () => string | undefined
  /**
   * Where the drawing editor is served, when this source has one: the frame's
   * address. Asked when a drawing is edited. `undefined` means the editor is
   * not available, and the drawing is still shown. Absent where this source
   * has no editor, which is every source this repository opens in a browser.
   */
  drawingOrigin?: () => string | undefined
  /**
   * What this source does about the people register beyond keeping it
   * (ADR-0036 §10, §11), where it does more. Absent for all three core
   * registers, and the app then applies the policy itself and keeps *This is
   * me* with the install.
   */
  people?: SourcePeople
  /**
   * Who may comment, and whose comments they may remove (ADR-0037 §5), where
   * the source has accounts that say more than whether a scope is written.
   * Absent for all three core sources: a person comments wherever they may
   * write, and may remove any comment there.
   */
  comments?: SourceComments
  /** Handed back to this provider's own chrome and panels while its source is open. */
  own?: Own
}

/**
 * What a source with accounts says about comments (ADR-0037 §5), beside
 * `readOnlyAt`: the doors decide every step, and the screens offer what this
 * says. Each answer is for the person using the app, about one scope.
 */
export type SourceComments = {
  /** Whether this person may comment on a scope they may only read. Absent, nobody comments on what they only read. */
  readonly mayComment?: (scope: ScopePath) => boolean
  /** Whether this person may remove other people's comments in a scope. Absent, whoever may write the scope may. */
  readonly mayModerate?: (scope: ScopePath) => boolean
}

/**
 * A source that knows more about its people than a register of names: one
 * that applies the policy on a schedule of its own, knows which entry is the
 * person using it, hears the register change elsewhere, or knows who may do
 * what with it.
 */
/** An account of the source, as a record names who recorded it. */
export type SourceAccount = { readonly id: string; readonly name: string }

export type SourcePeople = {
  /**
   * The source applies the organisation's policy itself, on a schedule of its
   * own: the app forgets and removes nobody when the organisation is opened
   * or the day turns.
   */
  readonly appliesPolicy?: boolean
  /**
   * The entry that is the person using the app, where the source knows it — an
   * account linked to an entry. Asked each time the register is read. Where
   * the source says, *you* is marked from it and *This is me* is not offered.
   */
  readonly me?: () => PersonId | undefined
  /**
   * The account using the app, where the source has accounts: its id and the
   * name it goes by. What an observation is recorded by (ADR-0038, amended
   * §10), and what *Mine* matches besides the entry {@link me} names. Absent
   * on a source with no accounts, where *This is me* says who.
   */
  readonly account?: () => SourceAccount | undefined
  /**
   * Hear when the register changed other than through this window, and the
   * way to stop: the app reads it again, so a forget shows everywhere at once.
   */
  readonly changes?: (onChanged: () => void) => () => void
  /**
   * Whether the person using the app may make one kind of change — of one
   * entry, where the answer is the entry's (a correction, a leave) — where the
   * source knows more than whether the register may be written at all: who
   * may merge, forget and remove, say, or a right that reaches some people
   * and not others. Asked each time the page is drawn, after the register was
   * read; where it says no, the page offers nothing for that change. Absent,
   * every change is offered wherever the register may be written.
   */
  readonly may?: (action: PeopleAction, id?: PersonId) => boolean
  /**
   * The source grants a right from holding a managing role (ADR-0036 §12):
   * the person it says is using the app ({@link me}) may change the people of
   * every unit they hold a managing role in today, and of every unit below
   * it — an assignment there added, corrected, ended or taken away, a managing
   * role's only strictly below — where the scope is otherwise only read to
   * them (`model/managing.ts`). The app then offers those changes on those
   * units and lets their steps through a scope it otherwise reads, and the
   * register's changes through {@link may}; the source's own doors decide each
   * one. Absent, scope rights decide alone.
   */
  readonly managingRight?: boolean
  /**
   * Whether an entry has a work address that is not shown to this person: the
   * page says so, rather than that there is none.
   */
  readonly withheld?: (id: PersonId) => boolean
  /**
   * Why the source's own schedule did not forget an entry that was due, where
   * it held one back: the page says it beside the entry's state, for whoever
   * may forget them to decide.
   */
  readonly held?: (id: PersonId) => PolicyHold | undefined
  /**
   * Whether an entry is linked to an account (ADR-0036 §14), where the source
   * has accounts: a possible duplicate says so beside the person, and *Merge…*
   * keeps a linked entry first. Absent, no entry is.
   */
  readonly linked?: (id: PersonId) => boolean
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
 * The people register a working file carries: its entries, the ids it
 * removed (ADR-0036 §8), and the pairs it answered as not the same person.
 */
export type CarriedPeople = {
  readonly people: readonly Person[]
  readonly removed: readonly PersonId[]
  readonly distinct?: readonly DistinctPair[]
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
  /** The scopes written as one, and then the people register the file carries, where it carries one (ADR-0036 §8). */
  place(scopes: readonly ScopeSnapshot[], people?: CarriedPeople): Promise<void>
  read(path: ScopePath): Promise<ScopeSnapshot | undefined>
  opening: Opening
}

/**
 * How a move a provider asks for is said: `by: 'provider'` where it is the
 * provider's own doing and not a press of the person's passed on — then the
 * screens it brings are said to be the provider's (`MovedBy`), never the
 * person's. Absent, the move is said as it always was.
 */
export type SourceOpenOptions = { readonly by?: 'provider' }

/** Sending the person to a scope, as a provider's chrome or menu line may (ADR-0019's destination). */
export type SourceOpen = (to: Destination, options?: SourceOpenOptions) => void

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

/**
 * A problem the app ran into, as the facts it had: handed to a provider's
 * action on a problem ({@link ProblemAction}) when the person presses it, and
 * never before. Every field but `where` and `at` is there where the app had it.
 */
export type Problem = {
  /** Where it was caught or refused: a boundary (`app`, `editor`), a step, the session, the window. */
  readonly where: string
  /** What the person was told, or what was refused, as its key. */
  readonly key?: string
  /** What kind of error it was, where it was one (`TypeError`). */
  readonly name?: string
  /** What it said of itself. */
  readonly message?: string
  /** Its stack, where it carried one. */
  readonly stack?: string
  /** The command that was refused, by its type. */
  readonly command?: string
  /** When it happened, as an ISO 8601 instant. */
  readonly at: string
  /** Where the app was when it happened (ADR-0019's `Screen`). */
  readonly screen?: Screen
}

/**
 * An action a provider offers the person on a problem: the words on its
 * button, as a key of the provider's own table, and what a press does with
 * the problem. The app sends nothing anywhere itself.
 */
export type ProblemAction = {
  readonly labelKey: string
  readonly run: (problem: Problem) => void
  /**
   * Whether the action can be taken now, asked each time a problem happens,
   * before its button is drawn: where it answers `false`, that problem's
   * notice or crash screen carries no button. Absent, it always can.
   */
  readonly available?: () => boolean
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
