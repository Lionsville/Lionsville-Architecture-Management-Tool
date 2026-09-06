import type { AttachSide, DomainGroupRect, ElementId, Point, Rect } from '../model/types';
import { ROUTE_CLEARANCE, rectCentre } from './routing';

/**
 * Orthogonal edge router: rects in, interior waypoints out.
 *
 * Wraps `libavoid-js` (the WASM port of Adaptagrams' libavoid, the router behind
 * Inkscape's connectors) and knows NOTHING about `DesignModel`/`DesignDiagram` —
 * that keeps it testable without ELK and swappable if libavoid ever goes away.
 * See `docs/plans/2026-06-10-solution-design/edge-routing/2026-07-27-libavoid-adoption-plan.md`.
 *
 * Three properties of this module are load-bearing:
 *
 * 1. **Two tiers.** Overlapping obstacles are fine for libavoid; CONTAINED ones are
 *    not. A rect fully covered by another rect makes its container stop blocking
 *    altogether, while every partial overlap we swept keeps blocking correctly. A
 *    domain-group box containing its own members hits exactly that case (measured: a
 *    single pass with and without the group boxes produced byte-identical routes).
 *    So tier 1 routes every inter-group edge against opaque group boxes plus the
 *    ungrouped node rects, and tier 2 gives each group its own router for that
 *    group's internal edges, holding its members plus everything outside the box
 *    (the other groups, the ungrouped nodes) but never the box itself. Neither
 *    obstacle set nests by construction, and {@link withoutContainedRects} enforces
 *    it for the containment a user can still create by dragging shapes over each other.
 * 2. **Canonical id-sorted insertion order** in both tiers. libavoid is
 *    deterministic per insertion order but order-SENSITIVE: nudging hands out
 *    parallel channels in connector insertion order, so with the sort removed a
 *    board of four edges competing for one channel routes 3 different ways across
 *    12 shuffles (measured; the real E-Commerce board happens to be insensitive,
 *    but only because nothing on it competes). The model's array order is not a
 *    stable key — adding an element reorders it — so the adapter derives its own
 *    order from ids. A correctness requirement with a regression test, not a style
 *    preference.
 * 3. **Interior waypoints only.** libavoid returns the full polyline including the
 *    endpoints it was given; we strip the first and last point because the model
 *    stores interior waypoints and `FloatingEdge` derives its own anchors. An
 *    empty interior therefore means "draw it straight". The one exception is an
 *    end PINNED to a side ({@link RouterConnection.sourceSide}): its endpoint is
 *    the attachment point on the node's boundary, not a centre the renderer would
 *    re-derive, so it is kept as the first/last waypoint.
 *
 * Its failure policy is one rule: when we cannot produce a route we *trust*, the
 * connection is left ABSENT from the result map, never given a plausible-looking
 * one. The caller reads absence as "keep the stored route", so refusing degrades
 * nothing, while a repaired route would be drawn and then saved. That is why
 * {@link isSafeRect}, {@link MAX_CONNECTORS_PER_TIER} and {@link interiorWaypoints}
 * all drop whole nodes, tiers and polylines instead of patching them.
 */

/** A node the router treats as an obstacle and can attach connectors to. */
export interface RouterNode {
  id: ElementId;
  rect: Rect;
  /** Domain group this node belongs to, by {@link DomainGroupRect.name}. */
  domainGroup?: string;
}

/** One connection to route, identified the way the model identifies it. */
export interface RouterConnection {
  id: string;
  sourceId: ElementId;
  targetId: ElementId;
  /**
   * The side of each node the line must leave from / arrive at. Absent = a free
   * end at the node's centre, exactly as before — every route on a board without
   * sides is byte-identical to what it was.
   *
   * A set side becomes a libavoid `ShapeConnectionPin` on that side of the node's
   * shape, visible only outward (`ConnDir*`), so the side is a hard constraint the
   * router obeys rather than a preference it weighs: an awkward pair of sides
   * yields a detour, never a diagonal. Verified in `docs/spike-libavoid-sides.md`.
   * A node this tier holds no shape for (a grouped node in tier 1, whose group box
   * is the obstacle) gets a free end AT the side's midpoint instead — the
   * attachment point still lands on the requested side; only the departure
   * direction is then the router's to choose.
   */
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
}

export interface RouterInput {
  nodes: RouterNode[];
  groups: DomainGroupRect[];
  connections: RouterConnection[];
}

/** One routing tier the router refused because it was over {@link MAX_CONNECTORS_PER_TIER}. */
export interface SkippedTier {
  connectorCount: number;
  connectionIds: string[];
}

/**
 * What a routing pass produced, and what it declined to attempt.
 *
 * `routes` is what it always was. `skipped` is the half that used to be invisible:
 * an over-cap tier is dropped whole, and its connections then come back absent
 * from the map — which is byte-identical to "nothing needed routing". Measured on
 * a 120-app board, that read as **0 of 200 connections routed, in 0.3 ms,
 * reported as success**. A caller cannot tell those two apart from the map alone,
 * so refusing to route has to be said out loud rather than inferred.
 */
export interface RouterResult {
  routes: Map<string, Point[]>;
  skipped: SkippedTier[];
}

/**
 * Gap (px) libavoid aims for between adjacent parallel channels. The nudge distance
 * IS that gap, and an edge label chip is 18 px tall wanting `LABEL_MARGIN` (12) of
 * clearance, so it needs more than 30 px to clear its neighbour's chip. Measured on
 * the real board: chips collide at 12/18/24/30 and stop colliding at 32. libavoid
 * has no concept of labels, so this is ours to get right — and a chip with a
 * protocol line is 34 px tall, so it still needs `labelSpotFor`'s own avoidance.
 */
export const IDEAL_NUDGING_DISTANCE = 32;

/**
 * Most connectors we will hand to ONE router pass. A tier over this limit is
 * skipped whole: its connections come back absent from the result map, so the
 * caller keeps whatever routes it had stored.
 *
 * `processTransaction()` is synchronous WASM on the main thread. There is no
 * timeout, no cancellation and no progress reporting, so a slow board is not a
 * slow spinner — it is a frozen tab the user cannot escape. Measured cost, on a
 * board of edges competing for ONE channel (the worst case):
 *
 * | connectors | time     |
 * | ---------- | -------- |
 * | 25         | 15 ms    |
 * | 50         | 102 ms   |
 * | 100        | 1.2 s    |
 * | 150        | 6.6 s    |
 * | 200        | 18.6 s   |
 * | 300        | 91 s     |
 * | 500        | 151 s (144 MiB heap) |
 *
 * Turning nudging off does not help (200 connectors: 19.1 s off vs 18.6 s on).
 *
 * 150 is where the worst case crosses into visible-freeze territory (6.6 s).
 * The honest trade-off: connector count is a CRUDE proxy for the real driver,
 * which is channel competition — 993 spread-out connectors routed in 1.7 s, and
 * this cap refuses that board anyway. So we will decline to route some large
 * boards that would have been fine. That is deliberate: the alternative failure
 * is a multi-minute unkillable freeze with no spinner and no cancel button,
 * whereas declining costs the user only the automatic routing of one crowded
 * board. Real curated architecture boards are an order of magnitude below the
 * cap, so nobody should meet it in practice. Exported so it can be tuned.
 */
