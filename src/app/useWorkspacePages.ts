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
import type { ObservationTab, ScreenPage } from '../agent/screen'
import type { ScopePath } from '../projects/scopePath'
import type { MakeId } from './useDiagramActions'
import type { Drawings } from './useDrawing'
import type { Maps } from './useMap'
import type { ModelSession } from './useModelSession'
import { usePlans } from './usePlans'
import type { Plans } from './usePlans'
import { usePlatformReport } from './usePlatformReport'
import type { PlatformReading } from './usePlatformReport'
import type { TechnologyLandscapes } from './useTechnologyLandscape'
import { useDrawing } from './useDrawing'
import { useChartChoice } from './units/useChartChoice'
import { useUnitViews } from './units/useUnitViews'
import type { UnitViewKind, UnitViews } from './units/useUnitViews'
import { useViewSelect } from './useViewSelect'

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
  /** The element whose documentation page is up over the board, where one is (`useWorkspaceRequests`). */
  documentationShown?: string | undefined
}) {
  const { session, scope, makeId, s, viewing, focusElement, maps, landscapes, onGoHome, documentationShown } = deps
  // A platform's page (ADR-0013): read only, so it needs nobody's actions.
  const platformReading = usePlatformReport()
  const records = useRecordPages()
  const operating = useOperatingPage()
  const { showDecision } = records
  const plans = usePlans({
    session, makeId, s, viewing,
    navigate: useMemo(() => ({ toElement: focusElement, toDecision: showDecision }), [focusElement, showDecision]),
  })
  const drawings = useDrawing({ session, makeId, s })
  const unitViews = useUnitViews({ session, makeId, s })
  /** The assignment chosen on an organisation chart, which the inspector beside it shows (ADR-0036 §7). */
  const chartChoice = useChartChoice()
  const openers = usePageOpeners({ session, records, plans, platformReading, maps, landscapes, drawings, unitViews, operating })
  /** An element selected on a view as it is opened, where the view draws it (ADR-0019, amended). */
  const viewSelect = useViewSelect({ session, focusElement, landscapes })

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

  const { adrPage, obsPage, adrShown, obsShown } = records
  /**
   * Which page is up over the canvas, as the agent is told it; nothing is the
   * view itself. A record page names the record it shows, which the person
   * may have moved off the one asked for — once it has landed on the latest
   * request; until then, the one asked for.
   */
  const page = useCallback((): ScreenPage | undefined => {
    // The record's page over the board (ADR-0033): a place of its own, so
    // its address names it and Back leaves it. Never up beside another page:
    // opening one closes it, and it closes them (`showOn`).
    if (documentationShown !== undefined) return { page: 'document', id: documentationShown }
    if (adrPage.open) return withId('decisions', adrShown?.nonce === adrPage.nonce ? adrShown.id : adrPage.adrId)
    if (obsPage.open) return observationsPage(obsPage, obsShown)
    if (plans.planId !== undefined) return { page: 'plan', id: plans.planId }
    if (plans.roadmapOpen) return { page: 'roadmap' }
    if (operating.page.open) return withOperatingId(operating.page.id)
    if (platformReading.platformId !== undefined) return { page: 'platform', id: platformReading.platformId }
    if (platformReading.serviceId !== undefined) return { page: 'service', id: platformReading.serviceId }
    return undefined
  }, [documentationShown, adrPage, obsPage, adrShown, obsShown, plans.planId, plans.roadmapOpen, operating.page, platformReading.platformId, platformReading.serviceId])
  /** Has the record page that is up — the same one `page` names — said what it landed on for the latest request? */
  const settled = useCallback((): boolean => {
    if (adrPage.open) return adrShown?.nonce === adrPage.nonce
    if (obsPage.open) return obsShown?.nonce === obsPage.nonce
    return true
  }, [adrPage, obsPage, adrShown, obsShown])

  return {
    adrPage, obsPage, plans, platformReading, page, settled, leaveIfNothingToDraw, chartChoice,
    operatingPage: operating.page, closeOperating: operating.close,
    selectOn: viewSelect.select, selectRequestFor: viewSelect.requestFor,
    decisionShown: records.decisionShown, observationShown: records.observationShown,
    closeDecisions: records.closeRecords, closeObservations: records.closeObservations, ...openers,
  }
}

