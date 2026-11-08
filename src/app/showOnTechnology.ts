// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a record's *Show on technology landscape ›* goes (ADR-0020;
 * ADR-0019, amended): to every technology landscape that shows the
 * application, in whichever scope keeps it, and nowhere while none does.
 *
 * A landscape shows its own scope's applications and every application a
 * row connects to a service or a platform it holds (`model/technologyLandscape`).
 * So the scopes that may show one are said by the index, with no read of
 * the tree: the scope open, the scope that answers for the application and
 * the scopes that draw a stand-in of it, and the scopes that keep what it
 * runs on and uses. The index holds no views (`ports/OrganisationIndex`),
 * so those few scopes are read for theirs — one read per scope, kept until
 * the source answers again, as the owners' descriptions are
 * (`useOwnerDescriptions`). The open scope's own views are its session's,
 * so a landscape deleted here takes its door with it at once.
 *
 * An open never makes a view: a door is drawn only while a view is there,
 * and pressing it opens that scope and view with the application selected.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hostingOf } from '../model/hosting'
import type { DesignElement, ElementId, Relation } from '../model/types'
import type { ShowOnDoor } from '../editor/props'
import { readScopes } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage } from './App'

/** A view as a scope holds it: what a door needs of it. */
export type HeldView = { id: string; kind: string; name: string }

/** One landscape that shows the element. */
export type ShowOnPlace = { scope: ScopePath; viewId: string; viewName: string }

type Rows = { elements: readonly DesignElement[]; relations: readonly Relation[] }

/**
 * The scopes whose technology landscape may show this element, the open one
 * first and the rest in path order. Off the index and the open scope's own
 * rows; nothing is read.
 */
export function scopesShowing(elementId: ElementId, at: { scope: ScopePath; model: Rows; index: ScopeIndex }): ScopePath[] {
  const { scope, model, index } = at
  const found = new Set<ScopePath>()
  const entry = index.lookup(elementId)
  if (entry?.master !== undefined) found.add(entry.master)
  for (const drawing of entry?.drawnIn ?? []) found.add(drawing)
  // What it runs on and uses: this scope's rows, and the rows the rest of the
  // tree keeps of it — a stand-in's are its master's.
  const rows: Rows = {
    elements: model.elements,
    relations: [...model.relations, ...index.rowsOf(elementId).filter((row) => row.scope !== scope).map((row) => row.relation)],
  }
  const held = new Set(model.elements.map((element) => element.id))
  const standsOn = [
    ...hostingOf(rows, elementId).platformIds,
    ...rows.relations.filter((row) => row.type === 'uses' && row.sourceId === elementId).map((row) => row.targetId),
  ]
  for (const id of standsOn) {
    const keeper = index.lookup(id)?.master ?? (held.has(id) ? scope : undefined)
    if (keeper !== undefined) found.add(keeper)
  }
  found.delete(scope)
  return [scope, ...[...found].sort()]
}

/** The technology landscapes of those scopes, as far as their views are known. */
export function showOnPlaces(
  scopes: readonly ScopePath[], here: ScopePath, hereViews: readonly HeldView[], viewsAt: ReadonlyMap<ScopePath, readonly HeldView[]>,
): ShowOnPlace[] {
  return scopes.flatMap((path) => (path === here ? hereViews : viewsAt.get(path) ?? [])
    .filter((view) => view.kind === 'technology')
    .map((view) => ({ scope: path, viewId: view.id, viewName: view.name })))
}

const keyOf = (place: ShowOnPlace) => JSON.stringify([place.scope, place.viewId])

export function useShowOnTechnology(deps: {
  scope: ScopePath
  model: Rows & { diagrams: readonly HeldView[] }
  index: ScopeIndex
  /** How many answers the index's source has given (`IndexHook.answered`): each is a reason to read the views again. */
  answered?: number
  /** Where another scope's views are read; absent, only the open scope's landscapes are offered. */
  scopes?: ScopeReader
  scopeLabel: (path: ScopePath) => string
  /** Open a landscape of the open scope with the application selected. */
  openHere: (elementId: ElementId, viewId: string) => void
  /** Open another scope on a page; absent, only the open scope's landscapes are offered. */
  onOpenScope?: (path: ScopePath, page?: InitialPage) => void
}): ShowOnDoor {
  const { scope, model, index, answered, scopes, scopeLabel, openHere, onOpenScope } = deps
  const [viewsAt, setViewsAt] = useState<ReadonlyMap<ScopePath, readonly HeldView[]>>(() => new Map())
  const asked = useRef(new Set<ScopePath>())
  const generation = useRef(0)

  // A tree that answered again may have lost or gained a landscape anywhere: read again what is asked next.
  useEffect(() => {
    generation.current += 1
    asked.current = new Set()
    setViewsAt(new Map())
  }, [index, answered, scopes])

  const elsewhere = Boolean(scopes && onOpenScope)
  const showing = useCallback(
    (elementId: ElementId) => (elsewhere ? scopesShowing(elementId, { scope, model, index }) : [scope]),
    [elsewhere, scope, model, index],
  )

  const want = useCallback((elementId: ElementId) => {
    if (!scopes) return
    const missing = showing(elementId).filter((path) => path !== scope && !asked.current.has(path))
    if (missing.length === 0) return
    for (const path of missing) asked.current.add(path)
    const at = generation.current
    void readScopes(scopes, missing).then(
      (read) => read.map((held) => held?.model.diagrams.map(({ id, kind, name }) => ({ id, kind, name })) ?? []),
      // A scope that will not read shows nothing here; the door is the views that are known.
      () => missing.map(() => []),
    ).then((views) => {
      if (at !== generation.current) return
      setViewsAt((was) => new Map([...was, ...missing.map((path, i) => [path, views[i]] as const)]))
    })
  }, [scopes, showing, scope])

  return useMemo<ShowOnDoor>(() => {
    const placesOf = (elementId: ElementId) => showOnPlaces(showing(elementId), scope, model.diagrams, viewsAt)
    return {
      want,
      places: (elementId) => placesOf(elementId).map((place) => ({
        key: keyOf(place), view: place.viewName, scope: scopeLabel(place.scope),
      })),
      open: (elementId, key) => {
        const place = placesOf(elementId).find((one) => keyOf(one) === key)
        if (!place) return
        if (place.scope === scope) openHere(elementId, place.viewId)
        else onOpenScope?.(place.scope, { page: 'technology', id: place.viewId, select: elementId })
      },
    }
  }, [want, showing, scope, model.diagrams, viewsAt, scopeLabel, openHere, onOpenScope])
}