export const MAX_CONNECTORS_PER_TIER = 150;

/**
 * Most connections a diagram may have before the editor stops previewing routes
 * *during* a drag and falls back to routing on the drop.
 *
 * Measured end to end in a browser, with React Flow rendering the board and one
 * whole-board pass always in flight against the card's live position — see
 * `docs/plans/2026-06-10-solution-design/edge-routing/2026-08-08-live-drag-routing-spike-results.md`:
 *
 * | connections | pass, median | refreshes / second |
 * | ----------- | ------------ | ------------------ |
 * | 8           | 0.3 ms       | ~1100              |
 * | 33          | 6.1 ms       | 71                 |
 * | 63          | 5.6 ms       | 78                 |
 * | 93          | 16.8 ms      | 25                 |
 * | 143         | —            | the board could not be laid out at all |
 *
 * 93 connections still redraws the routed shape about every 1.5 frames of gesture.
 * 143 is not slower-but-usable: laying that board out did not return within four
 * minutes, twice, with its routing step outstanding in a worker and roughly 88
 * connectors in tier 1 — comfortably under
 * {@link MAX_CONNECTORS_PER_TIER}, which therefore does not protect against it.
 * Nothing between the two was measurable, so this sits just above the largest board
 * that behaved and deliberately does not reach into the gap.
 *
 * Like {@link MAX_CONNECTORS_PER_TIER} it is a CRUDE proxy, and measurably so: 63
 * connections routed faster than 33 in the same sweep, because channel competition
 * decides the cost and a count cannot see it. A count is chosen anyway because it is
 * the only thing knowable *before* the first pass, and the fallback has to be
 * decided once at drag start — deciding mid-gesture would switch the preview off
 * under the user's hand, which is a worse flicker than the one being removed.
 *
 * Crossing it is NOT a failure and raises nothing: the board still routes on drop,
 * exactly as it did before the preview existed (intent rule 11 governs results, not
 * optimisations). Exported so it can be tuned.
 */
export const MAX_CONNECTIONS_FOR_DRAG_PREVIEW = 100;

/**
 * How long a preview pass may take before it counts as never coming back.
 *
 * Deliberately generous, and not a timeout on slowness: a slow board is slow and its
 * preview is chunky, which is {@link MAX_CONNECTIONS_FOR_DRAG_PREVIEW}'s problem.
 * This covers the one case where an answer is absent rather than late — an
 * emscripten `abort()` takes the worker thread with it — and the response is to
 * terminate the worker so the next request builds a fresh one. A tight value would
 * terminate mid-drag on a merely slow board, and a terminate per drag is exactly the
 * WASM cold-start pathology the preview channel exists to avoid.
 *
 * 5 s is ~300 times the slowest pass measured (16.8 ms at 93 connections) and still
 * short enough that a wedged worker does not survive a single gesture.
 */
export const PREVIEW_WATCHDOG_MS = 5000;

/**
 * How long the drag preview keeps drawing after the mouse comes up, waiting for the
 * commit to catch up with it.
 *
 * The drop is NOT the end of the preview, and clearing it there would put the snap
 * straight back one step to the left: at the moment of release the model still holds
 * the routes from before the drag — bends measured against a position the card has
 * left — and drawing those until the drag-end pass lands is exactly the delay this
 * feature exists to hide. Measured drop-to-redrawn: 238 ms on the real board, 409 ms
 * at 60 applications.
 *
 * The handover normally ends when the stored routes come to equal the previewed
 * ones, which is the invariant working. This is the backstop for when it does not —
 * the drag-end pass failed, or the router threw — and it must not be generous:
 * every millisecond past it is the board showing geometry that will never be saved.
 * 1.5 s is roughly 3.5x the slowest measured drop-to-redrawn.
 */
export const PREVIEW_HANDOVER_MS = 1500;

// ── the slice of libavoid-js this adapter uses ───────────────────────────────
// Hand-written on purpose: the shipped typings declare `Avoid` with an
// `[x: string]: any` index signature (so every routing parameter would be `any`)
// and are partly wrong — `ShapeRef.id()` is declared but absent at runtime, which
// aborts the WASM module when called. We keep our own id↔ref mapping instead.
//
// `destroy` frees the C++ object in the WASM heap. It does NOT clear libavoid-js's
// JS-side wrapper cache: this is a WebIDL-binder module, so constructors and
// `wrapPointer` memoise by pointer and only `destroy` evicts. Measured, on a board
// whose geometry changes every run: ~13 cache entries accumulate per run with no
// plateau. Known and accepted, not a leak we chase — a wrapper is a pointer that
// reads live memory, so a stale one costs a few bytes and nothing else, and the
// whole thing dies with the page. Eviction via `getCache`/`getPointer` looks
// possible but is unverified, and an unmeasured change here is not worth it.

/**
 * A point WE constructed in libavoid's heap. Ours: destroy after use.
 *
 * `__owned` is type-level only — nothing reads it at runtime. It exists so this type
 * is NOT structurally interchangeable with {@link AvoidRoutePoint}, which carries the
 * opposite ownership. Without it the two would be the same type to the compiler and
 * {@link AvoidApi.destroy} would happily accept a borrowed point.
 */
interface AvoidPoint {
  readonly x: number;
  readonly y: number;
  readonly __owned: 'Point';
}

/**
 * A point read back out of a route: borrowed from the connector's polyline, and it
 * must NEVER be destroyed. Its shape matches {@link AvoidPoint} at runtime, but the
 * ownership is the reverse, so the two are deliberately different types and
 * {@link AvoidApi.destroy} rejects this one.
 *
 * The hazard is silent, which is why it gets a type rather than a comment.
 * Measured: `destroy(routePoint)` throws nothing, after which the route reads back
 * garbage (`9.49e-310`) and `processTransaction()` carries on happily — so a
 * maintainer following a shared "destroy after use" doc would corrupt persisted
 * geometry with no crash to show for it.
 */
