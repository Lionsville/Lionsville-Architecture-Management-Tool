// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel, EdgeRoute } from '../model/types';
import { manualRouteIds } from '../model/routes';


/**
 * Attach sides at the actions that carry them (Phase 2d): `setRouteSides`, an
 * Alt-`connect` / `reconnect`, and the rule every other route action now obeys —
 * a row that keeps only its sides is the router's, not a claim.
 */
function model(routes?: EdgeRoute[], autoRoute = false): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: ['e1', 'e2', 'e3'].map((id) => ({
      id,
      kind: 'application' as const,
      name: id.toUpperCase(),
      lifecycle: 'live' as const,
      isManaged: true,
      aspects: {},
      parameters: {},
    })),
    connections: [{ id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        autoRoute,
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 100, y: 100 },
          { elementId: 'e2', zone: 'landscape', x: 900, y: 400 },
          { elementId: 'e3', zone: 'landscape', x: 900, y: 800 },
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
  const stored = (id = 'c1') =>
    result.current.model.diagrams[0].edgeRoutes?.find((r) => r.connectionId === id);
  /** What the last step asked for, flattened — `route.set` or `route.clear`. */
  const asked = () => {
    const last = host.current.commands.at(-1);
    if (!last) return [];
    return last.type === 'transaction' ? last.commands.map((c) => c.type) : [last.type];
  };
  return { result, host, stored, asked };
}

