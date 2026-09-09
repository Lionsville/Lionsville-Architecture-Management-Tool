/**
 * The words, in every language.
 *
 * The registry only: each module owns the strings for the screens it draws and
 * `strings.ts` composes them into one table. English is the schema, so a Dutch
 * key nobody translated is a type error rather than an English sentence on a
 * Dutch screen.
 *
 * `detectBrowserLanguage()` is the default when nobody has chosen yet — a
 * browser in a language we have a table for gets that one, everyone else
 * English.
 */
export { LANGUAGES, LANGUAGE_NAME, LOCALE, STRINGS, detectBrowserLanguage, isLanguage, t, translator } from './strings'
export type { Language, StringKey, StringParams, StringTable, Translate } from './strings'
export { LanguageProvider, useStrings } from './LanguageContext'
