// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { analysisNamesWithin, applyRefPatch, readdressAnalysis, readdressRef, readdressRefs } from './readdress'
import type { Cause, Observation } from '../model/observation'

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

describe('the addresses an analysis holds (ADR-0032 §4, §5)', () => {
  const cause = (id: string, scopes: (string | undefined)[]): Cause => ({
    id, number: 1, title: id, state: 'assumed', body: '', explains: scopes.map((scope, at) => ({ id: `x-${at}`, strength: 'normal', ...(scope !== undefined ? { scope } : {}) })),
  })
  const observation = (id: string, scope?: string): Observation => ({
    id, number: 1, title: id, date: '2026-09-01', impact: 'minor', seen: 1, body: '',
    history: [{ date: '2026-09-01', kind: 'recorded' }, ...(scope !== undefined ? [{ date: '2026-09-02', kind: 'absorbed' as const, id: 'ob-below', scope }] : [])],
  })

  it('says whether a scope names an address in the subtree, never for the root', () => {
    expect(analysisNamesWithin({ causes: [cause('ca-1', [undefined, 'acme/rail/stock'])] }, 'acme/rail')).toBe(true)
    expect(analysisNamesWithin({ observations: [observation('ob-1', 'acme/rail')] }, 'acme/rail')).toBe(true)
    expect(analysisNamesWithin({ causes: [cause('ca-1', ['acme/railway'])], observations: [observation('ob-1')] }, 'acme/rail')).toBe(false)
    expect(analysisNamesWithin({ causes: [cause('ca-1', ['acme'])] }, '')).toBe(false)
  })

  it('patches each cause’s links and each observation’s history that name one, and nothing else', () => {
    const commands = readdressAnalysis({
      causes: [cause('ca-1', [undefined, 'acme/rail', 'globex']), cause('ca-2', ['globex'])],
      observations: [observation('ob-1', 'acme/rail/stock'), observation('ob-2')],
    }, 'acme/rail', 'group/rail')
    expect(commands).toEqual([
      { type: 'cause.update', id: 'ca-1', patch: { explains: [
        { id: 'x-0', strength: 'normal' }, { id: 'x-1', strength: 'normal', scope: 'group/rail' }, { id: 'x-2', strength: 'normal', scope: 'globex' },
      ] } },
      { type: 'observation.update', id: 'ob-1', patch: { history: [
        { date: '2026-09-01', kind: 'recorded' }, { date: '2026-09-02', kind: 'absorbed', id: 'ob-below', scope: 'group/rail/stock' },
      ] } },
    ])
    expect(readdressAnalysis({ causes: [cause('ca-1', ['acme/rail'])] }, 'acme/rail', 'acme/rail')).toEqual([])
  })
})
