import { useEffect, useRef, type RefObject } from 'react';
import type { DesignDiagram } from '../model/types';
import { routeDiagramEdges } from '../layout/routeOnly';
import type { SkippedTier } from '../layout/libavoidRouter';
import { manualRouteIds } from '../model/routes';
import type { EditorState } from './useEditorState';

/**
 * How long after the last geometry change the live reroute runs. Enough to
 * swallow the several drag-stops a multi-select drag emits, short enough that
 * the routes land while the drop still feels like the same gesture.
 */
export const LIVE_REROUTE_DEBOUNCE_MS = 150;

export interface LiveRoutingArgs {
  /** The active diagram's `autoRoute` flag. */
  autoRoute: boolean;
  readOnly: boolean;
  /** `EditorState.geometryVersion` — the trigger. */
  geometryVersion: number;
  activeDiagram: DesignDiagram | undefined;
  state: EditorState;
  /** A layout action is running; the pass waits for the next bump instead. */
  busy: boolean;
  /** The editor's one message channel for a tier the router refused. */
  reportSkippedTiers(skipped: SkippedTier[] | undefined): void;
  /**
   * Diagrams already told they are over the connector cap, so the message is said
   * ONCE rather than on every drag. Owned by the editor because the auto-route
   * toggle clears a diagram's entry when the user turns the mode back on by hand.
   */
  overCapReportedRef: RefObject<Set<string>>;
}

/**
 * Live auto-routing (items 3 and 6): re-route the WHOLE board shortly after
 * anything moved, and fold the result into the undo step that moved it.
 *
 * Whole board, not the edges that moved: four parallel edges routed together get
 * four distinct channels, and re-routing one alone lands it exactly on a
 * sibling's — measured at 0.0 px apart, one line hidden. Nudging only happens
 * between connectors in the same transaction. A subset pass also looks perfect
 * on an uncrowded board, which is what makes it dangerous.
 *
 * On drag-END, not per frame: the observable benefit of per-frame routing is that
 * lines follow the node, and a waypoint-free floating edge already does that for
 * free (see the drag preview). What is left is the drop.
 *
 * Extracted from `SolutionDesignEditor` unchanged in behaviour; the editor's
 * live-routing tests (`useEditorState.liveRouting.test.ts`, the over-cap cases in
 * `SolutionDesignEditor.layoutErrors.test.tsx`) are the contract.
 */
export function useLiveRouting({
  autoRoute,
  readOnly,
  geometryVersion,
  activeDiagram,
  state,
  busy,
  reportSkippedTiers,
  overCapReportedRef,
}: LiveRoutingArgs): void {
  // Mirrors for the effect below, so it can read the latest values without
  // re-subscribing (and re-debouncing) on every render.
  const liveRef = useRef({ activeDiagram, state, busy, reportSkippedTiers });
  liveRef.current = { activeDiagram, state, busy, reportSkippedTiers };
  const activeDiagramIdRef = useRef(activeDiagram?.id);
  activeDiagramIdRef.current = activeDiagram?.id;

  useEffect(() => {
    if (!autoRoute || readOnly || geometryVersion === 0) return;
    let cancelled = false;
    // The diagram the bump came from. A pending debounce must not follow the user
    // to another tab and re-route a board that has not changed — harmless in
    // effect, since a `keep-stored` pass is idempotent, but it would spend a
    // worker pass and an undo step on a diagram nobody touched.
    const bumpedFor = activeDiagramIdRef.current;
    // Long enough to swallow the several drag-stops a multi-select drag emits.
    const timer = setTimeout(() => {
      const live = liveRef.current;
      const diagram = live.activeDiagram;
      if (!diagram || diagram.id !== bumpedFor || live.busy) return;
      // The token is taken BEFORE the async pass, so any edit that lands while it
      // is in flight invalidates it and the routes get their own undo step
      // instead of being folded into a step that has moved on.
      const token = live.state.overlayVersion;
      void routeDiagramEdges(
        live.state.effectiveModel,
        diagram,
        'keep-stored',
        undefined,
        // EVERY manual route, regardless of `pinAnchorPoints`. This pass is not
        // something the user asked for, so it has no instruction to discard
        // anyone's geometry — the pin option governs the Tidy button, which is
        // an instruction, and says nothing about a reroute nobody pressed.
        //
        // Shared with the drag preview through `manualRouteIds`, and that sharing
        // is load-bearing: a route this pass preserves but the preview reroutes
        // would snap BACK when the mouse comes up.
        manualRouteIds(diagram),
      ).then(
        (result) => {
          if (cancelled) return;
          // Amended into the move's own undo step, so one gesture stays one undo.
          live.state.actions.applyTidyResult(result, token);
          if (result.skipped && result.skipped.length > 0) {
            // Over the cap: turn the mode off for this diagram and PERSIST it off,
            // so reopening the diagram does not re-enter a mode that cannot work.
            if (!overCapReportedRef.current.has(diagram.id)) {
              overCapReportedRef.current.add(diagram.id);
              live.reportSkippedTiers(result.skipped);
            }
            live.state.actions.setAutoRoute(false);
          }
        },
        (error: unknown) => {
          if (cancelled) return;
          // Nobody pressed anything, so this is the one routing failure that does
          // NOT get a message: it would arrive unprompted, and the console entry
          // is what a developer needs. The stored routes are untouched.
          console.error('Live re-routing failed.', error);
        },
      );
    }, LIVE_REROUTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Deps are deliberately just the trigger and the two gates. Everything else
    // is read from `liveRef` inside the timeout, so an unrelated re-render cannot
    // restart the debounce and drop a pending reroute on the floor.
  }, [geometryVersion, autoRoute, readOnly, overCapReportedRef]);
}
