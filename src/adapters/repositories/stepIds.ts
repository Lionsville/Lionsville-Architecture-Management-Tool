// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The step ids a source has applied, and the scope each was applied to
 * (`ScopeRepository.apply`: a step lands once, and one sent to another scope
 * is refused).
 *
 * The seam asks for a day. These are kept for a week: a step is sent again
 * when the answer to it was lost, and a page that lost one over a weekend
 * away should still not land it twice. Each id is also filed under the day it
 * was applied, so letting go of the old ones reads the old days and nothing
 * else.
 */
import type { ScopeId } from '../../projects/scopeState'
import { keyOf } from './KeyedStore'
import type { Transaction } from './KeyedStore'

export const STEP_IDS_KEPT_DAYS = 7

const DAY = 24 * 60 * 60 * 1000

type Applied = { scope: ScopeId; day: string }

function dayOf(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

/** The scope a step id was applied to, or `undefined` for one this source has not applied (or has let go of). */
export async function appliedTo(tx: Transaction, stepId: string): Promise<ScopeId | undefined> {
  return (await tx.get<Applied>('steps', stepId))?.scope
}

export function remember(tx: Transaction, stepId: string, scope: ScopeId, now: number): void {
  const day = dayOf(now)
  tx.put('steps', stepId, { scope, day } satisfies Applied)
  tx.put('stepDays', keyOf(day, stepId), stepId)
}

/** Let go of the ids applied before the days kept. */
export async function letGo(tx: Transaction, now: number): Promise<void> {
  const before = dayOf(now - STEP_IDS_KEPT_DAYS * DAY)
  const old = await tx.range<string>('stepDays', { below: before })
  for (const { value } of old) tx.delete('steps', value)
  tx.deleteRange('stepDays', { below: before })
}
