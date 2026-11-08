// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { clearPlace, isLine, linesThroughBoxes, overlappingBoxes } from './LinesCrossing';

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

describe('a box over another', () => {
  const application = { id: 'app', x: 0, y: 100, width: 200, height: 80 };
  const person = { id: 'person', x: 60, y: 30, width: 160, height: 76 };
  const boundary = { id: 'b', x: 400, y: 0, width: 600, height: 400 };

  it('is said once, the later of the two, and not where one box holds the other', () => {
    expect(overlappingBoxes([application, person])).toEqual(['person']);
    expect(overlappingBoxes([application, { ...person, y: 400 }])).toEqual([]);
    expect(overlappingBoxes([{ id: 'group', x: 0, y: 0, width: 500, height: 500 }, application])).toEqual([]);
  });

  it('is moved to the nearest place clear of every box, on the side of the boundary it stood', () => {
    const at = clearPlace(person, [application], boundary)!;
    expect(at).toEqual({ x: 60, y: 100 - 76 - 16 });
    const moved = { ...person, ...at };
    expect(overlappingBoxes([application, moved])).toEqual([]);
    // Never into the application's boundary from outside it.
    const beside = { id: 'p2', x: 230, y: 100, width: 160, height: 76 };
    const placed = clearPlace(beside, [{ id: 'a2', x: 300, y: 90, width: 90, height: 60 }], boundary)!;
    expect(placed).toEqual({ x: 124, y: 100 });
    expect(placed.x + beside.width).toBeLessThanOrEqual(boundary.x);
  });
});
