/**
 * The editing session: the model, which diagram is open, and the one place a
 * change enters (ADR-0002).
 *
 * Everything that edits this project dispatches a command. The reducer applies
 * it and hands back the command that undoes it, and the pair goes on a stack —
 * so ⌘Z covers a node move, a diagram rename, a decision's status and a project
 * setting in one order, which is the whole point.
 *
 * The editor still speaks `DiagramContentBatch`, so `onChange` runs each one
 * through `batchToCommands` and dispatches the result as a single step. That
 * bridge is temporary; what is not temporary is that the session no longer
 * applies anything itself.
 *
 * Two shapes of model live here. The reducer works on the indexed one; the
 * editor, the toolbar and the file writers want the arrays the file has. The
 * conversion is memoised on the indexed model's identity, so it costs one pass
 * per change rather than one per render.
 *
 * No outward dependency: no storage, no files. What comes out is `snapshot()`,
 * and who writes that away is not this hook's business.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import type { StringKey } from '../i18n'
import type { Command, CommandMeta, DiagramContentBatch, Model, UploadedLogo } from '../model'
import { apply, fromArrays, toArrays, transaction } from '../model'
import { batchToCommands } from '../model/batchCommands'
import { idPolicy } from '../model/keys'
import type { IdPolicy } from '../model/keys'
import { needsRemount } from '../model/hostModel'
import type { HostModel } from '../model/fromInterchange'
import type { ProjectSnapshot } from '../projects/project'
import type { Notify } from './useToasts'

/** How long a run of changes may continue before it lands on the model. */
const BATCH_DEBOUNCE_MS = 250

/**
 * How many steps the session remembers. A step is now a pair of commands rather
 * than two full-model snapshots, so this is a bound on a log rather than on
 * memory, and it can be generous where fifty was already expensive.
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
  commands: Command[]
  inverses: Command[]
  label?: StringKey
  coalesce?: string
  /** When the step was made, for an activity list. */
  at: number
}

export type DispatchOptions = {
  activeDiagramId?: string
  layoutIds?: (ids: string[]) => string[]
  /**
   * Off for a change that is not a user's edit — the editor reporting that it
   * has laid a diagram out, say. It lands on the model and not on the stack,
   * because ⌘Z after opening a document should not ask for the layout back.
   */
  undoable?: boolean
}

export type ModelSession = {
  // --- what the editor receives as props -----------------------------------
  /** The model in the shape the file has. See the note at the top. */
  model: HostModel
  activeDiagramId: string
  setActiveDiagramId: (id: string) => void
  sessionLayoutIds: string[]
  /**
   * Where a new element's or connection's id comes from. It lives here and not
   * in the editor because the session's model is the truth about what is taken,
   * and because an id handed out has to stay handed out across a remount.
   */
  ids: IdPolicy
  /**
   * The package's settle pass runs once per diagram id per editor instance. A
   * document that has to be laid out again under ids this instance already laid
   * out only gets through with a fresh mount.
   */
  editorKey: number
  /** No remount, but an emptied undo stack. */
  historyToken: number
  /** No remount and no emptied stack: the model moved under the editor's feet. */
  rebaseToken: number
  logoLibrary: UploadedLogo[]
  setLogoLibrary: React.Dispatch<React.SetStateAction<UploadedLogo[]>>

  // --- the one way in -------------------------------------------------------
  /** Apply a command. False when the reducer refused; the refusal is shown. */
  dispatch: (command: Command, options?: DispatchOptions) => boolean
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** The steps taken this session, oldest first. */
  history: () => readonly HistoryStep[]

  // --- controls -------------------------------------------------------------
  onChange: (batch: DiagramContentBatch) => void
  onLayoutSettled: (diagramId: string) => void
  /** Apply everything still waiting, now. */
  flush: () => void

  // --- for the actions around it -------------------------------------------
  /** The model as it stands after a `flush()`, without waiting for a render. */
  current: () => HostModel
  /** The same model, indexed — what a command is built against. */
  indexed: () => Model
  currentActiveId: () => string
  currentLibrary: () => UploadedLogo[]
  /** The project as it stands now, ready to be saved. */
  snapshot: () => ProjectSnapshot
  /** Take on an entirely different document: an opened file, or the shipped one. */
  adopt: (project: ProjectSnapshot, relayout: boolean) => void
  /** Drop pending changes for a diagram that is going away. */
  forget: (diagramId: string) => void
}

