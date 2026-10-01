// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two layout passes — Tidy and route-only — and everything that decides
 * when they run and what they say when they fail.
 *
 * ONE flag for both (`busy`): each commits a single undo step over the whole
 * diagram, so running them concurrently would let the slower one overwrite
 * the faster one's result. Whichever is running disables the other and shows
 * the spinner on its own button.
 */
import { useCallback, useRef, useState } from 'react';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import type { CommandMeta } from '../model/commands';
import type { DesignDiagram, DesignModel } from '../model/types';
import type { Translate } from '../i18n';
import { tidyContainer, tidyGroup, tidyLayer7, type TidyOptions, type TidyResult } from '../layout/tidy';
import { MAX_CONNECTORS_PER_TIER, type SkippedTier } from '../layout/libavoidRouter';
import { isLayoutRefusal, MAX_TIDY_NODES } from '../layout/elkLayout';
import type { StringKey } from '../i18n/strings';
import type { LayoutAction } from './EditorToolbar';
import type { EditorState } from './useEditorState';
import type { SolutionDesignEditorProps } from './props';
import { FIT_ALL, viewportOverNodes } from './canvas/fitAll';
import type { ViewportMemory } from './canvas/viewportMemory';
import { useAutoLayout } from './useAutoLayout';
import { laidOutForReading, useReadingLayout } from './useReadingLayout';
import { useRouteActions } from './useRouteActions';

/**
 * What to say about a layout pass that threw, or nothing.
 *
 * A cancel is the answer to a question the user asked; a toast saying the
 * thing they stopped did not finish is noise. A board past the cap gets its
 * own words, because "reload the page and try again" is advice that will not
 * help and the real advice — fewer boxes on this diagram — is something only
 * this message can give. Anything else gets the pass's own sentence.
 */
export function layoutFailureMessage(error: unknown, otherwise: StringKey, t: Translate): string | undefined {
  if (isLayoutRefusal(error, 'cancelled')) return undefined;
  if (isLayoutRefusal(error, 'tooLarge')) {
    return t('error.tidyTooLarge', { count: error.count ?? 0, limit: error.limit ?? MAX_TIDY_NODES });
  }
  return t(otherwise);
}

/**
 * Layout failures are REPORTED, not swallowed. The router is WASM fetched at
 * runtime, so "it never loaded" is a real deployment state, and `finally`
 * alone only frees the button again: the user clicks, the spinner blinks,
 * nothing happens, and the one message that would tell them to reload the
 * page goes to the console. Every layout action funnels its failures here.
 *
 * A board the router REFUSED is said in terms of the board rather than of our
 * internals. A tier over the connector cap is dropped whole and its
 * connections come back absent, which is byte-identical to "nothing needed
 * routing" — measured on a 120-app board as 0 of 200 connections routed, in
 * 0.3 ms, reported as success. It deliberately does NOT send them to "Route
 * connections", which cannot route an over-cap board either.
 */
export function useLayoutReports(onError: ((message: string) => void) | undefined, t: Translate) {
  const reportLayoutError = useCallback((message: string, cause: unknown) => {
    console.error(message, cause);
    onError?.(message);
  }, [onError]);
  const reportSkippedTiers = useCallback((skipped: SkippedTier[] | undefined): boolean => {
    if (!skipped || skipped.length === 0) return false;
    const total = skipped.reduce((sum, tier) => sum + tier.connectorCount, 0);
    reportLayoutError(t('error.overCap', { total, max: MAX_CONNECTORS_PER_TIER }), skipped);
    return true;
  }, [reportLayoutError, t]);
  return { reportLayoutError, reportSkippedTiers };
}

export type LayoutReports = ReturnType<typeof useLayoutReports>;

export interface LayoutArgs {
  props: Pick<SolutionDesignEditorProps, 'layout'>;
  state: EditorState;
  diagram: DesignDiagram | undefined;
  readOnly: boolean;
  tidyOptions: TidyOptions;
  groupTidyOptions: TidyOptions;
  t: Translate;
  /** Where each board was left (`useEditorSession`): a reader's pass forgets the pile's frame. */
  viewports?: ViewportMemory;
}

