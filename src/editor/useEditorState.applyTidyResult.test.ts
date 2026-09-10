// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { edgeRoutesOf } from '../model/routes';
import { placedNodes } from '../model/placement';
import { laidOut } from '../model/testFixtures';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel } from '../model/types';
import type { Command } from '../model/commands';

/** What one step asked for, in order — a batch assertion, said as commands. */
function commandTypes(command: Command): string[] {
  return command.type === 'transaction' ? command.commands.map((c) => c.type) : [command.type];
}


/**
 * QF4 / U2: `applyTidyResult` lands placements + the landscape domain-group
 * rects in ONE step, merging rects BY NAME — create-OR-resize (resize an
 * existing rect, append a new group name) and preserving rects Tidy never
 * touched (member-less / other groups).
 */

function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        // `Ghost` is a group the board holds and nobody has drawn a box for
        // yet — the U2 case. A box for a group the board does NOT hold is
        // ignored by the reducer: it has no label and no way to be renamed.
        groups: [
          { id: 'Core', name: 'Core' },
          { id: 'Empty', name: 'Empty' },
          { id: 'Ghost', name: 'Ghost' },
        ],
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 0, y: 0 }],
        layoutConfig: {
          domainGroups: [
            { id: 'Core', x: 0, y: 0, width: 10, height: 10 },
            { id: 'Empty', x: 500, y: 500, width: 40, height: 40 },
          ],
        },
      }),
    ],
  };
}

function render() {
  const { result, host } = renderEditorState(model(), { activeDiagramId: 'd1' });
  return { result, host };
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
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'e2', kind: 'application', name: 'E2', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [
      { type: 'flow', id: 'c1', sourceId: 'e1', targetId: 'e2', isBidirectional: false },
      { type: 'flow', id: 'c2', sourceId: 'e2', targetId: 'e1', isBidirectional: false },
    ],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { id: 'e1', zone: 'landscape', group: 'Core', x: 0, y: 0 },
          { id: 'e2', zone: 'landscape', group: 'Core', x: 50, y: 50 },
        ],
        edgeRoutes: [
          // waypoints-only route
          { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
          // label-anchor-only route
          { relationId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
        ],
      }),
    ],
  };
}

function renderWithRoutes() {
  const { result, host } = renderEditorState(modelWithRoutes(), { activeDiagramId: 'd1' });
  return { result, host };
}

describe('applyTidyResult (U1 — edge-route reconciliation)', () => {
  it('clears every content-bearing route in the same commit, and a single undo restores them', () => {
    const { result, host } = renderWithRoutes();

    // Sanity: both manual routes are live before Tidy.
    expect(edgeRoutesOf(result.current.model.diagrams[0])).toEqual([
      { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { relationId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [
          { id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 },
          { id: 'e2', zone: 'landscape', group: 'Core', x: 400, y: 400 },
        ],
        domainGroups: [],
      });
    });

    // (a) One command, and it asks for both rows to be forgotten rather than
    // storing an empty one.
    expect(host.current.commands).toHaveLength(1);
    expect(commandTypes(host.current.commands[0]))
      .toEqual(['transaction', 'route.clear']);
    expect(edgeRoutesOf(result.current.model.diagrams[0])).toEqual([]);

    // (b) One undo restores the original routes verbatim.
    act(() => result.current.undo());
    expect(edgeRoutesOf(result.current.model.diagrams[0])).toEqual([
      { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { relationId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
    ]);
  });

  it('says nothing about routes when the tidied diagram has none (no-op)', () => {
    const { result, host } = render();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 100, y: 120 }],
        domainGroups: [{ id: 'Core', x: 60, y: 70, width: 300, height: 200 }],
      });
    });

    expect(commandTypes(host.current.commands[0])).toEqual(['transaction', 'box.set']);
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
      { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [{ id: 'e1', zone: 'landscape', x: 300, y: 300 }],
        layoutConfig: { canvas: { width: 2000, height: 1200 } },
      }),
    ],
  };
}

function renderWithCanvas() {
  const { result, host } = renderEditorState(modelWithCanvas(), { activeDiagramId: 'd1' });
  return { result, host };
}

