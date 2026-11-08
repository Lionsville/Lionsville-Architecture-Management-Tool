// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { Rect } from '../../model/types';

/**
 * "Can you actually see this node?" — the question Tab has to answer.
 *
 * React Flow's own auto-pan-on-focus is off, because it lives behind the same
 * `disableKeyboardA11y` switch that would hand it the arrow keys, and the arrows
 * belong to the keymap (its move is visual-only and never committed). What that
 * takes away is the panning, so tabbing to a node parked off the left edge of a
 * wide landscape drew a focus ring on empty air. The canvas puts the panning
 * back by hand, and this is the test it makes first: pan only when the node is
 * NOT already fully in view, so tabbing across a board that fits does not jitter
 * the viewport on every stop.
 *
 * Both rects are in the same space — client pixels, straight off
 * `getBoundingClientRect()` — which is what lets this stay a pure function with
 * no React Flow, no DOM and no zoom arithmetic in it.
 */
export function isRectFullyVisible(rect: Rect, viewport: Rect, margin = 0): boolean {
  const left = viewport.x + margin;
  const top = viewport.y + margin;
  const right = viewport.x + viewport.width - margin;
  const bottom = viewport.y + viewport.height - margin;
  return (
    rect.x >= left &&
    rect.y >= top &&
    rect.x + rect.width <= right &&
    rect.y + rect.height <= bottom
  );
}

/** A DOM rect as the plain {@link Rect} the pure helpers speak. */
export function toRect(box: { left: number; top: number; width: number; height: number }): Rect {
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

/** The free room of a pane: the largest of the rooms the dock, the key and the map leave it, in the pane's space. */
export function largestRoom(pane: Rect, rooms: readonly { top: number; right: number; bottom: number; left: number }[]): Rect {
  const areas = rooms.map((inset) => ({
    x: pane.x + inset.left, y: pane.y + inset.top,
    width: Math.max(0, pane.width - inset.left - inset.right), height: Math.max(0, pane.height - inset.top - inset.bottom),
  }));
  return areas.reduce((best, one) => (one.width * one.height > best.width * best.height ? one : best), areas[0] ?? pane);
}

/**
 * How far to move the board so that the rect lies inside the room, a margin in:
 * nothing where it already does, and the least that brings it in where it does
 * not. A rect larger than the room is brought in by its top left. A pan, never a
 * zoom: focusing a card must not take the board below the zoom it was read at.
 */
export function panInto(rect: Rect, room: Rect, margin = 16): { dx: number; dy: number } {
  const along = (start: number, size: number, from: number, length: number) => {
    const low = from + margin;
    const high = from + length - margin;
    if (size > high - low || start < low) return low - start;
    if (start + size > high) return high - (start + size);
    return 0;
  };
  return { dx: along(rect.x, rect.width, room.x, room.width), dy: along(rect.y, rect.height, room.y, room.height) };
}
