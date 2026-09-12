/**
 * A change, as a sentence.
 *
 * `model/diff.ts` says what happened and refuses to say it in words — it has no
 * language and should not acquire one. This is the other half: one key per kind
 * and subject, because "Added" and "Added the diagram" are different facts, and
 * a list that said "Added" for both would read like a database table.
 */
import type { ChangeKind, ChangeSubject, ModelChange } from '../../model/diff'
import type { StringKey, Translate } from '../../i18n'
import { RELATION_LABEL } from '../../model/relations'

/**
 * Every subject the diff can name, times every kind — as a type, so that a
 * subject added to `diffModels` without a sentence here is a compile error and
 * not a page that throws the first time somebody opens the history of a
 * project with one in it. Geometry is the exception: it is a count, not a
 * kind, and has its own line below.
 */
type LineKey = `${Exclude<ChangeSubject, 'geometry'>}:${ChangeKind}`

const KEYS: Record<LineKey, StringKey> = {
  'element:added': 'change.elementAdded',
  'element:removed': 'change.elementRemoved',
  'element:changed': 'change.elementChanged',
  // A flow keeps the word this tool has always used for it: it is the line a
  // person draws on a board, and the one the file still calls a connection.
  'relation:added': 'change.connectionAdded',
  'relation:removed': 'change.connectionRemoved',
  'relation:changed': 'change.connectionChanged',
  'diagram:added': 'change.diagramAdded',
  'diagram:removed': 'change.diagramRemoved',
  'diagram:changed': 'change.diagramChanged',
  'decision:added': 'change.decisionAdded',
  'decision:removed': 'change.decisionRemoved',
  'decision:changed': 'change.decisionChanged',
  'transition:added': 'change.transitionAdded',
  'transition:removed': 'change.transitionRemoved',
  'transition:changed': 'change.transitionChanged',
  // What came onto a board and what left it. Named, not counted: a card put on
  // a view is a decision somebody made (ADR-0012 §6).
  'membership:added': 'change.membershipAdded',
  'membership:removed': 'change.membershipRemoved',
  'membership:changed': 'change.membershipMoved',
}

/**
 * The four rows the business layer brought (ADR-0012 §5), which say which they
 * are rather than all calling themselves connections — a row between a
 * capability and a journey step was never a line on a board.
 */
const ROW_KEYS: Record<ChangeKind, StringKey> = {
  added: 'change.rowAdded',
  removed: 'change.rowRemoved',
  changed: 'change.rowChanged',
}

export function changeLine(change: ModelChange, s: Translate): string {
  if (change.what === 'geometry') {
    return s('change.geometry', { count: change.count ?? 0, name: change.name })
  }
  // What a record IS changed, which is a different fact from a field on it
  // (ADR-0012 §3) and would otherwise read as "changed Billing: ref".
  if (change.refChanged) {
    const { to } = change.refChanged
    return to === undefined
      ? s('change.becameDefinition', { name: change.name })
      // The root's path is the empty string, and a sentence saying "a stand-in
      // of " would be a sentence with a hole in it: the organisation is named
      // by the word for it, and every other scope by its path.
      : s('change.becameStandIn', { name: change.name, scope: to || s('common.organisation') })
  }
  const asRow = change.relationType !== undefined && change.relationType !== 'flow'
  const key = asRow ? ROW_KEYS[change.kind] : KEYS[`${change.what}:${change.kind}`]
  return s(key, {
    name: change.name,
    on: change.on ?? '',
    type: change.relationType ? s(RELATION_LABEL[change.relationType]) : '',
    // Field names are the model's own words and are not translated: they are
    // what somebody reading the file would see, which is the point of naming
    // them at all.
    fields: (change.fields ?? []).join(', '),
  })
}
