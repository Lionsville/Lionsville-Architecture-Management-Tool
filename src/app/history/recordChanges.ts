// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A record's changes, as its reader lists them (ADR-0038, amended §11): the
 * history's entries that wrote the record (ADR-0031 §1), each said in the
 * record's own terms by comparing the record at that entry with the record at
 * the entry before it that wrote it — the entries between did not touch it,
 * so that one is what it was just before.
 *
 * Pure: the entries' models in, the sentences out. The reading is the
 * workspace's (`useRecordChangesAccess`).
 */
import { diffModels } from '../../model/diff'
import type { ModelChange } from '../../model/diff'
import type { HostModel } from '../../model/hostModel'
import type { RecordKey } from '../../model/recordKey'
import type { Translate } from '../../i18n'
import { changeLine } from './changeLine'

/** Whether a row of the diff is about the record: its own row, and for a view its membership and geometry too. */
export function aboutRecord(change: ModelChange, about: RecordKey): boolean {
  if (about.kind === 'diagram') {
    if (change.what === 'membership') return change.onId === about.id
    return change.id === about.id && (change.what === 'diagram' || change.what === 'geometry')
  }
  return change.what === about.kind && change.id === about.id
}


/**
 * What each entry did to the record, newest first: `models[i]` is the
 * record's scope at the i-th entry, newest first, as the entries were listed.
 * The oldest is compared with nothing, so it says `first` where the list is
 * `complete` — it is where the record began — and nothing where older entries
 * were left unread, since what it changed is not known.
 */
export function recordChangeLines(
  about: RecordKey, models: readonly (HostModel | undefined)[], complete: boolean, first: string, s: Translate,
): string[] {
  return models.map((after, index) => {
    const before = models[index + 1]
    if (index === models.length - 1) return complete ? first : ''
    if (!after || !before) return ''
    return diffModels(before, after).filter((change) => aboutRecord(change, about)).map((change) => changeLine(change, s)).join('; ')
  })
}
