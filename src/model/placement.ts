import type {
  DesignDiagram,
  DiagramMember,
  ElementId,
  ElementKind,
  DomainGroupRect,
  Layer7Zone,
  NodeGeometry,
  PlacedNode,
  Rect,
} from './types';
import type { NodeFigure } from './kinds';
import { zoneRect, zoneSizes } from './zones';
import type { BoardGeometry } from './zones';

/**
 * The kinds a canvas can draw — and it is the same three it always drew.
 *
 * A `layer7` board and a `container` board are geometry: a box has a position,
 * a size and a band. The business kinds are not drawn that way at all
 * (ADR-0012 §6) — a sheet is *laid out* from trees, order and depth, with no
 * drag, no router and no geometry file — so putting one on a canvas would be
 * asking for a coordinate for a thing whose place is decided by its parent.
 *
 * The actor is the exception and always was: it is a business kind by ADR-0012
 * §4 and it has stood in the top band of every landscape this tool has drawn.
 */
export const CANVAS_KINDS: readonly ElementKind[] & readonly CanvasKind[] =
  ['application', 'component', 'actor'];

/** One of {@link CANVAS_KINDS} — narrower than a kind, where a canvas is meant. */
export type CanvasKind = 'application' | 'component' | 'actor';

/**
 * Is a view of this kind a board — geometry a canvas draws (ADR-0012 §6)?
 *
 * The other two kinds are laid out, hold no members and are never the active
 * diagram: the shell opens them as pages over the canvas. One predicate,
 * because "does this scope draw anything" and "may a card go here" are the
 * same question, and a scope holding only a sheet was answering yes to both.
 */
export function isBoardKind(kind: DesignDiagram['kind']): boolean {
  return kind === 'layer7' || kind === 'container';
}

/** Why a kind cannot go on a view. A key, as every refusal from `model/` is. */
export type PlacementRefusal = 'placement.notOnACanvas';

export type PlacementCheck = { ok: true } | { ok: false; reason: PlacementRefusal };

/**
 * May a thing of this kind be put on a view of this sort?
 *
 * A **value**, not a throw and not a silent drop: the palette asks it to decide
 * what to offer, the agent asks it before minting a command, and both want a
 * reason they can say out loud. A model that already holds a function on a
 * landscape — a hand-edited file, a scope from a later build — is not made
 * illegal by this; it draws as best it can and this refuses the next one.
 */
export function canPlaceKind(
  kind: ElementKind,
  on: DesignDiagram['kind'],
): PlacementCheck {
  // A laid-out view has no members at all: what it draws is the trees, and a
  // member row would be a second place to keep the same fact — one the canvas
  // then drew as a column of cards when the scope had no board to show.
  if (!isBoardKind(on)) return { ok: false, reason: 'placement.notOnACanvas' };
  return CANVAS_KINDS.includes(kind)
    ? { ok: true }
    : { ok: false, reason: 'placement.notOnACanvas' };
}

/**
 * A view's members with where each ended up (ADR-0012 §6).
 *
 * The two halves are two files and two questions, and every drawing, routing
 * and hit-testing caller wants both at once — so this is the one place they
 * are put together, worked out once per diagram object rather than per read.
 * A member with no node row answers (0, 0): it is on the view and has not been
 * laid out, which is what `geometry.needsLayout` is for.
 */
export function placedNodes(diagram: Pick<DesignDiagram, 'members' | 'geometry'>): PlacedNode[] {
  const held = placed.get(diagram);
  if (held) return held;
  const geometry = new Map((diagram.geometry?.nodes ?? []).map((node) => [node.id, node]));
  const rows = (diagram.members ?? []).map((member) => joinOne(member, geometry.get(member.id)));
  placed.set(diagram, rows);
  return rows;
}

/**
 * One member joined to its node, keeping the object it had.
 *
 * Cached against the MEMBER rather than against the view, because that is what
 * carries identity: the reducer touches the row it names and copies nothing
 * else, so a member and a node that came through unchanged are the same two
 * objects on the other side — and the joined row they make has to be the same
 * object too, or `React.memo` has nothing to compare and every box on the
 * board repaints for a change that was nowhere near it.
 */
