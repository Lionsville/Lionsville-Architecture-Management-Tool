// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The watch on the app's repositories: every write that did not land is in
 * one list, a write that answered a question is not, and either way out —
 * made again, or put back — takes it off.
 */
import { describe, expect, it, vi } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import type { Repositories } from '../ports/Repositories'
import { changeScope, ensureScope, readScope } from '../projects/scopeAccess'
import { refusalOf } from '../projects/refusalTag'
import { SCOPE_MOVED } from '../projects/revision'
import { unwatched, watchRepositories, writeRefusals } from './writeRefusals'

/** Memory repositories whose writes refuse while `refusing.now` says so: a folder made read-only and writable again. */
function refusingWhile(refusing: { now: boolean }): Repositories {
  const held = memoryRepositories()
  const scopes = held.scopes
  const apply = scopes.apply.bind(scopes)
  const people = held.people
  const add = people.add.bind(people)
  return {
    ...held,
    scopes: Object.assign(Object.create(scopes) as typeof scopes, {
      apply: (work: Parameters<typeof apply>[0]) => (refusing.now ? Promise.reject(new Error('EACCES')) : apply(work)),
    }),
    people: Object.assign(Object.create(people) as typeof people, {
      add: (person: Parameters<typeof add>[0]) => (refusing.now ? Promise.reject(new Error('EACCES')) : add(person)),
    }),
  }
}

async function scopeAt(repositories: Repositories, path: string) {
  await ensureScope(repositories.scopes, path, { name: 'Rail' })
}

const rename = (name: string) => () => [{ type: 'project.settings' as const, patch: { name } }]

describe('watchRepositories', () => {
  it('lists a write the store rejected, tagged so the caller can tell which it was', async () => {
    const refusing = { now: false }
    const store = writeRefusals()
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await scopeAt(repositories, 'rail')
    refusing.now = true
    const caught = await changeScope(repositories.scopes, 'rail', rename('Rail renamed')).catch((cause: unknown) => cause)
    expect((caught as Error).message).toBe('EACCES')
    expect(store.list()).toHaveLength(1)
    expect(refusalOf(caught)).toBe(store.list()[0]!.id)
  })

  it('leaves out a refusal that answers a question, and counts one that means nothing was kept', async () => {
    const store = writeRefusals()
    const held = memoryRepositories()
    const answers = [{ refused: SCOPE_MOVED }, { refused: 'shell.scopeTaken' }, { refused: 'shell.scopeReadOnly' }]
    const repositories = watchRepositories({ ...held, scopes: { ...held.scopes, id: 'x', apply: () => Promise.resolve(answers.shift() as never) } }, store)
    await repositories.scopes.apply([])
    await repositories.scopes.apply([])
    expect(store.list()).toHaveLength(0)
    const readOnly = await repositories.scopes.apply([])
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0]!.key).toBe('shell.scopeReadOnly')
    expect(refusalOf(readOnly)).toBe(store.list()[0]!.id)
  })

  it('makes every refused write again, takes off those that land, and has the screen read again', async () => {
    const refusing = { now: false }
    const landed = vi.fn()
    const store = writeRefusals(landed)
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await scopeAt(repositories, 'rail')
    refusing.now = true
    await changeScope(repositories.scopes, 'rail', rename('Rail renamed')).catch(() => undefined)
    await repositories.people.add({ name: 'Ada' }).catch(() => undefined)
    expect(store.list()).toHaveLength(2)

    expect(await store.retry()).toBe(false)
    expect(store.list()).toHaveLength(2)
    expect(landed).not.toHaveBeenCalled()

    refusing.now = false
    expect(await store.retry()).toBe(true)
    expect(store.list()).toHaveLength(0)
    expect(landed).toHaveBeenCalledOnce()
    expect((await readScope(repositories.scopes, 'rail'))?.model.name).toBe('Rail renamed')
    expect((await repositories.people.list()).people.map((one) => one.name)).toContain('Ada')
  })

  it('makes two refused changes to one scope again in order, the second over the scope the first moved', async () => {
    const refusing = { now: false }
    const store = writeRefusals()
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await scopeAt(repositories, 'rail')
    refusing.now = true
    await changeScope(repositories.scopes, 'rail', rename('Rail freight')).catch(() => undefined)
    await changeScope(repositories.scopes, 'rail', () => [{ type: 'project.settings' as const, patch: { name: 'Rail freight', description: 'Freight lines' } }]).catch(() => undefined)
    refusing.now = false
    expect(await store.retry()).toBe(true)
    const kept = await readScope(repositories.scopes, 'rail')
    expect(kept?.model.name).toBe('Rail freight')
    expect(kept?.model.description).toBe('Freight lines')
  })

  it('does not count a refusal as landed when it is tried again', async () => {
    const store = writeRefusals()
    const held = memoryRepositories()
    const answers: unknown[] = [{ refused: 'shell.scopeReadOnly' }, { refused: 'shell.scopeGone' }]
    const repositories = watchRepositories({ ...held, scopes: { ...held.scopes, id: 'x', apply: () => Promise.resolve(answers.shift() as never) } }, store)
    await repositories.scopes.apply([])
    expect(await store.retry()).toBe(false)
    expect(store.list()).toHaveLength(1)
  })

  it('puts back one refusal, or every one, and tells whoever listens', async () => {
    const refusing = { now: true }
    const store = writeRefusals()
    const heard = vi.fn()
    store.subscribe(heard)
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await repositories.people.add({ name: 'Ada' }).catch(() => undefined)
    await repositories.people.add({ name: 'Bo' }).catch(() => undefined)
    store.forget(store.list()[0]!.id)
    expect(store.list()).toHaveLength(1)
    store.forget()
    expect(store.list()).toHaveLength(0)
    expect(heard).toHaveBeenCalledTimes(4)
  })

  it('keeps what it does not watch as it was, and hands the session the repository underneath', async () => {
    const held = memoryRepositories()
    const store = writeRefusals()
    const repositories = watchRepositories(held, store)
    expect(repositories.index).toBe(held.index)
    expect(repositories.scopes.id).toBe(held.scopes.id)
    expect(unwatched(repositories.scopes)).toBe(held.scopes)
    expect(unwatched(held.scopes)).toBe(held.scopes)
    expect((await repositories.scopes.tree()).root).toBeDefined()
  })
})
