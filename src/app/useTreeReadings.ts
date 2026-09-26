// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the rest of the organisation says about this scope, read off the index
 * (ADR-0012 §2, §7, §9; ADR-0013; ADR-0020; ADR-0021).
 *
 * Every one of these is a derivation, memoised on the index and on what this
 * scope holds, so a page that lays itself out from one is laid out when the
 * tree is read again and not per render. Nothing here loads a scope.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { Translate } from '../i18n'
import type { DesignElement, ElementId, PlatformDescription, Relation, SharedElsewhere } from '../model'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import type { Supporter } from '../business'

export type TreeReadings = ReturnType<typeof useTreeReadings>

export function useTreeReadings(deps: {
  index: ScopeIndex
  scope: ScopePath
  elements: readonly DesignElement[]
  groupName: string
  s: Translate
}) {
  const { index, scope, elements, groupName, s } = deps
  /** What to call a scope on screen: its path, or the organisation's own name. */
  const scopeLabel = useCallback(
    (path: ScopePath) => path || groupName || s('common.organisation'),
    [groupName, s],
  )

  const { rowsElsewhere, rowsThrough, rowsElsewhereRef } = useRowsElsewhere(index, elements)

  /**
   * The initiatives of the scopes below this one (ADR-0012 §7), for the
   * roadmap to draw under its own plans. Off the index, so a domain flagging
   * a plan reaches the organisation's roadmap when the watcher next reads
   * the tree, and never costs a load per domain.
   */
  const initiativesBelow = useMemo(
    () => index.initiativesBelow(scope).map(({ scope: below, transition, elements: drawn }) => ({
      scope: below, label: scopeLabel(below), plan: transition, elements: drawn,
    })),
    [index, scope, scopeLabel],
  )

  /**
   * What the map calls a column, and whose it is (ADR-0012 §9).
   *
   * The applications supporting the organisation's capabilities are a
   * landscape's, so their names come from the index rather than from this
   * scope's model — which holds them, if at all, as stand-ins whose cache may
   * have drifted. `where` is the master's scope where that is not this one,
   * said the way the bar says it.
   */
  const describeForMap = useCallback((id: ElementId): PlatformDescription | undefined => {
    const entry = index.lookup(id)
    if (!entry) return undefined
    const { master } = entry
    return {
      name: entry.name,
      kind: entry.kind,
      ...(master !== undefined && master !== scope ? { where: scopeLabel(master) } : {}),
      // What a platform is, what it is filed under and whether it is the
      // organisation's, as its master says (ADR-0014): a stand-in here
      // carries nothing the owner answers for.
      ...(entry.platformArchetype !== undefined ? { platformArchetype: entry.platformArchetype } : {}),
      ...(entry.parentId !== undefined ? { parentId: entry.parentId } : {}),
      ...(entry.outside ? { outside: entry.outside } : {}),
    }
  }, [index, scope, scopeLabel])

  /**
   * Every offering the rest of the tree marks shared, for the landscape's
   * shared row (ADR-0020): the scope that answers for it and what realises
   * it there, off the index rather than a load per scope.
   */
  const sharedElsewhere = useMemo<SharedElsewhere[]>(
    () => index.entries()
      .filter((entry) => entry.kind === 'platformService' && entry.shared && entry.master !== undefined && entry.master !== scope)
      .map((entry) => ({
        id: entry.id, name: entry.name, where: scopeLabel(entry.master!),
        realisedBy: [...new Set(index.rowsTo(entry.id, ['realises']).map(({ relation }) => relation.sourceId))],
      })),
    [index, scope, scopeLabel],
  )

  /**
   * Every application in the organisation, for the sheet's *Supported by…*
   * (ADR-0012 §2). The register, said the way the map says a column: the
   * name, and the scope that defines it where that is not this one. Off the
   * index, so an application a landscape adds reaches the organisation's
   * sheet when the watcher next reads the tree.
   */
  const applicationsInTree = useMemo<Supporter[]>(
    () => index.register().map(({ id, name, master }) => ({
      id, name,
      ...(master !== undefined && master !== scope ? { where: scopeLabel(master) } : {}),
    })),
    [index, scope, scopeLabel],
  )

  /**
   * The observations the scopes below shared (ADR-0021), off the index like
   * the initiatives — and, the other way, which of this scope's own a scope
   * above folded into one of its own.
   */
  const sharedBelow = useMemo(() => index.observationsBelow(scope), [index, scope])
  const absorbedAbove = useMemo(() => index.absorbedFrom(scope), [index, scope])

  return {
    scopeLabel, rowsElsewhere, rowsThrough, rowsElsewhereRef, initiativesBelow, describeForMap,
    sharedElsewhere, applicationsInTree, sharedBelow, absorbedAbove,
  }
}

/** The rows other scopes wrote about what this scope holds, per function and per platform. */
function useRowsElsewhere(index: ScopeIndex, elements: readonly DesignElement[]) {
  /**
   * The `supports` and `assigned` rows the rest of the organisation wrote
   * about the functions this scope defines (ADR-0012 §2).
   *
   * What makes "2 apps" under a capability on the ORGANISATION's own sheet
   * true: the applications are in a landscape's model and the rows with them.
   * Per function this scope holds rather than the whole tree's rows, so a page
   * pays for what it draws; memoised on the index and the elements, because
   * the sheet lays itself out from it and a fresh array per render would lay
   * the page out per render.
   */
  const rowsElsewhere = useMemo(() => {
    const found: Relation[] = []
    for (const element of elements) {
      if (element.kind !== 'function') continue
      for (const row of index.rowsTo(element.id, ['supports', 'assigned'])) found.push(row.relation)
    }
    return found
  }, [index, elements])
  /**
   * The rows the rest of the organisation wrote that name a platform this
   * scope holds (ADR-0013): what runs on the shared cluster is a landscape's
   * row, and so is every interface that crosses the shared bus. Per platform
   * this scope holds, for the reason the rows above are per function.
   */
  const rowsThrough = useMemo(() => {
    const found: Relation[] = []
    for (const element of elements) {
      if (element.kind !== 'platform' && element.kind !== 'platformService') continue
      for (const row of index.rowsOf(element.id)) found.push(row.relation)
    }
    return found
  }, [index, elements])
  // By reference for the agent's findings, which are computed per call rather
  // than per render.
  const rowsElsewhereRef = useRef(rowsElsewhere)
  rowsElsewhereRef.current = rowsElsewhere
  return { rowsElsewhere, rowsThrough, rowsElsewhereRef }
}
