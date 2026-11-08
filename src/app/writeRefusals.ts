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
 *
 * **And every write still under way.** None of these writes is the open
 * session's, so none of them told the window that closing would lose
 * something: a rename committed in a scope's settings and a quit a moment
 * later closed the window under the write as if nothing were pending, and
 * the rename was gone. So the same watch counts each write from the moment it
 * is made until it settles, landed or refused (`underway`), and the window
 * waits for it with *Saving…* as it does for the open scope's
 * (`frame/unsavedTogether`). A change that reads before it writes — the
 * tree, then the scope as it stands — is counted from its first read by the
 * hook that makes it (`holdWrite`): the read is part of the write.
 */
import { createContext } from 'react'
import type { StringKey } from '../i18n'
import { fromArrays, summarise } from '../model'
import type { Command, StepSummary } from '../model'
import type { Repositories } from '../ports/Repositories'
import type { StepsFor } from '../ports/ScopeRepository'
import { SCOPE_MOVED } from '../projects/revision'
import { refusalOf, tagRefusal } from '../projects/refusalTag'

export type WriteRefusal = {
  readonly id: number
  /** The key the refusal said, where it was one; a rejection has none. */
  readonly key?: StringKey
  /** What the store answered or threw, for the reason said beside it (`notKept`). */
  readonly cause?: unknown
  /** The very write again, as it was made: a refused write changed nothing, so making it again is safe. */
  readonly retry: () => Promise<boolean>
  /**
   * What the change was, in the words the Activity list uses for a step, so
   * *Your work* names each one rather than one sentence for all of them.
   */
  readonly summary?: StepSummary
  /**
   * The scope it was a change to, where its maker said: a change handed over
   * by a session that went, which a session open on that scope again has to
   * read once it lands (`watchLanded`), since it holds the scope as it was.
   */
  readonly scope?: string
  /**
   * The scopes it wrote, by identity, where the write named them: a view
   * renamed on a home is a change to a scope a session may have open, and
   * that session has to read it once it lands as much as a handed-over one.
   */
  readonly scopeIds?: readonly string[]
}

export type WriteRefusals = {
  readonly list: () => readonly WriteRefusal[]
  /**
   * What its maker does once that refused write lands when made again: what
   * the screen remembers of it outside the place it is kept — a view's name on
   * *Continue* — which a write made again from *Your work* cannot know of.
   */
  readonly whenLanded: (id: number, then: () => void) => void
  /**
   * A change typed and not sent yet — a settings field that lands only as it
   * is left, with the cursor still in it — held as a write to come until the
   * returned function lets go: closing the window waits for it with *Saving…*
   * and has it sent (`sendUnsent`), rather than dropping it or asking.
   */
  readonly holdUnsent: (send: () => void) => () => void
  /** Every change held as typed and not sent, sent now: the window is closing. */
  readonly sendUnsent: () => void
  readonly subscribe: (listener: () => void) => () => void
  /** One refusal let go of — put back by whoever made it — or every one. */
  readonly forget: (id?: number) => void
  /** One refused write made again, or every one in the order they were made; true where every one landed. */
  readonly retry: (id?: number) => Promise<boolean>
  /**
   * Writes the open scope's session could not make, handed over as it goes —
   * a person leaving the scope with refused changes — so they stand here, a
   * row each, rather than going with the session. Answers their numbers.
   */
  readonly handOver: (refusals: readonly Omit<WriteRefusal, 'id'>[]) => readonly number[]
  /**
   * Word of the refused writes that landed when made again, once per *Try
   * again* or *Try all again*, after the last of them has been tried: a
   * session that reads the scope on each landing reads it while the next is
   * still to land, and then holds a scope that moves under it again.
   */
  readonly watchLanded: (listener: (landed: readonly WriteRefusal[]) => void) => () => void
}

/** The refusals that mean a write was not kept, rather than an answer to a question. */
const NOT_KEPT: ReadonlySet<string> = new Set(['shell.scopeReadOnly', 'shell.unreadableNotSaved'])

