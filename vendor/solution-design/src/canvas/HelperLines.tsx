import { useEffect, useMemo, useRef } from 'react';
import { useStore, type NodePositionChange, type ReactFlowState } from '@xyflow/react';
import type { ElementNode } from '../nodes/nodeData';

/**
 * SNAP-TO-OBJECT ALIGNMENT GUIDES (U4a) — React Flow helper-lines pattern.
 * ------------------------------------------------------------------------
 * `getHelperLines` compares the dragged node's edges/centre against every
 * other node's edges/centre; within `distance` it returns the snapped
 * position plus the flow-coordinate of the guide line to draw. Single-drag
 * scoped (multi-node guide math has no clean definition — same gating as the
 * U2 resizer). `HelperLines` draws the guides onto a viewport-sized canvas.
 */

export interface HelperLineResult {
  /** Flow-y of a horizontal guide, when the drag snapped vertically. */
  horizontal?: number;
  /** Flow-x of a vertical guide, when the drag snapped horizontally. */
  vertical?: number;
  /** Snapped node position.x / .y (only set on the snapped axis). */
  snapX?: number;
  snapY?: number;
}

const SNAP_DISTANCE = 6;

function boundsOf(node: ElementNode | undefined, x: number, y: number) {
  const width = node?.measured?.width ?? node?.width ?? 0;
  const height = node?.measured?.height ?? node?.height ?? 0;
  return {
    left: x,
    right: x + width,
    centerX: x + width / 2,
    top: y,
    bottom: y + height,
    centerY: y + height / 2,
    width,
    height,
  };
}

export function getHelperLines(
  change: NodePositionChange,
  nodes: ElementNode[],
  distance = SNAP_DISTANCE,
): HelperLineResult {
  const result: HelperLineResult = {};
  if (!change.position) return result;
  const active = nodes.find((n) => n.id === change.id);
  if (!active) return result;

  const a = boundsOf(active, change.position.x, change.position.y);
  let closestV = distance;
  let closestH = distance;

  for (const other of nodes) {
    if (other.id === active.id) continue;
    const b = boundsOf(other, other.position.x, other.position.y);

    // Vertical guides (align on x): [dragged anchor, target anchor, resulting x].
    const vChecks: Array<[number, number, number]> = [
      [a.left, b.left, b.left],
      [a.left, b.right, b.right],
      [a.right, b.right, b.right - a.width],
      [a.right, b.left, b.left - a.width],
      [a.centerX, b.centerX, b.centerX - a.width / 2],
    ];
    for (const [from, guide, snapX] of vChecks) {
      const d = Math.abs(from - guide);
      if (d < closestV) {
        closestV = d;
        result.vertical = guide;
        result.snapX = snapX;
      }
    }

    // Horizontal guides (align on y).
    const hChecks: Array<[number, number, number]> = [
      [a.top, b.top, b.top],
      [a.top, b.bottom, b.bottom],
      [a.bottom, b.bottom, b.bottom - a.height],
      [a.bottom, b.top, b.top - a.height],
      [a.centerY, b.centerY, b.centerY - a.height / 2],
    ];
    for (const [from, guide, snapY] of hChecks) {
      const d = Math.abs(from - guide);
      if (d < closestH) {
        closestH = d;
        result.horizontal = guide;
        result.snapY = snapY;
      }
    }
  }
  return result;
}

const selectWidth = (s: ReactFlowState) => s.width;
const selectHeight = (s: ReactFlowState) => s.height;
const selectTransform = (s: ReactFlowState) => s.transform;

/** Overlay canvas that paints the active horizontal/vertical guide lines. */
export function HelperLines({
  horizontal,
  vertical,
  color,
}: HelperLineResult & { color: string }) {
  const width = useStore(selectWidth);
  const height = useStore(selectHeight);
  const transform = useStore(selectTransform);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Tracks whether the canvas currently holds a drawn line, so we only touch
  // the 2D context when there is something to draw or a stale line to erase.
  const drawnRef = useRef(false);

  const hasLines = useMemo(
    () => typeof horizontal === 'number' || typeof vertical === 'number',
    [horizontal, vertical],
  );

  useEffect(() => {
    // Nothing to draw and nothing left over to clear — skip the context entirely
    // (also keeps jsdom, which has no canvas backend, quiet in tests).
    if (!hasLines && !drawnRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawnRef.current = hasLines;

    const dpi = window.devicePixelRatio || 1;
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    ctx.scale(dpi, dpi);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    const [tx, ty, zoom] = transform;
    if (typeof vertical === 'number') {
      const x = vertical * zoom + tx;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    if (typeof horizontal === 'number') {
      const y = horizontal * zoom + ty;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [width, height, transform, horizontal, vertical, color, hasLines]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  );
}
