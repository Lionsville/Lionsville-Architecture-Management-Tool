// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import type { Translate } from '../i18n'
import type {
  Command, CommandMeta, Model, UploadedLogo,
} from '../model'
import { apply, fromArrays, summarise, toArrays, transaction } from '../model'
import { idPolicy } from '../model/keys'
import type { IdPolicy } from '../model/keys'
import { needsRemount } from '../model/hostModel'
import type { HostModel } from '../model/hostModel'
import type { ImageEntry } from '../model/imageName'
import type { ScopeSnapshot } from '../projects/scope'
import { flatten, newestOwn, pickRun, rewind, unwind } from './rebase'
import type {
  DispatchOptions, HistoryStep, SessionChange, SessionSteps, StepFold, StepOrigin,
} from '../ports/ScopeSession'

export type {
  DispatchOptions, ExternalStep, HistoryStep, RebaseReport, RebaseRun, ScopeSession, SessionChange, SessionSteps,
  StepFold, StepOrigin,
} from '../ports/ScopeSession'
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
 * A change of this session's to the model, waiting to be written where the
 * scope is kept: the command that made it, as one step, under a name nobody
 * else will give one.
 */
export type PendingStep = { stepId: string; command: Command; at: number }

/**
 * What the open scope's writer takes from the session: every change made here
 * to the model, in the order it was made, until it says they are written.
 *
 * Every change and not only the steps the stack keeps: a change that is not a
 * step (`undoable: false` — a view's setting, the flag a layout clears) is
 * still a change to the scope, and a writer that left it out would lose it.
 * An undo and a redo are written as what they applied. A step another author
 * made is not here: it came from wherever it would be written. And a document
 * adopted in place of this one empties it — what was pending belonged to a
 * model that is no longer on screen — and moves `adopted`, so a writer knows
 * that what it last wrote is not what the session holds.
 */
