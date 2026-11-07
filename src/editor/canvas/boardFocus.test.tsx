// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import { focusOf, focusSheet } from './boardFocus';

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
});
