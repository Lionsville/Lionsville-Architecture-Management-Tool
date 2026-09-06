// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useDragRoutePreview, type DragRoutePreview } from './useDragRoutePreview';
import { MAX_CONNECTIONS_FOR_DRAG_PREVIEW } from '../../layout/libavoidRouter';
import type { DesignDiagram, DesignModel } from '../../model/types';

/**
 * The three things about the preview that are decided OUTSIDE the router: whether it
 * runs at all, what happens to the drag it was previewing, and what the board is
 * left showing.
 *
 * `routeDiagramEdges` is mocked here on purpose. What the router computes is pinned
 * by `routeOnly.dragPreview.test.ts` against the real thing; what this file is for
 * is the decisions around it, and those are invisible if every assertion has to wait
 * for WASM.
 */
const routeDiagramEdges = vi.hoisted(() => vi.fn());
vi.mock('../../layout/routeOnly', () => ({ routeDiagramEdges }));

const terminateLibavoidWorker = vi.hoisted(() => vi.fn());
vi.mock('../../layout/libavoidRouter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../layout/libavoidRouter')>()),
  terminateLibavoidWorker,
}));

function board(connectionCount: number): DesignModel {
  const elements = Array.from({ length: connectionCount + 1 }, (_, i) => ({
    id: `e${i}`,
    kind: 'application' as const,
    name: `e${i}`,
    lifecycle: 'live' as const,
    isManaged: true,
    aspects: {},
    parameters: {},
  }));
  const diagram: DesignDiagram = {
    id: 'd1',
    kind: 'layer7',
    name: 'L7',
    autoRoute: true,
    placements: elements.map((e, i) => ({
      elementId: e.id,
      zone: 'landscape' as const,
      x: i * 40,
      y: i * 30,
    })),
    edgeRoutes: [],
  };
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements,
    connections: Array.from({ length: connectionCount }, (_, i) => ({
      id: `c${i}`,
      sourceId: `e${i}`,
      targetId: `e${i + 1}`,
      isBidirectional: false,
    })),
    diagrams: [diagram],
  };
}

/** Render the hook and keep a live handle on its latest return value. */
function mount(model: DesignModel, enabled = true) {
  const handle: { current: DragRoutePreview } = { current: null as never };
  function Probe({ m }: { m: DesignModel }) {
    handle.current = useDragRoutePreview({ model: m, diagram: m.diagrams[0], enabled });
    return null;
  }
  const view = render(<Probe m={model} />);
  return { handle, rerender: (m: DesignModel) => view.rerender(<Probe m={m} />) };
}

/**
 * The same, but switching which diagram the hook is given — WITHOUT remounting it,
 * which is what `CanvasForDiagram` does: it is rendered with no `key`, so a tab
 * switch re-renders the same hook instance rather than making a new one.
 */
function mountOnDiagram(model: DesignModel, index: number) {
  const handle: { current: DragRoutePreview } = { current: null as never };
  function Probe({ i }: { i: number }) {
    handle.current = useDragRoutePreview({ model, diagram: model.diagrams[i], enabled: true });
    return null;
  }
  const view = render(<Probe i={index} />);
  return { handle, switchTo: (i: number) => view.rerender(<Probe i={i} />) };
}

const move = () => [{ elementId: 'e0', x: 500, y: 500 }];

