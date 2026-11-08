// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type {
  DesignDiagram,
  DesignElement,
  DiagramMember,
  ElementId,
  ElementKind,
  DomainGroupRect,
  Layer7Zone,
  NodeGeometry,
  PlacedNode,
  Point,
  Rect,
} from './types';
import { nodeFigure } from './kinds';
import type { NodeFigure } from './kinds';
import { HOME_ZONE, zoneRect, zoneSizes } from './zones';
import type { BoardGeometry } from './zones';

/**
 * The kinds a canvas can draw — the three it always drew, and the platform.
 *
 * A `layer7` board and a `container` board are geometry: a box has a position,
 * a size and a band. The business kinds are not drawn that way at all
 * (ADR-0012 §6) — a sheet is *laid out* from trees, order and depth, with no
 * drag, no router and no geometry file — so putting one on a canvas would be
 * asking for a coordinate for a thing whose place is decided by its parent.
 *
 * The actor is the exception and always was: it is a business kind by ADR-0012
 * §4 and it has stood in the top band of every landscape this tool has drawn.
 * The platform is drawn because the management band already drew it (ADR-0013):
 * the forge and the monitoring in that band were platforms wearing an
 * application's kind, and a card there is how a landscape says what it stands
 * on. The rows that join an application to one are not drawn — the technology
 * view lists them — so a platform on a board is a card and never a line's end.
 * The service a platform realises is the same chip (ADR-0014), for the same
 * reason and with the same rows: what is offered is drawn where what delivers
 * it is drawn.
 */
export const CANVAS_KINDS: readonly ElementKind[] & readonly CanvasKind[] =
  ['application', 'component', 'actor', 'platform', 'platformService', 'buildingBlock'];

/** One of {@link CANVAS_KINDS} — narrower than a kind, where a canvas is meant. */
export type CanvasKind = 'application' | 'component' | 'actor' | 'platform' | 'platformService' | 'buildingBlock';

/**
 * Is a view of this kind a board — geometry a canvas draws (ADR-0012 §6)?
 *
 * The other kinds are laid out, hold no members and are never the active
 * diagram: the shell opens them as pages over the canvas. One predicate,
 * because "does this scope draw anything" and "may a card go here" are the
 * same question, and a scope holding only a sheet was answering yes to both.
 */
