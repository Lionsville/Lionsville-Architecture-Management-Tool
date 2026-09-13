/**
 * The enterprise map, wired to the session (ADR-0012 §6, §9).
 *
 * The sheet's twin, and smaller: a map is a diagram that is never the active
 * one — laid out rather than drawn, so the canvas has nothing to show for it
 * and choosing its tab opens a page over the editor — but what a person can
 * change from it is a capability, and that is the sheet's own vocabulary
 * (`SheetActions`). So this hook holds what is the map's alone: which one is
 * up, and making a new one. The actions the page's inspector needs are the
 * sheet's, handed across by the workspace, because a capability renamed from
 * the map and one renamed from the sheet are the same command.
 */
import { useCallback, useState } from 'react'
import { seedMap } from '../business'
import { toDiagram } from '../model'
import type { DesignDiagram } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type Maps = {
  /** The map being read, or nothing. */
  mapId: string | undefined
  map: DesignDiagram | undefined
  open: (id: string) => void
  close: () => void
  /** Make one over what the scope holds, and open it. */
  create: () => void
}

export function useMap(deps: { session: ModelSession; makeId: MakeId; s: Translate }): Maps {
  const { session, makeId, s } = deps
  const [mapId, setMapId] = useState<string | undefined>(undefined)

  const close = useCallback(() => setMapId(undefined), [])

  const create = useCallback(() => {
    const map = seedMap({ id: makeId('mp'), name: s('shell.newMap') })
    // No `activeDiagramId`, for the sheet's reason: the canvas cannot draw one.
    if (!session.dispatch({ type: 'diagram.create', diagram: toDiagram(map) })) return
    setMapId(map.id)
  }, [session, makeId, s])

  return {
    mapId,
    map: mapId === undefined ? undefined : session.model.diagrams.find((diagram) => diagram.id === mapId),
    open: setMapId,
    close,
    create,
  }
}
