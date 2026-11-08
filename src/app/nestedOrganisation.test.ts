// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Every address one scope builds to another, with the example as the
 * organisation and with the example kept under one (`copyExampleInto`): the
 * same tree one level down must be answered one level down. Each door here
 * reads its address off the index or a carried `ref`, never off the example
 * as it ships, and a path said relative to the root would land in the
 * organisation the example was kept under.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { copyExampleInto } from '../projects/examples/copy'
import type { ScopeSnapshot, ScopeSummary } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import { isWithinScope, joinScopePath, ROOT_SCOPE } from '../projects/scopePath'
import { searchAll, treeSources } from '../search/search'
import { EXAMPLES } from './testing/examples'
import { heldRepositories } from './testing/heldRepositories'
import { scopesShowing, useShowOnTechnology } from './showOnTechnology'

const example = EXAMPLES[0]
const summary = (over: Partial<ScopeSummary> = {}): ScopeSummary => ({ path: ROOT_SCOPE, name: '', diagrams: 0, children: [], ...over })

/** The organisation a person named before keeping the example under it: a name, and nothing else yet. */
const asItsRoot = copyExampleInto(example, summary())[0]
const mine: ScopeSnapshot = { ...asItsRoot, model: { ...asItsRoot.model, name: 'Mine', elements: [], relations: [], diagrams: [] } }

const ARRANGEMENTS = [
  { name: 'as the organisation', base: ROOT_SCOPE, scopes: () => copyExampleInto(example, summary()) },
  { name: 'kept under another organisation', base: 'acme-logistics', scopes: () => [mine, ...copyExampleInto(example, summary({ name: 'Mine' }))] },
]

describe.each(ARRANGEMENTS)('the example $name', ({ base, scopes: arrange }) => {
  const scopes = arrange()
  const index = indexScopes(scopes.map((scope) => ({ path: scope.path, model: scope.model })))
  const at = (path: string) => scopes.find((scope) => scope.path === path)!
  const LANDSCAPE = joinScopePath(base, 'application-landscape')
  const PLATFORMS = joinScopePath(base, 'platforms')
  const technologyOf = (path: string) => at(path).model.diagrams.find((view) => view.kind === 'technology')!

  it('is read where it was kept', () => {
    expect(at(LANDSCAPE).model.name).toBe('Application landscape')
    expect(at(PLATFORMS).model.name).toBe('Shared platforms')
  })

  it('opens Billing on the platform scope\'s technology landscape, at its path under the organisation', async () => {
    expect(scopesShowing('billing', { scope: LANDSCAPE, model: at(LANDSCAPE).model, index })).toEqual([LANDSCAPE, PLATFORMS])
    const { scopes: reader } = heldRepositories(scopes)
    const openHere = vi.fn()
    const onOpenScope = vi.fn()
    const hook = renderHook(() => useShowOnTechnology({
      scope: LANDSCAPE, model: at(LANDSCAPE).model, index, scopes: reader, scopeLabel: (path) => at(path).model.name, openHere, onOpenScope,
    }))
    act(() => hook.result.current.want('billing'))
    await waitFor(() => expect(hook.result.current.places('billing')).toHaveLength(1))
    const [place] = hook.result.current.places('billing')
    expect(place.scope).toBe('Shared platforms')
    act(() => hook.result.current.open('billing', place.key))
    expect(onOpenScope).toHaveBeenCalledWith(PLATFORMS, { page: 'technology', id: technologyOf(PLATFORMS).id, select: 'billing' })
    expect(openHere).not.toHaveBeenCalled()
  })

  it('opens the platform scope\'s own landscape in place from there', () => {
    expect(scopesShowing('billing', { scope: PLATFORMS, model: at(PLATFORMS).model, index })[0]).toBe(PLATFORMS)
  })

  it('says every stand-in is kept where its master is, within the example', () => {
    for (const scope of scopes) {
      for (const element of scope.model.elements.filter((one) => one.ref !== undefined)) {
        const entry = index.lookup(element.id)
        expect(entry?.master, `${scope.path} draws ${element.id}`).toBeDefined()
        expect(isWithinScope(entry!.master!, base), `${element.id} is kept at ${entry!.master}`).toBe(true)
        expect(entry!.stale, `${element.id} drifts`).toEqual([])
      }
    }
  })

  it('says Billing is kept in the application landscape, which the platform scope\'s landscape names and opens', () => {
    expect(index.lookup('billing')?.master).toBe(LANDSCAPE)
  })

  it('finds Billing with ⌘K from the platform scope, and opens it where it is kept', () => {
    const tree = scopes.map((scope) => ({ path: scope.path, model: scope.model }))
    const sources = treeSources({
      scope: PLATFORMS, model: at(PLATFORMS).model, above: [], tree, masterOf: (id) => index.lookup(id)?.master,
    })
    const hit = searchAll({ sources, query: 'Billing', kinds: ['element'] }).find((one) => one.id === 'billing')
    expect(hit?.scope).toBe(LANDSCAPE)
  })

  it('files every unit\'s served scopes and every unit under the example', () => {
    for (const { scope, unit } of index.units()) {
      expect(isWithinScope(scope, base), `${unit.id} is kept at ${scope}`).toBe(true)
      for (const served of unit.scopes ?? []) expect(isWithinScope(served, base), `${unit.id} serves ${served}`).toBe(true)
    }
  })
})
