import type {
  DesignDiagram,
  DesignElement,
  DesignModel,
  DiagramLayoutConfig,
  DiagramPlacement,
  DomainGroupRect,
  EdgeRoute,
  ElementId,
  Layer7Zone,
  Rect,
  ResizableZone,
} from '../model/types';
import {
  NODE_SIZES,
  domainGroupForPoint,
  domainGroupRectMap,
  placementSize,
} from '../model/placement';
import { canvasRect, clampCanvasSize, LAYER7_CANVAS, zoneRect, zoneSizes } from '../model/zones';
import { layoutGraph, type ElkChild, type ElkEdgeSpec, type LayoutOptions } from './elkLayout';
import { edgeLabelSize } from './edgeLabelSize';
import { manualRouteIds } from '../model/routes';
import type { SkippedTier } from './libavoidRouter';
import { routeDiagramEdges } from './routeOnly';

/**
 * "Tidy" auto-layout. Zone grammar is preserved — bands re-flow as rows or
 * columns, the central landscape runs ELK layered with domain groups as
 * compound nodes (so groups stay together), and container diagrams nest the
 * components inside the application boundary.
 *
 * **ELK places; libavoid routes.** Both Tidy entry points finish by handing their
 * settled placements to `routeDiagramEdges`, the same pass the "route connections
 * only" toolbar action runs, so every edge on the board — landscape-internal and
 * cross-zone alike — is routed by one router against one obstacle set. ELK's own
 * bendpoints are no longer read at all; see
 * `docs/plans/2026-06-10-solution-design/edge-routing/2026-07-27-libavoid-adoption-plan.md`.
 */

/**
 * Session settings for a Tidy run (held in editor state — nothing is persisted
 * on the model). Every field has a neutral default in
 * {@link DEFAULT_TIDY_OPTIONS}, so callers that don't care can omit them.
 */
export interface TidyOptions {
  /**
   * Main flow axis. `auto` picks one from the shape of the space being filled,
   * so a tall board flows downward and a wide one to the right.
   */
  direction: 'horizontal' | 'vertical' | 'auto' | 'hybrid';
  /** How much air between nodes. */
  density: 'compact' | 'normal' | 'spacious';
  /**
   * Leave alone every route a PERSON placed — bend points and hand-positioned
   * label chips alike. Feedback item 5.
   *
   * Renamed from `preserveManualRoutes`, and the rename is deliberate churn
   * rather than tidying: the semantics genuinely changed and a reader must not
   * carry the old option's caveats across. That one keyed off waypoint presence,
   * which was the only signal the model carried, so it protected an earlier
   * Tidy's own output, could not see a chip somebody had dragged, and was
   * documented as a heuristic. With provenance on the route the predicate is
   * exact and all three of those are fixed at once.
   *
   * ON by default since the routing phase: a person's bends and pins are the one
   * thing on the board a Tidy has no business discarding, and "Re-route
   * everything (ignore pins)" exists for the case where they want it to. The cost
   * is known — a pinned bend on a reflowed board can end up bending around empty
   * space — and it is the user's to spend: untick the box, or reset the line.
   */
  pinAnchorPoints: boolean;
  /**
   * Overall tidy only: leave every domain group where the user put it. Each
   * group keeps its current TOP-LEFT and only its members are re-laid-out
   * inside; the box still resizes to hug them (a fixed box would leave members
   * overflowing a group that grew). Loose landscape nodes are left alone too —
   * there is no room to reflow them without walking over the pinned boxes.
   */
  pinGroups: boolean;
  /**
   * Keep what is INSIDE each group exactly as it is; the boxes themselves may
   * still move. Feedback item 2.
   *
   * Distinct from {@link pinGroups}, which pins the box POSITION and re-lays-out
   * the members. Box position × member layout is a four-cell matrix and all four
   * cells mean something:
   *
   * | box | members | what a tidy does |
   * | --- | --- | --- |
   * | free | free | today's default: ELK places everything |
   * | pinned | free | `pinGroups`: the box stays, members reflow inside it |
   * | free | **pinned** | ELK arranges the GROUPS; each curated interior travels along rigidly |
   * | pinned | pinned | "tidy everything except my groups": bands reflow, routes update, groups untouched |
   *
   * Two independent checkboxes rather than a three-way control, because they are
   * independent, both are "pin", and one of them already existed.
   */
  pinGroupContents: boolean;
}

export const DEFAULT_TIDY_OPTIONS: TidyOptions = {
  direction: 'auto',
  density: 'normal',
  pinAnchorPoints: true,
  pinGroups: false,
  pinGroupContents: false,
};

/**
 * The connections whose STORED route a pass must not overwrite — the exact
 * predicate that replaced the old waypoint-presence heuristic.
 *
 * A route is protected when the user placed it, full stop. Waypoints are not
 * consulted at all, which is what finally covers a label-only route: a chip
 * somebody dragged carries no bend points and used to look like nothing.
 *
 * Empty when the option is off, so the caller passes the result unconditionally
 * and `routeDiagramEdges` sees an empty set rather than a special case. On, it is
 * `manualRouteIds` — the SAME set the live pass, the drag preview and "Route
 * connections" protect, pinned rows included, so a Tidy with the box ticked can
 * never disagree with them about whose line a route is.
 */
export function preservedRouteIds(
  diagram: Pick<DesignDiagram, 'edgeRoutes'>,
  pinAnchorPoints: boolean,
): ReadonlySet<string> {
  if (!pinAnchorPoints) return EMPTY_PRESERVED;
  return manualRouteIds(diagram);
}

const EMPTY_PRESERVED: ReadonlySet<string> = new Set<string>();

/** Node gap (px) per density step. `normal` is the long-standing ELK default. */
const DENSITY_SPACING: Record<TidyOptions['density'], number> = {
  compact: 40,
  normal: 64,
  spacious: 96,
};

/**
 * ELK options for one run. `auto` direction follows the shape of the box being
 * filled: clearly taller than wide flows DOWN, everything else RIGHT (the
 * historical default). Below three nodes the axis barely shows, so we don't
 * flip the whole layout over one or two boxes.
 */
function layoutOptionsFor(
  options: TidyOptions,
  box: { width: number; height: number },
  nodeCount: number,
): LayoutOptions {
  const spacing = DENSITY_SPACING[options.density];
  // Hybrid (item 7): group boxes flow ACROSS the landscape, members flow DOWN
  // inside each box — one column of applications per domain, read left to right,
  // which suits a domain-partitioned landscape. It needs SEPARATE_CHILDREN, and
  // that is the whole cost of the mode (see `LayoutOptions.hierarchy`). The zone
  // grammar is untouched: only the landscape zone's internal flow changes.
  if (options.direction === 'hybrid') {
    return {
      direction: 'RIGHT',
      groupDirection: 'DOWN',
      hierarchy: 'SEPARATE_CHILDREN',
      spacing,
    };
  }
  const direction =
    options.direction === 'horizontal'
      ? 'RIGHT'
      : options.direction === 'vertical'
        ? 'DOWN'
        : box.height > box.width * 1.1 && nodeCount > 2
          ? 'DOWN'
          : 'RIGHT';
  return { direction, spacing };
}

/**
 * What one Tidy run commits: element positions plus, for layer7, the landscape
 * domain-group rects re-sized to hug their laid-out members. `domainGroups` is
 * absent for container diagrams (their one boundary is an ordinary placement).
 * The rects are MERGED into `layoutConfig.domainGroups` by name (create-or-resize:
 * an existing rect is resized in place, a new group name is appended) — see
 * `applyTidyResult`. Each rect is derived from its members' final bounds, so it
 * follows them even when ELK drops compound treatment for the group.
 */
