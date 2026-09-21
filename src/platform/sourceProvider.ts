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
   * The sentence that says where work is kept here, as the key of the
   * provider's own string.
   *
   * The organisation's home says it about the chip that names the source: *your
   * projects are files in this folder*, *nothing is being kept*. There is a
   * sentence per built-in kind because this tree knows what a folder and a
   * browser's storage are, and there can be none for a registered source: only
   * the provider knows what kind of place it is, whether anything outlives the
   * window and what a person should do about it, exactly as with
   * {@link SourceProvider} and the name on the bar.
   *
   * A key, and `string` beside `StringKey` for the reason
   * {@link SourceConnect.labelKey} is: a provider brings its own table through
   * `i18n`'s `registerStrings`, so the sentence is in all four languages
   * without this tree holding a word of it.
   *
   * Absent means the chip says nothing at all — no tooltip rather than a
   * sentence of ours. A guess about somewhere this shell has never heard of
   * would be worse than silence: it might promise a copy that cannot be made,
   * or a folder that does not exist.
   */
  readonly describeKey?: StringKey | (string & {})
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
}

/**
 * What a provider calls its source on the bar, at this moment.
 *
 * A label rather than a key, because what it says is usually not a word at all:
 * a person's name, an address, the thing this provider was told to call itself.
 * The tip beside it IS a key, for the reason {@link SourceProvider.describeKey}
 * is one — a sentence has to be in four languages and this tree holds none of
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
