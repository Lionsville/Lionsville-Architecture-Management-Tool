import type { EdgeArrowhead, EdgeLineStyle, EdgeRouting } from '../../model/types';

/**
 * Pure resolution of a connection's stored style into concrete render inputs,
 * with the U4b NULL-inherit fallbacks (plan D1): a NULL/absent field renders
 * exactly as it did before this feature existed. Shared by `buildEdges` (which
 * owns the markers) and `FloatingEdge` (which strokes the path), so the line
 * and its arrowheads always resolve the same colour.
 */

/** Effective stroke: the explicit edge colour, else the theme fallback token. */
export function resolveEdgeStroke(color: string | undefined, fallback: string): string {
  return color ?? fallback;
}

/** SVG stroke-dasharray for a line style; solid (and absent) → undefined (a plain line). */
export function edgeDashArray(lineStyle: EdgeLineStyle | undefined): string | undefined {
  switch (lineStyle) {
    case 'dashed':
      return '6 4';
    case 'dotted':
      return '1.5 5';
    default:
      return undefined;
  }
}

/**
 * Whether to draw each arrowhead. Explicit per-end tokens win; otherwise the
 * historical default derived from `isBidirectional` — the target end always has
 * an arrow, the source end only on a bidirectional connection.
 */
export function resolveArrowheads(conn: {
  isBidirectional: boolean;
  sourceArrowhead?: EdgeArrowhead;
  targetArrowhead?: EdgeArrowhead;
}): { start: boolean; end: boolean } {
  const start = conn.sourceArrowhead ?? (conn.isBidirectional ? 'arrow' : 'none');
  const end = conn.targetArrowhead ?? 'arrow';
  return { start: start === 'arrow', end: end === 'arrow' };
}

/** Path-builder selector kinds; `smoothstep` is today's default (borderRadius 8). */
export type EdgePathKind = 'smoothstep' | 'orthogonal' | 'straight' | 'curved';

/** Map the stored routing token to a path-builder kind; absent → smooth step. */
export function edgePathKind(routing: EdgeRouting | undefined): EdgePathKind {
  switch (routing) {
    case 'orthogonal':
      return 'orthogonal';
    case 'straight':
      return 'straight';
    case 'curved':
      return 'curved';
    default:
      return 'smoothstep';
  }
}
