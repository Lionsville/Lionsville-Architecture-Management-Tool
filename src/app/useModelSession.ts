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
 * A change can also arrive from somewhere other than this keyboard. The three
 * functions that make that possible — the log with both directions on it,
 * `steps.applyExternal` and `steps.rebase` — are the whole of the seam, and
 * they carry no policy: what a run is, where a step came from and who is told
 * about a refusal are all the business of whoever composes the session.
 */
import { useCallback, useRef, useState } from 'react'
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
import { newestOwn, pickRun, rewind, unwind } from './rebase'
import type { DroppedStep } from './rebase'
import type { Notify } from './useToasts'

/**
 * How many steps the session remembers. A step is a pair of commands rather than
 * two full-model snapshots, so this is a bound on a log rather than on memory,
 * and it can be generous where fifty was already expensive.
 */
const HISTORY_CAP = 200

/**
 * One undo step: what was done, and what undoes it.
 *
 * Lists rather than single commands because a coalescing step grows — a run of
 * keystrokes into one field, or a drag and the routing that follows it, is one
 * step made of several commands. `commands` replays it forwards; `inverses`
 * is already in undo order, newest first.
 */
export type HistoryStep = {
  /**
   * What this step is called outside this session: a UUID, minted when the
   * step is recorded.
   *
   * The session itself never reads it. It is here so that whoever composes the
   * session can name a step — recognise one of its own arriving back, ask for
   * a run of them by name, and land a step sent twice only once. A coalescing
   * run keeps the id its first command was given, because it is one step.
   */
  stepId: string
  commands: Command[]
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
  /** The name the step already travels under, so a step is not renamed on arrival. */
  stepId?: string
}

/** A run of our own steps to take off the model and put back on. */
export type RebaseRun = {
  /**
   * The steps, by `stepId`. The stack's own order is what they are taken off
   * and put back in, whatever order they are named in here.
   */
  stepIds: readonly string[]
  /**
   * Run once the run is off the model, which is the moment a step from
   * elsewhere belongs underneath it — `applyExternal`, usually more than once.
   */
  between?: () => void
}

/** What a rebase did, for a caller that has to tell somebody about it. */
export type RebaseReport = {
  /** The steps that went back on, oldest first. */
  reapplied: string[]
  /** The steps the reducer refused on the way back. They are off the stack now. */
  dropped: DroppedStep[]
  /** Ids in the run that named no step on the stack: trimmed, or asked for twice. */
  unknown: string[]
  /** Set when the run could not be taken off at all, in which case nothing moved. */
  refused?: CommandRefusal
}

/**
 * A change that was made somewhere other than this keyboard.
 *
 * Two functions and no policy, so that the session stays the one place a
 * change enters while knowing nothing about where a change can come from.
 * The third of the three is `history()` above, which already says what every
 * step did and what undoes it.
 */
export type SessionSteps = {
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
   * Take a run of our own steps off the model by their inverses, let the
   * caller put what it has underneath them, and put the run back on.
   *
   * One React update, because nothing is rendered between the three. This is
   * what the inverses were computed for.
   */
  rebase: (run: RebaseRun) => RebaseReport
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
 * What `record` is told about a step: what the command says about itself, plus
 * the four things only the session knows.
 */
type StepMeta = Omit<CommandMeta, 'origin'> & {
  origin?: StepOrigin
  by?: string
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
  const [, setHistoryVersion] = useState(0)
  const revision = useRef(0)

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
    if (meta.undoable === false) return
    const top = past.current[past.current.length - 1]
    if (meta.coalesce !== undefined && top?.coalesce === meta.coalesce) {
      // The step keeps the name its FIRST command gave it: a run of keystrokes
      // is "Changed Billing", not "Changed Billing" twelve times over. It keeps
      // that first command's `stepId` for the same reason.
      top.commands.push(...commands)
      top.inverses.unshift(...inverses)
      top.at = Date.now()
    } else {
      past.current.push({
        stepId: meta.stepId ?? mintStepId(),
        commands, inverses, at: meta.at ?? Date.now(), summary: summarise(commands, before),
        ...(meta.coalesce !== undefined ? { coalesce: meta.coalesce } : {}),
        ...(meta.origin !== undefined ? { origin: meta.origin } : {}),
        ...(meta.by !== undefined ? { by: meta.by } : {}),
        ...(meta.barrier !== undefined ? { barrier: meta.barrier } : {}),
      })
      if (past.current.length > HISTORY_CAP) past.current.shift()
    }
    if (!meta.keepFuture) future.current = []
    setHistoryVersion((v) => v + 1)
  }, [])

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
  }, [notify, s])

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
   */
  const rebase = useCallback<SessionSteps['rebase']>((run) => {
    const { run: steps, unknown } = pickRun(past.current, run.stepIds)
    const off = unwind(modelRef.current, steps)
    if (!off.ok) {
      // Nothing moved. The caller has the key and decides what to do with it —
      // apply the external steps unrebased, or ask a person.
      notify(s(off.reason), 'error')
      return { reapplied: [], dropped: [], unknown, refused: off.reason }
    }
    const lifted = new Set(steps.map((held) => held.stepId))
    past.current = past.current.filter((held) => !lifted.has(held.stepId))
    modelRef.current = off.model
    run.between?.()
    const back = rewind(modelRef.current, steps)
    past.current.push(...back.kept)
    if (past.current.length > HISTORY_CAP) {
      past.current.splice(0, past.current.length - HISTORY_CAP)
    }
    modelRef.current = back.model
    setModel(back.model)
    revision.current += 1
    setHistoryVersion((v) => v + 1)
    return { reapplied: back.kept.map((held) => held.stepId), dropped: back.dropped, unknown }
  }, [notify, s])

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

  return {
    model: arrays, activeDiagramId: activeId, setActiveDiagramId,
    ids: ids.current,
    editorKey, logoLibrary, setLogoLibrary, imageLibrary, setImageLibrary,
    dispatch, undo, redo,
    steps: { applyExternal, rebase },
    canUndo: newestOwn(past.current) >= 0,
    canRedo: future.current.length > 0,
    history: () => past.current,
    revision: () => revision.current,
    onLayoutSettled,
    current: () => asArrays(modelRef.current),
    indexed: () => modelRef.current,
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
