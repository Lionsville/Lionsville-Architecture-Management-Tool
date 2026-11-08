// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { isLine, linesThroughBoxes } from './LinesCrossing';

describe('a line through a box', () => {
  const box = { id: 'b', x: 100, y: 100, width: 100, height: 60 };
  const across = { id: 'l', source: 'a', target: 'c', points: [{ x: 0, y: 130 }, { x: 150, y: 130 }, { x: 300, y: 130 }] };

  it('is said when it runs through a box that is neither of its ends', () => {
    expect(linesThroughBoxes([across], [box])).toEqual(['l']);
  });

  it('is not said where the box is one of its ends, or the line only runs along its edge', () => {
    expect(linesThroughBoxes([{ ...across, target: 'b' }], [box])).toEqual([]);
    expect(linesThroughBoxes([{ ...across, points: [{ x: 150, y: 102 }] }], [box])).toEqual([]);
  });
});

describe('a line drawn after the boxes', () => {
  // A board opened from another of its scope measures its boxes before a line is drawn: the check asks again then.
  it('asks again for a line added, taken away or drawn again, and not for anything else that changes', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const seen: boolean[] = [];
    const observer = new MutationObserver((changes) => { seen.push(changes.some(isLine)); });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['d'] });
    const line = document.createElement('div');
    line.className = 'react-flow__edge';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'react-flow__edge-path');
    line.append(path);
    root.append(line);
    await Promise.resolve();
    path.setAttribute('d', 'M0 0L10 10');
    await Promise.resolve();
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    root.append(icon);
    await Promise.resolve();
    icon.setAttribute('d', 'M0 0');
    await Promise.resolve();
    observer.disconnect();
    expect(seen).toEqual([true, true, false, false]);
  });
});
