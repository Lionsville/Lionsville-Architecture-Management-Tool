/**
 * German, for what the outside world says when it cannot do as it is asked.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'shell.badScopePath': 'Dieser Bereich hat keine verwendbare Adresse ({path}) und kann daher nicht gespeichert werden.',
  'shell.badGroupPath': 'Diese Gruppe hat keine verwendbare Adresse ({path}) und kann daher nicht gespeichert werden.',
  'shell.folderUnavailable': 'Dieser Ordner ist nicht verfügbar. Wählen Sie ihn erneut aus, oder verbinden Sie das Laufwerk wieder, auf dem er liegt.',
}
