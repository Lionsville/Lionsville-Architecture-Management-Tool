import { describe, expect, it } from 'vitest';
import type { Rect } from './types';
import { diagonalSegments } from '../layout/routeTestSupport';
import {
  assignEdgeAnchors,
  closestSides,
  routeEndAnchor,
  routeEndLeg,
  SIDE_STUB,
} from './floatingEdgeMath';

/**
 * Fixed attach sides in the anchor math (Phase 2d). A fixed end is not scored —
 * its side is the only candidate — and a routed end on a fixed side gets a stub
 * when its leg cannot meet the side square, so the line never leaves diagonally.
 */

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
// a: 100..300 × 100..230 (right-side centre y = 165); b sits to its right.
const a = rect(100, 100, 200, 130);
const b = rect(600, 100, 200, 130);

describe('closestSides with a fixed end', () => {
  it('takes the fixed side as given and chooses the free end against it', () => {
    const free = closestSides(a, b);
    expect([free.sourcePosition, free.targetPosition]).toEqual(['right', 'left']);

    const fixed = closestSides(a, b, { sourceSide: 'top' });
    expect(fixed.sourcePosition).toBe('top');
    expect([fixed.sourceX, fixed.sourceY]).toEqual([200, 100]);
    // The target is still free and is chosen AGAINST the fixed side: from a's top
    // the line runs up and across, so b's top faces it with no facing-away penalty
    // (b's left would need the line to come back down first).
    expect(fixed.targetPosition).toBe('top');

    const both = closestSides(a, b, { sourceSide: 'bottom', targetSide: 'bottom' });
    expect([both.sourcePosition, both.targetPosition]).toEqual(['bottom', 'bottom']);
  });

});

describe('assignEdgeAnchors with fixed sides', () => {
  it('fans two edges told to leave from the same side out along that side', () => {
    const rects = new Map([
      ['a', a],
      ['b', b],
      ['c', rect(600, 400, 200, 130)],
    ]);
    const anchors = assignEdgeAnchors(
      [
        { id: 'ab', sourceId: 'a', targetId: 'b', sourceSide: 'top' },
        { id: 'ac', sourceId: 'a', targetId: 'c', sourceSide: 'top' },
      ],
      rects,
    );
    const ab = anchors.get('ab')!;
    const ac = anchors.get('ac')!;
    expect(ab.sourcePosition).toBe('top');
    expect(ac.sourcePosition).toBe('top');
    expect(ab.sourceY).toBe(100);
    expect(ac.sourceY).toBe(100);
    expect(ab.sourceX).not.toBe(ac.sourceX); // two slots, not one stack
  });

  it('leaves edges without sides exactly where they were', () => {
    const rects = new Map([
      ['a', a],
      ['b', b],
    ]);
    const plain = assignEdgeAnchors([{ id: 'ab', sourceId: 'a', targetId: 'b' }], rects);
    const explicit = assignEdgeAnchors(
      [{ id: 'ab', sourceId: 'a', targetId: 'b', sourceSide: undefined, targetSide: undefined }],
      rects,
    );
    expect(explicit.get('ab')).toEqual(plain.get('ab'));
    expect(plain.get('ab')).toMatchObject({ sourceX: 300, sourceY: 165, sourcePosition: 'right' });
  });
});

describe('routeEndLeg', () => {
  it('meets a fixed side square when the leg can: the anchor slides along it, no stub', () => {
    // A vertical leg from above, within a's x-span, onto a fixed top.
    const leg = routeEndLeg(a, { x: 250, y: 20 }, 'top');
    expect(leg.anchor).toMatchObject({ position: 'top', x: 250, y: 100 });
    expect(leg.stubs).toEqual([]);
    // A horizontal leg from the right onto a fixed right.
    const right = routeEndLeg(a, { x: 500, y: 200 }, 'right');
    expect(right.anchor).toMatchObject({ position: 'right', x: 300, y: 200 });
    expect(right.stubs).toEqual([]);
    // A waypoint ON the side's line still meets it (a pinned router end).
    expect(routeEndLeg(a, { x: 300, y: 165 }, 'right')).toEqual({
      anchor: { position: 'right', x: 300, y: 165 },
      stubs: [],
    });
  });

  it('adds a stub out of the side, then across, when the waypoint is off to one side of it', () => {
    // Told to leave from the TOP, but the route runs off to the right at mid height.
    const leg = routeEndLeg(a, { x: 500, y: 165 }, 'top');
    expect(leg.anchor).toMatchObject({ position: 'top', x: 200, y: 100 });
    expect(leg.stubs).toEqual([
      { x: 200, y: 100 - SIDE_STUB },
      { x: 500, y: 100 - SIDE_STUB },
    ]);
    expect(diagonalSegments([leg.anchor, ...leg.stubs, { x: 500, y: 165 }])).toEqual([]);
  });

  it('shortens the stub to the waypoint’s line when that is nearer than SIDE_STUB', () => {
    // Above the top by 10, but outside the x-span: out 10, then across — one stub.
    const leg = routeEndLeg(a, { x: 500, y: 90 }, 'top');
    expect(leg.stubs).toEqual([{ x: 200, y: 90 }]);
    expect(diagonalSegments([leg.anchor, ...leg.stubs, { x: 500, y: 90 }])).toEqual([]);
  });

  it('mirrors for the other three sides and stays square for a waypoint BEHIND the side', () => {
    for (const side of ['right', 'bottom', 'left'] as const) {
      // A waypoint on the far side of the node from the fixed side.
      const behind = { right: { x: -200, y: 165 }, bottom: { x: 200, y: -200 }, left: { x: 700, y: 165 } }[side];
      const leg = routeEndLeg(a, behind, side);
      expect(leg.anchor.position).toBe(side);
      expect(leg.stubs.length).toBeGreaterThan(0);
      expect(diagonalSegments([leg.anchor, ...leg.stubs, behind]), side).toEqual([]);
    }
  });

  it('routeEndAnchor with a side is the leg’s anchor; without one it is what it always was', () => {
    expect(routeEndAnchor(a, { x: 500, y: 165 }, 'top')).toEqual(routeEndLeg(a, { x: 500, y: 165 }, 'top').anchor);
    expect(routeEndAnchor(a, { x: 500, y: 165 })).toMatchObject({ position: 'right', x: 300, y: 165 });
    expect(routeEndLeg(a, { x: 500, y: 165 })).toEqual({ anchor: routeEndAnchor(a, { x: 500, y: 165 }), stubs: [] });
  });
});
