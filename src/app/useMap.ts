/**
 * The enterprise map, wired to the session (ADR-0012 §6, §9).
 *
 * The sheet's twin, and smaller: a map is a diagram that is the active view
 * while it is up (ADR-0016) — laid out rather than drawn, and drawn in the
 * tab in place of the canvas — but what a person can change from it is a
 * capability, and that is the sheet's own vocabulary (`SheetActions`). So
 * this hook holds what is the map's alone: which one is up, read off the
 * session, and making a new one.
 */
import { useCallback } from 'react'
import { seedMap } from '../business'
import { toDiagram } from '../model'
import type { DesignDiagram } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type Maps = {
  /** The map that is the active view, or nothing. */
  mapId: string | undefined
  map: DesignDiagram | undefined
  open: (id: string) => void
  /** Make one over what the scope holds, and make it the active view. */
  create: () => void
}

export function useMap(deps: { session: ModelSession; makeId: MakeId; s: Translate }): Maps {
  const { session, makeId, s } = deps
  const active = session.model.diagrams.find((diagram) => diagram.id === session.activeDiagramId)
  const mapId = active?.kind === 'map' ? active.id : undefined

  const create = useCallback(() => {
    const map = seedMap({ id: makeId('mp'), name: s('shell.newMap') })
    session.dispatch({ type: 'diagram.create', diagram: toDiagram(map) }, { activeDiagramId: map.id })
  }, [session, makeId, s])

  return { mapId, map: active?.kind === 'map' ? active : undefined, open: session.setActiveDiagramId, create }
}
