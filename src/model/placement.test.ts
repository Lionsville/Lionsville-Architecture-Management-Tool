import { describe, expect, it } from 'vitest';
import { laidOut } from './testFixtures';
import {
  placedNodes,
  placedNode,
  memberOf,
  nodeGeometryOf,
  BAND_NODE_MIN,
  canPlaceKind,
  cascadeSlot,
  clampPlacementIntoZone,
  defaultZonePosition,
  seedPlacement,
  freeSlotIn,
  freeZonePosition,
  rectsIntersect,
  DESCRIPTION_TYPE,
  descriptionLineClamp,
  diagramWithLivePlacements,
  domainGroupForPoint,
  domainGroupRectMap,
  NODE_MAX_SIZE,
  NODE_SIZES,
  nodeMaxSize,
  nodeMinSize,
  placementSize,
  rectContains,
  unionRects,
} from './placement';
import { zoneRect } from './zones';
import type { BoardGeometry } from './zones';
import type { DomainGroupRect, Rect } from './types';
import type { NodeFigure } from './kinds';

describe('placementSize', () => {
  it('uses kind defaults when the placement has no explicit size', () => {
    expect(placementSize('application')).toEqual(NODE_SIZES.application);
  });

  it('prefers explicit placement dimensions', () => {
    expect(placementSize('application', { width: 480, height: 300 })).toEqual({
      width: 480,
      height: 300,
    });
  });
});

describe('descriptionLineClamp', () => {
  const lineHeightOf = (kind: keyof typeof DESCRIPTION_TYPE) =>
    DESCRIPTION_TYPE[kind].fontSize * DESCRIPTION_TYPE[kind].lineHeight;

  it('keeps the original 2-line clamp at or below the canonical height', () => {
    expect(descriptionLineClamp('actor', undefined)).toBe(2);
    expect(descriptionLineClamp('actor', NODE_SIZES.actor.height)).toBe(2);
    expect(descriptionLineClamp('inputChannel', 40)).toBe(2);
  });

  it('adds one line per extra line-height of resized height', () => {
    const lineHeight = lineHeightOf('actor');
    const canonical = NODE_SIZES.actor.height;
    expect(descriptionLineClamp('actor', canonical + lineHeight)).toBe(3);
    expect(descriptionLineClamp('actor', canonical + 3 * lineHeight + 1)).toBe(5);
    // Just short of a full extra line stays at the current count.
    expect(descriptionLineClamp('actor', canonical + lineHeight - 0.1)).toBe(2);
  });

  it('uses each kind\'s own canonical height and type scale as the baseline', () => {
    // +1 keeps the check off the exact float boundary (9.5 × 1.3 wobbles).
    expect(
      descriptionLineClamp(
        'externalSystem',
        NODE_SIZES.externalSystem.height + lineHeightOf('externalSystem') + 1,
      ),
    ).toBe(3);
    expect(
      descriptionLineClamp('application', NODE_SIZES.application.height + 2 * lineHeightOf('application')),
    ).toBe(4);
  });
});

describe('clampPlacementIntoZone', () => {
  // A board shrink makes the bands shallower. Their members have to come with
  // them, or a chip from a deep actors band draws inside the landscape while its
  // placement still says `actors`.
  const shrunk: BoardGeometry = { canvas: { width: 840, height: 520 } };

  it('slides a band member back inside its band', () => {
    const stranded = { id: 'e1', zone: 'actors' as const, x: 20, y: 400 };
    expect(clampPlacementIntoZone(stranded, 'actor', shrunk)).toMatchObject({ x: 20, y: 102 });
  });

  it('gives up a size the user set, but never invents one', () => {
    const tall = { id: 'e1', zone: 'actors' as const, x: 20, y: 0, height: 300 };
    expect(clampPlacementIntoZone(tall, 'actor', shrunk)?.height).toBe(150);
    const canonical = { id: 'e1', zone: 'actors' as const, x: 20, y: 0 };
    expect(clampPlacementIntoZone(canonical, 'actor', shrunk)?.height).toBeUndefined();
  });

  it('leaves a placement that already fits, and every landscape node, alone', () => {
    expect(
      clampPlacementIntoZone({ id: 'e1', zone: 'actors', x: 20, y: 20 }, 'actor', shrunk),
    ).toBeUndefined();
    expect(
      clampPlacementIntoZone(
        { id: 'e1', zone: 'landscape', x: 5000, y: 5000 },
        'application',
        shrunk,
      ),
    ).toBeUndefined();
  });
});