function joinOne(member: DiagramMember, node: NodeGeometry | undefined): PlacedNode {
  let byNode = joined.get(member);
  if (!byNode) {
    byNode = new WeakMap();
    joined.set(member, byNode);
  }
  const key = node ?? unplaced;
  const held = byNode.get(key);
  if (held) return held;
  const { id: _at, ...rest } = node ?? { id: member.id, x: 0, y: 0 };
  const row = { ...member, ...rest };
  byNode.set(key, row);
  return row;
}

/**
 * Member × node, both weakly held, so that any PAIR that has been joined once
 * keeps its object — an undo alternating between two node rows for the same
 * member must not hand back a fresh row every time.
 */
const joined = new WeakMap<DiagramMember, WeakMap<object, PlacedNode>>();
/** The stand-in key for a member nobody has laid out. */
const unplaced = {};

export function placedNode(
  diagram: Pick<DesignDiagram, 'members' | 'geometry'>, id: ElementId,
): PlacedNode | undefined {
  return placedNodes(diagram).find((node) => node.id === id);
}

// Safe because a diagram is never mutated: every writer returns a new one.
const placed = new WeakMap<object, PlacedNode[]>();

/** The member and node rows a placed node is made of, for a caller that writes. */
export function memberOf(node: PlacedNode): DiagramMember {
  const { x: _x, y: _y, width: _w, height: _h, ...member } = node;
  return member;
}

export function nodeGeometryOf(node: PlacedNode): NodeGeometry {
  const { zone: _z, group: _g, ...geometry } = node;
  return geometry;
}

/**
 * Canonical node sizes per figure, in flow pixels. Cards are fixed-size by
 * design (the boards read as a grid of equal cards); placements may still carry
 * explicit width/height (e.g. container boundaries) which win.
 *
 * Keyed by what the box IS DRAWN AS and not by what the element is (ADR-0012
 * §4): a chip in the input-channel band is 160×56 whether or not anything has
 * been said about who owns it, and the size follows the band the way the
 * drawing does. {@link ../model/kinds.nodeFigure} is the one place that answers
 * it; every caller here is handed the answer rather than re-deriving it.
 */
export const NODE_SIZES: Record<NodeFigure, { width: number; height: number }> = {
  application: { width: 200, height: 130 },
  component: { width: 200, height: 120 },
  actor: { width: 150, height: 48 },
  externalSystem: { width: 180, height: 96 },
  inputChannel: { width: 160, height: 56 },
  managementTool: { width: 160, height: 56 },
};

/**
 * Resize floors for the band nodes (2026-08). Landscape cards never go below
 * the canonical grid size (the board reads as a grid of equal cards), but a
 * band chip may shrink a little so a crowded band fits more of them — and
 * grow so a longer name or description fits.
 */
export const BAND_NODE_MIN: Record<
  Exclude<NodeFigure, 'application' | 'component'>,
  { width: number; height: number }
> = {
  actor: { width: 104, height: 40 },
  inputChannel: { width: 112, height: 44 },
  managementTool: { width: 112, height: 44 },
  externalSystem: { width: 140, height: 72 },
};

/**
 * Resize ceiling for a landscape node. Band nodes get a band-aware one from
 * {@link nodeMaxSize} instead.
 */
export const NODE_MAX_SIZE = { width: 480, height: 360 };

/** Smallest a node may be dragged: canonical for cards, a little under for band chips. */
export function nodeMinSize(figure: NodeFigure): { width: number; height: number } {
  return figure === 'application' || figure === 'component'
    ? NODE_SIZES[figure]
    : BAND_NODE_MIN[figure];
}

