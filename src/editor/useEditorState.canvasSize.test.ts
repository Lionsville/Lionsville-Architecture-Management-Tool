// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { laidOut } from '../model/testFixtures';
import { placedNode, placementRect, rectsIntersect } from '../model/placement';
import { zoneRect } from '../model/zones';
import type { DesignModel, PlacedNode, Rect } from '../model/types';
import { renderEditorState } from './testing/editorHost';

/**
 * `setCanvasSize` at the action, which is where a board's corner, right and
 * bottom handles land: the band's members come along as a band, never each to
 * the same edge. The arithmetic is pinned in `model/placement.test.ts`; this is
 * about what the gesture leaves on the board, and that undo brings it back.
 */
const TOOLS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];

function board(placements: PlacedNode[], geometry?: { canvas?: { width: number; height: number } }): DesignModel {
  return {
    name: 'ACME',
    elements: [
      ...TOOLS.map((id) => ({ id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {} })),
      { id: 'app', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements, ...geometry })],
  };
}

/** A management band of two rows of four, on the default board. */
const twoRows = (): PlacedNode[] => [
  ...TOOLS.map((id, index) => ({
    id,
    zone: 'management' as const,
    x: 200 + (index % 4) * 300,
    y: index < 4 ? 884 : 960,
  })),
  { id: 'app', zone: 'landscape', x: 600, y: 400 },
];

/** Eight cards in one row across the whole of the default board. */
const oneRow = (): PlacedNode[] =>
  TOOLS.map((id, index) => ({ id, zone: 'management' as const, x: 200 + index * 180, y: 930 }));

function setUp(placements: PlacedNode[]) {
  const { result, host } = renderEditorState(board(placements));
  const diagram = () => result.current.model.diagrams[0];
  const placed = (id: string) => placedNode(diagram(), id) as PlacedNode;
  const rect = (id: string): Rect => placementRect('managementTool', placed(id));
  const positions = () => Object.fromEntries(
    [...TOOLS, 'app'].flatMap((id) => {
      const held = placed(id);
      return held ? [[id, { x: held.x, y: held.y }]] : [];
    }),
  );
  const overlapping = () => TOOLS.flatMap((a, i) =>
    TOOLS.slice(i + 1).filter((b) => rectsIntersect(rect(a), rect(b))).map((b) => `${a}+${b}`));
  return { result, host, diagram, placed, rect, positions, overlapping };
}

describe('setCanvasSize', () => {
  it('takes a two-row band down with the board and keeps its rows, when the board grows', () => {
    const { result, positions, placed } = setUp(twoRows());
    const before = positions();
    act(() => result.current.actions.setCanvasSize({ width: 1717, height: 1392 }));
    // The bottom edge moved by 352 and the band with it: every card by the same.
    for (const id of TOOLS) {
      expect(placed(id).x).toBe(before[id].x);
      expect(placed(id).y).toBe(before[id].y + 352);
    }
  });

  it('never leaves two cards on top of each other when the board shrinks', () => {
    const { result, overlapping, rect, diagram } = setUp(oneRow());
    act(() => result.current.actions.setCanvasSize({ width: 900, height: 700 }));
    expect(overlapping()).toEqual([]);
    const band = zoneRect('management', diagram().geometry);
    for (const id of TOOLS) {
      const card = rect(id);
      expect(card.x).toBeGreaterThanOrEqual(band.x);
      expect(card.x + card.width).toBeLessThanOrEqual(band.x + band.width);
      expect(card.y).toBeGreaterThanOrEqual(band.y);
      expect(card.y + card.height).toBeLessThanOrEqual(band.y + band.height);
    }
  });

  it('stays clear on the way back up: a shrink and a grow leave no stack behind', () => {
    const { result, overlapping } = setUp(oneRow());
    act(() => result.current.actions.setCanvasSize({ width: 900, height: 700 }));
    act(() => result.current.actions.setCanvasSize({ width: 1717, height: 1392 }));
    expect(overlapping()).toEqual([]);
  });

  it('moves no card that still fits, and leaves the landscape alone', () => {
    const { result, positions } = setUp([
      { id: 't1', zone: 'actors', x: 100, y: 20 },
      { id: 't2', zone: 'actors', x: 300, y: 20 },
      { id: 'app', zone: 'landscape', x: 1500, y: 800 },
    ]);
    const before = positions();
    act(() => result.current.actions.setCanvasSize({ width: 1200, height: 900 }));
    expect(positions()).toEqual(before);
  });

  it('is one undo step that brings back every card and the board as they were', () => {
    const { result, host, positions, diagram } = setUp(oneRow());
    const before = positions();
    const geometry = diagram().geometry;
    const steps = host.current.commands.length;
    act(() => result.current.actions.setCanvasSize({ width: 900, height: 700 }));
    expect(host.current.commands.length).toBe(steps + 1);
    expect(positions()).not.toEqual(before);
    act(() => host.current.history.undo());
    expect(positions()).toEqual(before);
    expect(diagram().geometry?.canvas).toEqual(geometry?.canvas);
  });
});
