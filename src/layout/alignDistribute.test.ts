// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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

  it('aligns to the edge or the centre the caller names, leaving what already sits there', () => {
    const moves = alignNodes([box('a', 30, 0), box('b', 10, 0), box('c', 50, 0)], 'left');
    // b is already at the min; a and c move to x=10.
    expect(moves).toEqual([
      { id: 'a', x: 10, y: 0 },
      { id: 'c', x: 10, y: 0 },
    ]);
    // widths differ so the resulting x differs per node.
    const moves2 = alignNodes([box('a', 0, 0, 100), box('b', 0, 0, 40)], 'right');
    // maxRight = 100; a stays (0+100), b -> 60.
    expect(moves2).toEqual([{ id: 'b', x: 60, y: 0 }]);
    // bbox: minLeft 0, maxRight 200 -> centreX 100.
    const moves3 = alignNodes([box('a', 0, 0, 100), box('b', 100, 0, 100)], 'centerX');
    expect(moves3).toEqual([
      { id: 'a', x: 50, y: 0 },
      { id: 'b', x: 50, y: 0 },
    ]);
    const moves4 = alignNodes([box('a', 10, 0), box('b', 10, 0)], 'left');
    expect(moves4).toEqual([]);
  });

  it('aligns top / bottom / vertical centres on the y axis', () => {
    expect(alignNodes([box('a', 0, 30), box('b', 0, 10)], 'top')).toEqual([
      { id: 'a', x: 0, y: 10 },
    ]);
    expect(alignNodes([box('a', 0, 0, 100, 50), box('b', 0, 0, 100, 20)], 'bottom')).toEqual([
      { id: 'b', x: 0, y: 30 },
    ]);
    expect(alignNodes([box('a', 0, 0, 100, 40), box('b', 0, 100, 100, 40)], 'centerY')).toEqual([
      { id: 'a', x: 0, y: 50 },
      { id: 'b', x: 0, y: 50 },
    ]);
  });

});

describe('distributeNodes', () => {
  it('evens the gaps on either axis with the ends fixed, and needs three nodes to do it', () => {
    expect(distributeNodes([box('a', 0, 0), box('b', 100, 0)], 'horizontal')).toEqual([]);
    // Three 100-wide boxes spanning 0..500 (span 500, total width 300),
    // total gap 200 over 2 gaps -> 100 each. Middle box lands at 200.
    const moves = distributeNodes(
      [box('a', 0, 0, 100), box('c', 400, 0, 100), box('b', 150, 0, 100)],
      'horizontal',
    );
    expect(moves).toEqual([{ id: 'b', x: 200, y: 0 }]);
    const moves2 = distributeNodes(
      [box('a', 0, 0, 100, 50), box('b', 0, 120, 100, 50), box('c', 0, 400, 100, 50)],
      'vertical',
    );
    // span 450, total height 150, gap = 300/2 = 150; middle b -> y = 50 + 150 = 200.
    expect(moves2).toEqual([{ id: 'b', x: 0, y: 200 }]);
    const moves3 = distributeNodes(
      [box('a', 0, 0, 100), box('b', 200, 0, 100), box('c', 400, 0, 100)],
      'horizontal',
    );
    expect(moves3).toEqual([]);
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

});