/**
 * Resize ceiling for a node, given the band it sits in.
 *
 * A band node used to inherit the landscape card's 480×360, which is 2.4× the
 * default actors band: growing an actor to read its description pushed the
 * node's centre out of the band, and the next drag re-derived `placement.zone`
 * from that centre and quietly moved it to the landscape. So the axis that
 * crosses the band stops at the band, while the axis running along it keeps the
 * card ceiling. Never below the node's own minimum — the external-systems band
 * may be narrower (120) than an external system's floor (140).
 */
export function nodeMaxSize(
  figure: NodeFigure,
  zone: Layer7Zone | undefined,
  geometry?: BoardGeometry,
): { width: number; height: number } {
  if (zone === undefined || zone === 'landscape') return NODE_MAX_SIZE;
  const band = zoneSizes(geometry)[zone];
  const min = nodeMinSize(figure);
  const acrossHeight = zone === 'actors' || zone === 'management';
  return {
    width: acrossHeight ? NODE_MAX_SIZE.width : Math.max(Math.min(NODE_MAX_SIZE.width, band), min.width),
    height: acrossHeight
      ? Math.max(Math.min(NODE_MAX_SIZE.height, band), min.height)
      : NODE_MAX_SIZE.height,
  };
}

/**
 * Description type scale per figure. The line clamp is derived from the line
 * height, so both live here: read from two places, a font-size change drifts
 * the clamp without anything failing.
 */
export const DESCRIPTION_TYPE: Record<NodeFigure, { fontSize: number; lineHeight: number }> = {
  application: { fontSize: 10, lineHeight: 1.3 },
  component: { fontSize: 9.5, lineHeight: 1.3 },
  externalSystem: { fontSize: 9.5, lineHeight: 1.3 },
  actor: { fontSize: 9, lineHeight: 1.3 },
  inputChannel: { fontSize: 9, lineHeight: 1.3 },
  managementTool: { fontSize: 9, lineHeight: 1.3 },
};

/**
 * Description lines a node shows: 2 at the canonical height (the original
 * fixed clamp), plus one line per extra line-height of resized height — so
 * growing a box actually reveals more of a longer description instead of
 * ellipsizing at two lines forever.
 */
export function descriptionLineClamp(figure: NodeFigure, height: number | undefined): number {
  const canonical = NODE_SIZES[figure].height;
  if (height === undefined || height <= canonical) return 2;
  const type = DESCRIPTION_TYPE[figure];
  return 2 + Math.floor((height - canonical) / (type.fontSize * type.lineHeight));
}

/**
 * Keep a band member inside its band, for when the board — and with it the band
 * — shrinks. The node slides back in, and a size the user set explicitly gives
 * way to the band; a node left at its canonical size keeps it, so shrinking the
 * board never invents a stored size. Returns undefined when nothing moves.
 */
export function clampPlacementIntoZone(
  placement: PlacedNode,
  figure: NodeFigure,
  geometry?: BoardGeometry,
): PlacedNode | undefined {
  if (placement.zone === undefined || placement.zone === 'landscape') return undefined;
  const band = zoneRect(placement.zone, geometry);
  const max = nodeMaxSize(figure, placement.zone, geometry);
  const width = placement.width === undefined ? undefined : Math.min(placement.width, max.width);
  const height = placement.height === undefined ? undefined : Math.min(placement.height, max.height);
  const size = placementSize(figure, { width, height });
  const clamp = (value: number, min: number, span: number) =>
    Math.min(Math.max(value, min), Math.max(min, min + span));
  const x = clamp(placement.x, band.x, band.width - size.width);
  const y = clamp(placement.y, band.y, band.height - size.height);
  const unchanged =
    x === placement.x &&
    y === placement.y &&
    width === placement.width &&
    height === placement.height;
  return unchanged ? undefined : { ...placement, x, y, width, height };
}

export function placementSize(
  figure: NodeFigure,
  placement?: Pick<NodeGeometry, 'width' | 'height'>,
): { width: number; height: number } {
  return {
    width: placement?.width ?? NODE_SIZES[figure].width,
    height: placement?.height ?? NODE_SIZES[figure].height,
  };
}

