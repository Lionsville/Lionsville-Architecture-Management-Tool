/**
 * The shape of a string table, derived from the English one.
 *
 * Its own module so the language files form a straight line instead of a circle:
 * `strings.en.ts` -> `table.ts` -> `strings.nl.ts` -> `strings.ts`. Put these
 * types in `strings.ts` and every language file would have to import from the
 * module that imports it.
 */
import { EN } from './strings.en';

/** Every key that exists. English is the schema; see `strings.en.ts`. */
export type StringKey = keyof typeof EN;

/** What a complete language table looks like: a value for every key, no extras. */
export type StringTable = Record<StringKey, string>;

/** The `{named}` values interpolated into a string. */
export type StringParams = Record<string, string | number>;
