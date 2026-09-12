/**
 * The scope as a unit: what can be opened, what gets saved, how a tree is
 * ordered, and why a file is refused.
 *
 * This is the logic that used to live in `main.tsx`, tangled up with
 * `FileReader`, toasts and React state — and therefore only checkable by hand.
 */
import { describe, expect, it } from 'vitest'
import type { InterchangeDoc } from '../model/fromInterchange'
import {
  bareScope, countScopes, emptyScope, flattenScopes, isOpenableScope, isProjectOrder, isStoredScope,
  moveScope, movedPaths, namesUnder, newestChange,
  openScopeDocument, renameScope, resolveActive, scopeFromDocument, scopeTree, setScopeDefaults,
  sortScopes, subtreeTotals, summarise, toWorkingFile,
} from './scope'
import type { ScopeSummary } from './scope'
import { sampleScope } from '../ports/ScopeStore.contract'

/**
 * Somebody else's format, written out here rather than taken from the shipped
 * example — the example is a project folder now (ADR-0012 §11), and an
 * interchange document is precisely the thing it is no longer.
 */
const doc: InterchangeDoc = {
  formatVersion: 'solution-design/v1',
  design: { name: 'Warehouse landscape', description: 'What another tool exported.' },
  elements: [
    { key: 'order-management', kind: 'application', name: 'Order Management' },
    { key: 'wms', kind: 'application', name: 'Warehouse Management' },
    { key: 'portal', kind: 'inputChannel', name: 'Customer Portal' },
  ],
  connections: [{ key: 'c-1', sourceKey: 'order-management', targetKey: 'wms' }],
  diagrams: [{
    key: 'landscape',
    kind: 'layer7',
    name: 'Landscape',
    places: [
      { elementKey: 'portal', zone: 'inputChannels' },
      { elementKey: 'order-management', zone: 'landscape', domainGroup: 'Order to delivery' },
      { elementKey: 'wms', zone: 'landscape', domainGroup: 'Order to delivery' },
    ],
  }],
}
const REF = 'acme-logistics/landscape'

describe('scopeFromDocument', () => {
  it('turns an interchange document into a usable scope', () => {
    const scope = scopeFromDocument(doc, REF)
    expect(scope.model.diagrams.length).toBeGreaterThan(0)
    expect(scope.activeDiagramId).toBe(scope.model.diagrams[0].id)
    expect(scope.logoLibrary).toEqual([])
  })

  it('files it at the path it was given', () => {
    expect(scopeFromDocument(doc, REF).path).toEqual(REF)
  })

  it('takes its name from the document, which is the only thing that has one', () => {
    expect(scopeFromDocument(doc, REF).model.name).toBe('Warehouse landscape')
  })
})