describe('applyTidyResult (U-tidy-canvas — canvas in the single commit)', () => {
  it('writes the grown canvas in one batch and a single undo restores placements + canvas', () => {
    const { result, host } = renderWithCanvas();

    // Baseline: the original canvas.
    expect(result.current.model.diagrams[0].geometry?.canvas).toEqual({
      width: 2000,
      height: 1200,
    });

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ id: 'e1', zone: 'landscape', x: 800, y: 600 }],
        domainGroups: [],
        canvas: { width: 2400, height: 1600 },
      });
    });

    // One command; canvas + placement updated together.
    expect(host.current.commands).toHaveLength(1);
    expect(result.current.model.diagrams[0].geometry?.canvas).toEqual({
      width: 2400,
      height: 1600,
    });
    expect(
      placedNodes(result.current.model.diagrams[0]).find((p) => p.id === 'e1'),
    ).toMatchObject({ x: 800, y: 600 });

    // A single undo restores BOTH the old canvas and the old placement.
    act(() => result.current.undo());
    expect(result.current.model.diagrams[0].geometry?.canvas).toEqual({
      width: 2000,
      height: 1200,
    });
    expect(
      placedNodes(result.current.model.diagrams[0]).find((p) => p.id === 'e1'),
    ).toMatchObject({ x: 300, y: 300 });
  });
});

describe('applyTidyResult (U-edge-2 — ELK routes set, the rest cleared)', () => {
  it('sets ELK waypoints, clears straight/untouched routes, one commit, single undo', () => {
    const { result, host } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [
          { id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 },
          { id: 'e2', zone: 'landscape', group: 'Core', x: 400, y: 400 },
        ],
        domainGroups: [],
        edgeRoutes: [
          // ELK routed c1 with bends → its waypoints must be SET.
          { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
          // ELK routed c2 straight (empty) and it had a content route → CLEARED.
          { relationId: 'c2', waypoints: [] },
        ],
      });
    });

    // One command: c2's row is forgotten and c1's is written, together.
    expect(host.current.commands).toHaveLength(1);
    expect(commandTypes(host.current.commands[0]))
      .toEqual(['transaction', 'route.clear', 'route.set']);

    // The diagram after it: c1 routed, c2 gone.
    const routes = edgeRoutesOf(result.current.model.diagrams[0]) ?? [];
    const byConn = new Map(routes.map((r) => [r.relationId, r]));
    expect(byConn.get('c1')).toEqual({
      relationId: 'c1',
      waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    });
    expect(byConn.has('c2')).toBe(false);

    // One undo restores BOTH original routes verbatim.
    act(() => result.current.undo());
    expect(edgeRoutesOf(result.current.model.diagrams[0])).toEqual([
      { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { relationId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
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
          { id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 },
          { id: 'e2', zone: 'landscape', group: 'Core', x: 400, y: 400 },
        ],
        domainGroups: [],
        edgeRoutes: [{ relationId: 'c2', waypoints: [], labelPosition: { x: 12, y: 34 } }],
      });
    });

    const routes = edgeRoutesOf(result.current.model.diagrams[0]) ?? [];
    const c2 = routes.find((r) => r.relationId === 'c2');
    expect(c2).toEqual({ relationId: 'c2', waypoints: [], labelPosition: { x: 12, y: 34 } });
  });
});

