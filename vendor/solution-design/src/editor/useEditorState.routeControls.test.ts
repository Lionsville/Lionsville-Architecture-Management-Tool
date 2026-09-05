// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, EdgeRoute, SolutionDesignEditorProps } from '../types';
import { manualRouteIds } from '../model/routes';
import { useEditorState } from './useEditorState';

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
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: initial,
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
  };
  const { result } = renderHook(() => useEditorState(props));
  const effective = () =>
    result.current.effectiveModel.diagrams[0].edgeRoutes?.find((r) => r.connectionId === 'c1');
  const emitted = () => onChange.mock.calls.at(-1)?.[0].edgeRoutes.find((r) => r.connectionId === 'c1');
  return { result, onChange, effective, emitted };
}

describe('setRouteSource — Pin and Unpin', () => {
  it('pins a line with no stored row by writing a bend-less pinned row', () => {
    const { result, onChange, effective, emitted } = render(model());

    act(() => result.current.actions.setRouteSource('c1', 'manual'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(emitted()).toEqual({
      connectionId: 'c1',
      waypoints: [],
      labelPosition: undefined,
      source: 'manual',
      pinned: true,
    });
    // The pin IS content: the row survives the merge, and every automatic pass
    // now has to leave this line alone.
    expect(effective()?.pinned).toBe(true);
    expect(manualRouteIds(result.current.effectiveModel.diagrams[0]).has('c1')).toBe(true);
  });

  it('pins router output as-is: same bends, now the user’s', () => {
    const { result, effective } = render(model([AUTO]));
    act(() => result.current.actions.setRouteSource('c1', 'manual'));
    expect(effective()).toMatchObject({ waypoints: AUTO.waypoints, source: 'manual', pinned: true });
  });

  it('unpins a hand-drawn route without moving it, and unpinning a bare pin deletes the row', () => {
    const { result, effective } = render(model([MANUAL]));
    act(() => result.current.actions.setRouteSource('c1', 'auto'));
    expect(effective()).toMatchObject({ waypoints: MANUAL.waypoints, source: 'auto' });
    expect(effective()?.pinned).toBeUndefined();

    const bare = render(model([{ connectionId: 'c1', waypoints: [], source: 'manual', pinned: true }]));
    act(() => bare.result.current.actions.setRouteSource('c1', 'auto'));
    // Nothing left to say about a straight, unpinned line: the row is gone.
    expect(bare.effective()).toBeUndefined();
    expect(bare.emitted()).toMatchObject({ waypoints: [], source: 'auto' });
  });

  it('does nothing when asked to unpin a line that has no row', () => {
    const { result, onChange } = render(model());
    act(() => result.current.actions.setRouteSource('c1', 'auto'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is one undo step and moves no geometry', () => {
    const { result, effective } = render(model([AUTO]));
    const before = result.current.geometryVersion;
    act(() => result.current.actions.setRouteSource('c1', 'manual'));
    expect(result.current.geometryVersion).toBe(before);
    act(() => result.current.undo());
    expect(effective()).toEqual(AUTO);
  });
});

describe('resetEdgeRoute — Reset to automatic', () => {
  it('deletes the row and, with live routing OFF, hands back a token the routing pass amends into', () => {
    const { result, effective } = render(model([MANUAL]));
    const before = result.current.geometryVersion;

    let token = -1;
    act(() => {
      token = result.current.actions.resetEdgeRoute('c1');
    });
    expect(effective()).toBeUndefined();
    // No geometry bump: nothing would queue a live pass, so the caller runs one.
    expect(result.current.geometryVersion).toBe(before);
    expect(token).toBe(result.current.overlayVersion);

    // What the editor does next: route, then apply against the reset's token.
    act(() => {
      result.current.actions.applyTidyResult(
        { placements: [], edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 600, y: 165 }, { x: 600, y: 400 }], source: 'auto' }] },
        token,
      );
    });
    expect(effective()).toMatchObject({ source: 'auto', waypoints: [{ x: 600, y: 165 }, { x: 600, y: 400 }] });

    // ONE undo puts the hand-drawn route back.
    act(() => result.current.undo());
    expect(effective()).toEqual(MANUAL);
    expect(result.current.canUndo).toBe(false);
  });

  it('with live routing ON, bumps the geometry so the live pass follows on its own', () => {
    const { result, effective } = render(model([MANUAL], true));
    const before = result.current.geometryVersion;
    act(() => {
      result.current.actions.resetEdgeRoute('c1');
    });
    expect(effective()).toBeUndefined();
    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });
});