describe('useDragRoutePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routeDiagramEdges.mockReset();
    terminateLibavoidWorker.mockReset();
    routeDiagramEdges.mockResolvedValue({
      placements: [],
      edgeRoutes: [{ connectionId: 'c0', waypoints: [{ x: 1, y: 2 }], source: 'auto' }],
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('routes the board while a node is moving, and draws the result', async () => {
    const { handle } = mount(board(5));
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(routeDiagramEdges).toHaveBeenCalledTimes(1);
    expect(handle.current.previewRoutes?.get('c0')?.waypoints).toEqual([{ x: 1, y: 2 }]);
  });

  it('makes NO router call at all above the ceiling, and says nothing about it', async () => {
    // Paired with the test above on purpose: an assertion that nothing happened
    // passes just as happily against a feature that was never wired up.
    const { handle } = mount(board(MAX_CONNECTIONS_FOR_DRAG_PREVIEW + 1));
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(routeDiagramEdges).not.toHaveBeenCalled();
    expect(handle.current.previewRoutes).toBeUndefined();
  });

  it('previews right up to the ceiling', async () => {
    const { handle } = mount(board(MAX_CONNECTIONS_FOR_DRAG_PREVIEW));
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(routeDiagramEdges).toHaveBeenCalledTimes(1);
  });

  it('does nothing when live routing is off', async () => {
    const { handle } = mount(board(5), false);
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(routeDiagramEdges).not.toHaveBeenCalled();
  });

  it('routes with the SAME preserved set the drag-end pass uses', async () => {
    const model = board(5);
    model.diagrams[0].edgeRoutes = [
      { connectionId: 'c1', waypoints: [{ x: 9, y: 9 }], source: 'manual' },
      { connectionId: 'c2', waypoints: [{ x: 8, y: 8 }], source: 'auto' },
    ];
    const { handle } = mount(model);
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
    });

    const [, , declined, only, preserved] = routeDiagramEdges.mock.calls[0];
    expect(declined).toBe('keep-stored');
    expect(only).toBeUndefined();
    // Every manual route, and only those. A manual route rerouted mid-drag but
    // preserved on the drop would snap back on release.
    expect([...(preserved as Set<string>)]).toEqual(['c1']);
  });

  it('routes the DROP position one last time, so the preview is not a pass stale', async () => {
    const { handle } = mount(board(5));
    await act(async () => {
      handle.current.onDragPositions([{ elementId: 'e0', x: 100, y: 100 }]);
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      handle.current.endDrag([{ elementId: 'e0', x: 999, y: 888 }]);
      await vi.advanceTimersByTimeAsync(0);
    });

    // Every result on screen is for the position of the pass that produced it, so
    // at the moment of release the preview is one pass behind. Without this final
    // pass the drag-end reroute computes something else, the shape changes when it
    // lands, and the snap is back — measured as a handover that never completes and
    // expires on its timer 1.5 s after the drop instead.
    expect(routeDiagramEdges).toHaveBeenCalledTimes(2);
    const finalDiagram = routeDiagramEdges.mock.calls[1][1] as DesignDiagram;
    expect(finalDiagram.placements.find((p) => p.elementId === 'e0')).toMatchObject({
      x: 999,
      y: 888,
    });
  });

  it('keeps drawing the preview after the drop, until the commit catches up', async () => {
    const model = board(5);
    const { handle, rerender } = mount(model);
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      handle.current.endDrag(move());
      await vi.advanceTimersByTimeAsync(0);
    });
    // Clearing at the drop would draw the PRE-DRAG routes for the 200-400 ms the
    // drag-end pass takes — the snap, one step to the left.
    expect(handle.current.previewRoutes?.get('c0')).toBeDefined();

    // The drag-end pass commits the same geometry, so there is nothing left to show.
    const committed: DesignModel = {
      ...model,
      diagrams: [
        {
          ...model.diagrams[0],
          edgeRoutes: [{ connectionId: 'c0', waypoints: [{ x: 1, y: 2 }], source: 'auto' }],
        },
      ],
    };
    await act(async () => {
      rerender(committed);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(handle.current.previewRoutes).toBeUndefined();
  });

  it('drops the preview when the board changes under it, mid-handover', async () => {
    // The handover deliberately outlives the drop — for up to PREVIEW_HANDOVER_MS —
    // and a tab switch inside that window used to stop the channel and the timer but
    // leave `previewRoutes` set. Nothing remounts the hook (`CanvasForDiagram` has no
    // `key`), and the map is keyed by CONNECTION id, which is design-wide: the
    // waypoints therefore matched connections on the new diagram and were drawn
    // against rects belonging to the board the user had just left.
    const model = board(5);
    model.diagrams.push({
      ...model.diagrams[0],
      id: 'd2',
      name: 'Containers',
      kind: 'container',
      placements: model.diagrams[0].placements.map((p) => ({ ...p, x: p.x + 900 })),
    });
    const { handle, switchTo } = mountOnDiagram(model, 0);

    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
      handle.current.endDrag(move());
    });
    expect(handle.current.previewRoutes?.get('c0')).toBeDefined();

    // The user clicks the other diagram's tab, well inside the handover window.
    await act(async () => {
      switchTo(1);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(handle.current.previewRoutes).toBeUndefined();
  });

  it('gives up the handover rather than showing geometry that was never committed', async () => {
    const { handle } = mount(board(5));
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
      handle.current.endDrag(move());
    });
    expect(handle.current.previewRoutes).toBeDefined();

    // The drag-end pass failed, or never ran. Uncommitted geometry is exactly what
    // the board must not keep showing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(handle.current.previewRoutes).toBeUndefined();
  });

  it('a gesture that commits nothing leaves the board exactly as it was', async () => {
    // An abandoned drag, or an alt-drag duplicate that puts the original back. There
    // is no handover to do: the previewed geometry is for a position nothing is
    // going to commit, and holding it on screen would be a lie rather than a wait.
    const model = board(5);
    const routesBefore = model.diagrams[0].edgeRoutes;
    const { handle } = mount(model);
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(handle.current.previewRoutes).toBeDefined();

    await act(async () => {
      handle.current.endDrag(move(), false);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(handle.current.previewRoutes).toBeUndefined();
    // And nothing was written anywhere: the hook has no way to commit, by design.
    expect(model.diagrams[0].edgeRoutes).toBe(routesBefore);
    expect(model.diagrams[0].placements[0]).toEqual({
      elementId: 'e0',
      zone: 'landscape',
      x: 0,
      y: 0,
    });
  });

  it('downgrades a handover already in progress when the drop turns out to commit nothing', async () => {
    // The two paths that end a drag can arrive in either order.
    const { handle } = mount(board(5));
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
      handle.current.endDrag(move(), true);
    });
    expect(handle.current.previewRoutes).toBeDefined();

    await act(async () => {
      handle.current.endDrag(move(), false);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(handle.current.previewRoutes).toBeUndefined();
  });

  it('replaces a worker that stopped answering, and stops previewing for that drag', async () => {
    routeDiagramEdges.mockReturnValue(new Promise(() => undefined)); // never answers
    const { handle } = mount(board(5));
    await act(async () => {
      handle.current.onDragPositions(move());
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(terminateLibavoidWorker).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(terminateLibavoidWorker).toHaveBeenCalledTimes(1);

    // Not walking back into the same wall for the rest of the gesture.
    await act(async () => {
      handle.current.onDragPositions([{ elementId: 'e0', x: 700, y: 700 }]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(routeDiagramEdges).toHaveBeenCalledTimes(1);
    expect(handle.current.previewRoutes).toBeUndefined();
  });
});
