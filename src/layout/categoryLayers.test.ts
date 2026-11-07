// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { categoryBands, categoryLayerMoves } from './categoryLayers';

const box = (id: string, x: number, y: number, category?: string) => ({ id, x, y, width: 100, height: 60, ...(category ? { category } : {}) });

describe('categoryLayerMoves', () => {
  it('gives each category a row, in the order they stand, with none-of-the-above last', () => {
    const moves = categoryLayerMoves([box('a', 0, 300, 'Data'), box('b', 200, 0, 'Channels'), box('c', 0, 10, 'Channels'), box('d', 0, 500)]);
    const row = (id: string) => moves.find((move) => move.id === id)!.y;
    expect(row('c')).toBe(row('b'));
    expect(row('a')).toBeGreaterThan(row('c'));
    expect(row('d')).toBeGreaterThan(row('a'));
    expect(moves.find((move) => move.id === 'c')!.x).toBeLessThan(moves.find((move) => move.id === 'b')!.x);
  });
});

describe('categoryBands', () => {
  it('draws a band per row once the rows stand as rows', () => {
    const bands = categoryBands([box('a', 0, 0, 'Channels'), box('b', 0, 100, 'Data')]);
    expect(bands.map((band) => band.category)).toEqual(['Channels', 'Data']);
  });

  it('draws none while two categories share a height', () => {
    expect(categoryBands([box('a', 0, 0, 'Channels'), box('b', 200, 20, 'Data')])).toEqual([]);
  });

  it('draws none while a box has no category, or there is only one', () => {
    expect(categoryBands([box('a', 0, 0, 'Channels'), box('b', 0, 100)])).toEqual([]);
    expect(categoryBands([box('a', 0, 0, 'Channels'), box('b', 0, 100, 'Channels')])).toEqual([]);
  });
});
