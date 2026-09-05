// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, SolutionDesignEditorProps } from '../types';
import { useEditorState } from './useEditorState';

/**
 * QF4 / U2: `applyTidyResult` commits placements + the landscape domain-group
 * rects in ONE batch, merging rects BY NAME — create-OR-resize (resize an
 * existing rect, append a new group name) and preserving rects Tidy never
 * touched (member-less / other groups).
 */

function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 }],
        layoutConfig: {
          domainGroups: [
            { name: 'Core', x: 0, y: 0, width: 10, height: 10 },
            { name: 'Empty', x: 500, y: 500, width: 40, height: 40 },
          ],
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

/**
 * U1: Tidy reflows every node, so manual edge routes (waypoints and/or custom
 * label anchors) end up pinned to stale geometry. `applyTidyResult` must clear
 * every content-bearing route on the tidied diagram — folded into the SAME
 * commit as placements/rects so the whole Tidy is a single undo step.
 */
function modelWithRoutes(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'e2', kind: 'application', name: 'E2', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [
      { id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false },
      { id: 'c2', sourceId: 'e2', targetId: 'e1', isBidirectional: false },
    ],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 0, y: 0 },
          { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 50, y: 50 },
        ],
        edgeRoutes: [
          // waypoints-only route
          { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
          // label-anchor-only route
          { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
        ],
      },
    ],
  };
}

function renderWithRoutes() {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: modelWithRoutes(),
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

describe('applyTidyResult (U1 — edge-route reconciliation)', () => {
  it('clears every content-bearing route in the same commit, and a single undo restores them', () => {
    const { result, onChange } = renderWithRoutes();

    // Sanity: both manual routes are live before Tidy.
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [
          { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 },
          { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 400, y: 400 },
        ],
        domainGroups: [],
      });
    });

    // (a) One batch; its edgeRoutes carry soft-delete markers for both routes.
    expect(onChange).toHaveBeenCalledTimes(1);
    const batch = onChange.mock.calls.at(-1)![0];
    const markers = new Map(batch.edgeRoutes.map((r) => [r.connectionId, r]));
    expect(markers.get('c1')).toEqual({ connectionId: 'c1', waypoints: [], labelPosition: undefined });
    expect(markers.get('c2')).toEqual({ connectionId: 'c2', waypoints: [], labelPosition: undefined });
    // Routes are gone from the rendered diagram (markers are non-content).
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual([]);

    // (b) One undo restores the original routes verbatim.
    act(() => result.current.undo());
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);
  });

  it('emits no route markers when the tidied diagram has no manual routes (no-op)', () => {
    const { result, onChange } = renderEditorState();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 100, y: 120 }],
        domainGroups: [{ name: 'Core', x: 60, y: 70, width: 300, height: 200 }],
      });
    });

    const batch = onChange.mock.calls.at(-1)![0];
    expect(batch.edgeRoutes).toEqual([]);
  });
});

/**
 * U-tidy-canvas: a Tidy run can grow/shrink the board. `applyTidyResult` writes
 * the canvas in the SAME single commit as the placements, so ONE undo restores
 * both.
 */
function modelWithCanvas(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [{ elementId: 'e1', zone: 'landscape', x: 300, y: 300 }],
        layoutConfig: { canvas: { width: 2000, height: 1200 } },
      },
    ],
  };
}

function renderWithCanvas() {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: modelWithCanvas(),
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

describe('applyTidyResult (U-tidy-canvas — canvas in the single commit)', () => {
  it('writes the grown canvas in one batch and a single undo restores placements + canvas', () => {
    const { result, onChange } = renderWithCanvas();

    // Baseline: the original canvas.
    expect(result.current.effectiveModel.diagrams[0].layoutConfig?.canvas).toEqual({
      width: 2000,
      height: 1200,
    });

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', x: 800, y: 600 }],
        domainGroups: [],
        canvas: { width: 2400, height: 1600 },
      });
    });

    // One commit; canvas + placement updated together.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.effectiveModel.diagrams[0].layoutConfig?.canvas).toEqual({
      width: 2400,
      height: 1600,
    });
    expect(
      result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'e1'),
    ).toMatchObject({ x: 800, y: 600 });

    // A single undo restores BOTH the old canvas and the old placement.
    act(() => result.current.undo());
    expect(result.current.effectiveModel.diagrams[0].layoutConfig?.canvas).toEqual({
      width: 2000,
      height: 1200,
    });
    expect(
      result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'e1'),
    ).toMatchObject({ x: 300, y: 300 });
  });
});

