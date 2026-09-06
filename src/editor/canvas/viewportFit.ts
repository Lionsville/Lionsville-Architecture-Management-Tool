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
