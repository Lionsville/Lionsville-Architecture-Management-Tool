// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, wired to the session.
 *
 * A drawing is a view and it is the active one while it is up. Making one is
 * a command, the same as making a sheet. What it shows — its picture, or the
 * words for a drawing that has not been drawn — is the page's, not this hook's.
 */
import { useCallback } from 'react'
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
  /** Make one, and make it the active view. */
  create: () => void
}

export function useDrawing(deps: { session: ModelSession; makeId: MakeId; s: Translate }): Drawings {
  const { session, makeId, s } = deps
  const active = session.model.diagrams.find((diagram) => diagram.id === session.activeDiagramId)
  const drawingId = active?.kind === 'drawing' ? active.id : undefined

  const create = useCallback(() => {
    const drawing: DesignDiagram = {
      id: makeId('dr'), kind: 'drawing', name: s('shell.newDrawing'), members: [],
    }
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(drawing) }, { activeDiagramId: drawing.id })
  }, [session, makeId, s])

  return {
    drawingId,
    drawing: active?.kind === 'drawing' ? active : undefined,
    open: session.setActiveDiagramId,
    create,
  }
}
