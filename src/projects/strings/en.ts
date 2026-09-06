/**
 * English, for what a project refuses to be.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  'shell.workingFileNoDiagrams': 'This working file has no diagrams.',
  'shell.interchangeNoDiagrams': 'This document has no diagrams.',
  'shell.unknownFile': 'This file is neither an interchange document nor a working file.',
} as const