interface AvoidRoutePoint {
  readonly x: number;
  readonly y: number;
}

/** A route. Borrowed from the connector — must NOT be destroyed. */
interface AvoidPolyLine {
  size(): number;
  get_ps(index: number): AvoidRoutePoint;
}

/** Handles we only ever hand back to libavoid; the brands are type-level only. */
type AvoidRectangle = { readonly __avoid: 'Rectangle' };
type AvoidConnEnd = { readonly __avoid: 'ConnEnd' };
type AvoidShapeRef = { readonly __avoid: 'ShapeRef' };
/**
 * A pin on a shape's boundary. OWNED BY ITS SHAPEREF: the shape frees its pins,
 * and destroying one ourselves double-frees (spike caveat 4) — so it is not in
 * {@link AvoidApi.destroy}'s union.
 */
interface AvoidShapeConnectionPin {
  readonly __avoid: 'ShapeConnectionPin';
  /**
   * A fresh pin is EXCLUSIVE: one connector may use it, and a second asking for
   * the same class id silently degrades to the shape's centre with only a
   * stderr warning to show for it (spike caveat 2). Always cleared.
   */
  setExclusive(exclusive: boolean): void;
  isExclusive(): boolean;
  directions(): number;
}

/**
 * Routing parameter and option ids, branded because at runtime they are small
 * integers drawn from two DIFFERENT enums that overlap. Measured collisions:
 * `shapeBufferDistance = 6` and `nudgeSharedPathsWithCommonEndPoint = 6`;
 * `segmentPenalty = 0` and `nudgeOrthogonalSegmentsConnectedToShapes = 0`. Pass a
 * parameter id where an option id belongs and libavoid silently configures a
 * different knob — no error anywhere, the routes just quietly get worse. As bare
 * `number`s the compiler could not tell us; branded, it can.
 */
type RoutingParameterId = number & { readonly __avoid: 'RoutingParameter' };
type RoutingOptionId = number & { readonly __avoid: 'RoutingOption' };

interface AvoidConnRef {
  displayRoute(): AvoidPolyLine;
}

interface AvoidRouter {
  processTransaction(): void;
  setRoutingParameter(parameter: RoutingParameterId, value: number): void;
  setRoutingOption(option: RoutingOptionId, value: boolean): void;
}

interface AvoidApi {
  readonly OrthogonalRouting: number;
  readonly shapeBufferDistance: RoutingParameterId;
  readonly idealNudgingDistance: RoutingParameterId;
  readonly nudgeOrthogonalSegmentsConnectedToShapes: RoutingOptionId;
  readonly nudgeSharedPathsWithCommonEndPoint: RoutingOptionId;
  readonly performUnifyingNudgingPreprocessingStep: RoutingOptionId;
  readonly Router: new (flags: number) => AvoidRouter;
  readonly Point: new (x: number, y: number) => AvoidPoint;
  /** Two-argument form is (topLeft, bottomRight) — NOT (centre, width). */
  readonly Rectangle: new (topLeft: AvoidPoint, bottomRight: AvoidPoint) => AvoidRectangle;
  readonly ShapeRef: new (router: AvoidRouter, shape: AvoidRectangle) => AvoidShapeRef;
  /**
   * Visibility directions for a pin, a bitmask (`Up 1, Down 2, Left 4, Right 8`).
   * Present at runtime, absent from the shipped typings (`ConnDirFlags` is
   * declared empty).
   */
  readonly ConnDirUp: number;
  readonly ConnDirDown: number;
  readonly ConnDirLeft: number;
  readonly ConnDirRight: number;
  /**
   * A free end at a point, or an end on a shape's pin of class `classId`. There is
   * DELIBERATELY no `(point, visDirs)` overload: the binding dispatches every
   * two-argument call to the `(ShapeRef, classId)` C++ overload, so passing a
   * point there reinterprets it as a shape and aborts the WASM module for the
   * rest of the session (spike verdict a). Pin the shape instead.
   */
  readonly ConnEnd: {
    new (point: AvoidPoint): AvoidConnEnd;
    new (shape: AvoidShapeRef, classId: number): AvoidConnEnd;
  };
  /**
   * The 7-argument form only. `proportional: true` puts the pin at fractions of
   * the shape's size (`0..1`); the 6-argument form is proportional as well but
   * undocumented, and the 4- and 5-argument forms throw a `ReferenceError` out of
   * the glue code (spike, typing mismatch 4).
   */
  readonly ShapeConnectionPin: new (
    shape: AvoidShapeRef,
    classId: number,
    xOffset: number,
    yOffset: number,
    proportional: boolean,
    insideOffset: number,
    visDirs: number,
  ) => AvoidShapeConnectionPin;
  readonly ConnRef: new (
    router: AvoidRouter,
    source: AvoidConnEnd,
    target: AvoidConnEnd,
  ) => AvoidConnRef;
  /**
   * Free a C++ object we own. Typed as the union of the owned handles rather than
   * `object`, so passing something borrowed — an {@link AvoidRoutePoint}, or the
   * ShapeRef and ConnRef the Router owns — does not compile.
   */
  destroy(obj: AvoidPoint | AvoidRectangle | AvoidConnEnd | AvoidRouter): void;
}

// ── WASM lifecycle ──────────────────────────────────────────────────────────

let wasmUrl: string | undefined;
let loaded: Promise<AvoidApi> | undefined;

/**
 * Set once the WASM module has actually ABORTED, and never cleared.
 *
 * An emscripten `abort()` is not a recoverable error: the instance stays dead,
 * every later call throws the raw string "program has already aborted!",
 * `AvoidLib.load()` refuses to re-initialise, and libavoid-js offers no way to
 * obtain a fresh instance. Only a page reload recovers. So rather than re-entering
 * a corpse and handing the caller that opaque string over and over, we fail fast
 * with something a developer reading the console can act on.
 *
 * Gated on {@link isWasmAbort} and NOT on "something threw", which is a distinction
 * with teeth: a missing constructor after a libavoid-js version bump throws a
 * `TypeError` without any code entering libavoid's router, and a `destroy` that
 * fails after a route already succeeded leaves the module perfectly healthy.
 * Latching on those would take out routing for the whole session and blame a crash
 * that never happened.
 */
let poisoned = false;

const UNAVAILABLE =
  'Edge routing is unavailable for the rest of this session: the libavoid WASM module ' +
  'aborted and cannot be re-initialised. Reload the page to restore automatic routing.';