export function isBoardKind(kind: DesignDiagram['kind']): boolean {
  switch (kind) {
    case 'layer7':
    case 'container':
      return true
    // A sheet, a map, a technology view, a drawing, an organisation chart
    // and a Conway map are not boards.
    case 'sheet':
    case 'map':
    case 'technology':
    case 'drawing':
    case 'chart':
    case 'conway':
      return false
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
}

/**
 * The others: laid out from the model, no geometry (ADR-0012 §6, ADR-0015,
 * and the organisation chart and the Conway map of ADR-0036 §7). Since
 * ADR-0016 one of these can be the active view as readily as a board — it is
 * drawn in the tab, not over it — so "is this a board" and "can this be open"
 * are two questions again, and this is the second.
 */
export function isLaidOutKind(kind: DesignDiagram['kind']): boolean {
  switch (kind) {
    case 'sheet':
    case 'map':
    case 'technology':
    case 'chart':
    case 'conway':
      return true
    // A board is geometry. A drawing is the XML. Neither is laid out.
    case 'layer7':
    case 'container':
    case 'drawing':
      return false
    default: {
      const unexpected: never = kind
      return unexpected
    }
  }
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
  actor: { width: 150, height: 56 },
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
 * Keep one band member inside its band. The node slides back in, and a size the
 * user set explicitly gives way to the band; a node left at its canonical size
 * keeps it, so this never invents a stored size. Returns undefined when nothing
 * moves. A whole band is {@link refitBand}'s, because this answers each card
 * alone and every card past an edge the same.
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

/**
 * A band's members after the board changed under them, as the placements that
 * have to change.
 *
 * Each card alone in {@link clampPlacementIntoZone} is the wrong question for
 * more than one of them: every card past an edge is sent to that edge, so a
 * shrink lands a row on one spot, and a bottom band moved by a taller board
 * flattens its rows onto its top line. So a card that still fits stays exactly
 * where it is, and the ones that do not move as what they are: by what the band
 * itself moved, then together as far as it takes to bring them in, drawn closer
 * together on an axis the band has become too short for. Only when that lands
 * on another card does each take the nearest free place ({@link spotNear}).
 */
export function refitBand(
  members: readonly { placement: PlacedNode; figure: NodeFigure }[],
  before: BoardGeometry | undefined,
  after: BoardGeometry | undefined,
): PlacedNode[] {
  const byZone = new Map<Layer7Zone, (typeof members)[number][]>();
  for (const member of members) {
    const zone = member.placement.zone;
    if (zone === undefined || zone === 'landscape') continue;
    const held = byZone.get(zone);
    if (held) held.push(member);
    else byZone.set(zone, [member]);
  }
  return [...byZone].flatMap(([zone, held]) => refitOneBand(zone, held, before, after));
}

function refitOneBand(
  zone: Layer7Zone,
  members: readonly { placement: PlacedNode; figure: NodeFigure }[],
  before: BoardGeometry | undefined,
  after: BoardGeometry | undefined,
): PlacedNode[] {
  const band = zoneRect(zone, after);
  const was = zoneRect(zone, before);
  const staying: Rect[] = [];
  const stranded: { sized: PlacedNode; rect: Rect }[] = [];
  for (const { placement, figure } of members) {
    const clamped = clampPlacementIntoZone(placement, figure, after);
    if (!clamped) {
      staying.push(placementRect(figure, placement));
      continue;
    }
    const size = placementSize(figure, clamped);
    stranded.push({
      sized: clamped,
      rect: { x: placement.x + band.x - was.x, y: placement.y + band.y - was.y, ...size },
    });
  }
  const block = unionRects(stranded.map(({ rect }) => rect));
  if (!block) return [];

  const together = stranded.map(({ rect }) => ({
    ...rect,
    x: fitAlong(rect.x, rect.width, block.x, block.width, band.x, band.width),
    y: fitAlong(rect.y, rect.height, block.y, block.height, band.y, band.height),
  }));
  const squeezed = block.width > band.width || block.height > band.height;
  const clear =
    !together.some((rect) => staying.some((other) => rectsIntersect(rect, other))) &&
    // A squeeze must not make an overlap. Without one the cards are what they
    // were to each other, and an overlap they had is theirs.
    !(squeezed && together.some((rect, i) => together.slice(i + 1).some((other) => rectsIntersect(rect, other))));
  if (clear) return stranded.map(({ sized }, i) => ({ ...sized, x: together[i].x, y: together[i].y }));

  // One at a time, in reading order, each clear of the cards already settled.
  const taken = [...staying];
  return stranded
    .map(({ sized }, i) => ({ sized, rect: together[i] }))
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .map(({ sized, rect }) => {
      const spot = spotNear(rect, band, taken);
      taken.push({ ...rect, ...spot });
      return { ...sized, ...spot };
    });
}

/**
 * Where a card lands on one axis when the block it is part of is brought inside
 * the band: the one shift that does it, or, on a band shorter than the block,
 * the same fraction of the way along the band as it was along the block.
 */
function fitAlong(
  at: number, length: number,
  blockAt: number, blockLength: number,
  bandAt: number, bandLength: number,
): number {
  if (blockLength <= bandLength) {
    return at + Math.min(Math.max(blockAt, bandAt), bandAt + bandLength - blockLength) - blockAt;
  }
  if (length >= bandLength || length >= blockLength) return bandAt;
  return bandAt + ((at - blockAt) * (bandLength - length)) / (blockLength - length);
}

/**
 * The place nearest `rect` for a card of its size, inside `area`, that overlaps
 * none of `occupied`. It looks on a lattice a card and a gap apart from the
 * area's corner, which is what gets the most rows out of a shallow band. When
 * that has no room left, a finer one's least covered place answers: a band too
 * small for its cards still shows each of them, overlapping.
 */
export function spotNear(rect: Rect, area: Rect, occupied: readonly Rect[]): { x: number; y: number } {
  const target = {
    x: Math.max(Math.min(rect.x, area.x + area.width - rect.width), area.x),
    y: Math.max(Math.min(rect.y, area.y + area.height - rect.height), area.y),
  };
  const best = (divide: number) => {
    const xs = latticeStops(area.x, area.x + area.width - rect.width, (rect.width + CASCADE_GAP_X) / divide);
    const ys = latticeStops(area.y, area.y + area.height - rect.height, (rect.height + CASCADE_GAP_Y) / divide);
    let found = { ...target, covered: Infinity, away: Infinity };
    for (const x of xs) {
      for (const y of ys) {
        let covered = 0;
        for (const other of occupied) {
          const wide = Math.min(x + rect.width, other.x + other.width) - Math.max(x, other.x);
          const high = Math.min(y + rect.height, other.y + other.height) - Math.max(y, other.y);
          if (wide > 0 && high > 0) covered += wide * high;
          // Squarely on another card is the one thing that hides it.
          if (other.x === x && other.y === y) covered = Infinity;
        }
        const away = (x - target.x) ** 2 + (y - target.y) ** 2;
        if (covered < found.covered || (covered === found.covered && away < found.away)) {
          found = { x, y, covered, away };
        }
      }
    }
    return found;
  };
  const whole = best(1);
  const { x, y } = whole.covered === 0 ? whole : best(4);
  return { x, y };
}

/** Every `step` from `from` up to `to`, and `to` itself. */
function latticeStops(from: number, to: number, step: number): number[] {
  const end = Math.max(from, to);
  const stops: number[] = [];
  for (let at = from; at < end; at += step) stops.push(at);
  stops.push(end);
  return stops;
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

/**
 * The least a box on a container diagram is drawn at, so it says its name and
 * its type whatever size it was placed at: an actor placed as a low tile on a
 * landscape has no room for [Person].
 */
export const CONTAINER_BOX_MIN = { width: 120, height: 100 } as const;

/**
 * The size a box on a container diagram is DRAWN at. Laying out, placing and
 * routing go by this rather than the stored size, or a person stored at its
 * landscape height is drawn taller than the room it was given and sits over the
 * box below it.
 */
export function containerBoxSize(
  figure: NodeFigure,
  placement?: Pick<NodeGeometry, 'width' | 'height'>,
): { width: number; height: number } {
  const size = placementSize(figure, placement);
  return {
    width: Math.max(size.width, CONTAINER_BOX_MIN.width),
    height: Math.max(size.height, CONTAINER_BOX_MIN.height),
  };
}

/**
 * The boxes of a container diagram as they are drawn, by id: each at least
 * {@link CONTAINER_BOX_MIN}, grown down and right where that covers nothing it
 * did not already cover, else up, left or both. A box stored at its landscape
 * size beside another — a person 56 high with an application 40 under it — is
 * then drawn whole without lying over its neighbour.
 */
export function containerBoxes(stored: ReadonlyMap<string, Rect>): Map<string, Rect> {
  const drawn = new Map<string, Rect>()
  for (const [id, rect] of stored) {
    const width = Math.max(rect.width, CONTAINER_BOX_MIN.width);
    const height = Math.max(rect.height, CONTAINER_BOX_MIN.height);
    const wider = width - rect.width;
    const taller = height - rect.height;
    const others = [...stored].filter(([other]) => other !== id).map(([, box]) => box);
    const covers = (box: Rect) => others.filter((other) => rectsIntersect(box, other) && !rectsIntersect(rect, other)).length;
    const ways = [[0, 0], [0, taller], [wider, 0], [wider, taller]].map(([left, up]) => ({ x: rect.x - left!, y: rect.y - up!, width, height }));
    drawn.set(id, ways.find((box) => covers(box) === 0) ?? ways[0]!);
  }
  return drawn
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
 * What a placement is seeded from: what the thing is, and — where somebody has
 * said — where it goes. The palette's seed, the agent's `element.draw` and a
 * record picked from the register all reduce to this.
 */
export type PlacementSeed = Pick<DesignElement, 'kind' | 'outside' | 'ref'> & {
  position?: { x: number; y: number };
  zone?: Layer7Zone;
  /** The dashed group's id (ADR-0012 §6). */
  group?: string;
};

/**
 * Where a thing lands on a view when it is ADDED there, as opposed to moved.
 *
 * A seed that names no band goes to the home of what it would be drawn as
 * where nothing has been said — which for an application is the landscape,
 * and for one nobody here owns, or one another scope answers for, the
 * external band. No position means the first cascade slot in that band
 * that nothing already on the board covers ({@link freeSlotIn}), the way a
 * move into a band has always been placed. Here rather than in the editor
 * because the shell adds to a board too — a record picked from the register
 * is drawn without a drag — and two answers to "where does a new card go"
 * would drift.
 *
 * It used to COUNT the band's members and take the slot after them, which
 * assumes nobody has moved anything since the band was filled. Once somebody
 * has — a Tidy, a drag, a board laid out by a machine — the Nth slot is
 * wherever it is, and a new card landed on top of whatever sat there.
 *
 * `figureOf` says what each card already there is drawn as, so its rect is
 * the size it is drawn at. A caller without the elements to hand leaves it
 * out, and a card with no stored size is then measured as the new one: in one
 * band the cards are nearly always of one figure, which is what a band is.
 */
export function seedPlacement(
  seed: PlacementSeed,
  diagram: Pick<DesignDiagram, 'id' | 'kind' | 'members' | 'geometry'>,
  elementId: ElementId,
  figureOf?: (id: ElementId, zone: Layer7Zone | undefined) => NodeFigure | undefined,
  avoid?: SlotObstacles,
): PlacedNode {
  if (diagram.kind === 'layer7') {
    const zone = seed.zone ?? HOME_ZONE[nodeFigure(seed)];
    const figure = nodeFigure(seed, zone);
    const occupied = placedNodes(diagram)
      .filter((p) => p.id !== elementId && (p.zone ?? 'landscape') === zone)
      .map((p) => placementRect(figureOf?.(p.id, p.zone) ?? figure, p));
    const position =
      seed.position ?? freeZonePosition(zone, figure, occupied, diagram.geometry, avoid);
    return { id: elementId, zone, group: seed.group, ...position };
  }
  const position =
    seed.position ?? defaultContainerPosition(nodeFigure(seed), diagram.members.length);
  return { id: elementId, ...position };
}

/**
 * What else a new card keeps clear of beyond the cards: the lines drawn across
 * the band, as polylines, and the domain groups in it, which it may sit wholly
 * inside or wholly outside but never across the edge of.
 */
export interface SlotObstacles {
  lines?: readonly (readonly Point[])[];
  groups?: readonly Rect[];
}

/** How far a new card keeps from a line, so the line is not read as entering it. */
const LINE_CLEARANCE = 8;
/** The step of the finer search, once every cascade slot is taken. */
const FINE_STEP = 12;

/** Does the segment a→b pass through the rectangle? Liang–Barsky, clipped to it. */
export function segmentMeetsRect(a: Point, b: Point, rect: Rect): boolean {
  let low = 0;
  let high = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const sides: [number, number][] = [
    [-dx, a.x - rect.x], [dx, rect.x + rect.width - a.x],
    [-dy, a.y - rect.y], [dy, rect.y + rect.height - a.y],
  ];
  for (const [p, q] of sides) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) low = Math.max(low, r); else high = Math.min(high, r);
    if (low > high) return false;
  }
  return true;
}

function clearOf(candidate: Rect, occupied: readonly Rect[], avoid: SlotObstacles | undefined): boolean {
  if (occupied.some((rect) => rectsIntersect(candidate, rect))) return false;
  if (!avoid) return true;
  const wide: Rect = {
    x: candidate.x - LINE_CLEARANCE, y: candidate.y - LINE_CLEARANCE,
    width: candidate.width + LINE_CLEARANCE * 2, height: candidate.height + LINE_CLEARANCE * 2,
  };
  for (const line of avoid.lines ?? []) {
    for (let i = 0; i + 1 < line.length; i += 1) if (segmentMeetsRect(line[i]!, line[i + 1]!, wide)) return false;
  }
  const inside = (rect: Rect) => candidate.x >= rect.x && candidate.y >= rect.y
    && candidate.x + candidate.width <= rect.x + rect.width && candidate.y + candidate.height <= rect.y + rect.height;
  return !(avoid.groups ?? []).some((rect) => rectsIntersect(candidate, rect) && !inside(rect));
}

/**
 * What a card added to a board keeps clear of: each line between two of its
 * members, from centre to centre through the bends a person gave it, and its
 * domain groups. The centres stand in for where the router lets a line leave a
 * card; a little more room than the line takes does no harm to a new card.
 */
export function slotObstaclesOn(
  diagram: Pick<DesignDiagram, 'members' | 'geometry'>,
  relations: readonly { id: string; sourceId: ElementId; targetId: ElementId }[],
  figureOf: (id: ElementId, zone: Layer7Zone | undefined) => NodeFigure | undefined,
): SlotObstacles {
  const centres = new Map<ElementId, Point>();
  for (const placed of placedNodes(diagram)) {
    const figure = figureOf(placed.id, placed.zone);
    if (!figure) continue;
    const rect = placementRect(figure, placed);
    centres.set(placed.id, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  }
  const bends = new Map((diagram.geometry?.routes ?? []).map((route) => [route.relationId, route.waypoints]));
  const lines: Point[][] = [];
  for (const relation of relations) {
    const from = centres.get(relation.sourceId);
    const to = centres.get(relation.targetId);
    if (from && to) lines.push([from, ...(bends.get(relation.id) ?? []), to]);
  }
  return { lines, groups: diagram.geometry?.groups ?? [] };
}

/**
 * The first cascade slot in `area` that overlaps none of `occupied` — where a
 * node goes when it is MOVED into an area (the menu's "Move to zone" and
 * "Domain group"), as opposed to added to it. Counting the occupants, as the
 * palette does, assumes nobody has moved anything since; walking the slots
 * against the real rects does not. The walk covers every slot the area holds,
 * not one per occupant, because one wide card can cover several slots.
 *
 * Where `avoid` is given, the slot keeps clear of those lines and group edges
 * too; where every slot is taken, a finer walk over the area finds the room
 * the cascade's grid passes over. Only an area with no room anywhere falls
 * back, first to a place clear of the cards alone, then to the slot past the
 * last occupant — which leaves the area, as it always did.
 */
export function freeSlotIn(
  area: Rect,
  figure: NodeFigure,
  occupied: readonly Rect[],
  inset?: { x: number; y: number },
  avoid?: SlotObstacles,
): { x: number; y: number } {
  const size = NODE_SIZES[figure];
  // Every slot the area holds, and never fewer than one past the occupants:
  // a card wider or taller than a slot covers several, so the count of cards
  // is no bound on how many slots are taken. Walked in order, so the answer
  // is the same for the same board.
  const bound = Math.max(occupied.length + 1, slotsIn(area, figure, inset));
  const fits = (slot: { x: number; y: number }, obstacles: SlotObstacles | undefined) =>
    clearOf({ ...slot, width: size.width, height: size.height }, occupied, obstacles);
  const inArea = slotsIn(area, figure, inset);
  const passes = avoid ? [avoid, undefined] : [undefined];
  for (const obstacles of passes) {
    // The slots past the area's own are left to the last resort: one free there is outside the band.
    for (let index = 0; index < inArea; index += 1) {
      const slot = cascadeSlot(area, figure, index, inset);
      if (fits(slot, obstacles)) return slot;
    }
    const fine = fineSlot(area, size, inset, (slot) => fits(slot, obstacles));
    if (fine) return fine;
  }
  for (let index = inArea; index < bound; index += 1) {
    const slot = cascadeSlot(area, figure, index, inset);
    if (fits(slot, undefined)) return slot;
  }
  return cascadeSlot(area, figure, bound, inset);
}

/** The first place on a fine grid inside the area's inset where a card of this size fits, row by row. */
function fineSlot(
  area: Rect, size: { width: number; height: number }, inset: { x: number; y: number } | undefined,
  fits: (slot: { x: number; y: number }) => boolean,
): { x: number; y: number } | undefined {
  const pad = inset ?? { x: ZONE_INSET, y: ZONE_INSET };
  for (let y = area.y + pad.y; y + size.height <= area.y + area.height - pad.y / 2; y += FINE_STEP) {
    for (let x = area.x + pad.x; x + size.width <= area.x + area.width - pad.x; x += FINE_STEP) {
      if (fits({ x, y })) return { x, y };
    }
  }
  return undefined;
}

/**
 * How many cascade slots fit inside `area` for a node of `figure`: whole rows
 * of {@link cascadeSlot}'s columns, at least one row.
 */
function slotsIn(area: Rect, figure: NodeFigure, inset: { x: number; y: number } = { x: ZONE_INSET, y: ZONE_INSET }): number {
  const size = NODE_SIZES[figure];
  const usableWidth = Math.max(area.width - inset.x * 2, size.width);
  const perRow = Math.max(1, Math.floor(usableWidth / (size.width + CASCADE_GAP_X)));
  const usableHeight = Math.max(area.height - inset.y * 2, size.height);
  const rows = Math.max(1, Math.floor((usableHeight + CASCADE_GAP_Y) / (size.height + CASCADE_GAP_Y)));
  return perRow * rows;
}

/** {@link freeSlotIn} for a Layer 7 band. */
export function freeZonePosition(
  zone: Layer7Zone,
  figure: NodeFigure,
  occupied: readonly Rect[],
  geometry?: BoardGeometry,
  avoid?: SlotObstacles,
): { x: number; y: number } {
  return freeSlotIn(zoneRect(zone, geometry), figure, occupied, undefined, avoid);
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
  const size = containerBoxSize(figure);
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