describe('applyTidyResult (U-edge-2 — ELK routes set, the rest cleared)', () => {
  it('sets ELK waypoints, clears straight/untouched routes, one commit, single undo', () => {
    const { result, onChange } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [
          { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 },
          { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 400, y: 400 },
        ],
        domainGroups: [],
        edgeRoutes: [
          // ELK routed c1 with bends → its waypoints must be SET.
          { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
          // ELK routed c2 straight (empty) and it had a content route → CLEARED.
          { connectionId: 'c2', waypoints: [] },
        ],
      });
    });

    // One batch.
    expect(onChange).toHaveBeenCalledTimes(1);
    const batch = onChange.mock.calls.at(-1)![0];
    const markers = new Map(batch.edgeRoutes.map((r) => [r.connectionId, r]));

    // c1 gets ELK's waypoints (label anchor reset).
    expect(markers.get('c1')).toEqual({
      connectionId: 'c1',
      waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      labelPosition: undefined,
    });
    // c2 is cleared (empty ELK route + previously had a content route).
    expect(markers.get('c2')).toEqual({ connectionId: 'c2', waypoints: [], labelPosition: undefined });

    // Rendered effective diagram: c1 routed, c2 gone.
    const routes = result.current.effectiveModel.diagrams[0].edgeRoutes ?? [];
    const byConn = new Map(routes.map((r) => [r.connectionId, r]));
    expect(byConn.get('c1')).toEqual({
      connectionId: 'c1',
      waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    });
    expect(byConn.has('c2')).toBe(false);

    // One undo restores BOTH original routes verbatim.
    act(() => result.current.undo());
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);
  });

  it('keeps a pinned label on a straight (waypoint-less) route instead of clearing it', () => {
    // A straight edge: the router emits empty waypoints (no handle) but a
    // pinned labelPosition so the chip clears a group box. That pin must SURVIVE — an
    // empty-waypoints entry with a label is content, not a clear marker.
    const { result } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [
          { elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 },
          { elementId: 'e2', zone: 'landscape', domainGroup: 'Core', x: 400, y: 400 },
        ],
        domainGroups: [],
        edgeRoutes: [{ connectionId: 'c2', waypoints: [], labelPosition: { x: 12, y: 34 } }],
      });
    });

    const routes = result.current.effectiveModel.diagrams[0].edgeRoutes ?? [];
    const c2 = routes.find((r) => r.connectionId === 'c2');
    expect(c2).toEqual({ connectionId: 'c2', waypoints: [], labelPosition: { x: 12, y: 34 } });
  });
});

describe('applyTidyResult (QF4 / U2)', () => {
  it('creates-or-resizes rects by name and preserves rects Tidy did not touch', () => {
    const { result, onChange } = renderEditorState();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 100, y: 120 }],
        domainGroups: [
          // Existing group, re-sized → geometry updated in place.
          { name: 'Core', x: 60, y: 70, width: 300, height: 200 },
          // New group name with no existing rect → must now be CREATED (U2).
          { name: 'Ghost', x: 0, y: 0, width: 999, height: 999 },
        ],
      });
    });

    const groups =
      result.current.effectiveModel.diagrams[0].layoutConfig?.domainGroups ?? [];
    const byName = new Map(groups.map((g) => [g.name, g]));

    // Core resized in place.
    expect(byName.get('Core')).toEqual({ name: 'Core', x: 60, y: 70, width: 300, height: 200 });
    // Empty (member-less, not in the tidy result) preserved untouched.
    expect(byName.get('Empty')).toEqual({ name: 'Empty', x: 500, y: 500, width: 40, height: 40 });
    // Ghost is now created (appended) — U2 reversed the old never-create rule so
    // a member-bearing group that lacked a rect gets one.
    expect(byName.get('Ghost')).toEqual({ name: 'Ghost', x: 0, y: 0, width: 999, height: 999 });
    expect(groups).toHaveLength(3);

    // Placement committed too, and the whole thing is ONE batch (one commit).
    expect(onChange).toHaveBeenCalledTimes(1);
    const placement = result.current.effectiveModel.diagrams[0].placements.find(
      (p) => p.elementId === 'e1',
    );
    expect(placement).toMatchObject({ x: 100, y: 120 });
  });
});

