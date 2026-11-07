// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, wired to the session.
 *
 * A drawing is a view and it is the active one while it is up. Making one is
 * a command, the same as making a sheet. What it shows — its picture, or the
 * words for a drawing that has not been drawn — is the page's, not this hook's.
 * Whether its editor is open is here, because the address says it and an agent
 * can ask for it; and so is the question of what a new one is called, because a
 * scope full of tabs called *Drawing* cannot be told apart.
 */
import { useCallback, useEffect, useState } from 'react'
import { toDiagram } from '../model'
import type { DesignDiagram } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type Drawings = {
  /** The drawing that is the active view, or nothing. */
  drawingId: string | undefined
  drawing: DesignDiagram | undefined
  open: (id: string) => void
  /** Ask what a new one is called. */
  create: () => void
  /** The same, about an element: the menu's *Create drawing* and the inspector's button. */
  createFor: (elementId: string) => void
  /** A new view being asked for: which step, and what it is about. */
  asking: { naming: boolean; about?: string } | undefined
  /** Ask which kind of view, from the first step. */
  chooseView: () => void
  stopAsking: () => void
  /** Make one with its name, and make it the active view. One command, so one undo. */
  make: (name: string, elementId?: string) => void
  /** The drawing whose editor is open. */
  editing: string | undefined
  setEditing: (id: string | undefined) => void
}

export function useDrawing(deps: { session: ModelSession; makeId: MakeId; s: Translate }): Drawings {
  const { session, makeId, s } = deps
  const active = session.model.diagrams.find((diagram) => diagram.id === session.activeDiagramId)
  const drawingId = active?.kind === 'drawing' ? active.id : undefined

  const [asking, setAsking] = useState<Drawings['asking']>(undefined)
  const [editing, setEditing] = useState<string | undefined>(undefined)
  // Another view on the tab means the editor has gone, and coming back is to the picture.
  useEffect(() => {
    if (editing !== undefined && editing !== drawingId) setEditing(undefined)
  }, [editing, drawingId])
  const create = useCallback(() => setAsking({ naming: true }), [])
  const createFor = useCallback((elementId: string) => {
    if (session.current().elements.some((held) => held.id === elementId)) setAsking({ naming: true, about: elementId })
  }, [session])
  const chooseView = useCallback(() => setAsking({ naming: false }), [])
  const stopAsking = useCallback(() => setAsking(undefined), [])

  const make = useCallback((name: string, elementId?: string) => {
    const drawing: DesignDiagram = {
      id: makeId('dr'), kind: 'drawing', name: name.trim() || s('shell.newDrawing'), ...(elementId ? { elementId } : {}), members: [],
    }
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(drawing) }, { activeDiagramId: drawing.id })
    setAsking(undefined)
  }, [session, makeId, s])

  return {
    drawingId,
    drawing: active?.kind === 'drawing' ? active : undefined,
    open: session.setActiveDiagramId,
    create,
    createFor,
    asking,
    chooseView,
    stopAsking,
    make,
    // Only while its tab is up: another view on the tab means the editor has gone.
    editing: editing === drawingId ? editing : undefined,
    setEditing,
  }
}
