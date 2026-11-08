// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NODE_SIZES } from '../../model/placement';
import { SCALE } from '../../widgets/kit/tokens';
import { ZOOM_FLOOR } from '../../widgets/kit/zoom';

const css = readFileSync(new URL('./board.css', import.meta.url), 'utf8');

describe('a band chip says its whole name', () => {
  // A name holds its size on screen while the box shrinks with the zoom, so whether two
  // lines fit is sums on the tokens. A chip once kept one line far off and cut a role's
  // name to "Wareh…" at the landscape's opening fit.
  it('wraps to two lines on a landscape, as an application card does', () => {
    expect(css).toMatch(/\.lv-tile--low \.kit-card__name \{ -webkit-line-clamp: 2; line-height: var\(--lh-close\); \}/);
    expect(css).not.toMatch(/\.lv-tile--low \.kit-card__name \{ -webkit-line-clamp: 1;/);
  });

  it('is tall enough for both lines at the floor, in every band', () => {
    const lines = 2 * Number.parseFloat(SCALE['t-canvas-name']) * Number(SCALE['lh-close']);
    // A border and a pixel of padding above and below, on screen.
    const around = 2 + 2;
    for (const figure of ['actor', 'inputChannel', 'managementTool'] as const) {
      expect(NODE_SIZES[figure].height * ZOOM_FLOOR, figure).toBeGreaterThanOrEqual(lines + around);
    }
  });
});
