import type {
  DesignConnection,
  DesignDiagram,
  DesignModel,
  DomainGroupRect,
  EdgeRoute,
  ElementId,
  Point,
  Rect,
} from '../types';
import { placementSize } from '../model/placement';
import { routeSides } from '../model/routes';
import { edgeLabelSize } from './edgeLabelSize';
import { labelSpotFor, rectCentre, rectContainsPoint } from './routing';
import { routeWithLibavoid, type RouterNode } from './libavoidRouter';
import type { TidyResult } from './tidy';

/**
 * What to do with a connection the router DECLINED to route (see the branch in
 * {@link routeDiagramEdges} that acts on it).
 *
 * - `keep-stored` — re-emit the stored route verbatim. Correct only for a caller that
 *   did not move the nodes, because it is asserting the stored geometry still fits.
 * - `clear` — emit empty waypoints, i.e. "draw it straight". Correct for a caller that
 *   HAS moved the nodes, because the stored waypoints were measured against positions
 *   that no longer exist.
 */
export type DeclinedPolicy = 'keep-stored' | 'clear';

/**
 * Route every edge on a diagram around the obstacles in its way, leaving the nodes
 * exactly where they are. **The one routing entry point in this package**: the
 * toolbar's "route connections only" action calls it directly, and `tidy.ts` calls
 * it as its own final step once placement is settled, so a tidied board and a
 * hand-nudged board are routed by the same code against the same obstacle set.
 *
 * Standalone it is the pass to run after nudging nodes by hand, when a full Tidy
 * would throw the manual layout away.
 *
 * The routing itself belongs to `libavoidRouter`: this module's whole job is to
 * translate the diagram into that adapter's rects-in/polylines-out vocabulary and
 * to pin the labels afterwards. Async because the router is WASM. Deterministic —
 * the adapter derives its own canonical insertion order from ids, so the same
 * model always yields the same routes even though the model's array order is not
 * a stable key.
 *
 * Two translation decisions are load-bearing:
 *
 * 1. **Group membership is GEOMETRIC, not by element domain.** A node belongs to
 *    the group box that contains its centre, whatever its `domainGroup` field
 *    says. That matches what the user actually sees: group boxes are only
 *    recomputed by a full Tidy, so after a manual nudge a node's domain field and
 *    its on-screen position can disagree — and route-only exists precisely to run
 *    on a hand-nudged board. Boxes may overlap, so a centre inside more than one
 *    box picks the first by NAME, never by array order, to stay deterministic.
 * 2. **A container diagram's application boundary is a synthetic group**, not an
 *    ordinary node. Its placement rect CONTAINS its components' placements, so
 *    feeding it in as a node would make it an opaque obstacle and bow every
 *    component↔context edge around the entire boundary — deliberate deviation #3
 *    of `docs/plans/2026-06-10-solution-design/edge-routing/2026-07-24-edge-routing-plan.md`,
 *    the bug we are not reintroducing. As a group it is one opaque box to tier 1
 *    while tier 2 routes the internals.
 *
 * The result is a {@link TidyResult} carrying routes ONLY: `placements` is empty
 * (a verified no-op in `overlayWithPlacements`) and `canvas`/`domainGroups` are
 * omitted, so `applyTidyResult` commits the whole re-route as ONE undo step
 * without touching positions or layout config.
 *
 * `whenDeclined` is the ONE behaviour the two callers must not share; see the branch
 * that reads it. It defaults to route-only's answer because route-only is the caller
 * that runs on a board it did not touch.
 *
 * `routeOnlyBetween` narrows which connections this pass OWNS without narrowing the
 * board it routes against — the seam a per-group Tidy needs. The `diagram` always
 * carries every placement, because those placements are the obstacle set; a caller
 * that only wants some edges re-routed passes the endpoint ids it owns here rather
 * than trimming `placements`, which would silently take the obstacles with it.
 *
 * `preserveRoutesFor` is a THIRD, distinct narrowing, and the distinction is the
 * whole reason it exists rather than reusing one of the other two:
 *
 * - **`keep-stored` does not do this job.** It is a *declined*-connection policy —
 *   it re-emits a stored route only in the branch where the router refuses the
 *   connection. A connection the router DOES route, which is the normal case and
 *   the entire point of a reroute, has its fresh waypoints written straight over
 *   the stored ones.
 * - **`routeOnlyBetween` does not either**, and its reason is instructive: it keeps
 *   unowned connectors OUT of the router, so excluding a preserved route that way
 *   would stop it pushing the other routes off itself and they would land on top
 *   of it.
 *
 * So a preserved connector goes into the router like any other and only its EMIT
 * is skipped: the stored route comes back verbatim — waypoints, label anchor and
 * provenance — and its chip joins `pinnedChips` so the edges routed after it dodge
 * the chip where it actually is. That last part is why the exclusion has to live
 * here and not at the apply step: `applyTidyResult` cannot retroactively move a
 * label the router already placed on top of a preserved chip.
 *
 * One limitation to name rather than discover: the other routes are nudged clear of
 * where **libavoid** would have routed the preserved connector, not of where its
 * stored waypoints actually run. On a route the user has dragged far from its
 * computed path, a neighbour can therefore still cross it. Correct separation would
 * mean feeding the stored polyline back in as an obstacle, which libavoid-js does
 * not expose. Acceptable: the user moved that line on purpose and can move it again.
 */
