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
import { cardFor, nodeKey, seedTechnologyLandscape, toDiagram } from '../model'
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
  /** Open this landscape — or the scope's first — on this application; nothing where it has none. */
  showOn: (elementId: ElementId, viewId?: string) => void
  /**
   * Choose the card this element is drawn as on the landscape that is up, as
   * a door would (ADR-0019, amended): nothing where it is not drawn there.
   */
  select: (elementId: ElementId) => void
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
  const showOn = useCallback((elementId: ElementId, viewId?: string) => {
    setFocus(nodeKey.application(elementId))
    // An open never makes a view: the door is drawn only while there is one (`showOnTechnology`).
    const landscapes = session.current().diagrams.filter((diagram) => diagram.kind === 'technology')
    const held = landscapes.find((diagram) => diagram.id === viewId) ?? landscapes[0]
    if (held) session.setActiveDiagramId(held.id)
  }, [session])

  const select = useCallback((elementId: ElementId) => {
    const held = session.current().elements.find((element) => element.id === elementId)
    // One this scope does not hold is an application the rows bring here from
    // another scope: the only cards a landscape draws of what it does not keep.
    const key = held ? cardFor(held.kind, held.id) : nodeKey.application(elementId)
    if (key) setFocus(key)
  }, [session])

  return { diagramId, diagram: active?.kind === 'technology' ? active : undefined, open, create, focus, showOn, select }
}
