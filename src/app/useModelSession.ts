/**
 * The editing session: the model, which diagram is open, and the one place a
 * change enters (ADR-0002).
 *
 * Everything that edits this project dispatches a command. The reducer applies
 * it and hands back the command that undoes it, and the pair goes on a stack —
 * so ⌘Z covers a node move, a diagram rename, a decision's status and a project
 * setting in one order, which is the whole point.
 *
 * Two shapes of model live here. The reducer works on the indexed one; the
 * editor, the toolbar and the file writers want the arrays the file has. The
 * conversion is cached on the indexed model's identity, so it costs one pass per
 * change rather than one per render — and `dispatch` hands the result straight
 * back, so a caller making two changes in one gesture reads the second against
 * the first without waiting for a render.
 *
 * No outward dependency: no storage, no files. What comes out is `snapshot()`,
 * and who writes that away is not this hook's business.
 *
 * A change can also arrive from somewhere other than this keyboard, and one
 * made here can be of interest somewhere else. The four things that make that
 * possible — the log with both directions on it, `steps.onChange`,
 * `steps.applyExternal` and `steps.rebase` — are the whole of the seam, and
 * they carry no policy: what a run is, where a step came from, what is done
 * with a change that was made here and who is told about a refusal are all the
 * business of whoever composes the session.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { StringKey, Translate } from '../i18n'
import type {
  Command, CommandMeta, CommandRefusal, DocumentImage, Model, StepSummary, UploadedLogo,
} from '../model'
import { apply, fromArrays, summarise, toArrays, transaction } from '../model'
import { idPolicy } from '../model/keys'
import type { IdPolicy } from '../model/keys'
import { needsRemount } from '../model/hostModel'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import { flatten, newestOwn, pickRun, rewind, unwind } from './rebase'
import type { DroppedStep, StepFold } from './rebase'

export type { StepFold } from './rebase'
import type { Notify } from './useToasts'

/**
 * How many steps the session remembers. A step is a pair of commands rather than
 * two full-model snapshots, so this is a bound on a log rather than on memory,
 * and it can be generous where fifty was already expensive.
 *
 * It is a cap on what nobody is waiting for. While something is listening on
 * `onChange`, a step is announced outwards and whoever heard it may still have
 * to hand it back for a rebase — and a step trimmed out from under such a
 * listener is one it can name and this stack cannot find, which is the one
 * thing `rebase` has no honest answer for. So the trim stops at the oldest
 * step carrying a fold nobody has called `settled`, and the log is allowed to
 * grow past the cap until it is. That is the whole rule: with no listener
 * every step is settled the moment it is made and the cap behaves exactly as
 * it always did; with one, how far the log grows is the listener's own
 * business and `settled` is how it says so.
 */
const HISTORY_CAP = 200

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
   * ⌘Z stops here, and this key says why (ADR-0012 §10).
   *
   * A gesture that wrote two scopes leaves one of its two writes on this
   * stack and the other in a scope nothing here can speak for, so undoing it
   * would leave the tree saying two different things. Steps taken AFTER it
   * undo perfectly well; the run stops when it reaches this one.
   */
  barrier?: StringKey
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

