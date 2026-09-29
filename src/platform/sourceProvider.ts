// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A kind of place work is kept, as something that can be registered.
 *
 * `workingSource.ts` says WHAT you are working from; this says who answers for
 * it. The three that ship — a folder, this browser's storage, memory — are
 * three registrations rather than three branches, so a build composed from this
 * one can add a fourth without a fork. It is the icon packs' pattern
 * (`model/logoRegistry.ts`) applied to where work is kept: a provider names its
 * own kind, brings its own words and its own way in, and registering one needs
 * no edit to the shell above it.
 *
 * The registry itself is the composition root's, because only that file may
 * know both a seam and a filling — and because what a provider builds is a
 * `Shell`, which is that file's word. So the shape here is generic in what it
 * builds: everything below the composition root can read and test this type
 * without learning what a shell is.
 *
 * Deliberately small. Three fillings fit on it, and nothing in this tree may
 * need a fourth to exist for it to make sense.
 */
import type { StringKey } from '../i18n/strings'
import type { WorkingSource } from './workingSource'

/**
 * The words a bar says about work in hand, and the one definition of them.
 *
 * `projects/documentSession.ts` is the state machine that answers them for a
 * file, and its `DocumentStatus` is this union plus `no-file` — the one state
 * that is genuinely about a file and nothing else ("there is nowhere to put
 * this yet"). The five here are about work, not about files, which is why they
 * live where both the shell and the adapters can read them: a source that
 * keeps work somewhere other than a file still has to say which of the five it
 * is in, and *dirty* is then not "a file not yet written" but whatever not yet
 * arriving means where that source keeps things.
 */
export type SourceStatus =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'external-changed'
  | 'conflict'

/**
 * What a provider is told when it is asked which of the five words applies.
 *
 * The document's own machine has already reduced every event into a status;
 * this is that answer plus the one thing it deliberately keeps beside it, and
 * a provider that means the same as a file says so by answering `status`
 * unchanged — which is what having no `statusOf` at all does.
 *
 * Structurally a `DocumentSession`, so the session state is handed over as it
 * stands. Written out rather than imported because this layer may not know
 * what a project is, and a provider has no business with the fingerprint, the
 * path or the last error anyway.
 */
export type SourceWork = {
  /** What the document's own machine makes of it. */
  readonly status: SourceStatus
  /** Edits arrived while a write was in flight. */
  readonly editedWhileSaving: boolean
}

/**
 * Say when what this source knows about the work has changed, until the
 * returned function is called.
 *
 * {@link SourceProvider.statusOf} is asked again whenever the document's own
 * machine moves, which is the whole story for a file. A source that keeps work
 * somewhere else has a second story — work that has not left this machine yet,
 * a write somewhere that has not been acknowledged — and nothing in it moves
 * the machine. Without this the bar would say *clean* until a keystroke
 * happened to make it say something else, which is worse than saying nothing.
 *
 * A listener means *ask me again*, and carries nothing: `statusOf` is where the
 * answer is given, and the provider knows which scope it is being asked about
 * because it was handed that scope's session when it opened.
 */
export type SourceWorkChanged = (listener: () => void) => () => void

/**
 * What a refusal where this source keeps work means, as the sentence to show
 * for it.
 *
 * A save that was not taken says one thing above this line — *this browser
 * could not save the design (storage full or blocked)* — and for a source that
 * is not this browser that sentence is not vague, it is wrong: it names the
 * wrong place, blames a quota that is not the one that ran out, and tells
 * somebody to keep a working file when the copy that matters is somewhere else
 * entirely. Only whoever answers for the source knows what its store said no
 * for, so only it can say what a person should do about it.
 *
 * A sentence and not a key, which is the one thing this asks for differently
 * from {@link SourceProvider.describeKey}: what is worth saying depends on the
 * cause, and a key with nothing to interpolate could not tell being signed out
 * from being out of room. A provider that brought its own table brought its own
 * way of reading it (`i18n`'s `registerStrings` and `translateFrom`), so it is
 * asked for the words.
 *
 * `undefined` is *nothing from me about this one*, for a provider that has
 * already said it somewhere of its own — a strip, a line in the menu. Nothing
 * of ours is shown then either: the pair is ours, and a refusal nobody
 * mentioned must not be followed by *saving works again*.
 *
 * The cause is whatever the store rejected with, and is absent where the caller
 * had none, so nothing may be assumed about its shape.
 */
