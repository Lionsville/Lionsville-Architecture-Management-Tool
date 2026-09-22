// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Fill `{placeholders}` from params — the one piece of the string machinery that
 * needs no table at all.
 *
 * Its own module, and that is the whole reason it is not in `strings.ts`.
 * `strings.ts` composes the registry: importing it imports `strings.en.ts`,
 * which imports every module's slice, which reaches `app/strings` and
 * `editor/strings`. That is right for anything drawing a screen and wrong for a
 * process that has none — a build composed from this one that runs the reducer
 * and the folder format in node reaches for `projects/commitMessage.ts`, whose
 * words are two slices and whose only other need is this function. So this sits
 * where it can be had on its own; `strings.ts` re-exports it, so nobody has to
 * know that.
 *
 * `StringParams` arrives as a type, which is erased — the type comes from
 * `table.ts`, whose `StringKey` is `keyof typeof EN` and which therefore imports
 * the English table for its own reasons.
 */
import type { StringKey, StringParams } from './table';

/**
 * A placeholder with no matching param is left standing rather than replaced
 * with `undefined`, so a wiring mistake reads as an obvious `{name}` on screen
 * instead of a plausible-looking sentence.
 */
export function interpolate(template: string, params?: StringParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * A translate over one table and no registry.
 *
 * Every key is looked up in what this is handed, and an unknown one comes back
 * as itself — the registry's own answer to a missing string, for the same
 * reason: a missing word is a blemish, never a failure. A caller with a table in
 * another language hands that one over instead.
 *
 * Here rather than in `strings.ts` for the reason `interpolate` is: this is the
 * whole of what a module needs to read its OWN slice, and a module that reads
 * its own slice — `model/words.ts`, `projects/commitMessage.ts` — must not have
 * to import every other module's to do it.
 */
export function translateFrom(
  table: Readonly<Record<string, string>>,
): (key: StringKey, params?: StringParams) => string {
  return (key, params) => interpolate(table[key] ?? key, params);
}
