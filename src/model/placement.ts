import type {
  DesignDiagram,
  DiagramLayoutConfig,
  DiagramPlacement,
  ElementId,
  ElementKind,
  Layer7Zone,
  Rect,
} from './types';
import { zoneRect, zoneSizes } from './zones';

/**
 * Canonical node sizes per kind, in flow pixels. Cards are fixed-size by
 * design (the PVH/Akzo boards read as a grid of equal cards); placements may
 * still carry explicit width/height (e.g. container boundaries) which win.
 */
export const NODE_SIZES: Record<ElementKind, { width: number; height: number }> = {
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
  Exclude<ElementKind, 'application' | 'component'>,
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
export function nodeMinSize(kind: ElementKind): { width: number; height: number } {
  return kind === 'application' || kind === 'component' ? NODE_SIZES[kind] : BAND_NODE_MIN[kind];
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
  kind: ElementKind,
  zone: Layer7Zone | undefined,
  layoutConfig?: DiagramLayoutConfig,
): { width: number; height: number } {
  if (zone === undefined || zone === 'landscape') return NODE_MAX_SIZE;
  const band = zoneSizes(layoutConfig)[zone];
  const min = nodeMinSize(kind);
  const acrossHeight = zone === 'actors' || zone === 'management';
  return {
    width: acrossHeight ? NODE_MAX_SIZE.width : Math.max(Math.min(NODE_MAX_SIZE.width, band), min.width),
    height: acrossHeight
      ? Math.max(Math.min(NODE_MAX_SIZE.height, band), min.height)
      : NODE_MAX_SIZE.height,
  };
}

/**
 * Description type scale per kind. The line clamp is derived from the line
 * height, so both live here: read from two places, a font-size change drifts
 * the clamp without anything failing.
 */
export const DESCRIPTION_TYPE: Record<ElementKind, { fontSize: number; lineHeight: number }> = {
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
export function descriptionLineClamp(kind: ElementKind, height: number | undefined): number {
  const canonical = NODE_SIZES[kind].height;
  if (height === undefined || height <= canonical) return 2;
  const type = DESCRIPTION_TYPE[kind];
  return 2 + Math.floor((height - canonical) / (type.fontSize * type.lineHeight));
}

/**
 * Keep a band member inside its band, for when the board — and with it the band
 * — shrinks. The node slides back in, and a size the user set explicitly gives
 * way to the band; a node left at its canonical size keeps it, so shrinking the
 * board never invents a stored size. Returns undefined when nothing moves.
 */
export function clampPlacementIntoZone(
  placement: DiagramPlacement,
  kind: ElementKind,
  layoutConfig?: DiagramLayoutConfig,
): DiagramPlacement | undefined {
  if (placement.zone === undefined || placement.zone === 'landscape') return undefined;
  const band = zoneRect(placement.zone, layoutConfig);
  const max = nodeMaxSize(kind, placement.zone, layoutConfig);
  const width = placement.width === undefined ? undefined : Math.min(placement.width, max.width);
  const height = placement.height === undefined ? undefined : Math.min(placement.height, max.height);
  const size = placementSize(kind, { width, height });
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
  kind: ElementKind,
  placement?: Pick<DiagramPlacement, 'width' | 'height'>,
): { width: number; height: number } {
  return {
    width: placement?.width ?? NODE_SIZES[kind].width,
    height: placement?.height ?? NODE_SIZES[kind].height,
  };
}

export function placementRect(kind: ElementKind, placement: DiagramPlacement): Rect {
  const size = placementSize(kind, placement);
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
  kind: ElementKind,
  index: number,
  inset: { x: number; y: number } = { x: ZONE_INSET, y: ZONE_INSET },
): { x: number; y: number } {
  const size = NODE_SIZES[kind];
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
  kind: ElementKind,
  existingInZone: number,
  layoutConfig?: DiagramLayoutConfig,
): { x: number; y: number } {
  return cascadeSlot(zoneRect(zone, layoutConfig), kind, existingInZone);
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
  kind: ElementKind,
  occupied: readonly Rect[],
  inset?: { x: number; y: number },
): { x: number; y: number } {
  const size = NODE_SIZES[kind];
  for (let index = 0; index <= occupied.length; index += 1) {
    const slot = cascadeSlot(area, kind, index, inset);
    const candidate: Rect = { ...slot, width: size.width, height: size.height };
    if (!occupied.some((rect) => rectsIntersect(candidate, rect))) return slot;
  }
  return cascadeSlot(area, kind, occupied.length, inset);
}

/** {@link freeSlotIn} for a Layer 7 band. */
export function freeZonePosition(
  zone: Layer7Zone,
  kind: ElementKind,
  occupied: readonly Rect[],
  layoutConfig?: DiagramLayoutConfig,
): { x: number; y: number } {
  return freeSlotIn(zoneRect(zone, layoutConfig), kind, occupied);
}

/**
 * Default positions on a container diagram: components cascade inside the
 * boundary area; context elements (actors, external systems) cascade in a
 * column to the left of it.
 */
export function defaultContainerPosition(
  kind: ElementKind,
  existingOfKindGroup: number,
): { x: number; y: number } {
  const size = NODE_SIZES[kind];
  if (kind === 'component') {
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

/**
 * Domain groups are explicit rectangles stored in the diagram's layoutConfig
 * (iteration 2 — they used to be derived from member bounding boxes).
 * Membership is assigned by containment when an element is dragged.
 */
export function domainGroupRectMap(layoutConfig?: DiagramLayoutConfig): Map<string, Rect> {
  const result = new Map<string, Rect>();
  for (const group of layoutConfig?.domainGroups ?? []) {
    result.set(group.name, { x: group.x, y: group.y, width: group.width, height: group.height });
  }
  return result;
}

/**
 * Which domain group a dropped point joins. With overlapping groups the
 * smallest containing rectangle wins (ties broken by name) so the result is
 * deterministic. Returns undefined when the point is in open landscape.
 */
export function domainGroupForPoint(
  point: { x: number; y: number },
  groupRects: Map<string, Rect>,
): string | undefined {
  let best: { name: string; area: number } | undefined;
  for (const [name, rect] of groupRects) {
    if (!rectContains(rect, point)) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area || (area === best.area && name < best.name)) {
      best = { name, area };
    }
  }
  return best?.name;
}

/** Where an element is RIGHT NOW, mid-gesture — not where the model says it is. */
export interface LivePlacement {
  elementId: ElementId;
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
  const byId = new Map(moves.map((move) => [move.elementId, move]));
  let changed = false;
  const placements = diagram.placements.map((placement) => {
    const move = byId.get(placement.elementId);
    if (!move || (placement.x === move.x && placement.y === move.y)) return placement;
    changed = true;
    return { ...placement, x: move.x, y: move.y };
  });
  return changed ? { ...diagram, placements } : diagram;
}
