/**
 * Which languages there are, without the words in any of them.
 *
 * `strings.ts` is the registry, and importing it imports every module's slice —
 * `app/strings` and `editor/strings` among them. That is right for anything that
 * draws a screen and wrong for a process that has none, which is why
 * `interpolate.ts` sits on its own and why `commitMessage.ts` composes two
 * slices rather than asking for a translator.
 *
 * Recognising a language code has the same shape as filling a placeholder: it
 * needs no table. `projects/preferences.ts` vets a language out of a stored
 * blob, and it was reaching the whole registry through `isLanguage` to do it —
 * a settings reader pulling in the editor's vocabulary, and, the day something
 * in `app/` grows an import that needs a browser, a node process that stops
 * starting.
 *
 * So the codes live here and the tables live there. The two cannot drift:
 * `strings.ts` declares `TABLES` as a complete `Record<Language, StringTable>`,
 * so a code listed here with no table is an error there, and `satisfies` makes a
 * table with no code listed one too.
 */

/**
 * Every language there is. THE place to register one, together with its table in
 * `strings.ts` and its entry in `LANGUAGES` (the order the menu offers).
 */
export const LANGUAGE_CODES = ['en', 'nl', 'fy', 'de'] as const

export type Language = (typeof LANGUAGE_CODES)[number]

/** Is this one of ours? `hasOwnProperty`-safe: `'toString'` is not a language. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value)
}

/**
 * The language to start in when nobody has chosen: the first browser tag we have
 * a table for, English otherwise (roadmap decision 1).
 *
 * Order is honoured: the browser lists tags by preference, and the first one we
 * can serve wins.
 *
 * Takes the tags rather than reading `navigator` so it is testable without a
 * browser; the caller passes `navigator.languages ?? navigator.language`.
 */
export function detectBrowserLanguage(
  tags?: readonly string[] | string | undefined,
): Language {
  const list = typeof tags === 'string' ? [tags] : (tags ?? [])
  for (const tag of list) {
    if (typeof tag !== 'string') continue
    const primary = tag.toLowerCase().split('-')[0]
    if (isLanguage(primary)) return primary
  }
  return 'en'
}
