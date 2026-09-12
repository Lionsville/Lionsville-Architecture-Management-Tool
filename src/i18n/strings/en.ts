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
  'common.languageFy': 'Frysk',
  'common.languageDe': 'Deutsch',
  'common.languageEn': 'English',
  'common.empty': 'Nothing written yet.',
  /** Three pages offer it — a diagram, a description, a decision — and it is the same word (ADR-0008). */
  'common.history': 'History…',
  /**
   * What to call the root scope where a path is what is being shown
   * (ADR-0012 §1). The root's path is the EMPTY STRING, so every screen that
   * prints one — a card's "from …", a finding, a change in the history — would
   * otherwise print a sentence with a hole in it. Three modules say it, which
   * is what `common.` is for.
   */
  'common.organisation': 'the organisation',
} as const
