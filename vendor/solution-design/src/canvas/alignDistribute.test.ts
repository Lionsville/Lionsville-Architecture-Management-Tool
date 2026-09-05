import { describe, expect, it } from 'vitest';
import { alignNodes, distributeNodes, type NodeBounds } from './alignDistribute';

const box = (id: string, x: number, y: number, width = 100, height = 50): NodeBounds => ({
  id,
  x,
  y,
  width,
  height,
});

describe('alignNodes', () => {
  it('needs at least two nodes', () => {
    expect(alignNodes([box('a', 10, 10)], 'left')).toEqual([]);
    expect(alignNodes([], 'top')).toEqual([]);
  });

  it('aligns left edges to the minimum x', () => {
    const moves = alignNodes([box('a', 30, 0), box('b', 10, 0), box('c', 50, 0)], 'left');
    // b is already at the min; a and c move to x=10.
    expect(moves).toEqual([
      { elementId: 'a', x: 10, y: 0 },
      { elementId: 'c', x: 10, y: 0 },
    ]);
  });

  it('aligns right edges to the maximum right', () => {
    // widths differ so the resulting x differs per node.
    const moves = alignNodes([box('a', 0, 0, 100), box('b', 0, 0, 40)], 'right');
    // maxRight = 100; a stays (0+100), b -> 60.
    expect(moves).toEqual([{ elementId: 'b', x: 60, y: 0 }]);
  });

  it('aligns horizontal centres to the bounding-box centre', () => {
    // bbox: minLeft 0, maxRight 200 -> centreX 100.
    const moves = alignNodes([box('a', 0, 0, 100), box('b', 100, 0, 100)], 'centerX');
    expect(moves).toEqual([
      { elementId: 'a', x: 50, y: 0 },
      { elementId: 'b', x: 50, y: 0 },
    ]);
  });

  it('aligns top / bottom / vertical centres on the y axis', () => {
    expect(alignNodes([box('a', 0, 30), box('b', 0, 10)], 'top')).toEqual([
      { elementId: 'a', x: 0, y: 10 },
    ]);
    expect(alignNodes([box('a', 0, 0, 100, 50), box('b', 0, 0, 100, 20)], 'bottom')).toEqual([
      { elementId: 'b', x: 0, y: 30 },
    ]);
    expect(alignNodes([box('a', 0, 0, 100, 40), box('b', 0, 100, 100, 40)], 'centerY')).toEqual([
      { elementId: 'a', x: 0, y: 50 },
      { elementId: 'b', x: 0, y: 50 },
    ]);
  });

  it('omits nodes that already sit on the target', () => {
    const moves = alignNodes([box('a', 10, 0), box('b', 10, 0)], 'left');
    expect(moves).toEqual([]);
  });
});

describe('distributeNodes', () => {
  it('needs at least three nodes', () => {
    expect(distributeNodes([box('a', 0, 0), box('b', 100, 0)], 'horizontal')).toEqual([]);
  });

  it('evens the horizontal gaps, keeping the ends fixed', () => {
    // Three 100-wide boxes spanning 0..500 (span 500, total width 300),
    // total gap 200 over 2 gaps -> 100 each. Middle box lands at 200.
    const moves = distributeNodes(
      [box('a', 0, 0, 100), box('c', 400, 0, 100), box('b', 150, 0, 100)],
      'horizontal',
    );
    expect(moves).toEqual([{ elementId: 'b', x: 200, y: 0 }]);
  });

  it('evens the vertical gaps', () => {
    const moves = distributeNodes(
      [box('a', 0, 0, 100, 50), box('b', 0, 120, 100, 50), box('c', 0, 400, 100, 50)],
      'vertical',
    );
    // span 450, total height 150, gap = 300/2 = 150; middle b -> y = 50 + 150 = 200.
    expect(moves).toEqual([{ elementId: 'b', x: 0, y: 200 }]);
  });

  it('sorts by position before distributing (input order irrelevant)', () => {
    const ordered = distributeNodes(
      [box('a', 0, 0, 100), box('b', 150, 0, 100), box('c', 400, 0, 100)],
      'horizontal',
    );
    const shuffled = distributeNodes(
      [box('c', 400, 0, 100), box('a', 0, 0, 100), box('b', 150, 0, 100)],
      'horizontal',
    );
    expect(shuffled).toEqual(ordered);
  });

  it('omits interior nodes already evenly placed', () => {
    const moves = distributeNodes(
      [box('a', 0, 0, 100), box('b', 200, 0, 100), box('c', 400, 0, 100)],
      'horizontal',
    );
    expect(moves).toEqual([]);
  });
});
