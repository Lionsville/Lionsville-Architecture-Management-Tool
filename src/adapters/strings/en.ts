/**
 * English, for what the outside world says when it cannot do as it is asked.
 *
 * `as const`, so this slice is the schema for its own keys: `nl.ts` beside it
 * cannot be missing one and cannot invent one. The registry composes every
 * module's slice into the table `t()` reads (`i18n/strings.ts`).
 */
export const EN = {
  /**
   * The two refusals a store makes about the address it was handed, rather than
   * about the storage underneath. They travel as keys like everything else: a
   * store has no language of its own, and these used to be English sentences
   * shown verbatim to somebody who had chosen Dutch.
   */
  'shell.badProjectRef': 'That project has no usable address ({path}), so it cannot be saved.',
  'shell.badGroupPath': 'That group has no usable address ({path}), so it cannot be saved.',
} as const