export interface TidyResult {
  placements: DiagramPlacement[];
  domainGroups?: DomainGroupRect[];
  /**
   * Layer7 only: the board size the landscape needs. The canvas GROWS to fit a
   * large landscape and SHRINKS back toward the default when it's small (both
   * clamped to CANVAS_SIZE_LIMITS). Absent for container diagrams (no zones).
   */
  canvas?: { width: number; height: number };
  /**
   * The routed edges, in final flow coordinates: interior waypoints only
   * (FloatingEdge computes its own endpoint anchors) plus, for a labelled edge, the
   * spot its chip is pinned to. An entry with empty `waypoints` means "routed, and
   * draw it straight" — `applyTidyResult` clears any stale manual route for it.
   *
   * Every connection with both endpoints on the diagram gets an entry, including one
   * the router declined: Tidy emits EMPTY waypoints for it rather than omitting it,
   * because it just repositioned the nodes and the stored route is stale geometry.
   * Route-only, which moves nothing, re-emits the stored route instead — see
   * {@link DeclinedPolicy}. An entry is missing only for a connection with an
   * endpoint that is not on this diagram at all.
   */
  edgeRoutes?: EdgeRoute[];
  /**
   * This result covers only PART of the diagram (one domain group — see
   * {@link tidyGroup}). `applyTidyResult` then touches exactly what is listed
   * here and leaves the rest alone; a FULL tidy additionally clears every
   * manual edge route it did not produce, because it reflowed the whole board.
   */
  partial?: boolean;
  /**
   * The router threw and this result therefore carries NO `edgeRoutes` — the
   * placements are still good and still meant to be applied. Set only by
   * {@link routeOrDegrade}; route-only has no placements to save and lets the
   * rejection through instead.
   *
   * Routing is the last step of every Tidy, so without this the whole promise
   * rejects and a WASM load failure throws away a layout ELK already computed.
   * The caller applies the result and reports this separately, because a board
   * that is tidy but unrouted is worth keeping and not worth staying quiet about.
   */
  routingError?: unknown;
  /**
   * Tiers the router REFUSED for being over `MAX_CONNECTORS_PER_TIER`, and which
   * connections were in them. Empty on the normal path.
   *
   * Distinct from {@link routingError}, which means the router broke. This means
   * it worked and declined — a board too crowded to route without freezing the
   * tab. Both are worth saying; neither is the same as success.
   *
   * **Every caller reports it**, not just live mode: an over-cap Tidy or
   * route-only press was previously the measured "0 of 200 routed, in 0.3 ms,
   * reported as success", because a dropped tier is a filter rather than a
   * `routingError` and nothing downstream ever fired.
   */
  skipped?: SkippedTier[];
}

/**
 * Route the settled board, degrading to "no routes at all" if the router fails.
 *
 * `applyTidyResult` skips its whole edge-route branch on an absent `edgeRoutes`,
 * so the placements land and every stored route is left exactly as it was. That is
 * the wrong geometry for a board Tidy just reflowed, and it is still far better
 * than the alternative of discarding the placements too.
 */
async function routeOrDegrade(
  ...args: Parameters<typeof routeDiagramEdges>
): Promise<Pick<TidyResult, 'edgeRoutes' | 'routingError' | 'skipped'>> {
  try {
    const { edgeRoutes, skipped } = await routeDiagramEdges(...args);
    return { edgeRoutes, skipped };
  } catch (routingError) {
    return { routingError };
  }
}

export async function tidyLayer7(
  model: DesignModel,
  diagram: DesignDiagram,
  options: TidyOptions = DEFAULT_TIDY_OPTIONS,
): Promise<TidyResult> {
  const elementsById = new Map(model.elements.map((e) => [e.id, e]));
  const byZone = new Map<Layer7Zone, DiagramPlacement[]>();
  for (const placement of diagram.placements) {
    if (!elementsById.has(placement.elementId)) continue;
    const zone = placement.zone ?? 'landscape';
    const list = byZone.get(zone) ?? [];
    list.push(placement);
    byZone.set(zone, list);
  }

  const layoutConfig = diagram.layoutConfig;
  const landscape = await tidyLandscape(
    model,
    byZone.get('landscape') ?? [],
    elementsById,
    layoutConfig,
    options,
  );
  // Lay the bands out against the GROWN canvas so they anchor to the new board
  // edges (zones.ts derives band rects from the canvas size).
  const grownConfig = { ...(layoutConfig ?? {}), canvas: landscape.canvas };
  // Position each band member at the barycentre (mean centre) of the LANDSCAPE
  // nodes it connects to, so an actor sits roughly above/beside the node it talks
  // to instead of bunched at the band's start inset. `landscape.placements` carry
  // FINAL canvas coords, so target centres and the band members share one
  // coordinate space. Ordering falls out of position (declump preserves it), except
  // where two members want the SAME position — see the tie-break in `flowBand`.
  const landscapePos = new Map<ElementId, { x: number; y: number; width: number; height: number }>();
  for (const p of landscape.placements) {
    const element = elementsById.get(p.elementId);
    if (!element) continue;
    const size = placementSize(element.kind, p);
    landscapePos.set(p.elementId, { x: p.x, y: p.y, width: size.width, height: size.height });
  }
  const actors = byZone.get('actors') ?? [];
  const management = byZone.get('management') ?? [];
  const inputChannels = byZone.get('inputChannels') ?? [];
  const externalSystems = byZone.get('externalSystems') ?? [];
  const placements: DiagramPlacement[] = [
    ...flowBand('actors', actors, elementsById, 'row', grownConfig, bandTargets(model, actors, landscapePos, 'row')),
    ...flowBand('management', management, elementsById, 'row', grownConfig, bandTargets(model, management, landscapePos, 'row')),
    ...flowBand('inputChannels', inputChannels, elementsById, 'column', grownConfig, bandTargets(model, inputChannels, landscapePos, 'column')),
    ...flowBand('externalSystems', externalSystems, elementsById, 'column', grownConfig, bandTargets(model, externalSystems, landscapePos, 'column')),
    ...landscape.placements,
  ];

  // Route LAST, against the settled board: the placements the landscape pass and
  // the band re-flow just produced, and the group boxes this run is about to
  // commit — not the stale ones still in `layoutConfig`.
  //
  // `'clear'` is the load-bearing argument, and it is where Tidy MUST diverge from
  // route-only. Route-only keeps the stored route of an edge the router declines,
  // because it moved nothing and that geometry still fits the board. Tidy has just
  // repositioned every node, so the same stored route describes positions that no
  // longer exist — reinstating it would draw a bend around empty space, or straight
  // through a node that moved into it.
  const { edgeRoutes, routingError, skipped } = await routeOrDegrade(
    model,
    {
      ...diagram,
      placements,
      layoutConfig: {
        ...(layoutConfig ?? {}),
        canvas: landscape.canvas,
        domainGroups: landscape.domainGroups,
      },
    },
    'clear',
    undefined,
    // Item 5. `'clear'` above stays correct for the routes this pass owns; this
    // exempts the ones it does not. The two are not in tension — one says what
    // to do with router output, the other says which routes are not the
    // router's to produce.
    preservedRouteIds(diagram, options.pinAnchorPoints),
  );

  return {
    placements,
    domainGroups: landscape.domainGroups,
    canvas: landscape.canvas,
    edgeRoutes,
    routingError,
    skipped,
  };
}

const BAND_INSET = 28;
const BAND_GAP = 22;

/**
 * Where one band member wants to sit, derived from the LANDSCAPE nodes it connects
 * to. Both fields are means over those partners' centres.
 */
export interface BandTarget {
  /**
   * Barycentre on the band's FLOW axis (x for rows, y for columns) — the point the
   * member wants its own centre on, so its lines run short and straight.
   */
  centre: number;
  /**
   * Barycentre on the CROSS axis (y for rows, x for columns), i.e. how far out into
   * the landscape the member's partners sit. Used ONLY to break a tie on `centre`
   * — see the tie-break in {@link flowBand}.
   */
  crossCentre: number;
}

/**
 * Barycentre target per band member, keyed off the LANDSCAPE nodes it connects to. A
 * member with NO landscape connection is OMITTED from the map (it has no target);
 * `flowBand` then leaves it near where it already sits.
 */