describe('setEdgeRoute — removing every bend', () => {
  it('writes the delete marker for a bend-only hand-drawn route, so the router gets it back', () => {
    const { result, effective, emitted } = render(model([MANUAL]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(effective()).toBeUndefined();
    // Not stamped manual: a manual, content-less row is what every automatic pass
    // would then preserve forever.
    expect(emitted()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined });
    expect(manualRouteIds(result.current.effectiveModel.diagrams[0]).has('c1')).toBe(false);
  });

  it('keeps the label anchor the user placed, as a label-only manual row', () => {
    const { result, effective } = render(model([{ ...MANUAL, labelPosition: { x: 400, y: 150 } }]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(effective()).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: { x: 400, y: 150 }, source: 'manual', pinned: undefined });
  });

  it('keeps the pin: a pinned line with its bends removed is straight AND still pinned', () => {
    const { result, effective } = render(model([{ ...MANUAL, pinned: true }]));
    act(() => result.current.actions.setEdgeRoute('c1', []));
    expect(effective()).toMatchObject({ waypoints: [], source: 'manual', pinned: true });
  });

  it('carries the pin through a bend edit and through a label move', () => {
    const { result, effective } = render(model([{ ...MANUAL, pinned: true }]));
    act(() => result.current.actions.setEdgeRoute('c1', [{ x: 520, y: 165 }]));
    expect(effective()?.pinned).toBe(true);
    act(() => result.current.actions.setEdgeLabelPosition('c1', { x: 1, y: 2 }));
    expect(effective()).toMatchObject({ pinned: true, labelPosition: { x: 1, y: 2 } });
  });
});

describe('movePlacements — hand-drawn routes follow their nodes', () => {
  it('slides the bend next to the moved node along its end leg, in the same commit', () => {
    // e1's right side is at y 100..230; the first leg leaves it horizontally at
    // y = 165. Moving e1 down 50 must take that leg — and only its y — along.
    const { result, onChange, effective } = render(model([MANUAL]));
    act(() => result.current.actions.movePlacements([{ elementId: 'e1', x: 100, y: 150 }]));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(effective()?.waypoints).toEqual([{ x: 500, y: 215 }, { x: 500, y: 400 }]);
    expect(effective()?.source).toBe('manual');
    // The batch carries the placement AND the route.
    const batch = onChange.mock.calls[0][0];
    expect(batch.placements.find((p) => p.elementId === 'e1')).toMatchObject({ y: 150 });
    expect(batch.edgeRoutes.find((r) => r.connectionId === 'c1')?.waypoints[0]).toEqual({ x: 500, y: 215 });

    // One undo takes back both.
    act(() => result.current.undo());
    expect(effective()).toEqual(MANUAL);
    expect(result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'e1')).toMatchObject({ y: 100 });
  });

  it('leaves router output alone — live routing recomputes it, or nobody asked', () => {
    const { result, effective } = render(model([AUTO]));
    act(() => result.current.actions.movePlacements([{ elementId: 'e1', x: 100, y: 150 }]));
    expect(effective()).toEqual(AUTO);
  });

  it('follows a pinned bend-less row trivially (nothing to move) and a route at the target end', () => {
    const pinned: EdgeRoute = { connectionId: 'c1', waypoints: [], source: 'manual', pinned: true };
    const { result, effective } = render(model([pinned]));
    act(() => result.current.actions.movePlacements([{ elementId: 'e1', x: 120, y: 160 }]));
    expect(effective()).toEqual(pinned);

    // e2: 900..1100 × 400..530; the last leg (500,400)→(900,400)... enters e2's
    // left side horizontally at y = 400, so moving e2 down 40 moves that bend's y.
    const atTarget = render(model([MANUAL]));
    act(() => atTarget.result.current.actions.movePlacements([{ elementId: 'e2', x: 900, y: 440 }]));
    expect(atTarget.effective()?.waypoints).toEqual([{ x: 500, y: 165 }, { x: 500, y: 440 }]);
  });
});
