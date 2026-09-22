// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scope as a unit: what can be opened, what gets saved, how a tree is
 * ordered, and why a file is refused.
 *
 * This is the logic that used to live in `main.tsx`, tangled up with
 * `FileReader`, toasts and React state — and therefore only checkable by hand.
 */
import { describe, expect, it } from 'vitest'
import {
  bareScope, countScopes, emptyScope, flattenScopes, isOpenableScope, isProjectOrder, isStoredScope,
  moveScope, movedPaths, namesUnder, newestChange,
  openScopeDocument, renameScope, resolveActive, scopeTree, setScopeDefaults,
  sortScopes, subtreeTotals, summarise, toWorkingFile,
} from './scope'
import type { ScopeSummary } from './scope'
import { sampleScope } from '../ports/ScopeStore.contract'

const REF = 'acme-logistics/landscape'

describe('emptyScope', () => {
  const fresh = emptyScope(REF, { design: 'New design', diagram: 'Landscape' }, 'landscape')

  it('opens on a landscape you can put something on, named in the caller\'s language', () => {
    expect(fresh.model.diagrams).toHaveLength(1)
    expect(fresh.activeDiagramId).toBe(fresh.model.diagrams[0].id)
    expect(fresh.model.diagrams[0].kind).toBe('layer7')
    expect(fresh.model.name).toBe('New design')
    expect(fresh.model.diagrams[0].name).toBe('Landscape')
    // And it is a scope a store will accept, which says what it is.
    expect(isOpenableScope(fresh)).toBe(true)
    expect(fresh.kind).toBe('landscape')
  })
})

describe('bareScope', () => {
  it('is a scope with a name and nothing else — what a domain starts as', () => {
    const held = bareScope('acme', 'Acme', 'domain')
    expect(held.model.name).toBe('Acme')
    expect(held.model.diagrams).toEqual([])
    expect(isOpenableScope(held)).toBe(false)
  })
})

describe('summarise', () => {
  it('summarises without carrying the model along', () => {
    const summary = summarise({ ...sampleScope(), updatedAt: '2026-09-05T10:00:00.000Z' })
    expect(summary).toEqual({
      path: 'acme-logistics/landscape',
      name: 'Application landscape',
      diagrams: 2,
      children: [],
      updatedAt: '2026-09-05T10:00:00.000Z',
    })
  })
})

describe('scopeTree', () => {
  const at = (path: string, name = path): ScopeSummary =>
    ({ path, name, diagrams: 0, children: [] })

  it('always has a root, named by the listing where it named one and by the caller otherwise', () => {
    const root = scopeTree([], 'Working folder')
    expect(root.path).toBe('')
    expect(root.name).toBe('Working folder')
    expect(root.children).toEqual([])
    expect(scopeTree([at('', 'Acme Logistics')], 'folder').name).toBe('Acme Logistics')
  })

  it('nests a child under its parent, and walks the tree depth first', () => {
    const root = scopeTree([at('acme'), at('acme/rail'), at('acme/rail/rolling-stock')])
    expect(root.children.map((c) => c.path)).toEqual(['acme'])
    expect(root.children[0].children[0].children.map((c) => c.path)).toEqual(['acme/rail/rolling-stock'])
    // A folder somebody made between two scopes must not hide what is under it.
    const gap = scopeTree([at('acme'), at('acme/rail/rolling-stock')])
    expect(gap.children[0].children.map((c) => c.path)).toEqual(['acme/rail/rolling-stock'])
    const wide = scopeTree([at('acme'), at('acme/rail'), at('globex')])
    expect(flattenScopes(wide).map((s) => s.path)).toEqual(['', 'acme', 'acme/rail', 'globex'])
  })
})

describe('namesUnder', () => {
  it('is the segment each child is filed under', () => {
    const root = scopeTree([
      { path: 'acme', name: 'Acme', diagrams: 0, children: [] },
      { path: 'acme/rail', name: 'Rail', diagrams: 0, children: [] },
    ])
    expect(namesUnder(root)).toEqual(['acme'])
    expect(namesUnder(root.children[0])).toEqual(['rail'])
    expect(namesUnder(undefined)).toEqual([])
  })
})

