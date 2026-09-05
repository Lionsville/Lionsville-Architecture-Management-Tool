// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DesignModel, DiagramContentBatch, SolutionDesignEditorProps } from '../types';
import { DEFAULT_ZONE_SIZES, HOME_ZONE } from '../model/zones';
import { NODE_MAX_SIZE } from '../model/placement';
import { useEditorState } from './useEditorState';

/**
 * `changeElementKind` at the action: one commit, one undo step, and a placement
 * that follows the new kind. The rules themselves are pinned in
 * `model/kindChange.test.ts`; this is about what actually lands.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'e1', kind: 'externalSystem', name: 'Payments', lifecycle: 'live', isManaged: false, aspects: {}, parameters: {} },
      { id: 'e2', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
      { id: 'c1', kind: 'component', name: 'Orders', parentApplicationId: 'e2', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} },
    ],
    connections: [{ id: 'x1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          // Deliberately oversized for anything but a landscape card, so the
          // re-clamp below has something to do.
          { elementId: 'e1', zone: 'externalSystems', x: 1450, y: 300, width: 900, height: 900 },
          { elementId: 'e2', zone: 'landscape', x: 400, y: 300 },
        ],
      },
      {
        id: 'd2',
        kind: 'container',
        name: 'Webshop containers',
        applicationElementId: 'e2',
        placements: [{ elementId: 'c1', x: 0, y: 0 }],
      },
    ],
  };
}

function render(initial: DesignModel, activeDiagramId = 'd1') {
  const onChange = vi.fn<(batch: DiagramContentBatch) => void>();
  const props: SolutionDesignEditorProps = {
    model: initial,
    activeDiagramId,
    onActiveDiagramChange: vi.fn(),
    onChange,
    onCreateContainerDiagram: vi.fn(),
    onCreateLayer7Diagram: vi.fn(),
    parameterSpecs: () => [],
  };
  const { result } = renderHook(() => useEditorState(props));
  const element = (id: string) => result.current.effectiveModel.elements.find((e) => e.id === id);
  const placement = (id: string) =>
    result.current.effectiveModel.diagrams
      .find((d) => d.id === activeDiagramId)
      ?.placements.find((p) => p.elementId === id);
  return { result, onChange, element, placement };
}

describe('changeElementKind', () => {
  it('changes the kind and keeps everything else about the element', () => {
    const { result, element } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(element('e1')?.kind).toBe('application');
    expect(element('e1')?.name).toBe('Payments');
    expect(element('e1')?.isManaged).toBe(false);
  });

  it('keeps the connections — that is the whole point of not redrawing it', () => {
    const { result } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(result.current.effectiveModel.connections).toHaveLength(1);
  });

  it('moves the placement to the new kind‘s home band', () => {
    const { result, placement } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(placement('e1')?.zone).toBe(HOME_ZONE.application);
  });

  it('re-clamps a stored size the new kind cannot have, in its new band', () => {
    const { result, placement } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'actor'));
    const after = placement('e1');
    // The actors band is 150 deep, so that is the ceiling on the axis crossing
    // it; the axis running along the band keeps the card ceiling.
    expect(after?.height).toBe(DEFAULT_ZONE_SIZES.actors);
    expect(after?.width).toBe(NODE_MAX_SIZE.width);
    // And it is inside the band it moved to.
    expect(after?.y).toBe(0);
  });

  it('is one commit — the element and its placement land in the same batch', () => {
    const { result, onChange } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    const batch = onChange.mock.calls.at(-1)?.[0];
    expect(batch?.elements.some((e) => e.id === 'e1' && e.kind === 'application')).toBe(true);
    expect(batch?.placements.some((p) => p.elementId === 'e1')).toBe(true);
  });

  it('is one undo step', () => {
    const { result, element } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(element('e1')?.kind).toBe('application');
    act(() => result.current.undo());
    expect(element('e1')?.kind).toBe('externalSystem');
  });

  it('refuses — and commits nothing — for an application with a container diagram', () => {
    const { result, onChange, element } = render(model());
    act(() => result.current.actions.changeElementKind('e2', 'externalSystem'));
    expect(element('e2')?.kind).toBe('application');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a component that still belongs to an application', () => {
    const { result, onChange, element } = render(model(), 'd2');
    act(() => result.current.actions.changeElementKind('c1', 'actor'));
    expect(element('c1')?.kind).toBe('component');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses a kind this diagram does not hold', () => {
    const { result, onChange } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'component'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses the kind it already is', () => {
    const { result, onChange } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'externalSystem'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