export async function routeDiagramEdges(
  model: DesignModel,
  diagram: DesignDiagram,
  whenDeclined: DeclinedPolicy = 'keep-stored',
  routeOnlyBetween?: ReadonlySet<ElementId>,
  preserveRoutesFor?: ReadonlySet<string>,
): Promise<TidyResult> {
  const elementsById = new Map(model.elements.map((e) => [e.id, e]));
  const rectById = new Map<ElementId, Rect>();
  for (const placement of diagram.placements) {
    const element = elementsById.get(placement.elementId);
    if (!element) continue;
    const size = placementSize(element.kind, placement);
    rectById.set(placement.elementId, {
      x: placement.x,
      y: placement.y,
      width: size.width,
      height: size.height,
    });
  }

  // The boxes the ROUTER groups nodes into: a layer7 diagram's domain groups, or a
  // container diagram's application boundary standing in for itself (see 2. above).
  const domainGroups: DomainGroupRect[] = diagram.layoutConfig?.domainGroups ?? [];
  const boundaryId = diagram.kind === 'container' ? diagram.applicationElementId : undefined;
  const boundaryBox = boundaryId === undefined ? undefined : rectById.get(boundaryId);
  const routerGroups: DomainGroupRect[] =
    boundaryId !== undefined && boundaryBox ? [{ name: boundaryId, ...boundaryBox }] : domainGroups;

  const nodes: RouterNode[] = [];
  for (const [id, rect] of rectById) {
    // The boundary is represented by its synthetic group, never also as a node —
    // an obstacle enclosing its own members breaks both tiers at once.
    if (id === boundaryId) continue;
    nodes.push({ id, rect, domainGroup: groupContaining(routerGroups, rect)?.name });
  }

  // The connections this pass owns (see `routeOnlyBetween`). Kept out of the router
  // as well as out of the result: a connector we are not going to emit would still
  // nudge the ones we are.
  const owned = routeOnlyBetween
    ? model.connections.filter(
        (c) => routeOnlyBetween.has(c.sourceId) && routeOnlyBetween.has(c.targetId),
      )
    : model.connections;

  const storedRoutes = new Map((diagram.edgeRoutes ?? []).map((r) => [r.connectionId, r]));

  // The attach sides ride along from the stored rows: they are constraints the
  // router honours (a pinned end), not geometry it replaces — so a row that holds
  // nothing but a side is still routed, and routed out of the side it names.
  const { routes, skipped } = await routeWithLibavoid({
    nodes,
    groups: routerGroups,
    connections: owned.map((c) => ({
      id: c.id,
      sourceId: c.sourceId,
      targetId: c.targetId,
      ...routeSides(storedRoutes.get(c.id)),
    })),
  });

  // Label pinning keeps the inputs it has always had: the REAL group boxes (a
  // container diagram has none) must be cleared, every node rect — the boundary
  // included — is preferred. The synthetic group is a routing device and would
  // otherwise forbid every label inside the boundary.
  //
  // The box an edge lives INSIDE gets the same carve-out, for the same reason.
  // `labelSpotFor` treats its group boxes as a hard requirement, so on an edge whose
  // whole path is inside one box every sampled spot fails it and the edge comes back
  // with no `labelPosition` at all. On a grouped layer7 board most edges are
  // intra-group, and an unpinned chip auto-centres (so it can sit on a member card)
  // and never joins `pinnedChips` (so the chip-vs-chip avoidance below never sees
  // it). Its own box is dropped from the preferred set too: keeping it there would
  // make the "clears everything" tier unreachable and take the node rects down with
  // it, which is the overlap we are trying to avoid in the first place.
  const nodeRects: Rect[] = [...rectById.values()];
  const groupRects: Rect[] = domainGroups.map(rectOf);
  const groupOfNode = new Map<ElementId, string | undefined>();
  for (const [id, rect] of rectById) groupOfNode.set(id, groupContaining(domainGroups, rect)?.name);
  // Cached per owning group: the board has a handful of groups and potentially many
  // connections, and the rect lists do not depend on the connection.
  const labelRefsByOwner = new Map<string | undefined, { clearOf: Rect[]; gapRefs: Rect[] }>();
  const labelRefsFor = (owner: string | undefined) => {
    let refs = labelRefsByOwner.get(owner);
    if (!refs) {
      const gapRefs =
        owner === undefined
          ? groupRects
          : domainGroups.filter((g) => g.name !== owner).map(rectOf);
      refs = { gapRefs, clearOf: [...gapRefs, ...nodeRects] };
      labelRefsByOwner.set(owner, refs);
    }
    return refs;
  };
  /** The group box an edge sits wholly inside, if both its ends are in the same one. */
  const ownerOf = (conn: DesignConnection): string | undefined => {
    const source = groupOfNode.get(conn.sourceId);
    return source !== undefined && source === groupOfNode.get(conn.targetId) ? source : undefined;
  };

  // Chips pinned so far, so each label can also dodge its neighbours' — see
  // `labelSpotFor`. Greedy, so the ORDER decides who gets first pick of a crowded
  // channel: canonical id order, the same key the router sorts by, because the
  // model's array order is not stable (adding an element reorders it) and the same
  // board must always produce the same chips. It also fixes the order of
  // `edgeRoutes` itself; `applyTidyResult` keys by connection id, so nothing
  // downstream cares which order the entries arrive in.
  const pinnedChips: Rect[] = [];
  const connections = [...owned].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const edgeRoutes: EdgeRoute[] = [];
  /**
   * Re-emit a preserved route verbatim and reserve its chip. Returns false when
   * there is nothing stored to preserve, so the caller falls through to the
   * normal emit — "protect this connection" and "this connection has geometry
   * worth protecting" are different facts.
   */
  const emitPreserved = (conn: DesignConnection): boolean => {
    const stored = storedRoutes.get(conn.id);
    if (!stored) return false;
    edgeRoutes.push({
      connectionId: conn.id,
      waypoints: stored.waypoints,
      labelPosition: stored.labelPosition,
      source: stored.source,
      // The pin is what keeps a bend-less pinned row alive through the apply
      // step; dropping it here would unpin the line on every live pass.
      pinned: stored.pinned,
      // The sides likewise: constraints the user set, re-emitted with the row.
      ...routeSides(stored),
    });
    // The chip stays where the user put it, so every edge routed after this one
    // has to treat it as occupied board space — exactly like a freshly pinned one.
    const chip = chipAt(conn, stored.labelPosition);
    if (chip) pinnedChips.push(chip);
    return true;
  };

  for (const conn of connections) {
    const source = rectById.get(conn.sourceId);
    const target = rectById.get(conn.targetId);
    if (!source || !target) continue; // an endpoint is not on this diagram

    // Checked BEFORE the router's answer is read, so it holds whether the router
    // routed this connection or declined it. The connector was still handed to
    // the router (see the docblock) — only the result is discarded.
    if (preserveRoutesFor?.has(conn.id) && emitPreserved(conn)) continue;

    const waypoints = routes.get(conn.id);
    if (!waypoints) {
      // DECLINED: no entry at all in the router's map. Both endpoints are on this
      // diagram (checked above), so this is a self-connection, a node dropped for
      // unsafe geometry, or a tier over `MAX_CONNECTORS_PER_TIER`. An entry with an
      // EMPTY array is a different thing entirely — routed, and the answer is "draw
      // it straight".
      //
      // What to do about it depends on whether the CALLER moved the nodes, which is
      // why `whenDeclined` is a parameter and not a constant. Do not unify the two
      // branches — the asymmetry is the whole point:
      //
      // - `keep-stored` (route-only): nothing moved, so the stored route is still
      //   valid geometry for the board the user is looking at. Re-emit it verbatim so
      //   the pass can never make a diagram worse than the user left it. With nothing
      //   stored there is nothing to preserve, and omitting the entry leaves the edge
      //   exactly as it is.
      // - `clear` (Tidy): every node has just been repositioned, so a stored route is
      //   waypoints measured against positions that no longer exist — it would draw a
      //   bend around empty space, or through a node that moved into it. Emit empty
      //   waypoints so the edge falls back to a straight line, which is at least
      //   geometry that matches the board.
      if (whenDeclined === 'clear') {
        // The bends go; the attach sides stay, because they were never measured
        // against a position — a constraint survives the reflow that voids the geometry.
        edgeRoutes.push({
          connectionId: conn.id,
          waypoints: [],
          source: 'auto',
          ...routeSides(storedRoutes.get(conn.id)),
        });
        continue;
      }
      // Same re-emit as a preserved route, for a different reason: there, the
      // caller asked us not to touch it; here, the router had no answer to give.
      // With nothing stored there is nothing to preserve, and omitting the entry
      // leaves the edge exactly as it is.
      emitPreserved(conn);
      continue;
    }

    // Pin the label clear of every group box the edge does not live in (required),
    // every node rect (preferred) and every chip pinned before it — for straight
    // edges too, so a chip that would auto-centre on top of a group box gets moved
    // off it. Straight edges still emit EMPTY waypoints, so they stay handle-free
    // floating edges.
    const { clearOf, gapRefs } = labelRefsFor(ownerOf(conn));
    const labelPosition = labelSpotFor(
      conn,
      source,
      target,
      waypoints,
      clearOf,
      gapRefs,
      pinnedChips,
    );
    // The router computed this one, so it is `auto`: handle-free, drawn at the
    // larger radius, and replaceable by the next automatic pass. The sides it was
    // routed under come back with it, or the next pass would route it free.
    edgeRoutes.push({
      connectionId: conn.id,
      waypoints,
      labelPosition,
      source: 'auto',
      ...routeSides(storedRoutes.get(conn.id)),
    });
    const chip = chipAt(conn, labelPosition);
    if (chip) pinnedChips.push(chip);
  }

  return { placements: [], edgeRoutes, skipped };
}

/**
 * The rect a pinned chip occupies, centred on `at` — the shape `FloatingEdge`
 * renders and therefore the shape later chips have to avoid. `undefined` when the
 * connection carries no label or was never pinned (an auto-centred chip moves with
 * whatever the edge does, so there is no fixed rect to reserve for it).
 */
function chipAt(conn: DesignConnection, at: Point | undefined): Rect | undefined {
  const size = at && edgeLabelSize(conn);
  if (!size || !at) return undefined;
  return {
    x: at.x - size.width / 2,
    y: at.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

const rectOf = (group: DomainGroupRect): Rect => ({
  x: group.x,
  y: group.y,
  width: group.width,
  height: group.height,
});

/**
 * The group box a node sits in, by its centre. Ordered by name first so an
 * overlap resolves the same way on every run regardless of array order.
 */
function groupContaining(groups: DomainGroupRect[], rect: Rect): DomainGroupRect | undefined {
  const centre = rectCentre(rect);
  let found: DomainGroupRect | undefined;
  for (const group of groups) {
    if (!rectContainsPoint(rectOf(group), centre)) continue;
    if (found === undefined || group.name < found.name) found = group;
  }
  return found;
}
