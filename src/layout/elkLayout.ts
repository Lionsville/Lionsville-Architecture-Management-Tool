import type { ELK as ElkEngine, ElkExtendedEdge, ElkNode } from 'elkjs';

/**
 * Thin ELK wrapper (ported from the POC). The engine is imported lazily so the
 * ~1.4 MB of it only loads when the user hits "Tidy".
 *
 * ELK is a PLACEMENT engine here, not a router. It used to hand back its computed
 * bendpoints too and `tidy.ts` persisted them as edge waypoints, but libavoid routes
 * every edge now (see `layout/libavoidRouter.ts`), so the bendpoints are no longer
 * collected. The edges and their label sizes are still fed IN — see
 * {@link ElkEdgeSpec} and the `elk.edgeRouting` option — because they are what makes
 * ELK reserve the channel space those routes need.
 */

// ── where the layout runs, and how to stop it ───────────────────────────────

let workerFactory: (() => Worker) | undefined;

/**
 * Hand the layout a way to construct the ELK worker.
 *
 * **Absent, everything lays out in-process exactly as before**, which is what
 * keeps vitest, node and any non-Vite consumer working unchanged. Constructing
 * a worker is bundler-specific — Vite wants `?worker` or a literal
 * `new URL(..., import.meta.url)` — so this takes a factory rather than a URL,
 * mirroring {@link configureLibavoidWorker} exactly.
 *
 * Why bother: ELK's layered algorithm is synchronous, has no progress and no
 * timeout, and its cost grows steeply — a hundred boxes lay out in about a
 * seventh of a second and three hundred take five seconds. On this thread that
 * is five seconds of frozen window with a spinner that cannot animate; beside
 * it, it is five seconds a person can watch and cancel.
 */
export function configureElkWorker(factory: () => Worker): void {
  workerFactory = factory;
}

/**
 * How many boxes one pass will lay out.
 *
 * Not a limit of the algorithm but of anybody's patience. Measured on the
 * generated landscape, which has the hub-and-tail connection shape a real one
 * has: 100 boxes lay out in 0.15 s, 200 in 0.44 s, 300 in 4.9 s, 400 in 6.1 s,
 * and 600 had not finished after six minutes. Somewhere past four hundred the
 * layered algorithm's crossing minimisation falls off a cliff, and past it the
 * honest answer is that Tidy is the wrong tool for this diagram rather than
 * that it is slow.
 *
 * The cap is not the whole protection, because the numbers depend on the
 * connections at least as much as on the boxes: a board of three hundred with
 * thousands of lines can still take minutes. That is what the cancel is for,
 * and why it matters that the pass has a thread of its own to be cancelled on.
 */
export const MAX_TIDY_NODES = 400;

/** Why a layout pass produced no board. */
export type LayoutRefusal = 'cancelled' | 'tooLarge';

/**
 * A pass that did not produce a board, and why.
 *
 * A reason rather than a sentence: the words belong to whoever is showing them,
 * and this module has no string table of its own — the same arrangement as
 * `SkippedTier`, which the router reports and the editor words.
 */
export class LayoutRefused extends Error {
  readonly reason: LayoutRefusal;
  /** For `tooLarge`: how many boxes were asked for, and how many fit. */
  readonly count?: number;
  readonly limit?: number;

  constructor(reason: LayoutRefusal, detail?: { count: number; limit: number }) {
    super(reason);
    this.name = 'LayoutRefused';
    this.reason = reason;
    this.count = detail?.count;
    this.limit = detail?.limit;
  }
}

export function isLayoutRefusal(error: unknown, reason?: LayoutRefusal): error is LayoutRefused {
  return error instanceof LayoutRefused && (reason === undefined || error.reason === reason);
}

/** The pass that is running, if one is. */
let running: { cancel(): void } | undefined;

/**
 * Stop the layout pass that is running.
 *
 * With a worker this is a termination: the thread stops mid-algorithm and the
 * caller is refused. Without one there is nothing to stop — the algorithm is
 * synchronous on this thread — so the pass is abandoned rather than cancelled:
 * the caller is refused at once and the computation finishes into a result
 * nobody reads. That is the difference the worker buys, and it is why the
 * button offering the cancel only appears where there is one.
 */
export function cancelElkLayout(): void {
  running?.cancel();
}

/** Whether a running pass can actually be stopped, which is what a Cancel promises. */
export function canCancelElkLayout(): boolean {
  return workerFactory !== undefined;
}

export interface ElkChild {
  id: string;
  width: number;
  height: number;
  /** Nested children make ELK keep a group (domain group / boundary) together. */
  children?: ElkChild[];
}

export interface ElkEdgeSpec {
  id: string;
  source: string;
  target: string;
  /**
   * Center label dimensions (one entry per label). When present, ELK's layered
   * algorithm reserves room for the label via a label dummy node so the routed
   * line and its chip stay clear of the nodes.
   */
  labels?: { width: number; height: number }[];
}