describe('nodeMaxSize', () => {
  it('lets a landscape node grow to the card ceiling', () => {
    expect(nodeMaxSize('application', 'landscape')).toEqual(NODE_MAX_SIZE);
    expect(nodeMaxSize('actor', 'landscape')).toEqual(NODE_MAX_SIZE);
    // Container diagrams have no zones at all.
    expect(nodeMaxSize('component', undefined)).toEqual(NODE_MAX_SIZE);
  });

  it('stops the band-crossing axis at the band, so a resize cannot re-zone the node', () => {
    // Default board: actors 150 high, input channels 250 wide.
    expect(nodeMaxSize('actor', 'actors').height).toBe(150);
    expect(nodeMaxSize('actor', 'actors').width).toBe(NODE_MAX_SIZE.width);
    expect(nodeMaxSize('inputChannel', 'inputChannels').width).toBe(250);
    expect(nodeMaxSize('inputChannel', 'inputChannels').height).toBe(NODE_MAX_SIZE.height);
  });

  it('follows the band when it is resized', () => {
    const deep: BoardGeometry = { zones: { actors: { size: 300 } } };
    expect(nodeMaxSize('actor', 'actors', deep).height).toBe(300);
    const shallow: BoardGeometry = { zones: { actors: { size: 90 } } };
    expect(nodeMaxSize('actor', 'actors', shallow).height).toBe(90);
  });

  it('never drops the ceiling under the node\'s own floor', () => {
    // The external-systems band bottoms out at 120, narrower than an external
    // system's 140 floor — a max below the min would break the resizer.
    const narrow: BoardGeometry = { zones: { externalSystems: { size: 120 } } };
    const max = nodeMaxSize('externalSystem', 'externalSystems', narrow);
    expect(max.width).toBe(BAND_NODE_MIN.externalSystem.width);
    expect(max.width).toBeGreaterThanOrEqual(nodeMinSize('externalSystem').width);
  });
});

describe('BAND_NODE_MIN', () => {
  it('stays below each figure\'s canonical size so shrinking is actually possible', () => {
    for (const figure of ['actor', 'inputChannel', 'managementTool', 'externalSystem'] as const) {
      expect(BAND_NODE_MIN[figure].width).toBeLessThan(NODE_SIZES[figure].width);
      expect(BAND_NODE_MIN[figure].height).toBeLessThan(NODE_SIZES[figure].height);
    }
  });
});

describe('defaultZonePosition', () => {
  const figures: [NodeFigure, Parameters<typeof zoneRect>[0]][] = [
    ['actor', 'actors'],
    ['application', 'landscape'],
    ['externalSystem', 'externalSystems'],
    ['inputChannel', 'inputChannels'],
    ['managementTool', 'management'],
  ];

  it.each(figures)('keeps the first 6 %s placements inside their zone band', (figure, zone) => {
    const rect = zoneRect(zone);
    for (let i = 0; i < 6; i += 1) {
      const pos = defaultZonePosition(zone, figure, i);
      const size = NODE_SIZES[figure];
      expect(pos.x).toBeGreaterThanOrEqual(rect.x);
      expect(pos.x + size.width).toBeLessThanOrEqual(rect.x + rect.width);
      expect(pos.y).toBeGreaterThanOrEqual(rect.y);
    }
  });

  it('cascades deterministically (same input, same output; no overlap for siblings)', () => {
    const a = defaultZonePosition('landscape', 'application', 0);
    const b = defaultZonePosition('landscape', 'application', 0);
    const c = defaultZonePosition('landscape', 'application', 1);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });
});