export function useModelSession(deps: {
  initialProject: ProjectSnapshot
  notify: Notify
  s: Translate
}): ModelSession {
  const { initialProject, notify, s } = deps

  const [model, setModel] = useState<Model>(() => fromArrays(initialProject.model))
  const [activeId, setActiveId] = useState(initialProject.activeDiagramId)
  const [sessionLayoutIds, setSessionLayoutIds] = useState<string[]>(
    () => initialProject.model.diagrams.filter((d) => d.needsLayout).map((d) => d.id))
  // The mark library is shell state, not model state: it belongs to this browser
  // and to the working file, not to the interchange document.
  const [logoLibrary, setLogoLibrary] = useState<UploadedLogo[]>(initialProject.logoLibrary)
  const [editorKey, setEditorKey] = useState(0)
  const [historyToken, setHistoryToken] = useState(0)
  const [rebaseToken, setRebaseToken] = useState(0)

  // Last batch per diagram, applied after a short debounce; the newest batch
  // replaces the previous one because batches are cumulative.
  const pending = useRef(new Map<string, DiagramContentBatch>())
  const timer = useRef<number | null>(null)
  const modelRef = useRef(model)
  modelRef.current = model
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  const logoRef = useRef(logoLibrary)
  logoRef.current = logoLibrary

  // The stacks are refs, because a caller has to be able to read and move them
  // inside an event handler. Nothing renders from them directly, so a counter
  // beside them is what makes `canUndo` and `canRedo` reach the screen.
  const ids = useRef<IdPolicy | null>(null)
  ids.current ??= idPolicy(() => [
    ...modelRef.current.order.elements,
    ...modelRef.current.order.connections,
    ...modelRef.current.order.diagrams,
  ])

  const past = useRef<HistoryStep[]>([])
  const future = useRef<HistoryStep[]>([])
  const [, setHistoryVersion] = useState(0)

  const arrays = useMemo(() => toArrays(model), [model])
  const arraysRef = useRef(arrays)
  arraysRef.current = arrays

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
    next: Model,
    commands: Command[],
    inverses: Command[],
    meta: CommandMeta,
    undoable: boolean,
  ) => {
    modelRef.current = next
    setModel(next)
    if (!undoable) return
    const top = past.current[past.current.length - 1]
    if (meta.coalesce !== undefined && top?.coalesce === meta.coalesce) {
      top.commands.push(...commands)
      top.inverses.unshift(...inverses)
      top.at = Date.now()
    } else {
      past.current.push({
        commands, inverses, at: Date.now(),
        ...(meta.label !== undefined ? { label: meta.label } : {}),
        ...(meta.coalesce !== undefined ? { coalesce: meta.coalesce } : {}),
      })
      if (past.current.length > HISTORY_CAP) past.current.shift()
    }
    future.current = []
    setHistoryVersion((v) => v + 1)
  }, [])

  const dispatch = useCallback<ModelSession['dispatch']>((command, options) => {
    const result = apply(modelRef.current, command)
    if (!result.ok) {
      notify(s(result.reason), 'error')
      return false
    }
    if (options?.activeDiagramId !== undefined) setActiveDiagramId(options.activeDiagramId)
    if (options?.layoutIds) setSessionLayoutIds(options.layoutIds)
    // A command that changed nothing is not a refusal and not a step.
    if (result.model === modelRef.current) return true
    const meta: CommandMeta = {}
    if (command.label !== undefined) meta.label = command.label
    if (command.coalesce !== undefined) meta.coalesce = command.coalesce
    record(result.model, [command], [result.inverse], meta, options?.undoable !== false)
    return true
  }, [notify, s, record, setActiveDiagramId])

  const flush = useCallback(() => {
    if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null }
    if (!pending.current.size) return
    const before = modelRef.current
    let next = before
    const commands: Command[] = []
    const inverses: Command[] = []
    pending.current.forEach((batch) => {
      const built = batchToCommands(batch, next)
      if (!built.length) return
      const result = apply(next, transaction(built))
      if (!result.ok) { notify(s(result.reason), 'error'); return }
      next = result.model
      commands.push(...built)
      inverses.unshift(result.inverse)
    })
    pending.current.clear()
    if (next === before) return
    record(next, commands, inverses, {}, true)

    // Removing an application from the model takes its container diagram with
    // it. Say so, and make sure you are not left standing on a diagram that no
    // longer exists.
    const gone = before.order.diagrams.filter((id) => !next.diagrams[id])
    if (gone.length > 0) {
      const goneIds = new Set(gone)
      setSessionLayoutIds((ids) => ids.filter((id) => !goneIds.has(id)))
      if (goneIds.has(activeRef.current)) {
        setActiveDiagramId(next.order.diagrams[0] ?? activeRef.current)
      }
      notify(gone.length === 1
        ? s('shell.orphanOne', { name: before.diagrams[gone[0]].name })
        : s('shell.orphanOther', { count: gone.length }))
    }
  }, [notify, s, record, setActiveDiagramId])

  const step = useCallback((from: 'past' | 'future') => {
    // Anything still waiting is part of the state being undone, not of the step
    // after it. Landing it afterwards would re-apply what was just taken back.
    flush()
    const stack = from === 'past' ? past.current : future.current
    const other = from === 'past' ? future.current : past.current
    const entry = stack.pop()
    if (!entry) return
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
    setHistoryVersion((v) => v + 1)
    // The editor is holding an overlay of what it did. Tell it the model moved
    // for a reason that is not a reply to its batch, so it drops that overlay
    // rather than letting it win (see `rebaseToken` in editor/props.ts).
    setRebaseToken((t) => t + 1)
  }, [notify, s, flush])

  const undo = useCallback(() => step('past'), [step])
  const redo = useCallback(() => step('future'), [step])

  const onChange = useCallback((batch: DiagramContentBatch) => {
    // Delete-then-set: a replaced batch moves to the end, so flush applies in
    // emission order and an older batch from another diagram never overwrites
    // newer changes.
    pending.current.delete(batch.diagramId)
    pending.current.set(batch.diagramId, batch)
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, BATCH_DEBOUNCE_MS)
  }, [flush])

  const onLayoutSettled = useCallback((diagramId: string) => {
    // Not a step: ⌘Z after opening a document must not ask for the layout back.
    dispatch({ type: 'diagram.update', id: diagramId, patch: { needsLayout: false } },
      { undoable: false })
  }, [dispatch])

  const adopt = useCallback<ModelSession['adopt']>((project, relayout) => {
    pending.current.clear()
    past.current = []
    future.current = []
    setHistoryVersion((v) => v + 1)
    // Measured before the swap: `needsRemount` compares the old with the new.
    const remount = needsRemount(arraysRef.current, project.model, relayout)
    const next = fromArrays(project.model)
    modelRef.current = next
    setModel(next)
    setActiveDiagramId(project.activeDiagramId)
    logoRef.current = project.logoLibrary
    setLogoLibrary(project.logoLibrary)
    setSessionLayoutIds(relayout ? project.model.diagrams.map((d) => d.id) : [])
    if (remount) setEditorKey((k) => k + 1)
    // No remount: the editor keeps viewport, selection and panels, but its undo
    // stack is about a document that no longer exists.
    else setHistoryToken((t) => t + 1)
  }, [setActiveDiagramId])

  /**
   * The ref is fixed for the life of the session: switching projects remounts
   * the workspace, which is what clears the undo stack and the pending batches
   * along with it. A session that could change its own address mid-flight would
   * be able to autosave one project's edits onto another.
   */
  const ref = initialProject.ref
  const snapshot = useCallback((): ProjectSnapshot => ({
    ref,
    model: toArrays(modelRef.current),
    activeDiagramId: activeRef.current,
    logoLibrary: logoRef.current,
  }), [ref])

  const forget = useCallback((diagramId: string) => { pending.current.delete(diagramId) }, [])

  return {
    model: arrays, activeDiagramId: activeId, setActiveDiagramId, sessionLayoutIds,
    ids: ids.current,
    editorKey, historyToken, rebaseToken, logoLibrary, setLogoLibrary,
    dispatch, undo, redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    history: () => past.current,
    onChange, onLayoutSettled, flush,
    current: () => toArrays(modelRef.current),
    indexed: () => modelRef.current,
    currentActiveId: () => activeRef.current,
    currentLibrary: () => logoRef.current,
    snapshot, adopt, forget,
  }
}
