// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, SolutionDesignEditorProps } from '../types';
import { useEditorState } from './useEditorState';

/**
 * Piece A: `moveDomainGroup(name, dx, dy)` is a RIGID move — it translates the
 * group's box rect AND every member placement by (dx, dy) in ONE commit (one
 * undo step), preserving membership (no `domainGroup` value changes) and
 * leaving non-members and other groups untouched.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'm1', kind: 'application', name: 'M1', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'm2', kind: 'application', name: 'M2', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'other', kind: 'application', name: 'Other', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'loose', kind: 'application', name: 'Loose', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'm1', zone: 'landscape', domainGroup: 'G', x: 100, y: 100 },
          { elementId: 'm2', zone: 'landscape', domainGroup: 'G', x: 160, y: 140 },
          { elementId: 'other', zone: 'landscape', domainGroup: 'H', x: 500, y: 500 },
          { elementId: 'loose', zone: 'landscape', x: 800, y: 800 },
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
  return { result, onChange };
}

describe('moveDomainGroup (Piece A — rigid group move)', () => {
  it('translates the box and every member by (dx, dy) in one commit, undo restores both', () => {
    const { result, onChange } = renderEditorState();
    const dx = 40;
    const dy = 25;

    act(() => result.current.actions.moveDomainGroup('G', dx, dy));

    // One commit (one undo step).
    expect(onChange).toHaveBeenCalledTimes(1);

    const diagram = () => result.current.effectiveModel.diagrams[0];
    const groups = () => new Map((diagram().layoutConfig?.domainGroups ?? []).map((g) => [g.name, g]));
    const placements = () => new Map(diagram().placements.map((p) => [p.elementId, p]));

    // Box G moved; box H untouched.
    expect(groups().get('G')).toEqual({ name: 'G', x: 120, y: 105, width: 200, height: 150 });
    expect(groups().get('H')).toEqual({ name: 'H', x: 480, y: 480, width: 120, height: 120 });

    // Members m1, m2 translated; membership preserved.
    expect(placements().get('m1')).toMatchObject({ x: 140, y: 125, domainGroup: 'G' });
    expect(placements().get('m2')).toMatchObject({ x: 200, y: 165, domainGroup: 'G' });

    // Non-member of another group and the loose element are untouched.
    expect(placements().get('other')).toMatchObject({ x: 500, y: 500, domainGroup: 'H' });
    expect(placements().get('loose')).toMatchObject({ x: 800, y: 800 });
    expect(placements().get('loose')?.domainGroup).toBeUndefined();

    // A single undo restores BOTH the box and every member.
    act(() => result.current.undo());
    expect(groups().get('G')).toEqual({ name: 'G', x: 80, y: 80, width: 200, height: 150 });
    expect(placements().get('m1')).toMatchObject({ x: 100, y: 100, domainGroup: 'G' });
    expect(placements().get('m2')).toMatchObject({ x: 160, y: 140, domainGroup: 'G' });
  });

  it('is a no-op when the group name is unknown or the delta is zero', () => {
    const { result, onChange } = renderEditorState();

    act(() => result.current.actions.moveDomainGroup('nope', 10, 10));
    act(() => result.current.actions.moveDomainGroup('G', 0, 0));

    expect(onChange).not.toHaveBeenCalled();
  });
});