describe('domain groups (explicit boxes in the geometry)', () => {
  const config: DomainGroupRect[] = [
    { id: 'Big', x: 0, y: 0, width: 1000, height: 1000 },
    { id: 'Small', x: 100, y: 100, width: 200, height: 200 },
  ];

  it('maps a view’s group boxes to a rect map', () => {
    const rects = domainGroupRectMap(config);
    expect(rects.get('Small')).toEqual({ x: 100, y: 100, width: 200, height: 200 });
    expect(rects.size).toBe(2);
    expect(domainGroupRectMap(undefined).size).toBe(0);
    expect(domainGroupRectMap([]).size).toBe(0);
  });

  it('containment: a dropped centre point joins the smallest containing group', () => {
    const groups = domainGroupRectMap(config);
    expect(domainGroupForPoint({ x: 150, y: 150 }, groups)).toBe('Small');
    expect(domainGroupForPoint({ x: 900, y: 900 }, groups)).toBe('Big');
    expect(domainGroupForPoint({ x: 2000, y: 2000 }, groups)).toBeUndefined();
  });

  it('containment is half-open: the far edge is outside', () => {
    const groups = domainGroupRectMap([{ id: 'G', x: 0, y: 0, width: 100, height: 100 }]);
    expect(domainGroupForPoint({ x: 0, y: 0 }, groups)).toBe('G');
    expect(domainGroupForPoint({ x: 100, y: 100 }, groups)).toBeUndefined();
  });
});

describe('rect helpers', () => {
  it('unions rects', () => {
    expect(
      unionRects([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 5, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 30, height: 15 });
    expect(unionRects([])).toBeUndefined();
  });

  it('treats rect containment as half-open', () => {
    const rect: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectContains(rect, { x: 0, y: 0 })).toBe(true);
    expect(rectContains(rect, { x: 10, y: 10 })).toBe(false);
  });
});

describe('diagramWithLivePlacements', () => {
  const diagram = laidOut({
    id: 'd1',
    kind: 'layer7' as const,
    name: 'L7',
    placements: [
      { id: 'a', zone: 'landscape' as const, x: 10, y: 20 },
      { id: 'b', zone: 'landscape' as const, x: 30, y: 40 },
    ],
  });

  it('moves only the named placements', () => {
    const moved = diagramWithLivePlacements(diagram, [{ id: 'a', x: 111, y: 222 }]);
    expect(placedNodes(moved)[0]).toEqual({ id: 'a', zone: 'landscape', x: 111, y: 222 });
    // Identity is the geometry ROW's: the joined view is worked out per
    // diagram object, so what a memo downstream compares is the node.
    expect(moved.geometry.nodes[1]).toBe(diagram.geometry.nodes[1]);
  });

  it('leaves the input untouched', () => {
    // The router is handed this diagram while the model still holds the pre-drag
    // positions. Mutating in place would commit a drag nobody dropped.
    diagramWithLivePlacements(diagram, [{ id: 'a', x: 111, y: 222 }]);
    expect(placedNodes(diagram)[0]).toEqual({ id: 'a', zone: 'landscape', x: 10, y: 20 });
  });

  it('returns the SAME diagram when nothing actually moved', () => {
    // A gesture that has not left its start position must not invalidate a memo or
    // spend a routing pass.
    expect(diagramWithLivePlacements(diagram, [])).toBe(diagram);
    expect(diagramWithLivePlacements(diagram, [{ id: 'a', x: 10, y: 20 }])).toBe(diagram);
  });

  it('ignores a move for an element that is not on this diagram', () => {
    expect(diagramWithLivePlacements(diagram, [{ id: 'ghost', x: 1, y: 2 }])).toBe(diagram);
  });

  it('keeps everything else about the placement, size included', () => {
    const sized = laidOut({
      ...diagram,
      placements: [{ id: 'a', zone: 'landscape' as const, x: 0, y: 0, width: 300, height: 200 }],
    });
    const moved = diagramWithLivePlacements(sized, [{ id: 'a', x: 5, y: 6 }]);
    // A drag changes position and never size, and `placementSize` still has to
    // resolve the rect the router blocks against.
    expect(placedNodes(moved)[0]).toEqual({
      id: 'a',
      zone: 'landscape',
      x: 5,
      y: 6,
      width: 300,
      height: 200,
    });
  });
});

