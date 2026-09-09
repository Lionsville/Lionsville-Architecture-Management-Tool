/**
 * Frisian, for what a project refuses to be.
 *
 * Typed from the English slice beside it, so a missing translation is a compile
 * error here rather than an English sentence on a Frisian screen. `strings.test.ts`
 * covers what the type cannot: empty values, and placeholders that were dropped
 * or invented in translation.
 */
import type { EN } from './en'

export const FY: Record<keyof typeof EN, string> = {
  'shell.workingFileNoDiagrams': 'Dit wurkbestân hat gjin oansichten.',
  'shell.interchangeNoDiagrams': 'Dit dokumint hat gjin oansichten.',
  'git.andMore': ' en noch {count}',
  'shell.unknownFile': 'Dit bestân is gjin interchange-dokumint en gjin wurkbestân.',
}