describe('applyTidyResult (QF4 / U2)', () => {
  it('creates-or-resizes rects by name and preserves rects Tidy did not touch', () => {
    const { result, host } = render();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 100, y: 120 }],
        domainGroups: [
          // Existing group, re-sized → geometry updated in place.
          { id: 'Core', x: 60, y: 70, width: 300, height: 200 },
          // New group name with no existing rect → must now be CREATED (U2).
          { id: 'Ghost', x: 0, y: 0, width: 999, height: 999 },
        ],
      });
    });

    const groups =
      result.current.model.diagrams[0].geometry?.groups ?? [];
    const byName = new Map(groups.map((g) => [g.id, g]));

    // Core resized in place.
    expect(byName.get('Core')).toEqual({ id: 'Core', x: 60, y: 70, width: 300, height: 200 });
    // Empty (member-less, not in the tidy result) preserved untouched.
    expect(byName.get('Empty')).toEqual({ id: 'Empty', x: 500, y: 500, width: 40, height: 40 });
    // Ghost is now created (appended) — U2 reversed the old never-create rule so
    // a member-bearing group that lacked a rect gets one.
    expect(byName.get('Ghost')).toEqual({ id: 'Ghost', x: 0, y: 0, width: 999, height: 999 });
    expect(groups).toHaveLength(3);

    // The placement landed too, and the whole thing is ONE step.
    expect(host.current.commands).toHaveLength(1);
    const placement = placedNodes(result.current.model.diagrams[0]).find(
      (p) => p.id === 'e1',
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
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 }],
        domainGroups: [{ id: 'Core', x: 60, y: 70, width: 300, height: 200 }],
        edgeRoutes: [{ relationId: 'c1', waypoints: [] }],
        partial: true,
      });
    });

    const routes = edgeRoutesOf(result.current.model.diagrams[0]) ?? [];
    // c1 was listed with empty waypoints → cleared.
    expect(routes.find((r) => r.relationId === 'c1')).toBeUndefined();
    // c2 was never listed → its manual label anchor survives untouched.
    expect(routes.find((r) => r.relationId === 'c2')).toEqual({
      relationId: 'c2',
      waypoints: [],
      labelPosition: { x: 99, y: 88 },
    });
    // e2 was not part of the tidied group → its placement is unchanged.
    const e2 = placedNodes(result.current.model.diagrams[0]).find(
      (p) => p.id === 'e2',
    );
    expect(e2).toMatchObject({ x: 50, y: 50 });
  });

  it('does not clear-all when a partial result carries no routes at all', () => {
    const { result } = renderWithRoutes();

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 }],
        partial: true,
      });
    });

    expect(edgeRoutesOf(result.current.model.diagrams[0])).toEqual([
      { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { relationId: 'c2', waypoints: [], labelPosition: { x: 99, y: 88 } },
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
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 }],
        edgeRoutes: [
          // What a pass with c1 preserved emits: c1's stored geometry unchanged,
          // c2 freshly routed. The apply step cannot tell them apart, and does
          // not need to — writing the preserved one back is a no-op.
          { relationId: 'c1', waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }], source: 'manual' },
          { relationId: 'c2', waypoints: [{ x: 77, y: 88 }], source: 'auto' },
        ],
      });
    });

    const routes = edgeRoutesOf(result.current.model.diagrams[0]) ?? [];
    expect(routes.find((r) => r.relationId === 'c1')).toMatchObject({
      waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      source: 'manual',
    });
    expect(routes.find((r) => r.relationId === 'c2')).toMatchObject({
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
        edgeRoutes: [{ relationId: 'c1', waypoints: [{ x: 500, y: 500 }], source: 'auto' }],
      });
    });

    expect(
      edgeRoutesOf(result.current.model.diagrams[0])?.find((r) => r.relationId === 'c1'),
    ).toMatchObject({ waypoints: [{ x: 500, y: 500 }], source: 'auto' });
  });

  it('leaves every stored route alone when the router FAILED', () => {
    // `routeOrDegrade` keeps the placements and drops the routes on a throw. This
    // branch used to clear the board's routes anyway, contradicting what both
    // TidyResult.routingError and tidy.routingFailure.test.ts describe. Being
    // unable to compute a replacement is not a licence to delete what is there.
    const { result } = renderWithRoutes();
    const before = edgeRoutesOf(result.current.model.diagrams[0]);

    act(() => {
      result.current.actions.applyTidyResult({
        placements: [{ id: 'e1', zone: 'landscape', group: 'Core', x: 200, y: 200 }],
        routingError: new Error('wasm 404'),
      });
    });

    // The placements landed...
    expect(
      placedNodes(result.current.model.diagrams[0]).find((p) => p.id === 'e1'),
    ).toMatchObject({ x: 200, y: 200 });
    // ...and the routes are untouched.
    expect(edgeRoutesOf(result.current.model.diagrams[0])).toEqual(before);
  });
});
