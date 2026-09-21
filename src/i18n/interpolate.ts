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
import type { StringParams } from './table';

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
