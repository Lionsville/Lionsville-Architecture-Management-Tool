// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { enterIsTheItems, keyboardIntent } from './keyboardIntent';
import type { Selection } from '../useEditorState';

/** A target that answers `closest` for one selector, the way a card, a line or a group's name does. */
function on(selector: '.react-flow__node' | '.react-flow__edge' | '[data-group]', id: string): EventTarget {
  const attribute = selector === '[data-group]' ? 'data-group' : 'data-id';
  return {
    closest: (asked: string) => (asked === selector ? { getAttribute: (name: string) => (name === attribute ? id : null) } : null),
  } as unknown as EventTarget;
}

const NOTHING: Selection = { elementIds: [], connectionIds: [], domainGroups: [] };

describe('keyboardIntent', () => {
  it('selects the focused card on Enter and on Space, and nothing else is a key of its own', () => {
    const one = { kind: 'select', selection: { elementIds: ['a1'], connectionIds: [], domainGroups: [] } };
    expect(keyboardIntent('Enter', false, on('.react-flow__node', 'a1'), NOTHING, null)).toEqual(one);
    expect(keyboardIntent(' ', false, on('.react-flow__node', 'a1'), NOTHING, null)).toEqual(one);
    expect(keyboardIntent('a', false, on('.react-flow__node', 'a1'), NOTHING, null)).toBeUndefined();
    expect(keyboardIntent('Enter', false, { closest: () => null } as unknown as EventTarget, NOTHING, null)).toBeUndefined();
  });

  it('adds a card to the selection with Shift, and takes it out again', () => {
    const held: Selection = { elementIds: ['a1'], connectionIds: [], domainGroups: [] };
    expect(keyboardIntent('Enter', true, on('.react-flow__node', 'a2'), held, null))
      .toEqual({ kind: 'select', selection: { elementIds: ['a1', 'a2'], connectionIds: [], domainGroups: [] } });
    expect(keyboardIntent('Enter', true, on('.react-flow__node', 'a1'), held, null))
      .toEqual({ kind: 'select', selection: NOTHING });
  });

  it('selects a focused line, and a group from its name', () => {
    expect(keyboardIntent('Enter', false, on('.react-flow__edge', 'c1'), NOTHING, null))
      .toEqual({ kind: 'select', selection: { elementIds: [], connectionIds: ['c1'], domainGroups: [] } });
    expect(keyboardIntent('Enter', false, on('[data-group]', 'core'), NOTHING, null))
      .toEqual({ kind: 'select', selection: { elementIds: [], connectionIds: [], domainGroups: ['core'] } });
  });

  it('ends a line being drawn on the focused card, and on nothing else', () => {
    expect(keyboardIntent('Enter', false, on('.react-flow__node', 'a2'), NOTHING, 'a1'))
      .toEqual({ kind: 'connect', targetId: 'a2' });
    expect(keyboardIntent('Enter', false, on('.react-flow__edge', 'c1'), NOTHING, 'a1')).toBeUndefined();
  });
});

describe('enterIsTheItems', () => {
  it('leaves Enter to open the page only on the card already selected, or off the board’s items', () => {
    expect(enterIsTheItems(on('.react-flow__node', 'a1'), 'a1')).toBe(false);
    expect(enterIsTheItems(on('.react-flow__node', 'a2'), 'a1')).toBe(true);
    expect(enterIsTheItems(on('.react-flow__edge', 'c1'), 'a1')).toBe(true);
    expect(enterIsTheItems(on('[data-group]', 'core'), 'a1')).toBe(true);
    expect(enterIsTheItems(null, 'a1')).toBe(false);
  });
});