/**
 * Whether `error` is evidence that the WASM module aborted, as opposed to any other
 * failure that happens to pass through this adapter.
 *
 * Both known abort paths — the `processEventVert` assert on a NaN endpoint and the
 * `LineSegment` assert on huge coordinates — throw the raw **string**
 * "program has already aborted!" even on the very first throw. The descriptive
 * `Aborted(Assertion failed: begin < finish, at: ...orthogonal.cpp,665,LineSegment)`
 * text goes to the console via emscripten's own logger; it is not the thrown value.
 * Verified in a fresh process per trigger, since only the first throw is informative.
 *
 * The `Aborted` prefix is still matched because a browser build configured to throw
 * rather than log would surface it that way, and a false negative here is cheap and
 * self-correcting: we would rethrow, the next call would hit the dead module, and
 * that call would get the string and latch.
 */
function isWasmAbort(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.includes('program has already aborted!') || message.startsWith('Aborted');
}

/**
 * Point the loader at the `libavoid.wasm` asset.
 *
 * Browsers need this because the browser build cannot resolve the file from disk —
 * NOT because the name is hashed. hal_app deliberately publishes it unhashed at the
 * stable path `/libavoid.wasm` (see `hal_app/vite.config.ts`) so that an end user
 * can substitute their own build of libavoid, which is what LGPL-2.1 compliance
 * rests on here. node/vitest need no URL at all: the node entry point finds the
 * file next to itself, verified under both the `node` and `jsdom` environments.
 *
 * Call before the first {@link routeWithLibavoid}: libavoid-js loads once per page
 * and offers no way to reload, so a call made afterwards has no effect.
 */
export function configureLibavoidWasm(url: string): void {
  wasmUrl = url;
}

// ── the worker transport ────────────────────────────────────────────────────

let workerFactory: (() => Worker) | undefined;

/**
 * Hand the package a way to construct the routing worker.
 *
 * **Absent, everything routes in-process exactly as before**, which is what keeps
 * vitest, node and any non-Vite consumer working unchanged and the package
 * bundler-agnostic. Constructing a worker is inherently bundler-specific — Vite
 * wants `?worker` or a literal `new URL(..., import.meta.url)` — so the package
 * takes a factory rather than a URL and stays a plain function with no HAL types
 * in it, mirroring {@link configureLibavoidWasm}.
 *
 * Why bother: `processTransaction()` is synchronous WASM with no timeout and no
 * cancellation, so on the main thread a slow board is a frozen tab rather than a
 * slow spinner. Off-thread it is neither, and two things become possible that are
 * not otherwise: a superseded pass can be **cancelled** by terminating the worker,
 * and an emscripten `abort()` — which permanently poisons routing for the page —
 * kills a worker we can simply replace.
 */
export function configureLibavoidWorker(factory: () => Worker): void {
  workerFactory = factory;
}

/** Main → worker. `wasmUrl` travels because module state does not cross threads. */
export interface RouterWorkerRequest {
  id: number;
  input: RouterInput;
  wasmUrl?: string;
}

/** Worker → main. Routes come back as entries because a Map survives structured
 *  clone but entries keep the contract explicit and debuggable in DevTools. */
export type RouterWorkerResponse =
  | { id: number; ok: true; routes: [string, Point[]][]; skipped: SkippedTier[] }
  | { id: number; ok: false; message: string };

interface PendingRequest {
  resolve(result: RouterResult): void;
  reject(error: unknown): void;
}

let worker: Worker | undefined;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

/**
 * Tear the routing worker down, failing every request still in flight.
 *
 * Called on a worker-level error, and available to a caller that wants to abandon
 * a superseded pass rather than wait for it. The next route request builds a fresh
 * worker, which is the recovery an in-process abort does not have.
 */
export function terminateLibavoidWorker(reason = 'The routing worker was stopped.'): void {
  worker?.terminate();
  worker = undefined;
  const inFlight = [...pending.values()];
  pending.clear();
  for (const request of inFlight) request.reject(new Error(reason));
}

function ensureWorker(factory: () => Worker): Worker {
  if (worker) return worker;
  const created = factory();
  created.onmessage = (event: MessageEvent<RouterWorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return; // superseded and already settled
    pending.delete(response.id);
    if (response.ok) request.resolve({ routes: new Map(response.routes), skipped: response.skipped });
    else request.reject(new Error(response.message));
  };
  // A worker-level error (the module failed to load, or the WASM aborted and took
  // the thread with it) is not recoverable for THIS worker but is for the next
  // one, so drop it rather than leaving callers hanging on a dead thread.
  created.onerror = () => terminateLibavoidWorker('The routing worker failed. Try again.');
  worker = created;
  return created;
}

function routeInWorker(factory: () => Worker, input: RouterInput): Promise<RouterResult> {
  const target = ensureWorker(factory);
  const id = nextRequestId++;
  return new Promise<RouterResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: RouterWorkerRequest = { id, input, wasmUrl };
    target.postMessage(request);
  });
}

/**
 * The loaded library. Imported dynamically so the emscripten glue and its WASM
 * land in their own chunk instead of the app's main bundle — the same reason
 * `elkLayout.ts` lazy-imports ELK. Concurrent callers share ONE load (the promise
 * is cached, not a boolean flag); a failed load is not cached, so a later call can
 * retry.
 */
async function loadAvoid(): Promise<AvoidApi> {
  loaded ??= import('libavoid-js')
    .then(async ({ AvoidLib }) => {
      await AvoidLib.load(wasmUrl);
      return AvoidLib.getInstance() as unknown as AvoidApi;
    })
    .catch((error: unknown) => {
      loaded = undefined;
      throw error;
    });
  return loaded;
}

// ── planning: canonical order and the two tiers ──────────────────────────────

/**
 * An obstacle of one tier. `id` is set for a NODE rect — the thing a pinned end
 * needs a `ShapeRef` for — and absent for a group box, which nothing attaches to.
 */
interface TierObstacle {
  id?: ElementId;
  rect: Rect;
}

/** A connector of one tier: the ids for pinning, the centres for free ends. */
interface TierConnector {
  id: string;
  sourceId: ElementId;
  targetId: ElementId;
  source: Point;
  target: Point;
  sourceSide?: AttachSide;
  targetSide?: AttachSide;
}

/** One router's worth of work: obstacles and connectors, both in final order. */
interface RoutingTier {
  obstacles: TierObstacle[];
  connectors: TierConnector[];
}

/** The tiers to run, plus the ones refused for being over the cap. */
interface RoutingPlan {
  tiers: RoutingTier[];
  skipped: SkippedTier[];
}

