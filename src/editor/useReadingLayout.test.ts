// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { laidOut, type V3Diagram } from '../model/testFixtures';
import { placedNodes } from '../model/placement';
import type { DesignDiagram, DesignModel } from '../model/types';
import { DEFAULT_TIDY_OPTIONS, type TidyOptions, type TidyResult } from '../layout/tidy';
import { carriedOver, laidOutForReading, useReadingLayout, type UseReadingLayoutArgs } from './useReadingLayout';

/**
 * When a reader is shown a pass, and what the board shown is. One case per
 * precondition, as in `useAutoLayout.test.ts`: the reader's pass is for the
 * same boards the writer's is, and never for anyone who may write.
 */
function board(over: Partial<V3Diagram> = {}): DesignDiagram {
  return laidOut({
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    placements: [
      { id: 'e1', zone: 'landscape', x: 10, y: 20 },
      { id: 'e2', zone: 'landscape', x: 400, y: 20 },
    ],
    ...over,
  });
}

/** Flagged, two members, not one position. */
function unplaced(over: Partial<V3Diagram> = {}): DesignDiagram {
  const made = board({ needsLayout: true, ...over });
  return { ...made, geometry: { ...made.geometry, nodes: [] } };
}

function modelOf(diagram: DesignDiagram): DesignModel {
  const element = (id: string) => ({ id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {} });
  return {
    name: 'M',
    diagrams: [diagram],
    elements: [element('e1'), element('e2')],
    relations: [{ type: 'flow', id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
  };
}

const RESULT: TidyResult = {
  placements: [
    { id: 'e1', zone: 'landscape', x: 100, y: 300 },
    { id: 'e2', zone: 'landscape', x: 500, y: 300 },
  ],
  canvas: { width: 2000, height: 1200 },
  edgeRoutes: [{ relationId: 'c1', waypoints: [{ x: 300, y: 340 }, { x: 300, y: 360 }], source: 'auto' }],
};

describe('laidOutForReading', () => {
  it('puts the pass on a copy of the board, as its step would leave it', () => {
    const stored = unplaced();
    const model = modelOf(stored);
    const shown = laidOutForReading(model, stored, RESULT);

    expect(placedNodes(shown).map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'e1', x: 100, y: 300 },
      { id: 'e2', x: 500, y: 300 },
    ]);
    expect(shown.geometry.canvas).toEqual({ width: 2000, height: 1200 });
    expect(shown.geometry.needsLayout).toBeUndefined();
    expect(shown.geometry.routes?.[0]?.waypoints).toEqual(RESULT.edgeRoutes?.[0]?.waypoints);
  });

  it('changes nothing it was handed', () => {
    const stored = unplaced();
    const model = modelOf(stored);
    const before = structuredClone(model);
    laidOutForReading(model, stored, RESULT);
    expect(model).toEqual(before);
    expect(model.diagrams[0]).toBe(stored);
  });

  it('answers the stored board for a result that changes nothing', () => {
    const stored = unplaced();
    expect(laidOutForReading(modelOf(stored), stored, { placements: [] })).toBe(stored);
  });
});

describe('carriedOver', () => {
  it('puts the last pass\'s layout on the board as it now is, and keeps the board\'s own members', () => {
    const before = unplaced();
    const shown = laidOutForReading(modelOf(before), before, RESULT);
    const now = unplaced({ name: 'Renamed', placements: [{ id: 'e1', zone: 'landscape', x: 0, y: 0 }, { id: 'e3', zone: 'landscape', x: 0, y: 0 }] });
    const carried = carriedOver(now, shown);

    expect(carried.name).toBe('Renamed');
    expect(carried.members).toBe(now.members);
    // e1 where the last pass put it, e3 new to the board and at the origin
    // until its own pass lands; e2's position is a leftover nobody draws.
    expect(positions(carried)).toEqual(['100,300', '0,0']);
    expect(carried.geometry.canvas).toEqual({ width: 2000, height: 1200 });
    expect(carried.geometry.routes).toEqual(shown.geometry.routes);
    expect(carried.geometry.needsLayout).toBeUndefined();
    expect(now.geometry.needsLayout).toBe(true);
  });

  it('answers the same object for the same two boards', () => {
    const before = unplaced();
    const shown = laidOutForReading(modelOf(before), before, RESULT);
    const now = { ...unplaced(), name: 'Renamed' };
    expect(carriedOver(now, shown)).toBe(carriedOver(now, shown));
  });
});

function render(over: Partial<UseReadingLayoutArgs> = {}) {
  const lay = vi.fn<(diagram: DesignDiagram, options: TidyOptions) => Promise<DesignDiagram>>()
    .mockImplementation((diagram) => Promise.resolve(laidOutForReading(modelOf(diagram), diagram, RESULT)));
  const onShown = vi.fn<() => void>();
  const onLandedAway = vi.fn<(diagramId: string) => void>();
  const args: UseReadingLayoutArgs = {
    diagram: unplaced(),
    readOnly: true,
    options: DEFAULT_TIDY_OPTIONS,
    lay,
    onShown,
    onLandedAway,
    ...over,
  };
  const view = renderHook((props: UseReadingLayoutArgs) => useReadingLayout(props), { initialProps: args });
  return { ...view, lay, onShown, onLandedAway, args };
}

