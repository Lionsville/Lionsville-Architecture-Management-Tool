// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A dense container diagram in layers: a row per category, in the order they already
 * stand from top to bottom, which is how such a diagram can be read at all. Pure: the
 * caller lands the moves as one step and routes the lines after.
 */
import type { Rect } from '../model/types';

export type CategoryBox = Rect & { readonly id: string; readonly category?: string };
export type CategoryMove = { readonly id: string; readonly x: number; readonly y: number };
export type CategoryBand = { readonly category: string; readonly rect: Rect };

/** Room at the head of a row for the category's name. */
export const LAYER_NAME_ROOM = 120;
const COLUMN_GAP = 28;
const ROW_GAP = 96;
const PADDING = 12;

/** The rows, by category: the ones with no category go last, under the empty name. */
function rowsOf(boxes: readonly CategoryBox[]): CategoryBox[][] {
  const rows = new Map<string, CategoryBox[]>();
  for (const box of boxes) {
    const key = box.category?.trim() ?? '';
    rows.set(key, [...(rows.get(key) ?? []), box]);
  }
  const middle = (row: readonly CategoryBox[]) => row.reduce((sum, box) => sum + box.y, 0) / row.length;
  return [...rows.entries()]
    .sort(([a, one], [b, other]) => Number(a === '') - Number(b === '') || middle(one) - middle(other) || a.localeCompare(b))
    .map(([, row]) => [...row].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)));
}

export function categoryLayerMoves(boxes: readonly CategoryBox[]): CategoryMove[] {
  if (boxes.length === 0) return [];
  const left = Math.min(...boxes.map((box) => box.x));
  let y = Math.min(...boxes.map((box) => box.y));
  const moves: CategoryMove[] = [];
  for (const row of rowsOf(boxes)) {
    let x = left + LAYER_NAME_ROOM;
    for (const box of row) {
      moves.push({ id: box.id, x, y });
      x += box.width + COLUMN_GAP;
    }
    y += Math.max(...row.map((box) => box.height)) + ROW_GAP;
  }
  return moves;
}

/**
 * The bands to draw around rows that stand as rows: nothing while two categories
 * share a height, as a band there would say something the drawing does not. Derived,
 * so a person who drags a box out of its row sees the bands go and nothing is kept.
 */
export function categoryBands(boxes: readonly CategoryBox[]): CategoryBand[] {
  const named = boxes.filter((box) => box.category?.trim());
  if (named.length < boxes.length || boxes.length === 0) return [];
  const rows = rowsOf(boxes);
  if (rows.length < 2) return [];
  const bands = rows.map((row) => {
    const top = Math.min(...row.map((box) => box.y));
    const bottom = Math.max(...row.map((box) => box.y + box.height));
    return { category: row[0]?.category?.trim() ?? '', top, bottom };
  });
  const sorted = [...bands].sort((a, b) => a.top - b.top);
  if (sorted.some((band, index) => index > 0 && band.top < (sorted[index - 1]?.bottom ?? 0))) return [];
  const left = Math.min(...boxes.map((box) => box.x)) - LAYER_NAME_ROOM + PADDING / 2;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + PADDING;
  return bands.map((band) => ({
    category: band.category,
    rect: { x: left, y: band.top - PADDING, width: right - left, height: band.bottom - band.top + PADDING * 2 },
  }));
}
