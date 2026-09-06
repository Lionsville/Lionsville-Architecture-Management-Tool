import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DesignDiagram, DesignModel, EdgeRoute, Point } from '../../model/types';
import {
  MAX_CONNECTIONS_FOR_DRAG_PREVIEW,
  PREVIEW_HANDOVER_MS,
  PREVIEW_WATCHDOG_MS,
  terminateLibavoidWorker,
} from '../../layout/libavoidRouter';
import { routeDiagramEdges } from '../../layout/routeOnly';
import { createRoutePreviewChannel, type RoutePreviewChannel } from '../../layout/routePreviewChannel';
import { diagramWithLivePlacements, type LivePlacement } from '../../model/placement';
import { manualRouteIds, routeSource } from '../../model/routes';

/**
 * Route the whole board while a node is being dragged, and hand the canvas the
 * result to draw.
 *
 * **The point of this hook is that releasing the mouse changes nothing on screen.**
 * That is only true if the preview and the drag-end pass produce the same geometry,
 * so the two must agree on every input, and this file's job is to make that
 * structural rather than remembered:
 *
 * - the same function, `routeDiagramEdges`, not a cheaper live variant;
 * - the same `'keep-stored'` declined policy;
 * - the same preserved set, from the shared {@link manualRouteIds} — a manual route
 *   preserved on drop but rerouted mid-drag would snap BACK on release, which is the
 *   bug this removes, wearing a different hat;
 * - the whole board, never the incident edges. Four parallel edges routed together
 *   get four channels 32 px apart; re-route one alone and it lands exactly on a
 *   sibling's, 0.0 px apart, one line invisible. A subset preview also could not
 *   agree with the whole-board pass that follows it, which would move the snap
 *   earlier instead of removing it;
 * - and the only difference: a diagram carrying the in-flight positions, which are
 *   the positions the drop then commits.
 *
 * **Nothing here is committed.** The result lives in React state and is dropped when
 * the gesture is over, so an Escape-aborted drag leaves the stored routes exactly as
 * they were, by construction rather than by care.
 *
 * See `docs/plans/2026-08-08-solution-design-live-drag-routing-plan.md` and the
 * `drag-*` decisions of 2026-08-08.
 */

export interface DragRoutePreview {
  /**
   * Routes to draw instead of the stored ones, or `undefined` when there is nothing
   * to preview — no drag, a board over the ceiling, or a gesture whose first result
   * has not landed yet.
   */
  previewRoutes: ReadonlyMap<string, EdgeRoute> | undefined;
  /** The dragging nodes' live positions. Safe to call on every position change. */
  onDragPositions(moves: LivePlacement[]): void;
  /**
   * The gesture ended, at `finalMoves`.
   *
   * The final positions matter, and are not decoration: every result on screen is
   * for the position of the pass that produced it, so at the moment of release the
   * preview is one pass STALE. Handing the drop's own positions over lets one last
   * pass run against them, which is the only way the geometry on screen can equal
   * the geometry the drag-end pass is about to commit.
   *
   * `handOver` says whether those positions are the ones about to be committed —
   * true for an ordinary drop, false for a gesture that puts the card back (an
   * alt-drag duplicate leaves the original where it started). A handover of
   * geometry nothing is going to commit would be a lie held on screen.
   */
  endDrag(finalMoves?: LivePlacement[], handOver?: boolean): void;
}

export interface DragRoutePreviewOptions {
  model: DesignModel;
  diagram: DesignDiagram;
  /** Live auto-routing is on and the board is editable. */
  enabled: boolean;
}

