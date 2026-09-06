// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel } from '../model/types';
import { routeDiagramEdges } from '../layout/routeOnly';


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

function render() {
  const { result, host } = renderEditorState(model(), { activeDiagramId: 'd1' });
  return { result, host };
}

describe('route-only through applyTidyResult', () => {
  it('is one undo step that re-routes edges and moves nothing', async () => {
    const { result, host } = render();
    const before = result.current.model.diagrams[0];
    const placementsBefore = before.placements;
    const layoutConfigBefore = before.layoutConfig;

    // The router is WASM, so the pass is async: await it OUTSIDE `act` and commit
    // the finished result inside, which keeps the commit a single React update.
    const routes = await routeDiagramEdges(
      result.current.model,
      result.current.model.diagrams[0],
    );
    act(() => {
      result.current.actions.applyTidyResult(routes);
    });

    // (a) ONE command, and it speaks only about routes: a pass that moved
    // nothing asks for no placement and no layout.
    expect(host.current.commands).toHaveLength(1);
    const step = host.current.commands[0];
    expect(step.type === 'transaction' && step.commands.map((c) => c.type))
      .toEqual(['route.clear', 'route.set']);

    // (b) Positions and layout config are untouched; the routes changed.
    const after = result.current.model.diagrams[0];
    expect(after.placements).toEqual(placementsBefore);
    expect(after.layoutConfig).toEqual(layoutConfigBefore);
    const c1 = after.edgeRoutes!.find((r) => r.connectionId === 'c1')!;
    expect(c1.waypoints.length).toBeGreaterThan(0);
    expect(c1.waypoints).not.toEqual([{ x: 10, y: 20 }]); // the stale route is gone
    // c2's line is clear, so its stale label anchor is cleared back to default.
    expect(after.edgeRoutes!.find((r) => r.connectionId === 'c2')).toBeUndefined();

    // (c) ONE undo restores every prior route verbatim.
    act(() => result.current.undo());
    expect(result.current.model.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }] },
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);
    expect(result.current.model.diagrams[0].placements).toEqual(placementsBefore);
  });
});
