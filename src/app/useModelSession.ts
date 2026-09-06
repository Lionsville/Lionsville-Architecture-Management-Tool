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
 */
import { useCallback, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import type { StringKey } from '../i18n'
import type { Command, CommandMeta, Model, UploadedLogo } from '../model'
import { apply, fromArrays, toArrays, transaction } from '../model'
import { idPolicy } from '../model/keys'
import type { IdPolicy } from '../model/keys'
import { needsRemount } from '../model/hostModel'
import type { HostModel } from '../model/fromInterchange'
import type { ProjectSnapshot } from '../projects/project'
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
  commands: Command[]
  inverses: Command[]
  label?: StringKey
  coalesce?: string
  /** When the step was made, for an activity list. */
  at: number
}

export type DispatchOptions = {
  activeDiagramId?: string
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
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** The steps taken this session, oldest first. */
  history: () => readonly HistoryStep[]

  // --- controls -------------------------------------------------------------
  onLayoutSettled: (diagramId: string) => void

  // --- for the actions around it -------------------------------------------
  /** The model as it stands now, without waiting for a render. */
  current: () => HostModel
  /** The same model, indexed — what a command is built against. */
  indexed: () => Model
  currentActiveId: () => string
  currentLibrary: () => UploadedLogo[]
  /** The project as it stands now, ready to be saved. */
  snapshot: () => ProjectSnapshot
  /** Take on an entirely different document: an opened file, or the shipped one. */
  adopt: (project: ProjectSnapshot, relayout: boolean) => void
}

export function useModelSession(deps: {
  initialProject: ProjectSnapshot
  notify: Notify
  s: Translate
}): ModelSession {
  const { initialProject, notify, s } = deps

  const [model, setModel] = useState<Model>(() => fromArrays(initialProject.model))
  const [activeId, setActiveId] = useState(initialProject.activeDiagramId)
  // The mark library is shell state, not model state: it belongs to this browser
  // and to the working file, not to the interchange document.
  const [logoLibrary, setLogoLibrary] = useState<UploadedLogo[]>(initialProject.logoLibrary)
  const [editorKey, setEditorKey] = useState(0)

  const modelRef = useRef(model)
  modelRef.current = model
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  const logoRef = useRef(logoLibrary)
  logoRef.current = logoLibrary

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

  const ids = useRef<IdPolicy | null>(null)
  ids.current ??= idPolicy(() => [
    ...modelRef.current.order.elements,
    ...modelRef.current.order.connections,
    ...modelRef.current.order.diagrams,
  ])

  // The stacks are refs, because a caller has to be able to read and move them
  // inside an event handler. Nothing renders from them directly, so a counter
  // beside them is what makes `canUndo` and `canRedo` reach the screen.
  const past = useRef<HistoryStep[]>([])
  const future = useRef<HistoryStep[]>([])
  const [, setHistoryVersion] = useState(0)

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
  ) => {
    modelRef.current = next
    setModel(next)
    if (meta.undoable === false) return
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
    const meta: CommandMeta = {}
    if (command.label !== undefined) meta.label = command.label
    if (command.coalesce !== undefined) meta.coalesce = command.coalesce
    if (command.undoable !== undefined) meta.undoable = command.undoable
    record(result.model, [command], [result.inverse], meta)
    if (deletesAnElement(command)) reportOrphans(before, result.model)
    return asArrays(result.model)
  }, [notify, s, record, setActiveDiagramId, asArrays, reportOrphans])

  const step = useCallback((from: 'past' | 'future') => {
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
  }, [notify, s])

  const undo = useCallback(() => step('past'), [step])
  const redo = useCallback(() => step('future'), [step])

  const onLayoutSettled = useCallback((diagramId: string) => {
    // Not a step: ⌘Z after opening a document must not ask for the layout back.
    // The flag is deleted rather than set to false — a saved file should look
    // like a hand-written one, and nothing reads the difference.
    dispatch({
      type: 'diagram.update', id: diagramId, patch: { needsLayout: undefined }, undoable: false,
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
    setActiveDiagramId(project.activeDiagramId)
    logoRef.current = project.logoLibrary
    setLogoLibrary(project.logoLibrary)
    if (remount) setEditorKey((k) => k + 1)
  }, [setActiveDiagramId, asArrays])

  /**
   * The ref is fixed for the life of the session: switching projects remounts
   * the workspace, which is what clears the undo stack along with it. A session
   * that could change its own address mid-flight would be able to autosave one
   * project's edits onto another.
   */
  const ref = initialProject.ref
  const snapshot = useCallback((): ProjectSnapshot => ({
    ref,
    model: toArrays(modelRef.current),
    activeDiagramId: activeRef.current,
    logoLibrary: logoRef.current,
  }), [ref])

  return {
    model: arrays, activeDiagramId: activeId, setActiveDiagramId,
    ids: ids.current,
    editorKey, logoLibrary, setLogoLibrary,
    dispatch, undo, redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    history: () => past.current,
    onLayoutSettled,
    current: () => asArrays(modelRef.current),
    indexed: () => modelRef.current,
    currentActiveId: () => activeRef.current,
    currentLibrary: () => logoRef.current,
    snapshot, adopt,
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