/** The operating model's page as the screen says it: on the item it was asked for, where one was. */
function withOperatingId(id: string | undefined): ScreenPage {
  return { page: 'operating', ...(id !== undefined ? { id } : {}) }
}

/**
 * The operating model's page (ADR-0036): up or not, and the item it was asked
 * to open on, with the request's number, as a record page's request carries.
 */
function useOperatingPage() {
  const [page, setPage] = useState<{ open: boolean; id?: string; nonce: number }>({ open: false, nonce: 0 })
  const show = useCallback((id?: string) => {
    setPage((was) => ({ open: true, ...(id !== undefined ? { id } : {}), nonce: was.nonce + 1 }))
  }, [])
  const close = useCallback(() => setPage((was) => ({ open: false, nonce: was.nonce })), [])
  return { page, show, close }
}

function withId(page: 'decisions' | 'observations', id: string | undefined): ScreenPage {
  return { page, ...(id !== undefined ? { id } : {}) }
}

/**
 * The observations page as the screen says it: the record and the tab the
 * page says it shows once it has landed on the latest request, and until
 * then the ones asked for — a tab nobody asked for is said once the page
 * says which is up.
 */
function observationsPage(
  asked: { id?: string; tab?: ObservationTab; nonce: number }, shown: Shown | undefined,
): ScreenPage {
  const landed = shown?.nonce === asked.nonce
  const tab = landed ? shown.tab : asked.tab
  return { ...withId('observations', landed ? shown.id : asked.id), ...(tab !== undefined ? { tab } : {}) }
}

/**
 * A record page's request carries a number of its own, as `FocusRequest`
 * does: asking for the record asked for last time is a new request after
 * the person has moved off it, and the page honours each number once. What
 * the page says it shows (`id` absent: nothing selected) carries the number
 * of the request it has landed on, so a word from before the landing — the
 * last opening's record, a render ahead of the new one — is not taken for
 * the answer.
 */
type Shown = { id?: string; nonce: number | undefined; tab?: ObservationTab }
const shownAs = (id: string | undefined, nonce: number | undefined, tab?: ObservationTab): Shown => (
  { ...(id !== undefined ? { id } : {}), nonce, ...(tab !== undefined ? { tab } : {}) }
)

/** The decisions page and the observations page: which is up, on what, and what each shows. */
function useRecordPages() {
  const [adrPage, setAdrPage] = useState<{ open: boolean; adrId?: string; nonce: number }>({ open: false, nonce: 0 })
  /** The observations page (ADR-0021), on one observation or cause when an id is given, on a tab when one is. */
  const [obsPage, setObsPage] = useState<{ open: boolean; id?: string; tab?: ObservationTab; nonce: number }>({ open: false, nonce: 0 })
  const [adrShown, setAdrShown] = useState<Shown | undefined>(undefined)
  const [obsShown, setObsShown] = useState<Shown | undefined>(undefined)
  const showDecision = useCallback((adrId?: string) => {
    setAdrPage((was) => ({ open: true, ...(adrId !== undefined ? { adrId } : {}), nonce: was.nonce + 1 }))
  }, [])
  const showObservations = useCallback((id?: string, tab?: ObservationTab) => {
    setAdrPage((was) => ({ open: false, nonce: was.nonce }))
    setObsPage((was) => ({ open: true, ...(id !== undefined ? { id } : {}), ...(tab !== undefined ? { tab } : {}), nonce: was.nonce + 1 }))
  }, [])
  const decisionShown = useCallback((id: string | undefined, nonce: number | undefined) => setAdrShown(shownAs(id, nonce)), [])
  const observationShown = useCallback(
    (id: string | undefined, nonce: number | undefined, tab?: ObservationTab) => setObsShown(shownAs(id, nonce, tab)), [],
  )
  /** Both shut: the decisions page closes the observations page it may have been opened over. */
  const closeRecords = useCallback(() => {
    setAdrPage((was) => ({ open: false, nonce: was.nonce }))
    setObsPage((was) => ({ open: false, nonce: was.nonce }))
  }, [])
  const closeObservations = useCallback(() => setObsPage((was) => ({ open: false, nonce: was.nonce })), [])
  return {
    adrPage, obsPage, adrShown, obsShown, showDecision, showObservations, decisionShown, observationShown,
    closeRecords, closeObservations,
  }
}

