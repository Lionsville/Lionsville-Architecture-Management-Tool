import { useRef, useState } from 'react';
import { useReactFlow, ViewportPortal } from '@xyflow/react';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import {
  canvasRect,
  canvasSizeFromPointer,
  RESIZABLE_ZONES,
  zoneLabel,
  zoneRect,
  zoneSizeFromPointer,
  zoneSizes,
} from '../../model/zones';
import type { DiagramLayoutConfig, Layer7Zone, Rect, ResizableZone } from '../../model/types';
import { usePointerDrag } from './usePointerDrag';
import { useStrings } from '../../i18n/LanguageContext';

const HANDLE_THICKNESS = 8;

/** Which board edge a canvas handle drags — the corner drags both axes. */
type CanvasEdge = 'right' | 'bottom' | 'corner';

/**
 * The five fixed Layer 7 zones, rendered behind the nodes as subtle tinted
 * bands with uppercase labels. Band sizes come from the diagram's
 * layoutConfig; each band's inner edge carries a drag handle that persists
 * the new size through `onZoneResize` (live preview while dragging). The
 * board itself grows for larger landscapes via the right/bottom border
 * handles → `onCanvasResize`.
 *
 * While a palette drag is over the board, `dropZone` names the zone the drop
 * would land in and that band is outlined. It answers the question the browser's
 * drag ghost cannot: not "am I dragging" but "where will this end up" — which on
 * a board with a fixed zone grammar is the part that decides what you get.
 */
