// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { alpha, type Theme } from '@mui/material/styles';
import { tokensOf } from '../../widgets/kit/tokens';
import { getNodeTokens } from './tokens';
import type { OverlayBand } from '../../model/overlay';

/**
 * What an overlay band is painted in (ADR-0013, redone): one of six lens colours with
 * its soft pair, a status's or a phase's own, or a neutral. Six because no larger set
 * stays apart on these surfaces, measured; a band past them is *Other* (`otherBands`).
 *
 * A wash, not a fill: the card stays a card. Beside it the rail and the number, which
 * read at a distance and to an eye that tells two hues apart poorly.
 */
const LENSES = 6;

type Colours = ReturnType<typeof tokensOf>;

const lensOf = (colours: Colours, slot: number) => {
  const n = (slot % LENSES) + 1 as 1 | 2 | 3 | 4 | 5 | 6;
  return { ink: colours[`lens-${n}`], soft: colours[`lens-${n}-soft`] };
};

/** The band's own colour at full strength: its rail, its number's ground and the key's swatch. */
export function overlayInk(theme: Theme, band: OverlayBand): string {
  const tokens = getNodeTokens(theme);
  // The neutral bands' ink is the second ink: the number drawn on it is a word.
  if (band.key === 'none' || band.key === 'unset') return theme.palette.text.secondary;
  if (band.phase) return tokens.lifecycle[band.phase].fg;
  if (band.status) return band.status === 'unset' ? theme.palette.text.secondary : tokens.aspects[band.status].fg;
  return lensOf(tokensOf(theme), band.slot).ink;
}

/** The wash over the card's ground. The neutral bands stay a grey: the absence of an answer is no hue. */
export function overlayTint(theme: Theme, band: OverlayBand): string {
  const dark = theme.palette.mode === 'dark';
  const tokens = getNodeTokens(theme);
  if (band.key === 'none' || band.key === 'unset' || band.status === 'unset') {
    return alpha(theme.palette.text.disabled, dark ? 0.16 : 0.1);
  }
  if (band.status === 'none') return alpha(theme.palette.text.secondary, dark ? 0.2 : 0.12);
  if (band.status) return tokens.aspects[band.status].bg;
  if (band.phase) return tokens.lifecycle[band.phase].bg;
  return lensOf(tokensOf(theme), band.slot).soft;
}

/** The band's number in the key, 1-based: what the card's tag says. */
export function overlayIndex(band: OverlayBand): number {
  return band.slot + 1;
}

/** What one card wears under the overlay, resolved once per band (`useBoardView`). */
export interface OverlayMark {
  tint: string;
  ink: string;
  /** What is written on the ink. */
  on: string;
  /** The key's number for this band. */
  index: number;
}
