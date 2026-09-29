// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One scope, open, as whoever answers for its source sees it (ADR-0022): the
 * session's steps and the seam over them.
 *
 * Types only. The session is the app's (`app/useModelSession.ts`), which
 * implements this; a provider — built in core or composed from outside — is
 * handed it, and reads its words from here, where both may import them.
 */
import type { ShellError } from '../platform/errors'
import type { Command } from '../model/commands'
import type { CommandRefusal } from '../model/reducer'
import type { StepSummary } from '../model/activity'
import type { HostModel } from '../model/hostModel'
import type { Model } from '../model/normalised'
import type { ScopePath } from '../projects/scopePath'

/**
 * One announcement's worth of a step: what that fold applied, and what undoes
 * it.
 *
 * This is also the shape a caller supplies for a fold this stack no longer
 * holds (`RebaseRun.steps`), which is why it says nothing about a stack.
 */
export type StepFold = {
  /** What this fold is called: a UUID, unique to the one announcement it was. */
  changeId: string
  commands: Command[]
  /** Already in undo order, newest first — as the session records them. */
  inverses: Command[]
}

/** A fold that did not survive the way back, and the key that says why. */
export type DroppedStep = {
  changeId: string
  /** The step it was a fold of, where it came off this stack rather than from a caller. */
  stepId?: string
  reason: CommandRefusal
}

/**
 * One undo step: what was done, and what undoes it.
 *
 * Lists rather than single commands because a coalescing step grows — a run of
 * keystrokes into one field, or a drag and the routing that follows it, is one
 * step made of several commands. `commands` replays it forwards; `inverses`
 * is already in undo order, newest first.
 *
 * **A coalescing step is one step on this stack and several on a channel.**
 * Each time it grows it is announced outwards under a `changeId` of its own
 * (`SessionChange.changeId`), because whoever carries an announcement
 * somewhere else has to be able to be answered for it separately — one id per
 * announcement is one sequenced step per announcement, and a second
 * announcement under the first one's name is a retry of work nobody has seen.
 * `folds` is that list, and `commands`/`inverses` are the folds flattened
 * (`rebase.flatten`). **Undoing such a step is one new change** whose commands
 * are the inverses of every fold, announced under a `changeId` of its own like
 * any other.
 */
export type HistoryStep = {
  /**
   * What this step is called outside this session: a UUID, minted when the
   * step is recorded.
   *
   * The session itself never reads it. It is here so that whoever composes the
   * session can name a step — recognise one of its own arriving back, ask for
   * a run of them by name, and land a step sent twice only once. A coalescing
   * run keeps the id its first command was given, because it is one step;
   * what is different every time it grows is the `changeId` on `folds`.
   */
  stepId: string
  /**
   * The announcements this step is made of, oldest first — one per time it was
   * announced outwards, each with the commands that announcement applied and
   * their inverses. A step that never coalesced has exactly one.
   */
  folds: StepFold[]
  /** Every fold's commands, in the order they were applied. */
  commands: Command[]
  /** Every fold's inverses, in undo order: the newest fold's first. */
  inverses: Command[]
  coalesce?: string
  /**
   * What this step is called, worked out from its commands against the model
   * as it was before them — the only moment at which a deleted row can still
   * be named (see `model/activity.ts`).
   */
  summary: StepSummary
  /** When the step was made, for an activity list. */
  at: number
  /** Who made it, when it was not the person at this keyboard (ADR-0007). */
  origin?: StepOrigin
  /**
   * The author, for a step another author made. The Activity list says it, and
   * `undo` reads `origin` rather than this: a step with no name on it that
   * arrived from elsewhere is still not ours to take back.
   */
  by?: string
  /**
   * What that author made the step with, where it was said: the client, not the
   * person.
   *
   * A log that named the author and not the client flattens two different
   * things into one line — the same colleague working from two clients, and a
   * step a person made through something that speaks for them. Beside `by`
   * rather than folded into it, because the two are answers to different
   * questions and only one of them is a person; nothing in this session reads
   * either, and the list shows both.
   */
  via?: string
  /**
   * The editor made this step by itself, and not at the person's asking: the
   * layout that settles a board a machine wrote (`CommandMeta.unattended`).
   *
   * It is ours in every other respect — ⌘Z takes it back, and it is announced
   * and carried wherever this session's steps go — because a layout that is
   * not carried is a layout every later open runs again. The mark is only for
   * whoever counts or attributes steps, so that a board being opened is never
   * mistaken for the person's work.
   */
  unattended?: true
  /**
   * ⌘Z stops here, and this key says why (ADR-0012 §10).
   *
   * A gesture that wrote two scopes leaves one of its two writes on this
   * stack and the other in a scope nothing here can speak for, so undoing it
   * would leave the tree saying two different things. Steps taken AFTER it
   * undo perfectly well; the run stops when it reaches this one.
   */
  barrier?: ShellError['key']
}