export function bandTargets(
  model: DesignModel,
  placements: DiagramPlacement[],
  landscapePos: Map<ElementId, { x: number; y: number; width: number; height: number }>,
  direction: 'row' | 'column',
): Map<ElementId, BandTarget> {
  const targets = new Map<ElementId, BandTarget>();
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  // Adjacency once, rather than a walk over every connection per band member.
  // On a landscape with five thousand connections and three hundred chips in
  // the bands that inner loop was a million and a half comparisons for an
  // answer that is two lookups; it is now proportional to the connections plus
  // the members rather than to their product.
  const neighbours = new Map<ElementId, ElementId[]>();
  const link = (from: ElementId, to: ElementId) => {
    const held = neighbours.get(from);
    if (held) held.push(to);
    else neighbours.set(from, [to]);
  };
  for (const conn of model.connections) {
    link(conn.sourceId, conn.targetId);
    // A line from an element to itself was one neighbour to the loop this
    // replaces — the first branch matched and the second never ran.
    if (conn.targetId !== conn.sourceId) link(conn.targetId, conn.sourceId);
  }
  for (const placement of placements) {
    const flow: number[] = [];
    const cross: number[] = [];
    for (const otherId of neighbours.get(placement.elementId) ?? []) {
      const land = landscapePos.get(otherId);
      if (!land) continue;
      const centreX = land.x + land.width / 2;
      const centreY = land.y + land.height / 2;
      flow.push(direction === 'row' ? centreX : centreY);
      cross.push(direction === 'row' ? centreY : centreX);
    }
    if (flow.length === 0) continue; // no landscape target — omit
    targets.set(placement.elementId, { centre: mean(flow), crossCentre: mean(cross) });
  }
  return targets;
}

/**
 * Flow-axis span, in px, below which two members' desired starts count as THE SAME
 * and the cross-axis tie-break decides their order. Sub-pixel differences in a
 * barycentre are noise, not a preference.
 */
const TARGET_TIE_EPSILON = 1;

/**
 * Re-flow a band.
 *
 * Waarom: with `targets` we POSITION each node so its centre lands on the
 * barycentre of the landscape nodes it connects to (an actor sits above the app
 * it talks to), then a left-to-right declump sweep resolves overlaps while
 * preserving that order, and a final clamp keeps the run inside the zone band —
 * the five-zone grammar is never broken. Without `targets` we keep the EXACT
 * legacy pack: sort by current axis position and pack consecutively from the
 * start inset (so callers/tests without a targets map are unaffected).
 */
function flowBand(
  zone: Layer7Zone,
  placements: DiagramPlacement[],
  elementsById: Map<ElementId, DesignElement>,
  direction: 'row' | 'column',
  layoutConfig?: DiagramLayoutConfig,
  targets?: Map<ElementId, BandTarget>,
): DiagramPlacement[] {
  const rect = zoneRect(zone, layoutConfig);
  const bandStart = direction === 'row' ? rect.x : rect.y;
  const bandLength = direction === 'row' ? rect.width : rect.height;
  const fullSizeOf = (p: DiagramPlacement) => {
    const element = elementsById.get(p.elementId) as DesignElement;
    const size = placementSize(element.kind, p);
    return direction === 'row' ? size.width : size.height;
  };
  const crossAxis = (placement: DiagramPlacement, start: number): DiagramPlacement => {
    const element = elementsById.get(placement.elementId) as DesignElement;
    const size = placementSize(element.kind, placement);
    return direction === 'row'
      ? { ...placement, x: start, y: rect.y + (rect.height - size.height) / 2 }
      : { ...placement, x: rect.x + (rect.width - size.width) / 2, y: start };
  };

  // Legacy pack path (no targets): current order, consecutive from the inset.
  if (!targets) {
    const axis = (p: DiagramPlacement) => (direction === 'row' ? p.x : p.y);
    const sorted = [...placements].sort((a, b) => axis(a) - axis(b));
    let cursor = bandStart + BAND_INSET;
    return sorted.map((placement) => {
      const next = crossAxis(placement, cursor);
      cursor += fullSizeOf(placement) + BAND_GAP;
      return next;
    });
  }

  // Desired START (left/top) per node = its desired CENTRE − half its size. A
  // node with no target keeps its current centre so it stays put.
  //
  // `crossDistance` is how far the node's landscape partners sit from the band, on
  // the axis the band does NOT flow along. It exists purely as a tie-break, and the
  // tie it breaks is the common case, not a corner: ELK lays the landscape out
  // LEFT-TO-RIGHT, so a landscape that fits one layer row puts every node on the
  // same y — and then every member of a LEFT/RIGHT band gets the identical y
  // barycentre and their order falls out of the placements array (i.e. out of the
  // database). The mirror happens for a TOP/BOTTOM band whose partners are stacked
  // in one ELK layer, sharing an x.
  const bandCross = direction === 'row' ? rect.y + rect.height / 2 : rect.x + rect.width / 2;
  const items = placements.map((placement) => {
    const full = fullSizeOf(placement);
    const half = full / 2;
    const currentCentre = (direction === 'row' ? placement.x : placement.y) + half;
    const target = targets.get(placement.elementId);
    return {
      placement,
      full,
      desiredStart: (target?.centre ?? currentCentre) - half,
      crossDistance: target ? Math.abs(target.crossCentre - bandCross) : 0,
      start: 0,
    };
  });
  // Nearest partners FIRST, because the declump sweep below hands the first tied
  // node its exact desired start and displaces each later one further along: the
  // node whose partner is closest to the band is the one that can be joined by a
  // short straight line, so it earns the on-target slot. Sorting the rest outward by
  // distance then nests the long runs instead of crossing them — a far partner's line
  // travels in an out-of-row channel anyway, so it belongs at the outside of the band.
  // Quantising the primary key keeps the comparator transitive (a plain
  // `Math.abs(diff) < EPSILON` test is not).
  const tier = (value: number) => Math.round(value / TARGET_TIE_EPSILON);
  items.sort(
    (a, b) => tier(a.desiredStart) - tier(b.desiredStart) || a.crossDistance - b.crossDistance,
  );

  // Declump sweep: honour each desired start but never let a node overlap the
  // one before it — guarantees order + a BAND_GAP minimum between neighbours.
  let cursor = bandStart + BAND_INSET;
  for (const item of items) {
    item.start = Math.max(item.desiredStart, cursor);
    cursor = item.start + item.full + BAND_GAP;
  }

  // Clamp within the band: if the sweep pushed the last node past the far edge,
  // shift the whole run left by the overflow — but only as far as the first node
  // reaching the start inset (a uniform shift preserves order + gaps). If the
  // content is wider than the band even flush at the start, we ALLOW the overflow
  // (band wrapping is out of scope, U3) rather than squashing nodes.
  if (items.length > 0) {
    const floor = bandStart + BAND_INSET;
    const bandEnd = bandStart + bandLength - BAND_INSET;
    const last = items[items.length - 1];
    const overflow = last.start + last.full - bandEnd;
    if (overflow > 0) {
      const shift = Math.min(overflow, items[0].start - floor);
      if (shift > 0) {
        for (const item of items) item.start -= shift;
      }
    }
  }

  return items.map((item) => crossAxis(item.placement, item.start));
}

const GROUP_PREFIX = 'group:';

/**
 * Breathing room between a domain-group box and its members. Asymmetric: extra
 * room at the top so members sit clear of the group label, which `DomainGroupLayer`
 * draws as a pill straddling the top border. Mirrors the padding ELK used for the
 * compound group node (top=48, sides/bottom=28).
 */
const GROUP_PAD = { top: 48, left: 28, right: 28, bottom: 28 } as const;

// Margin between the landscape block and the surrounding bands, split by axis:
// the LEFT/RIGHT bands (input channels / external systems) sit well clear of the
// landscape so a landscape↔band edge isn't a stub AND its (often wide) label fits
// between the source group box and the band node instead of overlapping either.
// The TOP/BOTTOM bands (actors / management) keep the tighter margin.
const INSET_X = 130;
const INSET_Y = 32;

