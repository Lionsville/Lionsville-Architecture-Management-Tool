/**
 * A single-slot coalescing channel for routing passes that a gesture asks for.
 *
 * The drag preview wants a whole-board route for wherever the card is *now*, and
 * "now" changes every frame. This holds at most **one pass in flight and one input
 * queued**: a newer input replaces the queued one and the replaced one is never
 * sent. That is what makes supersession free — the cheapest possible cancellation
 * is a request that was never made.
 *
 * Three properties are load-bearing, and each one is a failure mode that has a name:
 *
 * 1. **Coalescing, not queueing.** Above roughly 30 connections a whole-board pass
 *    costs more than a frame, so an unthrottled preview would build a backlog for
 *    the length of the gesture and then deliver routes for positions the card left
 *    seconds ago — falling further behind the harder you drag. Keeping only the
 *    newest input bounds the preview's staleness at one pass duration, whatever the
 *    user does with the mouse.
 * 2. **Generations, so a late answer cannot land.** The pass still running when the
 *    drag ends will answer, and its answer is geometry for a position that is no
 *    longer live. {@link RoutePreviewChannel.stop} drops the generation, and a
 *    result from a stopped generation is discarded rather than applied.
 * 3. **The worker is never terminated for supersession.** Terminating replaces the
 *    worker, and the replacement re-initialises the libavoid WASM module before it
 *    can route anything (3.4 ms in dev, 11.8 ms in a production build) — at frame
 *    rate that is a permanent cold start and the preview would never complete a
 *    pass. `onStuck` fires for one thing only: a pass that has not answered within
 *    `watchdogMs`, which is the case where an answer is not late but absent (an
 *    emscripten `abort()` takes the worker thread with it). See
 *    `docs/decisions/2026-08-08-drag-preview-coalesces-instead-of-terminating.md`.
 *
 * Deliberately generic and free of both React and the router: everything above is
 * testable without a worker, a DOM or a fake timer library beyond vitest's own.
 */

export interface RoutePreviewChannelOptions<TInput, TResult> {
  /** Run one pass. Rejections are swallowed — see {@link createRoutePreviewChannel}. */
  route(input: TInput): Promise<TResult>;
  /** Called with each result that is still wanted, newest last. */
  onResult(result: TResult): void;
  /** How long a pass may take before it counts as never coming back. */
  watchdogMs: number;
  /** A pass overran the watchdog. The channel is finished; it sends nothing more. */
  onStuck(): void;
}

export interface RoutePreviewChannel<TInput> {
  /** Offer the newest input. Replaces any input still waiting, unsent. */
  send(input: TInput): void;
  /** Finish. Nothing further is sent and no outstanding answer is applied. */
  stop(): void;
}

export function createRoutePreviewChannel<TInput, TResult>(
  options: RoutePreviewChannelOptions<TInput, TResult>,
): RoutePreviewChannel<TInput> {
  // `undefined` is a legal TInput, so presence is tracked by the box rather than by
  // the value — a caller previewing "no moves" must not look like an empty queue.
  let queued: { input: TInput } | undefined;
  let running = false;
  // Two different endings, and they are not the same thing. `stopped` is the
  // ordinary one (the drag ended) and says nothing about the router's health;
  // `stuck` means a pass never answered, and the caller has already been told.
  let stopped = false;
  let stuck = false;

  const pump = (): void => {
    if (running || stopped || stuck || queued === undefined) return;
    const { input } = queued;
    queued = undefined;
    running = true;

    let answered = false;
    const watchdog = setTimeout(() => {
      if (answered) return;
      stuck = true;
      queued = undefined;
      options.onStuck();
    }, options.watchdogMs);

    const settle = (): boolean => {
      answered = true;
      clearTimeout(watchdog);
      running = false;
      return !stopped && !stuck;
    };

    options.route(input).then(
      (result) => {
        if (!settle()) return;
        options.onResult(result);
        pump();
      },
      () => {
        // A failed preview pass is the ONE routing failure that is not reported
        // anywhere. Nobody pressed anything, the stored routes are untouched, and
        // the drag-end pass will answer for real in a moment — so the honest
        // response is to keep previewing and let the next pass try again.
        if (!settle()) return;
        pump();
      },
    );
  };

  return {
    send(input: TInput): void {
      if (stopped || stuck) return;
      queued = { input };
      pump();
    },
    stop(): void {
      stopped = true;
      queued = undefined;
    },
  };
}
