// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEditorState } from './useEditorState';
import type { DesignModel, DiagramContentBatch, DiagramPlacement, SolutionDesignEditorProps } from '../model/types';

/**
 * U7 in-memory undo/redo. History is whole-overlay snapshots keyed off the
 * `commit` choke-point; undo/redo re-emit the corrective batch through the same
 * `emitBatch`. These tests exercise the hook directly (renderHook) with the
 * `onChange`/model props mocked. Props are kept referentially stable across
 * renders so the reconcile effect only runs when we deliberately swap the model.
 */

afterEach(() => cleanup());

function model(elements: DesignModel['elements'] = [], placements: DiagramPlacement[] = []): DesignModel {
  return {
    name: 'Design',
    customerName: 'ACME',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements }],
    elements,
    connections: [],
  };
}

function makeProps(m: DesignModel, onChange: (b: DiagramContentBatch) => void, extra: Partial<SolutionDesignEditorProps> = {}): SolutionDesignEditorProps {
  return {
    model: m,
    activeDiagramId: 'd1',
    onChange,
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
    ...extra,
  };
}

const lastBatch = (onChange: ReturnType<typeof vi.fn>): DiagramContentBatch | undefined =>
  onChange.mock.calls.at(-1)?.[0];

/**
 * Render the hook with a REFERENTIALLY STABLE props object — the host keeps the
 * `model` ref stable between saves, so the reconcile effect only fires on a real
 * model swap. (Rebuilding props inline each render would make the effect think
 * the host handed back a fresh model on every render and loop.)
 */
function render(extra: Partial<SolutionDesignEditorProps> = {}, onChange = vi.fn()) {
  const props = makeProps(model(), onChange, extra);
  return { ...renderHook(() => useEditorState(props)), onChange };
}

