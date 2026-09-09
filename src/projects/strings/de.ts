/**
 * German, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a German screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const DE: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Diese Arbeitsdatei enthält keine Ansichten.',
  'shell.interchangeNoDiagrams': 'Dieses Dokument enthält keine Ansichten.',
  'git.andMore': ' und {count} weitere',
  'shell.unknownFile': 'Diese Datei ist weder ein Interchange-Dokument noch eine Arbeitsdatei.',
}
