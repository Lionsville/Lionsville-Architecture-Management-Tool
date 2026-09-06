/**
 * Dutch, for what the outside world says when it cannot do as it is asked.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'shell.badProjectRef': 'Dat project heeft geen bruikbaar adres ({path}) en kan dus niet bewaard worden.',
  'shell.badGroupPath': 'Die groep heeft geen bruikbaar adres ({path}) en kan dus niet bewaard worden.',
}
