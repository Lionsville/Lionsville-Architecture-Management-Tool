// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { laidOut } from '../model/testFixtures';
import { act } from '@testing-library/react';
import type { DesignModel } from '../model/types';
import { DEFAULT_ZONE_SIZES, HOME_ZONE } from '../model/zones';
import { placedNode, NODE_MAX_SIZE } from '../model/placement';
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
      // An application nobody here owns, in the band that draws it as somebody
      // else's (ADR-0012 §4) — what used to be the `externalSystem` kind.
      { id: 'e1', kind: 'application', outside: true, name: 'Payments', lifecycle: 'live', isManaged: false, aspects: {} },
      { id: 'e2', kind: 'application', name: 'Webshop', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'c1', kind: 'component', name: 'Orders', parentId: 'e2', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [{ type: 'flow', id: 'x1', sourceId: 'e1', targetId: 'e2', isBidirectional: false }],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          // Deliberately oversized for anything but a landscape card, so the
          // re-clamp below has something to do.
          { id: 'e1', zone: 'externalSystems', x: 1450, y: 300, width: 900, height: 900 },
          { id: 'e2', zone: 'landscape', x: 400, y: 300 },
        ],
      }),
      laidOut({
        id: 'd2',
        kind: 'container',
        name: 'Webshop containers',
        applicationElementId: 'e2',
        placements: [{ id: 'c1', x: 0, y: 0 }],
      }),
    ],
  };
}

function render(initial: DesignModel, activeDiagramId = 'd1') {
  const { result, host } = renderEditorState(initial, { activeDiagramId });
  const element = (id: string) => result.current.model.elements.find((e) => e.id === id);
  const placement = (id: string) =>
    (() => {
      const diagram = result.current.model.diagrams.find((d) => d.id === activeDiagramId);
      return diagram && placedNode(diagram, id);
    })();
  const sent = () => host.current.commands;
  return { result, host, sent, element, placement };
}

describe('changeElementKind', () => {
  it('changes the kind and keeps everything else about the element', () => {
    const { result, element } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'actor'));
    expect(element('e1')?.kind).toBe('actor');
    expect(element('e1')?.name).toBe('Payments');
    expect(element('e1')?.isManaged).toBe(false);
  });

  it('keeps the connections — that is the whole point of not redrawing it', () => {
    const { result } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'actor'));
    expect(result.current.model.relations).toHaveLength(1);
  });

  it('moves the placement to the home band of what it would now be drawn as', () => {
    const { result, placement } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'actor'));
    expect(placement('e1')?.zone).toBe(HOME_ZONE.actor);
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
    act(() => result.current.actions.changeElementKind('e1', 'actor'));
    expect(sent()).toHaveLength(1);
    const command = sent()[0];
    expect(command.type).toBe('transaction');
    expect(command.type === 'transaction' && command.commands.map((c) => c.type))
      // Placing something is membership AND geometry (ADR-0012 §6), so the
      // second half is itself a transaction of the two.
      .toEqual(['element.update', 'transaction']);
  });

  it('is one undo step', () => {
    const { result, element } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'actor'));
    expect(element('e1')?.kind).toBe('actor');
    act(() => result.current.undo());
    expect(element('e1')?.kind).toBe('application');
  });

  it('refuses — and commits nothing — for an application with a container diagram', () => {
    const { result, sent, element } = render(model());
    act(() => result.current.actions.changeElementKind('e2', 'actor'));
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
    // And the card in the external-systems band IS an application: what the
    // band says about it is the view's, not the element's (ADR-0012 §4).
    const { result, sent } = render(model());
    act(() => result.current.actions.changeElementKind('e1', 'application'));
    expect(sent()).toEqual([]);
  });
});
