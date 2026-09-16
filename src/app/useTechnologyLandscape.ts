/**
 * The technology landscape, wired to the session (ADR-0015, ADR-0016).
 *
 * The map's twin, and as small: a view that is the active one while it is
 * up — laid out rather than drawn, and drawn in the tab in place of the
 * canvas — and authored through the editor's own palette and inspector, so
 * this hook holds what is the view's alone: which one is up, read off the
 * session, and making a new one.
 */
import { useCallback } from 'react'
import { seedTechnologyLandscape, toDiagram } from '../model'
import type { DesignDiagram } from '../model'
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
}

export function useTechnologyLandscape(deps: { session: ModelSession; makeId: MakeId; s: Translate }): TechnologyLandscapes {
  const { session, makeId, s } = deps
  const active = session.model.diagrams.find((diagram) => diagram.id === session.activeDiagramId)
  const diagramId = active?.kind === 'technology' ? active.id : undefined

  const create = useCallback(() => {
    const view = seedTechnologyLandscape({ id: makeId('tl'), name: s('shell.newTechnology') })
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(view) }, { activeDiagramId: view.id })
  }, [session, makeId, s])

  return { diagramId, diagram: active?.kind === 'technology' ? active : undefined, open: session.setActiveDiagramId, create }
}
