/**
 * THE STRING REGISTRY — the machinery around the tables, not the words.
 *
 * The words live one file per language (`strings.en.ts`, `strings.nl.ts`, …); this
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
import { DE } from './strings.de';
import { interpolate } from './interpolate';
import { EN } from './strings.en';
import { FY } from './strings.fy';
import { NL } from './strings.nl';
import type { StringKey, StringParams, StringTable } from './table';

export type { StringKey, StringParams, StringTable } from './table';
/**
 * Re-exported where it always was. It lives in `./interpolate` now so that a
 * caller that has a table of its own — a node process drafting a commit message
 * with two slices and no registry — can fill placeholders without importing the
 * registry, and therefore without importing every module's words.
 */
export { interpolate } from './interpolate';
export { DE } from './strings.de';
export { EN } from './strings.en';
export { FY } from './strings.fy';
export { NL } from './strings.nl';

/**
 * Every language there is. THE place to register one.
 *
 * `satisfies` rather than an annotation on purpose: it checks each table without
 * widening the keys away, so `Language` below stays the exact union.
 */
const TABLES = { en: EN, nl: NL, fy: FY, de: DE } satisfies Record<string, StringTable>;

/** Derived, so it can never disagree with the tables that actually exist. */
export type Language = keyof typeof TABLES;

export const STRINGS: Record<Language, StringTable> = TABLES;

/**
 * Words a build composed from this one brought with it.
 *
 * `TABLES` above is the schema and cannot be anything else: `StringKey` is
 * `keyof typeof EN`, and a type cannot be built from a runtime registration. So
 * a build that registers a source provider of its own — which brings its own
 * way in, and therefore its own label (`platform/sourceProvider.ts`) — has
 * words this table has never heard of, and `t` answered them with the key
 * itself. A blemish, as that file says, and one this makes unnecessary.
 *
 * Kept beside the tables rather than merged into them, which is what makes
 * "adding keys only" structural rather than a rule somebody has to keep: the
 * schema is never touched, `EN` stays the object every module composed, and
 * `strings.test.ts` still reads exactly the tables this repository ships.
 */
const REGISTERED: Partial<Record<Language, Record<string, string>>> = {};

/**
 * Is this build being developed rather than used?
 *
 * Read through a cast because this file is compiled twice — once by the app's
 * own config, which has Vite's types, and once by the desktop's, which has Node
 * and nothing else and reaches this file through `platform/`. The answer is the
 * same either way: a bundler that does not define it is a build nobody is
 * debugging.
 */
const DEV = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

/**
 * Teach this build words of its own.
 *
 * Additive, and only additive. A key this repository already owns is refused —
 * loudly while the build is being developed, and quietly in the one that ships,
 * because the alternative is a released app that will not start over a string.
 * The refusal is the whole point: a registration that could overwrite
 * `common.save` would be a way to change what every existing screen says from
 * outside the tree that is tested, and the keys it could hit are the ones a
 * person reads in a dialog before pressing the button.
 *
 * `strict` exists so the quiet half can be tested at all, exactly as
 * `ErrorBoundary`'s `showStack` does; nobody else passes it. What comes back is
 * the keys that were refused, so a caller that wants to know can look.
 */
export function registerStrings(
  language: Language,
  table: Readonly<Record<string, string>>,
  strict: boolean = DEV,
): readonly string[] {
  const taken = Object.keys(table).filter((key) => key in EN);
  if (taken.length > 0 && strict) {
    throw new Error(
      `registerStrings: these keys belong to the app itself and cannot be replaced: ${taken.join(', ')}`,
    );
  }
  const kept = REGISTERED[language] ?? (REGISTERED[language] = {});
  for (const [key, value] of Object.entries(table)) {
    if (!(key in EN)) kept[key] = value;
  }
  return taken;
}

/**
 * The languages in menu order — a presentation choice, so it is written out
 * rather than derived from `TABLES` (whose order means nothing). Dutch first and
 * Frisian beside it because that is where the tool comes from; then the two
 * neighbours. `strings.test.ts` checks it covers every registered language, so
 * adding one and forgetting the menu fails a test rather than hiding a language
 * from the UI.
 */
export const LANGUAGES: readonly Language[] = ['nl', 'fy', 'de', 'en'];

/**
 * How each language names itself, in the common vocabulary — a proper noun, so
 * it reads the same in every table and a person looking for their own language
 * finds it under the name they would use.
 */
export const LANGUAGE_NAME: Record<Language, StringKey> = {
  nl: 'common.languageNl',
  fy: 'common.languageFy',
  de: 'common.languageDe',
  en: 'common.languageEn',
};

/**
 * The BCP 47 tag `Intl` formats dates, times and numbers in for each language.
 *
 * Frisian has a tag of its own (`fy-NL`), but Chromium's ICU carries no data
 * for it, and `toLocale*` on an unknown tag falls back on the machine's own
 * default — a 12-hour clock on an American laptop, in a Frisian interface.
 * Frisian writes its dates, times and decimals exactly as Dutch does, so the
 * Dutch locale is the honest answer: the format is right and it is the same on
 * every machine. Only a written-out month name comes out Dutch.
 */
export const LOCALE: Record<Language, string> = {
  nl: 'nl-NL',
  fy: 'nl-NL',
  de: 'de-DE',
  en: 'en-GB',
};


/**
 * The one lookup. Pure, and explicit about the language.
 *
 * This language, then whatever a build registered for it, then English, then
 * whatever a build registered for English — the app's own words first at every
 * step, because a registration may only add. An unknown key still returns
 * itself rather than throwing: a missing string is a blemish, never a blank
 * editor.
 */
export function t(language: Language, key: StringKey, params?: StringParams): string {
  const table = STRINGS[language] ?? STRINGS.en;
  const found = table[key] ?? REGISTERED[language]?.[key] ?? STRINGS.en[key] ?? REGISTERED.en?.[key];
  return interpolate(found ?? key, params);
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