export type SourceFailure = (cause: unknown) => string | undefined

/**
 * The way in for a person, as a description rather than a screen.
 *
 * A label the shell can render beside the ones it already offers; the
 * component behind it is the provider's own, because what it has to ask for is
 * the provider's business and not the shell's. A key rather than a sentence,
 * for the same reason every other string here is one — and `string` beside
 * `StringKey` because a provider a build composed from this one registers
 * brings its own table, whose keys are not in this one's. That table is
 * `i18n`'s `registerStrings`, which adds keys and may replace none; a key
 * nobody registered renders as itself, which is a blemish and never a blank.
 */
export type SourceConnect<Opening = void> = {
  readonly labelKey: StringKey | (string & {})
  /**
   * Ask the person for whatever this source needs to be given, and answer with
   * it — or with nothing, where they backed out.
   *
   * The provider owns the dialog and the shell owns the button. That split is
   * the whole of this type: what has to be asked for is an address, a folder, a
   * name, a choice from a list only the provider can fetch, and a shell that
   * tried to describe all of those would be a shell that has to be edited for
   * the fifth one. What comes back is the same `Opening`
   * {@link SourceProvider.open} takes, so the boot's next line is the one it
   * already runs for a folder.
   *
   * Nothing is a refusal, not a failure: a person who closed the dialog has
   * said what they meant, and a screen that then reported an error would be
   * arguing with them. A failure is a rejection, and is reported.
   */
  open(): Promise<Opening | undefined>
  /**
   * The same answer, worked out from where the page was opened — for a build
   * that knows its source before it draws anything.
   *
   * A person clicking a button is one way in; a link is the other, and it is
   * the one that has to work before the first render, because a shell composed
   * over the wrong source and swapped afterwards is a mount thrown away and an
   * empty screen in between. Synchronous for the same reason: the boot reads
   * this while it is deciding what to render, not after.
   *
   * Absent where an address cannot be carried, and `undefined` where this
   * location carries nobody's — which is every ordinary boot, so it must be
   * cheap and must never throw.
   */
  fromLocation?(location: SourceLocation): Opening | undefined
  /**
   * Whether this way in is worth drawing at all where it is about to be drawn,
   * and what it should say there.
   *
   * A button per registered provider is exactly right on a screen that is
   * asking where work should live for the first time. It is wrong in the one
   * case the registry cannot see: where this provider already answers for the
   * source that is open, *connect to…* offers a person the place they are
   * already working from, and pressing it runs the handshake again to arrive
   * where they already are.
   *
   * `null` is *not here*, and nothing is drawn; an answer with a label is
   * *drawn, saying this*, which is how a provider that has something else to
   * offer once its own source is open says so without registering a second way
   * in. Absent — core's folder, which is offered wherever a folder can be
   * chosen — leaves {@link SourceConnect.labelKey} exactly as it is, and so does
   * an answer of `undefined`: a provider that said nothing has said nothing.
   *
   * Told what it needs to tell those apart, and nothing else: what is open now,
   * and where the page was opened. Asked again whenever
   * {@link SourceWorkChanged} fires — signing out of somewhere is the moment its
   * way in becomes worth offering again — and afresh per source, because a
   * source that changes is a fresh mount. So it must be cheap, and it is a
   * provider's own code running while a screen draws: one that throws costs its
   * own button the label it asked for and nobody else's anything.
   */
  offer?(context: SourceOfferContext): SourceOffer | null | undefined
  /**
   * Can this way in be taken here at all? A host that cannot give what it asks
   * for — a picker the browser does not have — draws no button for it, and
   * offers no line in its menu. Absent is *yes*.
   */
  possible?(): boolean
  /**
   * Where work has nowhere to be kept until this way in is taken: the first
   * screen asks for it, and nothing else is drawn until it is answered. Asked
   * at the boot, because it is a fact about the host. Absent is *no*.
   */
  required?(): boolean
  /**
   * This way in is the host's own: the *Open…* line in its menu, and its list
   * of the places worked from lately, are this provider's
   * ({@link SourceConnect.recent}, {@link SourceConnect.reopen}). One
   * registration says so, and the first that does is the one the menu names.
   */
  readonly hostMenu?: boolean
  /**
   * The sentence the first screen says under its question, where this way in
   * is the one it asks for ({@link SourceConnect.required}).
   */
  readonly introKey?: StringKey | (string & {})
  /** What its button says on that screen, where that is not {@link SourceConnect.labelKey}. */
  readonly firstLabelKey?: StringKey | (string & {})
  /** What the app says where this way in was taken and did not open, with `{message}`. */
  readonly failedKey?: StringKey | (string & {})
  /**
   * The place this machine last worked from, where the preferences remember
   * one and it may still be opened — worked out at the boot, before anything
   * is drawn, so the app opens where it was left. Nothing where there is none,
   * or where it may no longer be reached; a boot is not a gesture, and a
   * permission that needs one is not asked for here.
   */
  resume?(preferences: unknown): Promise<Opening | undefined>
  /**
   * What the preferences keep about an opening a person just chose, so that
   * {@link SourceConnect.resume} finds it at the next boot: the blob with this
   * provider's own keys set. The boot writes it, because the blob has one
   * writer.
   */
  remember?(preferences: unknown, opening: Opening): Record<string, unknown>
  /** The places this machine has worked from lately, most recent first: one click away rather than one dialog. */
  recent?(): Promise<readonly SourceRecent[]>
  /**
   * Open one of those again, by its key — the host's Recent list, or the
   * first screen's. Nothing where it cannot be.
   */
  reopen?(key: string): Promise<Opening | undefined>
}