export type DispatchOptions = {
  activeDiagramId?: string
}

/**
 * Who took a step, when it was not the person at this keyboard: the agent on
 * this session (ADR-0007), or another author whose step reached us from
 * somewhere else.
 */
export type StepOrigin = 'agent' | 'remote'

/** What is known about a step another author made. */
export type ExternalStep = {
  /**
   * The author. Whoever hands the step over says who made it; this is never a
   * sender's claim about itself, and the session does not check it — it shows
   * it, and treats the step as not ours whatever it says.
   */
  by: string
  /** When it was made. Now, where the caller knows nothing better. */
  at?: number
  /**
   * The client the author made it with, where that is known: *by A. Author via
   * their client*, which is the line the Activity list draws.
   *
   * Absent where whoever handed the step over says only who made it, and the
   * list then says exactly what it always said. Never inferred here: this tree
   * has no way to tell what somebody else was working in, and a guess in a log
   * is worse than a gap.
   */
  via?: string
  /** The name the step already travels under, so a step is not renamed on arrival. */
  stepId?: string
}

/** A run of our own work to take off the model and put back on. */
export type RebaseRun = {
  /**
   * What to take off, by `stepId` or by `changeId`. The stack's own order is
   * what it is taken off and put back in, whatever order it is named in here.
   *
   * A `stepId` names every fold of that step; a `changeId` names one fold of
   * it. A caller that publishes each announcement separately holds `changeId`s
   * and will sometimes hold only the last few of a step — the earlier folds
   * were answered for already and belong *under* what has just arrived, not
   * over it — so naming one fold has to mean unwinding that fold's commands
   * and no more.
   */
  stepIds: readonly string[]
  /**
   * Bodies for ids this stack no longer holds, from the caller that still
   * does.
   *
   * The log is capped, and a caller that is reconnecting after a reload has no
   * stack here at all — so `unknown` would be the whole answer and the run
   * would stay on the model unrebased. A caller that kept the commands and the
   * inverses hands them over instead, and a fold named in `stepIds` that this
   * stack cannot find is taken from here.
   *
   * They go **under** the stack's own run, because what this stack no longer
   * holds is older than what it does. They are reapplied but **not** put on
   * the stack: they were not on it before the rebase and resurrecting them
   * would put an undo back within reach that this session had already let go.
   * Their inverses are stale afterwards, which is what `RebaseReport.supplied`
   * hands back.
   */
  steps?: readonly StepFold[]
  /**
   * Run once the run is off the model, which is the moment a step from
   * elsewhere belongs underneath it — `applyExternal`, usually more than once.
   */
  between?: () => void
}

/** What a rebase did, for a caller that has to tell somebody about it. */
export type RebaseReport = {
  /** The folds that went back on, oldest first, by `changeId`. */
  reapplied: string[]
  /** The folds the reducer refused on the way back. They are off the stack now. */
  dropped: DroppedStep[]
  /**
   * Ids in the run that named nothing this stack holds and that no supplied
   * step filled in: trimmed, or asked for twice.
   */
  unknown: string[]
  /**
   * The supplied steps as they now stand — the same commands, with the
   * inverses recomputed against the model they now undo.
   *
   * Nothing here is on the stack, so nothing here will be recomputed again:
   * a caller that means to rebase the same work twice keeps these in place of
   * what it handed over, or the second rebase unwinds with an inverse for a
   * model that has moved.
   */
  supplied: StepFold[]
  /** Set when the run could not be taken off at all, in which case nothing moved. */
  refused?: CommandRefusal
}