export function useLayoutActions(args: LayoutArgs) {
  const { props, diagram, readOnly, tidyOptions } = args;
  const [busy, setBusy] = useState<LayoutAction | undefined>(undefined);
  const reports = useLayoutReports(props.layout?.onError, args.t);
  const running = { busy, setBusy, ...reports };
  const frameBoard = useFrameBoard();
  const handleTidy = useTidy(args, running, frameBoard);
  const handleTidyGroup = useTidyGroup(args, running);

  /**
   * Lay this diagram out once if a machine wrote its geometry (intent rule 12).
   * `run` is `handleTidy` itself, not a copy of its body, so the settling pass
   * inherits everything the button already does: one commit and one undo
   * step, the placements kept when only routing failed, a routing failure
   * reported through the one message channel, and the frame over the board —
   * which on a first open is required, since the canvas framed the machine
   * grid on mount.
   *
   * Two things are its own. The step is marked `unattended`: nobody pressed
   * anything, and a host that counts or attributes steps must not take a
   * board being opened for the person's work. And the flag that asked for the
   * pass is cleared inside that same step (`applyTidyResult`), so the layout
   * and the clearing are carried together wherever steps go, or not at all.
   */
  useAutoLayout({
    diagram,
    readOnly,
    busy,
    options: tidyOptions,
    run: (override) => handleTidy(override, true, { unattended: true }),
    onSettled: props.layout?.onSettled,
  });

  /**
   * The same pass for a reader, who makes no step: held on the screen, framed
   * like the writer's, and landed nowhere (`useReadingLayout`). `shown` is the
   * board to draw — the stored one everywhere else. A pass that lands while
   * the reader is on another board leaves that board fitted when they come
   * back, rather than put back at the frame the canvas took of its pile.
   */
  const viewports = args.viewports;
  const shown = useReadingLayout({
    diagram,
    readOnly,
    options: tidyOptions,
    lay: useLayForReading(args, reports),
    onShown: frameBoard,
    onLandedAway: useCallback((diagramId: string) => viewports?.forget(diagramId), [viewports]),
  });

  const routes = useRouteActions(args, running);
  return { busy, ...reports, handleTidy, handleTidyGroup, ...routes, shown };
}

export type LayoutActions = ReturnType<typeof useLayoutActions>;

/** The busy interlock and the two ways to report, as every pass is handed them. */
export type LayoutRunning = LayoutReports & {
  busy: LayoutAction | undefined;
  setBusy(busy: LayoutAction | undefined): void;
};

/** A whole-board pass over this board, by its kind. */
function tidyBoard(model: DesignModel, diagram: DesignDiagram, options: TidyOptions): Promise<TidyResult> {
  return diagram.kind === 'layer7'
    ? tidyLayer7(model, diagram, options)
    : tidyContainer(model, diagram, options);
}

function useFrameBoard() {
  const { fitView, getNodes, setViewport } = useReactFlow();
  const flow = useStoreApi();

  /**
   * Frame the whole board once the pass's placements are on the canvas.
   *
   * Two frames, not one: the step lands on the model, the model renders the
   * editor, and only the canvas's effect after that render hands React Flow
   * the moved nodes. Then from the nodes' positions and declared sizes, the
   * way the canvas's own first framing works (`viewportOverNodes`) — React
   * Flow's `fitView` counts what it has measured, and right after a layout it
   * has measured nothing at the new positions, which framed a first open
   * zoomed in on a corner. `fitView` stays as the answer only where there is
   * no pane size to work from.
   */
  return useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const { width, height } = flow.getState();
      const viewport = viewportOverNodes(getNodes(), width, height);
      if (viewport) void setViewport(viewport, { duration: 300 });
      else void fitView({ ...FIT_ALL, duration: 300 });
    }));
  }, [flow, getNodes, setViewport, fitView]);
}

