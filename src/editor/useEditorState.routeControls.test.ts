// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel, EdgeRoute } from '../model/types';
import { manualRouteIds } from '../model/routes';


/**
 * The route controls of the routing phase, at the actions that carry them:
 * `setRouteSource` (Pin / Unpin), `resetEdgeRoute` (Reset to automatic), the
 * "remove all bend points" repair in `setEdgeRoute`, and hand-drawn routes
 * following their nodes through `movePlacements`.
 */
function model(routes?: EdgeRoute[], autoRoute = false): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'e2', kind: 'application', name: 'E2', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        autoRoute,
        placements: [
          // e1: 100..300 × 100..230 (application 200×130), right-side centre y = 165.
          { elementId: 'e1', zone: 'landscape', x: 100, y: 100 },
          { elementId: 'e2', zone: 'landscape', x: 900, y: 400 },
        ],
        edgeRoutes: routes,
      },
    ],
  };
}

const AUTO: EdgeRoute = { connectionId: 'c1', waypoints: [{ x: 500, y: 165 }, { x: 500, y: 400 }], source: 'auto' };
const MANUAL: EdgeRoute = { ...AUTO, source: 'manual' };

function render(initial: DesignModel) {
  const { result, host } = renderEditorState(initial, { activeDiagramId: 'd1' });
  const stored = () =>
    result.current.model.diagrams[0].edgeRoutes?.find((r) => r.connectionId === 'c1');
  /** What the last step asked for, flattened — `route.set` or `route.clear`. */
  const asked = () => {
    const last = host.current.commands.at(-1);
    if (!last) return [];
    return last.type === 'transaction' ? last.commands.map((c) => c.type) : [last.type];
  };
  return { result, host, stored, asked };
}

describe('setRouteSource — Pin and Unpin', () => {
  it('pins a line with no stored row by writing a bend-less pinned row', () => {
    const { result, host, stored } = render(model());

    act(() => result.current.actions.setRouteSource('c1', 'manual'));

    expect(host.current.commands).toHaveLength(1);
    expect(stored()).toEqual({
      connectionId: 'c1',
      waypoints: [],
      labelPosition: undefined,
      source: 'manual',
      pinned: true,
    });
    // The pin IS content: the row survives the merge, and every automatic pass
    // now has to leave this line alone.
    expect(stored()?.pinned).toBe(true);
    expect(manualRouteIds(result.current.model.diagrams[0]).has('c1')).toBe(true);
  });

  it('pins router output as-is: same bends, now the user’s', () => {
    const { result, stored } = render(model([AUTO]));
    act(() => result.current.actions.setRouteSource('c1', 'manual'));
    expect(stored()).toMatchObject({ waypoints: AUTO.waypoints, source: 'manual', pinned: true });
  });

  it('unpins a hand-drawn route without moving it, and unpinning a bare pin deletes the row', () => {
    const { result, stored } = render(model([MANUAL]));
    act(() => result.current.actions.setRouteSource('c1', 'auto'));
    expect(stored()).toMatchObject({ waypoints: MANUAL.waypoints, source: 'auto' });
    expect(stored()?.pinned).toBeUndefined();

    const bare = render(model([{ connectionId: 'c1', waypoints: [], source: 'manual', pinned: true }]));
    act(() => bare.result.current.actions.setRouteSource('c1', 'auto'));
    // Nothing left to say about a straight, unpinned line: the row is gone.
    expect(bare.stored()).toBeUndefined();
    // Not an empty row written back: the step asks for the row to be forgotten.
    expect(bare.asked()).toEqual(['route.clear']);
  });

  it('does nothing when asked to unpin a line that has no row', () => {
    const { result, host } = render(model());
    act(() => result.current.actions.setRouteSource('c1', 'auto'));
    expect(host.current.commands).toEqual([]);
  });

  it('is one undo step and moves no geometry', () => {
    const { result, stored } = render(model([AUTO]));
    const before = result.current.geometryVersion;
    act(() => result.current.actions.setRouteSource('c1', 'manual'));
    expect(result.current.geometryVersion).toBe(before);
    act(() => result.current.undo());
    expect(stored()).toEqual(AUTO);
  });
});

