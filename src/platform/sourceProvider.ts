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
 * A provider that needs nothing takes nothing.
 */
export type SourceProvider<Parts, Opening = void> = {
  /** The kind this provider answers for, as `WorkingSource` spells it. */
  readonly kind: string
  /** What working from this source gives the shell. */
  open(opening: Opening): Parts
  /** How a person reaches it, where there is a way in. */
  readonly connect?: SourceConnect<Opening>
  /**
   * What this source means by the five words. Absent where it means what a
   * file means, which is what all three that ship mean.
   */
  readonly statusOf?: (work: SourceWork) => SourceStatus
}