describe('sortScopes', () => {
  const summary = (path: string, name: string, updatedAt?: string): ScopeSummary =>
    ({ path, name, diagrams: 0, children: [], updatedAt })
  const list = [
    summary('zeta/beta', 'Beta', '2026-01-03T00:00:00.000Z'),
    summary('alpha/delta', 'Delta', '2026-01-01T00:00:00.000Z'),
    summary('alpha/charlie', 'Charlie', '2026-01-02T00:00:00.000Z'),
  ]

  it('orders by name by default and newest first when asked, at every level', () => {
    expect(sortScopes(list).map((s) => s.name)).toEqual(['Beta', 'Charlie', 'Delta'])
    expect(sortScopes(list, 'updated').map((s) => s.name))
      .toEqual(['Beta', 'Charlie', 'Delta'])
    // Two saves in the same millisecond must not swap places between renders:
    // name and path make the order total.
    const tied = [summary('a/second', 'Second', 'same'), summary('a/first', 'First', 'same')]
    expect(sortScopes(tied, 'updated').map((s) => s.name)).toEqual(['First', 'Second'])
    const withNone = [...list, summary('alpha/never', 'Never')]
    expect(sortScopes(withNone, 'updated').at(-1)?.name).toBe('Never')
    const nested = [{
      ...summary('acme', 'Acme'),
      children: [summary('acme/zebra', 'Zebra'), summary('acme/ant', 'Ant')],
    }]
    expect(sortScopes(nested)[0].children.map((s) => s.name)).toEqual(['Ant', 'Zebra'])
  })

  it('copies rather than sorting the caller\'s array in place', () => {
    const original = [...list]
    sortScopes(list)
    expect(list).toEqual(original)
  })

  it('recognises the two orders and nothing else', () => {
    expect(isProjectOrder('name')).toBe(true)
    expect(isProjectOrder('updated')).toBe(true)
    expect(isProjectOrder('size')).toBe(false)
    expect(isProjectOrder(undefined)).toBe(false)
  })
})

describe('resolveActive', () => {
  const model = sampleScope().model

  it('keeps a diagram that exists and falls back to the first one otherwise', () => {
    expect(resolveActive(model, 'cd')).toBe('cd')
    // Deleted in another session, or somebody else's file. A blank canvas is
    // then a worse answer than the first diagram.
    expect(resolveActive(model, 'does-not-exist')).toBe('l7')
    expect(resolveActive(model)).toBe('l7')
    expect(resolveActive({ ...model, diagrams: [] })).toBe('')
  })

  it('answers a board first, a laid-out view when asked for or alone, and nothing where there is no view', () => {
    // A laid-out view is drawn in the tab since ADR-0016, so it can be the
    // active one; a scope with a landscape still opens on the landscape
    // unless a sheet was asked for.
    const sheet = { id: 'sh', kind: 'sheet' as const, name: 'Sheet', members: [], geometry: { nodes: [] } }
    const withSheet = { ...model, diagrams: [sheet, ...model.diagrams] }
    expect(resolveActive(withSheet)).toBe('l7')
    expect(resolveActive(withSheet, 'sh')).toBe('sh')
    expect(resolveActive({ ...model, diagrams: [sheet] })).toBe('sh')
    expect(resolveActive({ ...model, diagrams: [] })).toBe('')
    expect(isOpenableScope({ ...sampleScope(), model: { ...model, diagrams: [sheet] } })).toBe(true)
    expect(isOpenableScope({ ...sampleScope(), model: { ...model, diagrams: [] } })).toBe(false)
  })
})

describe('toWorkingFile', () => {
  it('carries model, diagram and version, and nothing the reader has no business with', () => {
    const file = toWorkingFile(sampleScope())
    expect(file.type).toBe('lionsville-architecture')
    expect(file.version).toBe(2)
    expect(file.activeDiagramId).toBe('l7')
    // Where you filed it is not the reader's business.
    expect('path' in file).toBe(false)
    expect(file.logoLibrary).toHaveLength(1)
    // An empty library is left out entirely, which keeps a file without
    // uploaded marks textually identical to a v1 file apart from the version
    // number — which saves noise in a diff.
    expect('logoLibrary' in toWorkingFile(sampleScope({ logoLibrary: [] }))).toBe(false)
  })

  it('passes its own recognition check', async () => {
    const { isWorkingFile } = await import('../model/hostModel')
    expect(isWorkingFile(JSON.parse(JSON.stringify(toWorkingFile(sampleScope()))))).toBe(true)
  })
})

