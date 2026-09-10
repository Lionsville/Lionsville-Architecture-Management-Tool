/**
 * The rows of a change list that are about one thing (ADR-0008).
 *
 * `diffModels` already says what each change happened to and which; per-thing
 * history is that list with the other subjects taken out. A diagram's changes
 * are its own row, its membership rows and its geometry row — the three files
 * ADR-0012 §6 splits a view into, read back as one list. Membership is filed
 * under the VIEW and not under the element that came or went: it is the view's
 * definition that changed, and a person asking what happened to this board is
 * asking exactly that. A description's changes are the element's row when the
 * description is among the fields that differ, or when the element itself came
 * or went, which took the description with it.
 */
import type { ModelChange } from '../../model/diff'
import type { HistorySubject } from '../../projects/historyPath'

export function changesFor(changes: readonly ModelChange[], subject: HistorySubject | undefined): ModelChange[] {
  if (!subject) return [...changes]
  return changes.filter((change) => {
    switch (subject.what) {
      case 'diagram':
        // A membership row names the element, so it is the view beside it that
        // says which board this belongs to.
        if (change.what === 'membership') return change.onId === subject.id
        return change.id === subject.id
          && (change.what === 'diagram' || change.what === 'geometry')
      case 'decision':
        return change.id === subject.id && change.what === 'decision'
      case 'description':
        return change.id === subject.id && change.what === 'element'
          && (change.kind !== 'changed' || (change.fields ?? []).includes('description'))
    }
  })
}