export type ModelSession = {
  // --- what the editor receives as props -----------------------------------
  /** The model in the shape the file has. See the note at the top. */
  model: HostModel
  activeDiagramId: string
  setActiveDiagramId: (id: string) => void
  /**
   * Where a new element's or connection's id comes from. It lives here and not
   * in the editor because the session's model is the truth about what is taken,
   * and because an id handed out has to stay handed out across a remount.
   */
  ids: IdPolicy
  /**
   * The editor's settling pass runs once per diagram id per instance. A
   * document that has to be laid out again under ids this instance already laid
   * out only gets through with a fresh mount.
   */
  editorKey: number
  logoLibrary: UploadedLogo[]
  setLogoLibrary: React.Dispatch<React.SetStateAction<UploadedLogo[]>>
  /** The pictures the documents show (ADR-0009). Shell state, like the marks. */
  imageLibrary: DocumentImage[]
  setImageLibrary: React.Dispatch<React.SetStateAction<DocumentImage[]>>

  // --- the one way in -------------------------------------------------------
  /**
   * Apply a command, and answer with the model as it now stands — `undefined`
   * when the reducer refused it, which is also when the refusal is shown.
   *
   * The model comes back rather than a boolean so a caller can make its next
   * decision against the result instead of against a prop that will not arrive
   * until the next render.
   */
  dispatch: (command: Command, options?: DispatchOptions) => HostModel | undefined
  /**
   * The same door, for a change that was made somewhere else. Nothing in the
   * app uses it; the composition root is what hands it to whoever does.
   */
  steps: SessionSteps
  undo: () => void
  redo: () => void
  /**
   * Is there a step of OURS to take back? Another author's step on the stack
   * is not one, so a session that has only ever been changed by somebody else
   * has nothing to undo.
   */
  canUndo: boolean
  canRedo: boolean
  /** The steps taken this session, oldest first. */
  history: () => readonly HistoryStep[]
  /**
   * A counter that moves with every change to the model — a step, an undo, a
   * redo, a project adopted. What an agent names to say which state it
   * decided against (ADR-0007), and nothing else reads it.
   */
  revision: () => number

  // --- controls -------------------------------------------------------------
  onLayoutSettled: (diagramId: string) => void

  // --- for the actions around it -------------------------------------------
  /** The model as it stands now, without waiting for a render. */
  current: () => HostModel
  /** The same model, indexed — what a command is built against. */
  indexed: () => Model
  currentActiveId: () => string
  currentLibrary: () => UploadedLogo[]
  /** The pictures as they stand now, without waiting for a render. */
  currentImages: () => DocumentImage[]
  /** The project as it stands now, ready to be saved. */
  snapshot: () => ScopeSnapshot
  /** Take on an entirely different document: an opened file, or the shipped one. */
  adopt: (project: ScopeSnapshot, relayout: boolean) => void
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
 * registration in the composition root (`platform/sourceProvider.ts`), which is
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
  dispatch: ModelSession['dispatch']
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
  current: ModelSession['current']
  indexed: ModelSession['indexed']
  /** Every step taken this session, oldest first, with both directions on each. */
  history: () => readonly HistoryStep[]
  /** The counter that moves with every change, external ones included. */
  revision: () => number
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

/**
 * What `record` is told about a step: what the command says about itself, plus
 * the four things only the session knows.
 */
type StepMeta = Omit<CommandMeta, 'origin'> & {
  origin?: StepOrigin
  by?: string
  via?: string
  stepId?: string
  at?: number
  /**
   * Leave the redo tail standing.
   *
   * A step another author made is not this person's edit, and taking their
   * redo away because a colleague typed is a change to their screen that
   * nobody asked for. A redo that no longer applies costs nothing to keep
   * offering: the reducer refuses it and says so, which is the branch `step`
   * already has.
   */
  keepFuture?: boolean
}

/**
 * A step's name outside this session.
 *
 * A UUID rather than a counter, because two sessions that have never met mint
 * these at the same time and both names have to be good.
 */
function mintStepId(): string {
  return crypto.randomUUID()
}

export function useModelSession(deps: {
  initialProject: ScopeSnapshot
  notify: Notify
  s: Translate
  /**
   * Every id spoken for ANYWHERE in the organisation (ADR-0012 §2).
   *
   * An id names one thing across the whole tree, so a new element drawn here
   * must not take a name a sibling domain has already used: two scopes that
   * each define `erp` are a conflict finding, and one this app caused itself
   * would be a poor advertisement for the finding. The union with this
   * document's own ids is made below — this answers for the tree as the index
   * last read it, and the session answers for what has been typed since.
   *
   * A function, and optional. A function because the index is rebuilt while
   * the session lives (the watcher), and a set captured once would go stale;
   * optional because a scope opened with no index behind it — every component
   * test, and the first render before a listing has been read — is a document
   * whose own ids are the whole answer, which is what this did before the tree
   * had one.
   */
  takenInTree?: () => Iterable<string>
}): ModelSession {
  const { initialProject, notify, s, takenInTree } = deps

  const [model, setModel]
 = useState<Model>(() => fromArrays(initialProject.model))
  const [activeId, setActiveId] = useState(initialProject.activeDiagramId)
  // The mark library is shell state, not model state: it belongs to this browser
  // and travels in the working file.
  const [logoLibrary, setLogoLibrary] = useState<UploadedLogo[]>(initialProject.logoLibrary)
  const [imageLibrary, setImageLibrary] = useState<DocumentImage[]>(initialProject.imageLibrary ?? [])
  const [editorKey, setEditorKey] = useState(0)

  const modelRef = useRef(model)
  modelRef.current = model
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  const logoRef = useRef(logoLibrary)
  logoRef.current = logoLibrary
  const imageRef = useRef(imageLibrary)
  imageRef.current = imageLibrary
  /**
   * What the scope says about itself that no edit here touches: its kind, who
   * its drawings are addressed to, its links. The organisation screen writes
   * these; the session only carries them, so that an autosave writes back the
   * scope it was opened as. Left out, the first autosave after "this scope is
   * a team" wrote a `scope.json` with no kind, and the setting was forgotten.
   */
  const headerRef = useRef(scopeHeader(initialProject))

  /**
   * The arrays for one indexed model, kept until that model is replaced. Not a
   * `useMemo`: `dispatch` needs the answer for a model React has not rendered
   * yet, and computing it twice for the same model would show on every drag.
   */
  const asArraysRef = useRef<{ from: Model; to: HostModel } | null>(null)
  const asArrays = useCallback((m: Model): HostModel => {
    if (asArraysRef.current?.from !== m) asArraysRef.current = { from: m, to: toArrays(m) }
    return asArraysRef.current.to
  }, [])
  const arrays = asArrays(model)

  // Read through a ref for the same reason the model is: the policy is minted
  // once for the life of the session, and it has to see the index as it stands
  // when an id is asked for rather than as it stood when the hook first ran.
  const treeIds = useRef(takenInTree)
  treeIds.current = takenInTree

  const spokenFor = useCallback(() => [
    ...(treeIds.current?.() ?? []),
    ...modelRef.current.order.elements,
    ...modelRef.current.order.relations,
    ...modelRef.current.order.diagrams,
  ], [])

  const ids = useRef<IdPolicy | null>(null)
  ids.current ??= idPolicy(spokenFor)

  /**
   * Read what is spoken for again, after a step from elsewhere landed.
   *
   * The policy remembers what it has handed out for the life of the session,
   * so an id another author took in the meantime is not one it knows about —
   * and a create here would mint the name they just used. It is told to look
   * again, which keeps what it handed out and has not yet put on the model.
   */
  const refreshIds = useCallback(() => {
    ids.current?.refresh()
  }, [])


  // The stacks are refs, because a caller has to be able to read and move them
  // inside an event handler. Nothing renders from them directly, so a counter
  // beside them is what makes `canUndo` and `canRedo` reach the screen.
  const past = useRef<HistoryStep[]>([])
  const future = useRef<HistoryStep[]>([])
  /**
   * Folds a listener has heard about and nobody has called `settled` on yet —
   * the floor the trim stops at, by `changeId`. Only ours go in: a step that
   * arrived from elsewhere came from wherever it would have been sent, so
   * there is nothing outstanding about it and a floor at one would never lift.
   */
  const unsettled = useRef(new Set<string>())

  /**
   * Bring the log back to its cap, stopping at the oldest fold nobody has
   * settled.
   *
   * With nothing listening the set is empty and this is the `shift` it always
   * was. With a listener it is a floor: the steps older than it go, the step
   * carrying the oldest outstanding fold stays, and everything after it stays
   * with it — the log is one order and a hole in the middle of it is not a
   * shorter log, it is a wrong one. See `HISTORY_CAP` for why.
   */
  const trim = useCallback(() => {
    const over = past.current.length - HISTORY_CAP
    if (over <= 0) return
    const floor = past.current.findIndex(
      (held) => held.folds.some((fold) => unsettled.current.has(fold.changeId)),
    )
    const cut = floor < 0 ? over : Math.min(over, floor)
    if (cut > 0) past.current.splice(0, cut)
  }, [])
  const [, setHistoryVersion] = useState(0)
  const revision = useRef(0)

  /**
   * Who is listening for a change made here. A set in a ref rather than state:
   * a listener is bound in an effect and read inside a handler, and neither is
   * a reason to render.
   */
  const listeners = useRef(new Set<(change: SessionChange) => void>())
  const onChange = useCallback<SessionSteps['onChange']>((listener) => {
    listeners.current.add(listener)
    return () => { listeners.current.delete(listener) }
  }, [])
  /**
   * Say what just happened, to everyone listening.
   *
   * Over a copy, because a listener is free to stop listening — or to start —
   * inside its own handler, and a set walked while it is being edited is a
   * fault nobody would find twice.
   */
  const announce = useCallback((change: SessionChange) => {
    for (const listener of [...listeners.current]) listener(change)
  }, [])

  const setActiveDiagramId = useCallback((id: string) => {
    activeRef.current = id
    setActiveId(id)
  }, [])

  /**
   * Land a step: the new model, and what puts it back.
   *
   * A step whose `coalesce` key matches the one on top of the stack is folded
   * into it rather than pushed after it — that is what makes a typed sentence
   * one ⌘Z, and what keeps a drag and the routing that follows it together.
   */
  const record = useCallback((
    before: Model,
    next: Model,
    commands: Command[],
    inverses: Command[],
    meta: StepMeta,
  ) => {
    modelRef.current = next
    setModel(next)
    revision.current += 1
    // Not recorded, so not announced: it has no inverse, and a change nothing
    // can take back is not a step (`SessionSteps.onChange`).
    if (meta.undoable === false) return
    // The fold: this announcement's own name, and exactly what it applied.
    const fold: StepFold = { changeId: mintStepId(), commands, inverses }
    const top = past.current[past.current.length - 1]
    let landed: HistoryStep
    if (meta.coalesce !== undefined && top?.coalesce === meta.coalesce) {
      // The step keeps the name its FIRST command gave it: a run of keystrokes
      // is "Changed Billing", not "Changed Billing" twelve times over. It keeps
      // that first command's `stepId` for the same reason. What it does NOT
      // keep is the name it is announced under — see `SessionChange.changeId`.
      top.folds.push(fold)
      // The same arithmetic `flatten` states, done in place: the hot path here
      // is one keystroke, and rebuilding both lists per keystroke is not.
      top.commands.push(...commands)
      top.inverses.unshift(...inverses)
      top.at = Date.now()
      landed = top
    } else {
      landed = {
        stepId: meta.stepId ?? mintStepId(),
        folds: [fold],
        // Copies, because the fold's are the ones a later fold appends to.
        commands: [...commands], inverses: [...inverses],
        at: meta.at ?? Date.now(), summary: summarise(commands, before),
        ...(meta.coalesce !== undefined ? { coalesce: meta.coalesce } : {}),
        ...(meta.origin !== undefined ? { origin: meta.origin } : {}),
        ...(meta.by !== undefined ? { by: meta.by } : {}),
        ...(meta.via !== undefined ? { via: meta.via } : {}),
        ...(meta.barrier !== undefined ? { barrier: meta.barrier } : {}),
      }
      past.current.push(landed)
    }
    // Somebody is listening, so this fold may have to be handed back for a
    // rebase until they say otherwise, and the trim may not reach past it.
    if (meta.origin !== 'remote' && listeners.current.size > 0) {
      unsettled.current.add(fold.changeId)
    }
    trim()
    if (!meta.keepFuture) future.current = []
    setHistoryVersion((v) => v + 1)
    // The commands of THIS change and not the step's whole run: a coalescing
    // step is announced as it grows, and announcing the run again each time
    // would apply the earlier keystrokes twice wherever it is carried to.
    announce({
      kind: 'step',
      changeId: fold.changeId,
      stepId: landed.stepId,
      // A copy: the list a coalescing step keeps is the one it grows, and a
      // listener holding the step's own array would see it change under it.
      commands: [...commands],
      at: landed.at,
      revision: revision.current,
      ...(landed.origin !== undefined ? { origin: landed.origin } : {}),
      ...(landed.by !== undefined ? { by: landed.by } : {}),
    })
  }, [announce, trim])

  /**
   * Removing an application from the model takes its container diagram with it.
   * Say so, and make sure nobody is left standing on a diagram that is gone —
   * nobody asked for this one to go, so nobody is expecting the tab to vanish.
   */
  const reportOrphans = useCallback((before: Model, after: Model) => {
    const gone = before.order.diagrams.filter((id) => !after.diagrams[id])
    if (gone.length === 0) return
    if (gone.includes(activeRef.current)) {
      setActiveDiagramId(after.order.diagrams[0] ?? activeRef.current)
    }
    notify(gone.length === 1
      ? s('shell.orphanOne', { name: before.diagrams[gone[0]].name })
      : s('shell.orphanOther', { count: gone.length }))
  }, [notify, s, setActiveDiagramId])

  const dispatch = useCallback<ModelSession['dispatch']>((command, options) => {
    const before = modelRef.current
    const result = apply(before, command)
    if (!result.ok) {
      notify(s(result.reason), 'error')
      return undefined
    }
    if (options?.activeDiagramId !== undefined) setActiveDiagramId(options.activeDiagramId)
    // A command that changed nothing is not a refusal and not a step.
    if (result.model === before) return asArrays(before)
    const meta: StepMeta = {}
    if (command.coalesce !== undefined) meta.coalesce = command.coalesce
    if (command.undoable !== undefined) meta.undoable = command.undoable
    if (command.origin !== undefined) meta.origin = command.origin
    if (command.barrier !== undefined) meta.barrier = command.barrier
    record(before, result.model, [command], [result.inverse], meta)
    if (deletesAnElement(command)) reportOrphans(before, result.model)
    return asArrays(result.model)
  }, [notify, s, record, setActiveDiagramId, asArrays, reportOrphans])

  const step = useCallback((from: 'past' | 'future') => {
    const stack = from === 'past' ? past.current : future.current
    const other = from === 'past' ? future.current : past.current
    /**
     * Which step is taken back: the newest that is OURS.
     *
     * Another author's step stays where it is and the walk steps over it — it
     * is not ours to undo, and it does not make the step of ours underneath it
     * un-undoable either. Nothing ever reaches `future` that way, so a redo is
     * always the top of its stack.
     */
    const at = from === 'past' ? newestOwn(stack) : stack.length - 1
    if (at < 0) return
    const entry = stack[at]
    /**
     * A two-scope gesture is where a run of undos stops (ADR-0012 §10). The
     * step stays on the stack, because it happened and the Activity list says
     * so; what is refused is taking it back, and the reason is the key the
     * gesture put there rather than a sentence invented here.
     */
    if (from === 'past' && entry.barrier !== undefined) {
      notify(s(entry.barrier), 'warning')
      return
    }
    stack.splice(at, 1)
    const result = apply(
      modelRef.current,
      transaction(from === 'past' ? entry.inverses : entry.commands),
    )
    if (!result.ok) {
      // The stack refers to something the model no longer holds. Put nothing
      // back: a stack that cannot be replayed is worse than a shorter one.
      notify(s(result.reason), 'error')
      setHistoryVersion((v) => v + 1)
      return
    }
    other.push(entry)
    modelRef.current = result.model
    setModel(result.model)
    revision.current += 1
    setHistoryVersion((v) => v + 1)
    // Which way the model moved is in `kind`, and what moved it is `commands`:
    // a listener carrying this somewhere else applies exactly these, and does
    // not have to know that an undo is a step's inverses.
    const applied = from === 'past' ? entry.inverses : entry.commands
    announce({
      kind: from === 'past' ? 'undo' : 'redo',
      changeId: mintStepId(),
      stepId: entry.stepId,
      commands: [...applied],
      at: Date.now(),
      revision: revision.current,
      ...(entry.origin !== undefined ? { origin: entry.origin } : {}),
      ...(entry.by !== undefined ? { by: entry.by } : {}),
    })
  }, [notify, s, announce])

  const undo = useCallback(() => step('past'), [step])
  const redo = useCallback(() => step('future'), [step])

  /**
   * A command another author made, through the same door as our own.
   *
   * It goes on `past` because it happened to this model and the Activity list
   * has to be able to say so, and because a run of our steps can only be
   * rebased over it if it is in the one order everything else is in. What it
   * does NOT do is clear the redo tail: see `StepMeta.keepFuture`.
   *
   * The refusal is reported here rather than swallowed. A step of theirs the
   * reducer will not take means this model is no longer the one they built it
   * against, and that is a thing to say, not a thing to hide.
   */
  const applyExternal = useCallback<SessionSteps['applyExternal']>((command, from) => {
    const before = modelRef.current
    const result = apply(before, command)
    if (!result.ok) {
      notify(s(result.reason), 'error')
      return undefined
    }
    // A command that changed nothing is not a refusal and not a step, exactly
    // as at `dispatch` — a step that has already reached us, for instance.
    if (result.model === before) return asArrays(before)
    record(before, result.model, [command], [result.inverse], {
      origin: 'remote',
      by: from.by,
      keepFuture: true,
      ...(from.via !== undefined ? { via: from.via } : {}),
      ...(from.at !== undefined ? { at: from.at } : {}),
      ...(from.stepId !== undefined ? { stepId: from.stepId } : {}),
    })
    // Their create took an id this session had no way of knowing about.
    refreshIds()
    if (deletesAnElement(command)) reportOrphans(before, result.model)
    return asArrays(result.model)
  }, [notify, s, record, asArrays, refreshIds, reportOrphans])

  /**
   * Take a run of our own steps off the model, let the caller put what it has
   * underneath them, and put the run back on.
   *
   * The stack ends up in the order the model was actually built in: the run
   * comes off, whatever `between` lands is pushed where it belongs, and the
   * steps that still apply go back on top of it. Nothing renders in between,
   * so this is one update however many steps it moves.
   *
   * Nothing is announced: a caller that asked for a rebase is holding its
   * report, and a run put back on the model is the same work it already knows
   * about rather than new work for it to carry anywhere.
   */
  const rebase = useCallback<SessionSteps['rebase']>((run) => {
    const picked = pickRun(past.current, run.stepIds)
    // A body the caller still holds for a fold this stack has let go. Only for
    // an id the run actually names: a caller hands over what it has, and what
    // it did not ask for is not part of the run.
    const missing = new Set(picked.unknown)
    const supplied = (run.steps ?? []).filter((held) => missing.has(held.changeId))
    const filled = new Set(supplied.map((held) => held.changeId))
    const unknown = picked.unknown.filter((id) => !filled.has(id))
    // Oldest first, and what this stack no longer holds is older than what it does.
    const whole: (StepFold & { stepId?: string })[] = [...supplied, ...picked.run]
    const off = unwind(modelRef.current, whole)
    if (!off.ok) {
      // Nothing moved. The caller has the key and decides what to do with it —
      // apply the external steps unrebased, or ask a person.
      notify(s(off.reason), 'error')
      return { reapplied: [], dropped: [], unknown, supplied: [], refused: off.reason }
    }
    /**
     * A step with a fold in the run comes off the stack whole, and goes back on
     * at the end with the folds that stayed on the model followed by the folds
     * that went back on top of what landed underneath — which is the order the
     * model is now in. A step that only had SOME of its folds named keeps the
     * others exactly where they were on the model: they were answered for
     * already, so what has just arrived belongs over them and not under them.
     */
    const lifted = new Set(picked.run.map((fold) => fold.changeId))
    const moving: HistoryStep[] = []
    past.current = past.current.filter((held) => {
      if (!held.folds.some((fold) => lifted.has(fold.changeId))) return true
      moving.push(held)
      return false
    })
    modelRef.current = off.model
    run.between?.()
    const back = rewind(modelRef.current, whole)
    const rejoin = new Map<string, StepFold[]>()
    for (const fold of back.kept) {
      if (fold.stepId === undefined) continue
      const list = rejoin.get(fold.stepId)
      if (list) list.push(fold)
      else rejoin.set(fold.stepId, [fold])
    }
    for (const held of moving) {
      const folds = [
        ...held.folds.filter((fold) => !lifted.has(fold.changeId)),
        ...(rejoin.get(held.stepId) ?? []),
      ]
      // Every fold of it refused: there is no step left to put back.
      if (folds.length === 0) continue
      past.current.push({ ...held, folds, ...flatten(folds) })
    }
    trim()
    modelRef.current = back.model
    setModel(back.model)
    revision.current += 1
    setHistoryVersion((v) => v + 1)
    const of = new Map(picked.run.map((fold) => [fold.changeId, fold.stepId]))
    return {
      reapplied: back.kept.map((fold) => fold.changeId),
      dropped: back.dropped.map((gone) => {
        const stepId = of.get(gone.changeId)
        return stepId === undefined ? gone : { ...gone, stepId }
      }),
      unknown,
      supplied: back.kept
        .filter((fold) => fold.stepId === undefined)
        .map(({ changeId, commands, inverses }) => ({ changeId, commands, inverses })),
    }
  }, [notify, s, trim])

  const settled = useCallback<SessionSteps['settled']>((changeIds) => {
    for (const id of changeIds) unsettled.current.delete(id)
    trim()
  }, [trim])

  /**
   * The seam, as one object with an identity that holds still.
   *
   * Whoever composes the session binds these in an effect, and an object built
   * fresh on every render would be a subscription dropped and remade on every
   * keystroke. The three inside it are already stable; this is what makes the
   * grip around them stable too. `history` and `revision` are the same
   * arrangement, for the same reason.
   */
  const steps = useMemo<SessionSteps>(
    () => ({ onChange, applyExternal, rebase, settled }),
    [onChange, applyExternal, rebase, settled],
  )
  const history = useCallback(() => past.current as readonly HistoryStep[], [])
  const revisionNow = useCallback(() => revision.current, [])

  const onLayoutSettled = useCallback((diagramId: string) => {
    // Not a step: ⌘Z after opening a document must not ask for the layout back.
    // The flag is deleted rather than set to false — a saved file should look
    // like a hand-written one, and nothing reads the difference.
    dispatch({
      type: 'board.set', diagramId, patch: { needsLayout: undefined }, undoable: false,
    })
  }, [dispatch])

  const adopt = useCallback<ModelSession['adopt']>((project, relayout) => {
    past.current = []
    future.current = []
    unsettled.current.clear()
    setHistoryVersion((v) => v + 1)
    // Measured before the swap: `needsRemount` compares the old with the new.
    const remount = needsRemount(asArrays(modelRef.current), project.model, relayout)
    const next = fromArrays(project.model)
    modelRef.current = next
    setModel(next)
    revision.current += 1
    setActiveDiagramId(project.activeDiagramId)
    logoRef.current = project.logoLibrary
    setLogoLibrary(project.logoLibrary)
    imageRef.current = project.imageLibrary ?? []
    setImageLibrary(project.imageLibrary ?? [])
    headerRef.current = scopeHeader(project)
    if (remount) setEditorKey((k) => k + 1)
  }, [setActiveDiagramId, asArrays])

  /**
   * The ref is fixed for the life of the session: switching projects remounts
   * the workspace, which is what clears the undo stack along with it. A session
   * that could change its own address mid-flight would be able to autosave one
   * project's edits onto another.
   */
  const path = initialProject.path
  const snapshot = useCallback((): ScopeSnapshot => ({
    path,
    ...headerRef.current,
    model: toArrays(modelRef.current),
    activeDiagramId: activeRef.current,
    logoLibrary: logoRef.current,
    // Absent rather than empty, so a project with no pictures is written back
    // as the project it was read as — see `ScopeSnapshot.imageLibrary`.
    ...(imageRef.current.length ? { imageLibrary: imageRef.current } : {}),
  }), [path])

  /**
   * The model as it stands, in both shapes, and the same function every render.
   *
   * Both read a ref that is fixed for the life of the session, so a `useCallback`
   * with nothing to depend on is honest rather than a habit — and it is what lets
   * `ScopeSession` carry them. The handover is memoised on its pieces, and a piece
   * that is a fresh arrow every render would drop and remake whatever is on the
   * other end of it on every keystroke.
   */
  const current = useCallback(() => asArrays(modelRef.current), [asArrays])
  const indexed = useCallback(() => modelRef.current, [])

  return {
    model: arrays, activeDiagramId: activeId, setActiveDiagramId,
    ids: ids.current,
    editorKey, logoLibrary, setLogoLibrary, imageLibrary, setImageLibrary,
    dispatch, undo, redo,
    steps,
    canUndo: newestOwn(past.current) >= 0,
    canRedo: future.current.length > 0,
    history,
    revision: revisionNow,
    onLayoutSettled,
    current,
    indexed,
    currentActiveId: () => activeRef.current,
    currentLibrary: () => logoRef.current,
    currentImages: () => imageRef.current,
    snapshot, adopt,
  }
}

/**
 * The fields of a scope that are about the scope rather than its document,
 * absent where absent so the file is written back as it was read.
 */
function scopeHeader(project: ScopeSnapshot): Pick<ScopeSnapshot, 'kind' | 'client' | 'links'> {
  return {
    ...(project.kind !== undefined ? { kind: project.kind } : {}),
    ...(project.client !== undefined ? { client: project.client } : {}),
    ...(project.links !== undefined ? { links: project.links } : {}),
  }
}

/**
 * Does this command delete an element? Only then can a diagram go without
 * anyone naming it — a container view exists about one application, and goes
 * when that application does.
 */
function deletesAnElement(command: Command): boolean {
  if (command.type === 'element.delete') return true
  return command.type === 'transaction' && command.commands.some(deletesAnElement)
}