/** Every way onto a page or a view, each closing the pages it replaces. */
function usePageOpeners(deps: {
  session: ModelSession
  records: ReturnType<typeof useRecordPages>
  plans: Plans
  platformReading: PlatformReading
  maps: Maps
  landscapes: TechnologyLandscapes
  drawings: Drawings
  unitViews: UnitViews
  operating: ReturnType<typeof useOperatingPage>
}) {
  const { session, maps, landscapes, drawings, unitViews } = deps
  const { show: showOperating, close: closeOperating } = deps.operating
  const { showDecision, showObservations, closeRecords, closeObservations } = deps.records
  const { closeAll: closePlans, openRoadmap: showRoadmap } = deps.plans
  const { close: closeReport, open: showPlatform, openService: showService } = deps.platformReading
  // The toolbar's pages are one at a time, and the sheet and the map are two of them.
  const openDecisions = useCallback((adrId?: string) => {
    closePlans()
    closeReport()
    closeObservations()
    closeOperating()
    showDecision(adrId)
  }, [closePlans, closeReport, closeObservations, closeOperating, showDecision])
  /** The observations page (ADR-0021): the same one-at-a-time rule; on a tab where one is named. */
  const openObservations = useCallback((id?: string, tab?: ObservationTab) => {
    closePlans()
    closeReport()
    closeOperating()
    showObservations(id, tab)
  }, [closePlans, closeReport, closeOperating, showObservations])
  const openRoadmap = useCallback(() => {
    closeRecords()
    closeReport()
    closeOperating()
    showRoadmap()
  }, [closeRecords, closeReport, closeOperating, showRoadmap])
  /** The operating model's page (ADR-0036), the same one-at-a-time rule; on an item where one is named. */
  const openOperating = useCallback((id?: string) => {
    closeRecords()
    closePlans()
    closeReport()
    showOperating(id)
  }, [closeRecords, closePlans, closeReport, showOperating])
  /** Every page beside the canvas shut, so the tab shows: what opening a view does first. */
  const closePages = useCallback(() => {
    closeRecords()
    closePlans()
    closeReport()
    closeOperating()
  }, [closeRecords, closePlans, closeReport, closeOperating])
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
  const createDrawing = useCallback(() => { closePages(); drawings.create() }, [closePages, drawings.create])
  /** An organisation chart or a Conway map (ADR-0036 §7), made the map's way. */
  const createUnitView = useCallback((kind: UnitViewKind) => { closePages(); unitViews.create(kind) }, [closePages, unitViews.create])
  /** A drawing anchored to an element: the menu and the inspector, one command. */
  const createDrawingFor = useCallback((elementId: string) => {
    closePages()
    drawings.createFor(elementId)
  }, [closePages, drawings.createFor])
  /**
   * A platform's report (ADR-0013, redone): reached from the platform's own
   * card and from the finding that names it, and never created — every mark on
   * it is derived from the rows, so opening it is the whole of making it.
   */
  const openServiceReport = useCallback((serviceId: string) => {
    closeRecords()
    closePlans()
    closeOperating()
    showService(serviceId)
  }, [closeRecords, closePlans, closeOperating, showService])
  const openPlatformReport = useCallback((platformId: string) => {
    closePlans()
    closeOperating()
    showPlatform(platformId)
  }, [closePlans, closeOperating, showPlatform])
  return {
    openDecisions, openObservations, openRoadmap, openOperating, closePages, openView, createMap,
    openTechnology, openTechnologyFor, createTechnology, createDrawing, createDrawingFor, createUnitView, openServiceReport, openPlatformReport,
  }
}
