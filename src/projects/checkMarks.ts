// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The findings marked as intended, over the tree (ADR-0036, amended 11
 * October 2026; `model/checkMarks.ts` for what a mark is).
 *
 * Two questions the model cannot answer alone, because both need the tree:
 * which marks hold now, with a scope open whose session has moved on from
 * what the index read, and in which scope a finding's mark is kept.
 */
import type { AnyFinding } from '../model/checkMarks'
import type { HostModel } from '../model/hostModel'
import type { IndexedCheckMark, ScopeIndex } from './scopeIndex'
import type { ScopePath } from './scopePath'

/**
 * The tree's marks, with one scope's as its open session has them now — so a
 * mark just made, or just taken back, is what a list is split by before the
 * index has read the scope again. Scope by scope, as the index lists them.
 */
export function checkMarksHere(
  index: Pick<ScopeIndex, 'checkMarks'>, scope: ScopePath, model: Pick<HostModel, 'checkMarks'>,
): IndexedCheckMark[] {
  const others = index.checkMarks().filter((kept) => kept.scope !== scope)
  return [...others, ...(model.checkMarks ?? []).map((mark) => ({ scope, mark }))]
}

/**
 * The scope a finding's mark is kept in: the scope of its first subject. A
 * finding said about a scope is kept there; one of the dates' in the scope
 * they were checked in (`checkedIn`); one of the Conway map's where the row
 * it is about is kept — the interface, or the interaction — or where the
 * application or the unit it is about is defined. `undefined` where the tree
 * does not know that subject: there is nowhere to keep the mark.
 */
export function checkMarkScope(
  index: Pick<ScopeIndex, 'lookup' | 'rowsOf'>, finding: AnyFinding, checkedIn?: ScopePath,
): ScopePath | undefined {
  if ('key' in finding && 'scope' in finding) return finding.scope
  if ('subject' in finding) return checkedIn
  const rowAt = (row: { id: string; sourceId: string }) => index.rowsOf(row.sourceId).find((one) => one.relation.id === row.id)?.scope
  switch (finding.kind) {
    case 'undeclared': return rowAt(finding.flow)
    case 'unused': return rowAt(finding.interaction)
    case 'unowned': return index.lookup(finding.applicationId)?.master
    case 'overLimit': return index.lookup(finding.unitId)?.master
  }
}
