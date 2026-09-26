// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pages beside the canvas, and the rule that holds them: one at a time.
 *
 * The toolbar's pages — the decisions, the observations, the roadmap and a
 * plan on it, a platform's report and a service's — are tabs rather than a
 * stack: opening one closes the others, and opening a view on its tab closes
 * them all. Which one is up is also what the agent is told when it asks where
 * the app stands (ADR-0019).
 */
import { useCallback, useMemo, useState } from 'react'
import type { Translate } from '../i18n'
import type { ShownDays } from '../editor'
import type { ScreenPage } from '../agent/screen'
import type { ScopePath } from '../projects/scopePath'
import type { MakeId } from './useDiagramActions'
import type { Maps } from './useMap'
import type { ModelSession } from './useModelSession'
import { usePlans } from './usePlans'
import type { Plans } from './usePlans'
import { usePlatformReport } from './usePlatformReport'
import type { PlatformReading } from './usePlatformReport'
import type { TechnologyLandscapes } from './useTechnologyLandscape'

export type WorkspacePages = ReturnType<typeof useWorkspacePages>

export function useWorkspacePages(deps: {
  session: ModelSession
  scope: ScopePath
  makeId: MakeId
  s: Translate
  viewing: ShownDays
  focusElement: (id: string) => void
  maps: Maps
  landscapes: TechnologyLandscapes
  onGoHome: (path: ScopePath) => void
}) {
  const { session, scope, makeId, s, viewing, focusElement, maps, landscapes, onGoHome } = deps
  // A platform's page (ADR-0013): read only, so it needs nobody's actions.
  const platformReading = usePlatformReport()
  const records = useRecordPages()
  const { showDecision } = records
  const plans = usePlans({
    session, makeId, s, viewing,
    navigate: useMemo(() => ({ toElement: focusElement, toDecision: showDecision }), [focusElement, showDecision]),
  })
  const openers = usePageOpeners({ session, records, plans, platformReading, maps, landscapes })

  /**
   * A scope that draws nothing has nowhere to go when the page closes.
   *
   * The canvas would show "diagram not found", which is true and useless: this
   * scope was opened FOR its decisions or its roadmap, and closing them means
   * going back to where they were opened from. A scope with a board closes its
   * pages onto that board, as it always has.
   */
  const drawsNothing = session.model.diagrams.length === 0
  const leaveIfNothingToDraw = useCallback(
    () => { if (drawsNothing) onGoHome(scope) },
    [drawsNothing, onGoHome, scope],
  )

  const { adrPage, obsPage } = records
  /** Which page is up over the canvas, as the agent is told it; nothing is the view itself. */
  const page = useCallback((): ScreenPage | undefined => {
    if (adrPage.open) return { page: 'decisions', ...(adrPage.adrId !== undefined ? { id: adrPage.adrId } : {}) }
    if (obsPage.open) return { page: 'observations', ...(obsPage.id !== undefined ? { id: obsPage.id } : {}) }
    if (plans.planId !== undefined) return { page: 'plan', id: plans.planId }
    if (plans.roadmapOpen) return { page: 'roadmap' }
    if (platformReading.platformId !== undefined) return { page: 'platform', id: platformReading.platformId }
    if (platformReading.serviceId !== undefined) return { page: 'service', id: platformReading.serviceId }
    return undefined
  }, [adrPage, obsPage, plans.planId, plans.roadmapOpen, platformReading.platformId, platformReading.serviceId])

  return {
    adrPage, obsPage, plans, platformReading, page, leaveIfNothingToDraw,
    closeDecisions: records.closeRecords, closeObservations: records.closeObservations, ...openers,
  }
}

/** The decisions page and the observations page: which is up, and on what. */
function useRecordPages() {
  const [adrPage, setAdrPage] = useState<{ open: boolean; adrId?: string }>({ open: false })
  /** The observations page (ADR-0021), on one observation or cause when an id is given. */
  const [obsPage, setObsPage] = useState<{ open: boolean; id?: string }>({ open: false })
  const showDecision = useCallback((adrId?: string) => setAdrPage({ open: true, adrId }), [])
  const showObservations = useCallback((id?: string) => {
    setAdrPage({ open: false })
    setObsPage({ open: true, ...(id !== undefined ? { id } : {}) })
  }, [])
  /** Both shut: the decisions page closes the observations page it may have been opened over. */
  const closeRecords = useCallback(() => { setAdrPage({ open: false }); setObsPage({ open: false }) }, [])
  const closeObservations = useCallback(() => setObsPage({ open: false }), [])
  return { adrPage, obsPage, showDecision, showObservations, closeRecords, closeObservations }
}

/** Every way onto a page or a view, each closing the pages it replaces. */
function usePageOpeners(deps: {
  session: ModelSession
  records: ReturnType<typeof useRecordPages>
  plans: Plans
  platformReading: PlatformReading
  maps: Maps
  landscapes: TechnologyLandscapes
}) {
  const { session, maps, landscapes } = deps
  const { showDecision, showObservations, closeRecords, closeObservations } = deps.records
  const { closeAll: closePlans, openRoadmap: showRoadmap } = deps.plans
  const { close: closeReport, open: showPlatform, openService: showService } = deps.platformReading
  // The toolbar's pages are one at a time, and the sheet and the map are two of them.
  const openDecisions = useCallback((adrId?: string) => {
    closePlans()
    closeReport()
    closeObservations()
    showDecision(adrId)
  }, [closePlans, closeReport, closeObservations, showDecision])
  /** The observations page (ADR-0021): the same one-at-a-time rule. */
  const openObservations = useCallback((id?: string) => {
    closePlans()
    closeReport()
    showObservations(id)
  }, [closePlans, closeReport, showObservations])
  const openRoadmap = useCallback(() => {
    closeRecords()
    closeReport()
    showRoadmap()
  }, [closeRecords, closeReport, showRoadmap])
  /** Every page beside the canvas shut, so the tab shows: what opening a view does first. */
  const closePages = useCallback(() => {
    closeRecords()
    closePlans()
    closeReport()
  }, [closeRecords, closePlans, closeReport])
  /** A view on its tab, whichever kind: a board, a sheet, a map or a landscape (ADR-0016). */
  const openView = useCallback((id: string) => {
    closePages()
    session.setActiveDiagramId(id)
  }, [closePages, session])
  const createMap = useCallback(() => { closePages(); maps.create() }, [closePages, maps.create])
  /** The technology landscape (ADR-0015): the third laid-out page, opened and made the map's way. */
  const openTechnology = useCallback((id: string) => { closePages(); landscapes.open(id) }, [closePages, landscapes.open])
  /** The door from a record (ADR-0020): the scope's landscape, on that application. */
  const openTechnologyFor = useCallback(
    (elementId: string) => { closePages(); landscapes.showOn(elementId) },
    [closePages, landscapes.showOn],
  )
  const createTechnology = useCallback(() => { closePages(); landscapes.create() }, [closePages, landscapes.create])
  /**
   * A platform's report (ADR-0013, redone): reached from the platform's own
   * card and from the finding that names it, and never created — every mark on
   * it is derived from the rows, so opening it is the whole of making it.
   */
  const openServiceReport = useCallback((serviceId: string) => {
    closeRecords()
    closePlans()
    showService(serviceId)
  }, [closeRecords, closePlans, showService])
  const openPlatformReport = useCallback((platformId: string) => {
    closePlans()
    showPlatform(platformId)
  }, [closePlans, showPlatform])
  return {
    openDecisions, openObservations, openRoadmap, closePages, openView, createMap,
    openTechnology, openTechnologyFor, createTechnology, openServiceReport, openPlatformReport,
  }
}