export function ZoneLayer({
  layoutConfig,
  readOnly,
  dropZone,
  onZoneResize,
  onCanvasResize,
}: {
  layoutConfig?: DiagramLayoutConfig;
  readOnly: boolean;
  dropZone?: Layer7Zone | null;
  onZoneResize(zone: ResizableZone, size: number): void;
  onCanvasResize(size: { width: number; height: number }): void;
}) {
  const theme = useTheme();
  const { t } = useStrings();
  const tokens = getNodeTokens(theme);
  // Remembered so the outline fades out over the band it was on, rather than
  // vanishing the moment the pointer leaves it.
  const lastDropZone = useRef<Layer7Zone | null>(null);
  if (dropZone) lastDropZone.current = dropZone;
  const { screenToFlowPosition } = useReactFlow();
  // Live preview during a handle drag, committed on pointer-up.
  const [preview, setPreview] = useState<{ zone: ResizableZone; size: number } | null>(null);
  const [canvasPreview, setCanvasPreview] = useState<{ width: number; height: number } | null>(
    null,
  );

  const effectiveConfig: DiagramLayoutConfig | undefined =
    preview || canvasPreview
      ? {
          ...layoutConfig,
          ...(canvasPreview ? { canvas: canvasPreview } : {}),
          zones: preview
            ? { ...layoutConfig?.zones, [preview.zone]: { size: preview.size } }
            : layoutConfig?.zones,
        }
      : layoutConfig;

  // Which handle the pointer grabbed, and the size it is currently previewing.
  // Both drags commit on pointer-up even when the pointer never moved: the
  // handle's own position IS the value, so a click on it is a no-op commit.
  const pendingZone = useRef<ResizableZone | null>(null);
  const pendingEdge = useRef<CanvasEdge | null>(null);
  const bandGesture = useRef<{ zone: ResizableZone; size: number } | null>(null);
  const boardGesture = useRef<{ edge: CanvasEdge; size: { width: number; height: number } } | null>(
    null,
  );

  const bandDrag = usePointerDrag({
    onStart: () => {
      const zone = pendingZone.current;
      if (!zone) return;
      bandGesture.current = { zone, size: zoneSizes(layoutConfig)[zone] };
    },
    onMove: (_delta, event) => {
      const live = bandGesture.current;
      if (!live) return;
      live.size = zoneSizeFromPointer(
        live.zone,
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        layoutConfig,
      );
      setPreview({ zone: live.zone, size: live.size });
    },
    onEnd: () => {
      const live = bandGesture.current;
      bandGesture.current = null;
      setPreview(null);
      if (live) onZoneResize(live.zone, live.size);
    },
    onCancel: () => {
      bandGesture.current = null;
      setPreview(null);
    },
  });

  const boardDrag = usePointerDrag({
    onStart: () => {
      const edge = pendingEdge.current;
      if (!edge) return;
      const current = canvasRect(layoutConfig);
      boardGesture.current = { edge, size: { width: current.width, height: current.height } };
    },
    onMove: (_delta, event) => {
      const live = boardGesture.current;
      if (!live) return;
      live.size = canvasSizeFromPointer(
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        layoutConfig,
        live.edge,
      );
      setCanvasPreview(live.size);
    },
    onEnd: () => {
      const live = boardGesture.current;
      boardGesture.current = null;
      setCanvasPreview(null);
      if (live) onCanvasResize(live.size);
    },
    onCancel: () => {
      boardGesture.current = null;
      setCanvasPreview(null);
    },
  });

  const beginResize = (zone: ResizableZone) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || readOnly) return;
    pendingZone.current = zone;
    bandDrag.onPointerDown(event);
  };

  const beginCanvasResize = (edge: CanvasEdge) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || readOnly) return;
    pendingEdge.current = edge;
    boardDrag.onPointerDown(event);
  };

  const board = canvasRect(effectiveConfig);
  const outlineZone = dropZone ?? lastDropZone.current;
  const outline = outlineZone ? zoneRect(outlineZone, effectiveConfig) : null;

  return (
    <ViewportPortal>
      {outline && (
        <Box
          aria-hidden
          // Visual-only and aria-hidden by design, so a test id is the only
          // handle a test can hold it by.
          data-testid="lv-zone-drop-outline"
          data-zone={outlineZone}
          data-active={dropZone ? 'true' : 'false'}
          sx={{
            position: 'absolute',
            left: outline.x + 4,
            top: outline.y + 4,
            width: outline.width - 8,
            height: outline.height - 8,
            border: 2,
            borderColor: 'primary.main',
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
            borderRadius: '10px',
            pointerEvents: 'none',
            zIndex: -1,
            opacity: dropZone ? 1 : 0,
            transition: 'opacity 150ms',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: board.x,
          top: board.y,
          width: board.width,
          height: board.height,
          border: `1px dashed ${tokens.canvas.outline}`,
          borderRadius: 12,
          pointerEvents: 'none',
          zIndex: -2,
        }}
      />
      {RESIZABLE_ZONES.map((zone) => {
        const rect = zoneRect(zone, effectiveConfig);
        const handle = handleRect(zone, rect);
        return (
          <div key={zone}>
            <div
              style={{
                position: 'absolute',
                left: rect.x + 4,
                top: rect.y + 4,
                width: rect.width - 8,
                height: rect.height - 8,
                backgroundColor: tokens.zone.fill[zone],
                borderRadius: 10,
                pointerEvents: 'none',
                zIndex: -2,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  color: tokens.zone.label,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {zoneLabel(zone, t)}
              </span>
            </div>
            {!readOnly && (
              <div
                className="nodrag nopan"
                aria-label={t('zone.resizeBand', { name: zoneLabel(zone, t).toLowerCase() })}
                onPointerDown={beginResize(zone)}
                style={{
                  position: 'absolute',
                  left: handle.x,
                  top: handle.y,
                  width: handle.width,
                  height: handle.height,
                  cursor: zone === 'actors' || zone === 'management' ? 'ns-resize' : 'ew-resize',
                  pointerEvents: 'all',
                  zIndex: 5,
                }}
              />
            )}
          </div>
        );
      })}
      {!readOnly &&
        canvasHandles(board).map((handle) => (
          <div
            key={handle.key}
            className="nodrag nopan"
            aria-label={t('zone.resizeCanvas', { name: handle.key })}
            onPointerDown={beginCanvasResize(handle.key)}
            style={{
              position: 'absolute',
              left: handle.rect.x,
              top: handle.rect.y,
              width: handle.rect.width,
              height: handle.rect.height,
              cursor: handle.cursor,
              pointerEvents: 'all',
              zIndex: 5,
            }}
          />
        ))}
    </ViewportPortal>
  );
}

/** Thin interactive strip along a band's inner edge. */
function handleRect(zone: ResizableZone, rect: Rect): Rect {
  switch (zone) {
    case 'actors':
      return {
        x: rect.x,
        y: rect.y + rect.height - HANDLE_THICKNESS / 2,
        width: rect.width,
        height: HANDLE_THICKNESS,
      };
    case 'management':
      return {
        x: rect.x,
        y: rect.y - HANDLE_THICKNESS / 2,
        width: rect.width,
        height: HANDLE_THICKNESS,
      };
    case 'inputChannels':
      return {
        x: rect.x + rect.width - HANDLE_THICKNESS / 2,
        y: rect.y,
        width: HANDLE_THICKNESS,
        height: rect.height,
      };
    case 'externalSystems':
      return {
        x: rect.x - HANDLE_THICKNESS / 2,
        y: rect.y,
        width: HANDLE_THICKNESS,
        height: rect.height,
      };
  }
}

/** Right edge, bottom edge, and a corner grip for resizing the board. */
function canvasHandles(board: Rect): { key: CanvasEdge; rect: Rect; cursor: string }[] {
  const corner = 22;
  return [
    {
      key: 'right',
      cursor: 'ew-resize',
      rect: {
        x: board.x + board.width - HANDLE_THICKNESS / 2,
        y: board.y,
        width: HANDLE_THICKNESS,
        height: board.height - corner,
      },
    },
    {
      key: 'bottom',
      cursor: 'ns-resize',
      rect: {
        x: board.x,
        y: board.y + board.height - HANDLE_THICKNESS / 2,
        width: board.width - corner,
        height: HANDLE_THICKNESS,
      },
    },
    {
      key: 'corner',
      cursor: 'nwse-resize',
      rect: {
        x: board.x + board.width - corner,
        y: board.y + board.height - corner,
        width: corner + HANDLE_THICKNESS / 2,
        height: corner + HANDLE_THICKNESS / 2,
      },
    },
  ];
}