describe('openScopeDocument — working file', () => {
  const into = sampleScope()

  it('takes over model, diagram and marks, and lands in the project it was opened from', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleScope())))
    const result = openScopeDocument(parsed, into)
    expect(result.ok && result.kind).toBe('workingFile')
    expect(result.ok && result.scope.logoLibrary).toHaveLength(1)
    // A file says what the design is; it does not get to say where you filed it.
    const elsewhere = openScopeDocument(parsed, { ...into, path: 'acme/landscape' })
    expect(elsewhere.ok && elsewhere.scope.path).toEqual('acme/landscape')
    // And it carries its own geometry, so there is nothing to lay out again.
    expect(result).toMatchObject({ relayout: false })
  })

  it('falls back to the first diagram when the stored one is gone, and to no marks for a v1 file', () => {
    const gone = JSON.parse(JSON.stringify(toWorkingFile(sampleScope({ activeDiagramId: 'gone' }))))
    const result = openScopeDocument(gone, into)
    expect(result.ok && result.scope.activeDiagramId).toBe('l7')
    const v1 = openScopeDocument(
      { type: 'lionsville-architecture', version: 1, model: sampleScope().model }, into)
    expect(v1.ok && v1.scope.logoLibrary).toEqual([])
  })

  it('refuses a working file without diagrams, with its own key', () => {
    const empty = { ...toWorkingFile(into), model: { ...into.model, diagrams: [] } }
    expect(openScopeDocument(empty, into))
      .toEqual({ ok: false, messageKey: 'shell.workingFileNoDiagrams' })
  })
})

describe('openScopeDocument — the rest', () => {
  const into = sampleScope()

  it.each([
    ['an arbitrary object', { something: 'else' }],
    ['a string', 'just text'],
    ['nothing', null],
    ['a list', []],
  ])('refuses %s as an unknown file', (_name, input) => {
    expect(openScopeDocument(input, into)).toEqual({ ok: false, messageKey: 'shell.unknownFile' })
  })

  it('refuses a working file from a later version rather than half-reading it', () => {
    expect(openScopeDocument({ ...toWorkingFile(into), version: 99 }, into))
      .toEqual({ ok: false, messageKey: 'shell.unknownFile' })
  })
})

describe('isOpenableScope', () => {
  /**
   * A domain draws nothing and is a scope all the same. This is the shell's
   * question — is there anything for the canvas to show — and not the store's.
   */
  it('recognises a scope with views, and says no to one without and to nothing at all', () => {
    expect(isOpenableScope(sampleScope())).toBe(true)
    expect(isOpenableScope(bareScope('acme', 'Acme', 'domain'))).toBe(false)
    expect(isOpenableScope(undefined)).toBe(false)
  })
})

describe('isStoredScope', () => {
  it('recognises anything with a model whose views are a list', () => {
    expect(isStoredScope(sampleScope())).toBe(true)
    expect(isStoredScope(bareScope('acme', 'Acme'))).toBe(true)
  })

  it.each([
    ['without a model', { activeDiagramId: 'l7' }],
    ['with diagrams that are not a list', { model: { diagrams: 'l7' } }],
    ['that is nothing', undefined],
    ['that is a string', 'no'],
  ])('rejects something %s', (_name, input) => {
    expect(isStoredScope(input)).toBe(false)
  })
})

describe('setScopeDefaults', () => {
  it('stores the author and the starting columns, and clears rather than empties them', () => {
    const out = setScopeDefaults(sampleScope(), {
      author: 'W. Simons',
      aspectConfig: [{ key: 'dr', label: 'Continuity' }],
    })
    expect(out.model.defaultAuthor).toBe('W. Simons')
    expect(out.model.defaultAspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }])
    // Cleared means the key is gone, not present with nothing in it.
    expect('defaultAuthor' in setScopeDefaults(out, {}).model).toBe(false)
  })

  it('does not touch the original', () => {
    const project = sampleScope()
    setScopeDefaults(project, { author: 'W. Simons' })
    expect(project.model.defaultAuthor).toBeUndefined()
  })
})

