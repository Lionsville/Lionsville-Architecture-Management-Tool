// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every write that did not land, wherever it was made from, for the one word
 * that says whether work is safe.
 *
 * The open scope's session says its own failures (`saveFailed`). Everything
 * else writes through the repositories directly — a scope's settings, a view
 * renamed or deleted on a home, *Served by*, the operating model, the people
 * register, a merge across the tree, a mark as intended — and each of those
 * used to say a refusal in a toast at most, while the status word went on
 * saying *Saved*. So the app's repositories are watched once, here
 * (`watchRepositories`), and a write that was refused stands in this list
 * until it lands when tried again or the person puts it back; the status word
 * is not calm while the list holds anything (`frame/statusWord`).
 *
 * What counts is a write the place work is kept would not take: a rejection
 * (a folder that is read-only, a disk that is full, a server not answering)
 * and the two refusals that mean the same (`shell.scopeReadOnly`,
 * `shell.unreadableNotSaved`). A refusal that answers the question a dialog
 * asked — an address taken, a scope moved in between and worked out again —
 * is that dialog's to say, and is not a write lost.
 */
import { createContext } from 'react'
import type { StringKey } from '../i18n'
import type { Repositories } from '../ports/Repositories'
import { refusalOf, tagRefusal } from '../projects/refusalTag'

export type WriteRefusal = {
  readonly id: number
  /** The key the refusal said, where it was one; a rejection has none. */
  readonly key?: StringKey
  /** The very write again, as it was made: a refused write changed nothing, so making it again is safe. */
  readonly retry: () => Promise<boolean>
}

export type WriteRefusals = {
  readonly list: () => readonly WriteRefusal[]
  readonly subscribe: (listener: () => void) => () => void
  /** One refusal let go of — put back by whoever made it — or every one. */
  readonly forget: (id?: number) => void
  /** Every refused write made again; true where every one landed. */
  readonly retry: () => Promise<boolean>
}

/** The refusals that mean a write was not kept, rather than an answer to a question. */
const NOT_KEPT: ReadonlySet<string> = new Set(['shell.scopeReadOnly', 'shell.unreadableNotSaved'])

type Store = WriteRefusals & {
  readonly add: (refusal: Omit<WriteRefusal, 'id'>) => number
}

/** The list, kept outside React so a write anywhere reaches it and a word on the frame reads it. */
export function writeRefusals(onLanded: () => void = () => {}): Store {
  let held: readonly WriteRefusal[] = []
  let next = 0
  const listeners = new Set<() => void>()
  const set = (to: readonly WriteRefusal[]) => { held = to; for (const listener of [...listeners]) listener() }
  const forget = (id?: number) => {
    const left = id === undefined ? [] : held.filter((one) => one.id !== id)
    if (left.length !== held.length) set(left)
  }
  return {
    list: () => held,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    forget,
    add: (refusal) => {
      next += 1
      set([...held, { ...refusal, id: next }])
      return next
    },
    retry: async () => {
      const tried = await Promise.all(held.map(async (one) => {
        const landed = await one.retry().catch(() => false)
        if (landed) forget(one.id)
        return landed
      }))
      if (tried.some(Boolean)) onLanded()
      return tried.every(Boolean)
    },
  }
}

type Answer = object
/** A write's answer: one that refused with a key that means *not kept*, or anything else. */
function notKept(answer: unknown): StringKey | undefined {
  if (typeof answer !== 'object' || answer === null || !('refused' in answer)) return undefined
  const refused = (answer as { refused: unknown }).refused
  return typeof refused === 'string' && NOT_KEPT.has(refused) ? refused as StringKey : undefined
}

/**
 * One write method watched: a rejection or a refusal that means *not kept* is
 * added to the list and tagged with its number (`projects/refusalTag`), so the
 * caller that catches it can let go of that one when it is put back.
 */
function watched<A extends unknown[], R>(store: Store, call: (...args: A) => Promise<R>) {
  const attempt = async (args: A): Promise<{ answer: R; key?: StringKey } | { cause: unknown }> => {
    try {
      const answer = await call(...args)
      const key = notKept(answer)
      return key ? { answer, key } : { answer }
    } catch (cause) {
      return { cause }
    }
  }
  return async (...args: A): Promise<R> => {
    const first = await attempt(args)
    const failed = 'cause' in first || first.key !== undefined
    if (!failed) return first.answer
    const retry = async () => {
      const again = await attempt(args)
      return !('cause' in again) && again.key === undefined
    }
    const id = store.add({ ...('key' in first && first.key ? { key: first.key } : {}), retry })
    if ('cause' in first) {
      tagRefusal(first.cause, id)
      throw first.cause
    }
    tagRefusal(first.answer as Answer, id)
    return first.answer
  }
}

/** What a watched repository hands back for `unwatched`: the session says its own failures. */
const RAW = Symbol('unwatched')

/**
 * Wrap the named methods of one repository, keeping everything else it has —
 * a method an adapter adds, a property — exactly as it was.
 */
function watch<T extends object>(store: Store, repository: T, writes: readonly (keyof T & string)[]): T {
  const names = new Set<string | symbol>(writes)
  const made = new Map<string | symbol, unknown>()
  return new Proxy(repository, {
    get(target, prop) {
      if (prop === RAW) return target
      const value: unknown = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      if (!names.has(prop)) return (value as (...args: unknown[]) => unknown).bind(target)
      if (!made.has(prop)) made.set(prop, watched(store, (value as (...args: unknown[]) => Promise<unknown>).bind(target)))
      return made.get(prop)
    },
  })
}

/** A repository as it was before it was watched: for the open session, whose failures are its own to say. */
export function unwatched<T extends object>(repository: T): T {
  return ((repository as Record<symbol, unknown>)[RAW] as T | undefined) ?? repository
}

/** The app's repositories, with every write watched. Reads go through untouched. */
export function watchRepositories(repositories: Repositories, store: Store): Repositories {
  return {
    ...repositories,
    scopes: watch(store, repositories.scopes, ['apply', 'create', 'move', 'remove']),
    images: watch(store, repositories.images, ['put']),
    settings: watch(store, repositories.settings, ['write']),
    people: watch(store, repositories.people, [
      'add', 'change', 'leave', 'takeBackLeaving', 'merge', 'forget', 'remove', 'bringIn', 'answerDistinct', 'takeBackDistinct',
    ]),
  }
}

/** The list, for a field below the shell that has to let go of the refusal it caused once it is put back. */
export const WriteRefusalsContext = createContext<WriteRefusals | undefined>(undefined)

export { refusalOf }