/**
 * Locale-independent ascending order. `localeCompare` is deliberately avoided:
 * it varies with ICU data and platform, and route geometry must not.
 */
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Groups sort by name; the rect breaks ties so the order stays total even if two
 *  boxes somehow share a name. */
const compareGroups = (a: DomainGroupRect, b: DomainGroupRect): number =>
  compareText(a.name, b.name) ||
  a.x - b.x ||
  a.y - b.y ||
  a.width - b.width ||
  a.height - b.height;

const rectOf = (group: DomainGroupRect): Rect => ({
  x: group.x,
  y: group.y,
  width: group.width,
  height: group.height,
});

/**
 * Largest coordinate magnitude we hand to libavoid. Boards are ~1680x1040, so this
 * leaves about four orders of magnitude of headroom.
 *
 * Measured by translating a whole board to magnitude M and comparing the routes:
 *
 * | M            | result                                                    |
 * | ------------ | --------------------------------------------------------- |
 * | up to 1e16   | correct                                                   |
 * | 1e17         | geometry drifts                                           |
 * | 1e18         | geometry WRONG but finite — silent garbage, no crash       |
 * | 1e19 and up  | ABORT in `LineSegment` on `assert begin < finish`          |
 *
 * The band that matters is 1e17–1e18: a full order of magnitude BELOW any abort,
 * where libavoid returns plausible finite numbers that are simply wrong. A cap
 * chosen to sit just under the abort threshold would have sat inside it. 1e7 is
 * far below the silent band, which is the whole point of the number.
 */
const MAX_COORDINATE = 1e7;

/**
 * Whether a rect is safe to hand to the WASM module.
 *
 * This guard is NOT defensive politeness — it is the difference between a bad
 * diagram and a dead editor. libavoid is C++ compiled through emscripten, and its
 * internal `assert`s become `abort()`. An abort does surface to JS as a thrown
 * error, but it kills the WASM instance **permanently**: every later call throws
 * "program has already aborted!", `AvoidLib.load()` refuses to re-initialise
 * ("Avoid library is already initialized"), and there is no API to get a fresh
 * instance. So a single non-finite coordinate would disable edge routing for the
 * whole page session until the user reloads.
 *
 * Measured failure modes for the inputs a real diagram can produce:
 *
 * | input                        | result                                   |
 * | ---------------------------- | ---------------------------------------- |
 * | endpoint x or y = NaN        | ABORT (`processEventVert`) — module dead  |
 * | obstacle x or y = NaN        | ABORT (`processEventHori`/`Vert`)         |
 * | obstacle width/height = NaN  | survives, but silently ignores the shape  |
 * | endpoint x or y = +/-Inf     | survives, and RETURNS Infinity in the route — it would be persisted as a waypoint |
 * | coordinates >= 1e19          | ABORT (`LineSegment`)                     |
 * | coordinates 1e17..1e18       | survives, geometry silently wrong          |
 *
 * The last two rows are why this checks magnitude as well as finiteness, and the
 * Infinity row is why it checks finiteness rather than just NaN: neither of those
 * crashes, they quietly write garbage geometry into the saved model.
 */
function isSafeRect(rect: Rect): boolean {
  const values = [rect.x, rect.y, rect.width, rect.height];
  return values.every((v) => Number.isFinite(v) && Math.abs(v) <= MAX_COORDINATE);
}

/** Whether `outer` covers every point of `inner` (shared edges count as covered). */
const containsRect = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/**
 * The same obstacles, minus any rect fully covered by another rect in the list.
 *
 * A contained obstacle makes its CONTAINER stop blocking — the failure two-tier
 * routing exists to prevent, reappearing inside a single tier. Measured on a box
 * nested in a bigger box, with a left-to-right edge crossing both: with only the
 * outer box present the edge clears it at y=284; add the nested inner box and the
 * edge routes at y=536, which is *inside* the outer box. It dodges the inner rect
 * and treats the outer one as air. Same result for a node rect containing a
 * smaller node rect.
 *
 * Containment is the ONLY trigger, which is what makes this fix cheap and precise:
 * a partial-overlap sweep (a chip crossing a box at 4 heights x 27 offsets, a chip
 * engulfing a box, two partly overlapping boxes, two boxes sharing an edge exactly)
 * found every one of them still blocking correctly.
 *
 * Dropping the inner rect is safe by geometry, not by luck: the container covers
 * every point the contained rect covered, so nothing that was blocked becomes
 * reachable. Identical rects are the case to be careful with — they cover each
 * other, they do still block (measured), and dropping BOTH would open a real hole,
 * so the `j < i` tie-break keeps exactly one copy. Order within the list must not
 * matter either: the container can sort after the rect it contains (group boxes are
 * name-sorted, so an "Inner" box precedes the "Outer" one that swallows it).
 *
 * Reachable from ordinary user data: group boxes are draggable and resizable into
 * each other, a card can be dragged over a chip while both are ungrouped in tier 1,
 * and two members of one group can overlap in tier 2. A nested group keeps its own
 * tier-2 router either way, so only its redundant box in tier 1 is affected.
 */
function withoutContainedRects<T extends { rect: Rect }>(obstacles: T[]): T[] {
  return obstacles.filter(
    (inner, i) =>
      !obstacles.some((outer, j) => {
        if (j === i || !containsRect(outer.rect, inner.rect)) return false;
        // Covering each other means they are identical; keep the first copy only.
        return !containsRect(inner.rect, outer.rect) || j < i;
      }),
  );
}

/**
 * The tiers to run, everything already in canonical order — pure, so insertion
 * order is fully decided before any WASM object exists.
 *
 * Skipped connections get no entry in the result at all (rather than an empty
 * "straight" route), which lets the caller keep whatever route it had stored:
 * an endpoint that is not on this diagram, and a self-connection, which has no
 * meaningful orthogonal route between a point and itself.
 */
