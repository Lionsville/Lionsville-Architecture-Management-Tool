import { describe, expect, it } from 'vitest';
import { zoneRect } from '../../model/zones';
import {
  DEFAULT_GROUP_SIZE,
  GROUP_AROUND_PADDING,
  GROUP_LABEL_ROOM,
  groupRectAround,
  newDomainGroupRect,
  uniqueGroupName,
} from './domainGroupPlacement';
import type { DiagramLayoutConfig } from '../../model/types';

/**
 * How a new domain group is positioned and named. Both ways of creating one — the
 * palette's Place button and a drop on the board — come through here, and the
 * name rule is load-bearing: `upsertDomainGroup` keys on the name, so handing
 * back one that exists would resize somebody else's group.
 */

const landscape = zoneRect('landscape');

function config(...names: string[]): DiagramLayoutConfig {
  return {
    domainGroups: names.map((name, index) => ({
      name,
      x: index * 10,
      y: 0,
      width: 100,
      height: 100,
    })),
  };
}

describe('uniqueGroupName', () => {
  it('keeps a free name as typed', () => {
    expect(uniqueGroupName('Commerce', ['Support'])).toBe('Commerce');
  });

  it('counts up rather than colliding with an existing group', () => {
    expect(uniqueGroupName('Commerce', ['Commerce'])).toBe('Commerce 2');
    expect(uniqueGroupName('Commerce', ['Commerce', 'Commerce 2'])).toBe('Commerce 3');
  });

  it('trims, and falls back when nothing usable was typed', () => {
    expect(uniqueGroupName('  Commerce  ', [])).toBe('Commerce');
    expect(uniqueGroupName('   ', [])).toBe('New group');
  });
});

describe('newDomainGroupRect', () => {
  it('cascades from the landscape corner when there is no drop point', () => {
    const first = newDomainGroupRect();
    expect(first).toEqual({
      name: 'New group',
      x: landscape.x + 48,
      y: landscape.y + 48,
      ...DEFAULT_GROUP_SIZE,
    });

    const second = newDomainGroupRect({ layoutConfig: config('New group') });
    expect(second.name).toBe('New group 2');
    expect(second.x).toBe(landscape.x + 48 + 36);
  });

  it('centres the box on the drop point', () => {
    const center = { x: landscape.x + 600, y: landscape.y + 400 };
    const rect = newDomainGroupRect({ center });
    expect(rect.x).toBe(center.x - DEFAULT_GROUP_SIZE.width / 2);
    expect(rect.y).toBe(center.y - DEFAULT_GROUP_SIZE.height / 2);
  });

  /**
   * The boxes draw at `zIndex: -1`, so a group dropped in a band would render as
   * a stripe hiding behind it. Clamping keeps a sloppy drop useful.
   */
  it('clamps a drop outside the landscape back inside it', () => {
    const rect = newDomainGroupRect({ center: { x: -5000, y: -5000 } });
    expect(rect.x).toBe(landscape.x);
    expect(rect.y).toBe(landscape.y);

    const far = newDomainGroupRect({ center: { x: 99_999, y: 99_999 } });
    expect(far.x + far.width).toBe(landscape.x + landscape.width);
    expect(far.y + far.height).toBe(landscape.y + landscape.height);
  });

  it('carries the seed name and colour, and omits an absent colour entirely', () => {
    const coloured = newDomainGroupRect({ name: 'Commerce', color: '#2f6fdb' });
    expect(coloured.name).toBe('Commerce');
    expect(coloured.color).toBe('#2f6fdb');
    // Absent, not present-and-undefined: the mapper serialises what is there.
    expect('color' in newDomainGroupRect({ name: 'Commerce' })).toBe(false);
  });

  it('renames a dropped group that would have collided', () => {
    const rect = newDomainGroupRect({
      layoutConfig: config('Commerce'),
      center: { x: landscape.x + 300, y: landscape.y + 300 },
      name: 'Commerce',
    });
    expect(rect.name).toBe('Commerce 2');
  });
});

describe('groupRectAround', () => {
  it('hugs the members with padding and leaves room for the label on top', () => {
    const rect = groupRectAround([
      { x: 400, y: 300, width: 200, height: 130 },
      { x: 700, y: 360, width: 200, height: 130 },
    ]);
    expect(rect).toEqual({
      x: 400 - GROUP_AROUND_PADDING,
      y: 300 - GROUP_AROUND_PADDING - GROUP_LABEL_ROOM,
      width: 500 + GROUP_AROUND_PADDING * 2,
      height: 190 + GROUP_AROUND_PADDING * 2 + GROUP_LABEL_ROOM,
    });
  });

  it('never produces a box too small to hold a card', () => {
    const rect = groupRectAround([{ x: 0, y: 0, width: 10, height: 10 }]);
    expect(rect?.width).toBeGreaterThanOrEqual(120);
    expect(rect?.height).toBeGreaterThanOrEqual(120);
  });

  it('is undefined for no members', () => {
    expect(groupRectAround([])).toBeUndefined();
  });
});
