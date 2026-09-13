/**
 * One identity across the organisation (ADR-0012 §2).
 *
 * The rules that matter here are all about depth, and they are the ones a
 * reader is most likely to get backwards: a definition deeper in the tree wins
 * over one above it, *whichever direction the authority is meant to flow*. The
 * business layer is written top-down and the applications bottom-up, and the
 * same sentence has to serve both — so both are pinned below by name.
 */
import { describe, expect, it, vi } from 'vitest'
import type { DesignElement, Relation } from '../model'
import { indexOf, indexScopes, isMaster, ownerOf } from './scopeIndex'
import { scopeTree } from './scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from './scope'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
  }
}

const standIn = (id: string, ref: string, over: Partial<DesignElement> = {}) =>
  element(id, { ref, ...over })

const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
  ({ id, type, sourceId, targetId })

function scope(
  path: string,
  elements: DesignElement[],
  relations: Relation[] = [],
): ScopeModel {
  return { path, model: { elements, relations } }
}

describe('the index — who answers for an id', () => {
  it('makes the one definition in the tree the master', () => {
    const index = indexScopes([scope('retail', [element('erp', { name: 'ERP' })])])
    expect(index.lookup('erp')).toEqual({
      id: 'erp', kind: 'application', name: 'ERP',
      master: 'retail', declarations: [], drawnIn: [], stale: [],
    })
  })

  /**
   * Applications are bottom-up: the organisation may hold a thin record that
   * names `erp` until somebody deeper takes it, and from then on that record is
   * a cached copy the drift check watches. It must not overrule.
   */
  it('lets the deeper definition take a declaration made above it', () => {
    const index = indexScopes([
      scope('', [element('erp', { name: 'The ERP' })]),
      scope('retail', [element('erp', { name: 'Retail ERP' })]),
    ])
    expect(index.lookup('erp')?.master).toBe('retail')
    expect(index.lookup('erp')?.name).toBe('Retail ERP')
    expect(index.lookup('erp')?.declarations).toEqual([''])
    expect(index.lookup('erp')?.cachedRef).toBeUndefined()
  })

  /**
   * Functions are top-down, and the same rule gives the opposite answer
   * because nobody below defines one: a domain refines `fulfilment` by holding
   * a STAND-IN of it, so the organisation stays the deepest definition and the
   * name stays the organisation's.
   */
  it('keeps the organisation as master of a function a domain only refines', () => {
    const index = indexScopes([
      scope('', [element('fulfilment', { kind: 'function', name: 'Fulfilment' })]),
      scope('retail', [
        standIn('fulfilment', '', { kind: 'function', name: 'Fulfilment' }),
        element('picking', { kind: 'function', parentId: 'fulfilment' }),
      ]),
    ])
    expect(index.lookup('fulfilment')?.master).toBe('')
    expect(index.lookup('fulfilment')?.drawnIn).toEqual(['retail'])
    expect(index.lookup('picking')?.master).toBe('retail')
  })

  it('names every scope of a tie, and still answers with one master', () => {
    const index = indexScopes([
      scope('retail', [element('erp')]),
      scope('finance', [element('erp')]),
    ])
    expect(index.lookup('erp')?.conflict).toEqual(['finance', 'retail'])
    expect(index.lookup('erp')?.master).toBe('finance')
  })

  it('does not call two definitions at different depths a conflict', () => {
    const index = indexScopes([
      scope('retail', [element('erp')]),
      scope('retail/warehouse', [element('erp')]),
    ])
    expect(index.lookup('erp')?.conflict).toBeUndefined()
    expect(index.lookup('erp')?.master).toBe('retail/warehouse')
  })

  /**
   * Every record of it is a stand-in of something nobody wrote down. It keeps
   * the cached name, because that is the only name there is and the id is not
   * one anybody chose to read.
   */
  /**
   * A cache goes stale when the owning scope renames the thing, or when the
   * definition moves and the path a stand-in points at is no longer where it
   * is. A declaration can go stale too — it is the thin layer that yielded,
   * and from that moment its name is a cache like any other.
   */
  it('names the scopes whose cached name or ref disagrees with the master', () => {
    const index = indexScopes([
      scope('', [element('erp', { name: 'Old name' })]),
      scope('acme/retail', [element('erp', { name: 'Retail ERP' })]),
      scope('acme/finance', [standIn('erp', 'acme/retail', { name: 'Retail ERP' })]),
      scope('acme/legal', [standIn('erp', 'acme/retail', { name: 'Old name' })]),
      scope('acme/hr', [standIn('erp', '', { name: 'Retail ERP' })]),
    ])
    expect(index.lookup('erp')?.stale).toEqual(['', 'acme/hr', 'acme/legal'])
  })

  it('calls nothing stale where there is no master to disagree with', () => {
    const index = indexScopes([scope('retail', [standIn('erp', 'finance', { name: 'ERP' })])])
    expect(index.lookup('erp')?.stale).toEqual([])
  })

  it('answers with no master, and the cached name, for an id nobody defines', () => {
    const index = indexScopes([scope('retail', [standIn('erp', 'finance', { name: 'ERP' })])])
    expect(index.lookup('erp')?.master).toBeUndefined()
    expect(index.lookup('erp')?.name).toBe('ERP')
    expect(index.lookup('erp')?.drawnIn).toEqual(['retail'])
    // The one address anybody wrote down, kept so a scope drawing it from
    // the register says the same thing the others say.
    expect(index.lookup('erp')?.cachedRef).toBe('finance')
  })

  it('has never heard of an id no scope holds', () => {
    expect(indexScopes([scope('retail', [element('erp')])]).lookup('wms')).toBeUndefined()
  })

  it('does not depend on the order a store listed the scopes in', () => {
    const a = scope('retail', [element('erp', { name: 'Retail ERP' })])
    const b = scope('', [element('erp', { name: 'The ERP' })])
    expect(indexScopes([a, b]).entries()).toEqual(indexScopes([b, a]).entries())
  })
})

