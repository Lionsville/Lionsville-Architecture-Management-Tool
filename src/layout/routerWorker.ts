import {
  configureLibavoidWasm,
  routeWithLibavoidInProcess,
  type RouterWorkerRequest,
  type RouterWorkerResponse,
} from './libavoidRouter';

/**
 * The routing worker's body.
 *
 * It runs the SAME code the main thread would — `routeWithLibavoidInProcess` — so
 * this file is transport and nothing else: read a request, route, post the answer
 * back. There is deliberately no second routing implementation here; a board must
 * produce identical geometry whether or not the host wired a worker up, and the
 * only way to guarantee that is to have one router.
 *
 * The host constructs it (Vite's `?worker` import, or a literal `new URL(...,
 * import.meta.url)`) and hands the constructor to `configureLibavoidWorker`. A
 * variable URL builds clean and then 404s at runtime, so the import must be
 * statically analysable.
 *
 * Two notes on what crosses the boundary:
 *
 * - **`wasmUrl` travels in every request.** Module state does not cross threads,
 *   so the worker's copy of `libavoidRouter` has never seen the host's
 *   `configureLibavoidWasm` call. Setting it per request is idempotent and costs
 *   nothing — the loader caches its promise after the first load.
 * - **The input clones cheaply.** It is plain rects, ids and points; measured at
 *   0.009 ms on a real board and 0.074 ms at 150 nodes, so the boundary is free
 *   relative to the routing it wraps.
 *
 * Errors come back as a message rather than as a thrown exception, because a
 * rejection inside a worker surfaces on the main thread as an opaque `error`
 * event with no stack. The main side turns the message back into an Error.
 */
self.onmessage = (event: MessageEvent<RouterWorkerRequest>) => {
  const { id, input, wasmUrl } = event.data;
  if (wasmUrl) configureLibavoidWasm(wasmUrl);

  routeWithLibavoidInProcess(input).then(
    ({ routes, skipped }) => {
      const response: RouterWorkerResponse = { id, ok: true, routes: [...routes], skipped };
      self.postMessage(response);
    },
    (error: unknown) => {
      const response: RouterWorkerResponse = {
        id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    },
  );
};
