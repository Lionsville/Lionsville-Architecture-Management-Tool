import { describe, expect, it } from 'vitest';
import type { NodePositionChange } from '@xyflow/react';
import { getHelperLines } from './HelperLines';
import type { ElementNode } from '../nodes/nodeData';
import { element, placement } from '../../model/testFixtures';
import { nodeMaxSize, nodeMinSize } from '../../model/placement';

function node(id: string, x: number, y: number, width = 100, height = 50): ElementNode {
  return {
    id,
    position: { x, y },
    measured: { width, height },
    data: {
      element: element(id),
      placement: placement(id),
      readOnly: false,
      aspectConfig: [],
      showLifecycle: true,
      resizeLimits: {
        min: nodeMinSize('application'),
        max: nodeMaxSize('application', 'landscape'),
      },
    },
  };
}

const move = (id: string, x: number, y: number): NodePositionChange => ({
  id,
  type: 'position',
  dragging: true,
  position: { x, y },
});

describe('getHelperLines', () => {
  it('snaps left edges and reports the vertical guide when within the threshold', () => {
    const nodes = [node('a', 103, 400), node('b', 100, 0)];
    const result = getHelperLines(move('a', 103, 400), nodes);
    expect(result.snapX).toBe(100); // a.left snaps to b.left
    expect(result.vertical).toBe(100);
    expect(result.snapY).toBeUndefined();
  });

  it('snaps horizontal centres (when no edge is closer)', () => {
    // b centre-x = 150; the narrow (40-wide) a only lines up on centres, so
    // the centre guide wins rather than an edge.
    const nodes = [node('a', 131, 300, 40, 50), node('b', 100, 0, 100, 50)];
    const result = getHelperLines(move('a', 131, 300), nodes);
    expect(result.snapX).toBe(130); // b.centerX (150) - a.width/2 (20)
    expect(result.vertical).toBe(150);
  });

  it('snaps top-to-bottom (stacking) on the y axis', () => {
    // b bottom = 50; a.top within 6px snaps to y=50.
    const nodes = [node('a', 500, 52), node('b', 0, 0)];
    const result = getHelperLines(move('a', 500, 52), nodes);
    expect(result.snapY).toBe(50);
    expect(result.horizontal).toBe(50);
  });

  it('returns nothing when no edge is within the threshold', () => {
    const nodes = [node('a', 1000, 1000), node('b', 0, 0)];
    expect(getHelperLines(move('a', 1000, 1000), nodes)).toEqual({});
  });

  it('ignores a change with no matching node', () => {
    expect(getHelperLines(move('ghost', 0, 0), [node('b', 0, 0)])).toEqual({});
  });
});
