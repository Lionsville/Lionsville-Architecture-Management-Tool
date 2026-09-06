import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * The React pointer-down a drag starts from. `HTMLElement` rather than
 * `Element` because the listeners go on the captured element itself, and only
 * the HTML event map declares `pointermove` and friends.
 */
export type DragPointerEvent = ReactPointerEvent<HTMLElement>;

/** How far the pointer has travelled since it went down, in CLIENT pixels. */
export interface PointerDragDelta {
  dx: number;
  dy: number;
}

export interface PointerDragHandlers {
  /**
   * The gesture has begun: pointer capture is open and the listeners are on.
   * This — not the `onPointerDown` wrapper — is where a caller should record
   * what is being dragged, because it runs only when the hook actually starts a
   * drag. A pointer-down the hook declines (a non-left button, or a second
   * pointer while a drag is live) never reaches it, so the live gesture's own
   * bookkeeping cannot be overwritten by a gesture that never began.
   */
  onStart?(event: DragPointerEvent): void;
  /**
   * The pointer moved. `delta` is in client pixels, which is what a threshold
   * wants; anything in flow coordinates should map `event.clientX/clientY`
   * itself, since the viewport transform is the caller's business.
   */
  onMove(delta: PointerDragDelta, event: PointerEvent): void;
  /** The pointer came up. This is where a caller commits. */
  onEnd?(event: PointerEvent): void;
  /**
   * The gesture was abandoned: `pointercancel` (the browser took the pointer —
   * a touch became a scroll, the window lost it) or Escape. Nothing is
   * committed; drop the preview and leave the model as it was.
   */
  onCancel?(): void;
}

export interface PointerDrag {
  /** Wire to `onPointerDown` on the element that should capture the pointer. */
  onPointerDown(event: DragPointerEvent): void;
  /** True between a started gesture and its end or cancellation. */
  dragging: boolean;
}

/**
 * One pointer-capture drag, for every handle on the board.
 *
 * The five hand-rolled copies this replaces (two on the domain group, two on the
 * zone/board handles, two on the edge — label and waypoint) all opened the same
 * way and all forgot the same two things, so they are worth having in one place:
 *
 * - **Pointer capture, and listeners on the captured element.** Capture is what
 *   lets a handle 8 px wide be dragged across the whole board: every later
 *   pointer event retargets to the element that holds the pointer, so the
 *   listeners belong there and not on the window. Losing the pointer off the
 *   edge of a tiny handle is the bug this prevents.
 * - **`pointercancel`.** A browser can take the pointer away without ever
 *   sending `pointerup` — a touch that turns into a scroll, a window that loses
 *   focus mid-drag. The copies listened for `pointerup` only, so that left the
 *   listeners attached and the live preview frozen on the board.
 * - **Escape.** A drag you cannot back out of is a drag you have to undo. While
 *   a gesture is live Escape belongs to it: the hook takes the key in the
 *   capture phase and stops it there, so it cancels the drag instead of also
 *   reaching the editor's Escape-to-deselect.
 * - **Unmount.** A node that disappears mid-gesture (a diagram switch, a group
 *   removed) took its listeners with it and left `dragging` stuck on.
 *
 * It deliberately does NOT own coordinates. `delta` is client pixels; a caller
 * that thinks in flow coordinates maps the event itself. Two of the five sites
 * need an absolute flow position rather than a delta and one needs a
 * client-pixel threshold, so a hook that insisted on one space would be wrong
 * for most of them.
 *
 * One gesture at a time: a second pointer going down while a drag is live is
 * ignored rather than stacking a second set of listeners over the first.
 */
export function usePointerDrag(handlers: PointerDragHandlers): PointerDrag {
  // Read through a ref so the listeners of a gesture that is already running
  // always call the current render's handlers, never a closure from the render
  // the drag happened to start on.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  // Set while a gesture is live; also the "are we busy" flag.
  const detachRef = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      // Unmounted mid-drag: drop the listeners, but call no handler — the
      // component that would have to react to a cancellation is gone.
      detachRef.current?.();
      detachRef.current = null;
    },
    [],
  );

  const onPointerDown = useCallback((event: DragPointerEvent) => {
    if (event.button !== 0) return;
    if (detachRef.current) return;
    event.stopPropagation();
    event.preventDefault();

    // `currentTarget` is only valid for the duration of the React handler, so
    // it is read now and closed over — everything below runs later.
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    element.setPointerCapture(pointerId);

    const detach = () => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', abandon);
      window.removeEventListener('keydown', onKeyDown, true);
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      detachRef.current = null;
      setDragging(false);
    };

    const onPointerMove = (move: PointerEvent) => {
      handlersRef.current.onMove({ dx: move.clientX - startX, dy: move.clientY - startY }, move);
    };
    const onPointerUp = (up: PointerEvent) => {
      detach();
      handlersRef.current.onEnd?.(up);
    };
    const abandon = () => {
      detach();
      handlersRef.current.onCancel?.();
    };
    const onKeyDown = (key: KeyboardEvent) => {
      if (key.key !== 'Escape') return;
      key.preventDefault();
      key.stopPropagation();
      abandon();
    };

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', abandon);
    window.addEventListener('keydown', onKeyDown, true);
    detachRef.current = detach;
    setDragging(true);
    handlersRef.current.onStart?.(event);
  }, []);

  return { onPointerDown, dragging };
}
