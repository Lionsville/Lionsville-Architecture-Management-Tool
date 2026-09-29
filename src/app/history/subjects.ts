// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a history is asked about, in the domain's words (ADR-0031 §1): one
 * thing — a view, an element's page, a decision — as the record it is, and
 * the scopes whose history holds it.
 *
 * One scope for a view and a decision, which are one scope's own. An
 * element's page is not, because an id is organisation-wide (ADR-0012 §7): the
 * scope that answers for it holds the owner's account, and every scope that
 * draws it holds a perspective of its own, so its history is the entries of
 * all of them that wrote it.
 */
import type { RecordKey } from '../../model/recordKey'
import type { RestoreSubject } from '../../model/restore'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'

/** A thing a history is asked about: the same three words a restore puts back. */
export type HistorySubject = RestoreSubject

/** The record a subject is. A description is its element's. */
export function recordOf(subject: HistorySubject): RecordKey {
  switch (subject.what) {
    case 'diagram': return { kind: 'diagram', id: subject.id }
    case 'decision': return { kind: 'decision', id: subject.id }
    case 'description': return { kind: 'element', id: subject.id }
  }
}

/**
 * The scopes whose history holds a subject: this one, and — for an element's
 * page — every scope the index says answers for the id, declares it or draws
 * it, this one first and the rest in address order.
 */
export function scopesOf(subject: HistorySubject | undefined, scope: ScopePath, index?: ScopeIndex): ScopePath[] {
  if (subject?.what !== 'description') return [scope]
  const entry = index?.lookup(subject.id)
  if (!entry) return [scope]
  const elsewhere = [
    ...(entry.master !== undefined ? [entry.master] : []),
    ...entry.declarations,
    ...entry.drawnIn,
  ]
  return [scope, ...[...new Set(elsewhere)].filter((path) => path !== scope).sort()]
}
