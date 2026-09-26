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
import { useCallback, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { DesignDiagram } from '../model/types';
import type { Translate } from '../i18n';
import { tidyContainer, tidyGroup, tidyLayer7, type TidyOptions } from '../layout/tidy';
import { MAX_CONNECTORS_PER_TIER, type SkippedTier } from '../layout/libavoidRouter';
import { isLayoutRefusal, MAX_TIDY_NODES } from '../layout/elkLayout';
import type { StringKey } from '../i18n/strings';
import type { LayoutAction } from './EditorToolbar';
import type { EditorState } from './useEditorState';
import type { SolutionDesignEditorProps } from './props';
import { FIT_ALL } from './canvas/fitAll';
import { useAutoLayout } from './useAutoLayout';
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
}

export function useLayoutActions(args: LayoutArgs) {
  const { props, diagram, readOnly, tidyOptions } = args;
  const [busy, setBusy] = useState<LayoutAction | undefined>(undefined);
  const reports = useLayoutReports(props.layout?.onError, args.t);
  const running = { busy, setBusy, ...reports };
  const handleTidy = useTidy(args, running);
  const handleTidyGroup = useTidyGroup(args, running);

  /**
   * Lay this diagram out once if a machine wrote its geometry (intent rule 12).
   * `run` is `handleTidy` itself, not a copy of its body, so the settling pass
   * inherits everything the button already does: one commit and one undo
   * step, the placements kept when only routing failed, a routing failure
   * reported through the one message channel, and `fitView` — which on a
   * first open is required, since the canvas framed the machine grid on mount.
   */
  useAutoLayout({
    diagram,
    readOnly,
    busy,
    options: tidyOptions,
    run: (override) => handleTidy(override, true),
    onSettled: props.layout?.onSettled,
  });

  const routes = useRouteActions(args, running);
  return { busy, ...reports, handleTidy, handleTidyGroup, ...routes };
}

export type LayoutActions = ReturnType<typeof useLayoutActions>;

/** The busy interlock and the two ways to report, as every pass is handed them. */
export type LayoutRunning = LayoutReports & {
  busy: LayoutAction | undefined;
  setBusy(busy: LayoutAction | undefined): void;
};

function useTidy(args: LayoutArgs, running: LayoutRunning) {
  const { state, diagram, tidyOptions, t } = args;
  const { busy, setBusy, reportLayoutError, reportSkippedTiers } = running;
  const { fitView } = useReactFlow();

  /**
   * `override` exists so the settling pass can force the pin options off — see
   * `settlingOptions`. One optional argument and one `??`: deliberately NOT a
   * second code path, so a board laid out by the effect and one laid out by
   * the button cannot drift apart. Rethrows so an UNATTENDED caller can tell
   * "laid out" from "did not": `useAutoLayout` must not clear the persisted
   * flag for a pass that produced nothing. The button's call site has been
   * told by the toast, so it attaches a no-op `.catch`.
   */
  const handleTidy = useCallback(async (override?: TidyOptions, unattended = false) => {
    if (!diagram || busy) return;
    const options = override ?? tidyOptions;
    setBusy('tidy');
    try {
      const result = diagram.kind === 'layer7'
        ? await tidyLayer7(state.model, diagram, options)
        : await tidyContainer(state.model, diagram, options);
      // Applied FIRST, and applied even when routing failed: `routingError`
      // means the placements are good and only the routes are missing.
      state.actions.applyTidyResult(result);
      // The unattended wording says what happened and stops: "reload and try
      // again" is advice for someone who pressed a button, not for a pass
      // that ran by itself on open. One message per press, the failure first.
      if (result.routingError !== undefined) {
        reportLayoutError(t(unattended ? 'error.tidyRoutingUnattended' : 'error.tidyRouting'), result.routingError);
      } else reportSkippedTiers(result.skipped);
      requestAnimationFrame(() => fitView({ ...FIT_ALL, duration: 300 }));
    } catch (error) {
      const message = layoutFailureMessage(error, unattended ? 'error.tidyUnattended' : 'error.tidy', t);
      if (message !== undefined) reportLayoutError(message, error);
      throw error;
    } finally {
      setBusy(undefined);
    }
  }, [diagram, busy, state.model, state.actions, fitView, tidyOptions, reportLayoutError, reportSkippedTiers, t, setBusy]);
  return handleTidy;
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