/**
 * A change this session just made to the model, for whoever has to tell
 * somewhere else about it.
 *
 * The commands are the ones that were actually applied — a step's own going
 * forwards, its inverses coming back — so a listener never has to work out
 * which direction the model moved in. They are a list because a step grows: a
 * run of keystrokes into one field is one step of several commands, and
 * `transaction` is how it is said as one.
 */
export type SessionChange = {
  /** What happened: a step was taken, taken back, or taken again. */
  kind: 'step' | 'undo' | 'redo'
  /**
   * **The name to hand this change over under**: a fresh UUID, minted per
   * announcement and never said twice.
   *
   * A coalescing step is announced every time it grows and `stepId` is the
   * same on all of them, so a caller that published under `stepId` published
   * the second keystroke as a retry of the first — and anywhere idempotent by
   * that name answers a retry out of what it already decided and sequences
   * nothing. Everything after the first keystroke would then be on this screen
   * and nowhere else, with the answer that says it landed. So each
   * announcement carries its own name and `commands` is exactly what that
   * announcement applied, which makes each fold its own step wherever it is
   * carried to. It is also what `rebase` takes to name one fold of a step, and
   * what `settled` takes to say the far end is done with one.
   *
   * An undo and a redo get one too, for the same reason and without the caller
   * having to mint it: taking a step back is a change in its own right.
   */
  changeId: string
  /**
   * The step on the stack this change is about: the one taken, or the one
   * taken back or forward again.
   *
   * The same on every announcement of a coalescing step, which is what says
   * they are one step here however many they are elsewhere — and for an undo
   * or a redo it names the step being taken back, which was handed over under
   * its own announcements already. It is never the name to publish under:
   * `changeId` is.
   */
  stepId: string
  /** The commands applied, in the order they were applied. */
  commands: readonly Command[]
  /** Where the step came from, and who made it: absent on this keyboard's own. */
  origin?: StepOrigin
  by?: string
  /**
   * Set on the announcement of a step the editor made by itself
   * (`HistoryStep.unattended`): published like any other, and never to be
   * counted or attributed as the person's. Absent on an undo or a redo, which
   * somebody asked for.
   */
  unattended?: true
  /** When this change was made, epoch milliseconds. */
  at: number
  /** What `revision()` answers now, so a caller need not ask. */
  revision: number
}

/**
 * A change that was made somewhere other than this keyboard, and one made here
 * that somewhere else is waiting for.
 *
 * Four functions and no policy, so that the session stays the one place a
 * change enters while knowing nothing about where a change can come from or go.
 * The fifth of the five is `history()` above, which already says what every
 * step did, what undoes it, and which announcements it was made of.
 */
export type SessionSteps = {
  /**
   * Hear about every change this session makes to the model, until the
   * returned function is called.
   *
   * It is the half of the seam that goes outwards: without it a caller could
   * take a step from elsewhere but not say that one was taken here, and
   * "publish what was just done" would mean polling `history()`. A listener
   * hears its own doing too — a step it applied with `applyExternal` comes
   * back marked `remote`, which is how it knows to let it be.
   *
   * What is NOT announced: a change the session does not record as a step
   * (`undoable: false`, the settling pass after a layout), because it has no
   * inverse and so nothing could take it back or put it back; a rebase,
   * because whoever asked for one is holding its report; and a document
   * adopted in place of another, which is not a step and not this seam's
   * business.
   */
  onChange: (listener: (change: SessionChange) => void) => () => void
  /**
   * Apply a command another author made: through the same reducer, on the same
   * stack, named by `model/activity.ts` like any other step, and marked as
   * theirs so ⌘Z steps over it.
   *
   * Answers the model as it now stands, or `undefined` when the reducer
   * refused — the same answer `dispatch` gives, for the same reason.
   */
  applyExternal: (command: Command, from: ExternalStep) => HostModel | undefined
  /**
   * Take a run of our own work off the model by its inverses, let the caller
   * put what it has underneath it, and put the run back on.
   *
   * Named by step or by fold (`RebaseRun.stepIds`), and a caller that still
   * holds work this stack has let go hands the bodies over with it
   * (`RebaseRun.steps`).
   *
   * One React update, because nothing is rendered between the three. This is
   * what the inverses were computed for.
   */
  rebase: (run: RebaseRun) => RebaseReport
  /**
   * Say that the far end is done with these announcements, by `changeId`.
   *
   * The log is capped, and a listener is the one thing that makes trimming it
   * dishonest: a step trimmed while somebody outside still has to hand it back
   * for a rebase is a step they can name and this stack cannot find. So while
   * anything is listening the trim stops at the oldest fold nobody has settled
   * — see `HISTORY_CAP`. A caller that never calls this is a caller whose log
   * never trims, which is its own memory and its own choice; a caller that is
   * not listening at all need not call it, because nothing was ever waiting.
   *
   * Ids it does not recognise are ignored: settling twice, or settling a fold
   * already trimmed, is the ordinary way a caller catching up behaves.
   */
  settled: (changeIds: readonly string[]) => void
}