describe('useEditorState — undo/redo history (U7)', () => {
  it('starts with an empty stack (canUndo/canRedo false)', () => {
    const { result } = render();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('a user commit pushes one snapshot; undo then redo walk it and re-emit', () => {
    const { result, onChange } = render();

    act(() => result.current.actions.addElement({ kind: 'application' }));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    const addedId = lastBatch(onChange)!.elements[0].id;

    onChange.mockClear();
    act(() => result.current.undo());
    // In-session undo of an add reverts to the empty overlay: the element drops
    // out of the batch entirely (no create, no placement) — the save converges.
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    const undone = lastBatch(onChange)!;
    expect(undone.elements.map((e) => e.id)).not.toContain(addedId);
    expect(undone.placements.map((p) => p.elementId)).not.toContain(addedId);

    onChange.mockClear();
    act(() => result.current.redo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(lastBatch(onChange)!.elements.map((e) => e.id)).toContain(addedId);
  });

  it('a fresh commit clears the redo tail', () => {
    const { result } = render();
    act(() => result.current.actions.addElement({ kind: 'application' }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    // A new edit invalidates the redo future.
    act(() => result.current.actions.addElement({ kind: 'actor' }));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('a no-op commit (mutation that changes nothing) pushes no snapshot', () => {
    const { result, onChange } = render();
    // updateElement on an id that does not exist bails before commit.
    act(() => result.current.actions.updateElement('nope', { name: 'X' }));
    expect(result.current.canUndo).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('caps history at 50 — the oldest snapshot is dropped', () => {
    const { result } = render();
    for (let i = 0; i < 55; i += 1) {
      act(() => result.current.actions.addElement({ kind: 'application' }));
    }
    let undos = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      undos += 1;
      if (undos > 60) break; // guard against a runaway loop
    }
    expect(undos).toBe(50);
  });

  it('is inert under readOnly (no history, no emit)', () => {
    const { result, onChange } = render({ readOnly: true });
    act(() => result.current.actions.addElement({ kind: 'application' }));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('useEditorState — undo across a completed save (U7 B-effective-state crux)', () => {
  /**
   * These are the cases the raw-overlay approach got wrong: once a save
   * round-trips and the host swaps `props.model`, the base absorbs the change.
   * Effective-state snapshots + diffToOverlay must still produce a correct
   * corrective batch against the moved base.
   */

  it('add → completed save → undo emits a REAL-id delete, no stale tempId, element gone', () => {
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    const { result, rerender } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(model(), onChange),
    });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    const addBatch = lastBatch(onChange)!;
    const tempId = addBatch.elements[0].id;
    const addPlacement = addBatch.placements.find((p) => p.elementId === tempId)!;

    // Host saves and hands back the element under a real id + the alias map.
    const realId = 'srv-1';
    const savedModel = model(
      [{ ...addBatch.elements[0], id: realId }],
      [{ elementId: realId, x: addPlacement.x, y: addPlacement.y, zone: addPlacement.zone }],
    );
    act(() =>
      rerender(
        makeProps(savedModel, onChange, {
          idAliases: { elements: new Map([[tempId, realId]]), connections: new Map() },
        }),
      ),
    );

    onChange.mockClear();
    act(() => result.current.undo());
    const undo = lastBatch(onChange)!;
    expect(undo.deletedElementIds).toContain(realId); // deletes the REAL id
    expect(undo.elements.map((e) => e.id)).not.toContain(tempId); // no phantom create
    expect(undo.elements.map((e) => e.id)).not.toContain(realId);
    // The element is gone from the effective model.
    expect(result.current.effectiveModel.elements.map((e) => e.id)).not.toContain(realId);
  });

  it('delete → completed save → undo re-upserts the element AND its connection', () => {
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    // Two elements + a connection, all placed, already on the server.
    const start = model(
      [
        { id: 'a', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
        { id: 'b', kind: 'application', name: 'B', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      ],
      [
        { elementId: 'a', x: 1, y: 1, zone: 'landscape' },
        { elementId: 'b', x: 2, y: 2, zone: 'landscape' },
      ],
    );
    start.connections = [{ id: 'c', sourceId: 'a', targetId: 'b', isBidirectional: false }];
    const { result, rerender } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(start, onChange),
    });

    act(() => result.current.actions.deleteFromModel('a'));

    // Host saves the deletion: the refreshed model no longer has `a` or `c`.
    const savedModel = model(
      [start.elements[1]],
      [{ elementId: 'b', x: 2, y: 2, zone: 'landscape' }],
    );
    act(() => rerender(makeProps(savedModel, onChange)));
    expect(result.current.effectiveModel.elements.map((e) => e.id)).not.toContain('a');

    onChange.mockClear();
    act(() => result.current.undo());
    // `a` and its connection `c` come back with full value.
    expect(result.current.effectiveModel.elements.map((e) => e.id)).toContain('a');
    expect(result.current.effectiveModel.connections.map((c) => c.id)).toContain('c');
    const undo = lastBatch(onChange)!;
    expect(undo.elements.map((e) => e.id)).toContain('a');
    expect(undo.connections.map((c) => c.id)).toContain('c');
  });

  it('move-as-first-touch → completed save → undo restores the prior position (never a silent no-op)', () => {
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    const start = model(
      [{ id: 'a', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} }],
      [{ elementId: 'a', x: 10, y: 10, zone: 'landscape' }],
    );
    const { result, rerender } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(start, onChange),
    });

    act(() => result.current.actions.movePlacements([{ elementId: 'a', x: 200, y: 200, zone: 'landscape' }]));

    // Host saves the move: base now has `a` at (200,200).
    const savedModel = model(
      [start.elements[0]],
      [{ elementId: 'a', x: 200, y: 200, zone: 'landscape' }],
    );
    act(() => rerender(makeProps(savedModel, onChange)));

    onChange.mockClear();
    act(() => result.current.undo());
    // Undo restores (10,10) — the prior position — rather than doing nothing.
    const placement = result.current.effectiveModel.diagrams[0].placements.find((p) => p.elementId === 'a')!;
    expect(placement.x).toBe(10);
    expect(placement.y).toBe(10);
    expect(lastBatch(onChange)!.placements.find((p) => p.elementId === 'a')?.x).toBe(10);
  });

  it('undo to empty reverts the whole session; redo re-applies', () => {
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    const { result } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(model(), onChange),
    });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    act(() => result.current.actions.addElement({ kind: 'actor' }));
    expect(result.current.effectiveModel.elements).toHaveLength(2);

    act(() => result.current.undo());
    act(() => result.current.undo());
    expect(result.current.effectiveModel.elements).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    expect(result.current.effectiveModel.elements).toHaveLength(1);
    act(() => result.current.redo());
    expect(result.current.effectiveModel.elements).toHaveLength(2);
    expect(result.current.canRedo).toBe(false);
  });
});

describe('useEditorState — stale-tempId data-loss guard (adversarial review)', () => {
  /**
   * The blocker: a tempId that survives ONLY in a parked past/future snapshot
   * (its create was undone while the save was in flight) is not "live" in the
   * overlay, so `reconcileOverlay` produces no alias for it. The stack MUST be
   * remapped from the durable `props.idAliases` regardless — otherwise the
   * stale tempId makes `diffToOverlay` treat the reconciled real row as absent
   * and synthesise a delete of a persisted row. These fail without that fix.
   */

  it('element: create → undo before reconcile → reconcile → redo never deletes the real id nor re-creates the tempId', () => {
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    const { result, rerender } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(model(), onChange),
    });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    const addBatch = lastBatch(onChange)!;
    const tempId = addBatch.elements[0].id;
    const addPlacement = addBatch.placements.find((p) => p.elementId === tempId)!;

    // Undo BEFORE the save round-trips: the live overlay empties, so the tempId
    // now survives ONLY in the parked future snapshot.
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    // The in-flight save persisted it as real id "42"; the host returns the
    // refreshed model + the durable tmp→real alias.
    const savedModel = model(
      [{ ...addBatch.elements[0], id: '42' }],
      [{ elementId: '42', x: addPlacement.x, y: addPlacement.y, zone: addPlacement.zone }],
    );
    act(() =>
      rerender(
        makeProps(savedModel, onChange, {
          idAliases: { elements: new Map([[tempId, '42']]), connections: new Map() },
        }),
      ),
    );

    onChange.mockClear();
    act(() => result.current.redo());
    const batch = lastBatch(onChange)!;
    expect(batch.deletedElementIds).not.toContain('42'); // no data-loss delete
    expect(batch.elements.map((e) => e.id)).not.toContain(tempId); // no phantom create
    // Redo restores the element under the REAL id, proving the snapshot remapped.
    expect(result.current.effectiveModel.elements.map((e) => e.id)).toContain('42');
    expect(result.current.effectiveModel.elements.map((e) => e.id)).not.toContain(tempId);
  });

  it('element: the alias arriving AFTER the model swap still remaps the parked snapshot', () => {
    // The real host ordering: `onSuccess` pushes the saved content into the
    // query cache while `mutateAsync` is still awaited, so the model swap can
    // reach the editor a commit BEFORE the tmp→real map does. Reconciling only
    // on the model swap left the tempId stale in the parked snapshot forever —
    // the redo below then deleted the persisted row.
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    const { result, rerender } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(model(), onChange),
    });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    const addBatch = lastBatch(onChange)!;
    const tempId = addBatch.elements[0].id;
    const addPlacement = addBatch.placements.find((p) => p.elementId === tempId)!;

    // Undo while the save is in flight: the tempId now lives only in the parked
    // future snapshot.
    act(() => result.current.undo());

    // Commit 1 — the refreshed model lands with NO alias map yet.
    const savedModel = model(
      [{ ...addBatch.elements[0], id: '42' }],
      [{ elementId: '42', x: addPlacement.x, y: addPlacement.y, zone: addPlacement.zone }],
    );
    act(() => rerender(makeProps(savedModel, onChange)));

    // Commit 2 — the host resolves its save and publishes the alias as a NEW
    // object (same model instance, so only the alias identity changed).
    act(() =>
      rerender(
        makeProps(savedModel, onChange, {
          idAliases: { elements: new Map([[tempId, '42']]), connections: new Map() },
        }),
      ),
    );

    onChange.mockClear();
    act(() => result.current.redo());
    const batch = lastBatch(onChange)!;
    expect(batch.deletedElementIds).not.toContain('42'); // no data-loss delete
    expect(batch.elements.map((e) => e.id)).not.toContain(tempId); // no phantom create
    expect(result.current.effectiveModel.elements.map((e) => e.id)).toContain('42');
    expect(result.current.effectiveModel.elements.map((e) => e.id)).not.toContain(tempId);
  });

  it('connection: connect → undo before reconcile → reconcile → redo never deletes the real connection nor re-creates the temp id', () => {
    const onChange = vi.fn<(b: DiagramContentBatch) => void>();
    const start = model(
      [
        { id: 'a', kind: 'application', name: 'A', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
        { id: 'b', kind: 'application', name: 'B', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      ],
      [
        { elementId: 'a', x: 1, y: 1, zone: 'landscape' },
        { elementId: 'b', x: 2, y: 2, zone: 'landscape' },
      ],
    );
    const { result, rerender } = renderHook((p: SolutionDesignEditorProps) => useEditorState(p), {
      initialProps: makeProps(start, onChange),
    });

    act(() => result.current.actions.connect('a', 'b'));
    const tempConnId = lastBatch(onChange)!.connections[0].id;

    act(() => result.current.undo());

    // Save persisted the connection as real id "99".
    const savedModel = model(start.elements, start.diagrams[0].placements);
    savedModel.connections = [{ id: '99', sourceId: 'a', targetId: 'b', isBidirectional: false }];
    act(() =>
      rerender(
        makeProps(savedModel, onChange, {
          idAliases: { elements: new Map(), connections: new Map([[tempConnId, '99']]) },
        }),
      ),
    );

    onChange.mockClear();
    act(() => result.current.redo());
    const batch = lastBatch(onChange)!;
    expect(batch.deletedConnectionIds).not.toContain('99');
    expect(batch.connections.map((c) => c.id)).not.toContain(tempConnId);
    expect(result.current.effectiveModel.connections.map((c) => c.id)).toContain('99');
  });
});