function planTiers(input: RouterInput): RoutingPlan {
  // Drop unsafe geometry BEFORE anything reaches the WASM module — see
  // {@link isSafeRect}. What dropping the whole NODE buys is narrow, and worth being
  // precise about: its connections then come back absent, so the caller keeps its
  // stored routes instead of receiving one computed from a NaN centre. It does NOT
  // keep other edges away from the node — the drop removes it from the obstacle list
  // too, so an edge may now run straight through a card that is still on screen.
  // That is the accepted cost; a route derived from NaN is the worse outcome.
  // (For width/height = NaN the two options are indistinguishable anyway: libavoid
  // ignores such a shape as an obstacle regardless. Only x/y = NaN would abort.)
  const groups = input.groups.filter((g) => isSafeRect(rectOf(g))).sort(compareGroups);
  const safeNodes = input.nodes.filter((n) => isSafeRect(n.rect));
  const groupNames = new Set(groups.map((g) => g.name));
  const nodes = new Map(safeNodes.map((n) => [n.id, n]));
  // A `domainGroup` with no box on the diagram cannot stand in for its members,
  // so those nodes count as ungrouped and go into tier 1 as their own obstacles.
  const groupOf = (id: ElementId): string | undefined => {
    const group = nodes.get(id)?.domainGroup;
    return group !== undefined && groupNames.has(group) ? group : undefined;
  };
  const centreOf = (id: ElementId): Point => rectCentre(nodes.get(id)!.rect);
  const connectorFor = (connection: RouterConnection): TierConnector => ({
    id: connection.id,
    sourceId: connection.sourceId,
    targetId: connection.targetId,
    source: centreOf(connection.sourceId),
    target: centreOf(connection.targetId),
    sourceSide: connection.sourceSide,
    targetSide: connection.targetSide,
  });
  const asObstacle = (node: RouterNode): TierObstacle => ({ id: node.id, rect: node.rect });
  const boxOf = (group: DomainGroupRect): TierObstacle => ({ rect: rectOf(group) });

  const routable = input.connections
    .filter((c) => c.sourceId !== c.targetId && nodes.has(c.sourceId) && nodes.has(c.targetId))
    .sort((a, b) => compareText(a.id, b.id));
  // Obstacle order, unlike connector order, is DEFENSIVE only: measured across four
  // permutations of five obstacles with four edges competing for channels past them,
  // every permutation produced byte-identical routes. Kept anyway — it costs nothing
  // and libavoid makes no documented promise here. Deliberately NOT covered by a
  // test: such a test would assert libavoid's behaviour, not ours, and could not
  // fail if we dropped the sort. The CONNECTOR sort is the load-bearing one, and
  // that one is guarded (remove it and two determinism tests go red).
  const byId = (a: RouterNode, b: RouterNode): number => compareText(a.id, b.id);

  const tiers: RoutingTier[] = [];

  const ungrouped = safeNodes.filter((n) => groupOf(n.id) === undefined).sort(byId);

  // Tier 1 — inter-group: every group is one opaque box, plus the ungrouped nodes.
  const interGroup = routable.filter((c) => {
    const source = groupOf(c.sourceId);
    return source === undefined || source !== groupOf(c.targetId);
  });
  if (interGroup.length > 0) {
    tiers.push({
      obstacles: withoutContainedRects([...groups.map(boxOf), ...ungrouped.map(asObstacle)]),
      connectors: interGroup.map(connectorFor),
    });
  }

  // Tier 2 — one router per group, for that group's internal edges.
  //
  // The obstacles are that group's members plus EVERYTHING OUTSIDE the box: the
  // other groups as opaque boxes, and the ungrouped nodes. Nothing confines a route
  // to the box it belongs to, and it does not take a contrived board to leave one:
  // `GROUP_PAD` is 28px and `ROUTE_CLEARANCE` is 16, so a member spanning most of
  // the box leaves room for exactly one channel beside it, and the second parallel
  // edge is nudged `IDEAL_NUDGING_DISTANCE` further out and lands outside by
  // construction. With only the members in the set, that edge is routed blind and
  // can be drawn straight through a neighbouring card.
  //
  // The group's OWN box is the one rect that must stay out. It contains its members,
  // and a container that swallows another obstacle stops blocking at all — the
  // single failure mode the two tiers exist to avoid (see {@link withoutContainedRects}).
  // Every rect added here sits outside the box instead, so it neither contains a
  // member nor is contained by one.
  for (const group of groups) {
    const intraGroup = routable.filter(
      (c) => groupOf(c.sourceId) === group.name && groupOf(c.targetId) === group.name,
    );
    if (intraGroup.length === 0) continue;
    const members = safeNodes.filter((n) => groupOf(n.id) === group.name).sort(byId);
    const outside = [
      ...groups.filter((g) => g.name !== group.name).map(boxOf),
      ...ungrouped.map(asObstacle),
    ];
    tiers.push({
      obstacles: withoutContainedRects([...members.map(asObstacle), ...outside]),
      connectors: intraGroup.map(connectorFor),
    });
  }
  // Drop over-budget tiers rather than freezing the tab on them — see
  // {@link MAX_CONNECTORS_PER_TIER}. Per TIER, not per board: tier 1 being too
  // crowded does not stop each group's internal edges from routing.
  //
  // Dropped tiers are REPORTED, not merely filtered. Their connections come back
  // absent from the result map, which is indistinguishable from "nothing needed
  // routing" — so without this the caller cannot tell a refusal from a no-op.
  const runnable: RoutingTier[] = [];
  const skipped: SkippedTier[] = [];
  for (const tier of tiers) {
    if (tier.connectors.length <= MAX_CONNECTORS_PER_TIER) {
      runnable.push(tier);
      continue;
    }
    skipped.push({
      connectorCount: tier.connectors.length,
      connectionIds: tier.connectors.map((c) => c.id),
    });
  }
  return { tiers: runnable, skipped };
}

// ── one router pass ─────────────────────────────────────────────────────────

function newRouter(avoid: AvoidApi): AvoidRouter {
  const router = new avoid.Router(avoid.OrthogonalRouting);
  router.setRoutingParameter(avoid.shapeBufferDistance, ROUTE_CLEARANCE);
  router.setRoutingParameter(avoid.idealNudgingDistance, IDEAL_NUDGING_DISTANCE);
  router.setRoutingOption(avoid.nudgeOrthogonalSegmentsConnectedToShapes, true);
  router.setRoutingOption(avoid.nudgeSharedPathsWithCommonEndPoint, true);
  router.setRoutingOption(avoid.performUnifyingNudgingPreprocessingStep, true);
  return router;
}

/**
 * Add `rect` as an obstacle and hand back its ShapeRef, which the ROUTER owns (we
 * never destroy it) and which a pinned end needs to hang its pin on. libavoid
 * copies the polygon into the ShapeRef, so the C++ objects we built it from can be
 * freed immediately (verified: identical routes and a flat WASM heap over 4000
 * runs). Their JS wrappers are a separate matter and stay in libavoid-js's pointer
 * cache — see the note above the type declarations.
 */
function addObstacle(avoid: AvoidApi, router: AvoidRouter, rect: Rect): AvoidShapeRef {
  const topLeft = new avoid.Point(rect.x, rect.y);
  const bottomRight = new avoid.Point(rect.x + rect.width, rect.y + rect.height);
  const rectangle = new avoid.Rectangle(topLeft, bottomRight);
  const shape = new avoid.ShapeRef(router, rectangle);
  avoid.destroy(rectangle);
  avoid.destroy(bottomRight);
  avoid.destroy(topLeft);
  return shape;
}

