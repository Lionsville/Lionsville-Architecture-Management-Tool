// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, SolutionDesignEditorProps } from '../model/types';
import { useEditorState } from './useEditorState';

/**
 * Intent rule 10, at the choke-point that enforces it.
 *
 * Every hand edit to a route's geometry goes through `setEdgeRoute` or
 * `setEdgeLabelPosition` — the waypoint drag, the double-click insert, the
 * right-click remove, the chip drag, the chip reset. Both must stamp the route
 * `manual`, in the SAME commit as the geometry, so that:
 *
 *  - nudging one automatic line and keeping it needs no mode switch,
 *  - a single undo puts back both the geometry and the claim, and
 *  - no automatic pass can ever quietly reclaim it afterwards.
 *
 * Tested here rather than through the DOM because these two actions are the rule:
 * the gestures are just five ways to reach them, and simulating a pointer drag in
 * jsdom tests the shim more than it tests this.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'e2', kind: 'application', name: 'E2', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceId: 'e1', targetId: 'e2', label: 'Orders', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 100, y: 400 },
          { elementId: 'e2', zone: 'landscape', x: 900, y: 400 },
        ],
        // Router output: no handles, larger radius, replaceable — until touched.
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 500, y: 400 }], source: 'auto' }],
      },
    ],
  };
}

function renderEditorState(initial: DesignModel = model()) {
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
  const routeOf = (batch: DiagramContentBatch) =>
    batch.edgeRoutes.find((r) => r.connectionId === 'c1');
  return { result, onChange, routeOf };
}

describe('a hand edit claims the route', () => {
  it('flips an auto route to manual when its waypoints are edited', () => {
    const { result, onChange, routeOf } = renderEditorState();

    act(() => {
      result.current.actions.setEdgeRoute('c1', [{ x: 500, y: 250 }]);
    });

    // ONE commit carrying both the new geometry and the claim.
    expect(onChange).toHaveBeenCalledTimes(1);
    const route = routeOf(onChange.mock.calls.at(-1)![0]);
    expect(route?.source).toBe('manual');
    expect(route?.waypoints).toEqual([{ x: 500, y: 250 }]);
  });

  it('flips an auto route to manual when only its label chip moves', () => {
    // The gap the old waypoint-presence heuristic could not see at all: a chip is
    // a hand edit that leaves the bends exactly where the router put them, so
    // "does it have waypoints" says nothing about whether a person touched it.
    const { result, onChange, routeOf } = renderEditorState();

    act(() => {
      result.current.actions.setEdgeLabelPosition('c1', { x: 620, y: 330 });
    });

    const route = routeOf(onChange.mock.calls.at(-1)![0]);
    expect(route?.source).toBe('manual');
    expect(route?.labelPosition).toEqual({ x: 620, y: 330 });
    // The router's bends ride along untouched — claiming is not rewriting.
    expect(route?.waypoints).toEqual([{ x: 500, y: 400 }]);
  });

  it('claims a route that had none stored at all', () => {
    // Drawing the first bend on a plain floating edge. There is no row yet, so
    // nothing to inherit a source from, and it must not default to auto.
    const plain = model();
    plain.diagrams[0].edgeRoutes = undefined;
    const { result, onChange, routeOf } = renderEditorState(plain);

    act(() => {
      result.current.actions.setEdgeRoute('c1', [{ x: 500, y: 250 }]);
    });

    expect(routeOf(onChange.mock.calls.at(-1)![0])?.source).toBe('manual');
  });

  it('gives the route back to the router in one undo', () => {
    const { result, onChange, routeOf } = renderEditorState();

    act(() => {
      result.current.actions.setEdgeRoute('c1', [{ x: 500, y: 250 }]);
    });
    expect(routeOf(onChange.mock.calls.at(-1)![0])?.source).toBe('manual');

    act(() => {
      result.current.undo();
    });

    // Asserted on the EFFECTIVE model rather than the emitted batch, because a
    // batch is a cumulative diff against the current server base: with the edit
    // not yet saved, "no route entry" is the correct patch and says nothing about
    // what the user sees. What must hold is that the board is back to the
    // router's geometry AND the router's ownership — if the claim outlived the
    // undo, one stray double-click would permanently remove a line from the
    // reach of every automatic pass.
    const restored = result.current.effectiveModel.diagrams[0].edgeRoutes?.find(
      (r) => r.connectionId === 'c1',
    );
    expect(restored?.source).toBe('auto');
    expect(restored?.waypoints).toEqual([{ x: 500, y: 400 }]);
  });

  it('sends a provenance-only change to the server even when the geometry is identical', () => {
    // The batch is a diff, so a row only travels when it differs from the base.
    // Provenance is a persisted field, so "same bends, changed hands" has to
    // count as a difference — otherwise a route that becomes manual over an
    // already-stored auto row would look unchanged and never persist, and the
    // rule would hold in the session and evaporate on reload.
    const { result, onChange, routeOf } = renderEditorState();

    act(() => {
      // Byte-identical waypoints to what the base already stores.
      result.current.actions.setEdgeRoute('c1', [{ x: 500, y: 400 }]);
    });

    const route = routeOf(onChange.mock.calls.at(-1)![0]);
    expect(route?.source).toBe('manual');
    expect(route?.waypoints).toEqual([{ x: 500, y: 400 }]);
  });
});