const positions = (diagram: DesignDiagram | undefined) =>
  placedNodes(diagram ?? { members: [], geometry: { nodes: [] } }).map(({ x, y }) => `${x},${y}`);

describe('useReadingLayout — when a reader is shown a pass', () => {
  it('shows a reader the board laid out, once, and frames it', async () => {
    const { result, lay, onShown, onLandedAway, rerender, args } = render();
    // Meanwhile, the board as stored.
    expect(result.current).toBe(args.diagram);

    await waitFor(() => expect(positions(result.current)).toEqual(['100,300', '500,300']));
    await waitFor(() => expect(onShown).toHaveBeenCalledTimes(1));
    rerender({ ...args });
    rerender({ ...args });
    expect(lay).toHaveBeenCalledTimes(1);
    expect(onShown).toHaveBeenCalledTimes(1);
    // Open when it landed: the canvas is still on it, and frames it now.
    expect(onLandedAway).not.toHaveBeenCalled();
  });

  it('runs it with the writer\'s settling options', async () => {
    const { lay } = render({ options: { ...DEFAULT_TIDY_OPTIONS, direction: 'hybrid', pinGroups: true } });
    await waitFor(() => expect(lay).toHaveBeenCalled());
    expect(lay.mock.calls[0][1]).toMatchObject({ direction: 'hybrid', pinGroups: false, pinGroupContents: false, pinAnchorPoints: false });
  });

  it('never runs for somebody who may write the board: their open settles it as a step', async () => {
    const { result, lay, args } = render({ readOnly: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(lay).not.toHaveBeenCalled();
    expect(result.current).toBe(args.diagram);
  });

  it('does not touch a board somebody has laid out, flagged or not', async () => {
    for (const diagram of [board(), board({ needsLayout: true })]) {
      const { result, lay } = render({ diagram });
      await new Promise((r) => setTimeout(r, 10));
      expect(lay).not.toHaveBeenCalled();
      expect(result.current).toBe(diagram);
    }
  });

  it('skips an empty board, and waits for the board to resolve', async () => {
    const empty = unplaced({ placements: [] });
    const { lay, rerender, args } = render({ diagram: undefined });
    rerender({ ...args, diagram: empty });
    await new Promise((r) => setTimeout(r, 10));
    expect(lay).not.toHaveBeenCalled();

    rerender({ ...args, diagram: unplaced() });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(1));
  });
});

describe('useReadingLayout — what is shown belongs to the board it was worked out from', () => {
  it('gives way at once to a stored layout, and runs nothing for it', async () => {
    const { result, lay, rerender, args } = render();
    await waitFor(() => expect(positions(result.current)).toEqual(['100,300', '500,300']));

    const settled = board();
    rerender({ ...args, diagram: settled });
    expect(result.current).toBe(settled);
    await new Promise((r) => setTimeout(r, 10));
    expect(lay).toHaveBeenCalledTimes(1);
  });

  it('works a board that changed and still has no positions out again', async () => {
    const { result, lay, rerender, args } = render();
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(1));

    const renamed = { ...unplaced(), name: 'Renamed' };
    rerender({ ...args, diagram: renamed });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current?.name).toBe('Renamed'));
    expect(positions(result.current)).toEqual(['100,300', '500,300']);
  });

  it('keeps the last layout on a board that changed under the reader while its own pass runs', async () => {
    const MOVED: TidyResult = { ...RESULT, placements: RESULT.placements.map((p) => ({ ...p, y: p.y + 50 })) };
    let finish!: () => void;
    const lay = vi.fn<(diagram: DesignDiagram, options: TidyOptions) => Promise<DesignDiagram>>()
      .mockImplementationOnce((diagram) => Promise.resolve(laidOutForReading(modelOf(diagram), diagram, RESULT)))
      .mockImplementation((diagram) => new Promise((resolve) => { finish = () => resolve(laidOutForReading(modelOf(diagram), diagram, MOVED)); }));
    const { result, rerender, args } = render({ lay });
    await waitFor(() => expect(positions(result.current)).toEqual(['100,300', '500,300']));

    // Renamed by somebody, still with no positions: worked out again, and
    // meanwhile the cards stay where the reader was shown them.
    const renamed = { ...unplaced(), name: 'Renamed' };
    rerender({ ...args, lay, diagram: renamed });
    expect(result.current?.name).toBe('Renamed');
    expect(positions(result.current)).toEqual(['100,300', '500,300']);
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(2));

    finish();
    await waitFor(() => expect(positions(result.current)).toEqual(['100,350', '500,350']));
    expect(result.current?.name).toBe('Renamed');
  });

  it('keeps the last layout on a changed board whose own pass fails', async () => {
    const lay = vi.fn<(diagram: DesignDiagram, options: TidyOptions) => Promise<DesignDiagram>>()
      .mockImplementationOnce((diagram) => Promise.resolve(laidOutForReading(modelOf(diagram), diagram, RESULT)))
      .mockRejectedValue(new Error('elk'));
    const { result, rerender, args } = render({ lay });
    await waitFor(() => expect(positions(result.current)).toEqual(['100,300', '500,300']));

    const renamed = { ...unplaced(), name: 'Renamed' };
    rerender({ ...args, lay, diagram: renamed });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current?.name).toBe('Renamed');
    expect(positions(result.current)).toEqual(['100,300', '500,300']);
  });

  it('never lets a pass that ends late displace one started after it', async () => {
    const finishes = new Map<DesignDiagram, () => void>();
    const lay = vi.fn<(diagram: DesignDiagram, options: TidyOptions) => Promise<DesignDiagram>>()
      .mockImplementation((diagram) => new Promise((resolve) => {
        finishes.set(diagram, () => resolve(laidOutForReading(modelOf(diagram), diagram, RESULT)));
      }));
    const first = unplaced();
    const { result, rerender, args } = render({ diagram: first, lay });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(1));

    // The board changes while its pass runs, still with no positions: a pass of its own.
    const renamed = { ...unplaced(), name: 'Renamed' };
    rerender({ ...args, diagram: renamed });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(2));

    // The newer pass ends first, the older one after it.
    finishes.get(renamed)!();
    await waitFor(() => expect(positions(result.current)).toEqual(['100,300', '500,300']));
    finishes.get(first)!();
    await new Promise((r) => setTimeout(r, 10));

    expect(result.current?.name).toBe('Renamed');
    expect(positions(result.current)).toEqual(['100,300', '500,300']);
    expect(lay).toHaveBeenCalledTimes(2);
  });

  it('keeps a board\'s pass that lands while another is open, and frames it once it is open again', async () => {
    let finish!: (diagram: DesignDiagram) => void;
    const first = unplaced();
    const lay = vi.fn<(diagram: DesignDiagram, options: TidyOptions) => Promise<DesignDiagram>>()
      .mockImplementation((diagram) => new Promise((resolve) => { finish = () => resolve(laidOutForReading(modelOf(diagram), diagram, RESULT)); }));
    const { result, onShown, onLandedAway, rerender, args } = render({ diagram: first, lay });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(1));

    // Another board is opened while the first one's pass is still running.
    const other = board({ id: 'd2' });
    rerender({ ...args, diagram: other });
    finish(first);
    await new Promise((r) => setTimeout(r, 10));
    expect(onShown).not.toHaveBeenCalled();
    expect(result.current).toBe(other);
    // The frame the canvas kept for the first board was of its pile.
    expect(onLandedAway).toHaveBeenCalledExactlyOnceWith('d1');

    // Back on the first board, its pass is on screen without running again,
    // and framed now: the reader has not seen it laid out before.
    rerender({ ...args, diagram: first });
    expect(positions(result.current)).toEqual(['100,300', '500,300']);
    await waitFor(() => expect(onShown).toHaveBeenCalledTimes(1));
    expect(lay).toHaveBeenCalledTimes(1);

    // And only that once: leaving and coming back again keeps the reader's view.
    rerender({ ...args, diagram: other });
    rerender({ ...args, diagram: first });
    await new Promise((r) => setTimeout(r, 10));
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('frames a board once, and not again for a pass of the board changed under the reader', async () => {
    const { result, lay, onShown, onLandedAway, rerender, args } = render();
    await waitFor(() => expect(onShown).toHaveBeenCalledTimes(1));

    const renamed = { ...unplaced(), name: 'Renamed' };
    rerender({ ...args, diagram: renamed });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current?.name).toBe('Renamed'));
    expect(positions(result.current)).toEqual(['100,300', '500,300']);
    await new Promise((r) => setTimeout(r, 10));
    // The reader may have zoomed in since: their view is theirs.
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(onLandedAway).not.toHaveBeenCalled();
  });

  it('draws the board as stored when the pass fails, and does not retry it', async () => {
    const lay = vi.fn<(diagram: DesignDiagram, options: TidyOptions) => Promise<DesignDiagram>>()
      .mockRejectedValue(new Error('elk'));
    const { result, onShown, rerender, args } = render({ lay });
    await waitFor(() => expect(lay).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    rerender({ ...args, lay });
    rerender({ ...args, lay });
    expect(lay).toHaveBeenCalledTimes(1);
    expect(onShown).not.toHaveBeenCalled();
    expect(result.current).toBe(args.diagram);
  });

  it('shows the stored board again to somebody who may now write it', async () => {
    const { result, rerender, args } = render();
    await waitFor(() => expect(positions(result.current)).toEqual(['100,300', '500,300']));
    rerender({ ...args, readOnly: false });
    expect(result.current).toBe(args.diagram);
  });
});