/**
 * One scope, open: the seam over it, and which scope it is.
 *
 * The session lives inside the workspace and is remounted with it, so
 * everything above the workspace only ever sees it through this — the narrow
 * view of it, declared where the shell's own is, exactly as the agent's
 * `SessionView` is declared beside the handler that needs it.
 *
 * It exists for whoever answers for the source the scope is kept in: that is a
 * registration in the composition root (`ports/ProviderParts.ts`), which is
 * nowhere near the workspace, and a seam that cannot be reached from where a
 * provider is composed is not a seam. The handing over is per mount and the
 * answer is how to stop — the workspace is remounted per scope, and a
 * subscription per scope ever opened is a leak with a slow fuse.
 */
export type ScopeSession = {
  /** Where this scope is in the tree (ADR-0012 §1); the empty string is the root. */
  scope: ScopePath
  /**
   * The seam: hear about a change, take one from elsewhere, rebase a run of
   * ours, and say what the far end is done with.
   */
  steps: SessionSteps
  /** The one way in (ADR-0002), for a change this side decides to make itself. */
  dispatch: (command: Command, options?: DispatchOptions) => HostModel | undefined
  /**
   * The model as it stands now, without waiting for a render — the arrays, and
   * the same model indexed by id.
   *
   * The two the session already answers for its own actions, and whoever answers
   * for the source needs exactly them: a command is built against the indexed
   * model (ADR-0002), so minting an id against what is actually taken and working
   * out whether a change that has arrived disagrees with one made here are both
   * questions about this model at this instant. Reading it off a render would be
   * reading it one render late, which is the render in which a step is published.
   */
  current: () => HostModel
  indexed: () => Model
  /** Every step taken this session, oldest first, with both directions on each. */
  history: () => readonly HistoryStep[]
  /** The counter that moves with every change, external ones included. */
  revision: () => number
  /**
   * What the store called the state this scope was read in, when the session
   * was opened on it: the `revision` its `load` stamped (`ScopeSnapshot`), or
   * `undefined` for a scope that was not read — one just made, or a store that
   * could not say.
   *
   * The one fact about the model's starting point that whoever answers for the
   * source cannot work out for itself: the model handed over is that read,
   * and a far end that numbers what happened to a scope has to know which
   * number that read was at, or it replays what the model already holds.
   */
  openedFrom?: string
  /**
   * Who else has this scope open: names, and nothing else.
   *
   * The one thing this handover carries INTO the shell rather than out of it,
   * because it is the one thing the shell cannot work out for itself — and
   * `CommandChannel.presence` answers in exactly this shape. Whoever holds the
   * other end says so when it changes and says so with an empty list when the
   * last of them goes; the bar then says nothing at all.
   *
   * Names only, deliberately. A name is a thing this app can say in a sentence;
   * where a colleague's pointer is would be a second model of the canvas, and
   * nobody has asked for one.
   */
  alsoHere: (names: readonly string[]) => void
}