export function useDragRoutePreview(options: DragRoutePreviewOptions): DragRoutePreview {
  const [previewRoutes, setPreviewRoutes] = useState<ReadonlyMap<string, EdgeRoute> | undefined>(
    undefined,
  );

  // Read the freshest model inside the routing closure without making the channel a
  // dependency of anything: re-creating it on a render would drop the gesture's
  // queued input on the floor.
  const latest = useRef(options);
  latest.current = options;

  const channelRef = useRef<RoutePreviewChannel<LivePlacement[]> | null>(null);
  // Decided ONCE per gesture, at the first position change. Deciding per pass would
  // let the preview switch off under the user's hand halfway through a drag, which
  // is a louder flicker than the one being removed.
  const previewingRef = useRef(false);
  const draggingRef = useRef(false);
  // The drop is not the end of the preview — see `endDrag`.
  const handingOverRef = useRef(false);
  const handoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Connections this diagram would hand the router: both endpoints placed. That is
   * the number the ceiling is measured in, so it is the number to count — the
   * model's total includes connections that live on other diagrams entirely.
   */
  const placedConnectionCount = useMemo(() => {
    const placed = new Set(options.diagram.placements.map((p) => p.elementId));
    return options.model.connections.filter(
      (c) => placed.has(c.sourceId) && placed.has(c.targetId),
    ).length;
  }, [options.model.connections, options.diagram.placements]);
  const placedConnectionCountRef = useRef(placedConnectionCount);
  placedConnectionCountRef.current = placedConnectionCount;

  const stopChannel = useCallback(() => {
    channelRef.current?.stop();
    channelRef.current = null;
  }, []);

  const clearPreview = useCallback(() => {
    handingOverRef.current = false;
    clearTimeout(handoverTimerRef.current);
    handoverTimerRef.current = undefined;
    stopChannel();
    setPreviewRoutes(undefined);
  }, [stopChannel]);

  /**
   * The gesture is over. Stop routing — but **keep drawing the preview**.
   *
   * Clearing it here would put the snap straight back, one step to the left. At the
   * drop the model still holds the routes from before the drag: bends measured
   * against a position the card has left. Dropping the preview would draw those for
   * the 200–400 ms it takes the drag-end pass to land, which is precisely the delay
   * this feature exists to hide, and measured at up to 409 ms.
   *
   * So the preview stays on screen until the commit catches up with it. That is a
   * handover, and it ends one of two ways: the stored routes come to equal what is
   * being previewed (the normal case — the drag-end pass computed the same geometry,
   * which is the whole invariant), or {@link PREVIEW_HANDOVER_MS} elapses without
   * that happening, which means the drag-end pass failed or was cancelled. In that
   * case the preview must go, uncommitted geometry being exactly what the board must
   * not keep showing.
   */
  const endDrag = useCallback(
    (finalMoves: LivePlacement[] = [], handOver = true) => {
      // A gesture that will not commit these positions can arrive at either of the
      // two paths that end a drag, and it can arrive SECOND — the position change
      // reporting `dragging: false` may beat React Flow's own drag-stop handler. So
      // this also downgrades a handover that has already begun, rather than bailing
      // on the guard below.
      if (!handOver && handingOverRef.current) clearPreview();
      if (!draggingRef.current) return;
      const wasPreviewing = previewingRef.current;
      draggingRef.current = false;
      previewingRef.current = false;
      if (!wasPreviewing || !handOver) {
        clearPreview();
        return;
      }
      // One last pass, at the position the drop is about to commit. Without it the
      // preview is whatever the last COMPLETED pass produced, which is a position
      // the card has already left — so the drag-end pass would compute something
      // else, the geometry on screen would change when it landed, and the snap this
      // feature removes would be back. Measured: without this the handover never
      // completes and expires on its timer instead, 1.5 s after the drop.
      if (finalMoves.length > 0) channelRef.current?.send(finalMoves);
      handingOverRef.current = true;
      clearTimeout(handoverTimerRef.current);
      handoverTimerRef.current = setTimeout(clearPreview, PREVIEW_HANDOVER_MS);
    },
    [clearPreview],
  );

  const onDragPositions = useCallback(
    (moves: LivePlacement[]) => {
      if (moves.length === 0) return;
      if (!draggingRef.current) {
        draggingRef.current = true;
        // A new gesture ends any handover still running: whatever the last drag
        // previewed is now stale geometry for a board that is moving again, and its
        // channel must not be left able to apply a late result over this one.
        handingOverRef.current = false;
        clearTimeout(handoverTimerRef.current);
        handoverTimerRef.current = undefined;
        stopChannel();
        // Silent, deliberately. Crossing the ceiling is not a failure to report:
        // the board still routes on drop, exactly as it did before the preview
        // existed, so a message would be a toast on every drag of a large board
        // about a feature the user never saw. See intent rule 11.
        previewingRef.current =
          latest.current.enabled &&
          placedConnectionCountRef.current <= MAX_CONNECTIONS_FOR_DRAG_PREVIEW;
        if (!previewingRef.current) {
          setPreviewRoutes(undefined);
          return;
        }
        channelRef.current = createRoutePreviewChannel<LivePlacement[], EdgeRoute[]>({
          route: async (live) => {
            const { model, diagram } = latest.current;
            const result = await routeDiagramEdges(
              model,
              diagramWithLivePlacements(diagram, live),
              'keep-stored',
              undefined,
              manualRouteIds(diagram),
            );
            return result.edgeRoutes ?? [];
          },
          onResult: (routes) => {
            setPreviewRoutes(new Map(routes.map((route) => [route.connectionId, route])));
          },
          watchdogMs: PREVIEW_WATCHDOG_MS,
          onStuck: () => {
            // A pass that never answered means the worker is gone, not slow (an
            // emscripten abort takes the thread with it). Replace it so the
            // drag-end pass has something to run on, and stop previewing for the
            // rest of this gesture rather than walking into the same wall.
            terminateLibavoidWorker('The routing worker stopped responding.');
            previewingRef.current = false;
            clearPreview();
          },
        });
      }
      if (previewingRef.current) channelRef.current?.send(moves);
    },
    [clearPreview, stopChannel],
  );

  // End the handover as soon as the commit has caught up. Compared by VALUE, not by
  // array identity: an unrelated commit — the drop's own `movePlacements`, an
  // autosave round-trip — hands us a fresh `edgeRoutes` array with the same routes
  // in it, and treating that as "the pass landed" would drop the preview early and
  // show the stale bends for the rest of the wait.
  const storedRoutes = options.diagram.edgeRoutes;
  useEffect(() => {
    if (!handingOverRef.current || !previewRoutes) return;
    const stored = new Map((storedRoutes ?? []).map((route) => [route.connectionId, route]));
    for (const [id, previewed] of previewRoutes) {
      if (!drawsTheSame(stored.get(id), previewed)) return;
    }
    clearPreview();
  }, [storedRoutes, previewRoutes, clearPreview]);

  // A diagram switch or an unmount mid-gesture must not leave a channel routing into
  // a board nobody is looking at, or a timer firing into a dead component — and must
  // not leave the PREVIEW behind either.
  //
  // `CanvasForDiagram` is rendered without a `key`, so a diagram switch does not
  // remount the hook; this cleanup is the only thing that runs. Stopping the channel
  // and the timer while leaving `previewRoutes` set handed the new board geometry
  // computed against the old board's rects — and it keys on connection id, which is
  // design-wide, so the waypoints match connections on the new diagram and get drawn.
  // The gesture flags go with it: the drag belonged to the board that is gone.
  useEffect(
    () => () => {
      draggingRef.current = false;
      previewingRef.current = false;
      clearPreview();
    },
    [clearPreview, options.diagram.id],
  );

  return { previewRoutes, onDragPositions, endDrag };
}