describe('resetEdgeRoute — Reset to automatic', () => {
  it('deletes the row and, with live routing OFF, hands back a token the routing pass amends into', () => {
    const { result, stored } = render(model([MANUAL]));
    const before = result.current.geometryVersion;

    let token = '';
    act(() => {
      token = result.current.actions.resetEdgeRoute('c1');
    });
    expect(stored()).toBeUndefined();
    // No geometry bump: nothing would queue a live pass, so the caller runs one.
    expect(result.current.geometryVersion).toBe(before);
    expect(token).toBe(result.current.commitToken);

    // What the editor does next: route, then apply against the reset's token.
    act(() => {
      result.current.actions.applyTidyResult(
        { placements: [], edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 600, y: 165 }, { x: 600, y: 400 }], source: 'auto' }] },
        token,
      );
    });
    expect(stored()).toMatchObject({ source: 'auto', waypoints: [{ x: 600, y: 165 }, { x: 600, y: 400 }] });

    // ONE undo puts the hand-drawn route back.
    act(() => result.current.undo());
    expect(stored()).toEqual(MANUAL);
    expect(result.current.canUndo).toBe(false);
  });

  it('with live routing ON, bumps the geometry so the live pass follows on its own', () => {
    const { result, stored } = render(model([MANUAL], true));
    const before = result.current.geometryVersion;
    act(() => {
      result.current.actions.resetEdgeRoute('c1');
    });
    expect(stored()).toBeUndefined();
    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });
});

describe('setEdgeRoute — removing every bend', () => {
  it('forgets the row of a bend-only hand-drawn route, so the router gets it back', () => {
    const { result, stored, asked } = render(model([MANUAL]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(stored()).toBeUndefined();
    // Not stamped manual and not stored empty: a manual, content-less row is
    // what every automatic pass would then preserve forever.
    expect(asked()).toEqual(['route.clear']);
    expect(manualRouteIds(result.current.model.diagrams[0]).has('c1')).toBe(false);
  });

  it('keeps the label anchor the user placed, as a label-only manual row', () => {
    const { result, stored } = render(model([{ ...MANUAL, labelPosition: { x: 400, y: 150 } }]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(stored()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: { x: 400, y: 150 }, source: 'manual', pinned: undefined });
  });

  it('keeps the pin: a pinned line with its bends removed is straight AND still pinned', () => {
    const { result, stored } = render(model([{ ...MANUAL, pinned: true }]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(stored()).toMatchObject({ waypoints: [], source: 'manual', pinned: true });
  });

  it('carries the pin through a bend edit and through a label move', () => {
    const { result, stored } = render(model([{ ...MANUAL, pinned: true }]));
    act(() => result.current.actions.setEdgeRoute('c1', [{ x: 520, y: 165 }]));
    expect(stored()?.pinned).toBe(true);
    act(() => result.current.actions.setEdgeLabelPosition('c1', { x: 1, y: 2 }));
    expect(stored()).toMatchObject({ pinned: true, labelPosition: { x: 1, y: 2 } });
  });
});

describe('movePlacements — hand-drawn routes follow their nodes', () => {
  it('slides the bend next to the moved node along its end leg, in the same step', () => {
    // e1's right side is at y 100..230; the first leg leaves it horizontally at
    // y = 165. Moving e1 down 50 must take that leg — and only its y — along.
    const { result, host, stored, asked } = render(model([MANUAL]));
    act(() => result.current.actions.movePlacements([{ elementId: 'e1', x: 100, y: 150 }]));

    // One step, carrying the placement AND the route.
    expect(host.current.commands).toHaveLength(1);
    expect(asked()).toEqual(['placement.set', 'route.set']);
    expect(stored()?.waypoints).toEqual([{ x: 500, y: 215 }, { x: 500, y: 400 }]);
    expect(stored()?.source).toBe('manual');
    expect(result.current.model.diagrams[0].placements.find((p) => p.elementId === 'e1'))
      .toMatchObject({ y: 150 });

    // One undo takes back both.
    act(() => result.current.undo());
    expect(stored()).toEqual(MANUAL);
    expect(result.current.model.diagrams[0].placements.find((p) => p.elementId === 'e1')).toMatchObject({ y: 100 });
  });

  it('leaves router output alone — live routing recomputes it, or nobody asked', () => {
    const { result, stored } = render(model([AUTO]));
    act(() => result.current.actions.movePlacements([{ elementId: 'e1', x: 100, y: 150 }]));
    expect(stored()).toEqual(AUTO);
  });

  it('follows a pinned bend-less row trivially (nothing to move) and a route at the target end', () => {
    const pinned: EdgeRoute = { connectionId: 'c1', waypoints: [], source: 'manual', pinned: true };
    const { result, stored } = render(model([pinned]));
    act(() => result.current.actions.movePlacements([{ elementId: 'e1', x: 120, y: 160 }]));
    expect(stored()).toEqual(pinned);

    // e2: 900..1100 × 400..530; the last leg (500,400)→(900,400)... enters e2's
    // left side horizontally at y = 400, so moving e2 down 40 moves that bend's y.
    const atTarget = render(model([MANUAL]));
    act(() => atTarget.result.current.actions.movePlacements([{ elementId: 'e2', x: 900, y: 440 }]));
    expect(atTarget.stored()?.waypoints).toEqual([{ x: 500, y: 165 }, { x: 500, y: 440 }]);
  });
});
