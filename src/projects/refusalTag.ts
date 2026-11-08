// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which refused write a cause or an answer is, by the number the app's watch
 * on its repositories gave it (`app/writeRefusals.ts`): what lets the field
 * that made the write take back the very refusal it caused, and no other,
 * once it has been tried again or put back.
 *
 * Kept beside the answer rather than in it, because the answer is the port's
 * and an error is whoever threw it; and carried across where a refusal is
 * turned into a thrown error (`scopeAccess.refusedError`), so a caller that
 * catches it can still say which one it was.
 */
const tags = new WeakMap<object, number>()

export function tagRefusal(of: unknown, id: number): void {
  if (typeof of === 'object' && of !== null) tags.set(of, id)
}

/** The refused write this cause or answer is, where the watch counted one. */
export function refusalOf(of: unknown): number | undefined {
  return typeof of === 'object' && of !== null ? tags.get(of) : undefined
}

/** `to`, carrying the refusal `from` was: an error made out of a refused answer. */
export function carryRefusal<T>(to: T, from: unknown): T {
  const id = refusalOf(from)
  if (id !== undefined) tagRefusal(to, id)
  return to
}
