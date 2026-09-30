// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a keyed store keeps of a scope's content, by the format it was kept at
 * (ADR-0032 §9): a content kept at format 1, before a root cause was said, is
 * read as the domain reads such an analysis and written at 2 by the next
 * write; one a later build kept at 3 or more is read in part and not stepped
 * on. Work brought from somewhere else arrives the same way, and the index
 * carries a scope's whole analysis for the scopes above it.
 */
import { describe, expect, it } from 'vitest'
import type { Cause, Observation, Solution } from '../../model/observation'
import { step } from '../../ports/Repositories.contract'
import { emptyContent } from '../../projects/scopeState'
import type { ScopeContent, ScopeId } from '../../projects/scopeState'
import { MemoryStore } from '../memory/MemoryStore'
import type { Brought } from './bring'
import { CONTENT_FORMAT } from './kept'
import type { KeptContent } from './kept'
import { SHELVES } from './KeyedStore'
import { repositoriesOn, repositoriesOver } from './repositoriesOver'
import { Source } from './source'

const cause = (id: string, number: number, over: Partial<Cause> = {}): Cause => ({
  id, number, title: id, state: 'assumed', body: '', explains: [], ...over,
})
const solution = (id: string, causeId: string, state: Solution['state'] = 'idea'): Solution => ({
  id, number: 1, title: id, state, addresses: [{ id: causeId, strength: 'strong' }],
  validatedWith: [], attempts: [], body: '', history: [],
})
const sharedBefore = { ...{
  id: 'ob-1', number: 1, title: 'Seen', date: '2026-09-01', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }, { date: '2026-09-02', kind: 'shared' }],
} satisfies Observation, shared: true }

/** A content as a build before ADR-0032 kept it: no cause says it is a root, and an observation was shared. */
const before = (name: string): ScopeContent['model'] => ({
  ...emptyContent(name).model,
  observations: [sharedBefore],
  causes: [cause('ca-1', 1, { explains: [{ id: 'ob-1', strength: 'strong' }] }), cause('ca-2', 2)],
  solutions: [solution('so-1', 'ca-1')],
})

async function keptAt(format: number) {
  const store = new MemoryStore()
  const repositories = repositoriesOver(store, { id: 'kept', by: 'test' })
  const made = await repositories.scopes.create('claims', { name: 'Claims' })
  if ('refused' in made) throw new Error(made.refused)
  await store.transaction(SHELVES, 'write', async (tx) => {
    tx.put('contents', made.id, { format, model: before('Claims'), description: {} } satisfies KeptContent)
  })
  const raw = (id: ScopeId) => store.transaction(SHELVES, 'read', (tx) => tx.get<KeptContent>('contents', id))
  return { repositories, id: made.id, raw }
}

describe('a content kept at format 1, before a root cause was said', () => {
  it('reads a cause a live solution addresses as a root cause, and drops `shared`', async () => {
    const { repositories, id } = await keptAt(1)
    const state = await repositories.scopes.state(id)
    expect(state?.unreadable).toBeUndefined()
    expect(state?.model.causes?.map((one) => [one.id, one.root])).toEqual([['ca-1', true], ['ca-2', undefined]])
    expect(state?.model.observations?.[0]).not.toHaveProperty('shared')
    expect(state?.model.observations?.[0].history.map((event) => event.kind)).toEqual(['recorded', 'shared'])
  })

  it('is written at the format of this build by the next step, saying its roots', async () => {
    const { repositories, id, raw } = await keptAt(1)
    const state = await repositories.scopes.state(id)
    await repositories.scopes.apply([{ scope: id, expects: state!.revision, steps: [step({ type: 'cause.update', id: 'ca-2', patch: { title: 'Nobody plans capacity' } })] }])
    const written = await raw(id)
    expect(written?.format).toBe(CONTENT_FORMAT)
    expect(written?.model.causes?.map((one) => [one.id, one.root])).toEqual([['ca-1', true], ['ca-2', undefined]])
    expect(written?.model.observations?.[0]).not.toHaveProperty('shared')
  })

  it('is read so by the index as well', async () => {
    const { repositories, id } = await keptAt(1)
    const indexed = (await repositories.index.read()).scopes.find((scope) => scope.id === id)
    expect(indexed?.model.causes?.map((one) => [one.id, one.root])).toEqual([['ca-1', true], ['ca-2', undefined]])
  })
})

describe('a content a later build kept', () => {
  it('is read in part at format 3, and no step lands on it', async () => {
    const { repositories, id, raw } = await keptAt(3)
    const state = await repositories.scopes.state(id)
    expect(state?.later).toBe(true)
    expect(state?.unreadable).toEqual(['written by a later version (format 3)'])
    const answer = await repositories.scopes.apply([{ scope: id, expects: state!.revision, steps: [step({ type: 'cause.remove', id: 'ca-2' })] }])
    expect(answer).toHaveProperty('refused')
    expect((await raw(id))?.format).toBe(3)
  })
})

describe('the index', () => {
  it('carries a scope’s whole analysis: observations, causes, solutions and experiments', async () => {
    const repositories = repositoriesOver(new MemoryStore(), { id: 'kept', by: 'test' })
    const made = await repositories.scopes.create('claims', { name: 'Claims' })
    if ('refused' in made) throw new Error(made.refused)
    await repositories.scopes.apply([{ scope: made.id, steps: [
      step({ type: 'cause.add', cause: cause('ca-1', 1, { root: true }) }),
      step({ type: 'solution.add', solution: solution('so-1', 'ca-1') }),
      step({ type: 'experiment.add', experiment: {
        id: 'ex-1', number: 1, title: 'Try it', hypothesis: 'It holds', tests: ['so-1'], outcome: 'running', body: '',
      } }),
    ] }])
    const indexed = (await repositories.index.read()).scopes.find((scope) => scope.id === made.id)
    expect(indexed?.model.causes?.map((one) => one.id)).toEqual(['ca-1'])
    expect(indexed?.model.solutions?.map((one) => one.id)).toEqual(['so-1'])
    expect(indexed?.model.experiments?.map((one) => one.id)).toEqual(['ex-1'])
  })
})

describe('work brought from somewhere else, kept before a root cause was said', () => {
  const arrival = (note: number): Brought => ({
    subject: 'Brought', safeguard: 'Before', note,
    scopes: [{ address: 'claims', content: { ...emptyContent('Claims'), model: before('Claims') }, bytes: [] }],
  })

  it('lands saying its roots, and the same copy brought again is no change', async () => {
    const store = new MemoryStore()
    const source = (brought: Brought) => new Source(store, { id: 'brought', by: 'test', bring: { prepare: () => Promise.resolve(brought) } })
    const repositories = repositoriesOn(source(arrival(1)))
    const claims = (await repositories.scopes.tree()).root.children[0]
    const state = await repositories.scopes.state(claims.id)
    expect(state?.model.causes?.map((one) => [one.id, one.root])).toEqual([['ca-1', true], ['ca-2', undefined]])
    expect(state?.model.observations?.[0]).not.toHaveProperty('shared')

    // Worked on here since; the copy kept elsewhere is as it was, so nobody is asked about it.
    await repositories.scopes.apply([{ scope: claims.id, steps: [step({ type: 'cause.remove', id: 'ca-2' })] }])
    const again = source(arrival(2))
    await repositoriesOn(again).scopes.tree()
    expect((await again.lastBrought())?.diverged).toEqual([])
  })
})
