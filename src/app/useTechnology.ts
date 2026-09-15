/**
 * A platform's page, wired to the session (ADR-0013).
 *
 * The map's twin, and as small: a technology view is a diagram that is never
 * the active one — laid out rather than drawn, so the canvas has nothing to
 * show for it and choosing its tab opens a page over the editor. Nothing is
 * changed from it, so this hook holds what is the view's alone: which one is
 * up, and making one about a platform — once per platform, because a second
 * page about the same bus would say the same thing.
 */
import { useCallback, useState } from 'react'
import { findTechnologyDiagram, seedTechnologyDiagram, toDiagram } from '../model'
import type { DesignDiagram, ElementId } from '../model'
import type { MakeId } from '../model/keys'
import type { Translate } from '../i18n'
import type { ModelSession } from './useModelSession'

export type Technology = {
  /** The view being read, or nothing. */
  viewId: string | undefined
  view: DesignDiagram | undefined
  open: (id: string) => void
  close: () => void
  /** Open the view about this platform, making it first where there is none. */
  create: (platformId: ElementId) => void
}

export function useTechnology(deps: { session: ModelSession; makeId: MakeId; s: Translate }): Technology {
  const { session, makeId, s } = deps
  const [viewId, setViewId] = useState<string | undefined>(undefined)

  const close = useCallback(() => setViewId(undefined), [])

  const create = useCallback((platformId: ElementId) => {
    const current = session.current()
    const existing = findTechnologyDiagram(current, platformId)
    if (existing) { setViewId(existing.id); return }
    const view = seedTechnologyDiagram(current, platformId, {
      id: makeId('tv'),
      name: (name) => s('shell.technologyView', { name }),
    })
    if (!view) return
    // No `activeDiagramId`, for the sheet's reason: the canvas cannot draw one.
    if (!session.dispatch({ type: 'diagram.create', diagram: toDiagram(view) })) return
    setViewId(view.id)
  }, [session, makeId, s])

  return {
    viewId,
    view: viewId === undefined ? undefined : session.model.diagrams.find((diagram) => diagram.id === viewId),
    open: setViewId,
    close,
    create,
  }
}