/**
 * Phase 2 (per-group tidy): a PARTIAL result reflowed only one group's members,
 * so it may touch only what it lists. Manual routes elsewhere on the board are
 * still pinned to geometry that never moved and must survive.
 */
describe('applyTidyResult (partial — per-group tidy)', () => {
  it('clears only the routes it lists and leaves the rest of the board alone', () => {
    const { result } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 }],
        domainGroups: [{ name: 'Core', x: 60, y: 70, width: 300, height: 200 }],
        edgeRoutes: [{ connectionId: 'c1', waypoints: [] }],
        partial: true,
      });
    });

    const routes = result.current.effectiveModel.diagrams[0].edgeRoutes ?? [];
    // c1 was listed with empty waypoints → cleared.
    expect(routes.find((r) => r.connectionId === 'c1')).toBeUndefined();
    // c2 was never listed → its manual label anchor survives untouched.
    expect(routes.find((r) => r.connectionId === 'c2')).toEqual({
      connectionId: 'c2',
      waypoints: [],
      labelPosition: { x: 99, y: 88 },
    });
    // e2 was not part of the tidied group → its placement is unchanged.
    const e2 = result.current.effectiveModel.diagrams[0].placements.find(
      (p) => p.elementId === 'e2',
    );
    expect(e2).toMatchObject({ x: 50, y: 50 });
  });

  it('does not clear-all when a partial result carries no routes at all', () => {
    const { result } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 }],
        partial: true,
      });
    });

    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual([
      { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { connectionId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);
  });
});

/**
 * `pinAnchorPoints` is NOT enforced here any more — it lives in the routing pass,
 * which re-emits a preserved route verbatim (see `routeOnly.preserve.test.ts`).
 * What this step must do is persist whatever the pass decided, with no second
 * filter of its own. Two mechanisms for one rule is how the label-only gap
 * survived; these tests pin the fact that only one remains.
 */
describe('applyTidyResult (no second preserve filter)', () => {
  it('writes back a preserved route the pass re-emitted verbatim', () => {
    const { result } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 }],
        edgeRoutes: [
          // What a pass with c1 preserved emits: c1's stored geometry unchanged,
          // c2 freshly routed. The apply step cannot tell them apart, and does
          // not need to — writing the preserved one back is a no-op.
          { connectionId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }], source: 'manual' },
          { connectionId: 'c2', waypoints: [{ x: 77, y: 88 }], source: 'auto' },
        ],
      });
    });

    const routes = result.current.effectiveModel.diagrams[0].edgeRoutes ?? [];
    expect(routes.find((r) => r.connectionId === 'c1')).toMatchObject({
      waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      source: 'manual',
    });
    expect(routes.find((r) => r.connectionId === 'c2')).toMatchObject({
      waypoints: [{ x: 77, y: 88 }],
      source: 'auto',
    });
  });

  it('replaces a route the pass did NOT preserve, whoever drew it', () => {
    // With the pin off, pressing Tidy IS the instruction to reflow the board
    // (intent rule 10), so a hand-drawn route the pass re-routed is replaced.
    const { result } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [],
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 500, y: 500 }], source: 'auto' }],
      });
    });

    expect(
      result.current.effectiveModel.diagrams[0].edgeRoutes?.find((r) => r.connectionId === 'c1'),
    ).toMatchObject({ waypoints: [{ x: 500, y: 500 }], source: 'auto' });
  });

  it('leaves every stored route alone when the router FAILED', () => {
    // `routeOrDegrade` keeps the placements and drops the routes on a throw. This
    // branch used to clear the board's routes anyway, contradicting what both
    // TidyResult.routingError and tidy.routingFailure.test.ts describe. Being
    // unable to compute a replacement is not a licence to delete what is there.
    const { result } = renderWithRoutes();
    const before = result.current.effectiveModel.diagrams[0].edgeRoutes;

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ elementId: 'e1', zone: 'landscape', domainGroup: 'Core', x: 200, y: 200 }],
        routingError: new Error('wasm 404'),
      });
    });

    // The placements landed...
    expect(
      result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'e1'),
    ).toMatchObject({ x: 200, y: 200 });
    // ...and the routes are untouched.
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes).toEqual(before);
  });
});
