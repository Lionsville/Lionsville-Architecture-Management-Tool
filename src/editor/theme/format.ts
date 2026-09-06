import { t, type Language } from '../../i18n/strings';

/**
 * Money and deltas for the scope chip (a `hal_app`-only decoration; the NS shell
 * passes no `scopeSummary`, so nothing renders these here today).
 *
 * The locale used to be hard-coded `nl-NL`, which printed Dutch grouping under
 * an English "/mo" on an English screen. It now follows the UI language, which
 * is the only signal the package has and the right one: the currency stays EUR
 * either way — only how a number is written, and what "per month" is called,
 * changes.
 *
 * Language is a parameter rather than a context read, so these stay pure and
 * unit-testable; it defaults to English, the same default `useStrings()` has.
 */
const LOCALES: Record<Language, string> = { nl: 'nl-NL', en: 'en-GB' };

const cache = new Map<Language, Intl.NumberFormat>();

/** `Intl.NumberFormat` is expensive to construct and these run per node, per render. */
function euro(language: Language): Intl.NumberFormat {
  const cached = cache.get(language);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(LOCALES[language] ?? LOCALES.en, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  cache.set(language, formatter);
  return formatter;
}

export function formatMonthlyPrice(amount: number, language: Language = 'en'): string {
  return t(language, 'format.perMonth', { amount: euro(language).format(amount) });
}

/**
 * "Δ €150/mo (+12%)" for the estimate-vs-linked-T&S delta chip. `percent`
 * is omitted when undefined (estimate is null/0 — see scopeDeltaFor).
 * `euro.format` already carries the sign for negative amounts.
 */
export function formatScopeDelta(
  amount: number,
  percent: number | undefined,
  language: Language = 'en',
): string {
  const pct = percent !== undefined ? ` (${percent > 0 ? '+' : ''}${Math.round(percent)}%)` : '';
  return `Δ ${formatMonthlyPrice(amount, language)}${pct}`;
}
