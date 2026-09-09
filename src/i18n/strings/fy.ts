/**
 * Frisian, for the words more than one module says.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {

  'common.cancel': 'Annulearje',
  'common.close': 'Slute',
  'common.delete': 'Fuortsmite',
  'common.save': 'Bewarje',
  'common.none': 'Gjin',
  'common.name': 'Namme',
  'common.language': 'Taal',
  'common.languageNl': 'Nederlands',
  'common.languageFy': 'Frysk',
  'common.languageDe': 'Deutsch',
  'common.languageEn': 'English',
  'common.empty': 'Noch neat skreaun.',
  'common.history': 'Skiednis…',
}