describe('the index — what it is read for', () => {
  it('lists every application by name, and no function', () => {
    const index = indexScopes([
      scope('retail', [element('wms', { name: 'Warehouse' }), element('erp', { name: 'ERP' })]),
      scope('', [element('fulfilment', { kind: 'function', name: 'Ahead of both' })]),
    ])
    expect(index.register().map((entry) => entry.id)).toEqual(['erp', 'wms'])
  })

  /**
   * Two facts about a definition that the register draws for every row, and
   * that a second read per row would make a load per card of (ADR-0004).
   * The MASTER's, because a declaration above it is a cache and a stand-in may
   * not carry either of them at all (§3).
   */
  it('carries whether the master is outside, and whose it is', () => {
    const index = indexScopes([
      scope('', [element('post', { name: 'Post office', outside: true })]),
      scope('retail', [
        element('post', { name: 'Post office', outside: true, partyId: 'carrier' }),
        element('wms', { name: 'Warehouse' }),
      ]),
    ])
    expect(index.lookup('post')).toMatchObject({ master: 'retail', outside: true, partyId: 'carrier' })
    expect(index.lookup('wms')?.outside).toBeUndefined()
  })

  it('says every id the tree has spoken for, rows included', () => {
    const index = indexScopes([
      scope('retail', [element('erp')], [row('c#1', 'flow', 'erp', 'erp')]),
      scope('finance', [element('ledger')]),
    ])
    expect([...index.takenIds()].sort()).toEqual(['c#1', 'erp', 'ledger'])
  })

  /**
   * The cross-scope half of coverage: the applications that support a
   * capability defined at the organisation are in a landscape's model, so a
   * sheet drawn at the root has to read rows it does not hold.
   */
  it('finds the rows pointing at an id, wherever they were written', () => {
    const index = indexScopes([
      scope('', [element('fulfilment', { kind: 'function' })]),
      scope('retail', [element('wms')], [
        row('r1', 'supports', 'wms', 'fulfilment'),
        row('r2', 'flow', 'wms', 'wms'),
      ]),
      scope('finance', [element('erp')], [row('r3', 'supports', 'erp', 'fulfilment')]),
    ])
    // Path order, which is the order the index reads the tree in: `finance`
    // before `retail`, whatever order the store enumerated them in.
    expect(index.rowsTo('fulfilment').map((held) => held.relation.id)).toEqual(['r3', 'r1'])
    expect(index.rowsTo('fulfilment')[0].scope).toBe('finance')
    expect(index.rowsTo('fulfilment', ['assigned'])).toEqual([])
    expect(index.rowsTo('wms', ['flow']).map((held) => held.relation.id)).toEqual(['r2'])
  })

  it('says which scopes it was built from', () => {
    expect(indexScopes([scope('retail', []), scope('', [])]).scopes()).toEqual(['', 'retail'])
  })
})

