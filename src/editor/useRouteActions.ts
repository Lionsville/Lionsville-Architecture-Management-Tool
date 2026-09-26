// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The route-only passes: "Route connections", "Re-route everything", a reset
 * or a side on one line followed by a pass, and live auto-routing.
 */
import { useCallback, useRef } from 'react';
import type { DesignDiagram } from '../model/types';
import type { Translate } from '../i18n';
import { routeDiagramEdges } from '../layout/routeOnly';
import {
  diagramWithRoutes, edgeRoutesOf, manualRouteIds, routeFor, routeSource, routeWithSides, withRouteRow,
  type AttachSidesPatch,
} from '../model/routes';
import type { CommitToken } from './useEditorState';
import { useLiveRouting } from './useLiveRouting';
import type { LayoutArgs, LayoutRunning } from './useLayoutActions';

/**
 * The line under the auto-route toggle, or none. A board already told it is
 * over the cap says so. A board whose stored routes all predate provenance
 * has nothing live mode is allowed to move — every one backfilled to
 * `manual` — and is worth saying out loud: otherwise the first person to try
 * the toggle drags a node, watches nothing happen, and concludes it is broken.
 */
export function autoRouteNote(
  diagram: DesignDiagram | undefined,
  autoRoute: boolean,
  overCapReported: ReadonlySet<string>,
  t: Translate,
): string | undefined {
  if (overCapReported.has(diagram?.id ?? '')) return t('note.overCap');
  const routes = edgeRoutesOf(diagram);
  const needsReclassifying = autoRoute && routes.length > 0 && routes.every((r) => routeSource(r) === 'manual');
  return needsReclassifying ? t('note.reclassify') : undefined;
}

export function useRouteActions(args: LayoutArgs, running: LayoutRunning) {
  const { state, diagram, t } = args;
  const { busy, setBusy, reportLayoutError, reportSkippedTiers } = running;
  const autoRoute = diagram?.autoRoute ?? false;

  // Re-route the edges around the CURRENT node positions without moving
  // anything: the pass a user reaches for after nudging nodes by hand. It
  // commits routes only, through Tidy's one-undo-step action, and there is no
  // half-result worth keeping, so a failure commits nothing. `preserve` is
  // the ONE difference between the two menu entries: "Route connections"
  // leaves every hand-drawn and pinned route where it is, "Re-route
  // everything (ignore pins)" hands the whole board to the router.
  const routeEdges = useCallback(async (preserve: ReadonlySet<string> | undefined) => {
    if (!diagram || busy) return;
    setBusy('route');
    try {
      const result = await routeDiagramEdges(state.model, diagram, 'keep-stored', undefined, preserve);
      state.actions.applyTidyResult(result);
      reportSkippedTiers(result.skipped);
    } catch (error) {
      reportLayoutError(t('error.route'), error);
    } finally {
      setBusy(undefined);
    }
  }, [diagram, busy, state.model, state.actions, reportLayoutError, reportSkippedTiers, t, setBusy]);
  const handleRouteEdges = useCallback(
    () => routeEdges(diagram ? manualRouteIds(diagram) : undefined),
    [routeEdges, diagram],
  );
  const handleRouteEdgesAll = useCallback(() => routeEdges(undefined), [routeEdges]);

  const lines = useLineRouteActions(args, running, autoRoute);
  const auto = useAutoRouting(args, running, autoRoute);
  return { autoRoute, handleRouteEdges, handleRouteEdgesAll, ...auto, ...lines };
}

/**
 * Live auto-routing and its toggle. The latch of diagrams already told they
 * are over the connector cap is owned here because the toggle clears a
 * diagram's entry when the user turns the mode back on by hand: that
 * overrides the self-disable, and the board may say its piece again.
 */
function useAutoRouting(args: LayoutArgs, running: LayoutRunning, autoRoute: boolean) {
  const { state, diagram, readOnly, t } = args;
  const overCapReportedRef = useRef<Set<string>>(new Set());
  const handleToggleAutoRoute = useCallback(() => {
    if (!diagram) return;
    const next = !autoRoute;
    if (next) overCapReportedRef.current.delete(diagram.id);
    state.actions.setAutoRoute(next);
  }, [diagram, autoRoute, state.actions]);

  // Re-route the WHOLE board shortly after anything moved, folded into the
  // undo step that moved it — see `useLiveRouting` for the rules and reasons.
  useLiveRouting({
    autoRoute,
    readOnly,
    geometryVersion: state.geometryVersion,
    activeDiagram: diagram,
    state,
    busy: running.busy !== undefined,
    reportSkippedTiers: running.reportSkippedTiers,
    overCapReportedRef,
  });
  return { autoRouteNote: autoRouteNote(diagram, autoRoute, overCapReportedRef.current, t), handleToggleAutoRoute };
}

/**
 * A reset or a side on one line, then the line brought back ROUTED rather than
 * merely straight — a reset that left a bare floating line on a routed board
 * would look like a regression. With live routing on, the edit is a geometry
 * commit and the live pass amends into it by itself; with it off, the pass
 * runs here against the board AFTER the edit (`state.model` is still the
 * render before it, and routing against that would hand the old row straight
 * back) and amends through the edit's token. A no-op edit routes nothing.
 */
function useLineRouteActions(args: LayoutArgs, running: LayoutRunning, autoRoute: boolean) {
  const { state, diagram, readOnly, t } = args;
  const { busy, setBusy, reportLayoutError, reportSkippedTiers } = running;
  const rerouteAfterRouteEdit = useCallback(async (token: CommitToken, edited: DesignDiagram) => {
    setBusy('route');
    try {
      const result = await routeDiagramEdges(state.model, edited, 'keep-stored', undefined, manualRouteIds(edited));
      state.actions.applyTidyResult(result, token);
      reportSkippedTiers(result.skipped);
    } catch (error) {
      reportLayoutError(t('error.routeOne'), error);
    } finally {
      setBusy(undefined);
    }
  }, [state.actions, state.model, reportLayoutError, reportSkippedTiers, t, setBusy]);

  const handleResetRoute = useCallback(async (connectionId: string) => {
    if (!diagram || readOnly || busy) return;
    const token = state.actions.resetEdgeRoute(connectionId);
    if (autoRoute) return;
    await rerouteAfterRouteEdit(token, diagramWithRoutes(
      diagram,
      edgeRoutesOf(diagram).filter((r) => r.relationId !== connectionId),
    ));
  }, [diagram, readOnly, busy, autoRoute, state.actions, rerouteAfterRouteEdit]);

  // "Attach at" (inspector selects, line menu, Alt-reconnect): the side lands
  // in the row, with the merged row in place of the stored one.
  const handleSetRouteSides = useCallback(async (connectionId: string, sides: AttachSidesPatch) => {
    if (!diagram || readOnly || busy) return;
    const token = state.actions.setRouteSides(connectionId, sides);
    if (token === undefined || autoRoute) return;
    const row = routeWithSides(routeFor(diagram, connectionId), connectionId, sides);
    await rerouteAfterRouteEdit(token, diagramWithRoutes(diagram, withRouteRow(edgeRoutesOf(diagram), row)));
  }, [diagram, readOnly, busy, autoRoute, state.actions, rerouteAfterRouteEdit]);

  return { handleResetRoute, handleSetRouteSides };
}