describe('emptyScope', () => {
  const fresh = emptyScope(REF, { design: 'New design', diagram: 'Landscape' }, 'landscape')

  it('opens on a landscape you can actually put something on', () => {
    expect(fresh.model.diagrams).toHaveLength(1)
    expect(fresh.activeDiagramId).toBe(fresh.model.diagrams[0].id)
    expect(fresh.model.diagrams[0].kind).toBe('layer7')
  })

  it('carries the names it was given, in the caller\'s language', () => {
    expect(fresh.model.name).toBe('New design')
    expect(fresh.model.diagrams[0].name).toBe('Landscape')
  })

  it('is a scope a store will accept, and says what it is', () => {
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

  it('always has a root, named by the caller when nothing named it', () => {
    const root = scopeTree([], 'Working folder')
    expect(root.path).toBe('')
    expect(root.name).toBe('Working folder')
    expect(root.children).toEqual([])
  })

  it('keeps the root the listing named, rather than the fallback', () => {
    expect(scopeTree([at('', 'Acme Logistics')], 'folder').name).toBe('Acme Logistics')
  })

  it('nests a child under its parent', () => {
    const root = scopeTree([at('acme'), at('acme/rail'), at('acme/rail/rolling-stock')])
    expect(root.children.map((c) => c.path)).toEqual(['acme'])
    expect(root.children[0].children[0].children.map((c) => c.path)).toEqual(['acme/rail/rolling-stock'])
  })

  /** A folder somebody made between two scopes must not hide what is under it. */
  it('hangs a scope whose parent is missing off the nearest one that is there', () => {
    const root = scopeTree([at('acme'), at('acme/rail/rolling-stock')])
    expect(root.children[0].children.map((c) => c.path)).toEqual(['acme/rail/rolling-stock'])
  })

  it('walks a tree depth first, the root first', () => {
    const root = scopeTree([at('acme'), at('acme/rail'), at('globex')])
    expect(flattenScopes(root).map((s) => s.path)).toEqual(['', 'acme', 'acme/rail', 'globex'])
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

  it('orders by name, by default', () => {
    expect(sortScopes(list).map((s) => s.name)).toEqual(['Beta', 'Charlie', 'Delta'])
  })

  it('orders newest first when asked', () => {
    expect(sortScopes(list, 'updated').map((s) => s.name))
      .toEqual(['Beta', 'Charlie', 'Delta'])
  })

  it('falls back on name and path so the order is total', () => {
    // Two saves in the same millisecond must not swap places between renders.
    const tied = [summary('a/second', 'Second', 'same'), summary('a/first', 'First', 'same')]
    expect(sortScopes(tied, 'updated').map((s) => s.name)).toEqual(['First', 'Second'])
  })

  it('puts a scope that was never saved last under recency', () => {
    const withNone = [...list, summary('alpha/never', 'Never')]
    expect(sortScopes(withNone, 'updated').at(-1)?.name).toBe('Never')
  })

  it('orders every level, not only the top one', () => {
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

  it('keeps a diagram that exists', () => {
    expect(resolveActive(model, 'cd')).toBe('cd')
  })

  it('falls back to the first diagram when the stored one is gone', () => {
    // Deleted in another session, or somebody else's file. A blank canvas is
    // then a worse answer than the first diagram.
    expect(resolveActive(model, 'does-not-exist')).toBe('l7')
  })

  it('falls back to the first diagram when nothing was stored', () => {
    expect(resolveActive(model)).toBe('l7')
  })

  it('gives an empty key for a model with no diagrams', () => {
    expect(resolveActive({ ...model, diagrams: [] })).toBe('')
  })
})

describe('toWorkingFile', () => {
  it('carries model, diagram and version', () => {
    const file = toWorkingFile(sampleScope())
    expect(file.type).toBe('lionsville-architecture')
    expect(file.version).toBe(2)
    expect(file.activeDiagramId).toBe('l7')
  })

  it('leaves the path out — where you filed it is not the reader\'s business', () => {
    expect('path' in toWorkingFile(sampleScope())).toBe(false)
  })

  it('leaves an empty library out entirely', () => {
    // This keeps a file without uploaded marks textually identical to a v1 file
    // apart from the version number — which saves noise in a diff.
    expect('logoLibrary' in toWorkingFile(sampleScope({ logoLibrary: [] }))).toBe(false)
  })

  it('does write the library out when there is something in it', () => {
    expect(toWorkingFile(sampleScope()).logoLibrary).toHaveLength(1)
  })

  it('passes its own recognition check', async () => {
    const { isWorkingFile } = await import('../model/hostModel')
    expect(isWorkingFile(JSON.parse(JSON.stringify(toWorkingFile(sampleScope()))))).toBe(true)
  })
})

describe('openScopeDocument — working file', () => {
  const into = sampleScope()

  it('takes over model, diagram and marks', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleScope())))
    const result = openScopeDocument(parsed, into)
    expect(result.ok && result.kind).toBe('workingFile')
    expect(result.ok && result.scope.logoLibrary).toHaveLength(1)
  })

  it('lands in the project it was opened from, not a new one', () => {
    // A file says what the design is; it does not get to say where you filed it.
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleScope())))
    const elsewhere = { ...into, path: 'acme/landscape' }
    const result = openScopeDocument(parsed, elsewhere)
    expect(result.ok && result.scope.path).toEqual('acme/landscape')
  })

  it('does not lay out again — a working file carries its own geometry', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleScope())))
    expect(openScopeDocument(parsed, into).ok && openScopeDocument(parsed, into)).toMatchObject(
      { relayout: false })
  })

  it('falls back to the first diagram when the stored one is gone', () => {
    const parsed = JSON.parse(JSON.stringify(toWorkingFile(sampleScope({ activeDiagramId: 'gone' }))))
    const result = openScopeDocument(parsed, into)
    expect(result.ok && result.scope.activeDiagramId).toBe('l7')
  })

  it('gives an empty library for a v1 file', () => {
    const parsed = { type: 'lionsville-architecture', version: 1, model: sampleScope().model }
    const result = openScopeDocument(parsed, into)
    expect(result.ok && result.scope.logoLibrary).toEqual([])
  })

  it('refuses a working file without diagrams, with its own key', () => {
    const empty = { ...toWorkingFile(into), model: { ...into.model, diagrams: [] } }
    expect(openScopeDocument(empty, into))
      .toEqual({ ok: false, messageKey: 'shell.workingFileNoDiagrams' })
  })
})

