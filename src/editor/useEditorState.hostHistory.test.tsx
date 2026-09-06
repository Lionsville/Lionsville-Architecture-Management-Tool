// @vitest-environment jsdom
/**
 * When the HOST owns undo.
 *
 * This application keeps one stack over everything — a node move, a diagram
 * rename, a decision's status — so the editor's own is not used (ADR-0002). Two
 * things have to hold for that to work, and neither is visible from the outside
 * until it is broken.
 *
 * The editor must stop paying for a stack nothing reads: every commit used to
 * push a full-model merge onto it.
 *
 * And when the host undoes, the model comes back CHANGED, which is exactly what
 * reconciliation reads as "the host echoed my save and I have a newer local
 * value" — so the overlay would win and put the undone edit straight back, then
 * re-emit it. `rebaseToken` is what says "this is not a reply to your batch".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEditorState } from './useEditorState';
import type { DesignModel, DiagramContentBatch } from '../model/types';
import type { SolutionDesignEditorProps } from './props';

afterEach(() => cleanup());

function model(elementName: string): DesignModel {
  return {
    name: 'Landscape',
    customerName: 'ACME',
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ elementId: 'billing', x: 0, y: 0 }] }],
    elements: [{
      id: 'billing', kind: 'application', name: elementName,
      lifecycle: 'live', isManaged: true, aspects: {}, parameters: {},
    }],
    connections: [],
  };
}

type Host = {
  model: DesignModel;
  rebaseToken?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

function render(initial: Host) {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const stable = {
    onChange,
    activeDiagramId: 'd1',
    onActiveDiagramChange: vi.fn(),
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
  };
  const view = renderHook(
    (host: Host) => useEditorState({ ...stable, ...host } as SolutionDesignEditorProps),
    { initialProps: initial },
  );
  return { ...view, onChange };
}

describe('useEditorState — the host owns the stack', () => {
  it('calls the host rather than its own, and takes canUndo from it', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { result } = render({ model: model('Billing'), onUndo, onRedo, canUndo: true, canRedo: false });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('stops pushing a full-model snapshot per commit', () => {
    const { result } = render({ model: model('Billing'), onUndo: vi.fn(), canUndo: false });
    act(() => result.current.actions.addElement({ kind: 'application' }));
    // Its own stack stayed empty; the answer comes from the prop.
    expect(result.current.canUndo).toBe(false);
  });

  it('keeps its own stack when the host offers none', () => {
    const { result } = render({ model: model('Billing') });
    act(() => result.current.actions.addElement({ kind: 'application' }));
    expect(result.current.canUndo).toBe(true);
  });
});

describe('useEditorState — the model moved for a reason of the host’s own', () => {
  it('drops the overlay, so the host’s undo is not undone by the editor', () => {
    const before = model('Billing');
    const after = model('Renamed');
    const { result, rerender } = render({ model: before, rebaseToken: 1, onUndo: vi.fn() });

    act(() => result.current.actions.updateElement('billing', { name: 'Renamed' }));
    expect(result.current.effectiveModel.elements[0].name).toBe('Renamed');

    // The host applied it, then the user undid it: back to the first model.
    rerender({ model: after, rebaseToken: 1, onUndo: vi.fn() });
    rerender({ model: before, rebaseToken: 2, onUndo: vi.fn() });

    expect(result.current.effectiveModel.elements[0].name).toBe('Billing');
  });

  it('does not re-emit the change it just dropped', () => {
    const before = model('Billing');
    const { result, rerender, onChange } = render({ model: before, rebaseToken: 1, onUndo: vi.fn() });

    act(() => result.current.actions.updateElement('billing', { name: 'Renamed' }));
    onChange.mockClear();
    rerender({ model: before, rebaseToken: 2, onUndo: vi.fn() });

    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * Losing what you had selected on every ⌘Z is its own bug, and is what
   * separates this from `historyResetToken` — the document has not changed,
   * one step of it has.
   */
  it('keeps the selection', () => {
    const before = model('Billing');
    const { result, rerender } = render({ model: before, rebaseToken: 1, onUndo: vi.fn() });

    act(() => result.current.setSelection({ elementIds: ['billing'], connectionIds: [], domainGroups: [] }));
    rerender({ model: before, rebaseToken: 2, onUndo: vi.fn() });

    expect(result.current.selection.elementIds).toEqual(['billing']);
  });

  it('reconciles as usual when the token has not moved', () => {
    const before = model('Billing');
    const { result, rerender } = render({ model: before, rebaseToken: 1, onUndo: vi.fn() });

    act(() => result.current.actions.updateElement('billing', { name: 'Renamed' }));
    // A save round-trip: the host echoes back what it stored, token unchanged.
    rerender({ model: model('Renamed'), rebaseToken: 1, onUndo: vi.fn() });

    expect(result.current.effectiveModel.elements[0].name).toBe('Renamed');
  });
});