export function placementRect(figure: NodeFigure, placement: Omit<NodeGeometry, 'id'>): Rect {
  const size = placementSize(figure, placement);
  return { x: placement.x, y: placement.y, width: size.width, height: size.height };
}

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function rectContains(rect: Rect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

export function unionRects(rects: Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function expandRect(rect: Rect, padding: number): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

const ZONE_INSET = 28;
const CASCADE_GAP_X = 18;
const CASCADE_GAP_Y = 16;

/** Do two rectangles overlap (touching edges do not count)? */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

/**
 * The Nth slot of a left→right, wrapping cascade inside `area`, for a node of
 * `kind`. The shared geometry under the palette's default placement and the
 * "free spot" search below.
 */
export function cascadeSlot(
  area: Rect,
  figure: NodeFigure,
  index: number,
  inset: { x: number; y: number } = { x: ZONE_INSET, y: ZONE_INSET },
): { x: number; y: number } {
  const size = NODE_SIZES[figure];
  const usableWidth = Math.max(area.width - inset.x * 2, size.width);
  const perRow = Math.max(1, Math.floor(usableWidth / (size.width + CASCADE_GAP_X)));
  const row = Math.floor(index / perRow);
  const col = index % perRow;
  return {
    x: area.x + inset.x + col * (size.width + CASCADE_GAP_X),
    y: area.y + inset.y + row * (size.height + CASCADE_GAP_Y),
  };
}

/**
 * Deterministic flow-layout position for the Nth palette-added element of a
 * kind in a zone: fill left→right, wrap into rows. Pure so it is testable —
 * positions always land inside the zone band for sane counts.
 */
export function defaultZonePosition(
  zone: Layer7Zone,
  figure: NodeFigure,
  existingInZone: number,
  geometry?: BoardGeometry,
): { x: number; y: number } {
  return cascadeSlot(zoneRect(zone, geometry), figure, existingInZone);
}

/**
 * The first cascade slot in `area` that overlaps none of `occupied` — where a
 * node goes when it is MOVED into an area (the menu's "Move to zone" and
 * "Domain group"), as opposed to added to it. Counting the occupants, as the
 * palette does, assumes nobody has moved anything since; walking the slots
 * against the real rects does not. Falls back to the slot past the last
 * occupant when every slot is taken, which can only happen with an area too
 * small for its own contents.
 */
export function freeSlotIn(
  area: Rect,
  figure: NodeFigure,
  occupied: readonly Rect[],
  inset?: { x: number; y: number },
): { x: number; y: number } {
  const size = NODE_SIZES[figure];
  for (let index = 0; index <= occupied.length; index += 1) {
    const slot = cascadeSlot(area, figure, index, inset);
    const candidate: Rect = { ...slot, width: size.width, height: size.height };
    if (!occupied.some((rect) => rectsIntersect(candidate, rect))) return slot;
  }
  return cascadeSlot(area, figure, occupied.length, inset);
}

/** {@link freeSlotIn} for a Layer 7 band. */
export function freeZonePosition(
  zone: Layer7Zone,
  figure: NodeFigure,
  occupied: readonly Rect[],
  geometry?: BoardGeometry,
): { x: number; y: number } {
  return freeSlotIn(zoneRect(zone, geometry), figure, occupied);
}

/**
 * Default positions on a container diagram: components cascade inside the
 * boundary area; context elements (actors, external systems) cascade in a
 * column to the left of it.
 */
export function defaultContainerPosition(
  figure: NodeFigure,
  existingOfKindGroup: number,
): { x: number; y: number } {
  const size = NODE_SIZES[figure];
  if (figure === 'component') {
    const perRow = 3;
    const row = Math.floor(existingOfKindGroup / perRow);
    const col = existingOfKindGroup % perRow;
    return {
      x: 80 + col * (size.width + 40),
      y: 80 + row * (size.height + 48),
    };
  }
  return { x: -280, y: 40 + existingOfKindGroup * (size.height + 32) };
}

/** Never let a group box get so small it cannot hold a card. */
export const MIN_GROUP_SIZE = 120;
/** Air between a group's members and its border when the box is drawn around them. */
export const GROUP_AROUND_PADDING = 28;
/** Extra room above the members for the name pill, which sits on the top edge. */
export const GROUP_LABEL_ROOM = 14;

/**
 * A box that hugs `memberRects` — "Group into new domain group" from a
 * selection, and the box an agent's `group` draws. Padded all round, with a
 * little more on top for the label pill. Undefined for an empty selection:
 * there is nothing to draw around.
 */
export function groupRectAround(memberRects: readonly Rect[]): Rect | undefined {
  const union = unionRects([...memberRects]);
  if (!union) return undefined;
  const padded = expandRect(union, GROUP_AROUND_PADDING);
  return {
    ...padded,
    y: padded.y - GROUP_LABEL_ROOM,
    height: Math.max(padded.height + GROUP_LABEL_ROOM, MIN_GROUP_SIZE),
    width: Math.max(padded.width, MIN_GROUP_SIZE),
  };
}

/**
 * Domain groups are explicit rectangles stored in the diagram's layoutConfig
 * (iteration 2 — they used to be derived from member bounding boxes), keyed by
 * the group's own id (ADR-0012 §6). Membership is assigned by containment when
 * an element is dragged.
 */
export function domainGroupRectMap(boxes?: readonly DomainGroupRect[]): Map<string, Rect> {
  const result = new Map<string, Rect>();
  for (const group of boxes ?? []) {
    result.set(group.id, { x: group.x, y: group.y, width: group.width, height: group.height });
  }
  return result;
}

/**
 * Which domain group a dropped point joins, by id. With overlapping groups the
 * smallest containing rectangle wins (ties broken by id) so the result is
 * deterministic. Returns undefined when the point is in open landscape.
 */
export function domainGroupForPoint(
  point: { x: number; y: number },
  groupRects: Map<string, Rect>,
): string | undefined {
  let best: { id: string; area: number } | undefined;
  for (const [id, rect] of groupRects) {
    if (!rectContains(rect, point)) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area || (area === best.area && id < best.id)) {
      best = { id, area };
    }
  }
  return best?.id;
}

/** Where an element is RIGHT NOW, mid-gesture — not where the model says it is. */
export interface LivePlacement {
  id: ElementId;
  x: number;
  y: number;
}

/**
 * The same diagram with `moves` applied to its placements.
 *
 * This is how in-flight drag positions reach the router, and the choice is
 * deliberate: nothing is committed while a node is being dragged, so a routing pass
 * cannot read the moving card's rect out of the diagram — the model still holds the
 * position the card left. Rather than teach `routeDiagramEdges` about drags with a
 * live-rects parameter, the caller hands it a diagram that already says where things
 * are. See `docs/decisions/2026-08-08-drag-live-rects-enter-as-a-preview-diagram.md`.
 *
 * That makes the preview-equals-drop invariant structural rather than maintained:
 * the drop commits these very positions, so the drag-end pass is handed a diagram
 * equal to the one the preview last routed, and equal inputs to the same pure
 * function give equal geometry. An override map alongside the placements would be
 * two ways to say where a node is, and keeping them agreeing would be a rule
 * somebody has to remember.
 *
 * Pure, and returns the INPUT unchanged when nothing moved — a moved-nowhere gesture
 * must not invalidate a memo or spend a routing pass. Position only: a drag never
 * changes a card's size, and `placementSize` still resolves it from the kind.
 */
export function diagramWithLivePlacements(
  diagram: DesignDiagram,
  moves: readonly LivePlacement[],
): DesignDiagram {
  if (moves.length === 0) return diagram;
  const byId = new Map(moves.map((move) => [move.id, move]));
  let changed = false;
  const nodes = (diagram.geometry?.nodes ?? []).map((node) => {
    const move = byId.get(node.id);
    if (!move || (node.x === move.x && node.y === move.y)) return node;
    changed = true;
    return { ...node, x: move.x, y: move.y };
  });
  return changed ? { ...diagram, geometry: { ...diagram.geometry, nodes } } : diagram;
}