/** A place worked from lately: what tells it apart, and what it is called. */
export type SourceRecent = {
  readonly key: string
  readonly label: string
}

/**
 * What a provider is told when it is asked whether to draw its way in.
 *
 * The source as it stands — a folder, a browser's storage, its own, somebody
 * else's — and the address the page was opened at, which is the other half of
 * *where am I*: a provider reached by a link is looking at the same location
 * {@link SourceConnect.fromLocation} read, and may mean to say something
 * different about a button beside it.
 */
export type SourceOfferContext = {
  readonly source: WorkingSource
  readonly location: SourceLocation
}

/**
 * A way in, offered: what it says here.
 *
 * A label and nothing else, because everything else about a way in was settled
 * when it was registered. `null` in its place is the button not drawn at all.
 */
export type SourceOffer = {
  readonly labelKey: StringKey | (string & {})
}

/**
 * Where an address asked to land: a scope, and one of its views where it named
 * one.
 *
 * A link is a way in to a place as well as to a source — *this board, in that
 * environment* — and the provider that recognised the address is the one that
 * knows which part of it names the place. So it says so with its parts
 * (`Shell.opensAt`), and the boot opens that scope in place of the one this
 * machine last had open: **on its home** where the address named no view —
 * the way opening a scope from a home does — and on the view where it named
 * one. A scope that is not there, or that this person may not read, loads as
 * nothing, and the boot then does what it does for any scope that is gone:
 * the organisation's home. A view the scope does not hold is ignored, and the
 * scope opens on the view it would have opened on anyway. A provider that
 * wants a fresh start with no place in its address to begin at the
 * organisation's home, rather than where this machine last was, lands on the
 * root: `{ scope: '' }`.
 *
 * A path, and never a name: the path is the ref (ADR-0012 §1).
 */
export type SourceLanding = {
  readonly scope: string
  readonly view?: string
}

/**
 * Where the page was opened, as much of it as a provider may read.
 *
 * Written out rather than taken from the DOM's `Location`: this module is pure
 * and the desktop's main process compiles it, so naming the three strings is
 * both honest about what is used and testable with an object literal. What a
 * provider does with them is its own business — this tree neither parses them
 * nor says what an address looks like.
 */
export type SourceLocation = {
  readonly href: string
  readonly search: string
  readonly hash: string
}

/**
 * A way in, as the shell draws it: what the button says, and what pressing it
 * does.
 *
 * The other side of {@link SourceConnect}, one layer up. The boot turns each
 * registered provider's connect affordance into one of these — the label
 * unchanged, the pressing wired to the provider's own dialog and then to
 * opening what it answered — and the screens that offer a way in draw one
 * button each, in registration order, knowing nothing else about any of them.
 */
