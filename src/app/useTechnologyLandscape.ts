// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The technology landscape, wired to the session (ADR-0015, ADR-0016).
 *
 * The map's twin, and as small: a view that is the active one while it is
 * up — laid out rather than drawn, and drawn in the tab in place of the
 * canvas — and authored through the editor's own palette and inspector, so
 * this hook holds what is the view's alone: which one is up, read off the
 * session, making a new one, and the door from a record (ADR-0020): the
 * landscape opened on one application, which is the page's initial focus.
 */
import { useCallback, useState } from 'react'
import { nodeKey, seedTechnologyLandscape, toDiagram } from '../model'
import type { DesignDiagram, ElementId, NodeKey } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type TechnologyLandscapes = {
  /** The view that is active, or nothing. */
  diagramId: string | undefined
  diagram: DesignDiagram | undefined
  open: (id: string) => void
  /** Make one over what the scope holds, and make it the active view. */
  create: () => void
  /** The card the page starts on, where a record's door opened it (ADR-0020). */
  focus: NodeKey | undefined
  /** Open the scope's landscape — the first, made where there is none — on this application. */
  showOn: (elementId: ElementId) => void
}

export function useTechnologyLandscape(deps: { session: ModelSession; makeId: MakeId; s: Translate }): TechnologyLandscapes {
  const { session, makeId, s } = deps
  const active = session.model.diagrams.find((diagram) => diagram.id === session.activeDiagramId)
  const diagramId = active?.kind === 'technology' ? active.id : undefined

  const [focus, setFocus] = useState<NodeKey | undefined>(undefined)

  const create = useCallback(() => {
    setFocus(undefined)
    const view = seedTechnologyLandscape({ id: makeId('tl'), name: s('shell.newTechnology') })
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(view) }, { activeDiagramId: view.id })
  }, [session, makeId, s])
  const open = useCallback((id: string) => {
    setFocus(undefined)
    session.setActiveDiagramId(id)
  }, [session])
  const showOn = useCallback((elementId: ElementId) => {
    setFocus(nodeKey.application(elementId))
    const held = session.current().diagrams.find((diagram) => diagram.kind === 'technology')
    if (held) session.setActiveDiagramId(held.id)
    else {
      const view = seedTechnologyLandscape({ id: makeId('tl'), name: s('shell.newTechnology') })
      session.dispatch({ type: 'diagram.create', diagram: toDiagram(view) }, { activeDiagramId: view.id })
    }
  }, [session, makeId, s])

  return { diagramId, diagram: active?.kind === 'technology' ? active : undefined, open, create, focus, showOn }
}
