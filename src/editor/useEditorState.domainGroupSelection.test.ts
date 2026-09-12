// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { placedNodes } from '../model/placement';
import { laidOut } from '../model/testFixtures';
import { act } from '@testing-library/react';
import { renderEditorState } from './testing/editorHost';
import type { DesignModel } from '../model/types';
import { selectDomainGroup } from './useEditorState';

/**
 * A selected domain group behaves like a selected node: Delete removes it, the
 * inspector resolves it by name, and a rename carries the selection along.
 * Removing a group is a LAYOUT edit — the box goes, its elements stay.
 */
function model(): DesignModel {
  return {
    name: 'ACME',
    elements: [
      { id: 'm1', kind: 'application', name: 'M1', lifecycle: 'live', isManaged: true, aspects: {} },
      { id: 'other', kind: 'application', name: 'Other', lifecycle: 'live', isManaged: true, aspects: {} },
    ],
    relations: [],
    diagrams: [
      laidOut({
        id: 'd1',
        kind: 'layer7',
        name: 'L7',
        groups: [{ id: 'G', name: 'G' }, { id: 'H', name: 'H' }],
        placements: [
          { id: 'm1', zone: 'landscape', group: 'G', x: 100, y: 100 },
          { id: 'other', zone: 'landscape', group: 'H', x: 500, y: 500 },
        ],
        layoutConfig: {
          domainGroups: [
            { id: 'G', x: 80, y: 80, width: 200, height: 150 },
            { id: 'H', x: 480, y: 480, width: 120, height: 120 },
          ],
        },
      }),
    ],
  };
}

const nameOf = (
  result: { current: { model: { diagrams: { groups?: { id: string; name: string }[] }[] } } },
  id: string,
) => (result.current.model.diagrams[0].groups ?? []).find((g) => g.id === id)?.name;

function render() {
  const { result, host } = renderEditorState(model(), { activeDiagramId: 'd1' });
  const groups = () =>
    (result.current.model.diagrams[0].geometry?.groups ?? []).map((g) => g.id);
  const placements = () =>
    new Map(placedNodes(result.current.model.diagrams[0]).map((p) => [p.id, p]));
  return { result, host, groups, placements };
}

describe('domain-group selection', () => {
  it('exposes the sole selected group to the inspector', () => {
    const { result } = render();

    act(() => result.current.setSelection(selectDomainGroup('G')));

    expect(result.current.selectedDomainGroup).toBe('G');
    expect(result.current.selectedElement).toBeUndefined();
    expect(result.current.selectedConnection).toBeUndefined();
  });

  it('offers no single-item inspector when a group is selected alongside an element', () => {
    const { result } = render();

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

  it('deleteSelection removes the group box and frees its members, in one step', () => {
    const { result, host, groups, placements } = render();

    act(() => result.current.actions.deleteSelection(selectDomainGroup('G')));

    expect(host.current.commands).toHaveLength(1);
    expect(groups()).toEqual(['H']);
    // The element survives — only its membership went.
    expect(placements().get('m1')).toMatchObject({ x: 100, y: 100 });
    expect(placements().get('m1')?.group).toBeUndefined();
    // The other group is untouched.
    expect(placements().get('other')).toMatchObject({ group: 'H' });
    expect(result.current.selection.domainGroups).toEqual([]);
  });

  it('deletes elements and groups together in a single undo step', () => {
    const { result, host, groups, placements } = render();

    act(() =>
      result.current.actions.deleteSelection({
        elementIds: ['other'],
        connectionIds: [],
        domainGroups: ['G'],
      }),
    );

    expect(host.current.commands).toHaveLength(1);
    expect(groups()).toEqual(['H']);
    expect(result.current.model.elements.map((e) => e.id)).toEqual(['m1']);

    act(() => result.current.undo());
    expect(groups()).toEqual(['G', 'H']);
    expect(placements().get('m1')).toMatchObject({ group: 'G' });
  });

  it('removeDomainGroup drops the group from the selection', () => {
    const { result, groups } = render();
    act(() => result.current.setSelection(selectDomainGroup('G')));

    act(() => result.current.actions.removeDomainGroup('G'));

    expect(groups()).toEqual(['H']);
    expect(result.current.selection.domainGroups).toEqual([]);
    expect(result.current.selectedDomainGroup).toBeUndefined();
  });

  /**
   * A selection used to be a list of NAMES, so a rename had to carry it — and
   * so did every member placement. A group has an id now (ADR-0012 §6), so the
   * rename touches one line and nothing has to follow it.
   */
  it('renameDomainGroup leaves the selection and every member alone', () => {
    const { result, placements } = render();
    act(() => result.current.setSelection(selectDomainGroup('G')));
    const before = placements().get('m1');

    act(() => result.current.actions.renameDomainGroup('G', 'Core'));

    expect(result.current.selectedDomainGroup).toBe('G');
    expect(nameOf(result, 'G')).toBe('Core');
    expect(placements().get('m1')).toBe(before);
  });

  it('a rejected rename (name already taken) changes nothing', () => {
    const { result } = render();
    act(() => result.current.setSelection(selectDomainGroup('G')));

    act(() => result.current.actions.renameDomainGroup('G', 'H'));

    expect(result.current.selectedDomainGroup).toBe('G');
    expect(nameOf(result, 'G')).toBe('G');
  });

  /**
   * The two free-text group fields (the element inspector's and the bulk one)
   * are what a person types: a NAME. The action is what turns one into a group.
   */
  describe('fileUnderGroupNamed', () => {
    it('files cards under a group the board already has', () => {
      const { result, placements } = render();
      act(() => result.current.actions.fileUnderGroupNamed(['other'], 'G'));
      expect(placements().get('other')).toMatchObject({ group: 'G' });
    });

    it('makes the group when nobody has used that name, with an id of its own', () => {
      const { result, placements } = render();
      act(() => result.current.actions.fileUnderGroupNamed(['m1'], 'New domain'));
      expect(result.current.model.diagrams[0].groups).toContainEqual({
        id: 'new-domain', name: 'New domain',
      });
      expect(placements().get('m1')).toMatchObject({ group: 'new-domain' });
    });

    it('is one undo step, the group and its members together', () => {
      const { result, host, placements } = render();
      const before = host.current.commands.length;
      act(() => result.current.actions.fileUnderGroupNamed(['m1'], 'New domain'));
      expect(host.current.commands).toHaveLength(before + 1);
      act(() => host.current.history.undo());
      expect((result.current.model.diagrams[0].groups ?? []).map((g) => g.id)).toEqual(['G', 'H']);
      expect(placements().get('m1')).toMatchObject({ group: 'G' });
    });

    it('clears the membership for a blank name', () => {
      const { result, placements } = render();
      act(() => result.current.actions.fileUnderGroupNamed(['m1'], '  '));
      expect(placements().get('m1')?.group).toBeUndefined();
    });
  });
});
