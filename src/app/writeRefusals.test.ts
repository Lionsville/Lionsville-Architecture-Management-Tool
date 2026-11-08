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
import { handOver, holdWrite, stepsSummary, unwatched, watchRepositories, whenLanded, writeRefusals, writesUnderway } from './writeRefusals'

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

  /** Every write the app makes outside the open session, each refused once: each stands in the list, with its reason, to be made again. */
  it('lists a refused write from every repository it watches, each with what refused it and a way to make it again', async () => {
    const watchedWrites = {
      scopes: ['apply', 'create', 'move', 'remove'],
      images: ['put'],
      settings: ['write'],
      people: ['add', 'change', 'leave', 'takeBackLeaving', 'merge', 'forget', 'remove', 'bringIn', 'answerDistinct', 'takeBackDistinct'],
    } as const
    const held = memoryRepositories()
    const refusing = Object.fromEntries(Object.entries(watchedWrites).map(([repository, writes]) => [
      repository,
      Object.assign(Object.create(held[repository as keyof typeof watchedWrites]) as object, Object.fromEntries(writes.map((write) => [
        write, () => Promise.reject(new Error(`${repository}.${write} refused`)),
      ]))),
    ]))
    const store = writeRefusals()
    const repositories = watchRepositories({ ...held, ...refusing } as Repositories, store) as unknown as Record<string, Record<string, () => Promise<unknown>>>
    let count = 0
    for (const [repository, writes] of Object.entries(watchedWrites)) {
      for (const write of writes) {
        await repositories[repository]![write]!().catch(() => undefined)
        count += 1
        const last = store.list().at(-1)!
        expect(store.list()).toHaveLength(count)
        expect((last.cause as Error).message).toBe(`${repository}.${write} refused`)
        await expect(last.retry()).resolves.toBe(false)
      }
    }
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
    const letGo = vi.fn()
    const store = writeRefusals(undefined, letGo)
    const heard = vi.fn()
    store.subscribe(heard)
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await repositories.people.add({ name: 'Ada' }).catch(() => undefined)
    await repositories.people.add({ name: 'Bo' }).catch(() => undefined)
    store.forget(store.list()[0]!.id)
    expect(store.list()).toHaveLength(1)
    expect(letGo).not.toHaveBeenCalled()
    store.forget()
    expect(store.list()).toHaveLength(0)
    expect(heard).toHaveBeenCalledTimes(4)
    // Once nothing stands, said once, so the next refusal is said again.
    expect(letGo).toHaveBeenCalledOnce()
    store.forget()
    expect(letGo).toHaveBeenCalledOnce()
  })

  it('does what the maker asked once a refused write lands when made again, and nothing for one put back', async () => {
    const refusing = { now: true }
    const store = writeRefusals()
    const repositories = watchRepositories(refusingWhile(refusing), store)
    const ada = await repositories.people.add({ name: 'Ada' }).catch((cause: unknown) => cause)
    const bo = await repositories.people.add({ name: 'Bo' }).catch((cause: unknown) => cause)
    const landed = vi.fn()
    const putBack = vi.fn()
    whenLanded(repositories.people, refusalOf(ada), landed)
    whenLanded(repositories.people, refusalOf(bo), putBack)
    store.forget(refusalOf(bo))
    refusing.now = false
    expect(await store.retry()).toBe(true)
    expect(landed).toHaveBeenCalledOnce()
    expect(putBack).not.toHaveBeenCalled()
  })

  it('counts every write outside the open session from its call until it settles, landed or refused', async () => {
    const refusing = { now: false }
    const store = writeRefusals()
    const counts: number[] = []
    store.watchUnderway(() => counts.push(store.underway()))
    const repositories = watchRepositories(refusingWhile(refusing), store)
    expect(writesUnderway(repositories.scopes)).toBe(store)
    // A write method, counted from the call: no read comes first that the count could miss.
    const going = repositories.people.add({ name: 'Bo' })
    expect(store.underway()).toBe(1)
    await going
    expect(store.underway()).toBe(0)
    refusing.now = true
    await repositories.people.add({ name: 'Ada' }).catch(() => undefined)
    expect(store.underway()).toBe(0)
    expect(Math.max(...counts)).toBeGreaterThan(0)
  })

  it('counts a change typed and not sent as one to come, sends it when asked, and lets go of it', () => {
    const store = writeRefusals()
    const send = vi.fn()
    const release = store.holdUnsent(send)
    expect(store.underway()).toBe(1)
    store.sendUnsent()
    expect(send).toHaveBeenCalledOnce()
    release()
    release()
    expect(store.underway()).toBe(0)
  })

  it('counts a change that reads before it writes from its first read, where the repository is watched', async () => {
    const store = writeRefusals()
    const repositories = watchRepositories(memoryRepositories(), store)
    let open: () => void = () => {}
    const reading = new Promise<void>((resolve) => { open = resolve })
    const held = holdWrite(repositories.scopes, reading.then(() => ensureScope(repositories.scopes, 'rail', { name: 'Rail' })))
    // Nothing written yet, and already under way: a quit now waits for it.
    expect(store.underway()).toBe(1)
    open()
    await held
    expect(store.underway()).toBe(0)
    // Where nobody watches, the work is handed back as it was.
    const plain = memoryRepositories()
    const work = Promise.resolve(3)
    expect(holdWrite(plain.scopes, work)).toBe(work)
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

  it('names each refused write as the Activity list would, from what it was handed', async () => {
    const refusing = { now: false }
    const store = writeRefusals()
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await scopeAt(repositories, 'rail')
    refusing.now = true
    await changeScope(repositories.scopes, 'rail', () => [{ type: 'diagram.rename', id: 'd1', name: 'Order flow' }]).catch(() => undefined)
    await changeScope(repositories.scopes, 'rail', () => [{ type: 'scope.describe', patch: { activeDiagramId: 'd1' } }]).catch(() => undefined)
    await repositories.people.add({ name: 'Ada' } as never).catch(() => undefined)
    expect(store.list().map((one) => one.summary)).toEqual([
      { key: 'activity.diagramRenamed', name: 'Order flow' },
      { key: 'activity.projectSettings' },
      { key: 'work.refusedPeople' },
    ])
    expect(stepsSummary([{ type: 'element.update', id: 'x', patch: { name: 'Fleet' } } as never])).toEqual({ key: 'activity.elementRenamedTo', to: 'Fleet' })
  })

  it('makes one refused write again on its own, leaving the others standing', async () => {
    const refusing = { now: false }
    const store = writeRefusals()
    const repositories = watchRepositories(refusingWhile(refusing), store)
    await scopeAt(repositories, 'rail')
    refusing.now = true
    await changeScope(repositories.scopes, 'rail', rename('One')).catch(() => undefined)
    await changeScope(repositories.scopes, 'rail', rename('Two')).catch(() => undefined)
    const [first, second] = store.list()
    refusing.now = false
    await expect(store.retry(second!.id)).resolves.toBe(true)
    expect(store.list().map((one) => one.id)).toEqual([first!.id])
    expect((await readScope(repositories.scopes, 'rail'))?.model.name).toBe('Two')
  })

  it('takes changes a session handed over as it went, a row each, made again and put back like any other', async () => {
    const letGo = vi.fn()
    const store = writeRefusals(() => {}, letGo)
    const made: string[] = []
    const ids = store.handOver([
      { cause: new Error('EACCES'), summary: { key: 'activity.elementRenamed', name: 'Fleet', to: 'Fleet QA' }, retry: () => { made.push('rename'); return Promise.resolve(true) } },
      { cause: new Error('EACCES'), summary: { key: 'activity.elementAdded', name: 'QA App' }, retry: () => Promise.resolve(false) },
    ])
    expect(store.list().map((one) => one.id)).toEqual(ids)
    await expect(store.retry()).resolves.toBe(false)
    expect(made).toEqual(['rename'])
    expect(store.list().map((one) => one.summary?.name)).toEqual(['QA App'])
    store.forget(ids[1])
    expect(store.list()).toEqual([])
    expect(letGo).toHaveBeenCalledOnce()
    // Handed to a watched repository's list, and to none where nobody watches.
    const watched = watchRepositories(memoryRepositories(), store)
    expect(handOver(watched.scopes, [{ retry: () => Promise.resolve(true) }])).toHaveLength(1)
    expect(handOver(memoryRepositories().scopes, [{ retry: () => Promise.resolve(true) }])).toBeUndefined()
  })
})
