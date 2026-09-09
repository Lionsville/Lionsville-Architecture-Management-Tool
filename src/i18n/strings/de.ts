/**
 * German, for the words more than one module says.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {

  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.delete': 'Löschen',
  'common.save': 'Speichern',
  'common.none': 'Keine',
  'common.name': 'Name',
  'common.language': 'Sprache',
  'common.languageNl': 'Nederlands',
  'common.languageFy': 'Frysk',
  'common.languageDe': 'Deutsch',
  'common.languageEn': 'English',
  'common.empty': 'Noch nichts geschrieben.',
  'common.history': 'Verlauf…',
}