function useTidy(args: LayoutArgs, running: LayoutRunning, frameBoard: () => void) {
  const { state, diagram, tidyOptions, t } = args;
  const { busy, setBusy, reportLayoutError, reportSkippedTiers } = running;

  /**
   * `override` exists so the settling pass can force the pin options off — see
   * `settlingOptions`. One optional argument and one `??`: deliberately NOT a
   * second code path, so a board laid out by the effect and one laid out by
   * the button cannot drift apart. Rethrows so an UNATTENDED caller can tell
   * "laid out" from "did not": `useAutoLayout` must not clear the persisted
   * flag for a pass that produced nothing. The button's call site has been
   * told by the toast, so it attaches a no-op `.catch`. `meta` rides on the
   * step the pass lands: a host's handle says whose pass it was.
   */
  const handleTidy = useCallback(async (override?: TidyOptions, unattended = false, meta?: CommandMeta) => {
    if (!diagram || busy) return;
    const options = override ?? tidyOptions;
    setBusy('tidy');
    try {
      const result = await tidyBoard(state.model, diagram, options);
      // Applied FIRST, and applied even when routing failed: `routingError`
      // means the placements are good and only the routes are missing.
      state.actions.applyTidyResult(result, undefined, meta);
      // The unattended wording says what happened and stops: "reload and try
      // again" is advice for someone who pressed a button, not for a pass
      // that ran by itself on open. One message per press, the failure first.
      if (result.routingError !== undefined) {
        reportLayoutError(t(unattended ? 'error.tidyRoutingUnattended' : 'error.tidyRouting'), result.routingError);
      } else reportSkippedTiers(result.skipped);
      frameBoard();
    } catch (error) {
      const message = layoutFailureMessage(error, unattended ? 'error.tidyUnattended' : 'error.tidy', t);
      if (message !== undefined) reportLayoutError(message, error);
      throw error;
    } finally {
      setBusy(undefined);
    }
  }, [diagram, busy, state.model, state.actions, frameBoard, tidyOptions, reportLayoutError, reportSkippedTiers, t, setBusy]);
  return handleTidy;
}

/**
 * The reader's pass (`useReadingLayout`): the writer's settling pass over the
 * model as it stood when it started, said the way an unattended pass says
 * things through the same channel, and answered with the board to show
 * rather than landed. Rethrows, so nothing is shown for a pass that produced
 * nothing.
 *
 * Said once per board, as the writer's pass — which runs once per board —
 * says it: a board that changes under the reader is worked out again with
 * every change, and the same failure told again each time is not news.
 */
function useLayForReading(args: LayoutArgs, reports: LayoutReports) {
  const { state, t } = args;
  const { reportLayoutError, reportSkippedTiers } = reports;
  /** The boards, by id, a reader has been told something about. */
  const toldRef = useRef(new Set<string>());
  return useCallback(async (diagram: DesignDiagram, options: TidyOptions) => {
    const model = state.model;
    const told = toldRef.current;
    try {
      const result = await tidyBoard(model, diagram, options);
      if (!told.has(diagram.id)) {
        if (result.routingError !== undefined) {
          told.add(diagram.id);
          reportLayoutError(t('error.tidyRoutingUnattended'), result.routingError);
        } else if (reportSkippedTiers(result.skipped)) told.add(diagram.id);
      }
      return laidOutForReading(model, diagram, result);
    } catch (error) {
      const message = layoutFailureMessage(error, 'error.tidyUnattended', t);
      if (message !== undefined && !told.has(diagram.id)) {
        told.add(diagram.id);
        reportLayoutError(message, error);
      }
      throw error;
    }
  }, [state.model, reportLayoutError, reportSkippedTiers, t]);
}

function useTidyGroup(args: LayoutArgs, running: LayoutRunning) {
  const { state, diagram, groupTidyOptions, t } = args;
  const { busy, setBusy, reportLayoutError, reportSkippedTiers } = running;
  // Per-group tidy (right-click a group label). Deliberately does NOT fitView:
  // the change is local to one box, so yanking the viewport would lose the
  // user's place. The same answers to a failure as the board's, and none
  // rethrown: nothing runs it unattended.
  return useCallback(async (name: string) => {
    if (!diagram || diagram.kind !== 'layer7' || busy) return;
    setBusy('tidy');
    try {
      const result = await tidyGroup(state.model, diagram, name, groupTidyOptions);
      state.actions.applyTidyResult(result);
      if (result.routingError !== undefined) reportLayoutError(t('error.tidyGroup'), result.routingError);
      else reportSkippedTiers(result.skipped);
    } catch (error) {
      const message = layoutFailureMessage(error, 'error.tidyGroupFailed', t);
      if (message !== undefined) reportLayoutError(message, error);
    } finally {
      setBusy(undefined);
    }
  }, [diagram, busy, state.model, state.actions, groupTidyOptions, reportLayoutError, reportSkippedTiers, t, setBusy]);
}

