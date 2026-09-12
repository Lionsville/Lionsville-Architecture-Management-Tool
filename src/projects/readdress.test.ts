/**
 * A move carries the addresses that point into it (ADR-0012 §3).
 *
 * The property worth pinning is the one a per-case test hides: what a move
 * touches, and in which order. A pass that rewrote too much would re-address a
 * sibling's perfectly good stand-in; a pass that wrote the subtree first would
 * remove the old folder before the rest of the tree had heard where it went.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import type { ScopeModel, ScopeSnapshot } from './scope'
import { applyRefPatch, readdressRef, readdressRefs } from './readdress'

function element(id: string, ref?: string): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {},
    ...(ref !== undefined ? { ref } : {}),
  }
}

const scope = (path: string, elements: DesignElement[]): ScopeModel =>
  ({ path, model: { elements, relations: [] } })

/**
 * `acme/rail` is being filed under `acme/freight`. Three scopes point into it:
 * a sibling domain, a landscape under that sibling, and a landscape inside the
 * subtree itself.
 */
const tree: ScopeModel[] = [
  scope('', [element('erp')]),
  scope('acme', [element('wms', 'acme/rail/rolling-stock')]),
  scope('acme/road', [element('wms', 'acme/rail/rolling-stock'), element('erp', '')]),
  scope('acme/road/depots', [element('wms', 'acme/rail/rolling-stock')]),
  scope('acme/rail', [element('erp', '')]),
  scope('acme/rail/rolling-stock', [element('crew', 'acme/rail'), element('wms')]),
]

describe('readdressRef', () => {
  it('carries the subtree and everything under it', () => {
    expect(readdressRef('acme/rail', 'acme/rail', 'acme/freight/rail')).toBe('acme/freight/rail')
    expect(readdressRef('acme/rail/rolling-stock', 'acme/rail', 'acme/freight/rail'))
      .toBe('acme/freight/rail/rolling-stock')
  })

  it('leaves every other address exactly as it was', () => {
    expect(readdressRef('acme/railway', 'acme/rail', 'acme/freight/rail')).toBe('acme/railway')
    expect(readdressRef('acme/road', 'acme/rail', 'acme/freight/rail')).toBe('acme/road')
    expect(readdressRef('', 'acme/rail', 'acme/freight/rail')).toBe('')
  })

  /** The root is within every scope, so a move from it would collapse the tree. */
  it('refuses to treat the root as a subtree', () => {
    expect(readdressRef('acme/road', '', 'somewhere')).toBe('acme/road')
  })
})

describe('readdressRefs', () => {
  const patches = readdressRefs(tree, 'acme/rail', 'acme/freight/rail')

  it('names only the scopes that point into the subtree', () => {
    expect(patches.map((patch) => patch.path))
      .toEqual(['acme', 'acme/road', 'acme/road/depots', 'acme/rail/rolling-stock'])
  })

  it('puts the scopes outside the subtree first, and the subtree last', () => {
    const inside = patches.findIndex((patch) => patch.path.startsWith('acme/rail'))
    expect(inside).toBe(patches.length - 1)
  })

  it('rewrites the ref and nothing else about the record', () => {
    expect(patches[0].refs).toEqual([{ id: 'wms', ref: 'acme/freight/rail/rolling-stock' }])
    expect(patches[3].refs).toEqual([{ id: 'crew', ref: 'acme/freight/rail' }])
  })

  it('answers nothing for a move that is not one', () => {
    expect(readdressRefs(tree, 'acme/rail', 'acme/rail')).toEqual([])
    expect(readdressRefs(tree, '', 'acme')).toEqual([])
  })

  /** A stand-in of the root is the ordinary case and must survive any move. */
  it('leaves a stand-in of the root alone', () => {
    const all = patches.flatMap((patch) => patch.refs.map((held) => held.id))
    expect(all).not.toContain('erp')
  })
})

describe('applyRefPatch', () => {
  const snapshot = (): ScopeSnapshot => ({
    path: 'acme/road',
    model: {
      name: 'Road', elements: [element('wms', 'acme/rail'), element('erp')], relations: [], diagrams: [],
    },
    activeDiagramId: '',
    logoLibrary: [],
  })

  it('rewrites the records the patch names and leaves the rest by reference', () => {
    const held = snapshot()
    const next = applyRefPatch(held, { path: 'acme/road', refs: [{ id: 'wms', ref: 'acme/freight/rail' }] })
    expect(next.model.elements[0].ref).toBe('acme/freight/rail')
    expect(next.model.elements[1]).toBe(held.model.elements[1])
    expect(held.model.elements[0].ref).toBe('acme/rail')
  })

  it('is the scope itself when there is nothing to carry', () => {
    const held = snapshot()
    expect(applyRefPatch(held)).toBe(held)
    expect(applyRefPatch(held, { path: 'acme/road', refs: [] })).toBe(held)
  })
})