/** How many writes outside the open session are under way, and word whenever that changes. */
export type WritesUnderway = {
  /** Writes made and not settled, and changes typed and not sent yet ({@link WriteRefusals.holdUnsent}). */
  readonly underway: () => number
  readonly watchUnderway: (listener: () => void) => () => void
  /** Counts `work` as a write under way until it settles, landed or not, and hands it back as it was. */
  readonly hold: <T>(work: Promise<T>) => Promise<T>
}

type Store = WriteRefusals & WritesUnderway & {
  readonly add: (refusal: Omit<WriteRefusal, 'id'>) => number
}

/** The list, kept outside React so a write anywhere reaches it and a word on the frame reads it. */
export function writeRefusals(onLanded: () => void = () => {}, onLetGo: () => void = () => {}): Store {
  let held: readonly WriteRefusal[] = []
  let next = 0
  const listeners = new Set<() => void>()
  const landing = new Set<(landed: readonly WriteRefusal[]) => void>()
  const set = (to: readonly WriteRefusal[]) => { held = to; for (const listener of [...listeners]) listener() }
  const after = new Map<number, () => void>()
  const drop = (id?: number) => {
    const left = id === undefined ? [] : held.filter((one) => one.id !== id)
    if (id === undefined) after.clear()
    else after.delete(id)
    if (left.length !== held.length) set(left)
  }
  // Put back by the person: once nothing stands, the next refusal is news again, and is said.
  const forget = (id?: number) => {
    const had = held.length
    drop(id)
    if (had > 0 && held.length === 0) onLetGo()
  }
  let underway = 0
  const unsent = new Map<symbol, () => void>()
  const watchingUnderway = new Set<() => void>()
  const told = () => { for (const listener of [...watchingUnderway]) listener() }
  const counted = (by: number) => { underway += by; told() }
  const hold = <T,>(work: Promise<T>): Promise<T> => {
    counted(1)
    // Settled either way, and counted down before whoever awaits it hears: what it answered is theirs.
    return work.finally(() => counted(-1))
  }
  return {
    underway: () => underway + unsent.size,
    holdUnsent: (send) => {
      const key = Symbol('unsent')
      unsent.set(key, send)
      told()
      return () => { if (unsent.delete(key)) told() }
    },
    sendUnsent: () => { for (const send of [...unsent.values()]) send() },
    watchUnderway: (listener) => { watchingUnderway.add(listener); return () => { watchingUnderway.delete(listener) } },
    hold,
    list: () => held,
    whenLanded: (id, then) => { if (held.some((one) => one.id === id)) after.set(id, then) },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    forget,
    add: (refusal) => {
      next += 1
      set([...held, { ...refusal, id: next }])
      return next
    },
    watchLanded: (listener) => { landing.add(listener); return () => { landing.delete(listener) } },
    handOver: (refusals) => {
      const made = refusals.map((one, at) => ({ ...one, id: next + at + 1 }))
      next += refusals.length
      if (made.length > 0) set([...held, ...made])
      return made.map((one) => one.id)
    },
    // Made again from *Your work*: under way like the first time.
    retry: (id) => hold((async () => {
      // One after the other, in the order they were made: two changes to one scope are made as they were meant to land.
      const tried: boolean[] = []
      const landedNow: WriteRefusal[] = []
      for (const one of held.filter((each) => id === undefined || each.id === id)) {
        const landed = await one.retry().catch(() => false)
        const then = after.get(one.id)
        if (landed) {
          drop(one.id)
          then?.()
          landedNow.push(one)
        }
        tried.push(landed)
      }
      if (landedNow.length > 0) for (const listener of [...landing]) listener(landedNow)
      if (tried.some(Boolean)) onLanded()
      return tried.every(Boolean)
    })()),
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
/**
 * The same write, no longer expecting the state it was first made against:
 * what *Try again* falls back on where the scope moved since, which another
 * change made again before it will have done. The person asked for this very
 * change once more, over the scope as it stands.
 */
type Loosen<A> = (args: A) => A

const refusedAtAll = (answer: unknown) => typeof answer === 'object' && answer !== null && 'refused' in answer

/** What a watched write was, from what it was handed: the words its row in *Your work* reads. */
type Named<A> = (args: A) => StepSummary | undefined

/** Which scopes a watched write was to, by identity, from what it was handed. */
type Scoped<A> = (args: A) => readonly string[] | undefined

function watched<A extends unknown[], R>(
  store: Store, call: (...args: A) => Promise<R>, loosen?: Loosen<A>, named?: Named<A>, scoped?: Scoped<A>,
) {
  const attempt = async (args: A): Promise<{ answer: R; key?: StringKey } | { cause: unknown }> => {
    try {
      const answer = await call(...args)
      const key = notKept(answer)
      return key ? { answer, key } : { answer }
    } catch (cause) {
      return { cause }
    }
  }
  const made = async (...args: A): Promise<R> => {
    const first = await attempt(args)
    const failed = 'cause' in first || first.key !== undefined
    if (!failed) return first.answer
    const retry = async () => {
      const again = await attempt(args)
      if ('cause' in again) return false
      if (!refusedAtAll(again.answer)) return true
      if (!loosen || (again.answer as { refused: unknown }).refused !== SCOPE_MOVED) return false
      const loose = await attempt(loosen(args))
      return !('cause' in loose) && !refusedAtAll(loose.answer)
    }
    // Words are a courtesy: a write that cannot be named still stands in the list, as a change.
    let summary: StepSummary | undefined
    try { summary = named?.(args) } catch { summary = undefined }
    let scopeIds: readonly string[] | undefined
    try { scopeIds = scoped?.(args) } catch { scopeIds = undefined }
    const id = store.add({
      ...(scopeIds && scopeIds.length > 0 ? { scopeIds } : {}),
      ...('key' in first && first.key ? { key: first.key } : {}),
      cause: 'cause' in first ? first.cause : first.answer,
      retry,
      ...(summary ? { summary } : {}),
    })
    if ('cause' in first) {
      tagRefusal(first.cause, id)
      throw first.cause
    }
    tagRefusal(first.answer as Answer, id)
    return first.answer
  }
  // Under way from the call until it settles.
  return (...args: A): Promise<R> => store.hold(made(...args))
}

/** What a watched repository hands back for `unwatched`: the session says its own failures. */
const RAW = Symbol('unwatched')
/** What a watched repository hands back for the count of writes under way. */
const UNDERWAY = Symbol('underway')

/**
 * Wrap the named methods of one repository, keeping everything else it has —
 * a method an adapter adds, a property — exactly as it was.
 */
function watch<T extends object>(
  store: Store, repository: T, writes: readonly (keyof T & string)[],
  loosened: Partial<Record<string, Loosen<unknown[]>>> = {}, named: Partial<Record<string, Named<unknown[]>>> = {},
  scoped: Partial<Record<string, Scoped<unknown[]>>> = {},
): T {
  const names = new Set<string | symbol>(writes)
  const made = new Map<string | symbol, unknown>()
  return new Proxy(repository, {
    has: (target, prop) => prop === UNDERWAY || Reflect.has(target, prop),
    get(target, prop) {
      if (prop === RAW) return target
      if (prop === UNDERWAY) return store
      const value: unknown = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      if (!names.has(prop)) return (value as (...args: unknown[]) => unknown).bind(target)
      if (!made.has(prop)) {
        made.set(prop, watched(store, (value as (...args: unknown[]) => Promise<unknown>).bind(target), loosened[String(prop)], named[String(prop)], scoped[String(prop)]))
      }
      return made.get(prop)
    },
  })
}

/** A repository as it was before it was watched: for the open session, whose failures are its own to say. */
export function unwatched<T extends object>(repository: T): T {
  return ((repository as Record<symbol, unknown>)[RAW] as T | undefined) ?? repository
}

/** Have `then` done once the refused write `id` lands when made again, where the repository is watched. */
export function whenLanded(repository: object, id: number | undefined, then: () => void): void {
  if (id !== undefined) storeOf(repository)?.whenLanded(id, then)
}

/** Refused writes handed over to the list a watched repository keeps; nothing where nobody watches it. */
export function handOver(repository: object, refusals: readonly Omit<WriteRefusal, 'id'>[]): readonly number[] | undefined {
  return storeOf(repository)?.handOver(refusals)
}

/** The list of refused writes a watched repository keeps, or none for one nobody watches. */
export function refusalsOf(repository: object): WriteRefusals | undefined {
  return storeOf(repository)
}

/** Word of the refused writes that landed when made again, once per attempt, where the repository is watched. */
export function watchLanded(repository: object, listener: (landed: readonly WriteRefusal[]) => void): () => void {
  return storeOf(repository)?.watchLanded(listener) ?? (() => {})
}

/** The count of writes under way that a watched repository keeps, or none for one nobody watches. */
export function writesUnderway(repository: object): WritesUnderway | undefined {
  return storeOf(repository)
}

/** Asked with `in` first: a repository somebody else wraps may answer any property it does not know with a throw. */
function storeOf(repository: object): Store | undefined {
  return UNDERWAY in repository ? (repository as Record<symbol, Store | undefined>)[UNDERWAY] : undefined
}

/**
 * A change that reads before it writes, counted as a write under way from its
 * first read until it settles, where the repository is watched. A quit while
 * its reads are still out would otherwise find nothing pending and close the
 * window before the write was made.
 */
export function holdWrite<T>(repository: object, work: Promise<T>): Promise<T> {
  return writesUnderway(repository)?.hold(work) ?? work
}

/** Nothing at all: what a step is named against where the model it was made on is not at hand. */
const NOTHING_HELD = fromArrays({ name: '', elements: [], relations: [], diagrams: [] })

/**
 * What steps sent to a scope were, as the Activity list would say them: named
 * from the commands alone, since the model they were made on is not here — a
 * rename says the name it gives, a change says what it changes where it can.
 * A scope's own description, or a picture, is said as the scope's settings.
 */
export function stepsSummary(commands: readonly { readonly type: string }[]): StepSummary {
  const modelled = commands.filter((one) => !one.type.startsWith('scope.') && !one.type.startsWith('image.')) as Command[]
  if (modelled.length === 0) return { key: 'activity.projectSettings' }
  try {
    return summarise(modelled, NOTHING_HELD)
  } catch {
    return { key: 'work.refusedChange' }
  }
}

const said = (key: StringKey, name?: unknown): Named<unknown[]> => () => ({ key, ...(typeof name === 'string' ? { name } : {}) })

/** The app's repositories, with every write watched. Reads go through untouched. */
export function watchRepositories(repositories: Repositories, store: Store): Repositories {
  const people = said('work.refusedPeople')
  return {
    ...repositories,
    scopes: watch(store, repositories.scopes, ['apply', 'create', 'move', 'remove'], {
      // A move or a removal is never made over a scope that changed since: what it would take with it is not what was asked about.
      apply: ([work]) => [(work as readonly StepsFor[]).map(({ expects: _expects, ...steps }) => steps)],
    }, {
      apply: ([work]) => stepsSummary((work as readonly StepsFor[]).flatMap((one) => one.steps.map((each) => each.command))),
      create: (args) => said('work.refusedNewScope', (args[1] as { name?: unknown } | undefined)?.name)(args),
      move: said('work.refusedMoveScope'),
      remove: said('work.refusedRemoveScope'),
    }, {
      apply: ([work]) => (work as readonly StepsFor[]).map((one) => one.scope),
    }),
    images: watch(store, repositories.images, ['put'], {}, { put: (args) => said('work.refusedPicture', args[1])(args) }),
    settings: watch(store, repositories.settings, ['write'], {}, { write: said('work.refusedSetting') }),
    people: watch(store, repositories.people, [
      'add', 'change', 'leave', 'takeBackLeaving', 'merge', 'forget', 'remove', 'bringIn', 'answerDistinct', 'takeBackDistinct',
    ], {}, Object.fromEntries(['add', 'change', 'leave', 'takeBackLeaving', 'merge', 'forget', 'remove', 'bringIn', 'answerDistinct', 'takeBackDistinct'].map((name) => [name, people]))),
  }
}

/** The list, for a field below the shell that has to let go of the refusal it caused once it is put back. */
export const WriteRefusalsContext = createContext<WriteRefusals | undefined>(undefined)

export { refusalOf }
