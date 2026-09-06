// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch } from '../model/types';
import type { SolutionDesignEditorProps } from './props';
import { routeDiagramEdges } from '../layout/routeOnly';
import { useEditorState } from './useEditorState';

/**
 * Route-only through the editor: `routeDiagramEdges` emits a routes-only
 * TidyResult, so committing it via the existing `applyTidyResult` action must be
 * ONE undo step that touches no placement and no layoutConfig.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'e2', kind: 'application', name: 'E2', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'e3', kind: 'application', name: 'E3', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [
      // Blocked by the 'Ops' box below → route-only detours it.
      { id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false },
      // Clear line → route-only straightens it, clearing the stale manual route.
      { id: 'c2', sourceId: 'e1', targetId: 'e3', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 100, y: 400 },
          { elementId: 'e2', zone: 'landscape', x: 1200, y: 400 },
          { elementId: 'e3', zone: 'landscape', x: 100, y: 800 },
        ],
        edgeRoutes: [
          { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }] },
          { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
        ],
        layoutConfig: {
          canvas: { width: 2000, height: 1200 },
          domainGroups: [{ name: 'Ops', x: 600, y: 350, width: 300, height: 260 }],
        },
      },
    ],
  };
}

function renderEditorState() {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: model(),
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
  };
  const { result } = renderHook(() => useEditorState(props));
  return { result, onChange };
}

describe('route-only through applyTidyResult', () => {
  it('commits one undo step that re-routes edges and moves nothing', async () => {
    const { result, onChange } = renderEditorState();
    const before = result.current.effectiveModel.diagrams[0];
    const placementsBefore = before.placements;
    const layoutConfigBefore = before.layoutConfig;

    // The router is WASM, so the pass is async: await it OUTSIDE `act` and commit
    // the finished result inside, which keeps the commit a single React update.
    const routes = await routeDiagramEdges(
      result.current.effectiveModel,
      result.current.effectiveModel.diagrams[0],
    );
    act(() => {
      result.current.actions.applyTidyResult(routes);
    });

    // (a) ONE batch. `placements` is the full effective list the host upserts, so
    // "moved nothing" means it comes back BYTE-IDENTICAL to what went in.
    expect(onChange).toHaveBeenCalledTimes(1);
    const batch = onChange.mock.calls.at(-1)![0];
    expect(batch.placements).toEqual(placementsBefore);
    expect(batch.removedPlacementElementIds).toEqual([]);
    expect(batch.layoutConfig).toBeUndefined();

    // (b) Positions and layout config are untouched; the routes changed.
    const after = result.current.effectiveModel.diagrams[0];
    expect(after.placements).toEqual(placementsBefore);
    expect(after.layoutConfig).toEqual(layoutConfigBefore);
    const c1 = after.edgeRoutes!.find((r) => r.connectionId === 'c1')!;
    expect(c1.waypoints.length).toBeGreaterThan(0);
    expect(c1.waypoints).not.toEqual([{ x: 10, y: 20 }]); // the stale route is gone
    // c2's line is clear, so its stale label anchor is cleared back to default.
    expect(after.edgeRoutes!.find((r) => r.connectionId === 'c2')).toBeUndefined();

    // (c) ONE undo restores every prior route verbatim.
    act(() => result.current.undo());
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }] },
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);
    expect(result.current.effectiveModel.diagrams[0].placements).toEqual(placementsBefore);
  });
});
