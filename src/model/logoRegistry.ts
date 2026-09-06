import { matchesQuery, queryTokens } from './textSearch';
import { DEFAULT_TRANSLATE, type StringKey, type Translate } from '../i18n/strings';
import { GENERIC_MARKS } from './marks/generic';
import { RAIL_MARKS } from './marks/rail';
import { VENDOR_MARKS } from './marks/vendors';

/**
 * THE LOGO LIBRARY — data, not components.
 *
 * A mark is a record: a stable key, a label, a category, the words that find it,
 * and one 24×24 path. `PathMark` draws every one of them, which is why adding a
 * mark is a line in `marks/*.ts` and nothing else changes — not the picker, not
 * the resolver, not the nodes.
 *
 * Three sources, all offline and all `currentColor`:
 * - `marks/generic.ts` — hand-authored category marks (data, integration,
 *   applications, platform, security & operations).
 * - `marks/rail.ts` — the railway domain set, with Dutch keywords throughout.
 * - `marks/vendors.ts` — real brands from the CC0 `simple-icons` package,
 *   imported per icon (roadmap decision 5).
 *
 * Alongside them sits the host's UPLOADED library (`UploadedLogo`): full-colour
 * marks the host supplies as `{ key, label, url }` and the package renders in an
 * `img` and only ever in an `img` — an uploaded SVG inlined into the DOM could
 * carry a script. Uploaded keys are namespaced `lib:` by the shell, and that
 * prefix is what {@link useResolvedLogo} uses to decide which side to look in
 * first: a `lib:` key is an upload, anything else is a built-in. An
 * unresolvable key is not an error — it falls back to the element's kind glyph,
 * so a purged library entry or an unknown `iconType` from another tool cannot
 * break a diagram.
 */

export type LogoCategory =
  | 'data'
  | 'integration'
  | 'applications'
  | 'platform'
  | 'security'
  | 'rail'
  | 'vendors';

export interface LogoEntry {
  /** Stable slug persisted as `DesignElement.iconKey` — append-only. */
  key: string;
  /** Human label: the picker's tooltip, and the mark's accessible name. */
  label: string;
  category: LogoCategory;
  /** Extra search terms, Dutch synonyms included. Matched by {@link searchLogos}. */
  keywords: string[];
  /** Single 24×24 path. */
  path: string;
  /** How `PathMark` paints it; absent = `stroke`. */
  render?: 'fill' | 'stroke';
}

/** Picker group order and headings. */
export const LOGO_CATEGORIES: { key: LogoCategory; labelKey: StringKey }[] = [
  { key: 'data', labelKey: 'logo.category.data' },
  { key: 'integration', labelKey: 'logo.category.integration' },
  { key: 'applications', labelKey: 'logo.category.applications' },
  { key: 'platform', labelKey: 'logo.category.platform' },
  { key: 'security', labelKey: 'logo.category.security' },
  { key: 'rail', labelKey: 'logo.category.rail' },
  { key: 'vendors', labelKey: 'logo.category.vendors' },
];

/** A picker group's heading in the given language; English when none is given. */
export function logoCategoryLabel(
  category: LogoCategory,
  translate: Translate = DEFAULT_TRANSLATE,
): string {
  const entry = LOGO_CATEGORIES.find((c) => c.key === category);
  return entry ? translate(entry.labelKey) : category;
}

/** Every built-in mark, in picker order. */
export const LOGO_ENTRIES: LogoEntry[] = [...GENERIC_MARKS, ...RAIL_MARKS, ...VENDOR_MARKS];

const BY_KEY = new Map(LOGO_ENTRIES.map((entry) => [entry.key, entry]));

/** True when `key` names one of the built-in marks (the interchange vocabulary). */
export function isBuiltInLogoKey(key: string | undefined): boolean {
  return key !== undefined && BY_KEY.has(key);
}


/**
 * Filter marks by a free-text query over label + keywords + the category's own
 * heading, case- and diacritics-insensitively. Every whitespace-separated token
 * must match somewhere, so "rail camera" narrows rather than widens. A blank
 * query returns the list untouched (the same array — the picker then renders the
 * unfiltered groups).
 *
 * The category counts because the picker shows those headings: a grid with a
 * visible "Rail" group where typing "rail" finds nothing is a wart, and the
 * heading is as much a name for a mark as its own label is.
 *
 * Pure, and deliberately not a hook: the grid, the menu popover and any future
 * caller share one definition of "found".
 */
export function searchLogos(
  query: string,
  entries: LogoEntry[] = LOGO_ENTRIES,
  translate: Translate = DEFAULT_TRANSLATE,
): LogoEntry[] {
  if (queryTokens(query).length === 0) return entries;
  return entries.filter((entry) =>
    matchesLogoQuery(query, [
      entry.label,
      // Both languages' headings, so "spoor" and "rail" find the same group.
      logoCategoryLabel(entry.category, translate),
      logoCategoryLabel(entry.category),
      ...entry.keywords,
    ]),
  );
}

/**
 * The same definition of "found" for a caller whose entries are not
 * `LogoEntry`s — the picker's uploaded group has a label and a heading but no
 * keywords: every token of `query` occurs somewhere in `terms`, folded. A blank
 * query matches everything.
 */
export function matchesLogoQuery(query: string, terms: string[]): boolean {
  return matchesQuery(query, terms);
}
