// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A change to several scopes as one, made from the observations page
 * (ADR-0035 §5): the scopes other than the open one in one apply, each as its
 * own step expecting what was read; the open one through its session, after
 * them, with a barrier where others were written. Over a three-level tree —
 * the organisation, a domain, a team — with the organisation open.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { fromArrays, toArrays } from '../model'
import type { Command, Model } from '../model'
import { apply } from '../model/reducer'
import { laidOut } from '../model/testFixtures'
import type { HostModel } from '../model/hostModel'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../model/observation'
import { ACROSS_BARRIER, planMerge } from '../observations/merge'
import type { ObservationWork } from '../observations/ui/ObservationsPage'
import type { Repositories } from '../ports/Repositories'
import { placeWhole, readScope } from '../projects/scopeAccess'
import { emptyContent } from '../projects/scopeState'
import { landAcross, useChangeAcross } from './useChangeAcross'
import type { AcrossDeps } from './useChangeAcross'
import type { BelowScopes } from './useChangeBelow'

afterEach(() => cleanup())

const observation = (id: string, number: number, seen = 1): Observation => ({
  id, number, title: id, date: '2026-09-01', impact: 'minor', seen, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }],
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

const ROOT = content('Acme', { observations: [observation('ob-org', 1, 2)] })

async function tree(): Promise<Repositories> {
  const repositories = memoryRepositories()
  const { scopes } = repositories
  await placeWhole(scopes, '', ROOT)
  await placeWhole(scopes, 'claims', content('Claims', { observations: [observation('ob-cl', 1)], causes: [cause('ca-claims', 1)] }))
  await placeWhole(scopes, 'claims/intake', content('Intake', {
    observations: [observation('ob-in', 1, 3)],
    causes: [cause('ca-in', 1, { explains: [{ id: 'ob-in', strength: 'normal' }] }), cause('rc-in', 2, { root: true })],
    solutions: [solution('so-in', 'rc-in')],
  }))
  return repositories
}

/** The open scope's session, as far as a change across reaches it: a model, and the one way in. */
function session(host: HostModel = ROOT.model) {
  let model: Model = fromArrays(host)
  const dispatched: Command[] = []
  return {
    dispatched,
    model: () => toArrays(model),
    indexed: () => model,
    dispatch: (command: Command) => {
      const result = apply(model, command)
      if (!result?.ok) return undefined
      model = result.model
      dispatched.push(command)
      return model
    },
  }
}

function deps(scopes: BelowScopes, over: Partial<AcrossDeps> = {}) {
  const open = session()
  let saved = 0
  const made: AcrossDeps = {
    scope: '', scopes, session: open, writable: () => true, save: () => { saved += 1; return Promise.resolve() }, ...over,
  }
  return { deps: made, open, saved: () => saved }
}

const counting = (scopes: BelowScopes, applies: number[]): BelowScopes => ({
  tree: () => scopes.tree(), state: (id) => scopes.state(id),
  apply: (work) => { applies.push(work.length); return scopes.apply(work) },
})

const seenAgain = (work: ObservationWork): ObservationWork => ({
  ...work, observations: work.observations.map((one) => ({ ...one, seen: one.seen + 1 })),
})

/** Every scope read, seen once more: a change that writes all of them. */
const everywhere = (held: ReadonlyMap<string, ObservationWork>) => new Map([...held].map(([path, work]) => [path, seenAgain(work)]))