/**
 * Pin class ids per side — OUR integers, fixed, `>= 1` (`CONNECTIONPIN_UNSET` and
 * `_CENTRE` are not exported and would collide at 0). Fixed rather than minted, so
 * two connections asking for one side share one pin and the ids are the same on
 * every run — the determinism invariant does not get a second key to worry about.
 */
const PIN_CLASS: Record<AttachSide, number> = { top: 1, right: 2, bottom: 3, left: 4 };

/** Where on the shape a side's pin sits, as fractions of its width and height. */
const PIN_OFFSET: Record<AttachSide, { x: number; y: number }> = {
  top: { x: 0.5, y: 0 },
  right: { x: 1, y: 0.5 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
};

/** The one direction a side's pin is visible in — outward, so the line leaves square. */
function pinDirection(avoid: AvoidApi, side: AttachSide): number {
  switch (side) {
    case 'top':
      return avoid.ConnDirUp;
    case 'right':
      return avoid.ConnDirRight;
    case 'bottom':
      return avoid.ConnDirDown;
    case 'left':
      return avoid.ConnDirLeft;
  }
}

/** The point on `rect`'s boundary a side's pin would sit at — the free-end fallback. */
function sideMidpoint(rect: Rect, side: AttachSide): Point {
  const offset = PIN_OFFSET[side];
  return { x: rect.x + rect.width * offset.x, y: rect.y + rect.height * offset.y };
}

/**
 * The shapes of one tier by element id, with the pins created on them so far.
 * Pins are made LAZILY — only for a side some connection actually asks for — and
 * once per (shape, side), so two connectors on one side share the pin; that is
 * what `setExclusive(false)` is for, since a fresh pin admits one connector only
 * (spike caveat 2). Every `ConnEnd(shape, classId)` this module builds goes
 * through {@link TierShapes.pin}, so an end can never name a class id its shape
 * has no pin for — the other silent centre fallback (caveat 3).
 */
class TierShapes {
  private readonly shapes = new Map<ElementId, AvoidShapeRef>();
  private readonly pinned = new Set<string>();

  constructor(private readonly avoid: AvoidApi) {}

  add(id: ElementId, shape: AvoidShapeRef): void {
    this.shapes.set(id, shape);
  }

  /** The shape for `id`, if this tier holds one (a grouped node in tier 1 does not). */
  get(id: ElementId): AvoidShapeRef | undefined {
    return this.shapes.get(id);
  }

  /** The class id of `shape`'s pin on `side`, creating the pin on first use. */
  pin(id: ElementId, shape: AvoidShapeRef, side: AttachSide): number {
    const key = `${id} ${side}`;
    if (!this.pinned.has(key)) {
      const { x, y } = PIN_OFFSET[side];
      const pin = new this.avoid.ShapeConnectionPin(
        shape,
        PIN_CLASS[side],
        x,
        y,
        /* proportional */ true,
        /* insideOffset */ 0,
        pinDirection(this.avoid, side),
      );
      pin.setExclusive(false);
      this.pinned.add(key);
    }
    return PIN_CLASS[side];
  }
}

/** One end of a connector: the ConnEnd, the point we own for it (if any), and whether its endpoint is kept. */
interface BuiltEnd {
  end: AvoidConnEnd;
  point: AvoidPoint | undefined;
  pinned: boolean;
}

/**
 * Build one end. No side: a free end at the node's centre, as always. A side and a
 * shape in this tier: a pinned end on that side. A side but no shape (the node is
 * inside a group box that stands in for it): a free end AT the side's midpoint —
 * the attachment lands on the requested side and the endpoint is kept like a
 * pinned one, but which way the line leaves is then the router's choice.
 */
function buildEnd(
  avoid: AvoidApi,
  shapes: TierShapes,
  nodeId: ElementId,
  centre: Point,
  side: AttachSide | undefined,
  rectOfNode: (id: ElementId) => Rect | undefined,
): BuiltEnd {
  if (side !== undefined) {
    const shape = shapes.get(nodeId);
    if (shape) {
      return { end: new avoid.ConnEnd(shape, shapes.pin(nodeId, shape, side)), point: undefined, pinned: true };
    }
    const rect = rectOfNode(nodeId);
    if (rect) {
      const at = sideMidpoint(rect, side);
      const point = new avoid.Point(at.x, at.y);
      return { end: new avoid.ConnEnd(point), point, pinned: true };
    }
  }
  const point = new avoid.Point(centre.x, centre.y);
  return { end: new avoid.ConnEnd(point), point, pinned: false };
}

/** Add a connector: free ends at the node centres, or pinned ends on the requested sides. */
function addConnector(
  avoid: AvoidApi,
  router: AvoidRouter,
  shapes: TierShapes,
  connector: TierConnector,
  rectOfNode: (id: ElementId) => Rect | undefined,
): { ref: AvoidConnRef; keepStart: boolean; keepEnd: boolean } {
  const source = buildEnd(avoid, shapes, connector.sourceId, connector.source, connector.sourceSide, rectOfNode);
  const target = buildEnd(avoid, shapes, connector.targetId, connector.target, connector.targetSide, rectOfNode);
  const ref = new avoid.ConnRef(router, source.end, target.end);
  // ConnEnds may be freed right after the ConnRef is built — verified in the spike,
  // route unchanged — and so may the points, as before.
  avoid.destroy(target.end);
  avoid.destroy(source.end);
  if (target.point) avoid.destroy(target.point);
  if (source.point) avoid.destroy(source.point);
  return { ref, keepStart: source.pinned, keepEnd: target.pinned };
}

/**
 * The route minus its endpoints — see the "interior waypoints only" note above —
 * or `undefined` when libavoid handed back a route we refuse to trust.
 *
 * A non-finite coordinate ANYWHERE in the polyline condemns the whole route, and
 * the caller then leaves the connection absent from the result so the stored route
 * survives. Two deliberate choices in that sentence:
 *
 * - **Anywhere**, endpoints included, even though the endpoints are stripped. The
 *   measured `Infinity` case is exactly `[[Infinity, 120], [400, 120]]`: an empty
 *   interior, which would read as the confident claim "routed, and straight".
 * - **The whole route**, not the good points from it. A polyline with a hole in it
 *   would be drawn as a wrong-but-plausible path and then persisted; no route at
 *   all merely leaves the diagram as the user last had it.
 *
 * A polyline of fewer than two points is refused for the same reason. It has no
 * endpoints to strip, so it too would come back as an empty interior and read as
 * "routed, and straight" — and under Tidy's `'clear'` policy that answer discards
 * whatever route was stored. Every route we trust has at least two ends.
 *
 * `isSafeRect` should make this unreachable, so this is defence in depth. It gets
 * the extra layer because it is the one failure mode that corrupts saved customer
 * data instead of crashing loudly.
 *
 * `keepStart` / `keepEnd` mark a PINNED end: its endpoint is the attachment point
 * on the node's boundary, which the renderer cannot re-derive from the next
 * waypoint alone, so it stays as the first/last waypoint. The guards above are
 * unchanged by it — a pinned route of fewer than two points is refused too.
 */
function interiorWaypoints(
  connector: AvoidConnRef,
  keepStart = false,
  keepEnd = false,
): Point[] | undefined {
  const route = connector.displayRoute();
  const size = route.size();
  if (size < 2) return undefined;
  const waypoints: Point[] = [];
  for (let i = 0; i < size; i++) {
    const point = route.get_ps(i);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
    const isStart = i === 0;
    const isEnd = i + 1 === size;
    if ((!isStart || keepStart) && (!isEnd || keepEnd)) {
      waypoints.push({ x: rounded(point.x), y: rounded(point.y) });
    }
  }
  return waypoints;
}

/**
 * Two decimals. libavoid emits accumulated floating-point noise (`617.99999988`,
 * `677.9999996800001`); against `ROUTE_CLEARANCE` of 16 px those digits mean
 * nothing, but they get persisted, bloat the stored JSON, and make any value-based
 * dirty check see a change on every re-route — which is what drives autosave.
 *
 * Applied only AFTER the finiteness check above, and it cannot reintroduce a
 * non-finite value: `x * 100` overflows to Infinity for |x| above ~1.8e306, so the
 * fallback returns the input untouched rather than emitting Infinity. Unreachable
 * in practice given {@link MAX_COORDINATE}, but the point of that check is not to
 * depend on the reasoning of the check before it.
 */
function rounded(value: number): number {
  const result = Math.round(value * 100) / 100;
  return Number.isFinite(result) ? result : value;
}

function runTier(
  avoid: AvoidApi,
  tier: RoutingTier,
  rectOfNode: (id: ElementId) => Rect | undefined,
  into: Map<string, Point[]>,
): void {
  const router = newRouter(avoid);
  try {
    // Obstacles go in in their canonical order; the node ones are remembered by id
    // so a pinned end can find its shape. The map is deterministic because that
    // order is.
    const shapes = new TierShapes(avoid);
    for (const obstacle of tier.obstacles) {
      const shape = addObstacle(avoid, router, obstacle.rect);
      if (obstacle.id !== undefined) shapes.add(obstacle.id, shape);
    }
    const connectors = tier.connectors.map((c) => ({
      id: c.id,
      ...addConnector(avoid, router, shapes, c, rectOfNode),
    }));
    router.processTransaction();
    for (const { id, ref, keepStart, keepEnd } of connectors) {
      const waypoints = interiorWaypoints(ref, keepStart, keepEnd);
      if (waypoints !== undefined) into.set(id, waypoints);
    }
  } catch (error: unknown) {
    // Freeing the router after an abort aborts again, and a `finally` would let
    // that second failure replace the diagnostic that explains what actually
    // happened. Try anyway — the WASM instance is dead either way — but never at
    // the cost of the original error.
    try {
      avoid.destroy(router);
    } catch {
      // Deliberately ignored: `error` below is the useful one.
    }
    throw error;
  }
  // Destroying the Router frees the ShapeRefs and ConnRefs it owns; doing that
  // ourselves double-frees and aborts the WASM module (verified both ways — the WASM
  // heap stays flat over 4000 routing runs, and the explicit version dies).
  // Not in a `finally`, and NOT swallowed here: on the happy path a failure to
  // free is a real leak and must be heard.
  avoid.destroy(router);
}

/**
 * Route on THIS thread. The worker calls this too — see {@link routeWithLibavoid}
 * — so it is the one implementation either path ends up in.
 *
 * Interior waypoints per connection id, keyed the way the caller keyed its
 * connections. A connection is absent from `routes` when it could not be routed:
 * an unknown endpoint, a self-connection, unsafe geometry ({@link isSafeRect}), a
 * tier over {@link MAX_CONNECTORS_PER_TIER}, or a route that came back non-finite.
 * An entry with an EMPTY array means "routed, and straight". Only the over-cap
 * case is separately reportable, via `skipped` — the others are per-connection
 * facts the caller can already see for itself.
 *
 * Rejects — rather than returning partial routes — if the WASM module fails, and
 * every later call rejects the same way; see {@link poisoned}.
 */
export async function routeWithLibavoidInProcess(input: RouterInput): Promise<RouterResult> {
  if (poisoned) throw new Error(UNAVAILABLE);
  const routes = new Map<string, Point[]>();
  const { tiers, skipped } = planTiers(input);
  if (tiers.length === 0) return { routes, skipped }; // nothing runnable: don't load the WASM
  const avoid = await loadAvoid();
  // For a pinned end whose node this tier holds no shape for (see `buildEnd`).
  const nodeRects = new Map(input.nodes.map((n) => [n.id, n.rect]));
  const rectOfNode = (id: ElementId) => nodeRects.get(id);
  for (const tier of tiers) {
    try {
      runTier(avoid, tier, rectOfNode, routes);
    } catch (error: unknown) {
      // Only a genuine abort is terminal. Anything else — a version bump that
      // removed a constructor, a bug of ours — propagates exactly as thrown, so it
      // is debuggable as itself and does not cost the session its edge routing.
      if (!isWasmAbort(error)) throw error;
      poisoned = true;
      // An abort throws the raw STRING "program has already aborted!", not an
      // Error, so anything downstream reading `.message` would see `undefined`.
      // Normalise before wrapping, and keep the original as `cause`.
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${UNAVAILABLE} (${detail})`, { cause: error });
    }
  }
  return { routes, skipped };
}

/**
 * Route a board: in a Web Worker when the host has configured one
 * ({@link configureLibavoidWorker}), on this thread otherwise.
 *
 * The two paths run identical code — the worker's body calls
 * {@link routeWithLibavoidInProcess} — so this is a transport choice and nothing
 * more. No caller needs to know which one it got.
 */
export async function routeWithLibavoid(input: RouterInput): Promise<RouterResult> {
  const factory = workerFactory;
  if (!factory) return routeWithLibavoidInProcess(input);
  return routeInWorker(factory, input);
}
