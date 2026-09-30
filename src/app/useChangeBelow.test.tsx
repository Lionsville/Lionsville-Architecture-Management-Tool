// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A change to a scope below, made from the page above (ADR-0032 §2): a step
 * on that scope and nowhere else, applied by its writer through the source's
 * repositories, expecting what was read — and kept in that scope's history,
 * as every step applied to it is. Over a three-level tree — the
 * organisation, a domain, a team.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { laidOut } from '../model/testFixtures'
import type { HostModel } from '../model/hostModel'
import type { Cause, Observation, Solution } from '../model/observation'
import type { Repositories } from '../ports/Repositories'
import { placeWhole, readScope } from '../projects/scopeAccess'
import { emptyContent } from '../projects/scopeState'
import { landBelow, useChangeBelow } from './useChangeBelow'
import type { BelowScopes } from './useChangeBelow'

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

const content = (name: string, over: Partial<HostModel> = {}) => {
  const empty = emptyContent(name)
  return {
    ...empty,
    model: { ...empty.model, diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })], ...over },
  }
}

async function tree(): Promise<Repositories> {
  const repositories = memoryRepositories()
  const { scopes } = repositories
  await placeWhole(scopes, '', content('Acme'))
  await placeWhole(scopes, 'claims', content('Claims', { causes: [cause('ca-claims', 1)] }))
  await placeWhole(scopes, 'claims/intake', content('Intake', {
    observations: [observation('ob-in', 1)],
    causes: [cause('ca-in', 1, { explains: [{ id: 'ob-in', strength: 'normal' }] }), cause('rc-in', 2, { root: true })],
    solutions: [solution('so-in', 'rc-in')],
  }))
  // What was placed is history already; a change below opens an entry of its own.
  await repositories.history.record({})
  return repositories
}

const seenAgain = (work: Parameters<Parameters<typeof landBelow>[2]>[0]) => ({
  ...work, observations: work.observations.map((one) => ({ ...one, seen: one.seen + 1 })),
})

describe('landing a change on a scope below', () => {
  it('is a step on the scope below and nothing else', async () => {
    const { scopes } = await tree()
    const before = await readScope(scopes, 'claims')
    expect(await landBelow(scopes, 'claims/intake', seenAgain)).toEqual({ ok: true })
    expect((await readScope(scopes, 'claims/intake'))?.model.observations?.[0].seen).toBe(2)
    expect((await readScope(scopes, 'claims'))?.revision).toBe(before?.revision)
    expect((await readScope(scopes, ''))?.model.causes).toBeUndefined()
  })

  it('is kept in that scope’s history, and in no other scope’s', async () => {
    const { scopes, history } = await tree()
    await landBelow(scopes, 'claims/intake', seenAgain)
    const intake = (await readScope(scopes, 'claims/intake'))!.id!
    const claims = (await readScope(scopes, 'claims'))!.id!
    const recorded = await history.record({ subject: 'After a change from above' })
    expect(recorded.map((entry) => entry.scope)).toEqual([intake])
    const { entries } = await history.entries({ scopes: [intake], record: { kind: 'observation', id: 'ob-in' } })
    expect(entries[0].subject).toBe('After a change from above')
    expect((await history.stateAt(intake, entries[0].id))?.model.observations?.[0].seen).toBe(2)
    expect((await history.entries({ scopes: [claims] })).entries.every((entry) => entry.subject !== 'After a change from above')).toBe(true)
  })

  it('is one step however many records it changes, as one submit is one step', async () => {
    const { scopes } = await tree()
    const applied: number[] = []
    const counting: BelowScopes = {
      tree: () => scopes.tree(), state: (id) => scopes.state(id),
      apply: (writes) => { applied.push(...writes.map((write) => write.steps.length)); return scopes.apply(writes) },
    }
    await landBelow(counting, 'claims/intake', (work) => ({
      ...seenAgain(work), causes: [...work.causes, cause('ca-new', 3, { explains: [{ id: 'ob-in', strength: 'weak' }] })],
    }))
    expect(applied).toEqual([1])
  })

  it('is refused below as it is here, by the one writer and with its key, and writes nothing', async () => {
    const { scopes } = await tree()
    const before = await readScope(scopes, 'claims/intake')
    // Made a cause again while a solution addresses it (ADR-0032 §3).
    const refused = await landBelow(scopes, 'claims/intake', (work) => ({
      ...work, causes: work.causes.map((one) => (one.id === 'rc-in' ? cause('rc-in', 2) : one)),
    }))
    expect(refused).toEqual({ ok: false, reason: 'command.rootAddressed' })
    expect((await readScope(scopes, 'claims/intake'))?.revision).toBe(before?.revision)
  })

  it('works the change out again over a scope somebody changed in between', async () => {
    const { scopes } = await tree()
    let asked = 0
    let first = true
    const racing: BelowScopes = {
      tree: () => scopes.tree(), state: (id) => scopes.state(id),
      apply: async (writes) => {
        // Somebody else sees it again after this change was worked out, and before it lands.
        if (first) { first = false; await landBelow(scopes, 'claims/intake', seenAgain) }
        return scopes.apply(writes)
      },
    }
    const landed = await landBelow(racing, 'claims/intake', (work) => { asked += 1; return seenAgain(work) })
    expect(landed).toEqual({ ok: true })
    expect(asked).toBe(2)
    expect((await readScope(scopes, 'claims/intake'))?.model.observations?.[0].seen).toBe(3)
  })

  it('says when there is nothing to change and when there is no such scope', async () => {
    const { scopes } = await tree()
    expect(await landBelow(scopes, 'claims/intake', (work) => work)).toEqual({ ok: false, reason: 'unchanged' })
    expect(await landBelow(scopes, 'claims/intake', () => undefined)).toEqual({ ok: false, reason: 'unchanged' })
    expect(await landBelow(scopes, 'billing', (work) => work)).toEqual({ ok: false, reason: 'gone' })
  })
})

describe('useChangeBelow', () => {
  it('lands through the repositories and tells the tree, asking first whether anything may be written', async () => {
    const { scopes } = await tree()
    let told = 0
    let may = true
    const { result } = renderHook(() => useChangeBelow({ scopes, mayChange: () => may, onTreeChanged: () => { told += 1 } }))
    const add = (work: Parameters<Parameters<typeof result.current>[1]>[0]) => ({ ...work, causes: [...work.causes, cause('ca-new', 3)] })
    expect(await result.current('claims/intake', add)).toEqual({ ok: true })
    expect(told).toBe(1)
    expect((await readScope(scopes, 'claims/intake'))?.model.causes?.map((one) => one.id)).toEqual(['ca-in', 'rc-in', 'ca-new'])
    may = false
    expect(await result.current('claims', add)).toEqual({ ok: false, reason: 'readOnly' })
    expect(told).toBe(1)
    expect((await readScope(scopes, 'claims'))?.model.causes).toEqual([cause('ca-claims', 1)])
  })
})
