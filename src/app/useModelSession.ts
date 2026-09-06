/**
 * The editing session: the model, which diagram is open, and everything needed
 * to land changes coming out of the editor.
 *
 * This is the heart of the shell and the only genuinely intricate part —
 * debounced batches, permanent keys that only come into being on the first
 * flush, and the question of when the editor has to remount. It sits apart so
 * the rest of the shell (buttons, dialogs, files) can go past it without having
 * to understand it.
 *
 * No outward dependency: no storage, no files. What comes out is `snapshot()`,
 * and who writes that away is not this hook's business.
 */
import { useCallback, useRef, useState } from 'react'
import type { Translate } from '../i18n'
import type { DiagramContentBatch, UploadedLogo } from '../model'
import type { HostModel } from '../model/fromInterchange'
import {
  applyBatch, needsRemount, rekeyBatch, removedDiagrams, resolveActiveDiagramId,
} from '../model/hostModel'
import type { Aliases } from '../model/hostModel'
import type { ProjectSnapshot } from '../projects/project'
import type { Notify } from './useToasts'

/** How long a run of changes may continue before it lands on the model. */
const BATCH_DEBOUNCE_MS = 250

export type ModelSession = {
  // --- what the editor receives as props -----------------------------------
  model: HostModel
  activeDiagramId: string
  setActiveDiagramId: (id: string) => void
  sessionLayoutIds: string[]
  aliasProp: { elements: ReadonlyMap<string, string>; connections: ReadonlyMap<string, string> }
  /**
   * The package's settle pass runs once per diagram id per editor instance. A
   * document that has to be laid out again under ids this instance already laid
   * out only gets through with a fresh mount.
   */
  editorKey: number
  /** No remount, but an emptied undo stack. */
  historyToken: number
  logoLibrary: UploadedLogo[]
  setLogoLibrary: React.Dispatch<React.SetStateAction<UploadedLogo[]>>

  // --- controls -------------------------------------------------------------
  onChange: (batch: DiagramContentBatch) => void
  onLayoutSettled: (diagramId: string) => void
  /** Apply everything still waiting, now. */
  flush: () => void

  // --- for the actions around it -------------------------------------------
  /** The model as it stands after a `flush()`, without waiting for a render. */
  current: () => HostModel
  currentActiveId: () => string
  currentLibrary: () => UploadedLogo[]
  /** The project as it stands now, ready to be saved. */
  snapshot: () => ProjectSnapshot
  /** Record a new model that the shell worked out itself. */
  commit: (next: HostModel, options?: {
    activeDiagramId?: string
    layoutIds?: (ids: string[]) => string[]
  }) => void
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

  const [model, setModel] = useState<HostModel>(initialProject.model)
  const [activeId, setActiveId] = useState(initialProject.activeDiagramId)
  const [sessionLayoutIds, setSessionLayoutIds] = useState<string[]>(
    () => initialProject.model.diagrams.filter((d) => d.needsLayout).map((d) => d.id))
  // The mark library is shell state, not model state: it belongs to this browser
  // and to the working file, not to the interchange document.
  const [logoLibrary, setLogoLibrary] = useState<UploadedLogo[]>(initialProject.logoLibrary)
  const [editorKey, setEditorKey] = useState(0)
  const [historyToken, setHistoryToken] = useState(0)
  const [aliasProp, setAliasProp] = useState<ModelSession['aliasProp']>(
    { elements: new Map(), connections: new Map() })

  // Last batch per diagram, applied after a short debounce; the newest batch
  // replaces the previous one because batches are cumulative.
  const pending = useRef(new Map<string, DiagramContentBatch>())
  const timer = useRef<number | null>(null)
  const modelRef = useRef(model)
  modelRef.current = model
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  // Every alias ever assigned, across flushes; the prop gets copies.
  const aliasRef = useRef<Aliases>({ elements: new Map(), connections: new Map() })
  const logoRef = useRef(logoLibrary)
  logoRef.current = logoLibrary

  const setActiveDiagramId = useCallback((id: string) => {
    activeRef.current = id
    setActiveId(id)
  }, [])

  const flush = useCallback(() => {
    if (timer.current != null) { window.clearTimeout(timer.current); timer.current = null }
    if (!pending.current.size) return
    const before = modelRef.current
    let m = before
    const aliasesBefore = aliasRef.current.elements.size + aliasRef.current.connections.size
    pending.current.forEach((b) => { m = applyBatch(m, rekeyBatch(b, m, aliasRef.current)) })
    pending.current.clear()
    modelRef.current = m // readers after flush() see the new model immediately
    setModel(m)

    // Removing an application from the model takes its container diagram with it
    // (`applyBatch`). Say so, and make sure you are not left standing on a
    // diagram that no longer exists.
    const gone = removedDiagrams(before, m)
    if (gone.length > 0) {
      const goneIds = new Set(gone.map((d) => d.id))
      setSessionLayoutIds((ids) => ids.filter((id) => !goneIds.has(id)))
      const next = resolveActiveDiagramId(m, activeRef.current)
      if (next !== activeRef.current) setActiveDiagramId(next)
      notify(gone.length === 1
        ? s('shell.orphanOne', { name: gone[0].name })
        : s('shell.orphanOther', { count: gone.length }))
    }

    if (aliasRef.current.elements.size + aliasRef.current.connections.size > aliasesBefore) {
      // Always a new object with new maps: reconciliation runs on identity.
      setAliasProp({
        elements: new Map(aliasRef.current.elements),
        connections: new Map(aliasRef.current.connections),
      })
    }
  }, [notify, s, setActiveDiagramId])

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
    setModel((m) => ({
      ...m,
      diagrams: m.diagrams.map((d) => d.id === diagramId ? { ...d, needsLayout: false } : d),
    }))
  }, [])

  const commit = useCallback<ModelSession['commit']>((next, options) => {
    modelRef.current = next
    setModel(next)
    if (options?.activeDiagramId !== undefined) setActiveDiagramId(options.activeDiagramId)
    if (options?.layoutIds) setSessionLayoutIds(options.layoutIds)
  }, [setActiveDiagramId])

  const adopt = useCallback<ModelSession['adopt']>((project, relayout) => {
    pending.current.clear()
    aliasRef.current = { elements: new Map(), connections: new Map() }
    setAliasProp({ elements: new Map(), connections: new Map() })
    // Measured before the swap: `needsRemount` compares the old with the new.
    const remount = needsRemount(modelRef.current, project.model, relayout)
    modelRef.current = project.model
    setModel(project.model)
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
   * the workspace, which is what clears the undo stack, the aliases and the
   * pending batches along with it. A session that could change its own address
   * mid-flight would be able to autosave one project's edits onto another.
   */
  const ref = initialProject.ref
  const snapshot = useCallback((): ProjectSnapshot => ({
    ref,
    model: modelRef.current,
    activeDiagramId: activeRef.current,
    logoLibrary: logoRef.current,
  }), [ref])

  const forget = useCallback((diagramId: string) => { pending.current.delete(diagramId) }, [])

  return {
    model, activeDiagramId: activeId, setActiveDiagramId, sessionLayoutIds, aliasProp,
    editorKey, historyToken, logoLibrary, setLogoLibrary,
    onChange, onLayoutSettled, flush,
    current: () => modelRef.current,
    currentActiveId: () => activeRef.current,
    currentLibrary: () => logoRef.current,
    snapshot, commit, adopt, forget,
  }
}