/**
 * Whether the board would DRAW `stored` and `previewed` identically — the question
 * the handover has to answer, which is not the question `edgeRoutesEqual` answers.
 *
 * That one decides whether a route must be persisted, so it compares provenance and
 * treats an absent route as nothing at all. Both are wrong here:
 *
 * - **An absent stored route draws as a straight line**, which is exactly what a
 *   previewed route with no waypoints and no pinned label draws. And absent is the
 *   normal outcome: `applyTidyResult` only writes a route that has waypoints or a
 *   pinned chip, so a straight edge ends up with no row rather than an empty one.
 *   Requiring a row would leave the handover waiting for something that is never
 *   coming, on almost every drag.
 * - **Provenance only reaches the screen through the corner radius**, and a route
 *   with no corners has no radius. It matters for a bent route and cannot for a
 *   straight one, so it is compared only where it is visible.
 */
function drawsTheSame(stored: EdgeRoute | undefined, previewed: EdgeRoute): boolean {
  const waypoints = stored?.waypoints ?? [];
  if (waypoints.length !== previewed.waypoints.length) return false;
  if (!samePoint(stored?.labelPosition, previewed.labelPosition)) return false;
  if (previewed.waypoints.length > 0 && routeSource(stored) !== routeSource(previewed)) {
    return false;
  }
  return previewed.waypoints.every((point, i) => samePoint(point, waypoints[i]));
}

function samePoint(a: Point | undefined, b: Point | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.x === b.x && a.y === b.y;
}
