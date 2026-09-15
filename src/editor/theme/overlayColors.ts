import { alpha, type Theme } from '@mui/material/styles';
import { getNodeTokens } from './tokens';
import type { OverlayBand } from '../../model/overlay';

/**
 * What an overlay band is painted in (ADR-0013, redone).
 *
 * A wash, not a fill: the card stays a card, and the colour says which group
 * it is in rather than replacing what the card already says with a block of
 * paint. Strong enough to read at the zoom where a landscape of forty cards
 * fits on a screen, which is the only zoom the overlay is for.
 *
 * The platform palette is eight hues that stay apart at that wash — deliberately
 * NOT the category strip's palette, which is already on the same card and means
 * something else. It wraps after eight, which is honest: a landscape standing on
 * nine platforms is not a picture anybody reads by colour anyway.
 */
const HUES = [
  '#3b82f6', '#f97316', '#10b981', '#a855f7',
  '#ef4444', '#14b8a6', '#eab308', '#ec4899',
] as const;

export function overlayTint(theme: Theme, band: OverlayBand): string {
  const dark = theme.palette.mode === 'dark';
  const wash = dark ? 0.26 : 0.16;
  // "On nothing" is neutral rather than a ninth colour: it is the absence of an
  // answer, and giving it a hue would make it look like one more platform.
  if (band.key === 'none') return alpha(theme.palette.text.disabled, dark ? 0.14 : 0.08);
  if (band.phase) return alpha(getNodeTokens(theme).lifecycle[band.phase].fg, wash);
  return alpha(HUES[band.slot % HUES.length], wash);
}
