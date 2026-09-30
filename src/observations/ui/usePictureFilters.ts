// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The filters, the scopes in view and how the picture is looked at, for the
 * observations page (ADR-0032 §2, §8): one hook, so the page renders and this
 * decides.
 *
 * **View local** starts on where the scope has scopes below, and the scopes
 * in view are then this one and every one below it; off, this one alone, and
 * the records left out are counted. The filters run over the scopes in view
 * (`filter.ts`), and what they leave is what the Register lists, the picture
 * draws and the Solutions tab lays out.
 *
 * **Saved filters** are the person's, handed in from the shell and written
 * back through it; a saved filter names its scopes by path, and one no longer
 * in view is left out when it is put back on.
 *
 * **Size and zoom** belong to the look, not the record. The picture starts
 * fitted, and fits again whenever what it draws changes — a filter, the size,
 * the scopes — until the person zooms, which holds the zoom they chose.
 */
import { useCallback, useMemo, useState } from 'react'
import { NO_FILTERS, activeFilters, applyFilters, filterRecords, recallFilter, saveFilter } from '../filter'
import type { FilterResult, Filters, SavedFilter, SavedFilters } from '../filter'
import { pictureLinks } from '../graph'
import { nodeKey } from '../graph'
import type { PictureSize } from '../graph'
import type { ObservationBelow, ScopeAnalysis } from '../observation'
import type { Translate } from '../../i18n'

/** How the picture is looked at: the size of its marks, the zoom, and whether the zoom is the fitted one. */
export type PictureView = {
  size: PictureSize
  zoom: number
  fit: boolean
  setSize: (size: PictureSize) => void
  /** Back to the fitted zoom. */
  fitNow: () => void
  /** What fitting came to, from the picture that measured its window. */
  fitted: (zoom: number) => void
  /** A zoom the person chose, which holds until they fit again. */
  zoomTo: (zoom: number) => void
}

export const ZOOM = { min: 0.3, max: 2, step: 0.1 } as const

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(zoom * 100) / 100))
}

export type PictureFilters = {
  filters: Filters
  setFilters: (next: Filters) => void
  clear: () => void
  /** Whether the filter row is shown. */
  rowOpen: boolean
  toggleRow: () => void
  /** How many filters are on, for the count on *Filters*. */
  active: number
  result: FilterResult
  /** The scopes in view: this one first, then those below while View local is on. */
  inView: readonly ScopeAnalysis[]
  hasBelow: boolean
  viewLocal: boolean
  setViewLocal: (on: boolean) => void
  /** The records of the scopes below left out while View local is off. */
  hiddenLocal: number
  saved: {
    list: readonly SavedFilter[]
    save: (name: string) => void
    recall: (one: SavedFilter) => void
    remove: (name: string) => void
  }
  view: PictureView
  /** Left by the filters: everything, while none is on. */
  shows: (key: string) => boolean
  /** What a scope is called on the page, this one included. */
  labelOf: (path: string) => string
  /** The heading over this scope's lanes while there are boundaries beside them. */
  hereLabel: (s: Translate) => string
  /** The register's rows below, each scope's filtered, and none while View local is off. */
  rowsBelow: (groups: readonly (readonly [string, readonly ObservationBelow[]])[]) => (readonly [string, ObservationBelow[]])[]
}

/** The records a scope holds that the picture and the register count: its observations, causes and solutions. */
function recordsIn(one: ScopeAnalysis): number {
  return one.observations.filter((held) => !held.archived).length + one.causes.length
    + one.solutions.filter((held) => held.state !== 'dropped').length
}

export function usePictureFilters(deps: {
  here: ScopeAnalysis
  below: readonly ScopeAnalysis[]
  saved?: SavedFilters
  /** This scope's name, for its own label. */
  name: string
  scopeLabel: (path: string) => string
}): PictureFilters {
  const { here, below, saved, name, scopeLabel } = deps
  const hasBelow = below.length > 0
  const [localWanted, setLocalWanted] = useState(true)
  const viewLocal = hasBelow && localWanted
  const [filters, setFiltersRaw] = useState<Filters>(NO_FILTERS)
  const [rowOpen, setRowOpen] = useState(true)
  const [size, setSizeRaw] = useState<PictureSize>('large')
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState(true)

  const inView = useMemo(() => (viewLocal ? [here, ...below] : [here]), [viewLocal, here, below])
  const paths = useMemo(() => inView.map((one) => one.scope), [inView])
  const records = useMemo(() => filterRecords(inView, here.scope), [inView, here.scope])
  const links = useMemo(() => pictureLinks(inView, here.scope), [inView, here.scope])
  const result = useMemo(() => applyFilters(records, links, filters), [records, links, filters])
  const hiddenLocal = useMemo(() => (viewLocal ? 0 : below.reduce((sum, one) => sum + recordsIn(one), 0)), [viewLocal, below])

  const setFilters = useCallback((next: Filters) => { setFiltersRaw(next); setFit(true) }, [])
  const clear = useCallback(() => setFilters(NO_FILTERS), [setFilters])
  const setViewLocal = useCallback((on: boolean) => { setLocalWanted(on); setFit(true) }, [])
  const view = useMemo<PictureView>(() => ({
    size, zoom, fit,
    setSize: (next) => { setSizeRaw(next); setFit(true) },
    fitNow: () => setFit(true),
    fitted: (next) => setZoom(clampZoom(next)),
    zoomTo: (next) => { setFit(false); setZoom(clampZoom(next)) },
  }), [size, zoom, fit])

  const list = useMemo(() => saved?.list ?? [], [saved])
  const savedApi = useMemo(() => ({
    list,
    save: (name: string) => saved?.onChange(saveFilter(list, name, filters)),
    recall: (one: SavedFilter) => { setFilters(recallFilter(one, paths)); setRowOpen(true) },
    remove: (name: string) => saved?.onChange(list.filter((one) => one.name !== name)),
  }), [list, saved, filters, paths, setFilters])

  const shows = (key: string) => !result.filtering || result.visible.has(key)
  return {
    filters, setFilters, clear, rowOpen, toggleRow: () => setRowOpen((open) => !open),
    active: activeFilters(filters, paths), result, inView, hasBelow, viewLocal, setViewLocal, hiddenLocal,
    saved: savedApi, view, shows,
    labelOf: (path) => (path === here.scope ? name : scopeLabel(path)),
    hereLabel: (s) => (here.scope === '' ? s('observation.pictureGlobal') : s('observation.pictureThisScope', { scope: name })),
    rowsBelow: (groups) => (viewLocal
      ? groups.map(([scope, held]) => [scope, held.filter((one) => shows(nodeKey(one.observation.id, one.scope)))] as const)
      : []),
  }
}
