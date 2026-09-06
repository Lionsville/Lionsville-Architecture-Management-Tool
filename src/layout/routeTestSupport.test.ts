import { describe, expect, it } from 'vitest';
import type { Rect } from '../model/types';
import { pathHitsObstacles } from './geometry';
import { pathClearance } from './routeTestSupport';

/**
 * `pathClearance` is a test helper, but it is now the assertion the routing suites
 * rest on, so it gets its own coverage: a silently wrong clearance function would
 * make every "the route clears the box" test vacuous without failing anything.
 */
describe('pathClearance', () => {
  const box: Rect = { x: 100, y: 400, width: 200, height: 218 }; // bottom edge at 618

  it('reports ZERO for the graze that pathHitsObstacles calls clear', () => {
    // The measured real-board failure of the old single-channel heuristic: a line at
    // y=617.99999988 against a box bottom of 618. It is inside the box, but by less
    // than `segmentIntersectsRect`'s epsilon, so the hit count reads clean.
    const grazing = [
      { x: 0, y: 617.99999988 },
      { x: 400, y: 617.99999988 },
    ];
    expect(pathHitsObstacles(grazing, [box], 0)).toBe(0); // …says clear, wrongly
    expect(pathClearance(grazing, [box])).toBe(0); // …says touching, correctly
  });

  it('reports ZERO for a line straight through the middle, not its distance to a corner', () => {
    // The case that makes the overlap test mandatory rather than an optimisation: the
    // vertex-pair formula is only valid for DISJOINT shapes, and a line bisecting the
    // box is ~109 px from every corner. Without the overlap test this would read as
    // comfortably clear — the worst possible failure for a clearance assertion.
    const through = [
      { x: 0, y: 509 },
      { x: 400, y: 509 },
    ];
    expect(pathClearance(through, [box])).toBe(0);
  });

  it('measures the perpendicular gap of a line running past an edge', () => {
    const below = [
      { x: 0, y: 638 },
      { x: 400, y: 638 },
    ];
    expect(pathClearance(below, [box])).toBeCloseTo(20, 6);
  });

  it('measures to a CORNER when the nearest approach is diagonal', () => {
    // Ends up-left of the box's top-left corner (100, 400): 3-4-5 triangle from it.
    const diagonal = [
      { x: 96, y: 300 },
      { x: 96, y: 397 },
    ];
    expect(pathClearance(diagonal, [box])).toBeCloseTo(5, 6);
  });

  it('is Infinity when there is nothing to clear, so an empty obstacle list cannot fake a pass', () => {
    expect(pathClearance([{ x: 0, y: 0 }, { x: 10, y: 0 }], [])).toBe(Infinity);
  });
});