/**
 * ELK-lay-out one group's members and park the result inside `box`, anchored at
 * the box's CURRENT top-left. The box is then resized to hug what came out —
 * position pinned, size follows. Shared by the per-group tidy and the pinned
 * overall tidy so both produce identical geometry.
 *
 * Returns undefined when there is nothing to lay out.
 */
async function layoutGroupInPlace(
  model: DesignModel,
  members: DiagramPlacement[],
  elementsById: Map<ElementId, DesignElement>,
  groupName: string,
  box: Rect,
  options: TidyOptions,
): Promise<
  | {
      placements: DiagramPlacement[];
      rect: DomainGroupRect;
    }
  | undefined
> {
  if (members.length === 0) return undefined;
  const sizeOf = (placement: DiagramPlacement) =>
    placementSize((elementsById.get(placement.elementId) as DesignElement).kind, placement);

  const children: ElkChild[] = members.map((placement) => ({
    id: placement.elementId,
    ...sizeOf(placement),
  }));
  const memberIds = new Set(members.map((placement) => placement.elementId));
  const edges: ElkEdgeSpec[] = model.connections
    .filter((c) => memberIds.has(c.sourceId) && memberIds.has(c.targetId))
    .map((c) => {
      const label = edgeLabelSize(c);
      return {
        id: c.id,
        source: c.sourceId,
        target: c.targetId,
        ...(label ? { labels: [label] } : {}),
      };
    });

  // `auto` reads the GROUP box, not the landscape zone — the members fill that
  // box, so its shape is what the flow should follow.
  const { positions } = await layoutGraph(
    children,
    edges,
    layoutOptionsFor(options, box, members.length),
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const placement of members) {
    const pos = positions.get(placement.elementId);
    if (!pos) continue;
    const size = sizeOf(placement);
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + size.width);
    maxY = Math.max(maxY, pos.y + size.height);
  }
  if (!Number.isFinite(minX)) return undefined; // ELK placed nothing we asked for

  // Anchor: the laid-out block's top-left lands one GROUP_PAD inside the box's
  // CURRENT top-left, so the group stays where the user put it and only its
  // width/height follow the members.
  const offset = { x: box.x + GROUP_PAD.left - minX, y: box.y + GROUP_PAD.top - minY };
  const placements = members.map((placement) => {
    const pos = positions.get(placement.elementId);
    if (!pos) return placement;
    // Record the membership on the placement too — a node that visually sits in
    // the box but carried a stale or absent `domainGroup` is now stored as the
    // member it is drawn as.
    return {
      ...placement,
      domainGroup: groupName,
      x: pos.x + offset.x,
      y: pos.y + offset.y,
    };
  });

  return {
    placements,
    rect: {
      name: groupName,
      x: box.x,
      y: box.y,
      width: maxX - minX + GROUP_PAD.left + GROUP_PAD.right,
      height: maxY - minY + GROUP_PAD.top + GROUP_PAD.bottom,
    },
  };
}

/**
 * The canvas Tidy settles on: content-driven, but never below the floor.
 * The floor is the default board — Tidy shrinks an inflated canvas back —
 * EXCEPT when the user deliberately made the board smaller than the default
 * (possible since the flexible-board change, 2026-08): that size is layout intent, and Tidy re-inflating
 * it would undo the choice on the one button people press most. Content that
 * genuinely needs more room still grows past either floor.
 */
function tidyCanvas(
  needed: { width: number; height: number },
  layoutConfig: DiagramLayoutConfig | undefined,
): { width: number; height: number } {
  const board = canvasRect(layoutConfig);
  return clampCanvasSize({
    width: Math.max(needed.width, Math.min(LAYER7_CANVAS.width, board.width)),
    height: Math.max(needed.height, Math.min(LAYER7_CANVAS.height, board.height)),
  });
}

/**
 * Round guard for {@link settleBoard}, derived rather than tuned.
 *
 * A round closes the gap to the fixed point by the band fraction of the axis,
 * and BOTH bands on an axis scale with the board: 0.35 + 0.35 = 0.70 of the
 * height, 0.34 + 0.34 = 0.68 of the width (`ZONE_MAX_FRACTION`). Height is
 * the least favourable. Its largest possible descent is the ceiling down to
 * the floor, 3200 − 520 = 2680 (`CANVAS_SIZE_LIMITS`), so the geometric phase
 * needs 0.70^n × 2680 < 1 → n = 23.
 *
 * Then it stops being geometric: each band is `Math.round`ed, injecting up to
 * 1px of error per round, so contraction stalls around 1/(1 − 0.70) ≈ 3.3px.
 * Past that the sequence is monotone and integer-stepped, so it loses at least
 * 1px a round — a tail of ~4. Worst case 27; 32 keeps a margin, and a round is
 * arithmetic over numbers already computed (no re-layout), so the margin is
 * free.
 *
 * That bound holds only while `neededFor` is monotone in the band sizes, which
 * both real callers are (content bounds plus band sizes). A non-monotone one
 * can cycle forever and NO cap bounds it — which is what `settled` is for. Six
 * rounds used to be the cap, and exiting on it is what let a pinned board come
 * back 3px high and move again on the next press.
 *
 * The arithmetic above is re-derived from `CANVAS_SIZE_LIMITS` and the band
 * fractions by "the round cap clears the worst descent the limits allow" in
 * tidy.test.ts, so widening the board or deepening a band fails that test
 * instead of quietly outgrowing this number. Exported for it.
 */
export const SETTLE_ROUNDS = 32;

/**
 * The board Tidy settles on, together with the band sizes that hold on it.
 *
 * Since band maxima became fractions of the board (flexible board, 2026-08) the
 * two depend on each other: the board has to be wide enough for the bands, and
 * the bands are only as wide as the board allows. Measuring the content against
 * the PRE-Tidy board therefore settled somewhere else every press — a 4800×3200
 * board with `management.size` 1100 walked 1741.5 → 1120 → 1040 over three
 * presses of the one button people press most.
 *
 * So iterate to the fixed point instead. `neededFor` states what the content
 * needs given a set of band sizes, and each round re-reads the bands from the
 * board the previous round produced. The map is monotone (a band is
 * `min(stored, fraction × board)`) and bounded by the canvas limits, so the
 * sequence converges from either side; the round cap is a guard, not the
 * expected exit. The returned sizes are always the ones effective on the
 * returned canvas, so callers can't mix bands from two different boards.
 *
 * `settled` says WHICH exit was taken, because the two are otherwise
 * indistinguishable from the outside and that is how a too-low cap survived a
 * fix, a review and a hand reproduction: a board that stopped one round short
 * looks exactly like a board that converged, and only shows itself as movement
 * on the next press. False means the loop ran out with the board still moving —
 * the returned canvas is the last iterate, not a fixed point, and Tidy will
 * move again. Exported so the guarantee is testable directly, cap and all.
 *
 * No caller reads `settled`, deliberately: both boards that reach a user (pinned
 * and unpinned) have monotone `neededFor`s that the derived cap covers, so
 * branching on it would mean handling a case they cannot reach, and a
 * customer-facing warning about layout internals helps nobody. It is log-and-test
 * only — a discarded `settled` at a call site is not an oversight.
 *
 * What callers do owe is `path`, because the warning is the only trace this
 * leaves in a browser and the four call sites are NOT equally serious: an
 * exhausted board on the pinned or unpinned path is the staircase bug returning,
 * the centring estimate in `tidyLandscape` only shifts the block (its board is
 * discarded, and the real one is settled again below it), and the empty-landscape
 * call cannot exhaust at all. An anonymous warning makes those indistinguishable
 * — the same mistake, one level up, as the two exits being indistinguishable was.
 */
