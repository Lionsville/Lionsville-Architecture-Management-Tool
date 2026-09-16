/**
 * The technology landscape, wired to the session (ADR-0015).
 *
 * The map's twin, and as small: a view that is never the active diagram —
 * laid out rather than drawn, so choosing its tab opens a page over the
 * editor — and nothing on it is edited from the page, so this hook holds
 * what is the view's alone: which one is up, and making a new one.
 */
import { useCallback, useState } from 'react'
import { seedTechnologyLandscape, toDiagram } from '../model'
import type { DesignDiagram } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type TechnologyLandscapes = {
  /** The view being read, or nothing. */
  diagramId: string | undefined
  diagram: DesignDiagram | undefined
  open: (id: string) => void
  close: () => void
  /** Make one over what the scope holds, and open it. */
  create: () => void
}

export function useTechnologyLandscape(deps: { session: ModelSession; makeId: MakeId; s: Translate }): TechnologyLandscapes {
  const { session, makeId, s } = deps
  const [diagramId, setDiagramId] = useState<string | undefined>(undefined)

  const close = useCallback(() => setDiagramId(undefined), [])

  const create = useCallback(() => {
    const view = seedTechnologyLandscape({ id: makeId('tl'), name: s('shell.newTechnology') })
    // No `activeDiagramId`, for the map's reason: the canvas cannot draw one.
    if (!session.dispatch({ type: 'diagram.create', diagram: toDiagram(view) })) return
    setDiagramId(view.id)
  }, [session, makeId, s])

  return {
    diagramId,
    diagram: diagramId === undefined ? undefined : session.model.diagrams.find((diagram) => diagram.id === diagramId),
    open: setDiagramId,
    close,
    create,
  }
}
