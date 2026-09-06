/**
 * Whatever was thrown, as a sentence in the user's language.
 *
 * The one place that knows both halves. Below this line a refusal is a
 * {@link ShellError} carrying a key, because `core` and the adapters have no
 * language of their own; here the key becomes words. Anything else — a
 * `TypeError`, a `QuotaExceededError`, a `throw 'oops'` — gets the generic
 * sentence with its own message inside it, which is not elegant but is honest:
 * it names something the user can quote in a report.
 */
import type { Translate } from '@lionsville/solution-design'
import { reasonOf, ShellError } from '../core/errors'

export function messageFor(error: unknown, s: Translate): string {
  if (error instanceof ShellError) return s(error.key, error.params)
  return s('shell.processFailed', { message: reasonOf(error) })
}
