// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { indexScopes } from '../projects/scopeIndex'
import type { ScopeSnapshot } from '../projects/scope'
import { EXAMPLES, exampleScopes } from './testing/examples'
import { heldRepositories } from './testing/heldRepositories'
import { scopesShowing, showOnPlaces, useShowOnTechnology } from './showOnTechnology'

const example = EXAMPLES.find((one) => exampleScopes(one).some((scope) => scope.model.name === 'Shared platforms'))!
const pathOf = (name: string) => exampleScopes(example).find((scope) => scope.model.name === name)!.path
const LANDSCAPE = pathOf('Application landscape')
const PLATFORMS = pathOf('Shared platforms')

function organisation(change: (scopes: ScopeSnapshot[]) => ScopeSnapshot[] = (scopes) => scopes) {
  const scopes = change(exampleScopes(example))
  return { scopes, index: indexScopes(scopes.map((scope) => ({ path: scope.path, model: scope.model }))) }
}
const at = (scopes: readonly ScopeSnapshot[], path: string) => scopes.find((scope) => scope.path === path)!

describe('the scopes whose landscape may show an application', () => {
  it('names the scope that keeps the platform it runs on, after its own', () => {
    const { scopes, index } = organisation()
    expect(scopesShowing('billing', { scope: LANDSCAPE, model: at(scopes, LANDSCAPE).model, index })).toEqual([LANDSCAPE, PLATFORMS])
  })

  it('names the scope that answers for a stand-in, and the others that draw it', () => {
    const { scopes, index } = organisation()
    const shown = scopesShowing('billing', { scope: PLATFORMS, model: at(scopes, PLATFORMS).model, index })
    expect(shown[0]).toBe(PLATFORMS)
    expect(shown).toContain(LANDSCAPE)
  })
})

describe('the landscapes that show it', () => {
  it('is the platform scope\'s landscape for Billing, and none once it is deleted', () => {
    const { scopes, index } = organisation()
    const viewsAt = new Map(scopes.map((scope) => [scope.path, scope.model.diagrams] as const))
    const showing = scopesShowing('billing', { scope: LANDSCAPE, model: at(scopes, LANDSCAPE).model, index })
    const places = showOnPlaces(showing, LANDSCAPE, at(scopes, LANDSCAPE).model.diagrams, viewsAt)
    expect(places).toEqual([{ scope: PLATFORMS, viewId: expect.any(String), viewName: 'Technology landscape' }])
    viewsAt.set(PLATFORMS, at(scopes, PLATFORMS).model.diagrams.filter((view) => view.kind !== 'technology'))
    expect(showOnPlaces(showing, LANDSCAPE, at(scopes, LANDSCAPE).model.diagrams, viewsAt)).toEqual([])
  })

  it('is both where its own scope keeps a landscape too, its own first', () => {
    const { scopes, index } = organisation()
    const ours = [...at(scopes, LANDSCAPE).model.diagrams, { id: 'tl-ours', kind: 'technology', name: 'Ours' }]
    const viewsAt = new Map(scopes.map((scope) => [scope.path, scope.model.diagrams] as const))
    const showing = scopesShowing('billing', { scope: LANDSCAPE, model: at(scopes, LANDSCAPE).model, index })
    expect(showOnPlaces(showing, LANDSCAPE, ours, viewsAt).map((place) => [place.scope, place.viewName]))
      .toEqual([[LANDSCAPE, 'Ours'], [PLATFORMS, 'Technology landscape']])
  })
})

describe('the door', () => {
  function mount(change?: (scopes: ScopeSnapshot[]) => ScopeSnapshot[], diagrams?: { id: string; kind: string; name: string }[]) {
    const { scopes, index } = organisation(change)
    const repositories = heldRepositories(scopes)
    const openHere = vi.fn()
    const onOpenScope = vi.fn()
    const model = { ...at(scopes, LANDSCAPE).model, ...(diagrams ? { diagrams } : {}) }
    const hook = renderHook(() => useShowOnTechnology({
      scope: LANDSCAPE, model, index, scopes: repositories.scopes, scopeLabel: (path) => at(scopes, path).model.name, openHere, onOpenScope,
    }))
    return { hook, openHere, onOpenScope }
  }

  it('reads the platform scope\'s views when asked, and opens its landscape there with Billing selected', async () => {
    const { hook, onOpenScope } = mount()
    expect(hook.result.current.places('billing')).toEqual([])
    act(() => hook.result.current.want('billing'))
    await waitFor(() => expect(hook.result.current.places('billing')).toHaveLength(1))
    const [place] = hook.result.current.places('billing')
    expect(place.view).toBe('Technology landscape')
    expect(place.scope).toBeTruthy()
    act(() => hook.result.current.open('billing', place.key))
    expect(onOpenScope).toHaveBeenCalledWith(PLATFORMS, { page: 'technology', id: expect.any(String), select: 'billing' })
  })

  it('offers nothing where the platform scope\'s landscape was deleted', async () => {
    const { hook } = mount((scopes) => scopes.map((scope) => (scope.path === PLATFORMS
      ? { ...scope, model: { ...scope.model, diagrams: scope.model.diagrams.filter((view) => view.kind !== 'technology') } }
      : scope)))
    act(() => hook.result.current.want('billing'))
    await act(async () => { await new Promise((done) => setTimeout(done, 20)) })
    expect(hook.result.current.places('billing')).toEqual([])
  })

  it('offers both landscapes where two show it, and opens the open scope\'s own in place', async () => {
    const { hook, openHere, onOpenScope } = mount(undefined, [{ id: 'tl-ours', kind: 'technology', name: 'Ours' }])
    act(() => hook.result.current.want('billing'))
    await waitFor(() => expect(hook.result.current.places('billing')).toHaveLength(2))
    const [ours, theirs] = hook.result.current.places('billing')
    expect([ours.scope, theirs.scope]).toEqual(['Application landscape', 'Shared platforms'])
    act(() => hook.result.current.open('billing', ours.key))
    expect(openHere).toHaveBeenCalledWith('billing', 'tl-ours')
    expect(onOpenScope).not.toHaveBeenCalled()
  })
})
