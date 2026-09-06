// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel } from '../model/types';


/**
 * The two counters live routing rests on, and the amend that keeps one gesture
 * one undo step.
 *
 * `geometryVersion` says "something the router measures has moved". `commit`'s
 * amend token says "fold this into the step I already made". The subtle half of
 * both is `undo`/`redo`, which deliberately bypass `commit` — it is the only push
 * point onto the undo stack — so anything derived from the action functions alone
 * misses them entirely.
 */
function model(): DesignModel {
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
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 100, y: 400 },
          { elementId: 'e2', zone: 'landscape', x: 900, y: 400 },
        ],
      },
    ],
  };
}

function render(initial: DesignModel = model()) {
  return renderEditorState(initial, { activeDiagramId: 'd1' });
}

const ROUTES = { placements: [], edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 500, y: 300 }], source: 'auto' as const }] };

describe('geometryVersion — what makes live routing re-run', () => {
  it('bumps when a node moves', () => {
    const { result } = render();
    const before = result.current.geometryVersion;

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });

    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });

  it('bumps on a topology change', () => {
    const { result } = render();
    const before = result.current.geometryVersion;

    act(() => {
      result.current.actions.deleteConnection('c1');
    });

    expect(result.current.geometryVersion).toBeGreaterThan(before);
  });

  it('does NOT bump on an edit the router cannot see', () => {
    // A rename changes nothing about the obstacle set. Bumping here would spend a
    // whole-board reroute on every keystroke in the inspector.
    const { result } = render();
    const before = result.current.geometryVersion;

    act(() => {
      result.current.actions.updateElement('e1', { name: 'Renamed' });
    });

    expect(result.current.geometryVersion).toBe(before);
  });

  it('does NOT bump for a Tidy, because a Tidy already routed', () => {
    // The exclusion that keeps a tidy from queueing a reroute to fight the
    // 'clear' policy it just ran under — and the reason an auto-layout, which IS
    // an applyTidyResult, needs no coordination mechanism of its own.
    const { result } = render();
    const before = result.current.geometryVersion;

    act(() => {
      result.current.actions.applyTidyResult({
        ...ROUTES,
        placements: [{ elementId: 'e1', zone: 'landscape', x: 300, y: 300 }],
      });
    });

    expect(result.current.geometryVersion).toBe(before);
  });

  it('does NOT bump on undo or redo — the step carries its own routes', () => {
    // This used to bump, and had to: with two stacks the editor's own undo
    // restored positions without the routes computed for them, so a reroute was
    // the only way back to a board that agreed with itself. A step now holds the
    // move AND the routing that followed it (see "one gesture, one undo step"
    // below), so undoing it puts both back — and a pass here would recompute
    // what was just restored, and land outside the step it belongs to.
    const { result } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    const token = result.current.commitToken;
    act(() => {
      result.current.actions.applyTidyResult(ROUTES, token);
    });
    const afterMove = result.current.geometryVersion;

    act(() => {
      result.current.undo();
    });
    expect(result.current.geometryVersion).toBe(afterMove);
    // Both halves of the gesture went back together, which is why no pass is due.
    const diagram = result.current.model.diagrams[0];
    expect(diagram.placements.find((p) => p.elementId === 'e1')).toMatchObject({ x: 100, y: 400 });
    expect(diagram.edgeRoutes).toBeUndefined();

    act(() => {
      result.current.redo();
    });
    expect(result.current.geometryVersion).toBe(afterMove);
    expect(result.current.model.diagrams[0].edgeRoutes)
      .toEqual([{ connectionId: 'c1', waypoints: [{ x: 500, y: 300 }], source: 'auto' }]);
  });
});

