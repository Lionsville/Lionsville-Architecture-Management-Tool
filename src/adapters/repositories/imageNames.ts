// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which pictures' bytes something still names, so the bytes nothing names
 * can go (`bytes`, `bytesNamed`, `bytesUnnamed`).
 *
 * **The rule.** Bytes stay while the scope's library names their content
 * address, or while any entry of its history does — going back to that entry
 * must find them. Bytes named by neither go a day after they were last put:
 * the day is the time between putting a picture's bytes and the step that
 * adds it to the library, which a page may lose on the way.
 *
 * **Counted where the names change, in the same transaction.** Each address
 * keeps how many names in the current library point at it, whether an entry
 * has ever named it, and when its bytes were last put. The library's count
 * moves wherever a scope's content is written; an entry's mark is set where
 * the entry is closed. Entries are never taken out one by one — a scope's
 * history goes only with the scope — so a mark once set stays. An address
 * named by nothing is also filed on a shelf of its own, so the sweep at each
 * record reads the few that may go and not every picture there is.
 *
 * **A store made before the counting is never swept.** Its bytes were put
 * without a count, and an entry kept then may name them; the counts are
 * still kept, and nothing is taken out on their word (`Meta.namesCounted`).
 */
import type { ContentAddress, ImageEntry } from '../../model/imageName'
import type { ScopeId, ScopeStep } from '../../projects/scopeState'
import { keyOf } from './KeyedStore'
import type { Transaction } from './KeyedStore'

/** How long bytes named by nothing are kept after they were last put. */
export const UNNAMED_KEPT_MS = 24 * 60 * 60 * 1000

/** What names one picture's bytes: the library, how many times; the history, ever; and when they were last put. */
export type Named = { library: number; history: boolean; put: number }

function namedKey(scope: ScopeId, address: ContentAddress | string): string {
  return keyOf(scope, address)
}

function isUnnamed({ library, history }: Named): boolean {
  return library === 0 && !history
}

function keep(tx: Transaction, key: string, named: Named): void {
  tx.put('bytesNamed', key, named)
  if (isUnnamed(named)) tx.put('bytesUnnamed', key, named.put)
  else tx.delete('bytesUnnamed', key)
}

/** Bytes put for a picture, now: named by whatever named them before, and put at `at`. */
export async function bytesPut(tx: Transaction, scope: ScopeId, address: ContentAddress, at: number): Promise<void> {
  const key = namedKey(scope, address)
  const held = await tx.get<Named>('bytesNamed', key)
  keep(tx, key, { library: held?.library ?? 0, history: held?.history ?? false, put: at })
}

/**
 * A scope's library, written from `before` to `after`: each content address
 * counted again by how many names it gained or lost. An address losing a name
 * it was never counted for is left as it is — bytes this build did not count.
 */
export async function libraryNamed(
  tx: Transaction, scope: ScopeId, before: readonly ImageEntry[], after: readonly ImageEntry[],
): Promise<void> {
  const moved = new Map<string, number>()
  for (const image of before) moved.set(image.contentAddress, (moved.get(image.contentAddress) ?? 0) - 1)
  for (const image of after) moved.set(image.contentAddress, (moved.get(image.contentAddress) ?? 0) + 1)
  for (const [address, by] of moved) {
    if (by === 0) continue
    const key = namedKey(scope, address)
    const held = await tx.get<Named>('bytesNamed', key)
    if (!held && by < 0) continue
    keep(tx, key, { library: Math.max(0, (held?.library ?? 0) + by), history: held?.history ?? false, put: held?.put ?? 0 })
  }
}

/** An entry closed whose state names these pictures: their bytes stay as long as the history does. */
export async function historyNamed(tx: Transaction, scope: ScopeId, images: readonly ImageEntry[]): Promise<void> {
  for (const address of new Set(images.map((image) => image.contentAddress))) {
    const key = namedKey(scope, address)
    const held = await tx.get<Named>('bytesNamed', key)
    if (held?.history) continue
    keep(tx, key, { library: held?.library ?? 0, history: true, put: held?.put ?? 0 })
  }
}

/**
 * The first content address a library newly names whose bytes are not kept
 * for the scope — never put, or swept since — and the step that named it;
 * `undefined` where every one is there. A library never names bytes that are
 * not there: an undo that adds back a picture swept a day after it was taken
 * out is refused, and the editor puts the bytes again or tells the person.
 */
export async function bytesMissing(
  tx: Transaction, scope: ScopeId, before: readonly ImageEntry[], after: readonly ImageEntry[], steps: readonly ScopeStep[],
): Promise<{ address: ContentAddress; stepId?: string } | undefined> {
  const named = new Set(before.map((image) => image.contentAddress))
  for (const address of new Set(after.map((image) => image.contentAddress))) {
    if (named.has(address) || await tx.get('bytes', namedKey(scope, address)) !== undefined) continue
    const naming = steps.find(({ command }) => command.type === 'image.add' && command.image.contentAddress === address)
    return { address, ...(naming ? { stepId: naming.stepId } : {}) }
  }
  return undefined
}

/** Take out the bytes nothing names that were last put a day or more before `now`; how many went. */
export async function sweepUnnamed(tx: Transaction, now: number): Promise<number> {
  let gone = 0
  for (const { key, value } of await tx.range<number>('bytesUnnamed', {})) {
    if (value > now - UNNAMED_KEPT_MS) continue
    tx.delete('bytes', key)
    tx.delete('bytesNamed', key)
    tx.delete('bytesUnnamed', key)
    gone += 1
  }
  return gone
}