describe('landing a change on several scopes', () => {
  it('writes the other scopes in one apply, then this one through its session, with a barrier, written at once', async () => {
    const { scopes } = await tree()
    const applies: number[] = []
    const { deps: made, open, saved } = deps(counting(scopes, applies))
    const landed = await landAcross(made, ['', 'claims', 'claims/intake'], everywhere)
    expect(landed).toEqual({ ok: true, changed: ['claims', 'claims/intake', ''] })
    expect(applies).toEqual([2])
    expect((await readScope(scopes, 'claims'))?.model.observations?.[0].seen).toBe(2)
    expect((await readScope(scopes, 'claims/intake'))?.model.observations?.[0].seen).toBe(4)
    // The open scope is not written through the repository: its session is.
    expect((await readScope(scopes, ''))?.model.observations?.[0].seen).toBe(2)
    expect(open.model().observations?.[0].seen).toBe(3)
    expect(open.dispatched.map((one) => one.barrier)).toEqual([ACROSS_BARRIER])
    expect(saved()).toBe(1)
  })

  it('reads the open scope from its session, which may hold what is not written yet', async () => {
    const { scopes } = await tree()
    const { deps: made } = deps(scopes, { session: session({ ...ROOT.model, observations: [observation('ob-org', 1, 9)] }) })
    let read: number | undefined
    await landAcross(made, ['', 'claims'], (held) => { read = held.get('')?.observations[0].seen; return everywhere(held) })
    expect(read).toBe(9)
  })

  it('changes this scope alone as an ordinary step: no apply, no barrier, written when the session writes', async () => {
    const { scopes } = await tree()
    const applies: number[] = []
    const { deps: made, open, saved } = deps(counting(scopes, applies))
    expect(await landAcross(made, [''], everywhere)).toEqual({ ok: true, changed: [''] })
    expect(applies).toEqual([])
    expect(open.dispatched.map((one) => one.barrier)).toEqual([undefined])
    expect(saved()).toBe(0)
  })

  it('writes other scopes alone without touching the session', async () => {
    const { scopes } = await tree()
    const { deps: made, open } = deps(scopes)
    expect(await landAcross(made, ['', 'claims'], (held) => new Map([['claims', seenAgain(held.get('claims')!)]]))).toEqual({ ok: true, changed: ['claims'] })
    expect(open.dispatched).toEqual([])
  })

  it('leaves the writing to the source where it carries every step, and says so where writing failed', async () => {
    const { scopes } = await tree()
    const carried = deps(scopes, { published: true })
    await landAcross(carried.deps, ['', 'claims'], everywhere)
    expect(carried.saved()).toBe(0)
    const failing = deps(scopes, { save: () => Promise.reject(new Error('disk full')) })
    expect(await landAcross(failing.deps, ['', 'claims'], everywhere)).toEqual({ ok: true, changed: ['claims', ''], unsaved: true })
  })

  it('writes nothing where the person may not change a scope it writes, and names that scope', async () => {
    const { scopes } = await tree()
    const before = await readScope(scopes, 'claims')
    const { deps: made, open } = deps(scopes, { writable: (path) => path !== 'claims/intake' })
    expect(await landAcross(made, ['', 'claims', 'claims/intake'], everywhere)).toEqual({ ok: false, reason: 'shell.scopeReadOnly', scope: 'claims/intake' })
    expect((await readScope(scopes, 'claims'))?.revision).toBe(before?.revision)
    expect(open.dispatched).toEqual([])
    // A scope only read is not asked.
    const reading = deps(scopes, { writable: (path) => path !== 'claims/intake' })
    expect(await landAcross(reading.deps, ['', 'claims', 'claims/intake'], (held) => new Map([['claims', seenAgain(held.get('claims')!)]]))).toMatchObject({ ok: true })
  })

  it('writes nothing where the source refuses a scope, or a writer refuses a step, or this session would', async () => {
    const { scopes } = await tree()
    const before = await readScope(scopes, 'claims')
    const refusing: BelowScopes = {
      tree: () => scopes.tree(), state: (id) => scopes.state(id),
      apply: (work) => Promise.resolve({ refused: 'shell.scopeReadOnly', scope: work[0].scope }),
    }
    const shut = deps(refusing)
    expect(await landAcross(shut.deps, ['', 'claims'], everywhere)).toEqual({ ok: false, reason: 'shell.scopeReadOnly' })
    expect(shut.open.dispatched).toEqual([])
    // Made a cause again while a solution addresses it (ADR-0032 §3), below.
    const { deps: made, open } = deps(scopes)
    const unrooted = (held: ReadonlyMap<string, ObservationWork>) => new Map([
      ['claims', seenAgain(held.get('claims')!)],
      ['claims/intake', { ...held.get('claims/intake')!, causes: held.get('claims/intake')!.causes.map((one) => (one.id === 'rc-in' ? cause('rc-in', 2) : one)) }],
    ])
    expect(await landAcross(made, ['', 'claims', 'claims/intake'], unrooted)).toEqual({ ok: false, reason: 'command.rootAddressed' })
    expect((await readScope(scopes, 'claims'))?.revision).toBe(before?.revision)
    expect(open.dispatched).toEqual([])
    // This session refuses a record added twice: nothing anywhere is written.
    const twice = deps(scopes)
    const doubled = (held: ReadonlyMap<string, ObservationWork>) => {
      const here = held.get('')!
      return new Map([['claims', seenAgain(held.get('claims')!)], ['', { ...here, causes: [...here.causes, cause('x', 1), cause('x', 2)] }]])
    }
    expect(await landAcross(twice.deps, ['', 'claims'], doubled)).toEqual({ ok: false, reason: 'command.taken' })
    expect((await readScope(scopes, 'claims'))?.revision).toBe(before?.revision)
  })

  it('says so where the other scopes landed and this session then refused its own part', async () => {
    const { scopes } = await tree()
    const open = session()
    const { deps: made } = deps(scopes, { session: { indexed: open.indexed, dispatch: () => undefined } })
    expect(await landAcross(made, ['', 'claims'], everywhere)).toEqual({ ok: false, reason: 'partial', changed: ['claims'] })
  })

  it('says a refusal of the change’s own, nothing to change, and a scope gone', async () => {
    const { scopes } = await tree()
    const { deps: made } = deps(scopes)
    expect(await landAcross(made, ['', 'claims'], () => ({ refused: 'merged' }))).toEqual({ ok: false, reason: 'refused', refused: 'merged' })
    expect(await landAcross(made, ['', 'claims'], () => undefined)).toEqual({ ok: false, reason: 'unchanged' })
    expect(await landAcross(made, ['', 'claims'], (held) => new Map(held))).toEqual({ ok: false, reason: 'unchanged' })
    expect(await landAcross(made, ['', 'billing'], everywhere)).toEqual({ ok: false, reason: 'gone' })
    await expect(landAcross(made, ['claims'], (held) => new Map([...held, ['billing', seenAgain(held.get('claims')!)]]))).rejects.toThrow(/did not read/)
  })

  it('works the whole change out again over a scope somebody changed in between', async () => {
    const { scopes } = await tree()
    let first = true
    const racing: BelowScopes = {
      tree: () => scopes.tree(), state: (id) => scopes.state(id),
      apply: async (work) => {
        if (first) { first = false; await landAcross(deps(scopes).deps, ['claims'], everywhere) }
        return scopes.apply(work)
      },
    }
    let asked = 0
    const { deps: made } = deps(racing)
    expect(await landAcross(made, ['claims'], (held) => { asked += 1; return everywhere(held) })).toEqual({ ok: true, changed: ['claims'] })
    expect(asked).toBe(2)
    expect((await readScope(scopes, 'claims'))?.model.observations?.[0].seen).toBe(3)
  })

  it('lands a merge across the tree as the planner wrote it', async () => {
    const { scopes } = await tree()
    const { deps: made, open } = deps(scopes)
    const landed = await landAcross(made, ['', 'claims', 'claims/intake'], (held) => {
      const plan = planMerge({
        kind: 'observation', survivor: { scope: '', id: 'ob-org' }, absorbed: [{ scope: 'claims/intake', id: 'ob-in' }],
        scopes: [...held].map(([scope, work]): ScopeAnalysis => ({ scope, ...work })), date: '2026-10-08',
      })
      return plan.ok ? new Map(plan.writes.map(({ scope, ...work }) => [scope, { ...work, observations: [...work.observations], causes: [...work.causes], solutions: [...work.solutions], experiments: [...work.experiments] }])) : { refused: plan.refusal }
    })
    expect(landed).toEqual({ ok: true, changed: ['claims/intake', ''] })
    expect(open.model().observations?.[0]).toMatchObject({ seen: 5 })
    expect((await readScope(scopes, 'claims/intake'))?.model.observations?.[0].history.at(-1)).toEqual({ date: '2026-10-08', kind: 'merged', id: 'ob-org', scope: '' })
  })
})

describe('useChangeAcross', () => {
  it('lands through the repositories and the session and tells the tree, asking first whether anything may be written', async () => {
    const { scopes } = await tree()
    let told = 0
    let may = true
    const open = session()
    const { result } = renderHook(() => useChangeAcross({
      scope: '', scopes, session: open, writable: () => true, save: () => Promise.resolve(),
      mayChange: () => may, onTreeChanged: () => { told += 1 },
    }))
    expect(await result.current(['', 'claims'], everywhere)).toEqual({ ok: true, changed: ['claims', ''] })
    expect(told).toBe(1)
    expect(await result.current([''], everywhere)).toEqual({ ok: true, changed: [''] })
    expect(told).toBe(1)
    may = false
    expect(await result.current(['', 'claims'], everywhere)).toEqual({ ok: false, reason: 'readOnly' })
    expect((await readScope(scopes, 'claims'))?.model.observations?.[0].seen).toBe(2)
  })
})