describe('openScopeDocument — interchange', () => {
  const into = sampleScope()

  it('lays out again, because such a document carries no geometry', () => {
    const result = openScopeDocument(doc, into)
    expect(result.ok && result.relayout).toBe(true)
    expect(result.ok && result.kind).toBe('interchange')
  })

  it('keeps the marks of the project it lands in', () => {
    // They belong to this browser and not to the document: opening an
    // interchange file must not throw away your own marks.
    const result = openScopeDocument(doc, into)
    expect(result.ok && result.scope.logoLibrary).toEqual(into.logoLibrary)
  })

  it('copies that library rather than sharing it', () => {
    const result = openScopeDocument(doc, into)
    expect(result.ok && result.scope.logoLibrary).not.toBe(into.logoLibrary)
  })

  it('refuses an interchange document without diagrams', () => {
    expect(openScopeDocument({ ...doc, diagrams: [] }, into))
      .toEqual({ ok: false, messageKey: 'shell.interchangeNoDiagrams' })
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
  it('recognises a scope with views', () => {
    expect(isOpenableScope(sampleScope())).toBe(true)
  })

  /**
   * A domain draws nothing and is a scope all the same. This is the shell's
   * question — is there anything for the canvas to show — and not the store's.
   */
  it('says no to a scope with no views, and to nothing at all', () => {
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
  it('stores the author and the starting columns', () => {
    const out = setScopeDefaults(sampleScope(), {
      author: 'W. Simons',
      aspectConfig: [{ key: 'dr', label: 'Continuity' }],
    })
    expect(out.model.defaultAuthor).toBe('W. Simons')
    expect(out.model.defaultAspectConfig).toEqual([{ key: 'dr', label: 'Continuity' }])
  })

  it('clears a default rather than keeping the key with nothing in it', () => {
    const set = setScopeDefaults(sampleScope(), { author: 'W. Simons' })
    const cleared = setScopeDefaults(set, {})
    expect('defaultAuthor' in cleared.model).toBe(false)
  })

  it('does not touch the original', () => {
    const project = sampleScope()
    setScopeDefaults(project, { author: 'W. Simons' })
    expect(project.model.defaultAuthor).toBeUndefined()
  })
})

describe('renameScope', () => {
  it('changes the name on the model', () => {
    expect(renameScope(sampleScope(), 'Another name').model.name).toBe('Another name')
  })

  it('leaves the path alone — a rename must not re-file the scope', () => {
    // A screen and the lastScope preference both hold the path. Re-filing on
    // every rename would break both, and for nothing: a path is an address.
    const renamed = renameScope(sampleScope(), 'Another name')
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
  })

  /** A scope can honestly be both, and is counted in each rather than sorted. */
  it('counts a scope that has children AND draws as both', () => {
    const both = scopeTree([at('retail', { diagrams: 1 }), at('retail/warehouse', { diagrams: 1 })])
    expect(countScopes(both)).toEqual({ domains: 1, landscapes: 2 })
  })

  /** The root is the organisation, not a row in its own list. */
  it('leaves the root out', () => {
    expect(countScopes(scopeTree([at('', { diagrams: 4 })]))).toEqual({ domains: 0, landscapes: 0 })
  })

  it('sums a subtree including the scope you are looking at', () => {
    const retail = tree.children.find((scope) => scope.path === 'retail')!
    expect(subtreeTotals(retail)).toEqual({ landscapes: 2, diagrams: 4 })
  })

  it('sums a leaf as itself', () => {
    const finance = tree.children.find((scope) => scope.path === 'finance')!
    expect(subtreeTotals(finance)).toEqual({ landscapes: 1, diagrams: 2 })
  })

  it('answers the newest change anywhere in the tree', () => {
    expect(newestChange(tree)).toBe('2026-09-09T09:00:00.000Z')
  })

  it('answers nothing where no scope has been written yet', () => {
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
  it('re-addresses the whole subtree, parents first', () => {
    expect(movedPaths(retail, 'ops/retail')).toEqual([
      { from: 'retail', to: 'ops/retail' },
      { from: 'retail/warehouse', to: 'ops/retail/warehouse' },
      { from: 'retail/warehouse/wms', to: 'ops/retail/warehouse/wms' },
    ])
  })

  it('answers one pair for a leaf', () => {
    const leaf = scopeTree([{ path: 'finance', name: 'Finance', diagrams: 1, children: [] }]).children[0]
    expect(movedPaths(leaf, 'ops/finance')).toEqual([{ from: 'finance', to: 'ops/finance' }])
  })
})
