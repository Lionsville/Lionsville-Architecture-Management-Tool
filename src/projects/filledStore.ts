// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A store with some of its answers given by somebody else (ADR-0022, the ninth
 * amendment).
 *
 * A build composed from this one often wants a store this tree already has —
 * the folder store over a handle of its own — with one or two answers of its
 * own on top: an index it can fetch in one round trip, a save it has already
 * carried some other way. The only way to say that used to be to derive an
 * object from the live store by its prototype and put the new methods on the
 * copy, which works exactly until the store keeps anything private: a class
 * field written `#held` is on the store and not on the copy, and every method
 * called through the copy fails on the first line that reads it.
 *
 * So the members are listed and each one is answered: by the filling where it
 * gave one, and otherwise by the store, called AS the store. The list is
 * checked against the port, so a member the port grows is a compile error here
 * rather than a method a filled store quietly does not have.
 */
import type { ScopeStore } from '../ports/ScopeStore'

/**
 * The members a caller answers for itself, handed the store it is filling so
 * that an answer of its own can still fall back on the store's.
 */
export type ScopeStoreFilling = (built: ScopeStore) => Partial<ScopeStore>

/** Every member of the port, once. `satisfies` is what makes a new one a compile error. */
const MEMBERS = {
  id: true, list: true, load: true, save: true, remove: true,
  pressure: true, outdated: true, models: true, descriptions: true,
} as const satisfies Record<keyof ScopeStore, true>

export function filledStore(built: ScopeStore, filling: ScopeStoreFilling): ScopeStore {
  const own = filling(built)
  const filled: Record<string, unknown> = {}
  for (const member of Object.keys(MEMBERS) as (keyof ScopeStore)[]) {
    const answer = own[member] ?? built[member]
    // An optional member neither gave stays absent: absent is an answer the
    // port gives a meaning to (`outdated`, `models`), and a stub is not it.
    if (answer === undefined) continue
    filled[member] = typeof answer === 'function' && own[member] === undefined
      ? (answer as (...args: unknown[]) => unknown).bind(built)
      : answer
  }
  return filled as unknown as ScopeStore
}
