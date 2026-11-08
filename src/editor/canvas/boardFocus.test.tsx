// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { focusOf, focusSheet, foundSheet } from './boardFocus';

const edges = [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'bc', source: 'b', target: 'c' },
  { id: 'cd', source: 'c', target: 'd' },
];

describe('what stays under the focus', () => {
  it('is nothing to do where nothing is picked', () => {
    expect(focusOf([], [], edges)).toBeNull();
  });

  it('keeps a card, its lines and its neighbours', () => {
    const focus = focusOf(['b'], [], edges);
    expect([...focus!.nodes].sort()).toEqual(['a', 'b', 'c']);
    expect([...focus!.lines].sort()).toEqual(['ab', 'bc']);
  });

  it('keeps a line and its two ends', () => {
    const focus = focusOf([], ['cd'], edges);
    expect([...focus!.nodes].sort()).toEqual(['c', 'd']);
    expect([...focus!.lines]).toEqual(['cd']);
  });

  it('names what is kept, so what recedes needs no render of its own, and recedes words by ink', () => {
    const sheet = focusSheet({ nodes: new Set(['a"b']), lines: new Set(['ab']) });
    expect(sheet).toContain('.react-flow__node:not([data-id="a\\"b"])');
    expect(sheet).toContain('.react-flow__edge:not([data-id="ab"])');
    expect(sheet).toContain('color:var(--ink-dim)');
    expect(sheet).not.toMatch(/kit-card\{[^}]*opacity/);
  });

  it('lets everything back while a line is in hand, so the card it lands on is never faded', () => {
    const sheet = focusSheet({ nodes: new Set(['a']), lines: new Set() });
    for (const rule of sheet.split('\n')) expect(rule).toContain(':not([data-connecting])');
  });
});

describe('what Find matches', () => {
  it('is no sheet while nothing matches', () => {
    expect(foundSheet({ ids: [], active: undefined })).toBe('');
  });

  it('rings every card that matches, and the one Enter takes heavier', () => {
    const sheet = foundSheet({ ids: ['a', 'b'], active: 'b' });
    expect(sheet).toContain('.react-flow__node[data-id="a"] .kit-card,.lv-board .react-flow__node[data-id="b"] .kit-card{outline:2px solid var(--accent)');
    expect(sheet).toContain('.lv-board .react-flow__node[data-id="b"] .kit-card{outline-width:4px}');
  });
});
