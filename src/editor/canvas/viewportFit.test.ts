// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { isRectFullyVisible, largestRoom, panInto, toRect } from './viewportFit';

/** A 800×600 canvas that does not start at the window origin. */
const VIEWPORT = { x: 100, y: 50, width: 800, height: 600 };

describe('isRectFullyVisible', () => {
  it('is true for a node inside the canvas or flush against it, false the moment it hangs off', () => {
    expect(isRectFullyVisible({ x: 300, y: 200, width: 180, height: 90 }, VIEWPORT)).toBe(true);
    expect(isRectFullyVisible({ x: 100, y: 50, width: 800, height: 600 }, VIEWPORT)).toBe(true);
    const cases = [
      { x: 90, y: 200, width: 180, height: 90 }, // left
      { x: 300, y: 40, width: 180, height: 90 }, // top
      { x: 800, y: 200, width: 180, height: 90 }, // right
      { x: 300, y: 600, width: 180, height: 90 }, // bottom
    ];
    for (const rect of cases) expect(isRectFullyVisible(rect, VIEWPORT)).toBe(false);
    expect(isRectFullyVisible({ x: -400, y: 200, width: 180, height: 90 }, VIEWPORT)).toBe(false);
    expect(isRectFullyVisible({ x: 100, y: 50, width: 1200, height: 900 }, VIEWPORT)).toBe(false);
  });

  it('takes a margin, so a node half under the toolbar counts as hidden', () => {
    const rect = { x: 110, y: 60, width: 180, height: 90 };
    expect(isRectFullyVisible(rect, VIEWPORT)).toBe(true);
    expect(isRectFullyVisible(rect, VIEWPORT, 24)).toBe(false);
  });
});

describe('toRect', () => {
  it('reads a DOM rect into the plain shape the helpers speak', () => {
    expect(toRect({ left: 12, top: 34, width: 56, height: 78 })).toEqual({
      x: 12,
      y: 34,
      width: 56,
      height: 78,
    });
  });
});

describe('panning a focused card into the free room', () => {
  const room = { x: 0, y: 0, width: 1000, height: 600 };
  it('moves nothing for a card already inside', () => {
    expect(panInto({ x: 100, y: 100, width: 200, height: 100 }, room)).toEqual({ dx: 0, dy: 0 });
  });
  it('moves the least that brings a card under the dock or off an edge in', () => {
    expect(panInto({ x: 900, y: 560, width: 200, height: 100 }, room)).toEqual({ dx: -116, dy: -76 });
    expect(panInto({ x: -50, y: 10, width: 200, height: 100 }, room)).toEqual({ dx: 66, dy: 6 });
  });
  it('takes the largest of the rooms the floats leave', () => {
    const pane = { x: 0, y: 0, width: 1000, height: 600 };
    expect(largestRoom(pane, [{ top: 0, right: 0, bottom: 100, left: 0 }, { top: 0, right: 400, bottom: 0, left: 0 }])).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
  });
});