export type SourceWayIn = {
  /** Which provider it reaches. Its own kind, and what a list is keyed on. */
  readonly kind: string
  /** What the button says: {@link SourceConnect.labelKey}, unchanged. */
  readonly labelKey: StringKey | (string & {})
  readonly onConnect: () => void
  /**
   * {@link SourceConnect.offer}, with the one thing the shell may not read
   * already bound.
   *
   * The question is asked where the button is drawn, because that is where the
   * answer can change while the window is open; the location is read where an
   * address may be read at all, which is the boot. So the boot binds it and the
   * shell asks the rest. Absent for a provider that offers its way in
   * unconditionally, which is every one in this repository.
   */
  readonly offer?: (source: WorkingSource) => SourceOffer | null | undefined
  /** {@link SourceConnect.hostMenu}: the host's *Open…* line and Recent list are this way in. */
  readonly hostMenu?: boolean
  /** {@link SourceConnect.required}, as the boot found it: the first screen asks for this way in. */
  readonly required?: boolean
  /** {@link SourceConnect.introKey}. */
  readonly introKey?: StringKey | (string & {})
  /** {@link SourceConnect.firstLabelKey}. */
  readonly firstLabelKey?: StringKey | (string & {})
  /** The places this way in worked from lately, as the boot last read them: one click away. */
  readonly recent?: readonly SourceRecent[]
  /** Work again in one of those, by its key. */
  readonly onReopen?: (key: string) => void
}

/**
 * Everything the shell has to know about one kind of source.
 *
 * `Parts` is what opening it produces — the composition root's `Shell`, or the
 * parts of one it replaces. `Opening` is what this provider needs to be given
 * to do it, which only it understands: a directory handle, a name, a channel.
 * A provider that needs nothing takes nothing. `Base` is what the shell hands
 * over from its own side, and is generic for the reason `Parts` is: a shell is
 * the composition root's word, and nothing down here may learn it. It defaults
 * to `unknown` rather than to nothing, so the three that ship — which declare
 * their own type and read none of it — are written exactly as they were.
 */
