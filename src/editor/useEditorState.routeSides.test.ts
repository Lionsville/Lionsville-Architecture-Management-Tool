// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, EdgeRoute } from '../model/types';
import type { SolutionDesignEditorProps } from './props';
import { manualRouteIds } from '../model/routes';
import { useEditorState } from './useEditorState';

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
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: initial,
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
  };
  const { result } = renderHook(() => useEditorState(props));
  const effective = (id = 'c1') =>
    result.current.effectiveModel.diagrams[0].edgeRoutes?.find((r) => r.connectionId === id);
  const emitted = (id = 'c1') => onChange.mock.calls.at(-1)?.[0].edgeRoutes.find((r) => r.connectionId === id);
  return { result, onChange, effective, emitted };
}

describe('setRouteSides', () => {
  it('with no stored row writes a bend-less AUTO row — the side is a constraint, not a claim', () => {
    const { result, onChange, effective, emitted } = render(model());
    let token: number | undefined;
    act(() => {
      token = result.current.actions.setRouteSides('c1', { sourceSide: 'top' });
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(emitted()).toEqual({ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top' });
    expect(effective()).toEqual({ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top' });
    expect(manualRouteIds(result.current.effectiveModel.diagrams[0]).has('c1')).toBe(false);
    expect(token).toBe(result.current.overlayVersion);
  });

  it('merges into a hand-drawn row, which stays hand-drawn with its bends', () => {
    const { result, effective } = render(model([MANUAL]));
    act(() => result.current.actions.setRouteSides('c1', { targetSide: 'left' }));
    expect(effective()).toEqual({ ...MANUAL, targetSide: 'left' });
    act(() => result.current.actions.setRouteSides('c1', { sourceSide: 'bottom' }));
    expect(effective()).toEqual({ ...MANUAL, sourceSide: 'bottom', targetSide: 'left' });
  });

  it('is a no-op for the side an end already has, and for Automatic on a line with no row', () => {
    const { result, onChange } = render(model([{ ...AUTO, sourceSide: 'top' }]));
    let token: number | undefined = 0;
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
    expect(onChange).not.toHaveBeenCalled();
    expect(bare.onChange).not.toHaveBeenCalled();
  });

  it('freeing the last side of a side-only row deletes the row', () => {
    const { result, effective, emitted } = render(model([{ connectionId: 'c1', waypoints: [], source: 'auto', sourceSide: 'top' }]));
    act(() => result.current.actions.setRouteSides('c1', { sourceSide: undefined }));
    expect(effective()).toBeUndefined();
    expect(emitted()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined });
  });

  it('with live routing OFF is a plain commit whose token the routing pass amends into: one undo step', () => {
    const { result, effective } = render(model([AUTO]));
    const before = result.current.geometryVersion;
    let token = -1;
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
    expect(effective()).toMatchObject({ sourceSide: 'top', waypoints: [{ x: 200, y: 100 }, { x: 200, y: 60 }] });
    act(() => result.current.undo());
    expect(effective()).toEqual(AUTO);
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
  it('connect writes the line AND its side row in one commit, and returns the new id', () => {
    const { result, onChange } = render(model());
    let id: string | undefined;
    act(() => {
      id = result.current.actions.connect('e1', 'e3', { sourceSide: 'right', targetSide: 'top' });
    });
    expect(id).toBeDefined();
    expect(onChange).toHaveBeenCalledTimes(1);
    const batch = onChange.mock.calls[0][0];
    expect(batch.connections.find((c) => c.id === id)).toMatchObject({ sourceId: 'e1', targetId: 'e3' });
    expect(batch.edgeRoutes.find((r) => r.connectionId === id)).toEqual({
      connectionId: id,
      waypoints: [],
      source: 'auto',
      sourceSide: 'right',
      targetSide: 'top',
    });
    // One undo takes both away.
    act(() => result.current.undo());
    expect(result.current.effectiveModel.connections.some((c) => c.id === id)).toBe(false);
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes ?? []).toEqual([]);
  });

  it('connect without sides writes no route row, exactly as before', () => {
    const { result, onChange } = render(model());
    act(() => result.current.actions.connect('e1', 'e3'));
    expect(onChange.mock.calls[0][0].edgeRoutes).toEqual([]);
    expect(result.current.actions.connect('e1', 'e1')).toBeUndefined();
  });

  it('reconnect repoints the line and fixes only the dragged end, in one geometry commit', () => {
    const { result, onChange, effective } = render(model([{ ...AUTO, sourceSide: 'bottom' }]));
    const before = result.current.geometryVersion;
    act(() => result.current.actions.reconnect('c1', { sourceId: 'e1', targetId: 'e3' }, { targetSide: 'left' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.effectiveModel.connections[0]).toMatchObject({ id: 'c1', sourceId: 'e1', targetId: 'e3' });
    expect(effective()).toEqual({ ...AUTO, sourceSide: 'bottom', targetSide: 'left' });
    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });
});

describe('the other route actions carry sides', () => {
  const SIDED: EdgeRoute = { ...MANUAL, sourceSide: 'top' };

  it('removing every bend of a hand-drawn row with sides leaves a side-only AUTO row, not a claim', () => {
    const { result, effective } = render(model([SIDED]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(effective()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined, source: 'auto', sourceSide: 'top' });
    expect(manualRouteIds(result.current.effectiveModel.diagrams[0]).has('c1')).toBe(false);
  });

  it('a bend edit and a label move keep the sides and still claim the route', () => {
    const { result, effective } = render(model([SIDED]));
    act(() => result.current.actions.setEdgeRoute('c1', [{ x: 520, y: 165 }]));
    expect(effective()).toMatchObject({ source: 'manual', sourceSide: 'top' });
    act(() => result.current.actions.setEdgeLabelPosition('c1', { x: 1, y: 2 }));
    expect(effective()).toMatchObject({ source: 'manual', sourceSide: 'top', labelPosition: { x: 1, y: 2 } });
  });

  it('resetting the chip of a row that then holds only sides hands the line back to the router', () => {
    const { result, effective } = render(model([{ connectionId: 'c1', waypoints: [], labelPosition: { x: 1, y: 2 }, source: 'manual', sourceSide: 'top' }]));
    act(() => result.current.actions.setEdgeLabelPosition('c1', undefined));
    expect(effective()).toMatchObject({ waypoints: [], source: 'auto', sourceSide: 'top' });
  });

  it('pin and unpin keep the sides; reset forgets them with everything else', () => {
    const { result, effective } = render(model([{ ...AUTO, targetSide: 'right' }]));
    act(() => result.current.actions.setRouteSource('c1', 'manual'));
    expect(effective()).toMatchObject({ source: 'manual', pinned: true, targetSide: 'right' });
    act(() => result.current.actions.setRouteSource('c1', 'auto'));
    expect(effective()).toMatchObject({ source: 'auto', targetSide: 'right' });
    expect(effective()?.pinned).toBeUndefined();
    act(() => result.current.actions.resetEdgeRoute('c1'));
    expect(effective()).toBeUndefined();
  });

  it('applyTidyResult writes the sides the pass emitted, and keeps the sides of a row it clears', () => {
    const { result, effective } = render(model([{ ...AUTO, sourceSide: 'top' }]));
    act(() =>
      result.current.actions.applyTidyResult({
        placements: [],
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 200, y: 60 }], source: 'auto', sourceSide: 'top' }],
      }),
    );
    expect(effective()).toMatchObject({ waypoints: [{ x: 200, y: 60 }], sourceSide: 'top' });

    // A result that lists nothing for c1 (a routed board where c1 was unroutable):
    // bends gone, side kept, row the router's.
    const cleared = render(model([{ ...MANUAL, sourceSide: 'top' }]));
    act(() => cleared.result.current.actions.applyTidyResult({ placements: [], edgeRoutes: [] }));
    expect(cleared.effective()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined, source: 'auto', sourceSide: 'top' });
  });
});
