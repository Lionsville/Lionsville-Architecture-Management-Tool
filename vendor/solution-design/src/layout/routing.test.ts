import { describe, expect, it } from 'vitest';
import type {
  DesignConnection,
  DesignDiagram,
  DesignElement,
  DesignModel,
  Point,
  Rect,
} from '../types';
import { LABEL_MARGIN, labelSpotFor } from './routing';
import { edgeLabelSize } from './edgeLabelSize';
import { rectIntersectsRect } from './geometry';
import { routeDiagramEdges } from './routeOnly';

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

const chipRect = (conn: DesignConnection, at: Point): Rect => {
  const size = edgeLabelSize(conn)!;
  return {
    x: at.x - size.width / 2,
    y: at.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
};

describe('labelSpotFor — avoiding the chips already pinned', () => {
  const conn: DesignConnection = { id: 'c', sourceId: 's', targetId: 't', isBidirectional: false, label: 'x' };
  const source = rect(0, 0, 100, 40);
  const target = rect(200, 0, 100, 40);
  const spot = (avoidChips: Rect[]) =>
    labelSpotFor(conn, source, target, [], [], [], avoidChips);

  it('moves the chip off a spot another chip already occupies', () => {
    // A single-line chip sitting on the natural midpoint of the run. The label must
    // slide along its own path far enough to clear it by LABEL_MARGIN.
    const taken = rect(130, 0, 40, 40);
    const at = spot([taken])!;
    expect(at).toBeDefined();
    expect(rectIntersectsRect(chipRect(conn, at), taken, LABEL_MARGIN)).toBe(false);
    // …and it genuinely moved: the unconstrained answer is the blocked midpoint.
    expect(at).not.toEqual(spot([]));
  });

  it('falls back to the unconstrained spot rather than giving up when no spot clears', () => {
    // The two-pass rule (not a hard requirement): with the whole board taken, chip
    // avoidance is unsatisfiable, and returning `undefined` here would make
    // FloatingEdge auto-centre — which is how a chip ends up on a group box. Today's
    // answer, overlap and all, is the better of the two.
    const everything = rect(-500, -500, 2000, 2000);
    expect(spot([everything])).toEqual(spot([]));
    expect(spot([everything])).toBeDefined();
  });
});

/**
 * The regression test for the one problem adopting libavoid's nudging INTRODUCES.
 * `IDEAL_NUDGING_DISTANCE` (32) is the gap between adjacent parallel channels, and
 * it is chosen to just fit two single-line chips (18 px + LABEL_MARGIN on each
 * side). A chip with a protocol line is 34 px tall and needs ~46 px, which the
 * nudge distance deliberately does not give — widening every channel on the board
 * to 46 px would bloat the layout. So `e2` below is the case only `labelSpotFor`'s
 * chip avoidance can fix, and it is in the fixture on purpose.
 */
describe('pinned label chips of nudged parallel edges do not overlap', () => {
  const LABELS: Pick<DesignConnection, 'label' | 'protocol'>[] = [
    { label: 'places orders' },
    { label: 'imports marketplace orders' },
    // The 34 px chip: two lines, so the 32 px channel gap cannot separate it.
    { label: 'syncs orders & stock', protocol: 'HTTPS' },
    { label: 'reads customer master data' },
  ];

  /**
   * Four labelled left→right edges whose straight runs all cross one tall blocker,
   * so libavoid nudges them into four parallel channels beside it — the same board
   * shape `libavoidRouter.test.ts` measures the channel gaps on.
   */
  function parallelChannelModel(): { model: DesignModel; diagram: DesignDiagram } {
    const elt = (id: string): DesignElement => ({
      id,
      kind: 'actor',
      name: id,
      lifecycle: 'live',
      isManaged: true,
      aspects: {},
      parameters: {},
    });
    const elements: DesignElement[] = [{ ...elt('blocker'), kind: 'application' }];
    const placements: DesignDiagram['placements'] = [
      { elementId: 'blocker', zone: 'landscape', x: 450, y: 250, width: 120, height: 400 },
    ];
    const connections: DesignConnection[] = [];
    for (let i = 0; i < LABELS.length; i++) {
      elements.push(elt(`s${i}`), elt(`t${i}`));
      placements.push(
        { elementId: `s${i}`, zone: 'landscape', x: 0, y: 300 + i * 80 },
        { elementId: `t${i}`, zone: 'landscape', x: 1000, y: 300 + i * 80 },
      );
      connections.push({
        id: `e${i}`,
        sourceId: `s${i}`,
        targetId: `t${i}`,
        isBidirectional: false,
        ...LABELS[i],
      });
    }
    const diagram: DesignDiagram = { id: 'd1', kind: 'layer7', name: 'L7', placements };
    return { model: { name: 'ACME', customerName: 'ACME', elements, connections, diagrams: [diagram] }, diagram };
  }

  it('pins every chip clear of every other by LABEL_MARGIN', async () => {
    const { model, diagram } = parallelChannelModel();
    const result = await routeDiagramEdges(model, diagram);

    // Sanity: the edges really were nudged into distinct channels, so the chips are
    // genuinely competing for the same strip of board. Without this the test could
    // pass on a board where nothing was ever close.
    const channels = model.connections.map((c) => {
      const waypoints = result.edgeRoutes!.find((r) => r.connectionId === c.id)!.waypoints;
      expect(waypoints.length).toBeGreaterThan(0);
      return waypoints[0].y;
    });
    expect(new Set(channels).size).toBe(model.connections.length);

    // Every labelled edge got a pin (none fell back to auto-centring)…
    const chips = model.connections.map((c) => {
      const at = result.edgeRoutes!.find((r) => r.connectionId === c.id)!.labelPosition;
      expect(at, `${c.id} was not pinned`).toBeDefined();
      return { id: c.id, rect: chipRect(c, at!) };
    });
    // …and no two of them touch, the 34 px protocol chip included.
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        expect(
          rectIntersectsRect(chips[i].rect, chips[j].rect, LABEL_MARGIN),
          `${chips[i].id} and ${chips[j].id} overlap`,
        ).toBe(false);
      }
    }
  });

  it('is deterministic — the greedy pass is ordered by connection id, not array order', async () => {
    const forward = parallelChannelModel();
    const shuffled = parallelChannelModel();
    shuffled.model.connections.reverse();
    shuffled.model.elements.reverse();
    shuffled.diagram.placements.reverse();

    const pins = (result: Awaited<ReturnType<typeof routeDiagramEdges>>) =>
      Object.fromEntries(result.edgeRoutes!.map((r) => [r.connectionId, r.labelPosition]));

    expect(pins(await routeDiagramEdges(shuffled.model, shuffled.diagram))).toEqual(
      pins(await routeDiagramEdges(forward.model, forward.diagram)),
    );
  });
});
