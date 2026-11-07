// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('what stands on a board stays under a page', () => {
  // A page is drawn over the view in the main column while the board stays mounted
  // under it. The note (z-index 4) once stacked against the page (z-index 3) and was
  // drawn over the observations page; the board's own stacking context is what holds
  // everything it draws beneath any page. jsdom lays nothing out, so the rule is read.
  it('gives the board a stacking context of its own', () => {
    expect(css('./board.css')).toMatch(/\.lv-board \{ isolation: isolate; \}/);
  });

  it('keeps the page a layer over the main column', () => {
    expect(css('../../widgets/kit/Frame.css')).toMatch(/\.kit-place \{ position: absolute; inset: 0; z-index: 3;/);
  });
});
