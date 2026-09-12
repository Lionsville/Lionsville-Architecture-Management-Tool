import type { EdgeRoute } from './types';
import { routeSource } from './routes';

/**
 * One comparison: whether a route row has changed. `useEditorState` asks it
 * before dispatching a route gesture, so the side a line already leaves from,
 * or the pin it already carries, costs no undo step and queues no routing pass.
 *
 * Everything the file stores about a route takes part — provenance, the pin,
 * the attach sides, the waypoints and the label position — because two rows
 * that differ in only one of those are different rows on disk, and a comparison
 * that read them as the same would drop exactly the interesting case: identical
 * geometry that changed hands. Coordinates are compared within an epsilon, and
 * an absent field equals an `undefined` one, so a round trip that normalises
 * either does not read as an edit.
 *
 * This is deliberately not the question `useDragRoutePreview` asks, which is
 * whether the board would *draw* two rows the same; that one treats an absent
 * row as a straight line, where this one treats it as nothing at all.
 */

function sameOptional(a: unknown, b: unknown): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

const POSITION_EPSILON = 0.001;

function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) < POSITION_EPSILON;
}

export function edgeRoutesEqual(a: EdgeRoute, b: EdgeRoute): boolean {
  if (a.relationId !== b.relationId) return false;
  // Provenance is persisted, so a route whose ONLY change is who owns it is a
  // changed row — a preserved route re-emitted as manual over a stored auto
  // row, or an undo handing one back. Identical geometry does not make it the
  // same record.
  if (routeSource(a) !== routeSource(b)) return false;
  // The pin is persisted too, and it is the only thing that distinguishes an
  // explicitly pinned straight line from no row at all.
  if ((a.pinned ?? false) !== (b.pinned ?? false)) return false;
  // Attach sides are persisted constraints; a row whose only change is which
  // side an end leaves from is a route edit like any other.
  if (!sameOptional(a.sourceSide, b.sourceSide) || !sameOptional(a.targetSide, b.targetSide)) {
    return false;
  }
  if (a.waypoints.length !== b.waypoints.length) return false;
  if ((a.labelPosition === undefined) !== (b.labelPosition === undefined)) return false;
  if (
    a.labelPosition &&
    b.labelPosition &&
    (!sameCoordinate(a.labelPosition.x, b.labelPosition.x) ||
      !sameCoordinate(a.labelPosition.y, b.labelPosition.y))
  ) {
    return false;
  }
  return a.waypoints.every(
    (p, i) => sameCoordinate(p.x, b.waypoints[i].x) && sameCoordinate(p.y, b.waypoints[i].y),
  );
}
