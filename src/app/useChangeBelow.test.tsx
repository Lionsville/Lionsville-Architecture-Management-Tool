// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A change to a scope below, made from the page above (ADR-0032 §2): written
 * into that scope and nowhere else, through the one writer, expecting what
 * was read. Over a three-level tree — the organisation, a domain, a team.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { laidOut } from '../model/testFixtures'
import type { Cause, Observation, Solution } from '../model/observation'
import type { ScopeSnapshot } from '../projects/scope'
import { landBelow, useChangeBelow } from './useChangeBelow'

afterEach(() => cleanup())

const observation = (id: string, number: number): Observation => ({
  id, number, title: id, date: '2026-09-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }],
})
const cause = (id: string, number: number, over: Partial<Cause> = {}): Cause => ({
  id, number, title: id, state: 'assumed', body: '', explains: [], ...over,
})
const solution = (id: string, causeId: string): Solution => ({
  id, number: 1, title: id, state: 'idea', addresses: [{ id: causeId, strength: 'strong' }],
  validatedWith: [], attempts: [], body: '', history: [],
})

function scope(path: string, over: Partial<ScopeSnapshot['model']> = {}): ScopeSnapshot {
  return {
    path,
    model: { name: path || 'Acme', elements: [], relations: [], diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })], ...over },
    activeDiagramId: 'l7',
    logoLibrary: [],
  }
}

const tree = () => new InMemoryScopeStore([
  scope(''),
  scope('claims', { causes: [cause('ca-claims', 1)] }),
  scope('claims/intake', {
    observations: [observation('ob-in', 1)],
    causes: [cause('ca-in', 1, { explains: [{ id: 'ob-in', strength: 'normal' }] }), cause('rc-in', 2, { root: true })],
    solutions: [solution('so-in', 'rc-in')],
  }),
])

describe('landing a change on a scope below', () => {
  it('writes the scope below and nothing else, as it stands after the change', async () => {
    const store = tree()
    const landed = await landBelow(store, 'claims/intake', (work) => ({
      ...work, observations: work.observations.map((one) => ({ ...one, seen: one.seen + 1 })),
    }))
    expect(landed).toEqual({ ok: true })
    expect((await store.load('claims/intake'))?.model.observations?.[0].seen).toBe(2)
    expect((await store.load('claims'))?.model.causes).toEqual([cause('ca-claims', 1)])
    expect((await store.load(''))?.model.causes).toBeUndefined()
  })

  it('is refused below as it is here, by the one writer and with its key, and writes nothing', async () => {
    const store = tree()
    const before = await store.load('claims/intake')
    // Made a cause again while a solution addresses it (ADR-0032 §3).
    const refused = await landBelow(store, 'claims/intake', (work) => ({
      ...work, causes: work.causes.map((one) => (one.id === 'rc-in' ? cause('rc-in', 2) : one)),
    }))
    expect(refused).toEqual({ ok: false, reason: 'command.rootAddressed' })
    expect((await store.load('claims/intake'))?.revision).toBe(before?.revision)
  })

  it('says when there is nothing to change and when there is no such scope', async () => {
    const store = tree()
    expect(await landBelow(store, 'claims/intake', (work) => work)).toEqual({ ok: false, reason: 'unchanged' })
    expect(await landBelow(store, 'claims/intake', () => undefined)).toEqual({ ok: false, reason: 'unchanged' })
    expect(await landBelow(store, 'billing', (work) => work)).toEqual({ ok: false, reason: 'gone' })
  })

  it('leaves a list it empties absent, the way the folder reads it', async () => {
    const store = tree()
    await landBelow(store, 'claims', (work) => ({ ...work, causes: [] }))
    expect((await store.load('claims'))?.model).not.toHaveProperty('causes')
  })
})

describe('useChangeBelow', () => {
  it('lands through the store and tells the tree, asking first whether anything may be written', async () => {
    const store = tree()
    let told = 0
    let may = true
    const { result } = renderHook(() => useChangeBelow({ scopes: store, mayChange: () => may, onTreeChanged: () => { told += 1 } }))
    const add = (work: Parameters<Parameters<typeof result.current>[1]>[0]) => ({ ...work, causes: [...work.causes, cause('ca-new', 3)] })
    expect(await result.current('claims/intake', add)).toEqual({ ok: true })
    expect(told).toBe(1)
    expect((await store.load('claims/intake'))?.model.causes?.map((one) => one.id)).toEqual(['ca-in', 'rc-in', 'ca-new'])
    may = false
    expect(await result.current('claims', add)).toEqual({ ok: false, reason: 'readOnly' })
    expect(told).toBe(1)
    expect((await store.load('claims'))?.model.causes).toEqual([cause('ca-claims', 1)])
  })

  it('reads no scope from a store that cannot load one', async () => {
    const { result } = renderHook(() => useChangeBelow({ scopes: { save: () => Promise.resolve() }, mayChange: () => true }))
    expect(await result.current('claims', (work) => work)).toEqual({ ok: false, reason: 'gone' })
  })
})
