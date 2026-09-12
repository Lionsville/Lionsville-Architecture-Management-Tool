/**
 * What to say when the exchange document is smaller than the project.
 *
 * The interchange format is a contract with other tools and does not change
 * (ADR-0012 §11), so it carries boxes on a board and flows between
 * applications — and since ADR-0012 §4 and §5 a project can hold more than
 * that. `toInterchange` counts what stayed behind; this turns the count into
 * the one sentence the toast shows.
 *
 * It is here and not in `model/` for the usual reason: the model answers in
 * keys and counts, and only the shell turns a key into words. The words for a
 * relation's type and an element's kind come from the tables those modules
 * publish, which is how a module says something about another module's
 * vocabulary without naming its keys.
 */
import type { Translate } from '../i18n'
import { KIND_LABEL_KEYS } from '../model/kinds'
import { RELATION_LABEL } from '../model/relations'
import type { InterchangeOmissions } from '../model/toInterchange'

/**
 * The toast for an export that has just happened.
 *
 * One sentence either way: the plain one when the document carries everything
 * the project holds, and the one that names what it does not when it does not.
 * Never two toasts — a person who exports a landscape with no business layer
 * on it should see exactly what they have always seen.
 */
export function interchangeSaved(omitted: InterchangeOmissions, s: Translate): string {
  const parts = [
    ...omitted.relations.map(({ type, count }) =>
      s('shell.leftOutPart', { count, label: s(RELATION_LABEL[type]) })),
    ...omitted.elements.map(({ kind, count }) =>
      s('shell.leftOutPart', { count, label: s(KIND_LABEL_KEYS[kind]) })),
  ]
  return parts.length === 0
    ? s('shell.savedInterchange')
    : s('shell.savedInterchangeLeftOut', { left: parts.join(', ') })
}
