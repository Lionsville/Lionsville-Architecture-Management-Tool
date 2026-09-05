/**
 * THE STRING REGISTRY — the machinery around the tables, not the words.
 *
 * The words live one file per language (`strings.en.ts`, `strings.nl.ts`); this
 * file only registers them and looks them up. That split is what keeps adding a
 * language small: a new table file, one line in `TABLES` below, and one entry in
 * `LANGUAGES`. Everything else here derives from `TABLES` — the `Language` type,
 * `isLanguage`, the translators, and browser detection — so there is no list of
 * language codes to keep in step with anything.
 *
 * English is the schema (`keyof typeof EN`), so a key added on the English side
 * that nobody translated is a type error in the Dutch table rather than a Dutch
 * screen with an English sentence in it.
 *
 * `t(language, key, params?)` is pure and takes the language explicitly, which is
 * what lets the pure label tables (`canvas/menuItems`, `model/zones`,
 * `editor/keymap`) stay pure: they receive a {@link Translate} instead of
 * reaching for React context. Their default is English, so a caller that hands
 * over nothing keeps saying exactly what it said before this file existed.
 *
 * Placeholders are `{name}`. An unknown key returns the key itself rather than
 * throwing: a missing string is a blemish, never a blank editor.
 */
import { EN } from './strings.en';
import { NL } from './strings.nl';
import type { StringKey, StringParams, StringTable } from './table';

export type { StringKey, StringParams, StringTable } from './table';
export { EN } from './strings.en';
export { NL } from './strings.nl';

/**
 * Every language there is. THE place to register one.
 *
 * `satisfies` rather than an annotation on purpose: it checks each table without
 * widening the keys away, so `Language` below stays the exact union.
 */
const TABLES = { en: EN, nl: NL } satisfies Record<string, StringTable>;

/** Derived, so it can never disagree with the tables that actually exist. */
export type Language = keyof typeof TABLES;

export const STRINGS: Record<Language, StringTable> = TABLES;

/**
 * The languages in toggle order — a presentation choice, so it is written out
 * rather than derived from `TABLES` (whose order means nothing). `strings.test.ts`
 * checks it covers every registered language, so adding one and forgetting the
 * toggle fails a test rather than hiding a language from the UI.
 */
export const LANGUAGES: readonly Language[] = ['nl', 'en'];

/**
 * Fill `{placeholders}` from `params`. A placeholder with no matching param is
 * left standing rather than replaced with `undefined`, so a wiring mistake reads
 * as an obvious `{name}` on screen instead of a plausible-looking sentence.
 */
export function interpolate(template: string, params?: StringParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** The one lookup. Pure, and explicit about the language. */
export function t(language: Language, key: StringKey, params?: StringParams): string {
  const table = STRINGS[language] ?? STRINGS.en;
  return interpolate(table[key] ?? STRINGS.en[key] ?? key, params);
}

/** What every pure label table takes instead of reaching for React context. */
export type Translate = (key: StringKey, params?: StringParams) => string;

/**
 * One bound translator per language, built from the registry rather than listed.
 * A language added to `TABLES` gets one automatically; a hand-written list is
 * exactly the kind of thing that is forgotten once and then wrong for a release.
 */
const TRANSLATORS = Object.fromEntries(
  (Object.keys(STRINGS) as Language[]).map(
    (language) => [language, (key: StringKey, params?: StringParams) => t(language, key, params)],
  ),
) as Record<Language, Translate>;

export function translator(language: Language): Translate {
  return TRANSLATORS[language] ?? TRANSLATORS.en;
}

/**
 * The default every pure function falls back on when a caller hands it none.
 *
 * English on purpose: it keeps the label tables' existing behaviour — and the
 * suites that read them — exactly as they were, so moving strings into this file
 * changed no test's expectations.
 */
export const DEFAULT_TRANSLATE: Translate = TRANSLATORS.en;

/** Derived from the registry, so a new language is understood without an edit here. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STRINGS, value);
}

/**
 * The language to start in when nobody has chosen: the first browser tag we have
 * a table for, English otherwise (roadmap decision 1).
 *
 * Matches against the registry rather than a hardcoded pair, so a language added
 * to `TABLES` is picked up here too. Order is honoured: the browser lists tags
 * by preference, and the first one we can serve wins.
 *
 * Takes the tags rather than reading `navigator` so it is testable without a
 * browser; the caller passes `navigator.languages ?? navigator.language`.
 */
export function detectBrowserLanguage(
  tags?: readonly string[] | string | undefined,
): Language {
  const list = typeof tags === 'string' ? [tags] : (tags ?? []);
  for (const tag of list) {
    if (typeof tag !== 'string') continue;
    const primary = tag.toLowerCase().split('-')[0];
    if (isLanguage(primary)) return primary;
  }
  return 'en';
}

/** Count-aware pick between a `…One` and a `…Other` key. */
export function plural(
  translate: Translate,
  keys: { one: StringKey; other: StringKey },
  count: number,
  params?: StringParams,
): string {
  return translate(count === 1 ? keys.one : keys.other, { count, ...params });
}
