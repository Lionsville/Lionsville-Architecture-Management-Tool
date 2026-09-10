// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel } from '../model/types';


/**
 * Piece A: `moveDomainGroup(name, dx, dy)` is a RIGID move — it translates the
 * group's box rect AND every member placement by (dx, dy) in ONE commit (one
 * undo step), preserving membership (no `group` value changes) and
 * leaving non-members and other groups untouched.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    customerName: 'ACME',
    elements: [
      { id: 'm1', kind: 'application', name: 'M1', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'm2', kind: 'application', name: 'M2', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'other', kind: 'application', name: 'Other', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'loose', kind: 'application', name: 'Loose', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [],
    diagrams: [
      {
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        placements: [
          { elementId: 'm1', zone: 'landscape', group: 'G', x: 100, y: 100 },
          { elementId: 'm2', zone: 'landscape', group: 'G', x: 160, y: 140 },
          { elementId: 'other', zone: 'landscape', group: 'H', x: 500, y: 500 },
          { elementId: 'loose', zone: 'landscape', x: 800, y: 800 },
        ],
        layoutConfig: {
          domainGroups: [
            { id: 'G', x: 80, y: 80, width: 200, height: 150 },
            { id: 'H', x: 480, y: 480, width: 120, height: 120 },
          ],
        },
      },
    ],
  };
}

function render() {
  const { result, host } = renderEditorState(model(), { activeDiagramId: 'd1' });
  return { result, host };
}

describe('moveDomainGroup (Piece A — rigid group move)', () => {
  it('translates the box and every member by (dx, dy) in one step, undo restores both', () => {
    const { result, host } = render();
    const dx = 40;
    const dy = 25;

    act(() => result.current.actions.moveDomainGroup('G', dx, dy));

    // One command (one undo step).
    expect(host.current.commands).toHaveLength(1);

    const diagram = () => result.current.model.diagrams[0];
    const groups = () => new Map((diagram().layoutConfig?.domainGroups ?? []).map((g) => [g.id, g]));
    const placements = () => new Map(diagram().placements.map((p) => [p.elementId, p]));

    // Box G moved; box H untouched.
    expect(groups().get('G')).toEqual({ id: 'G', x: 120, y: 105, width: 200, height: 150 });
    expect(groups().get('H')).toEqual({ id: 'H', x: 480, y: 480, width: 120, height: 120 });

    // Members m1, m2 translated; membership preserved.
    expect(placements().get('m1')).toMatchObject({ x: 140, y: 125, group: 'G' });
    expect(placements().get('m2')).toMatchObject({ x: 200, y: 165, group: 'G' });

    // Non-member of another group and the loose element are untouched.
    expect(placements().get('other')).toMatchObject({ x: 500, y: 500, group: 'H' });
    expect(placements().get('loose')).toMatchObject({ x: 800, y: 800 });
    expect(placements().get('loose')?.group).toBeUndefined();

    // A single undo restores BOTH the box and every member.
    act(() => result.current.undo());
    expect(groups().get('G')).toEqual({ id: 'G', x: 80, y: 80, width: 200, height: 150 });
    expect(placements().get('m1')).toMatchObject({ x: 100, y: 100, group: 'G' });
    expect(placements().get('m2')).toMatchObject({ x: 160, y: 140, group: 'G' });
  });

  it('is a no-op when the group name is unknown or the delta is zero', () => {
    const { result, host } = render();

    act(() => result.current.actions.moveDomainGroup('nope', 10, 10));
    act(() => result.current.actions.moveDomainGroup('G', 0, 0));

    expect(host.current.commands).toEqual([]);
  });
});