describe('cascadeSlot / freeSlotIn / freeZonePosition', () => {
  const area = { x: 100, y: 100, width: 700, height: 500 };

  it('defaultZonePosition is the cascade over the zone rect (unchanged behaviour)', () => {
    expect(defaultZonePosition('landscape', 'application', 3)).toEqual(
      cascadeSlot(zoneRect('landscape'), 'application', 3),
    );
  });

  it('takes the first slot when nothing occupies the area', () => {
    expect(freeSlotIn(area, 'application', [])).toEqual(cascadeSlot(area, 'application', 0));
  });

  it('skips slots that overlap an occupant and returns the first free one', () => {
    const slot0 = cascadeSlot(area, 'application', 0);
    const slot1 = cascadeSlot(area, 'application', 1);
    const occupied = [
      { ...slot0, ...NODE_SIZES.application },
      // Sitting a little off slot 1 still overlaps it.
      { x: slot1.x + 40, y: slot1.y + 20, ...NODE_SIZES.application },
    ];
    expect(freeSlotIn(area, 'application', occupied)).toEqual(cascadeSlot(area, 'application', 2));
  });

  it('ignores occupants elsewhere in the area', () => {
    const farAway = { x: area.x + 600, y: area.y + 400, width: 50, height: 50 };
    expect(freeSlotIn(area, 'actor', [farAway])).toEqual(cascadeSlot(area, 'actor', 0));
  });

  it('never returns a slot that touches an occupant edge-to-edge as overlapping', () => {
    const slot0 = cascadeSlot(area, 'actor', 0);
    // Exactly to the right of slot 0, sharing an edge: slot 0 is still free.
    const neighbour = { x: slot0.x + NODE_SIZES.actor.width, y: slot0.y, ...NODE_SIZES.actor };
    expect(rectsIntersect({ ...slot0, ...NODE_SIZES.actor }, neighbour)).toBe(false);
    expect(freeSlotIn(area, 'actor', [neighbour])).toEqual(slot0);
  });

  it('freeZonePosition lands inside the band it was asked for', () => {
    const band = zoneRect('management');
    const spot = freeZonePosition('management', 'managementTool', []);
    expect(spot.x).toBeGreaterThanOrEqual(band.x);
    expect(spot.y).toBeGreaterThanOrEqual(band.y);
    expect(spot.y + NODE_SIZES.managementTool.height).toBeLessThanOrEqual(band.y + band.height);
  });
});

/**
 * A view's two halves, joined (ADR-0012 §6).
 *
 * Membership is the definition's and coordinates are the geometry's, and every
 * drawing, routing and hit-testing caller wants both at once. What is pinned
 * here is the join itself — and its identity, because that is what `React.memo`
 * downstream compares.
 */
describe('placedNodes', () => {
  const view = laidOut({
    id: 'l7',
    kind: 'layer7',
    name: 'L7',
    placements: [
      { id: 'a', zone: 'landscape', group: 'core', x: 10, y: 20, width: 300 },
      { id: 'b', zone: 'actors', x: 30, y: 40 },
    ],
  });

  it('joins each member to its node, in the definition’s order', () => {
    expect(placedNodes(view)).toEqual([
      { id: 'a', zone: 'landscape', group: 'core', x: 10, y: 20, width: 300 },
      { id: 'b', zone: 'actors', x: 30, y: 40 },
    ]);
    expect(placedNode(view, 'b')).toEqual({ id: 'b', zone: 'actors', x: 30, y: 40 });
    expect(placedNode(view, 'gone')).toBeUndefined();
  });

  it('answers (0, 0) for a member nobody has laid out', () => {
    // A geometry file somebody deleted, or a view a machine seeded: the element
    // is ON the view and has not been placed, which `needsLayout` is for.
    const seeded = { ...view, geometry: { nodes: [], needsLayout: true as const } };
    expect(placedNodes(seeded)).toEqual([
      { id: 'a', zone: 'landscape', group: 'core', x: 0, y: 0 },
      { id: 'b', zone: 'actors', x: 0, y: 0 },
    ]);
  });

  it('hands back the row it had for a member and node that came through unchanged', () => {
    // The property `React.memo` leans on: the reducer touches the row it names
    // and copies nothing else, so an untouched card must not be a fresh object
    // on the other side of a change that was nowhere near it.
    const elsewhere = { ...view, name: 'Renamed' };
    expect(placedNodes(elsewhere)[0]).toBe(placedNodes(view)[0]);
    expect(placedNodes(view)).toBe(placedNodes(view));
  });

  it('takes a row apart again, into the halves that are stored', () => {
    const [a] = placedNodes(view);
    expect(memberOf(a)).toEqual({ id: 'a', zone: 'landscape', group: 'core' });
    expect(nodeGeometryOf(a)).toEqual({ id: 'a', x: 10, y: 20, width: 300 });
  });
});

