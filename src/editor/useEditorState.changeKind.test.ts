// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import type { DesignModel } from '../model/types';
import { DEFAULT_ZONE_SIZES, HOME_ZONE } from '../model/zones';
import { NODE_MAX_SIZE } from '../model/placement';
import { renderEditorState } from './testing/editorHost';

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
  const { result, host } = renderEditorState(initial, { activeDiagramId });
  const element = (id: string) => result.current.model.elements.find((e) => e.id === id);
  const placement = (id: string) =>
    result.current.model.diagrams
      .find((d) => d.id === activeDiagramId)
      ?.placements.find((p) => p.elementId === id);
  const sent = () => host.current.commands;
  return { result, host, sent, element, placement };
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
    expect(result.current.model.connections).toHaveLength(1);
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

  it('is one command — the element and its placement travel together', () => {
    const { result, sent } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(sent()).toHaveLength(1);
    const command = sent()[0];
    expect(command.type).toBe('transaction');
    expect(command.type === 'transaction' && command.commands.map((c) => c.type))
      .toEqual(['element.update', 'placement.set']);
  });

  it('is one undo step', () => {
    const { result, element } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(element('e1')?.kind).toBe('application');
    act(() => result.current.undo());
    expect(element('e1')?.kind).toBe('externalSystem');
  });

  it('refuses — and commits nothing — for an application with a container diagram', () => {
    const { result, sent, element } = render(model());
    act(() => result.current.actions.changeElementKind('e2', 'externalSystem'));
    expect(element('e2')?.kind).toBe('application');
    expect(sent()).toEqual([]);
  });

  it('refuses a component that still belongs to an application', () => {
    const { result, sent, element } = render(model(), 'd2');
    act(() => result.current.actions.changeElementKind('c1', 'actor'));
    expect(element('c1')?.kind).toBe('component');
    expect(sent()).toEqual([]);
  });

  it('refuses a kind this diagram does not hold', () => {
    const { result, sent } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'component'));
    expect(sent()).toEqual([]);
  });

  it('refuses the kind it already is', () => {
    const { result, sent } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'externalSystem'));
    expect(sent()).toEqual([]);
  });
});
