/**
 * Creating, renaming, duplicating and deleting diagrams.
 *
 * Everything the editor's tab bar and tab menu ask of the shell. Each one is a
 * command now (ADR-0002), so each one is also an undo step; what lives here is
 * the order of operations, the message, and which dialog belongs to it.
 */
import { useCallback, useState } from 'react'
import type { Translate } from '../i18n'
import type { DesignDiagram, DiagramSettings } from '../model'
import { duplicateDiagram, toDiagram } from '../model'
import { findContainerDiagram, seedContainerDiagram } from '../model/containerDiagram'
import type { ModelSession } from './useModelSession'
import type { Notify } from './useToasts'

/** Fresh ids come from outside: a clock inside a function makes it untestable. */
export type { MakeId } from '../model/keys'
import type { MakeId } from '../model/keys'

export type DiagramActions = {
  onCreateContainerDiagram: (applicationId: string) => void
  onRenameDiagram: (diagramId: string, name: string) => void
  /** The editor's settings dialog, applied: name, title block, aspect columns. */
  onDiagramSettingsChange: (diagramId: string, settings: DiagramSettings) => void
  onDuplicateDiagram: (diagramId: string) => void

  /** The new landscape: its name is asked for in a dialog. */
  onCreateLayer7Diagram: () => void
  newDiagramName: string | null
  setNewDiagramName: (name: string | null) => void
  confirmNewDiagram: () => void

  /** Deleting: a request from the editor, confirmed here first. */
  requestDeleteDiagram: (diagramId: string) => void
  diagramToDelete: DesignDiagram | undefined
  /** The last landscape may not go — nothing would be left to work on. */
  isLastLandscape: boolean
  cancelDeleteDiagram: () => void
  confirmDeleteDiagram: () => void
}

export function useDiagramActions(deps: {
  session: ModelSession
  notify: Notify
  s: Translate
  makeId: MakeId
}): DiagramActions {
  const { session, notify, s, makeId } = deps

  const onCreateContainerDiagram = useCallback((applicationId: string) => {
    const m = session.current()
    const existing = findContainerDiagram(m, applicationId)
    if (existing) { session.setActiveDiagramId(existing.id); return }
    const diagram = seedContainerDiagram(m, applicationId, {
      id: makeId('cd'),
      name: (name) => s('shell.containerDiagram', { name }),
    })
    if (!diagram) return
    // `needsLayout` came with the seed: the editor lays the new tab out once,
    // on open, and clears the flag itself.
    session.dispatch(
      { type: 'diagram.create', diagram: toDiagram(diagram) },
      { activeDiagramId: diagram.id },
    )
  }, [session, s, makeId])

  // The editor asks for the new name itself (a dialog with the current name
  // preselected) and delivers it here.
  const onRenameDiagram = useCallback((diagramId: string, name: string) => {
    session.dispatch({ type: 'diagram.rename', id: diagramId, name })
  }, [session])

  const onDiagramSettingsChange = useCallback((diagramId: string, settings: DiagramSettings) => {
    session.dispatch({ type: 'diagram.settings', id: diagramId, settings })
  }, [session])

  const onDuplicateDiagram = useCallback((diagramId: string) => {
    const source = session.indexed().diagrams[diagramId]
    if (!source) return
    const id = makeId(source.kind === 'layer7' ? 'l7' : 'cd')
    const command = duplicateDiagram(
      session.indexed(), diagramId, id, (name) => s('shell.copyOf', { name }))
    if (!command || !session.dispatch(command, { activeDiagramId: id })) return
    notify(s('shell.duplicated', { name: source.name }), 'success')
  }, [session, notify, s, makeId])

  const [newDiagramName, setNewDiagramName] = useState<string | null>(null)
  const onCreateLayer7Diagram = useCallback(() => {
    setNewDiagramName(s('shell.newDiagram'))
  }, [session, s])

  const confirmNewDiagram = useCallback(() => {
    const name = (newDiagramName ?? '').trim()
    if (!name) return
    setNewDiagramName(null)
    const m = session.current()
    const diagram: DesignDiagram = {
      id: makeId('l7'), kind: 'layer7', name, placements: [],
      // Copied, not referenced: this landscape's columns are now its own, and
      // changing the project's default later must not silently rewrite them.
      // Absent when the project has no default, which leaves the standard five.
      ...(m.defaultAspectConfig ? { aspectConfig: [...m.defaultAspectConfig] } : {}),
    }
    session.dispatch(
      { type: 'diagram.create', diagram: toDiagram(diagram) },
      { activeDiagramId: diagram.id },
    )
  }, [newDiagramName, session, makeId])

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const diagramToDelete = deleteId
    ? session.model.diagrams.find((d) => d.id === deleteId)
    : undefined
  const isLastLandscape = diagramToDelete?.kind === 'layer7'
    && session.model.diagrams.filter((d) => d.kind === 'layer7').length <= 1

  const cancelDeleteDiagram = useCallback(() => setDeleteId(null), [])

  const confirmDeleteDiagram = useCallback(() => {
    const id = deleteId
    setDeleteId(null)
    if (!id) return
    const target = session.indexed().diagrams[id]
    if (!target) return
    // The reducer refuses the last landscape, and says so itself.
    if (!session.dispatch({ type: 'diagram.delete', id })) return
    // The active diagram gone? Then on to the first one that remains.
    if (session.currentActiveId() === id) {
      session.setActiveDiagramId(session.indexed().order.diagrams[0] ?? id)
    }
    notify(s('shell.deleted', { name: target.name }), 'success')
  }, [deleteId, session, notify, s])

  return {
    onCreateContainerDiagram, onRenameDiagram, onDiagramSettingsChange, onDuplicateDiagram,
    onCreateLayer7Diagram, newDiagramName, setNewDiagramName, confirmNewDiagram,
    requestDeleteDiagram: setDeleteId, diagramToDelete, isLastLandscape,
    cancelDeleteDiagram, confirmDeleteDiagram,
  }
}
