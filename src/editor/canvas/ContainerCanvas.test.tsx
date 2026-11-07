// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { linesThroughBoxes } from './LinesCrossing';

describe('a line through a box', () => {
  const box = { id: 'b', x: 100, y: 100, width: 100, height: 60 };
  const across = { id: 'l', source: 'a', target: 'c', points: [{ x: 0, y: 130 }, { x: 150, y: 130 }, { x: 300, y: 130 }] };

  it('is said when it runs through a box that is neither of its ends', () => {
    expect(linesThroughBoxes([across], [box])).toEqual(['l']);
  });

  it('is not said where the box is one of its ends, or the line only runs along its edge', () => {
    expect(linesThroughBoxes([{ ...across, target: 'b' }], [box])).toEqual([]);
    expect(linesThroughBoxes([{ ...across, points: [{ x: 150, y: 102 }] }], [box])).toEqual([]);
  });
});
