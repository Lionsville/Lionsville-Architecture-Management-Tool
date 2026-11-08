// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { ScopeStep } from '../../projects/scopeState'
import type { KeyValueStorage } from './KeyValueStorage'
import { KEPT_FOR_MS, MOST_HELD, pendingSteps } from './pendingSteps'
import type { PageLocks } from './pendingSteps'

function fakeStorage(): KeyValueStorage & { held: Map<string, string> } {
  const held = new Map<string, string>()
  return {
    held,
    getItem: (k) => held.get(k) ?? null,
    setItem: (k, v) => { held.set(k, v) },
    removeItem: (k) => { held.delete(k) },
    keys: () => [...held.keys()],
  }
}

/** Locks held by the pages named. */
const locksOf = (...open: string[]): PageLocks => ({
  request: () => Promise.resolve(),
  query: () => Promise.resolve({ held: open.map((page) => ({ name: `lvarch.page:${page}` })) }),
})

const step = (n: number): ScopeStep => ({ stepId: `s${n}`, command: { type: 'scope.describe', patch: { activeDiagramId: `d${n}` } }, at: n })
const scope = { id: 'sc-1', address: 'acme' }

describe('pendingSteps', () => {
  it('holds the steps at once, puts the latest in place of the earlier, and clears on nothing', () => {
    const storage = fakeStorage()
    const line = pendingSteps('browser', storage, { pageId: 'a' })
    expect(line.hold(scope, 'r1', [step(1)])).toBe(true)
    expect(line.hold(scope, 'r1', [step(1), step(2)])).toBe(true)
    expect(storage.held.size).toBe(1)
    expect(JSON.parse([...storage.held.values()][0]!).steps).toHaveLength(2)
    line.hold(scope, 'r2', [])
    expect(storage.held.size).toBe(0)
  })

  it('reads back a page that is gone, never one still open, never its own and never another source', async () => {
    const storage = fakeStorage()
    pendingSteps('browser', storage, { pageId: 'gone' }).hold(scope, 'r1', [step(1)], { 'element:a': 'p1' })
    pendingSteps('browser', storage, { pageId: 'open' }).hold(scope, 'r1', [step(2)])
    pendingSteps('folder:x', storage, { pageId: 'gone' }).hold(scope, 'r1', [step(3)])
    const me = pendingSteps('browser', storage, { pageId: 'me', locks: locksOf('open', 'me') })
    me.hold(scope, 'r1', [step(4)])
    const left = await me.left()
    expect(left.map((one) => one.steps[0]!.stepId)).toEqual(['s1'])
    expect(left[0]!.touched).toEqual({ 'element:a': 'p1' })
    left[0]!.release()
    expect(await me.left()).toEqual([])
    expect(storage.held.size).toBe(3)
  })

  it('without locks reads back only the page this one was before a reload', async () => {
    const storage = fakeStorage()
    pendingSteps('browser', storage, { pageId: 'other' }).hold(scope, 'r1', [step(1)])
    const before = pendingSteps('browser', storage, { pageId: 'before' })
    before.hold(scope, 'r1', [step(2)])
    const left = await pendingSteps('browser', storage, { pageId: 'after', pageBefore: 'before' }).left()
    expect(left.map((one) => one.steps[0]!.stepId)).toEqual(['s2'])
  })

  it('is bounded: a line too large is not held and clears the one before, and an old line is dropped', async () => {
    const storage = fakeStorage()
    let now = 1_000
    const line = pendingSteps('browser', storage, { pageId: 'a', now: () => now })
    line.hold(scope, 'r1', [step(1)])
    const big: ScopeStep = { stepId: 'big', command: { type: 'scope.describe', patch: { activeDiagramId: 'x'.repeat(MOST_HELD) } }, at: 1 }
    expect(line.hold(scope, 'r1', [big])).toBe(false)
    expect(storage.held.size).toBe(0)
    line.hold(scope, 'r1', [step(1)])
    now += KEPT_FOR_MS + 1
    expect(await pendingSteps('browser', storage, { pageId: 'b', now: () => now, locks: locksOf() }).left()).toEqual([])
    expect(storage.held.size).toBe(0)
  })

  it('answers false and keeps nothing where the storage refuses', () => {
    const storage = { ...fakeStorage(), setItem: () => { throw new Error('quota') } }
    expect(pendingSteps('browser', storage, { pageId: 'a' }).hold(scope, 'r1', [step(1)])).toBe(false)
  })
})