/**
 * Where a kind may go (ADR-0012 §6).
 *
 * A `layer7` board and a `container` board are geometry: a box has a position,
 * a size and a band. A sheet and a map are *laid out* from trees, order and
 * depth, with no drag and no geometry file — so asking for a coordinate for a
 * function is asking where a thing goes whose place its parent decides.
 */
describe('canPlaceKind', () => {
  it('lets a canvas hold what a canvas has always held', () => {
    for (const kind of ['application', 'component', 'actor'] as const) {
      expect(canPlaceKind(kind, 'layer7'), kind).toEqual({ ok: true });
      expect(canPlaceKind(kind, 'container'), kind).toEqual({ ok: true });
    }
  });

  it('refuses a business kind on a canvas, as a value with a reason', () => {
    for (const kind of ['step', 'function', 'process'] as const) {
      expect(canPlaceKind(kind, 'layer7'), kind)
        .toEqual({ ok: false, reason: 'placement.notOnACanvas' });
      expect(canPlaceKind(kind, 'container'), kind)
        .toEqual({ ok: false, reason: 'placement.notOnACanvas' });
    }
  });

  it('refuses every kind on a laid-out view, which holds no members at all', () => {
    for (const kind of ['application', 'actor', 'step', 'function'] as const) {
      expect(canPlaceKind(kind, 'sheet'), kind).toEqual({ ok: false, reason: 'placement.notOnACanvas' });
      expect(canPlaceKind(kind, 'map'), kind).toEqual({ ok: false, reason: 'placement.notOnACanvas' });
    }
  });

  it('excepts the actor, which has stood in the top band of every board', () => {
    // A business kind by ADR-0012 §4, and the one that was always drawn.
    expect(canPlaceKind('actor', 'layer7')).toEqual({ ok: true });
  });
});

describe('seedPlacement', () => {
  const landscape = laidOut({
    id: 'd', kind: 'layer7', name: 'L',
    placements: [{ id: 'a', zone: 'landscape', x: 0, y: 0 }, { id: 'x', zone: 'externalSystems', x: 0, y: 0 }],
  });

  it('lands an application in the landscape band, in the next cascade slot', () => {
    const placed = seedPlacement({ kind: 'application' }, landscape, 'new');
    expect(placed.zone).toBe('landscape');
    expect(placed).toEqual({
      id: 'new', zone: 'landscape', group: undefined,
      ...defaultZonePosition('landscape', 'application', 1, landscape.geometry),
    });
  });

  it('sends an outside application to the external band, and a stand-in wherever it was told', () => {
    expect(seedPlacement({ kind: 'application', outside: true }, landscape, 'o').zone).toBe('externalSystems');
    expect(seedPlacement({ kind: 'application', ref: 'acme/retail' }, landscape, 's').zone).toBe('landscape');
    expect(seedPlacement({ kind: 'application', ref: 'x', zone: 'externalSystems' }, landscape, 's').zone).toBe('externalSystems');
  });

  it('keeps a position somebody gave it', () => {
    expect(seedPlacement({ kind: 'actor', position: { x: 7, y: 9 } }, landscape, 'p')).toMatchObject({ x: 7, y: 9 });
  });
});
