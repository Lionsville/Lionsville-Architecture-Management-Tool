import { describe, expect, it } from 'vitest';
import { zoneRect } from '../../model/zones';
import {
  DEFAULT_GROUP_SIZE,
  GROUP_AROUND_PADDING,
  GROUP_LABEL_ROOM,
  groupRectAround,
  newDomainGroup,
  uniqueGroupName,
} from './domainGroupPlacement';
import type { DesignDiagram } from '../../model/types';

/**
 * How a new domain group is named, given an id and positioned. Both ways of
 * creating one — the palette's Place button and a drop on the board — come
 * through here. The name is no longer the key (ADR-0012 §6), but two groups
 * with one name is still a board nobody can read and a format-3 save that
 * folds them into one, so the counting-up rule stays.
 */

const landscape = zoneRect('landscape');

function diagram(...names: string[]): Pick<DesignDiagram, 'groups' | 'geometry'> {
  return {
    groups: names.map((name) => ({ id: name.toLowerCase().replace(/ /g, '-'), name })),
    geometry: {
      nodes: [],
      groups: names.map((name, index) => ({
        id: name.toLowerCase().replace(/ /g, '-'),
        x: index * 10,
        y: 0,
        width: 100,
        height: 100,
      })),
    },
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

describe('newDomainGroup', () => {
  it('cascades from the landscape corner when there is no drop point', () => {
    const first = newDomainGroup();
    expect(first.group).toEqual({ id: 'new-group', name: 'New group' });
    expect(first.box).toEqual({
      x: landscape.x + 48,
      y: landscape.y + 48,
      ...DEFAULT_GROUP_SIZE,
    });

    const second = newDomainGroup({ diagram: diagram('New group') });
    expect(second.group.name).toBe('New group 2');
    expect(second.box.x).toBe(landscape.x + 48 + 36);
  });

  it('mints an id from the name, and never one that is taken', () => {
    const { group } = newDomainGroup({ diagram: diagram('Commerce'), name: 'Commerce' });
    // The name counts up, and the id it is minted from follows it.
    expect(group).toEqual({ id: 'commerce-2', name: 'Commerce 2' });
  });

  it('centres the box on the drop point', () => {
    const center = { x: landscape.x + 600, y: landscape.y + 400 };
    const { box } = newDomainGroup({ center });
    expect(box.x).toBe(center.x - DEFAULT_GROUP_SIZE.width / 2);
    expect(box.y).toBe(center.y - DEFAULT_GROUP_SIZE.height / 2);
  });

  /**
   * The boxes draw at `zIndex: -1`, so a group dropped in a band would render as
   * a stripe hiding behind it. Clamping keeps a sloppy drop useful.
   */
  it('clamps a drop outside the landscape back inside it', () => {
    const { box } = newDomainGroup({ center: { x: -5000, y: -5000 } });
    expect(box.x).toBe(landscape.x);
    expect(box.y).toBe(landscape.y);

    const far = newDomainGroup({ center: { x: 99_999, y: 99_999 } }).box;
    expect(far.x + far.width).toBe(landscape.x + landscape.width);
    expect(far.y + far.height).toBe(landscape.y + landscape.height);
  });

  it('carries the seed name and colour, and omits an absent colour entirely', () => {
    const { group } = newDomainGroup({ name: 'Commerce', color: '#2f6fdb' });
    expect(group).toEqual({ id: 'commerce', name: 'Commerce', color: '#2f6fdb' });
    // Absent, not present-and-undefined: the mapper serialises what is there.
    expect('color' in newDomainGroup({ name: 'Commerce' }).group).toBe(false);
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
