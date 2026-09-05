// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, SolutionDesignEditorProps } from '../types';
import { selectDomainGroup, useEditorState } from './useEditorState';

/**
 * A selected domain group behaves like a selected node: Delete removes it, the
 * inspector resolves it by name, and a rename carries the selection along.
 * Removing a group is a LAYOUT edit — the box goes, its elements stay.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'm1', kind: 'application', name: 'M1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'other', kind: 'application', name: 'Other', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'm1', zone: 'landscape', domainGroup: 'G', x: 100, y: 100 },
          { elementId: 'other', zone: 'landscape', domainGroup: 'H', x: 500, y: 500 },
        ],
        layoutConfig: {
          domainGroups: [
            { name: 'G', x: 80, y: 80, width: 200, height: 150 },
            { name: 'H', x: 480, y: 480, width: 120, height: 120 },
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
  const groups = () =>
    (result.current.effectiveModel.diagrams[0].layoutConfig?.domainGroups ?? []).map((g) => g.name);
  const placements = () =>
    new Map(result.current.effectiveModel.diagrams[0].placements.map((p) => [p.elementId, p]));
  return { result, onChange, groups, placements };
}

describe('domain-group selection', () => {
  it('exposes the sole selected group to the inspector', () => {
    const { result } = renderEditorState();

    act(() => result.current.setSelection(selectDomainGroup('G')));

    expect(result.current.selectedDomainGroup).toBe('G');
    expect(result.current.selectedElement).toBeUndefined();
    expect(result.current.selectedConnection).toBeUndefined();
  });

  it('offers no single-item inspector when a group is selected alongside an element', () => {
    const { result } = renderEditorState();

    act(() =>
      result.current.setSelection({
        elementIds: ['m1'],
        connectionIds: [],
        domainGroups: ['G'],
      }),
    );

    expect(result.current.selectedDomainGroup).toBeUndefined();
    expect(result.current.selectedElement).toBeUndefined();
  });

  it('deleteSelection removes the group box and frees its members, in one commit', () => {
    const { result, onChange, groups, placements } = renderEditorState();

    act(() => result.current.actions.deleteSelection(selectDomainGroup('G')));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(groups()).toEqual(['H']);
    // The element survives — only its membership went.
    expect(placements().get('m1')).toMatchObject({ x: 100, y: 100 });
    expect(placements().get('m1')?.domainGroup).toBeUndefined();
    // The other group is untouched.
    expect(placements().get('other')).toMatchObject({ domainGroup: 'H' });
    expect(result.current.selection.domainGroups).toEqual([]);
  });

  it('deletes elements and groups together in a single undo step', () => {
    const { result, onChange, groups, placements } = renderEditorState();

    act(() =>
      result.current.actions.deleteSelection({
        elementIds: ['other'],
        connectionIds: [],
        domainGroups: ['G'],
      }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(groups()).toEqual(['H']);
    expect(result.current.effectiveModel.elements.map((e) => e.id)).toEqual(['m1']);

    act(() => result.current.undo());
    expect(groups()).toEqual(['G', 'H']);
    expect(placements().get('m1')).toMatchObject({ domainGroup: 'G' });
  });

  it('removeDomainGroup drops the group from the selection', () => {
    const { result, groups } = renderEditorState();
    act(() => result.current.setSelection(selectDomainGroup('G')));

    act(() => result.current.actions.removeDomainGroup('G'));

    expect(groups()).toEqual(['H']);
    expect(result.current.selection.domainGroups).toEqual([]);
    expect(result.current.selectedDomainGroup).toBeUndefined();
  });

  it('renameDomainGroup carries the selection to the new name', () => {
    const { result } = renderEditorState();
    act(() => result.current.setSelection(selectDomainGroup('G')));

    act(() => result.current.actions.renameDomainGroup('G', 'Core'));

    expect(result.current.selectedDomainGroup).toBe('Core');
  });

  it('a rejected rename (name already taken) leaves the selection alone', () => {
    const { result } = renderEditorState();
    act(() => result.current.setSelection(selectDomainGroup('G')));

    act(() => result.current.actions.renameDomainGroup('G', 'H'));

    expect(result.current.selectedDomainGroup).toBe('G');
  });
});