export type SourceProvider<Parts, Opening = void, Base = unknown> = {
  /** The kind this provider answers for, as `WorkingSource` spells it. */
  readonly kind: string
  /**
   * What working from this source gives the shell, from what this source was
   * given and from the shell it is opening into.
   *
   * `base` is that shell's own side of the handshake — the trail it keeps and
   * the seams it has already filled (`composition.ts` says which). A provider
   * that replaces the store has no reason to compose a second preferences
   * store, a second document gateway or a second browser store, and one that
   * did would be a build in which the language, the theme and the *Save as…*
   * dialog quietly stopped being the app's. It is also where a failure of its
   * own goes: a provider reporting to the console reports somewhere the crash
   * page cannot hand over.
   *
   * **A promise is allowed, and the boot waits for it.** Some sources are only
   * themselves once they have shaken hands: what this source is called, which
   * scope it holds and whether a person may write to it at all are answers that
   * have to be asked for, and `readOnly` is read at the first paint rather than
   * a moment after it — a shell mounted over the wrong answer and swapped is a
   * mount thrown away, which is the same reasoning
   * {@link SourceConnect.fromLocation} is written for. Waiting where the
   * alternative is drawing twice is the cheaper of the two.
   *
   * A rejection is a source that could not be opened, and the boot says so on
   * the screen it already keeps for a boot that failed, with the provider's own
   * sentence on it. Nothing is a refusal only at the way in, where a person
   * closed a dialog; here there is nobody to have said anything.
   *
   * All three that ship answer straight away and say `Parts` rather than
   * `Promise<Parts>`, which is not only their habit: the fallback shell is
   * composed before the boot has anywhere to wait.
   */
  open(opening: Opening, base: Base): Parts | Promise<Parts>
  /** How a person reaches it, where there is a way in. */
  readonly connect?: SourceConnect<Opening>
  /**
   * The sentence that says where work is kept here and what that costs, as
   * the key of the provider's own string: what the chip that names the
   * source says when a person hovers it — *your projects are files in this
   * folder*, *nothing is being kept*.
   *
   * Only the provider knows what kind of place it is, whether anything
   * outlives the window and what a person should do about it. A key, and
   * `string` beside `StringKey` for the reason {@link SourceConnect.labelKey}
   * is: a provider brings its own table through `i18n`'s `registerStrings`,
   * so the sentence is in every language without this tree holding a word of
   * it.
   *
   * Absent means the chip says nothing at all — no tooltip rather than a
   * sentence of ours. A guess about somewhere this shell has never heard of
   * would be worse than silence: it might promise a copy that cannot be made.
   */
  readonly describeKey?: StringKey | (string & {})
  /**
   * What the chip calls a source of this kind, where the source's own name is
   * not the whole of it: the provider's string, with `{name}` for that name —
   * *Folder · {name}*, *In this browser*. Absent, the chip says the name.
   */
  readonly labelKey?: StringKey | (string & {})
  /**
   * The organisation's subtitle's first sentence: where everything here is
   * kept. Absent, {@link SourceProvider.describeKey} is said there instead.
   */
  readonly whereKey?: StringKey | (string & {})
  /**
   * What removing a scope takes with it here, with `{name}`: its files, what
   * this browser kept of it. Absent, the app says what removing takes in
   * words of its own, which name no place.
   */
  readonly removeKey?: StringKey | (string & {})
  /**
   * What the notice over a scope that could not be read whole says here, with
   * `{files}`, where this source has more to say than the app's own sentence
   * — a file a person can mend by hand. Absent, the app names the two ways
   * every source has: put it back from the history, or bring in a working
   * file.
   */
  readonly unreadableKey?: StringKey | (string & {})
  /**
   * What this source means by the five words. Absent where it means what a
   * file means, which is what all three that ship mean.
   */
  readonly statusOf?: (work: SourceWork) => SourceStatus
  /**
   * What the chip on a scope's home says about this source, in the provider's
   * own words — and what pressing it does.
   *
   * `WorkingSource.name` is what the source was called when it was opened, and
   * for a source somebody has to be known to before it will answer anything, the
   * interesting word is not decided then: who is signed in, and whether anybody
   * is at all, are answers that arrive after the handshake and change again
   * while the window is open. Without this the chip would say the name it was
   * opened under until the app was reloaded.
   *
   * Asked again whenever {@link SourceWorkChanged} fires, which is the same *ask
   * me again* {@link SourceProvider.statusOf} is asked on: a provider whose own
   * answer has moved says so once and both are re-read.
   *
   * `work` is what the shell knows about the work where the chip is drawn, which
   * on a scope's home — the one place the chip is — is nothing at all, because
   * nothing is open there. A provider that only wants to name somebody ignores
   * it, as all of them could.
   *
   * Absent for the three that ship, and then the chip says what it always said.
   */
  readonly chip?: (work?: SourceWork) => SourceChip
  /**
   * What has lately been done to a scope, as the place that keeps it says —
   * everybody's steps and not only this window's ({@link SourceRecentActivity}).
   *
   * Absent for the three that ship, whose Activity list is the open session's
   * own steps and nothing else, exactly as it always was.
   */
  readonly recentActivity?: SourceRecentActivity
  /**
   * Whether the far end can be asked anything right now, where the source has
   * one: `false` while its connection is down or waiting for a sign-in.
   *
   * A read the shell makes by itself — the tree read again after a step that
   * changed its shape — is skipped while this says `false`, because a read of
   * a source that is not there fails, and a failure the person did not ask for
   * is an error on their screen about nothing they did. The provider owes the
   * read instead, and says the tree changed when it is back (`ProviderParts.changes`).
   * Asked at the moment of the read, so it must be cheap and must not throw.
   *
   * Absent for the three that ship, which are always there to be read.
   */
  readonly connected?: () => boolean
}