export type SessionJournal = {
  /** Every change not yet written, oldest first. */
  pending: () => readonly PendingStep[]
  /** The first `count` of them are written. */
  written: (count: number) => void
  /** How many documents have been adopted in place of the one opened. */
  adopted: () => number
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
  /**
   * The pictures the documents show (ADR-0009, ADR-0031 §3): the scope's
   * library, an entry per picture and never its bytes, which a page asks for
   * when it shows one. Shell state, like the marks: a picture's bytes are put
   * where the scope is kept first, and the entry is written with the rest.
   */
  imageLibrary: readonly ImageEntry[]
  setImageLibrary: React.Dispatch<React.SetStateAction<readonly ImageEntry[]>>

  // --- the one way in -------------------------------------------------------
  /**
   * Nothing here may be changed by this session: the source says nobody here
   * writes, or a file of the scope did not read and a save would write an empty
   * model over it. Fixed for the life of the session, as the scope is.
   *
   * A widget reads it to hide what it would only be refused; the refusal
   * itself is `dispatch`'s, and `undo`'s, `redo`'s and the libraries' — so a
   * widget that forgot to ask changes nothing either. A step another author
   * made still lands (`steps.applyExternal`): a viewer sees what everybody does.
   */
  readOnly: boolean
  /**
   * May this session change the model now? `false` on a read-only scope, and
   * the refusal has then been said. For a caller that writes somewhere ELSE
   * before it dispatches here — a gesture writes the other scope first — and
   * has to know before it starts rather than after.
   */
  mayChange: () => boolean
  /**
   * Apply a command, and answer with the model as it now stands — `undefined`
   * when the reducer refused it, or when the scope is only read, which is also
   * when the refusal is shown.
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
  currentImages: () => readonly ImageEntry[]
  /** The project as it stands now, ready to be saved. */
  snapshot: () => ScopeSnapshot
  /** The changes made here that are still to be written (`SessionJournal`). */
  journal: SessionJournal
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

/**
 * The command as it is recorded and announced: without the mark that says the
 * editor made it by itself.
 *
 * The mark is the session's to keep (`HistoryStep.unattended`), and a command
 * is what whoever hears the announcement carries on — to a writer that checks
 * every field a command holds and refuses one it does not know. So it is taken
 * off here, where it has been read, and nowhere else has to know it existed.
 * Deleted rather than set to `undefined`, because a key that is present is a
 * key that is sent.
 */
function withoutUnattended(command: Command): Command {
  if (command.unattended === undefined) return command
  const carried = { ...command }
  delete carried.unattended
  return carried
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
  /** Nothing may be changed here (`ModelSession.readOnly`). Absent is `false`. */
  readOnly?: boolean
  /**
   * Keep the changes made here for a writer to take (`SessionJournal`). Absent
   * where nothing writes them — a source whose steps travel elsewhere, a test
   * — and then nothing is kept, rather than a list that only grows.
   */
  journaling?: boolean
}): ModelSession {
  const { initialProject, notify, s, takenInTree, readOnly = false, journaling = false } = deps

  const [model, setModel]
 = useState<Model>(() => fromArrays(initialProject.model))
  const [activeId, setActiveId] = useState(initialProject.activeDiagramId)
  // The mark library is shell state, not model state: it belongs to this browser
  // and travels in the working file.
  const [logoLibrary, setLogoLibrary] = useState<UploadedLogo[]>(initialProject.logoLibrary)
  const [imageLibrary, setImageLibrary] = useState<readonly ImageEntry[]>(initialProject.images ?? [])

  /**
   * The one place read-only is decided (`ModelSession.readOnly`). Everything a
   * person or a caller can change goes through here first; what another
   * author did, and a document adopted in place of this one, do not.
   */
  const mayChange = useCallback((): boolean => {
    if (!readOnly) return true
    notify(s('shell.readOnlyRefused'), 'warning')
    return false
  }, [readOnly, notify, s])
  const guardedLogos = useCallback<ModelSession['setLogoLibrary']>((next) => {
    if (mayChange()) setLogoLibrary(next)
  }, [mayChange])
  const guardedImages = useCallback<ModelSession['setImageLibrary']>((next) => {
    if (mayChange()) setImageLibrary(next)
  }, [mayChange])
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

  const { ids, refreshIds } = useIdPolicy(takenInTree, modelRef)

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
  const { journal, keep, adopted } = useSessionJournal(journaling)

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
    const changeId = mintStepId()
    // Written where the scope is kept whatever the stack does with it, and
    // under the name it is announced by; another author's is written already.
    if (meta.origin !== 'remote') keep(changeId, commands, meta.at)
    // Not recorded, so not announced: it has no inverse, and a change nothing
    // can take back is not a step (`SessionSteps.onChange`).
    if (meta.undoable === false) return
    // The fold: this announcement's own name, and exactly what it applied.
    const fold: StepFold = { changeId, commands, inverses }
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
        ...(meta.unattended === true ? { unattended: true as const } : {}),
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
      ...(landed.unattended === true ? { unattended: true as const } : {}),
    })
  }, [announce, trim, keep])

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
    if (!mayChange()) return undefined
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
    if (command.unattended === true) meta.unattended = true
    record(before, result.model, [withoutUnattended(command)], [result.inverse], meta)
    if (deletesAnElement(command)) reportOrphans(before, result.model)
    return asArrays(result.model)
  }, [notify, s, record, setActiveDiagramId, asArrays, reportOrphans, mayChange])

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
    const changeId = mintStepId()
    keep(changeId, applied)
    announce({
      kind: from === 'past' ? 'undo' : 'redo',
      changeId,
      stepId: entry.stepId,
      commands: [...applied],
      at: Date.now(),
      revision: revision.current,
      ...(entry.origin !== undefined ? { origin: entry.origin } : {}),
      ...(entry.by !== undefined ? { by: entry.by } : {}),
    })
  }, [notify, s, announce, keep])

  const undo = useCallback(() => { if (mayChange()) step('past') }, [step, mayChange])
  const redo = useCallback(() => { if (mayChange()) step('future') }, [step, mayChange])

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

  /**
   * What is left for the host to do once a settling layout has landed: as a
   * rule, nothing.
   *
   * The flag used to be cleared here, with a change that was not a step. A
   * change that is not a step is not announced either, so a session whose
   * steps are carried elsewhere laid the board out, carried the layout, and
   * kept the flag — and every later open laid it out again, as the viewer's
   * step. The layout pass now clears the flag in the step it lands
   * (`applyTidyResult`), so the two travel together or not at all, and this
   * finds nothing to do.
   *
   * It stays as the fallback for an editor that lands a layout without
   * clearing the flag, and there it is still not a step: ⌘Z after opening a
   * document must not ask for a flag back. The flag is deleted rather than set
   * to false — a saved file should look like a hand-written one.
   */
  const onLayoutSettled = useCallback((diagramId: string) => {
    if (modelRef.current.diagrams[diagramId]?.needsLayout !== true) return
    dispatch({
      type: 'board.set', diagramId, patch: { needsLayout: undefined }, undoable: false,
    })
  }, [dispatch])

  const adopt = useCallback<ModelSession['adopt']>((project, relayout) => {
    past.current = []
    future.current = []
    unsettled.current.clear()
    adopted()
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
    imageRef.current = project.images ?? []
    setImageLibrary(project.images ?? [])
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
  const id = initialProject.id
  const snapshot = useCallback((): ScopeSnapshot => ({
    path,
    ...(id !== undefined ? { id } : {}),
    ...headerRef.current,
    model: toArrays(modelRef.current),
    activeDiagramId: activeRef.current,
    logoLibrary: logoRef.current,
    images: imageRef.current,
  }), [path, id])

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
    ids,
    editorKey, logoLibrary, setLogoLibrary: guardedLogos, imageLibrary, setImageLibrary: guardedImages,
    readOnly, mayChange, dispatch, undo, redo,
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
    snapshot, adopt, journal,
  }
}

