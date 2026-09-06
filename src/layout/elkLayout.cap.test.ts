import { describe, expect, it } from 'vitest';
import {
  canCancelElkLayout, isLayoutRefusal, layoutGraph, LayoutRefused, MAX_TIDY_NODES,
} from './elkLayout';
import type { ElkChild } from './elkLayout';

/**
 * The board Tidy will not lay out.
 *
 * The cap is a refusal rather than a slow answer, and it is checked before the
 * engine is even loaded — a board of a thousand boxes should cost nothing at
 * all to decline, not 1.4 MB of download and then a wait.
 */

const boxes = (count: number, at = 0): ElkChild[] =>
  Array.from({ length: count }, (_, n) => ({ id: `n${at + n}`, width: 200, height: 130 }));

describe('the size cap', () => {
  it('refuses a board past it, and says by how much', async () => {
    const asked = MAX_TIDY_NODES + 1;
    await expect(layoutGraph(boxes(asked), [])).rejects.toThrow(LayoutRefused);
    const refusal = await layoutGraph(boxes(asked), []).catch((error: unknown) => error);
    expect(isLayoutRefusal(refusal, 'tooLarge')).toBe(true);
    expect((refusal as LayoutRefused).count).toBe(asked);
    expect((refusal as LayoutRefused).limit).toBe(MAX_TIDY_NODES);
  });

  it('counts the members of a group, not only the group', async () => {
    // A landscape reaches the cap through its groups long before it reaches it
    // through its top level, and ELK lays out every box either way.
    const grouped: ElkChild[] = [
      { id: 'g1', width: 0, height: 0, children: boxes(MAX_TIDY_NODES, 0) },
      { id: 'g2', width: 0, height: 0, children: boxes(2, 9_000) },
    ];
    const refusal = await layoutGraph(grouped, []).catch((error: unknown) => error);
    expect(isLayoutRefusal(refusal, 'tooLarge')).toBe(true);
    expect((refusal as LayoutRefused).count).toBe(MAX_TIDY_NODES + 4);
  });

  it('does not promise a cancel it cannot keep', () => {
    // No worker has been handed in, so the algorithm runs on this thread and
    // there is nothing to stop. The button asks this before offering itself.
    expect(canCancelElkLayout()).toBe(false);
  });
});