describe('the index — over whatever a store can say', () => {
  const snapshot = (path: string, elements: DesignElement[]): ScopeSnapshot => ({
    path,
    model: { name: path || 'Acme', elements, relations: [], diagrams: [] },
    activeDiagramId: '',
    logoLibrary: [],
  })

  const listing = (paths: readonly string[]): ScopeSummary => scopeTree(
    paths.map((path) => ({ path, name: path, diagrams: 0, children: [] })),
  )

  it('reads the tree through models() where a store has one', async () => {
    const models = vi.fn(() => Promise.resolve([scope('retail', [element('erp')])]))
    const load = vi.fn(() => Promise.resolve(undefined))
    const index = await indexOf({ models, list: () => Promise.resolve(listing([])), load })
    expect(index.lookup('erp')?.master).toBe('retail')
    // The point of the clause: nothing was loaded in full to answer this.
    expect(load).not.toHaveBeenCalled()
  })

  /**
   * A backend written without the optional clause is slower, not wrong. It
   * pays a whole scope per folder — descriptions, views and all — which is
   * exactly what `models()` exists to avoid.
   */
  it('falls back to a listing and a load each where it has none', async () => {
    const held = new Map([
      ['', snapshot('', [element('fulfilment', { kind: 'function' })])],
      ['retail', snapshot('retail', [element('erp')])],
    ])
    const index = await indexOf({
      list: () => Promise.resolve(listing(['', 'retail'])),
      load: (path) => Promise.resolve(held.get(path)),
    })
    expect(index.lookup('erp')?.master).toBe('retail')
    expect(index.lookup('fulfilment')?.master).toBe('')
  })

  it('leaves out a scope that will not load, rather than calling it empty', async () => {
    const index = await indexOf({
      list: () => Promise.resolve(listing(['', 'retail'])),
      load: (path) => Promise.resolve(path === 'retail' ? snapshot('retail', [element('erp')]) : undefined),
    })
    expect(index.scopes()).toEqual(['retail'])
  })
})

describe('the index — the initiatives below a scope (ADR-0012 §7)', () => {
  const plan = (number: number, initiative?: true) => ({
    id: `tr-${number}`, number, title: `Plan ${number}`, status: 'agreed' as const,
    ...(initiative ? { initiative } : {}), elements: [], decisions: [], milestones: [], body: '',
  })
  const tree = () => indexScopes([
    { path: '', model: { elements: [], relations: [], transitions: [plan(1, true)] } },
    { path: 'acme', model: { elements: [], relations: [], transitions: [plan(3, true), plan(2)] } },
    { path: 'acme/retail', model: { elements: [], relations: [], transitions: [plan(1, true)] } },
    { path: 'other', model: { elements: [], relations: [], transitions: [plan(1, true)] } },
    scope('acme/finance', []),
  ])

  it('answers the flagged plans of the scopes strictly below, by scope and number', () => {
    expect(tree().initiativesBelow('acme').map(({ scope, transition }) => [scope, transition.number]))
      .toEqual([['acme/retail', 1]])
    expect(tree().initiativesBelow('').map(({ scope, transition }) => [scope, transition.number]))
      .toEqual([['acme', 3], ['acme/retail', 1], ['other', 1]])
  })

  it('carries the elements a plan names, as its scope holds them, and leaves out an id it has no record for', () => {
    const named = { ...plan(1, true), elements: [
      { elementId: 'wms', role: 'retires' as const }, { elementId: 'gone', role: 'changes' as const },
    ] }
    const index = indexScopes([
      { path: '', model: { elements: [], relations: [] } },
      { path: 'acme/retail', model: { elements: [element('wms'), element('crm')], relations: [], transitions: [named] } },
    ])
    expect(index.initiativesBelow('').map(({ elements }) => elements.map((one) => one.id))).toEqual([['wms']])
  })

  it('leaves out a plan nobody flagged, the scope\u2019s own, and a scope with no plans read', () => {
    const below = tree().initiativesBelow('')
    expect(below.some(({ transition }) => transition.number === 2)).toBe(false)
    expect(below.some(({ scope }) => scope === '')).toBe(false)
    expect(tree().initiativesBelow('acme/finance')).toEqual([])
  })
})

describe('the index — the two questions an inspector asks', () => {
  const index = indexScopes([
    scope('retail', [element('erp')]),
    scope('finance', [standIn('erp', 'retail')]),
  ])

  it('says which scope answers for an id', () => {
    expect(ownerOf(index, 'erp')).toBe('retail')
    expect(ownerOf(index, 'nobody')).toBeUndefined()
  })

  it('calls only the owning scope the master', () => {
    expect(isMaster(index, 'erp', 'retail')).toBe(true)
    expect(isMaster(index, 'erp', 'finance')).toBe(false)
  })

  /**
   * A session opened before anything listed the tree, and an element drawn a
   * second ago. Both are ids the index has not seen, and in both the document
   * in front of you is the only authority there is — so a shell with no index
   * behind it edits exactly as it did before the tree had one.
   */
  it('lets a scope edit an id the tree has never heard of', () => {
    expect(isMaster(index, 'drawn-just-now', 'finance')).toBe(true)
    expect(isMaster(indexScopes([]), 'erp', 'finance')).toBe(true)
  })
})
