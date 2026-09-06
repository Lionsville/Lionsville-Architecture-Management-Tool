// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch } from '../model/types';
import type { SolutionDesignEditorProps } from './props';
import { useEditorState } from './useEditorState';

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
  return { result, onChange };
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

  it('bumps on undo and on redo, which never go through commit', () => {
    // The hole a bump list built from the action functions would have. Without
    // this, Cmd+Z after a node move restores the old positions and keeps the
    // routes computed for the new ones — the exact stale geometry live routing
    // exists to remove, reached by the one gesture a user reaches for when they
    // dislike what they see.
    const { result } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    const afterMove = result.current.geometryVersion;

    act(() => {
      result.current.undo();
    });
    const afterUndo = result.current.geometryVersion;
    expect(afterUndo).toBeGreaterThan(afterMove);

    act(() => {
      result.current.redo();
    });
    expect(result.current.geometryVersion).toBeGreaterThan(afterUndo);
  });
});

describe('one gesture, one undo step', () => {
  it('folds the reroute into the move it followed', () => {
    const { result, onChange } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    // Taken exactly as the live effect takes it: after the move, before the pass.
    const token = result.current.overlayVersion;
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.actions.applyTidyResult(ROUTES, token);
    });

    // The routes landed...
    expect(
      result.current.effectiveModel.diagrams[0].edgeRoutes?.find((r) => r.connectionId === 'c1'),
    ).toMatchObject({ waypoints: [{ x: 500, y: 300 }] });

    // ...and ONE undo takes back the move AND the routes together.
    act(() => {
      result.current.undo();
    });
    const diagram = result.current.effectiveModel.diagrams[0];
    expect(diagram.placements.find((p) => p.elementId === 'e1')).toMatchObject({ x: 100, y: 400 });
    expect(diagram.edgeRoutes ?? []).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(onChange).toHaveBeenCalled();
  });

  it('falls back to its own undo step when the token is stale', () => {
    // The user edited again while the pass was in flight. Folding into a step
    // that has moved on would be worse than a second entry.
    const { result } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    const token = result.current.overlayVersion;

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
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes ?? []).toEqual([]);
    // The second move is still applied — the undo above only took the routes.
    expect(
      result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'e2'),
    ).toMatchObject({ x: 700, y: 200 });
  });

  it('invalidates the token across an undo, so pre-undo routes cannot survive it', () => {
    // The concrete race: drag a node, the reroute is in flight, Cmd+Z. `undo`
    // bypasses `commit`, so a commit-local counter would STILL match here and the
    // reroute would write routes measured against positions the undo threw away,
    // into the restored step, with no undo entry of its own to reach them.
    const { result } = render();

    act(() => {
      result.current.actions.movePlacements([{ elementId: 'e1', x: 200, y: 500 }]);
    });
    const token = result.current.overlayVersion;

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
    expect(result.current.effectiveModel.diagrams[0].edgeRoutes ?? []).toEqual([]);
    expect(
      result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'e1'),
    ).toMatchObject({ x: 100, y: 400 });
  });
});

describe('the auto-route toggle is a mode, not content', () => {
  it('persists through the batch', () => {
    const { result, onChange } = render();

    act(() => {
      result.current.actions.setAutoRoute(true);
    });

    expect(onChange.mock.calls.at(-1)![0].autoRoute).toBe(true);
    expect(result.current.effectiveModel.diagrams[0].autoRoute).toBe(true);
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

    expect(result.current.effectiveModel.diagrams[0].autoRoute).toBe(true);
  });

  it('emits nothing when the value did not change', () => {
    const { result, onChange } = render();
    act(() => {
      result.current.actions.setAutoRoute(false);
    });
    expect(onChange).not.toHaveBeenCalled();
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
  it('produces exactly one commit and no follow-up pass, with auto-route on', () => {
    const live = model();
    live.diagrams[0].autoRoute = true;
    const { result, onChange } = render(live);
    const before = result.current.geometryVersion;

    // What a settling pass commits: placements, group rects and routes in one go.
    act(() => {
      result.current.actions.applyTidyResult({
        edgeRoutes: [{ connectionId: 'c1', waypoints: [{ x: 500, y: 300 }], source: 'auto' }],
        placements: [
          { elementId: 'e1', zone: 'landscape', x: 300, y: 300 },
          { elementId: 'e2', zone: 'landscape', x: 800, y: 300 },
        ],
      });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    // No bump, so the debounced reroute is never armed and there is nothing to
    // double-commit — no coordination mechanism required on either side.
    expect(result.current.geometryVersion).toBe(before);
  });
});
