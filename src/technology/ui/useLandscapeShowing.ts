// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the page is showing: all of it the reader's, none of it a step. The
 * model says what is true, and this says which of it is on screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  landscapeEdges, regroupedBy, startsFolded, touchedBy,
} from '../../model/technologyLandscape'
import type {
  LandscapeApplication, LandscapeColour, LandscapeEdge, LandscapeGroup, LandscapePlatform, LandscapeService, LandscapeView, NodeKey, TechnologyLandscape,
} from '../../model/technologyLandscape'

export type LandscapeShowing = ReturnType<typeof useLandscapeShowing>

const found = (name: string, asked: string) => name.toLowerCase().includes(asked)

function narrowServices(nodes: readonly LandscapeService[], asked: string): LandscapeService[] {
  return nodes.flatMap((node) => {
    const children = narrowServices(node.children, asked)
    return found(node.name, asked) || children.length > 0 ? [{ ...node, children }] : []
  })
}

function narrowPlatforms(nodes: readonly LandscapePlatform[], asked: string): LandscapePlatform[] {
  return nodes.flatMap((node) => {
    const children = narrowPlatforms(node.children, asked)
    return found(node.name, asked) || children.length > 0 ? [{ ...node, children }] : []
  })
}

function narrowGroups(groups: readonly LandscapeGroup[], asked: string): LandscapeGroup[] {
  return groups.map((group) => ({
    ...group,
    applications: group.applications.filter((app: LandscapeApplication) => found(app.name, asked)),
  })).filter((group) => group.applications.length > 0)
}

/**
 * The rows a filter leaves. One box filters whichever column holds the word: a
 * column it finds nothing in stays whole, so asking for an application still
 * shows what it could stand on, and asking for a platform what could stand on it.
 */
export function narrowedTo(landscape: TechnologyLandscape, query: string): TechnologyLandscape {
  const asked = query.trim().toLowerCase()
  if (!asked) return landscape
  const groups = narrowGroups(landscape.groups, asked)
  const services = narrowServices(landscape.services, asked)
  const platforms = narrowPlatforms(landscape.platforms, asked)
  return {
    ...landscape,
    groups: groups.length > 0 ? groups : landscape.groups,
    services: services.length > 0 ? services : landscape.services,
    platforms: platforms.length > 0 ? platforms : landscape.platforms,
  }
}

export function useLandscapeShowing(landscape: TechnologyLandscape | undefined) {
  const [query, setQuery] = useState('')
  const [groupBy, setGroupBy] = useState<'scope' | 'category'>('scope')
  const [scopesOff, setScopesOff] = useState<ReadonlySet<string>>(new Set())
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [services, setServices] = useState(true)
  const [everyLine, setEveryLine] = useState(false)
  const [foldHosting, setFoldHosting] = useState(false)
  const [showShared, setShowShared] = useState(true)
  const [onlyTouched, setOnlyTouched] = useState(false)
  const [lens, setLens] = useState<LandscapeColour | undefined>(undefined)
  const [selected, setSelected] = useState<NodeKey | undefined>(undefined)
  const [hovered, setHovered] = useState<NodeKey | undefined>(undefined)

  const grouped = useMemo(() => (landscape ? regroupedBy(landscape, groupBy) : undefined), [landscape, groupBy])
  const shown = useMemo(() => {
    if (!grouped) return undefined
    const narrowed = narrowedTo(grouped, query)
    return groupBy === 'scope' ? { ...narrowed, groups: narrowed.groups.filter((group) => !scopesOff.has(group.key)) } : narrowed
  }, [grouped, query, scopesOff, groupBy])

  const shownCount = (shown?.groups ?? []).reduce((sum, group) => sum + group.applications.length, 0)
  // Above the threshold every group starts folded; a filter that brings the set
  // under it opens them again, and a fold by hand holds until it is crossed back.
  const wasBig = useRef<boolean | undefined>(undefined)
  useEffect(() => {
    if (!grouped) return
    const big = startsFolded(shownCount)
    if (big === wasBig.current) return
    wasBig.current = big
    setFolded(new Set(big ? grouped.groups.map((group) => group.key) : []))
  }, [grouped, shownCount])

  const view = useMemo<LandscapeView>(() => ({ services, foldHosting, folded }), [services, foldHosting, folded])
  const focus = selected ?? hovered
  const touched = useMemo(() => (grouped && focus ? touchedBy(grouped, focus, view) : undefined), [grouped, focus, view])
  const edges = useMemo<LandscapeEdge[]>(() => {
    if (!grouped) return []
    const all = landscapeEdges(grouped, view)
    if (everyLine) return all
    if (!touched) return []
    return all.filter((edge) => touched.has(edge.from) && touched.has(edge.to))
  }, [grouped, view, everyLine, touched])

  const fold = useCallback((key: string, to: boolean) => setFolded((held) => {
    const next = new Set(held)
    if (to) next.add(key)
    else next.delete(key)
    return next
  }), [])
  const toggleScope = useCallback((key: string) => setScopesOff((held) => {
    const next = new Set(held)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }), [])

  return {
    query, setQuery, groupBy, setGroupBy, scopesOff, toggleScope, folded, setFolded, fold, services, setServices,
    everyLine, setEveryLine, foldHosting, setFoldHosting, showShared, setShowShared, onlyTouched, setOnlyTouched,
    lens, setLens, selected, setSelected, hovered, setHovered, grouped, shown, shownCount, view, focus, touched, edges,
  }
}
