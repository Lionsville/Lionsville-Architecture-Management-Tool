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

/**
 * Every subject the diff can name, times every kind — as a type, so that a
 * subject added to `diffModels` without a sentence here is a compile error and
 * not a page that throws the first time somebody opens the history of a
 * project with one in it. Placement is the exception: it is a count, not a
 * kind, and has its own line below.
 */
type LineKey = `${Exclude<ChangeSubject, 'placement'>}:${ChangeKind}`

const KEYS: Record<LineKey, StringKey> = {
  'element:added': 'change.elementAdded',
  'element:removed': 'change.elementRemoved',
  'element:changed': 'change.elementChanged',
  'connection:added': 'change.connectionAdded',
  'connection:removed': 'change.connectionRemoved',
  'connection:changed': 'change.connectionChanged',
  'diagram:added': 'change.diagramAdded',
  'diagram:removed': 'change.diagramRemoved',
  'diagram:changed': 'change.diagramChanged',
  'decision:added': 'change.decisionAdded',
  'decision:removed': 'change.decisionRemoved',
  'decision:changed': 'change.decisionChanged',
  'transition:added': 'change.transitionAdded',
  'transition:removed': 'change.transitionRemoved',
  'transition:changed': 'change.transitionChanged',
}

export function changeLine(change: ModelChange, s: Translate): string {
  if (change.what === 'placement') {
    return s('change.placement', { count: change.count ?? 0, name: change.name })
  }
  const key = KEYS[`${change.what}:${change.kind}`]
  return s(key, {
    name: change.name,
    // Field names are the model's own words and are not translated: they are
    // what somebody reading the file would see, which is the point of naming
    // them at all.
    fields: (change.fields ?? []).join(', '),
  })
}
