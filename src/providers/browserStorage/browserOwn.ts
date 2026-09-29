// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this browser's own chrome is handed back while it is the source: its
 * database — whether it can be written now, how full it is — and the work the
 * key-value storage kept before the database, with the questions a person
 * answers about it.
 *
 * Two things happen after a write lands, and both are the provider's: the
 * first landed write asks the browser to keep this site's storage through a
 * clear-out (never at start-up: Firefox puts that question to the person, and
 * a question at start-up is one about nothing yet), and every landed write
 * asks how full the storage is, for the notice that says so before a browser
 * stops saving without asking.
 */
import type { BrowserDatabase } from '../../adapters/webStorage/browserRepositories'
import type { Earlier } from '../../adapters/webStorage/earlierScopes'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { ScopeRepository } from '../../ports/ScopeRepository'

/** How full this site's storage is, as a share: what the notice says. */
export type Fullness = { used: number; budget: number }

export type BrowserOwn = {
  /** Whether the database can be written now, and when that moves. */
  readonly database: Pick<BrowserDatabase, 'standing' | 'onStanding'>
  /** What the key-value storage kept before the database, where this browser has one. */
  readonly earlier?: Earlier
  /** Hear how full the storage is after each write that landed. */
  onFullness(listener: (fullness: Fullness) => void): () => void
  /** The database would not open, and nothing here is kept (`fallingBack`). */
  keepsNothing(): boolean
  /** Hear when that becomes so. */
  onKeepsNothing(listener: () => void): () => void
  /** What is shown in its place is what the key-value storage kept before the database: read, not moved. */
  shownFromOlder(): boolean
  /** The database has not answered yet, and the app was drawn without waiting for it any longer. */
  stillAnswering(): boolean
  /** Hear when that moves. */
  onStillAnswering(listener: (still: boolean) => void): () => void
}

/** The database's scopes, with what the provider does after each write that landed. */
export function afterWrites(
  scopes: ScopeRepository, database: BrowserDatabase, heard: (fullness: Fullness) => void, diagnostics: Diagnostics,
): ScopeRepository {
  let kept = false
  const landed = () => {
    if (!kept) {
      kept = true
      void database.keep().catch((cause: unknown) => {
        diagnostics.report({ level: 'warn', where: 'browserStorage', message: 'the browser was not asked to keep this site', cause })
      })
    }
    void database.pressure().then((pressure) => { if (pressure) heard(pressure) }, () => undefined)
  }
  return {
    id: scopes.id,
    tree: () => scopes.tree(),
    state: (id) => scopes.state(id),
    async apply(work) {
      const answer = await scopes.apply(work)
      if (!('refused' in answer)) landed()
      return answer
    },
    create: (at, scope) => scopes.create(at, scope),
    move: (scope, to, expects) => scopes.move(scope, to, expects),
    remove: (scope, expects) => scopes.remove(scope, expects),
  }
}

/** The browser's own parts, and the way its writes are heard. */
export function browserOwn(database: BrowserDatabase, earlier: Earlier | undefined): {
  own: BrowserOwn
  heard: (fullness: Fullness) => void
  fell: (shown: boolean) => void
  answering: (still: boolean) => void
} {
  const listeners = new Set<(fullness: Fullness) => void>()
  const falling = new Set<() => void>()
  let nothing = false
  let older = false
  let still = false
  const waiting = new Set<(still: boolean) => void>()
  return {
    own: {
      database,
      ...(earlier ? { earlier } : {}),
      onFullness(listener) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
      keepsNothing: () => nothing,
      onKeepsNothing(listener) {
        falling.add(listener)
        return () => { falling.delete(listener) }
      },
      shownFromOlder: () => older,
      stillAnswering: () => still,
      onStillAnswering(listener) {
        waiting.add(listener)
        return () => { waiting.delete(listener) }
      },
    },
    heard: (fullness) => { for (const listener of listeners) listener(fullness) },
    fell: (shown) => {
      nothing = true
      older = shown
      for (const listener of falling) listener()
    },
    answering: (now) => {
      if (still === now) return
      still = now
      for (const listener of waiting) listener(now)
    },
  }
}