/**
 * Where a new id comes from, and the way to make it look again (see
 * `refreshIds` below): minted once for the life of the session.
 */
function useIdPolicy(takenInTree: (() => Iterable<string>) | undefined, modelRef: { current: Model }) {
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
  return { ids: ids.current, refreshIds }
}

/**
 * The changes made here and not yet written (`SessionJournal`), kept only
 * where something writes them.
 */
function useSessionJournal(journaling: boolean) {
  const pending = useRef<PendingStep[]>([])
  const adoptions = useRef(0)
  const journal = useMemo<SessionJournal>(() => ({
    pending: () => pending.current,
    written: (count) => { pending.current = pending.current.slice(count) },
    adopted: () => adoptions.current,
  }), [])
  /** One change, as one step: most are one command, and a run of them is a transaction. */
  const keep = useCallback((stepId: string, commands: readonly Command[], at = Date.now()) => {
    if (!journaling) return
    const command = commands.length === 1 ? commands[0] : transaction([...commands])
    pending.current = [...pending.current, { stepId, command, at }]
  }, [journaling])
  /** A document adopted in place of this one: nothing pending is this one's any more. */
  const adopted = useCallback(() => {
    pending.current = []
    adoptions.current += 1
  }, [])
  return { journal, keep, adopted }
}

/**
 * The fields of a scope that are about the scope rather than its document,
 * absent where absent so the file is written back as it was read — and the
 * files the read did not take in, so every save of this session leaves them
 * where they are (`ScopeSnapshot.unread`).
 */
function scopeHeader(project: ScopeSnapshot): Pick<ScopeSnapshot, 'kind' | 'client' | 'links' | 'unread'> {
  return {
    ...(project.kind !== undefined ? { kind: project.kind } : {}),
    ...(project.client !== undefined ? { client: project.client } : {}),
    ...(project.links !== undefined ? { links: project.links } : {}),
    ...(project.unread?.length ? { unread: project.unread } : {}),
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
