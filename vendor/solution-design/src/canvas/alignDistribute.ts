import type { ElementId } from '../types';

/**
 * ALIGN & DISTRIBUTE (U4a) — pure geometry.
 * -----------------------------------------
 * Operates on measured node bounds ({x,y,width,height}). The canvas layer is
 * the only place real sizes exist — `DiagramPlacement.width/height` are only
 * set for *resized* nodes, so this must be fed `node.measured` sizes from the
 * React Flow layer, never the overlay. Callers turn the returned positions
 * into a single `movePlacements` batch (one batched commit, one save).
 */

export type AlignAxis = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface NodeBounds {
  id: ElementId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionUpdate {
  elementId: ElementId;
  x: number;
  y: number;
}

/**
 * Align ≥2 nodes to a shared edge or centre of their common bounding box.
 * Returns only the nodes whose position actually changes.
 */
export function alignNodes(nodes: NodeBounds[], axis: AlignAxis): PositionUpdate[] {
  if (nodes.length < 2) return [];
  const minLeft = Math.min(...nodes.map((n) => n.x));
  const maxRight = Math.max(...nodes.map((n) => n.x + n.width));
  const minTop = Math.min(...nodes.map((n) => n.y));
  const maxBottom = Math.max(...nodes.map((n) => n.y + n.height));
  const boxCenterX = (minLeft + maxRight) / 2;
  const boxCenterY = (minTop + maxBottom) / 2;

  const updates: PositionUpdate[] = [];
  for (const node of nodes) {
    let { x, y } = node;
    switch (axis) {
      case 'left':
        x = minLeft;
        break;
      case 'right':
        x = maxRight - node.width;
        break;
      case 'centerX':
        x = boxCenterX - node.width / 2;
        break;
      case 'top':
        y = minTop;
        break;
      case 'bottom':
        y = maxBottom - node.height;
        break;
      case 'centerY':
        y = boxCenterY - node.height / 2;
        break;
    }
    if (x !== node.x || y !== node.y) updates.push({ elementId: node.id, x, y });
  }
  return updates;
}

/**
 * Distribute ≥3 nodes so the gaps between adjacent nodes are equal along the
 * axis, keeping the first and last (by position) fixed — the standard draw.io
 * "distribute horizontally / vertically". Returns only the interior nodes that
 * move.
 */
export function distributeNodes(nodes: NodeBounds[], axis: DistributeAxis): PositionUpdate[] {
  if (nodes.length < 3) return [];
  const horizontal = axis === 'horizontal';
  const pos = (n: NodeBounds) => (horizontal ? n.x : n.y);
  const size = (n: NodeBounds) => (horizontal ? n.width : n.height);

  const sorted = [...nodes].sort((a, b) => pos(a) - pos(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = pos(last) + size(last) - pos(first);
  const totalSize = sorted.reduce((sum, n) => sum + size(n), 0);
  const gap = (span - totalSize) / (sorted.length - 1);

  const updates: PositionUpdate[] = [];
  let cursor = pos(first) + size(first) + gap;
  for (let i = 1; i < sorted.length - 1; i += 1) {
    const node = sorted[i];
    const next = cursor;
    cursor = next + size(node) + gap;
    if (next === pos(node)) continue;
    updates.push(
      horizontal
        ? { elementId: node.id, x: next, y: node.y }
        : { elementId: node.id, x: node.x, y: next },
    );
  }
  return updates;
}