/**
 * The narrow slice of ELK the Tidy settings drive. Everything else stays in
 * {@link LAYOUT_OPTIONS} — two knobs, not the whole ELK option surface.
 */
export interface LayoutOptions {
  /** Main flow axis: layers run left→right (RIGHT) or top→bottom (DOWN). */
  direction?: 'RIGHT' | 'DOWN';
  /** Node gap in px, applied both within and between layers. */
  spacing?: number;
  /**
   * Flow axis INSIDE each compound node, for the hybrid mode: group boxes flow
   * one way, their members the other.
   *
   * Only honoured under `hierarchy: 'SEPARATE_CHILDREN'` — measured, not assumed.
   * With the default `INCLUDE_CHILDREN` a compound node's own `elk.direction` is
   * silently ignored, and `root=RIGHT, group=DOWN` produces the identical layout
   * to `root=RIGHT, group=inherit`.
   */
  groupDirection?: 'RIGHT' | 'DOWN';
  /**
   * How ELK treats the group hierarchy. Defaults to the `INCLUDE_CHILDREN` in
   * {@link LAYOUT_OPTIONS}, which lays every level out in one run so a cross-group
   * edge can influence the ordering of nodes WITHIN groups.
   *
   * `SEPARATE_CHILDREN` lays each group out as a black box, which is what makes a
   * per-group direction take effect — and costs exactly that coupling, so
   * connected applications line up across group boundaries less well. That is a
   * real behaviour change and the reason hybrid is a distinct third mode rather
   * than a free knob: the two modes place differently even with no per-group
   * direction set.
   */
  hierarchy?: 'INCLUDE_CHILDREN' | 'SEPARATE_CHILDREN';
}

export interface LayoutResult {
  /** Absolute positions (nested children resolved against their parents). */
  positions: Map<string, { x: number; y: number }>;
  /** Sizes ELK assigned to compound (group) nodes. */
  groupSizes: Map<string, { width: number; height: number }>;
}

/** Gap between an edge and its center label. Shared with {@link groupOptions}. */
const EDGE_LABEL_SPACING = 12;
/** Clearance between edges/labels and the nodes of the layer they cross.
 *  Shared with {@link groupOptions}. */
const EDGE_NODE_BETWEEN_LAYERS = 40;

/** Exported for the drift test that keeps {@link groupOptions} in step with it. */
export const LAYOUT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  // Between-layer spacing is kept EQUAL to the within-layer nodeNode gap so the
  // grid reads uniformly. It appears TWICE in a labelled edge's span (a label
  // dummy sits in its own layer, flanked by this gap on both sides), so a large
  // value blows the group-to-group gap out — group gap ≈ 2·thisGap + labelWidth.
  // A label already adds its own width via that dummy, so this only needs to be a
  // normal node gap, not extra breathing room on top.
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.spacing.nodeNode': '64',
  // Reserve space for center edge labels: `edgeLabel` is the gap between an
  // edge and its label; `edgeNodeBetweenLayers` keeps edges/labels off the
  // nodes in the layer they cross.
  'elk.spacing.edgeLabel': String(EDGE_LABEL_SPACING),
  'elk.layered.spacing.edgeNodeBetweenLayers': String(EDGE_NODE_BETWEEN_LAYERS),
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  // Kept even though ELK's bendpoints are discarded, and NOT dead config: the
  // orthogonal router makes ELK reserve inter-layer channel space while placing,
  // which is the space libavoid then routes its lines through. Switch this to
  // POLYLINE and the layers pack tighter than the routes need.
  'elk.edgeRouting': 'ORTHOGONAL',
};

/** Mirrors the nodeNode value in {@link LAYOUT_OPTIONS}; used when a caller
 *  supplies no density so compound nodes still match the root graph. */
const DEFAULT_SPACING = 64;

/**
 * Options for a COMPOUND node (a domain group / application boundary).
 *
 * The spacings have to be repeated here: layered spacing set on the root graph
 * does NOT inherit into a compound node, so without this a group's members
 * were laid out at ELK's built-in 20px default while everything at the top
 * level used our value. Density then only moved the gaps BETWEEN groups, never
 * the ones inside them, and the same group tidied on its own (a flat graph,
 * root options apply) came out visibly looser.
 *
 * The edge-label spacings are repeated for the same reason: a labelled
 * connection between two members of one group would otherwise fall back to
 * ELK's label-clearance defaults on a whole-board Tidy while the same group
 * tidied alone got our values. They are constants, not density-driven — the
 * chip size sets the room a label needs, density only moves node gaps.
 *
 * Exported so the drift test can assert EVERY root spacing is repeated here —
 * forgetting one is the bug this docblock keeps describing.
 */
