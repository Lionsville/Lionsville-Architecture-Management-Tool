/**
 * Dutch, for the words more than one module says.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {

  'common.cancel': 'Annuleren',
  'common.close': 'Sluiten',
  'common.delete': 'Verwijderen',
  'common.save': 'Bewaren',
  'common.none': 'Geen',
  'common.name': 'Naam',
  'common.language': 'Taal',
  'common.languageNl': 'Nederlands',
  'common.languageEn': 'English',
  'common.empty': 'Nog niets geschreven.',
}
