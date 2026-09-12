/**
 * Frisian, for what the outside world says when it cannot do as it is asked.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {
  'shell.badScopePath': 'Dat ûnderdiel hat gjin brûkber adres ({path}) en kin dus net bewarre wurde.',
  'shell.folderUnavailable': 'Dy map is net beskikber. Kies him opnij, of keppel de skiif wer oan dêr\'t er op stiet.',
}
