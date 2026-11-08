// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scripts of what a home lists, fetched while nobody is doing anything on
 * it. A view's page arrives with the first one opened (`widgets/lazyPart`),
 * so the first press on a sheet, a chart or the observations from a home
 * waited for its script on top of everything else. Asked for in idle time,
 * the same scripts the parts ask for are here by the press, and the page is
 * drawn in the render that wanted it. Only what the home holds is asked for.
 */
import { useEffect } from 'react'
import type { HostModel } from '../../model/hostModel'
import type { ScopeSnapshot } from '../../projects/scope'
import type { ScopePath } from '../../projects/scopePath'

type Kind = 'sheet' | 'map' | 'technology' | 'drawing' | 'chart' | 'conway' | 'observations'

/** The same imports the parts make, so each is one script, fetched and parsed once. */
const SCRIPTS: Record<Kind, () => Promise<unknown>> = {
  sheet: () => import('../../business/ui/SheetPage'),
  map: () => import('../../business/ui/MapPage'),
  technology: () => import('../../technology/ui/TechnologyLandscapePage'),
  drawing: () => import('../DrawingView'),
  chart: () => import('../units/ChartPage'),
  conway: () => import('../units/ConwayPage'),
  observations: () => import('../../observations/ui/ObservationsPage'),
}

/** What a home's own document would open: its views' kinds, and the observations where it keeps any. */
export function kindsToPreload(model: Pick<HostModel, 'diagrams' | 'observations'>): Kind[] {
  const kinds = new Set<Kind>()
  for (const diagram of model.diagrams) if (diagram.kind in SCRIPTS) kinds.add(diagram.kind as Kind)
  if ((model.observations?.length ?? 0) > 0) kinds.add('observations')
  return [...kinds]
}

type Idle = (run: () => void, options?: { timeout: number }) => number

/** Ask for those scripts when the page is idle; answers a way to stop asking, for a home left first. */
export function preloadViewsOf(model: Pick<HostModel, 'diagrams' | 'observations'>): () => void {
  const kinds = kindsToPreload(model)
  if (kinds.length === 0) return () => {}
  const idle = (globalThis as { requestIdleCallback?: Idle }).requestIdleCallback
  const cancelIdle = (globalThis as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback
  const run = () => {
    // A script that will not load is the part's to say when it is opened; here it is only a head start.
    for (const kind of kinds) SCRIPTS[kind]().catch(() => undefined)
  }
  if (idle && cancelIdle) {
    const handle = idle(run, { timeout: 2_000 })
    return () => cancelIdle(handle)
  }
  const handle = setTimeout(run, 500)
  return () => clearTimeout(handle)
}

/** For a home: once its own document is read, what it lists is fetched while it is idle. */
export function usePreloadViews(ready: boolean, root: ScopeSnapshot | undefined, at: ScopePath): void {
  const model = ready && root?.path === at ? root.model : undefined
  useEffect(() => (model ? preloadViewsOf(model) : undefined), [model])
}
