import { describe, expect, it } from 'vitest';
import { isRectFullyVisible, toRect } from './viewportFit';

/** A 800×600 canvas that does not start at the window origin. */
const VIEWPORT = { x: 100, y: 50, width: 800, height: 600 };

describe('isRectFullyVisible', () => {
  it('is true for a node comfortably inside the canvas', () => {
    expect(isRectFullyVisible({ x: 300, y: 200, width: 180, height: 90 }, VIEWPORT)).toBe(true);
  });

  it('is true for a node flush against the edges — touching is still visible', () => {
    expect(isRectFullyVisible({ x: 100, y: 50, width: 800, height: 600 }, VIEWPORT)).toBe(true);
  });

  it('is false when it hangs off any one edge', () => {
    const cases = [
      { x: 90, y: 200, width: 180, height: 90 }, // left
      { x: 300, y: 40, width: 180, height: 90 }, // top
      { x: 800, y: 200, width: 180, height: 90 }, // right
      { x: 300, y: 600, width: 180, height: 90 }, // bottom
    ];
    for (const rect of cases) expect(isRectFullyVisible(rect, VIEWPORT)).toBe(false);
  });

  it('is false for a node wholly off-screen — the Tab case that needed the pan', () => {
    expect(isRectFullyVisible({ x: -400, y: 200, width: 180, height: 90 }, VIEWPORT)).toBe(false);
  });

  it('is false for a node bigger than the canvas, however it is centred', () => {
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