describe('one gesture, one undo step', () => {
  it('folds the reroute into the move it followed', () => {
    const { result, host } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    // Taken exactly as the live effect takes it: after the move, before the pass.
    const token = result.current.commitToken;
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.actions.applyTidyResult(ROUTES, token);
    });

    // The routes landed...
    expect(
      result.current.model.diagrams[0].edgeRoutes?.find((r) => r.connectionId === 'c1'),
    ).toMatchObject({ waypoints: [{ x: 500, y: 300 }] });

    // ...and ONE undo takes back the move AND the routes together.
    act(() => {
      result.current.undo();
    });
    const diagram = result.current.model.diagrams[0];
    expect(diagram.placements.find((p) => p.elementId === 'e1')).toMatchObject({ x: 100, y: 400 });
    expect(diagram.edgeRoutes).toBeUndefined();
    expect(result.current.canUndo).toBe(false);
    expect(host.current.commands).toHaveLength(2);
  });

  it('falls back to its own undo step when the token is stale', () => {
    // The user edited again while the pass was in flight. Folding into a step
    // that has moved on would be worse than a second entry.
    const { result } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    const token = result.current.commitToken;

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e2', x: 700, y: 200 }]);
    });

    act(() => {
      result.current.actions.applyTidyResult(ROUTES, token);
    });

    // Three steps, not two: the routes got their own.
    act(() => {
      result.current.undo();
    });
    expect(result.current.model.diagrams[0].edgeRoutes).toBeUndefined();
    // The second move is still applied — the undo above only took the routes.
    expect(
      result.current.model.diagrams[0].placements.find((p) => p.elementId === 'e2'),
    ).toMatchObject({ x: 700, y: 200 });
  });

  it('invalidates the token across an undo, so pre-undo routes cannot survive it', () => {
    // The concrete race: drag a node, the reroute is in flight, Cmd+Z. The undo
    // took the move's step off the stack, so the token no longer names the top
    // and the routes get an entry of their own — rather than being written into
    // a step that is no longer there, unreachable by any further undo.
    const { result } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    const token = result.current.commitToken;

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.actions.applyTidyResult(ROUTES, token);
    });

    // The routes are reachable: one more undo removes them, rather than leaving
    // them stranded on top of the restored state.
    act(() => {
      result.current.undo();
    });
    expect(result.current.model.diagrams[0].edgeRoutes).toBeUndefined();
    expect(
      result.current.model.diagrams[0].placements.find((p) => p.elementId === 'e1'),
    ).toMatchObject({ x: 100, y: 400 });
  });
});

describe('the auto-route toggle is a mode, not content', () => {
  it('is written onto the diagram, so it survives a reload', () => {
    const { result, host } = render();

    act(() => {
      result.current.actions.setAutoRoute(true);
    });

    expect(host.current.commands.at(-1)).toMatchObject({
      type: 'diagram.update', patch: { autoRoute: true }, undoable: false,
    });
    expect(result.current.model.diagrams[0].autoRoute).toBe(true);
  });

  it('never enters the undo stack', () => {
    // Undoing a node move must not silently switch live routing off. A mode the
    // user chose disappearing as a side effect of undoing something else is the
    // kind of behaviour nobody can reason about.
    const { result } = render();

    act(() => {
      result.current.actions.setAutoRoute(true);
    });
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.model.diagrams[0].autoRoute).toBe(true);
  });

  it('sends nothing when the value did not change', () => {
    const { result, host } = render();
    act(() => {
      result.current.actions.setAutoRoute(false);
    });
    expect(host.current.commands).toEqual([]);
  });
});

/**
 * The one interaction between this branch's two halves, tested rather than
 * mechanised.
 *
 * An auto-layout IS an `applyTidyResult`, and a tidy routes as its own final
 * step. The routing plan already excludes `applyTidyResult` from the geometry
 * bump for exactly that reason, so nothing extra is needed to stop a settling
 * pass triggering a live reroute that would fight the 'clear' policy it just ran
 * under. This is the test that says so out loud — the two plans agreed on it in
 * prose, and prose does not fail a build.
 */
describe('auto-layout does not trigger a live reroute', () => {
  it('produces exactly one step and no follow-up pass, with auto-route on', () => {
    const live = model();
    live.diagrams[0].autoRoute = true;
    const { result, host } = render(live);
    const before = result.current.geometryVersion;

    // What a settling pass lands: placements, group rects and routes in one go.
    act(() => {
      result.current.actions.applyTidyResult({
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 500, y: 300 }], source: 'auto' }],
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 300, y: 300 },
          { elementId: 'e2', zone: 'landscape', x: 800, y: 300 },
        ],
      });
    });

    expect(host.current.commands).toHaveLength(1);
    // No bump, so the debounced reroute is never armed and there is nothing to
    // apply twice — no coordination mechanism required on either side.
    expect(result.current.geometryVersion).toBe(before);
  });
});
