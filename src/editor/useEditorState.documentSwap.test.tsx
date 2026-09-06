// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEditorState } from './useEditorState';
import type { DesignModel, DiagramContentBatch } from '../model/types';
import type { SolutionDesignEditorProps } from './props';

/**
 * `historyResetToken`: the host replaced the DOCUMENT under the same diagram
 * ids (it opened a file, or reverted to the shipped one) without remounting the
 * editor.
 *
 * A remount used to do this by accident. The host in `src/main.tsx` stopped
 * remounting on file open — that costs the viewport, the selection and the panel
 * state for no reason — and the one thing the remount WAS carrying is here: undo
 * steps are diffs against a model that has just been thrown away.
 */

afterEach(() => cleanup());

function model(name: string): DesignModel {
  return {
    name,
    customerName: 'ACME',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
    elements: [],
    connections: [],
  };
}

/**
 * Referentially STABLE models, built once per test. The reconcile effect keys
 * off `props.model` identity, so a fresh object per render would make every
 * render look like a host save — and loop.
 */
type Swap = { model: DesignModel; historyResetToken?: number };

function render(initial: Swap) {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const stable = {
    onChange,
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
  };
  const view = renderHook(
    (swap: Swap) => useEditorState({ ...stable, ...swap } as SolutionDesignEditorProps),
    { initialProps: initial },
  );
  return { ...view, onChange };
}

describe('useEditorState — swapping the document under the editor', () => {
  it('a bumped token clears undo, redo and the selection', () => {
    const first = model('First');
    const second = model('Second');
    const { result, rerender } = render({ model: first, historyResetToken: 1 });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.selection.elementIds).toHaveLength(1);

    rerender({ model: second, historyResetToken: 2 });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.selection.elementIds).toHaveLength(0);
    // The incoming model is the base now — nothing of the old one survives in
    // the effective model.
    expect(result.current.effectiveModel.name).toBe('Second');
    expect(result.current.effectiveModel.elements).toHaveLength(0);
  });

  it('an unbumped token leaves the history alone across an ordinary model swap', () => {
    // The contrast that makes the token meaningful: a host swapping `model` on
    // every autosave must NOT lose the undo stack.
    const first = model('First');
    const saved = model('First (saved)');
    const { result, rerender } = render({ model: first, historyResetToken: 1 });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    rerender({ model: saved, historyResetToken: 1 });

    expect(result.current.canUndo).toBe(true);
  });

  it('costs nothing when the host never passes the token', () => {
    const first = model('First');
    const saved = model('First (saved)');
    const { result, rerender } = render({ model: first });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    rerender({ model: saved });

    expect(result.current.canUndo).toBe(true);
  });
});
