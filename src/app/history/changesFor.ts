/**
 * The rows of a change list that are about one thing (ADR-0008).
 *
 * `diffModels` already says what each change happened to and which; per-thing
 * history is that list with the other subjects taken out. A diagram's changes
 * are its own row and its placement row; a description's are the element's
 * row when the description is among the fields that differ — or when the
 * element itself came or went, which took the description with it.
 */
import type { ModelChange } from '../../model/diff'
import type { HistorySubject } from '../../projects/historyPath'

export function changesFor(changes: readonly ModelChange[], subject: HistorySubject | undefined): ModelChange[] {
  if (!subject) return [...changes]
  return changes.filter((change) => {
    if (change.id !== subject.id) return false
    switch (subject.what) {
      case 'diagram':
        return change.what === 'diagram' || change.what === 'placement'
      case 'decision':
        return change.what === 'decision'
      case 'description':
        return change.what === 'element'
          && (change.kind !== 'changed' || (change.fields ?? []).includes('description'))
    }
  })
}