export function settleBoard(
  neededFor: (sizes: Record<ResizableZone, number>) => { width: number; height: number },
  layoutConfig: DiagramLayoutConfig | undefined,
  path: string,
): {
  canvas: { width: number; height: number };
  sizes: Record<ResizableZone, number>;
  settled: boolean;
} {
  const bandsOn = (canvas: { width: number; height: number }) =>
    zoneSizes({ ...(layoutConfig ?? {}), canvas });
  const roundFrom = (canvas: { width: number; height: number }) =>
    tidyCanvas(neededFor(bandsOn(canvas)), layoutConfig);
  const board = canvasRect(layoutConfig);
  let canvas = { width: board.width, height: board.height };
  let settled = false;
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const next = roundFrom(canvas);
    if (next.width === canvas.width && next.height === canvas.height) {
      settled = true;
      break;
    }
    canvas = next;
  }
  // The loop only ever compares an iterate against the one BEFORE it, so the
  // board the last round produced has nothing after it to prove it stands still:
  // a board that lands exactly on its fixed point as the budget runs out leaves
  // the loop looking unsettled. One more application decides it, and without
  // this a converged board warns that Tidy will move it again when it will not.
  if (!settled) {
    const next = roundFrom(canvas);
    settled = next.width === canvas.width && next.height === canvas.height;
  }
  if (!settled) {
    console.warn(
      `[solution-design] ${path}: Tidy did not settle the board in ${SETTLE_ROUNDS} rounds; ` +
        `returning ${canvas.width}×${canvas.height}, which is not a fixed point — ` +
        `pressing Tidy again will move it. See SETTLE_ROUNDS.`,
    );
  }
  return { canvas, sizes: bandsOn(canvas), settled };
}

/**
 * Landscape pass with "pin group placements" on: every domain group stays where
 * the user put it and only its members are re-laid-out inside (box resized to
 * hug them — see {@link layoutGroupInPlace}). Loose landscape nodes are left
 * untouched: with the boxes fixed there is nowhere to reflow them to without
 * walking over a pinned group.
 *
 * A group with no rect yet has no pinned position, so it is anchored on its
 * members' current bounding box — where the user already sees it.
 */
async function tidyLandscapePinned(
  model: DesignModel,
  placements: DiagramPlacement[],
  elementsById: Map<ElementId, DesignElement>,
  layoutConfig: DiagramLayoutConfig | undefined,
  options: TidyOptions,
): Promise<{
  placements: DiagramPlacement[];
  domainGroups: DomainGroupRect[];
  canvas: { width: number; height: number };
}> {
  const rects = domainGroupRectMap(layoutConfig);
  const sizeOf = (placement: DiagramPlacement) =>
    placementSize((elementsById.get(placement.elementId) as DesignElement).kind, placement);

  const byGroup = new Map<string, DiagramPlacement[]>();
  const result: DiagramPlacement[] = [];
  for (const placement of placements) {
    if (!placement.domainGroup) {
      result.push(placement); // loose node — stays exactly where it is
      continue;
    }
    const members = byGroup.get(placement.domainGroup) ?? [];
    members.push(placement);
    byGroup.set(placement.domainGroup, members);
  }

  const domainGroups: DomainGroupRect[] = [];
  for (const [name, members] of byGroup) {
    let box = rects.get(name);
    if (!box) {
      // No rect: anchor on the members' current bounds, padded, so the group
      // lands where it already appears rather than jumping to the origin.
      let minX = Infinity;
      let minY = Infinity;
      for (const member of members) {
        minX = Math.min(minX, member.x);
        minY = Math.min(minY, member.y);
      }
      box = { x: minX - GROUP_PAD.left, y: minY - GROUP_PAD.top, width: 0, height: 0 };
    }
    const laid = await layoutGroupInPlace(model, members, elementsById, name, box, options);
    if (!laid) {
      result.push(...members);
      continue;
    }
    result.push(...laid.placements);
    domainGroups.push(laid.rect);
  }

  // Grow the board to fit whatever the pinned boxes now span (never shrink
  // below the floor — tidyCanvas holds it).
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of domainGroups) {
    maxX = Math.max(maxX, g.x + g.width);
    maxY = Math.max(maxY, g.y + g.height);
  }
  for (const placement of result) {
    const size = sizeOf(placement);
    maxX = Math.max(maxX, placement.x + size.width);
    maxY = Math.max(maxY, placement.y + size.height);
  }
  const { canvas } = settleBoard(
    (sizes) => ({
      width: maxX + sizes.externalSystems + INSET_X,
      height: maxY + sizes.management + INSET_Y,
    }),
    layoutConfig,
    // This board reaches the user, so an exhausted settle here IS the staircase
    // bug — but `neededFor` is monotone in the bands and the derived cap covers
    // it, so that would be a broken invariant to fix, not a case to branch on.
    // Hence `settled` discarded and the warning as the only trace.
    'tidyLandscapePinned',
  );

  return { placements: result, domainGroups, canvas };
}

/**
 * Re-attach each group's colour by name.
 *
 * Every path through Tidy REBUILDS the group rects from their members' bounds,
 * so a rect that comes back out of the layout is a fresh object that never had
 * the user's colour on it. Without this, the first Tidy after colouring a group
 * silently reverted it to neutral — the colour survived saving, reloading and
 * dragging, and died on the one button people press most.
 *
 * Matching on the name is safe here because Tidy never renames a group: the
 * names going in are the names coming out.
 */
function keepGroupColors(
  groups: DomainGroupRect[],
  layoutConfig: DiagramLayoutConfig | undefined,
): DomainGroupRect[] {
  const colors = new Map(
    (layoutConfig?.domainGroups ?? [])
      .filter((group) => group.color)
      .map((group) => [group.name, group.color as string]),
  );
  if (colors.size === 0) return groups;
  return groups.map((group) => {
    const color = colors.get(group.name);
    return color ? { ...group, color } : group;
  });
}


/**
 * The (box free, members pinned) cell of the matrix — item 2's new code, and the
 * most useful of the four.
 *
 * Each group is fed to ELK as a **single leaf node** carrying the group's current
 * size, so ELK arranges the GROUPS and never sees their members. The members are
 * then rigid-translated by (new box top-left − old box top-left): exactly the
 * translation `moveDomainGroup` already performs when a user drags a box, so the
 * two produce identical geometry by construction rather than by agreement.
 *
 * **A group with no stored rect is normal, not an edge case.** A domain group
 * exists as soon as a placement names it, while its rect only exists once a Tidy
 * or a drag wrote one. Its leaf size therefore comes from the members' current
 * bounding box plus `GROUP_PAD` — the same derivation the (free, free) cell uses
 * for group rects, and the same shape of answer `tidyLandscapePinned` gives to
 * the analogous gap on the pinned-position side.
 *
 * Loose ungrouped nodes ARE placed here. `pinGroups`'s carve-out exists because
 * with the boxes fixed there is nowhere to reflow a loose node to without walking
 * over one; in this cell the boxes move, so ELK can place the loose nodes too.
 */