/**
 * The recent steps of one scope, as the place that keeps work remembers them,
 * newest last.
 *
 * The Activity list reads the open session's steps, and a session begins when a
 * scope is opened: for a folder on this machine that is the whole story, because
 * nobody else writes to it while it is open. A source that many people write to
 * at once keeps a log of every step with its author on it, and a list that
 * showed only what happened since this window opened — with no name on this
 * person's own steps — told a person who had just come in that nothing had
 * happened, and told them nothing about who did what. So the list asks the
 * source, and merges what it is told with what the session holds.
 *
 * A promise, because the log is somewhere else; asked when the list is opened
 * and not before, because a list nobody opens is a request nobody needs.
 * `undefined` is *nothing from me*: the list is then the session's alone and
 * reads exactly as it does over a folder. An empty list is an answer — the
 * scope has no steps yet. A scope the person may not read answers empty, the
 * same as a scope with no steps, so the answer says nothing about which.
 *
 * A rejection is a source that could not be asked, and the list shows what the
 * session holds, as it would have with no answer at all.
 */
export type SourceRecentActivity = (scope: string) => Promise<readonly SourceActivityLine[] | undefined>

/**
 * One step as the source's log keeps it: what it was called, when, and who
 * made it.
 *
 * `summary` is the same shape as a step's summary in the model (a key of the
 * step's words, and what it was done to), written out rather than imported for
 * the reason {@link SourceWork} is: this layer may not know what a model is,
 * and the list that reads it does.
 */
export type SourceActivityLine = {
  readonly summary: {
    readonly key: StringKey
    readonly name?: string
    readonly count?: number
    readonly asOf?: string
    readonly typeKey?: StringKey
  }
  /** Epoch milliseconds. */
  readonly at: number
  /**
   * The name the step travelled under, where it had one: what tells a step
   * the open session holds already from the same step in the source's log, so
   * it is listed once.
   */
  readonly stepId?: string
  /** Who made it, in the words a screen shows. Absent where the source has no name for them. */
  readonly by?: string
  /**
   * The step is the person's own — the one looking at the list. Said by the
   * source, which knows who is asking; the list then says *you* rather than a
   * name.
   */
  readonly mine?: boolean
  /** What it was made with, where the step said: the line reads *by … via …*. */
  readonly via?: string
  /**
   * Nobody made it: the editor laid a board out by itself, as it opened. The
   * list says so, with no author and no *you* — whoever's window it was did
   * not do it.
   */
  readonly unattended?: boolean
}

/**
 * What a provider calls its source on the bar, at this moment.
 *
 * A label rather than a key, because what it says is usually not a word at all:
 * a person's name, an address, the thing this provider was told to call itself.
 * The tip beside it IS a key, for the reason {@link SourceProvider.describeKey}
 * is one — a sentence has to be in every language and this tree holds none of
 * this provider's.
 */
export type SourceChip = {
  /** What the chip says, instead of the name the source was opened under. */
  readonly label: string
  /**
   * What hovering it says: the provider's key, from its own table. Absent falls
   * back to {@link SourceProvider.describeKey}, which is the standing sentence
   * about where work is kept — so a provider that only renames the chip keeps
   * the sentence it already gave.
   */
  readonly tipKey?: StringKey | (string & {})
  /**
   * What pressing it does — open the provider's own menu, its account page,
   * whatever the name on it is a way into.
   *
   * Absent leaves the chip what it has always been: a fact, not a control.
   */
  readonly onClick?: () => void
}

/**
 * One line a provider puts in the app's own menu.
 *
 * The alternative is a strip of the provider's own floating over the app
 * ({@link SourceProvider} has somewhere to draw one), and a second place to
 * look for commands is what the menu exists to stop: a person looking for what
 * they can do here should find all of it in one list. So a provider hands over
 * lines rather than a screen, and the shell renders them the way it renders its
 * own — one section, after everything of ours.
 *
 * `labelKey` is a key, from the provider's own table (`i18n`'s
 * `registerStrings`), for the reason every other string here is one; `key` is
 * what tells two lines apart and is never shown. `onSelect` is what a press
 * does, and runs after the menu has shut, so a dialog it opens is not fighting
 * a menu for the focus. `href` makes the line a link as well — a provider's own
 * page is on the web and a person may want to copy it or open it beside this
 * window — and `onSelect` still runs.
 */
export type SourceMenuEntry = {
  readonly key: string
  readonly labelKey: StringKey | (string & {})
  readonly onSelect: () => void
  /** Offered and not available: shown greyed, because it says what is missing. */
  readonly disabled?: boolean
  /** A rule above this line, for a provider whose lines are two groups. */
  readonly divider?: boolean
  /** Where it goes, where it goes anywhere. */
  readonly href?: string
}
