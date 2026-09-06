// @vitest-environment jsdom
/**
 * The host owns undo, and owns the document.
 *
 * This application keeps one stack over everything — a node move, a diagram
 * rename, a decision's status — and the editor is a view onto the model the
 * host holds (ADR-0002). Three things follow, and none of them is visible from
 * outside until one is broken: the editor keeps no stack, it keeps no second
 * copy of the document, and one gesture is one command.
 *
 * The stack itself is the session's, and `app/useModelSession.test.tsx` is
 * where it is pinned. What is here is only the editor's half of the bargain.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEditorState } from './useEditorState';
import { renderEditorState, useEditorHost, hostedProps } from './testing/editorHost';
import type { DesignModel } from '../model/types';
import type { SolutionDesignEditorProps } from './props';

afterEach(() => cleanup());

function model(elementName = 'Billing'): DesignModel {
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

describe('useEditorState — the host owns the stack', () => {
  it('calls the host rather than a stack of its own, and takes canUndo from it', () => {
    const history = { undo: vi.fn(), redo: vi.fn(), canUndo: true, canRedo: false };
    const props: SolutionDesignEditorProps = {
      model: model(),
      history,
      dispatch: () => undefined,
      activeDiagramId: 'd1',
      onActiveDiagramChange: vi.fn(),
      onCreateContainerDiagram: vi.fn(),
      onCreateLayer7Diagram: vi.fn(),
    };
    const { result } = renderHook(() => useEditorState(props));

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(history.undo).toHaveBeenCalledOnce();
    expect(history.redo).toHaveBeenCalledOnce();
  });

  it('sends one command per gesture, however many rows it touches', () => {
    const { result, host } = renderEditorState(model());

    act(() => result.current.actions.addElement({ kind: 'application' }));

    expect(host.current.commands).toHaveLength(1);
    // An element and its placement, in one step: undo takes back the whole card.
    const step = host.current.commands[0];
    expect(step.type === 'transaction' && step.commands.map((c) => c.type))
      .toEqual(['element.create', 'placement.set']);
  });

  it('sends nothing at all under readOnly', () => {
    const { result, host } = renderEditorState(model(), { readOnly: true });

    act(() => result.current.actions.addElement({ kind: 'application' }));
    act(() => result.current.actions.updateElement('billing', { name: 'Renamed' }));
    act(() => result.current.actions.movePlacements([{ elementId: 'billing', x: 9, y: 9 }]));

    expect(host.current.commands).toEqual([]);
    expect(result.current.model.elements[0].name).toBe('Billing');
  });
});

describe('useEditorState — the model moved for a reason of the host’s own', () => {
  it('draws what arrived: there is no local copy left to put the change back', () => {
    const { result, host } = renderEditorState(model());

    act(() => result.current.actions.updateElement('billing', { name: 'Renamed' }));
    expect(result.current.model.elements[0].name).toBe('Renamed');

    // The host undoes it. With two brains this was the hazard — reconciliation
    // read a changed model as "your save came back" and let the local value win.
    act(() => host.current.history.undo());

    expect(result.current.model.elements[0].name).toBe('Billing');
    // And nothing was sent in response: the editor had nothing to re-assert.
    expect(host.current.commands).toHaveLength(1);
  });

  it('keeps the selection across an undo — the document did not change, one step did', () => {
    const { result, host } = renderEditorState(model());

    act(() => result.current.actions.updateElement('billing', { name: 'Renamed' }));
    act(() => result.current.setSelection({ elementIds: ['billing'], connectionIds: [], domainGroups: [] }));
    act(() => host.current.history.undo());

    expect(result.current.selection.elementIds).toEqual(['billing']);
  });

  it('prunes a selection the undo took away', () => {
    const { result, host } = renderEditorState(model());

    act(() => result.current.actions.addElement({ kind: 'application' }));
    const drawn = result.current.selection.elementIds[0];
    expect(drawn).toBeDefined();

    act(() => host.current.history.undo());

    expect(result.current.model.elements.map((e) => e.id)).toEqual(['billing']);
    expect(result.current.selection.elementIds).toEqual([]);
  });
});

describe('useEditorState — the host swaps the document', () => {
  it('takes the incoming document as it stands, and prunes what it named', () => {
    const first = model('First');
    const second: DesignModel = {
      ...model('Second'),
      elements: [],
      diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
    };
    const view = renderHook(
      (document: DesignModel) => {
        const host = useEditorHost(document);
        return useEditorState(hostedProps(host));
      },
      { initialProps: first },
    );

    act(() => view.result.current.setSelection({
      elementIds: ['billing'], connectionIds: [], domainGroups: [],
    }));
    view.rerender(second);

    expect(view.result.current.model.elements).toHaveLength(0);
    expect(view.result.current.selection.elementIds).toEqual([]);
  });
});