describe('setRouteSides', () => {
  it('with no stored row writes a bend-less AUTO row — the side is a constraint, not a claim', () => {
    const { result, host, stored, asked } = render(model());
    let token: string | undefined;
    act(() => {
      token = result.current.actions.setRouteSides('c1', { sourceSide: 'top' });
    });
    expect(host.current.commands).toHaveLength(1);
    expect(asked()).toEqual(['route.set']);
    expect(stored()).toEqual({ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top' });
    expect(manualRouteIds(result.current.model.diagrams[0]).has('c1')).toBe(false);
    expect(token).toBe(result.current.commitToken);
  });

  it('merges into a hand-drawn row, which stays hand-drawn with its bends', () => {
    const { result, stored } = render(model([MANUAL]));
    act(() => result.current.actions.setRouteSides('c1', { targetSide: 'left' }));
    expect(stored()).toEqual({ ...MANUAL, targetSide: 'left' });
    act(() => result.current.actions.setRouteSides('c1', { sourceSide: 'bottom' }));
    expect(stored()).toEqual({ ...MANUAL, sourceSide: 'bottom', targetSide: 'left' });
  });

  it('is a no-op for the side an end already has, and for Automatic on a line with no row', () => {
    const { result, host } = render(model([{ ...AUTO, sourceSide: 'top' }]));
    let token: string | undefined = '';
    act(() => {
      token = result.current.actions.setRouteSides('c1', { sourceSide: 'top' });
    });
    expect(token).toBeUndefined();
    act(() => {
      token = result.current.actions.setRouteSides('c1', {});
    });
    expect(token).toBeUndefined();
    const bare = render(model());
    act(() => {
      token = bare.result.current.actions.setRouteSides('c1', { sourceSide: undefined });
    });
    expect(token).toBeUndefined();
    expect(host.current.commands).toEqual([]);
    expect(bare.host.current.commands).toEqual([]);
  });

  it('freeing the last side of a side-only row forgets the row', () => {
    const { result, stored, asked } = render(model([{ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top' }]));
    act(() => result.current.actions.setRouteSides('c1', { sourceSide: undefined }));
    expect(stored()).toBeUndefined();
    expect(asked()).toEqual(['route.clear']);
  });

  it('with live routing OFF is a plain step whose token the routing pass folds into: one undo step', () => {
    const { result, stored } = render(model([AUTO]));
    const before = result.current.geometryVersion;
    let token = '';
    act(() => {
      token = result.current.actions.setRouteSides('c1', { sourceSide: 'top' })!;
    });
    expect(result.current.geometryVersion).toBe(before); // nothing queues a live pass; the caller runs one
    act(() => {
      result.current.actions.applyTidyResult(
        { placements: [], edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 200, y: 100 }, { x: 200, y: 60 }], source: 'auto', sourceSide: 'top' }] },
        token,
      );
    });
    expect(stored()).toMatchObject({ sourceSide: 'top', waypoints: [{ x: 200, y: 100 }, { x: 200, y: 60 }] });
    act(() => result.current.undo());
    expect(stored()).toEqual(AUTO);
    expect(result.current.canUndo).toBe(false);
  });

  it('with live routing ON bumps the geometry so the live pass follows on its own', () => {
    const { result } = render(model([AUTO], true));
    const before = result.current.geometryVersion;
    act(() => result.current.actions.setRouteSides('c1', { sourceSide: 'top' }));
    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });
});

describe('connect / reconnect with sides (Alt-drag)', () => {
  it('connect writes the line AND its side row in one step, and returns the new id', () => {
    const { result, host } = render(model());
    let id: string | undefined;
    act(() => {
      id = result.current.actions.connect('e1', 'e3', { sourceSide: 'right', targetSide: 'top' });
    });
    expect(id).toBeDefined();
    expect(host.current.commands).toHaveLength(1);
    expect(result.current.model.connections.find((c) => c.id === id))
      .toMatchObject({ sourceId: 'e1', targetId: 'e3' });
    expect(result.current.model.diagrams[0].edgeRoutes?.find((r) => r.connectionId === id)).toEqual({
      connectionId: id,
      waypoints: [],
      source: 'auto',
      sourceSide: 'right',
      targetSide: 'top',
    });
    // One undo takes both away.
    act(() => result.current.undo());
    expect(result.current.model.connections.some((c) => c.id === id)).toBe(false);
    expect(result.current.model.diagrams[0].edgeRoutes).toBeUndefined();
  });

  it('connect without sides writes no route row, exactly as before', () => {
    const { result, host } = render(model());
    act(() => result.current.actions.connect('e1', 'e3'));
    expect(result.current.model.diagrams[0].edgeRoutes).toBeUndefined();
    expect(host.current.commands).toHaveLength(1);
    expect(result.current.actions.connect('e1', 'e1')).toBeUndefined();
  });

  it('reconnect repoints the line and fixes only the dragged end, in one geometry step', () => {
    const { result, host, stored } = render(model([{ ...AUTO, sourceSide: 'bottom' }]));
    const before = result.current.geometryVersion;
    act(() => result.current.actions.reconnect('c1', { sourceId: 'e1', targetId: 'e3' }, { targetSide: 'left' }));
    expect(host.current.commands).toHaveLength(1);
    expect(result.current.model.connections[0]).toMatchObject({ id: 'c1', sourceId: 'e1', targetId: 'e3' });
    expect(stored()).toEqual({ ...AUTO, sourceSide: 'bottom', targetSide: 'left' });
    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });
});

describe('the other route actions carry sides', () => {
  const SIDED: EdgeRoute = { ...MANUAL, sourceSide: 'top' };

  it('removing every bend of a hand-drawn row with sides leaves a side-only AUTO row, not a claim', () => {
    const { result, stored } = render(model([SIDED]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(stored()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined, source: 'auto', sourceSide: 'top' });
    expect(manualRouteIds(result.current.model.diagrams[0]).has('c1')).toBe(false);
  });

  it('a bend edit and a label move keep the sides and still claim the route', () => {
    const { result, stored } = render(model([SIDED]));
    act(() => result.current.actions.setEdgeRoute('c1', [{ x: 520, y: 165 }]));
    expect(stored()).toMatchObject({ source: 'manual', sourceSide: 'top' });
    act(() => result.current.actions.setEdgeLabelPosition('c1', { x: 1, y: 2 }));
    expect(stored()).toMatchObject({ source: 'manual', sourceSide: 'top', labelPosition: { x: 1, y: 2 } });
  });

  it('resetting the chip of a row that then holds only sides hands the line back to the router', () => {
    const { result, stored } = render(model([{ connectionId: 'c1', waypoints: [], labelPosition: { x: 1, y: 2 }, source: 'manual', sourceSide: 'top' }]));
    act(() => result.current.actions.setEdgeLabelPosition('c1', undefined));
    expect(stored()).toMatchObject({ waypoints: [], source: 'auto', sourceSide: 'top' });
  });

  it('pin and unpin keep the sides; reset forgets them with everything else', () => {
    const { result, stored } = render(model([{ ...AUTO, targetSide: 'right' }]));
    act(() => result.current.actions.setRouteSource('c1', 'manual'));
    expect(stored()).toMatchObject({ source: 'manual', pinned: true, targetSide: 'right' });
    act(() => result.current.actions.setRouteSource('c1', 'auto'));
    expect(stored()).toMatchObject({ source: 'auto', targetSide: 'right' });
    expect(stored()?.pinned).toBeUndefined();
    act(() => result.current.actions.resetEdgeRoute('c1'));
    expect(stored()).toBeUndefined();
  });

  it('applyTidyResult writes the sides the pass emitted, and keeps the sides of a row it clears', () => {
    const { result, stored } = render(model([{ ...AUTO, sourceSide: 'top' }]));
    act(() =>
      result.current.actions.applyTidyResult({
        placements: [],
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 200, y: 60 }], source: 'auto', sourceSide: 'top' }],
      }),
    );
    expect(stored()).toMatchObject({ waypoints: [{ x: 200, y: 60 }], sourceSide: 'top' });

    // A result that lists nothing for c1 (a routed board where c1 was unroutable):
    // bends gone, side kept, row the router's.
    const cleared = render(model([{ ...MANUAL, sourceSide: 'top' }]));
    act(() => cleared.result.current.actions.applyTidyResult({ placements: [], edgeRoutes: [] }));
    expect(cleared.stored()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined, source: 'auto', sourceSide: 'top' });
  });
});
