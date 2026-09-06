/**
 * Dutch, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Dutch screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const NL: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Dit werkbestand heeft geen aanzichten.',
  'shell.interchangeNoDiagrams': 'Dit document heeft geen aanzichten.',
  'git.andMore': ' en nog {count}',
  'shell.unknownFile': 'Dit bestand is geen interchange-document en geen werkbestand.',
}
