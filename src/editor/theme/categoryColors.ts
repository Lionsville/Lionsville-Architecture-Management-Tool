/**
 * Deterministic category → colour mapping for application card strips.
 * The same category string always hashes to the same hue, in every session
 * and on every machine, so boards stay visually stable over time.
 *
 * This is the one deliberate exception to "derive everything from the MUI
 * palette": category identity needs more distinct hues than the palette
 * offers. Lightness/saturation are tuned per mode so strips read as saturated
 * accents on light paper and stay luminous (not muddy) on dark surfaces.
 */

/** Hand-picked hues, spaced for distinguishability (no two adjacent look alike). */
const HUES = [212, 352, 96, 268, 26, 168, 312, 52, 192, 232] as const;

/** FNV-1a 32-bit — tiny, stable, good spread for short strings. */
export function hashCategory(category: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < category.length; i += 1) {
    hash ^= category.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function categoryHue(category: string): number {
  return HUES[hashCategory(category.trim().toLowerCase()) % HUES.length];
}

const FALLBACK = { light: 'hsl(215, 12%, 58%)', dark: 'hsl(215, 10%, 46%)' };

/** Strip colour for a category. Uncategorised cards get a neutral grey strip. */
export function categoryColor(category: string | undefined, mode: 'light' | 'dark'): string {
  const trimmed = category?.trim();
  if (!trimmed) return FALLBACK[mode];
  const hue = categoryHue(trimmed);
  return mode === 'dark' ? `hsl(${hue}, 52%, 46%)` : `hsl(${hue}, 60%, 44%)`;
}