async function tidyLandscapeGroupsAsLeaves(
  model: DesignModel,
  placements: DiagramPlacement[],
  elementsById: Map<ElementId, DesignElement>,
  layoutConfig: DiagramLayoutConfig | undefined,
  options: TidyOptions,
): Promise<{
  placements: DiagramPlacement[];
  domainGroups: DomainGroupRect[];
  canvas: { width: number; height: number };
}> {
  const sizeOf = (placement: DiagramPlacement) =>
    placementSize((elementsById.get(placement.elementId) as DesignElement).kind, placement);
  const rects = domainGroupRectMap(layoutConfig);

  const byGroup = new Map<string, DiagramPlacement[]>();
  const loose: DiagramPlacement[] = [];
  for (const placement of placements) {
    if (!placement.domainGroup) {
      loose.push(placement);
      continue;
    }
    const members = byGroup.get(placement.domainGroup) ?? [];
    members.push(placement);
    byGroup.set(placement.domainGroup, members);
  }

  /** The box a group occupies today: its stored rect, or its members' bounds padded. */
  const currentBox = (name: string, members: DiagramPlacement[]): Rect => {
    const stored = rects.get(name);
    if (stored && stored.width > 0 && stored.height > 0) return stored;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const member of members) {
      const size = sizeOf(member);
      minX = Math.min(minX, member.x);
      minY = Math.min(minY, member.y);
      maxX = Math.max(maxX, member.x + size.width);
      maxY = Math.max(maxY, member.y + size.height);
    }
    return {
      x: minX - GROUP_PAD.left,
      y: minY - GROUP_PAD.top,
      width: maxX - minX + GROUP_PAD.left + GROUP_PAD.right,
      height: maxY - minY + GROUP_PAD.top + GROUP_PAD.bottom,
    };
  };

  const boxes = new Map<string, Rect>();
  for (const [name, members] of byGroup) boxes.set(name, currentBox(name, members));

  const children: ElkChild[] = [
    ...[...boxes.entries()].map(([name, box]) => ({
      id: `${GROUP_PREFIX}${name}`,
      width: box.width,
      height: box.height,
    })),
    ...loose.map((placement) => ({ id: placement.elementId, ...sizeOf(placement) })),
  ];

  // Edges are lifted to the LEAF that stands in for each member's group, so a
  // cross-group connection still pulls its two boxes together. An edge whose ends
  // land on the same leaf would be a self-loop and is dropped — ELK has nothing to
  // do with it, and the members it connects are not moving relative to each other.
  const groupOfMember = new Map<ElementId, string>();
  for (const [name, members] of byGroup) {
    for (const member of members) groupOfMember.set(member.elementId, name);
  }
  const nodeFor = (id: ElementId): string | undefined => {
    const group = groupOfMember.get(id);
    if (group) return `${GROUP_PREFIX}${group}`;
    return loose.some((p) => p.elementId === id) ? id : undefined;
  };
  const edges: ElkEdgeSpec[] = [];
  for (const connection of model.connections) {
    const source = nodeFor(connection.sourceId);
    const target = nodeFor(connection.targetId);
    if (!source || !target || source === target) continue;
    const label = edgeLabelSize(connection);
    edges.push({ id: connection.id, source, target, ...(label ? { labels: [label] } : {}) });
  }

  const { positions } = await layoutGraph(
    children,
    edges,
    layoutOptionsFor(options, zoneRect('landscape', layoutConfig), children.length),
  );

  // Centre the arranged block in the landscape zone, exactly as the (free, free)
  // cell does, so a pinned-contents tidy does not park everything at the origin.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const child of children) {
    const pos = positions.get(child.id);
    if (!pos) continue;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + child.width);
    maxY = Math.max(maxY, pos.y + child.height);
  }
  const sizes = zoneSizes(layoutConfig);
  const blockWidth = Number.isFinite(minX) ? maxX - minX : 0;
  const blockHeight = Number.isFinite(minY) ? maxY - minY : 0;
  const estimate = clampCanvasSize({
    width: blockWidth + 2 * INSET_X + sizes.inputChannels + sizes.externalSystems,
    height: blockHeight + 2 * INSET_Y + sizes.actors + sizes.management,
  });
  const zone = zoneRect('landscape', { ...(layoutConfig ?? {}), canvas: estimate });
  const offset = Number.isFinite(minX)
    ? {
        x: zone.x + Math.max((zone.width - blockWidth) / 2, INSET_X) - minX,
        y: zone.y + Math.max((zone.height - blockHeight) / 2, INSET_Y) - minY,
      }
    : { x: 0, y: 0 };

  const result: DiagramPlacement[] = [];
  const domainGroups: DomainGroupRect[] = [];
  for (const [name, members] of byGroup) {
    const box = boxes.get(name) as Rect;
    const pos = positions.get(`${GROUP_PREFIX}${name}`);
    if (!pos) {
      result.push(...members);
      domainGroups.push({ name, ...box });
      continue;
    }
    // The rigid translate. Member positions are never recomputed — the interior
    // the user curated travels verbatim, which is the entire point of the option.
    const dx = pos.x + offset.x - box.x;
    const dy = pos.y + offset.y - box.y;
    for (const member of members) {
      result.push({ ...member, x: member.x + dx, y: member.y + dy });
    }
    domainGroups.push({ name, x: box.x + dx, y: box.y + dy, width: box.width, height: box.height });
  }
  for (const placement of loose) {
    const pos = positions.get(placement.elementId);
    result.push(
      pos ? { ...placement, x: pos.x + offset.x, y: pos.y + offset.y } : placement,
    );
  }

  let farX = -Infinity;
  let farY = -Infinity;
  for (const group of domainGroups) {
    farX = Math.max(farX, group.x + group.width);
    farY = Math.max(farY, group.y + group.height);
  }
  for (const placement of result) {
    const size = sizeOf(placement);
    farX = Math.max(farX, placement.x + size.width);
    farY = Math.max(farY, placement.y + size.height);
  }
  const canvas = clampCanvasSize({
    width: farX + sizes.externalSystems + INSET_X,
    height: farY + sizes.management + INSET_Y,
  });

  return { placements: result, domainGroups, canvas };
}

/**
 * The (box pinned, members pinned) cell: "tidy everything except my groups".
 *
 * Nothing in the landscape moves at all — boxes stay, members stay, loose nodes
 * stay (with the boxes fixed there is nowhere to reflow them to, the same reason
 * `pinGroups` leaves them alone). The value of the pass is everything AROUND the
 * landscape: the bands re-flow against the canvas and every edge is re-routed.
 */
function tidyLandscapeFullyPinned(
  placements: DiagramPlacement[],
  elementsById: Map<ElementId, DesignElement>,
  layoutConfig: DiagramLayoutConfig | undefined,
): {
  placements: DiagramPlacement[];
  domainGroups: DomainGroupRect[];
  canvas: { width: number; height: number };
} {
  const sizes = zoneSizes(layoutConfig);
  const domainGroups = [...domainGroupRectMap(layoutConfig).entries()].map(([name, rect]) => ({
    name,
    ...rect,
  }));
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const group of domainGroups) {
    maxX = Math.max(maxX, group.x + group.width);
    maxY = Math.max(maxY, group.y + group.height);
  }
  for (const placement of placements) {
    const size = placementSize(
      (elementsById.get(placement.elementId) as DesignElement).kind,
      placement,
    );
    maxX = Math.max(maxX, placement.x + size.width);
    maxY = Math.max(maxY, placement.y + size.height);
  }
  return {
    placements,
    domainGroups,
    canvas: clampCanvasSize({
      width: maxX + sizes.externalSystems + INSET_X,
      height: maxY + sizes.management + INSET_Y,
    }),
  };
}

