// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An element selected on a view as it is opened (ADR-0019, amended): what a
 * destination's `select` asks for, and the one way it is carried out for
 * every kind of view.
 *
 * On a board, the editor's own focus request — and only where the board
 * places the element, because that request switches to another board that
 * does, and a view opened with something selected on it stays that view. On
 * the technology landscape, the card it is drawn as, chosen as a door
 * chooses one. On a sheet or a map, a request the page honours where it
 * draws the element. Nothing is selected where it is not drawn there.
 */
import { useCallback, useState } from 'react'
import { placedNode } from '../model/placement'
import type { ElementId } from '../model'
import type { SelectRequest } from '../widgets/useSelectRequest'
import type { ModelSession } from './useModelSession'
import type { TechnologyLandscapes } from './useTechnologyLandscape'

export type ViewSelect = {
  /** Select this element on this view, where the view draws it. */
  select: (viewId: string, elementId: ElementId) => void
  /** The request a laid-out page is handed: only the one for its own view. */
  requestFor: (viewId: string) => SelectRequest | undefined
}

export function useViewSelect(deps: {
  session: Pick<ModelSession, 'current'>
  focusElement: (id: ElementId) => void
  landscapes: Pick<TechnologyLandscapes, 'select'>
}): ViewSelect {
  const { session, focusElement } = deps
  const chooseCard = deps.landscapes.select
  const [request, setRequest] = useState<(SelectRequest & { viewId: string }) | undefined>(undefined)
  const select = useCallback((viewId: string, elementId: ElementId) => {
    const view = session.current().diagrams.find((diagram) => diagram.id === viewId)
    if (!view) return
    if (view.kind === 'layer7' || view.kind === 'container') {
      if (placedNode(view, elementId) !== undefined) focusElement(elementId)
      return
    }
    if (view.kind === 'technology') { chooseCard(elementId); return }
    setRequest((was) => ({ viewId, id: elementId, nonce: (was?.nonce ?? 0) + 1 }))
  }, [session, focusElement, chooseCard])
  const requestFor = useCallback((viewId: string): SelectRequest | undefined => (
    request?.viewId === viewId ? { id: request.id, nonce: request.nonce } : undefined
  ), [request])
  return { select, requestFor }
}