describe('renameScope', () => {
  it('changes the name on the model and leaves the path alone', () => {
    const renamed = renameScope(sampleScope(), 'Another name')
    expect(renamed.model.name).toBe('Another name')
    // A screen and the lastScope preference both hold the path. Re-filing on
    // every rename would break both, and for nothing: a path is an address.
    expect(renamed.path).toEqual(sampleScope().path)
  })

  it('does not touch the original', () => {
    const project = sampleScope()
    renameScope(project, 'Another name')
    expect(project.model.name).toBe('Application landscape')
  })
})

describe('moveScope', () => {
  const moved = moveScope(sampleScope(), 'globex/landscape')

  it('changes the address and nothing else', () => {
    expect(moved.path).toEqual('globex/landscape')
    expect(moved.model).toEqual(sampleScope().model)
    expect(moved.activeDiagramId).toBe('l7')
  })

  it('does not touch the original', () => {
    const scope = sampleScope()
    moveScope(scope, 'globex/landscape')
    expect(scope.path).toBe('acme-logistics/landscape')
  })
})

describe('what a tree of scopes adds up to', () => {
  const at = (path: string, over: Partial<ScopeSummary> = {}): ScopeSummary => ({
    path, name: path || 'Acme', diagrams: 0, children: [], ...over,
  })

  /** A scope with children; a scope with views. Neither is the `kind` label. */
  const tree = scopeTree([
    at('', { name: 'Acme Logistics', updatedAt: '2026-09-01T09:00:00.000Z' }),
    at('retail', { updatedAt: '2026-09-04T09:00:00.000Z' }),
    at('retail/warehouse', { diagrams: 3, updatedAt: '2026-09-09T09:00:00.000Z' }),
    at('retail/returns', { diagrams: 1, updatedAt: '2026-09-02T09:00:00.000Z' }),
    at('finance', { diagrams: 2, updatedAt: '2026-09-03T09:00:00.000Z' }),
  ])

  it('counts a domain by what is filed under it and a landscape by what it draws', () => {
    expect(countScopes(tree)).toEqual({ domains: 1, landscapes: 3 })
    // A scope can honestly be both, and is counted in each rather than sorted.
    const both = scopeTree([at('retail', { diagrams: 1 }), at('retail/warehouse', { diagrams: 1 })])
    expect(countScopes(both)).toEqual({ domains: 1, landscapes: 2 })
    // The root is the organisation, not a row in its own list.
    expect(countScopes(scopeTree([at('', { diagrams: 4 })]))).toEqual({ domains: 0, landscapes: 0 })
  })

  it('sums a subtree including the scope you are looking at, and a leaf as itself', () => {
    const retail = tree.children.find((scope) => scope.path === 'retail')!
    expect(subtreeTotals(retail)).toEqual({ landscapes: 2, diagrams: 4 })
    const finance = tree.children.find((scope) => scope.path === 'finance')!
    expect(subtreeTotals(finance)).toEqual({ landscapes: 1, diagrams: 2 })
  })

  it('answers the newest change anywhere in the tree, and nothing where none was written', () => {
    expect(newestChange(tree)).toBe('2026-09-09T09:00:00.000Z')
    expect(newestChange(scopeTree([at(''), at('retail')]))).toBeUndefined()
  })
})

describe('movedPaths', () => {
  const tree = scopeTree([
    { path: 'retail', name: 'Retail', diagrams: 0, children: [] },
    { path: 'retail/warehouse', name: 'Warehouse', diagrams: 1, children: [] },
    { path: 'retail/warehouse/wms', name: 'WMS', diagrams: 1, children: [] },
  ])
  const retail = tree.children[0]

  /** `remove` takes the children with it, so they have to be written first. */
  it('re-addresses the whole subtree, parents first, and a leaf as one pair', () => {
    expect(movedPaths(retail, 'ops/retail')).toEqual([
      { from: 'retail', to: 'ops/retail' },
      { from: 'retail/warehouse', to: 'ops/retail/warehouse' },
      { from: 'retail/warehouse/wms', to: 'ops/retail/warehouse/wms' },
    ])
    const leaf = scopeTree([{ path: 'finance', name: 'Finance', diagrams: 1, children: [] }]).children[0]
    expect(movedPaths(leaf, 'ops/finance')).toEqual([{ from: 'finance', to: 'ops/finance' }])
  })
})