export function groupOptions(
  spacing: number,
  groupDirection?: 'RIGHT' | 'DOWN',
): Record<string, string> {
  return {
    'elk.padding': '[top=48,left=28,bottom=28,right=28]',
    'elk.spacing.nodeNode': String(spacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
    'elk.spacing.edgeLabel': String(EDGE_LABEL_SPACING),
    'elk.layered.spacing.edgeNodeBetweenLayers': String(EDGE_NODE_BETWEEN_LAYERS),
    // Absent = inherit the root direction, which is every mode but hybrid, so
    // nothing about today's output moves.
    ...(groupDirection ? { 'elk.direction': groupDirection } : {}),
  };
}

function toElkNode(child: ElkChild, spacing: number, groupDirection?: 'RIGHT' | 'DOWN'): ElkNode {
  return {
    id: child.id,
    width: child.width,
    height: child.height,
    layoutOptions: child.children ? groupOptions(spacing, groupDirection) : undefined,
    children: child.children?.map((c) => toElkNode(c, spacing, groupDirection)),
  };
}

export async function layoutGraph(
  children: ElkChild[],
  edges: ElkEdgeSpec[],
  options: LayoutOptions = {},
): Promise<LayoutResult> {
  const count = countBoxes(children);
  if (count > MAX_TIDY_NODES) {
    throw new LayoutRefused('tooLarge', { count, limit: MAX_TIDY_NODES });
  }

  // Density moves BOTH spacings together — they are kept equal on purpose (see
  // LAYOUT_OPTIONS), so the grid scales uniformly instead of stretching one axis.
  const spacing = options.spacing ?? DEFAULT_SPACING;
  const layoutOptions: Record<string, string> = {
    ...LAYOUT_OPTIONS,
    ...(options.direction ? { 'elk.direction': options.direction } : {}),
    ...(options.spacing !== undefined
      ? {
          'elk.spacing.nodeNode': String(options.spacing),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(options.spacing),
        }
      : {}),
    ...(options.hierarchy ? { 'elk.hierarchyHandling': options.hierarchy } : {}),
  };

  const elkEdges: ElkExtendedEdge[] = edges.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
    // elkjs only reserves room for a center label when it carries non-empty
    // `text`; width/height alone are ignored. The text is a marker only — the
    // supplied width/height drive the reserved box (and thus the between-layer
    // gap), so we pass a single-space placeholder and let the estimator's
    // dimensions do the work.
    ...(e.labels && e.labels.length > 0
      ? {
          labels: e.labels.map((l, i) => ({
            id: `${e.id}#label${i}`,
            text: ' ',
            width: l.width,
            height: l.height,
          })),
        }
      : {}),
  }));

  const engine = await engine_();
  const result = await raced(engine, {
    id: 'root',
    layoutOptions,
    children: children.map((child) => toElkNode(child, spacing, options.groupDirection)),
    edges: elkEdges,
  });

  const positions = new Map<string, { x: number; y: number }>();
  const groupSizes = new Map<string, { width: number; height: number }>();
  collect(result.children ?? [], 0, 0, positions, groupSizes);
  return { positions, groupSizes };
}

function collect(
  nodes: ElkNode[],
  offsetX: number,
  offsetY: number,
  positions: Map<string, { x: number; y: number }>,
  groupSizes: Map<string, { width: number; height: number }>,
): void {
  for (const node of nodes) {
    const x = offsetX + (node.x ?? 0);
    const y = offsetY + (node.y ?? 0);
    positions.set(node.id, { x, y });
    if (node.children && node.children.length > 0) {
      groupSizes.set(node.id, { width: node.width ?? 0, height: node.height ?? 0 });
      collect(node.children, x, y, positions, groupSizes);
    }
  }
}

/** Boxes, groups and their members alike — what the cap counts. */
function countBoxes(children: readonly ElkChild[]): number {
  let count = 0;
  for (const child of children) count += 1 + countBoxes(child.children ?? []);
  return count;
}

type Engine = { elk: ElkEngine; stop(): void };

/**
 * The engine for this pass. A worker where the host gave us one, and the
 * self-contained bundle otherwise — the two have the same API, which is the
 * whole reason elkjs ships both.
 */
async function engine_(): Promise<Engine> {
  if (workerFactory) {
    const factory = workerFactory;
    const { default: ELK } = await import('elkjs/lib/elk-api.js');
    const elk = new ELK({ workerFactory: () => factory() });
    return { elk, stop: () => elk.terminateWorker() };
  }
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  return { elk: new ELK(), stop: () => {} };
}

/**
 * The layout, against a cancellation.
 *
 * One pass at a time is the caller's rule, not this one's — the editor's `busy`
 * interlock — so the running pass can be a single module-level handle rather
 * than a token threaded through four layers of layout code to reach one button.
 */
async function raced(engine: Engine, graph: ElkNode): Promise<ElkNode> {
  const cancelled = new Promise<never>((_, refuse) => {
    running = {
      cancel: () => {
        engine.stop();
        refuse(new LayoutRefused('cancelled'));
      },
    };
  });
  try {
    return await Promise.race([engine.elk.layout(graph), cancelled]);
  } finally {
    running = undefined;
    engine.stop();
  }
}
