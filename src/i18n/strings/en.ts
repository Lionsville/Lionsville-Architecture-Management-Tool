/**
 * English, for the words more than one module says.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {

  // --- shared vocabulary ---------------------------------------------------
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.none': 'None',
  'common.name': 'Name',
  'common.language': 'Language',
  'common.languageNl': 'Nederlands',
  'common.languageEn': 'English',
  'common.empty': 'Nothing written yet.',
} as const