async function tidyLandscape(
  model: DesignModel,
  placements: DiagramPlacement[],
  elementsById: Map<ElementId, DesignElement>,
  layoutConfig: DiagramLayoutConfig | undefined,
  options: TidyOptions,
): Promise<{
  placements: DiagramPlacement[];
  domainGroups: DomainGroupRect[];
  canvas: { width: number; height: number };
}> {
  // The four-cell matrix (see TidyOptions.pinGroupContents), resolved once here so
  // every path below knows exactly which cell it is in.
  if (options.pinGroups && options.pinGroupContents) {
    const fixed = tidyLandscapeFullyPinned(placements, elementsById, layoutConfig);
    return { ...fixed, domainGroups: keepGroupColors(fixed.domainGroups, layoutConfig) };
  }
  if (options.pinGroups) {
    const pinned = await tidyLandscapePinned(
      model,
      placements,
      elementsById,
      layoutConfig,
      options,
    );
    return { ...pinned, domainGroups: keepGroupColors(pinned.domainGroups, layoutConfig) };
  }
  if (options.pinGroupContents && placements.some((p) => p.domainGroup)) {
    const asLeaves = await tidyLandscapeGroupsAsLeaves(
      model,
      placements,
      elementsById,
      layoutConfig,
      options,
    );
    return { ...asLeaves, domainGroups: keepGroupColors(asLeaves.domainGroups, layoutConfig) };
  }

  // Waarom: the canvas is LANDSCAPE-driven — it grows/shrinks to fit the laid-out
  // block. Band-driven growth (e.g. many actors overflowing a fixed-width band)
  // is out of scope (U3/U4). With no landscape members, return the floor
  // (tidyCanvas raises { 0, 0 } to it) so a previously-inflated canvas
  // shrinks back.
  if (placements.length === 0) {
    return {
      placements: [],
      domainGroups: [],
      // A constant `neededFor` is its own fixed point whatever the bands do, so
      // this call reaches it on round two and cannot exhaust.
      canvas: settleBoard(() => ({ width: 0, height: 0 }), layoutConfig, 'tidyLandscape/empty')
        .canvas,
    };
  }

  const byGroup = new Map<string, ElkChild[]>();
  const loose: ElkChild[] = [];
  for (const placement of placements) {
    const element = elementsById.get(placement.elementId) as DesignElement;
    const size = placementSize(element.kind, placement);
    const child: ElkChild = { id: placement.elementId, ...size };
    if (placement.domainGroup) {
      const members = byGroup.get(placement.domainGroup) ?? [];
      members.push(child);
      byGroup.set(placement.domainGroup, members);
    } else {
      loose.push(child);
    }
  }

  // --- One ELK pass for the whole landscape. ---
  //
  // Every domain group becomes a compound node; with INCLUDE_CHILDREN (set in the
  // base layout options) ELK lays out all levels in a single run — members stay
  // clustered inside their group. Loose (ungrouped) placements are flat children. A
  // single global RIGHT flow: the layered algorithm still stacks within layers, so
  // the block is 2D, not one row.
  //
  // Edges are fed in even though we discard the routes ELK computes for them, and
  // that is NOT dead config — do not "clean it up". With `elk.edgeRouting:
  // ORTHOGONAL` and the label sizes, ELK reserves inter-layer channel space and
  // label room while PLACING, which is exactly the space libavoid then routes
  // through. Strip the edges and the layers pack tight enough that libavoid has
  // nowhere to put a line.
  const children: ElkChild[] = [
    ...[...byGroup.entries()].map(([group, members]) => ({
      id: `${GROUP_PREFIX}${group}`,
      width: 0,
      height: 0,
      children: members,
    })),
    ...loose,
  ];

  const memberIds = new Set(placements.map((p) => p.elementId));
  const edges: ElkEdgeSpec[] = model.connections
    .filter((c) => memberIds.has(c.sourceId) && memberIds.has(c.targetId))
    .map((c) => {
      const label = edgeLabelSize(c);
      return {
        id: c.id,
        source: c.sourceId,
        target: c.targetId,
        ...(label ? { labels: [label] } : {}),
      };
    });

  // Direction/density come from the session settings; `auto` reads the CURRENT
  // landscape zone (pre-growth), so the flow follows the board on screen.
  const { positions } = await layoutGraph(
    children,
    edges,
    layoutOptionsFor(options, zoneRect('landscape', layoutConfig), placements.length),
  );

  type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
  const grow = (b: Bounds | undefined, x: number, y: number, w: number, h: number): Bounds => {
    if (!b) return { minX: x, minY: y, maxX: x + w, maxY: y + h };
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x + w);
    b.maxY = Math.max(b.maxY, y + h);
    return b;
  };
  const sizeOf = (placement: DiagramPlacement) =>
    placementSize((elementsById.get(placement.elementId) as DesignElement).kind, placement);

  // Per-group member bounds in ELK's frame (pre-offset); loose nodes bound directly.
  // A group's box is member-derived (so a group still gets a box even when cross-
  // group edges make ELK drop compound treatment — U2).
  const elkGroupBounds = new Map<string, Bounds>();
  let block: Bounds | undefined;
  for (const placement of placements) {
    const pos = positions.get(placement.elementId);
    if (!pos) continue;
    const size = sizeOf(placement);
    const name = placement.domainGroup;
    if (name) {
      elkGroupBounds.set(name, grow(elkGroupBounds.get(name), pos.x, pos.y, size.width, size.height));
    } else {
      block = grow(block, pos.x, pos.y, size.width, size.height);
    }
  }
  // The block we CENTRE is the padded visual extent: each group box reaches
  // GROUP_PAD beyond its members, asymmetrically (48 above for the label pill vs
  // 28 elsewhere). Centring raw member bounds would push the top pad of the
  // highest group up into the actors band on a tall landscape; folding the padded
  // box in keeps every group box inside the landscape zone on all four sides.
  for (const b of elkGroupBounds.values()) {
    block = grow(
      block,
      b.minX - GROUP_PAD.left,
      b.minY - GROUP_PAD.top,
      b.maxX - b.minX + GROUP_PAD.left + GROUP_PAD.right,
      b.maxY - b.minY + GROUP_PAD.top + GROUP_PAD.bottom,
    );
  }

  const blockWidth = block ? block.maxX - block.minX : 0;
  const blockHeight = block ? block.maxY - block.minY : 0;
  const { canvas: estimate } = settleBoard(
    (sizes) => ({
      width: blockWidth + 2 * INSET_X + sizes.inputChannels + sizes.externalSystems,
      height: blockHeight + 2 * INSET_Y + sizes.actors + sizes.management,
    }),
    layoutConfig,
    // Only the bands on this board are used, to centre the block; the board the
    // caller gets is settled again below. Exhausting here misplaces the block,
    // it does not hand back a canvas that moves on the next press.
    'tidyLandscape/centring-estimate',
  );
  const zone = zoneRect('landscape', { ...(layoutConfig ?? {}), canvas: estimate });
  const offset = block
    ? {
        x: zone.x + Math.max((zone.width - blockWidth) / 2, INSET_X) - block.minX,
        y: zone.y + Math.max((zone.height - blockHeight) / 2, INSET_Y) - block.minY,
      }
    : { x: 0, y: 0 };

  // Final group boxes: the ELK-frame member bounds shifted by the shared offset,
  // grown outward by GROUP_PAD.
  const domainGroups: DomainGroupRect[] = [];
  for (const name of byGroup.keys()) {
    const b = elkGroupBounds.get(name);
    if (!b) continue;
    domainGroups.push({
      name,
      x: b.minX + offset.x - GROUP_PAD.left,
      y: b.minY + offset.y - GROUP_PAD.top,
      width: b.maxX - b.minX + GROUP_PAD.left + GROUP_PAD.right,
      height: b.maxY - b.minY + GROUP_PAD.top + GROUP_PAD.bottom,
    });
  }

  // Grow the canvas so the landscape zone contains EVERY final group box and node
  // rect (the landscape right/bottom edge = canvas minus the far band must clear
  // the content). settleBoard floors at the default — or the user's deliberately
  // smaller board — and caps at the ceiling.
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of domainGroups) {
    maxX = Math.max(maxX, g.x + g.width);
    maxY = Math.max(maxY, g.y + g.height);
  }
  for (const placement of placements) {
    const pos = positions.get(placement.elementId);
    if (!pos) continue;
    const size = sizeOf(placement);
    maxX = Math.max(maxX, pos.x + offset.x + size.width);
    maxY = Math.max(maxY, pos.y + offset.y + size.height);
  }
  const { canvas } = settleBoard(
    (sizes) => ({
      width: maxX + sizes.externalSystems + INSET_X,
      height: maxY + sizes.management + INSET_Y,
    }),
    layoutConfig,
    // The board the caller actually gets, and the same story as the pinned path:
    // monotone `neededFor` inside the cap, so `settled` is discarded rather than
    // branched on and the warning carries it.
    'tidyLandscape',
  );

  return {
    placements: placements.map((placement) => {
      const pos = positions.get(placement.elementId);
      if (!pos) return placement;
      return { ...placement, x: pos.x + offset.x, y: pos.y + offset.y };
    }),
    domainGroups: keepGroupColors(domainGroups, layoutConfig),
    canvas,
  };
}

/**
 * Tidy ONE domain group in place (right-click → "Tidy this group").
 *
 * ELK lays out just that group's members and the connections BETWEEN them; the
 * box stays anchored at its current top-left and is resized to hug the result.
 * Everything else — other groups, band nodes, the canvas size — is untouched,
 * so the result is {@link TidyResult.partial}. One commit, one undo step.
 *
 * Membership is by CONTAINMENT (the placement's centre lies in the box), the
 * same rule that assigns membership when an element is dropped (Layer7Canvas),
 * so what the user sees inside the box is what gets tidied.
 */
