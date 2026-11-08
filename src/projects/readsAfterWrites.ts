// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope read after the writes to it that are under way, never beside them.
 *
 * A workspace that goes writes what it has not written yet on its way out, and
 * the page a person goes to next may read the same scope in the same moment:
 * leaving Observations for the scope's home and coming straight back read the
 * scope a few hundredths of a second before the edit made there landed, and
 * showed the scope without it — with nothing to say it was there, so the edit
 * was made again. So a read of a scope waits for the steps being applied to it,
 * and a read that a write to it began under is made again once that write is
 * done: what a read answers is never older than a write this window started
 * before it answered.
 */
import type { Repositories } from '../ports/Repositories'
import type { ScopeRepository, StepsFor } from '../ports/ScopeRepository'
import type { ScopeId } from './scopeState'

type Writes = {
  /** The applies to a scope still under way. */
  underway: Set<Promise<unknown>>
  /** How many applies to it have begun, ever: a read that sees the number move had a write begin under it. */
  begun: number
}

/** The scopes repository with its reads held behind its writes; every other part as it was. */
export function readsAfterWrites(scopes: ScopeRepository): ScopeRepository {
  const writes = new Map<ScopeId, Writes>()
  const of = (scope: ScopeId): Writes => {
    let held = writes.get(scope)
    if (!held) writes.set(scope, held = { underway: new Set(), begun: 0 })
    return held
  }
  const settled = async (held: Writes) => {
    // Whatever the write answered, the read is of what it left: a refusal changed nothing, which is also an answer.
    while (held.underway.size > 0) await Promise.allSettled([...held.underway])
  }

  const apply = (work: readonly StepsFor[]) => {
    const scopesIn = [...new Set(work.map((one) => one.scope))].map(of)
    const answer = scopes.apply(work)
    for (const held of scopesIn) {
      held.begun += 1
      held.underway.add(answer)
    }
    const done = () => { for (const held of scopesIn) held.underway.delete(answer) }
    answer.then(done, done)
    return answer
  }

  const state: ScopeRepository['state'] = async (scope) => {
    const held = of(scope)
    for (;;) {
      await settled(held)
      const before = held.begun
      const read = await scopes.state(scope)
      if (held.begun === before && held.underway.size === 0) return read
    }
  }

  // A proxy, so whatever else an adapter put on its repository is kept as it was, bound to it.
  return new Proxy(scopes, {
    get(target, prop) {
      if (prop === 'apply') return apply
      if (prop === 'state') return state
      const value: unknown = Reflect.get(target, prop, target)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  })
}

/** The repositories with the scopes' reads held behind their writes (`readsAfterWrites`). */
export function readingAfterWrites(repositories: Repositories): Repositories {
  return { ...repositories, scopes: readsAfterWrites(repositories.scopes) }
}
