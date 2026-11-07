// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Principles* on every home (ADR-0041 §12): how many the scope keeps, and how
 * many are in force there. Retired principles and those absorbed by another are
 * counted by neither. Off the index, as the home's other counts are.
 */
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { ancestorScopes } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'

/** What a home counts: the scope's own standing principles, and those in force there — above it, and from its topics (ADR-0042 §4). */
export function principleCounts(
  at: ScopePath, principlesAt: (path: ScopePath) => ScopePrinciples, topics: readonly ScopePath[] = [],
): { own: number; inForce: number } {
  const standing = (path: ScopePath) => principlesAt(path).principles.filter((one) => one.mergedInto === undefined && one.status !== 'retired').length
  const own = standing(at)
  const from = [...new Set([...ancestorScopes(at), ...topics])].filter((path) => path !== at)
  return { own, inForce: from.reduce((sum, path) => sum + standing(path), own) }
}
