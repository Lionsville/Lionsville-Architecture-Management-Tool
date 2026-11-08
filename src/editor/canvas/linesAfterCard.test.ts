// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cardBefore, tabAfterCard } from './linesAfterCard';

describe('a card’s lines in the tab order', () => {
  it('goes from the card to its lines, line by line, and on past the last', () => {
    expect(tabAfterCard({ kind: 'card', id: 'a' }, 'a', ['x', 'y'], false)).toEqual({ kind: 'line', id: 'x' });
    expect(tabAfterCard({ kind: 'line', id: 'x' }, 'a', ['x', 'y'], false)).toEqual({ kind: 'line', id: 'y' });
    expect(tabAfterCard({ kind: 'line', id: 'y' }, 'a', ['x', 'y'], false)).toBe('after');
  });
  it('walks back to the card, and leaves Shift+Tab from the card to the browser', () => {
    expect(tabAfterCard({ kind: 'line', id: 'x' }, 'a', ['x', 'y'], true)).toEqual({ kind: 'card', id: 'a' });
    expect(tabAfterCard({ kind: 'card', id: 'a' }, 'a', ['x', 'y'], true)).toBeUndefined();
  });
  it('leaves a card with no lines to the browser', () => {
    expect(tabAfterCard({ kind: 'card', id: 'a' }, 'a', [], false)).toBeUndefined();
  });
  it('knows the card a Shift+Tab comes back to, whose lines it walks back into when it is selected', () => {
    expect(cardBefore(['a', 'b', 'c'], 'b')).toBe('a');
    expect(cardBefore(['a', 'b', 'c'], 'a')).toBeUndefined();
    expect(cardBefore(['a', 'b'], 'z')).toBeUndefined();
  });
});
