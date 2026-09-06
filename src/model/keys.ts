/**
 * Interchange keys: lowercase letters, digits and dashes, unique across the
 * document. Shared by the interchange export and by the id policy below, which
 * is where every new id in the app comes from.
 */
import type { ConnectionId } from './normalised'
import type { ElementId } from './types'
export const KEY_RE = /^[a-z0-9-]+$/

export function slug(name: string): string {
  const s = String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'element'
}

/** A free key derived from the name, unique against `taken`. */
export function claimKey(name: string, taken: Set<string>): string {
  let key = slug(name)
  if (taken.has(key)) {
    let n = 2
    while (taken.has(`${key}-${n}`)) n++
    key = `${key}-${n}`
  }
  taken.add(key)
  return key
}

/**
 * Where a new id comes from (ADR-0002).
 *
 * The id a thing will have in the file, minted at the moment it is drawn and
 * synchronously — so a command can carry it, and there is no window in which
 * anything refers to a name that is about to change. That is what replaces the
 * temporary id, the alias map and the reconciliation pass that connected them.
 *
 * It reads what is taken through a function rather than being handed a set,
 * because five elements pasted in one gesture ask for five ids before any of
 * them is in the model. What has already been handed out is remembered for the
 * life of the policy, so a run of asks cannot collide with itself, and an id is
 * never re-used while the policy lives — even after the thing it named is gone.
 */
export type IdPolicy = {
  /** The key this name would have had in the file. */
  element(name: string): ElementId
  /** Connections carry no key in the interchange format, so they get a serial. */
  connection(): ConnectionId
}

export function idPolicy(taken: () => Iterable<string>): IdPolicy {
  const handedOut = new Set<string>()
  let connectionSeq = 0
  const spokenFor = (): Set<string> => {
    const ids = new Set(taken())
    for (const id of handedOut) ids.add(id)
    return ids
  }
  return {
    element(name) {
      const key = claimKey(name, spokenFor())
      handedOut.add(key)
      return key
    },
    connection() {
      const ids = spokenFor()
      let id: string
      do {
        id = `c#${++connectionSeq}-${Date.now().toString(36)}`
      } while (ids.has(id))
      handedOut.add(id)
      return id
    },
  }
}

/**
 * Every id spoken for in a document. Elements, connections and diagrams share
 * one namespace because they share one file, and a key that reads back as two
 * different things is worse than an ugly one.
 *
 * Structural rather than typed to `DesignModel`, so the indexed model and the
 * array one can both answer it.
 */
export function idsIn(model: {
  elements: readonly { id: string }[]
  connections: readonly { id: string }[]
  diagrams: readonly { id: string }[]
}): string[] {
  return [
    ...model.elements.map((e) => e.id),
    ...model.connections.map((c) => c.id),
    ...model.diagrams.map((d) => d.id),
  ]
}

/**
 * How the app asks for a new id where no name suggests one — a diagram, a
 * decision record. A function and not a counter, because who hands out ids is
 * the composition's business: a test wants them predictable and the app wants
 * them unique.
 */
export type MakeId = (prefix: string) => string