export async function tidyGroup(
  model: DesignModel,
  diagram: DesignDiagram,
  groupName: string,
  options: TidyOptions = DEFAULT_TIDY_OPTIONS,
): Promise<TidyResult> {
  const empty: TidyResult = { placements: [], partial: true };
  const groups = domainGroupRectMap(diagram.layoutConfig);
  const box = groups.get(groupName);
  if (!box) return empty;

  const elementsById = new Map(model.elements.map((e) => [e.id, e]));
  const members = diagram.placements.filter((placement) => {
    const element = elementsById.get(placement.elementId);
    if (!element || (placement.zone ?? 'landscape') !== 'landscape') return false;
    const size = placementSize(element.kind, placement);
    const centre = { x: placement.x + size.width / 2, y: placement.y + size.height / 2 };
    return domainGroupForPoint(centre, groups) === groupName;
  });

  const laid = await layoutGroupInPlace(model, members, elementsById, groupName, box, options);
  if (!laid) return empty;
  // The re-laid rect is a fresh object; carry the group's colour across.
  const rect = keepGroupColors([laid.rect], diagram.layoutConfig)[0];

  // Route against the WHOLE board, but own only the edges INSIDE the group. The two
  // must stay separate: the placements are the router's obstacle set, so cutting them
  // down to the members would hide every loose landscape card from tier 2 — and an
  // intra-group route is not confined to its box (see tier 2 in `libavoidRouter`), so
  // the first edge nudged out of the box would then be drawn blind through one.
  //
  // Edges CROSSING the box (one endpoint inside, one out) are excluded by
  // `memberIds`. Their inside endpoint moved, so a stored route may now look stale,
  // but a group tidy must not reach outside the box, and the result is `partial`, so
  // anything absent here is left untouched.
  const memberIds = new Set(laid.placements.map((placement) => placement.elementId));
  const laidById = new Map(laid.placements.map((placement) => [placement.elementId, placement]));
  const { edgeRoutes, routingError, skipped } = await routeOrDegrade(
    model,
    {
      ...diagram,
      placements: diagram.placements.map(
        (placement) => laidById.get(placement.elementId) ?? placement,
      ),
      layoutConfig: {
        ...(diagram.layoutConfig ?? {}),
        domainGroups: (diagram.layoutConfig?.domainGroups ?? []).map((g) =>
          g.name === groupName ? rect : g,
        ),
      },
    },
    'clear',
    memberIds,
    preservedRouteIds(diagram, options.pinAnchorPoints),
  );

  return {
    placements: laid.placements,
    domainGroups: [rect],
    edgeRoutes,
    routingError,
    skipped,
    partial: true,
  };
}

export async function tidyContainer(
  model: DesignModel,
  diagram: DesignDiagram,
  options: TidyOptions = DEFAULT_TIDY_OPTIONS,
): Promise<TidyResult> {
  const elementsById = new Map(model.elements.map((e) => [e.id, e]));
  const appId = diagram.applicationElementId;
  const components: ElkChild[] = [];
  const context: ElkChild[] = [];
  for (const placement of diagram.placements) {
    const element = elementsById.get(placement.elementId);
    if (!element || element.id === appId) continue;
    const child: ElkChild = { id: element.id, ...placementSize(element.kind, placement) };
    if (element.kind === 'component' && element.parentApplicationId === appId) {
      components.push(child);
    } else {
      context.push(child);
    }
  }

  // The application boundary is this diagram's single group, so the same matrix
  // applies (see TidyOptions.pinGroupContents), with "the boundary" for "a group":
  //
  //   pinned contents → the boundary is ONE LEAF at its current size, so the
  //     components inside keep their arrangement and only the surrounding context
  //     nodes are re-placed;
  //   otherwise → today's compound node, components laid out inside it.
  const boundaryPlacement = diagram.placements.find((p) => p.elementId === appId);
  const boundarySize = boundaryPlacement
    ? placementSize('application', boundaryPlacement)
    : { width: 0, height: 0 };
  const children: ElkChild[] = [...context];
  if (appId) {
    children.push(
      options.pinGroupContents
        ? { id: appId, ...boundarySize }
        : {
            id: appId,
            width: 0,
            height: 0,
            children:
              components.length > 0
                ? components
                : [{ id: `${GROUP_PREFIX}empty`, ...NODE_SIZES.component }],
          },
    );
  }

  const placedIds = new Set(diagram.placements.map((p) => p.elementId));
  // With the contents pinned the components are NOT in the graph — the boundary
  // is a single leaf — so an edge touching one has to be lifted to the boundary,
  // or ELK rejects the whole graph for referencing a shape that does not exist.
  // An edge between two components then has both ends on the boundary and is
  // dropped: it is a self-loop, and neither end is moving relative to the other.
  const componentIdSet = new Set(
    model.elements.filter((e) => e.kind === 'component' && e.parentApplicationId === appId).map((e) => e.id),
  );
  const graphNodeFor = (id: ElementId): ElementId =>
    options.pinGroupContents && appId && componentIdSet.has(id) ? appId : id;
  const edges: ElkEdgeSpec[] = model.connections
    .filter((c) => placedIds.has(c.sourceId) && placedIds.has(c.targetId))
    .map((c) => {
      const label = edgeLabelSize(c);
      return {
        id: c.id,
        source: graphNodeFor(c.sourceId),
        target: graphNodeFor(c.targetId),
        ...(label ? { labels: [label] } : {}),
      };
    })
    .filter((e) => e.source !== e.target);

  // A container diagram has no zones to read, so `auto` resolves to the RIGHT
  // default via a square reference box (never taller than wide).
  const { positions, groupSizes } = await layoutGraph(
    children,
    edges,
    layoutOptionsFor(options, { width: 1, height: 1 }, children.length),
  );

  // With the contents pinned, the boundary moved as one piece and its components
  // ride along by the same delta — the identical rigid translate the landscape's
  // (free box, pinned members) cell performs.
  const boundaryPos = appId ? positions.get(appId) : undefined;
  const pinnedDelta =
    options.pinGroupContents && boundaryPlacement && boundaryPos
      ? { x: boundaryPos.x - boundaryPlacement.x, y: boundaryPos.y - boundaryPlacement.y }
      : undefined;
  const componentIds = new Set(
    diagram.placements
      .map((p) => elementsById.get(p.elementId))
      .filter((e) => e?.kind === 'component' && e.parentApplicationId === appId)
      .map((e) => (e as DesignElement).id),
  );

  const placements = diagram.placements.map((placement) => {
    if (pinnedDelta && componentIds.has(placement.elementId)) {
      return { ...placement, x: placement.x + pinnedDelta.x, y: placement.y + pinnedDelta.y };
    }
    const pos = positions.get(placement.elementId);
    if (!pos) return placement;
    if (placement.elementId === appId) {
      // Size kept verbatim when the contents are pinned; otherwise ELK's compound
      // size, which hugs the components it just laid out.
      const size = options.pinGroupContents ? boundarySize : groupSizes.get(placement.elementId);
      return { ...placement, x: pos.x, y: pos.y, width: size?.width, height: size?.height };
    }
    return { ...placement, x: pos.x, y: pos.y };
  });
  // Route against the laid-out board, same seam as layer7. `routeDiagramEdges`
  // recognises a container diagram's application boundary and treats it as a
  // synthetic group — one opaque box from outside, transparent to the components
  // inside it — so a component↔context edge dodges the boundary while a
  // component↔component edge dodges only its siblings.
  //
  // `'clear'` for the same reason as layer7: this pass moved the components, so a
  // stored route for an edge the router declined is stale geometry.
  const { edgeRoutes, routingError, skipped } = await routeOrDegrade(
    model,
    { ...diagram, placements },
    'clear',
    undefined,
    preservedRouteIds(diagram, options.pinAnchorPoints),
  );
  return {
    placements,
    edgeRoutes,
    routingError,
    skipped,
  };
}
