import { useRef } from 'react';
import Box from '@mui/material/Box';
import { usePointerDrag } from './canvas/usePointerDrag';
import { PANEL_LIMITS, clampPanelWidth, type PanelKind } from './panels';

const HANDLE_WIDTH = 6;

/**
 * The 6 px seam between a side panel and the canvas.
 *
 * Six pixels is a compromise the layout forces: wider reads as a gutter and eats
 * board, narrower is a target you have to aim at. The hit area is widened with
 * negative margins on the canvas side, so the pointer finds it a couple of
 * pixels early without the seam looking any thicker.
 *
 * It drags in CLIENT pixels off the width the gesture STARTED at, not off the
 * current prop: reading the live width would compound rounding every frame, and
 * a drag that overshoots the clamp would otherwise not come back when you drag
 * the other way. Double-click resets to the panel's default — the standard
 * escape hatch for a panel dragged somewhere silly — and Escape cancels the
 * gesture outright (`usePointerDrag`), leaving the width it had.
 *
 * Keyboard: it is a `separator` with arrow keys, because a drag handle nobody
 * can reach without a mouse is not an accessible layout control.
 */
export function PanelResizer({
  kind,
  side,
  width,
  onWidth,
  label,
}: {
  kind: PanelKind;
  /** Which side of the seam the PANEL is on. */
  side: 'left' | 'right';
  width: number;
  onWidth(next: number): void;
  label: string;
}) {
  const startWidth = useRef(width);
  const drag = usePointerDrag({
    onStart: () => {
      startWidth.current = width;
    },
    onMove: ({ dx }) => {
      // A panel on the left grows as the pointer moves right; one on the right
      // grows as it moves left.
      const delta = side === 'left' ? dx : -dx;
      onWidth(clampPanelWidth(kind, startWidth.current + delta));
    },
    onCancel: () => onWidth(clampPanelWidth(kind, startWidth.current)),
  });

  const step = (delta: number) => onWidth(clampPanelWidth(kind, width + delta));

  return (
    <Box
      role="separator"
      // "These keys are mine." The canvas shortcut dispatch listens on
      // `document` in the capture phase, so it has already nudged the selection
      // by the time a React `stopPropagation()` below could object; this
      // attribute is what it reads instead. See `isShortcutIgnoredTarget`.
      data-shortcuts-ignore=""
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={PANEL_LIMITS[kind].min}
      aria-valuemax={PANEL_LIMITS[kind].max}
      tabIndex={0}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={() => onWidth(PANEL_LIMITS[kind].default)}
      onKeyDown={(event) => {
        const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
        const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
        const amount = event.shiftKey ? 32 : 8;
        if (event.key === grow) step(amount);
        else if (event.key === shrink) step(-amount);
        else if (event.key === 'Home') onWidth(PANEL_LIMITS[kind].default);
        else return;
        event.preventDefault();
        // Belt to the `data-shortcuts-ignore` braces: this stops the seam's
        // arrows reaching any React handler above, but NOT the canvas shortcut
        // dispatch, which is a native capture-phase listener that ran first.
        event.stopPropagation();
      }}
      sx={{
        flex: `0 0 ${HANDLE_WIDTH}px`,
        cursor: 'col-resize',
        alignSelf: 'stretch',
        // Invisible at rest, lit on hover / drag / keyboard focus, so the seam
        // stays a seam until you go looking for it.
        backgroundColor: drag.dragging ? 'primary.main' : 'transparent',
        '&:hover': { backgroundColor: 'primary.main' },
        '&:focus-visible': { backgroundColor: 'primary.main', outline: 'none' },
        transition: 'background-color 120ms',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    />
  );
}
