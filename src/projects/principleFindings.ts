// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the tree's principles and their citations say about themselves
 * (ADR-0041 §10), off the index:
 *
 * - `check.principleUnused` (a note): an accepted principle nothing cites or
 *   tests — perhaps unknown, perhaps not needed;
 * - `check.principleChafes` (a review): a principle three or more
 *   observations say chafes — the practice works around it;
 * - `check.citationGone` (a fix): a citation of a principle that no longer
 *   reads where the record is — removed, absorbed, or in a scope that is not
 *   above it.
 *
 * Pure: the index in, findings out, each about the scope that can act on it —
 * the principle's for the first two, the citing record's for the last.
 */
import type { Finding } from './checks'
import { formatPrincipleNumber } from '../model/principle'
import type { Principle } from '../model/principle'
import type { ScopeIndex } from './scopeIndex'
import { ancestorScopes } from './scopePath'
import type { ScopePath } from './scopePath'

/** How many observations saying a principle chafes make it worth a review. */
export const CHAFES_AT = 3

/** Whether a principle kept at `kept` reads at `scope`: kept there or above. Topics widen it (ADR-0042). */
export type ReadsAt = (scope: ScopePath, kept: ScopePath) => boolean

const READS_ABOVE: ReadsAt = (scope, kept) => scope === kept || ancestorScopes(scope).includes(kept)

const named = (principle: Principle) => `${formatPrincipleNumber(principle.number)} ${principle.title}`

export function principleFindings(index: Pick<ScopeIndex, 'principleScopes' | 'principlesAt' | 'citations'>, readsAt: ReadsAt = READS_ABOVE): Finding[] {
  const citations = index.citations()
  const found: Finding[] = []
  for (const scope of index.principleScopes()) {
    for (const principle of index.principlesAt(scope).principles) {
      if (principle.mergedInto !== undefined) continue
      const of = citations.filter((one) => one.citation.principle.scope === scope && one.citation.principle.id === principle.id)
      if (principle.status === 'accepted' && of.length === 0) {
        found.push({ key: 'check.principleUnused', scope, id: principle.id, name: named(principle), information: true })
      }
      const chafes = of.filter((one) => one.citation.about.kind === 'observation' && one.citation.stance === 'chafes').length
      if (chafes >= CHAFES_AT) found.push({ key: 'check.principleChafes', scope, id: principle.id, name: named(principle), count: chafes })
    }
  }
  for (const { scope, citation } of citations) {
    const kept = citation.principle.scope
    const principle = index.principlesAt(kept).principles.find((one) => one.id === citation.principle.id)
    if (principle && principle.mergedInto === undefined && readsAt(scope, kept)) continue
    found.push({
      key: 'check.citationGone', scope, id: citation.about.id, name: principle ? named(principle) : citation.principle.id,
      fields: [citation.about.kind, citation.about.id, kept, citation.principle.id],
    })
  }
  return found
}
