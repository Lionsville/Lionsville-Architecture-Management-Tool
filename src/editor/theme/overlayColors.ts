// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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

/**
 * The band's own colour at full strength: the hue, a phase's or a status's
 * ink, or the disabled ink for the two neutral bands. What the card's edge
 * bar, its number tag and the legend's swatch are drawn in — the part of the
 * overlay that is not a wash, so a band reads at the zoom where a wash is a
 * faint tint and under a colour vision that tells two hues apart poorly.
 */
export function overlayInk(theme: Theme, band: OverlayBand): string {
  const tokens = getNodeTokens(theme);
  // The neutral bands' ink is the second ink, not the disabled one: the
  // number drawn on it is a word, and reads at the contrast a word needs.
  if (band.key === 'none' || band.key === 'unset') return theme.palette.text.secondary;
  if (band.phase) return tokens.lifecycle[band.phase].fg;
  if (band.status) return band.status === 'unset' ? theme.palette.text.secondary : tokens.aspects[band.status].fg;
  return HUES[band.slot % HUES.length];
}

/**
 * The wash over the card's ground. Deepened in 3.7.0 — a sixth over white
 * was a tint nobody could see at the zoom a landscape of forty cards fits
 * at — and the two neutral bands stay a grey: "on nothing" and "not set" are
 * the absence of an answer, and giving them a hue would make them look like
 * one more platform or one more value.
 */
export function overlayTint(theme: Theme, band: OverlayBand): string {
  const dark = theme.palette.mode === 'dark';
  const wash = dark ? 0.34 : 0.26;
  if (band.key === 'none' || band.key === 'unset' || band.status === 'unset') {
    return alpha(theme.palette.text.disabled, dark ? 0.16 : 0.1);
  }
  if (band.status === 'none') return alpha(theme.palette.text.secondary, dark ? 0.2 : 0.12);
  return alpha(overlayInk(theme, band), wash);
}

/** The band's number in the legend, 1-based: what the card's tag says. */
export function overlayIndex(band: OverlayBand): number {
  return band.slot + 1;
}

/** What one card wears under the overlay, resolved once per band (`useBoardView`). */
export interface OverlayMark {
  tint: string;
  ink: string;
  /** The legend's number for this band. */
  index: number;
}
