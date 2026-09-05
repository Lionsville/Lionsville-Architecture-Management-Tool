import { describe, expect, it } from 'vitest';
import {
  menuItemsFor,
  type ElementMenuFacts,
  type MenuContext,
  type MenuItem,
  type MenuTarget,
} from './menuItems';

/**
 * The menu builder is a pure table: target × context in, items out. These tests
 * pin the table — what each target offers, what read-only strips, which items
 * disable and why, and what the submenus hold — so a wiring change in the canvas
 * cannot quietly reshuffle a menu.
 */

function ctx(overrides: Partial<MenuContext> = {}): MenuContext {
  return {
    readOnly: false,
    platform: 'mac',
    diagramKind: 'layer7',
    domainGroups: [],
    clipboardHasContent: false,
    allowedKinds: ['application', 'actor'],
    showGrid: true,
    snapToGrid: false,
    canTidy: true,
    canRouteConnections: true,
    canTidyGroup: true,
    ...overrides,
  };
}

function app(overrides: Partial<ElementMenuFacts> = {}): ElementMenuFacts {
  return {
    kind: 'application',
    lifecycle: 'live',
    zone: 'landscape',
    hasContainerDiagram: true,
    isBoundaryApplication: false,
    ...overrides,
  };
}

const ids = (items: MenuItem[]) => items.filter((i) => !i.divider).map((i) => i.id);
const byId = (items: MenuItem[], id: string): MenuItem => {
  const found = items.find((i) => i.id === id);
  if (!found) throw new Error(`no item '${id}' in [${ids(items).join(', ')}]`);
  return found;
};
const checkedIds = (items: MenuItem[]) => items.filter((i) => i.checked).map((i) => i.id);

describe('menuItemsFor — node', () => {
  const NODE = { kind: 'node', elementId: 'a1' } as const;

  it('offers the full editing menu for an application on the landscape', () => {
    const items = menuItemsFor(NODE, ctx({ element: app(), domainGroups: ['Core'] }));
    expect(ids(items)).toEqual([
      'open-container',
      'rename',
      'start-connection',
      'icon',
      'lifecycle',
      // 4B: "Change kind ▸" sits between the two other "what is this" entries.
      'change-kind',
      'move-to-zone',
      'domain-group',
      'duplicate',
      'copy',
      'cut',
      'remove-from-diagram',
      'delete-from-model',
    ]);
    // Dividers separate the edit and delete groups from the rest.
    expect(items.filter((i) => i.divider)).toHaveLength(2);
  });

  it('says "Create container diagram" when the application has none yet', () => {
    const items = menuItemsFor(NODE, ctx({ element: app({ hasContainerDiagram: false }) }));
    expect(byId(items, 'open-container').label).toBe('Create container diagram');
    expect(byId(items, 'open-container').action).toBe('open-container');
  });

  it('offers no container entry for a non-application', () => {
    const items = menuItemsFor(NODE, ctx({ element: app({ kind: 'actor', zone: 'actors' }) }));
    expect(ids(items)).not.toContain('open-container');
  });

  it('reads the shortcut hints from the keymap, per platform', () => {
    const mac = menuItemsFor(NODE, ctx({ element: app() }));
    expect(byId(mac, 'rename').shortcut).toBe('F2');
    expect(byId(mac, 'duplicate').shortcut).toBe('⌘ D');
    expect(byId(mac, 'copy').shortcut).toBe('⌘ C');
    expect(byId(mac, 'cut').shortcut).toBe('⌘ X');
    expect(byId(mac, 'remove-from-diagram').shortcut).toBe('Del');
    const win = menuItemsFor(NODE, ctx({ element: app(), platform: 'other' }));
    expect(byId(win, 'duplicate').shortcut).toBe('Ctrl+D');
  });

  /**
   * DELIBERATE FLIP (Phase 3): the Icon submenu of eight marks became ONE item
   * that opens the searchable grid. A hundred marks in a nested menu is a
   * scroll, not a choice, and the grid is the same control the inspector and the
   * palette show. The item carries the CURRENT key in `icon` so the row draws
   * what the element has now.
   */
  it('Icon is one item that opens the picker, showing the current mark', () => {
    const items = menuItemsFor(NODE, ctx({ element: app({ iconKey: 'queue' }) }));
    const icon = byId(items, 'icon');
    expect(icon.label).toBe('Icon\u2026');
    expect(icon.action).toBe('pick-icon');
    expect(icon.children).toBeUndefined();
    expect(icon.icon).toBe('queue');
    // Without a mark there is nothing to draw in the leading column.
    expect(byId(menuItemsFor(NODE, ctx({ element: app() })), 'icon').icon).toBeUndefined();
  });

  it('Icon is offered for every kind — the old three-kind gate is gone', () => {
    for (const kind of [
      'application',
      'externalSystem',
      'managementTool',
      'actor',
      'inputChannel',
      'component',
    ] as const) {
      expect(ids(menuItemsFor(NODE, ctx({ element: app({ kind }) })))).toContain('icon');
    }
  });

  it('Lifecycle submenu checks the current stage', () => {
    const items = menuItemsFor(NODE, ctx({ element: app({ lifecycle: 'retiring' }) }));
    const lifecycle = byId(items, 'lifecycle');
    expect(lifecycle.children?.map((c) => c.label)).toEqual(['Planned', 'Live', 'Retiring', 'Retired']);
    expect(checkedIds(lifecycle.children ?? [])).toEqual(['lifecycle-retiring']);
    expect(byId(lifecycle.children ?? [], 'lifecycle-planned').args).toEqual({ lifecycle: 'planned' });
  });

  it('Move to zone lists the five zones on layer7 with the current one checked, and not on a container', () => {
    const items = menuItemsFor(NODE, ctx({ element: app({ zone: 'actors', kind: 'actor' }) }));
    const zones = byId(items, 'move-to-zone');
    expect(zones.children).toHaveLength(5);
    expect(checkedIds(zones.children ?? [])).toEqual(['zone-actors']);
    expect(byId(zones.children ?? [], 'zone-management').args).toEqual({ zone: 'management' });

    const container = menuItemsFor(NODE, ctx({ diagramKind: 'container', element: app({ zone: undefined }) }));
    expect(ids(container)).not.toContain('move-to-zone');
    expect(ids(container)).not.toContain('domain-group');
  });

  it('Domain group submenu: existing groups then None, current checked; hidden when there is nothing to choose', () => {
    const items = menuItemsFor(NODE, ctx({ element: app({ domainGroup: 'Core' }), domainGroups: ['Core', 'Ops'] }));
    const group = byId(items, 'domain-group');
    expect(group.children?.map((c) => c.label)).toEqual(['Core', 'Ops', 'None']);
    expect(checkedIds(group.children ?? [])).toEqual(['group-Core']);
    expect(byId(group.children ?? [], 'group-none').args).toEqual({ domainGroup: undefined });

    // No groups on the board and none on the element: nothing to offer.
    expect(ids(menuItemsFor(NODE, ctx({ element: app() })))).not.toContain('domain-group');
    // A stale membership still offers "None" so it can be cleared.
    const stale = menuItemsFor(NODE, ctx({ element: app({ domainGroup: 'Gone' }) }));
    expect(byId(stale, 'domain-group').children?.map((c) => c.label)).toEqual(['None']);
    // Band nodes are not group members.
    expect(
      ids(menuItemsFor(NODE, ctx({ element: app({ kind: 'actor', zone: 'actors' }), domainGroups: ['Core'] }))),
    ).not.toContain('domain-group');
  });

  it('disables "Remove from diagram" for the boundary application, with a reason', () => {
    const items = menuItemsFor(
      NODE,
      ctx({ diagramKind: 'container', element: app({ zone: undefined, isBoundaryApplication: true }) }),
    );
    const remove = byId(items, 'remove-from-diagram');
    expect(remove.disabled).toBe(true);
    expect(remove.disabledReason).toMatch(/boundary/);
    expect(byId(items, 'delete-from-model').danger).toBe(true);
  });

  it('read-only keeps only the navigation entry', () => {
    const withContainer = menuItemsFor(NODE, ctx({ readOnly: true, element: app() }));
    expect(ids(withContainer)).toEqual(['open-container']);
    expect(withContainer[0].label).toBe('Open container diagram');
    // Creating a container diagram is a mutation, so a read-only viewer sees nothing.
    expect(menuItemsFor(NODE, ctx({ readOnly: true, element: app({ hasContainerDiagram: false }) }))).toEqual([]);
    expect(menuItemsFor(NODE, ctx({ readOnly: true, element: app({ kind: 'actor' }) }))).toEqual([]);
  });

  it('returns nothing without element facts', () => {
    expect(menuItemsFor(NODE, ctx())).toEqual([]);
  });
});

describe('menuItemsFor — line', () => {
  const EDGE = { kind: 'edge', connectionId: 'c1' } as const;
  const HANDLE = { kind: 'edgeHandle', connectionId: 'c1', index: 1 } as const;
  const connection = (over: Partial<MenuContext['connection']> = {}) =>
    ctx({
      connection: { isBidirectional: false, waypointCount: 0, hasLabelPosition: false, route: 'none', ...over },
    });

  it('offers the line menu even for a line without a stored route', () => {
    const items = menuItemsFor(EDGE, connection());
    expect(ids(items)).toEqual([
      'add-bend',
      'remove-all-bends',
      'pin-route',
      'reset-route',
      'attach-at',
      'line-shape',
      'direction',
      'edit-label',
      'reset-label-position',
      'delete-connection',
    ]);
    expect(byId(items, 'remove-all-bends').disabled).toBe(true);
    expect(byId(items, 'reset-label-position').disabled).toBe(true);
    expect(byId(items, 'delete-connection')).toMatchObject({ danger: true, shortcut: 'Del' });
  });

  it('adds "Remove bend point" on a handle and enables the bulk removal once bends exist', () => {
    const items = menuItemsFor(HANDLE, connection({ waypointCount: 2, hasLabelPosition: true }));
    expect(ids(items).slice(0, 3)).toEqual(['add-bend', 'remove-bend', 'remove-all-bends']);
    expect(byId(items, 'remove-all-bends').disabled).toBeUndefined();
    expect(byId(items, 'reset-label-position').disabled).toBeUndefined();
  });

  it('offers Pin route on a line the router owns (or nobody does), Unpin on a hand-drawn one', () => {
    // One entry that toggles: the label says what a click will DO.
    for (const route of ['none', 'auto'] as const) {
      const pin = byId(menuItemsFor(EDGE, connection({ route })), 'pin-route');
      expect(pin).toMatchObject({ label: 'Pin route', action: 'pin-route' });
      expect(pin.disabled).toBeUndefined();
    }
    const unpin = byId(menuItemsFor(EDGE, connection({ route: 'manual' })), 'pin-route');
    expect(unpin).toMatchObject({ label: 'Unpin route', action: 'pin-route' });
  });

  it('offers Reset to automatic route, disabled only while a layout runs', () => {
    const reset = byId(menuItemsFor(EDGE, connection()), 'reset-route');
    expect(reset).toMatchObject({ label: 'Reset to automatic route', action: 'reset-route' });
    expect(reset.disabled).toBeUndefined();
    const busy = byId(menuItemsFor(EDGE, { ...connection(), layoutBusy: true }), 'reset-route');
    expect(busy.disabled).toBe(true);
    expect(busy.disabledReason).toMatch(/running/);
  });

  it('Attach at ▸ Source / Target ▸ the four sides or Automatic, checked from the stored sides', () => {
    // Phase 2d fills in the placeholder: two ends, five choices each.
    const attach = byId(menuItemsFor(EDGE, connection()), 'attach-at');
    expect(attach.disabled).toBeUndefined();
    expect(attach.children?.map((c) => c.label)).toEqual(['Source', 'Target']);
    const source = byId(attach.children ?? [], 'attach-source');
    expect(source.children?.map((c) => c.label)).toEqual(['Automatic', 'Top', 'Right', 'Bottom', 'Left']);
    // Nothing stored: Automatic is checked on both ends, and Automatic writes undefined.
    expect(checkedIds(source.children ?? [])).toEqual(['attach-source-auto']);
    expect(byId(source.children ?? [], 'attach-source-auto')).toMatchObject({
      action: 'attach-at',
      args: { attachEnd: 'source', attachSide: undefined },
    });
    expect(byId(source.children ?? [], 'attach-source-left').args).toEqual({ attachEnd: 'source', attachSide: 'left' });

    const fixed = byId(menuItemsFor(EDGE, connection({ sourceSide: 'right', targetSide: 'top' })), 'attach-at');
    expect(checkedIds(byId(fixed.children ?? [], 'attach-source').children ?? [])).toEqual(['attach-source-right']);
    expect(checkedIds(byId(fixed.children ?? [], 'attach-target').children ?? [])).toEqual(['attach-target-top']);
    expect(byId(byId(fixed.children ?? [], 'attach-target').children ?? [], 'attach-target-top').args).toEqual({
      attachEnd: 'target',
      attachSide: 'top',
    });

    // Like Reset: a side change routes the line, so the leaves wait for a running pass.
    const busy = byId(menuItemsFor(EDGE, { ...connection(), layoutBusy: true }), 'attach-at');
    for (const leaf of byId(busy.children ?? [], 'attach-source').children ?? []) {
      expect(leaf.disabled, leaf.id).toBe(true);
      expect(leaf.disabledReason).toMatch(/running/);
    }
    expect(byId(source.children ?? [], 'attach-source-top').disabled).toBeUndefined();
  });

  it('Line shape checks the stored routing, Smooth when none is stored, and Smooth writes undefined', () => {
    const smooth = byId(menuItemsFor(EDGE, connection()), 'line-shape');
    expect(smooth.children?.map((c) => c.label)).toEqual(['Smooth', 'Orthogonal', 'Straight', 'Curved']);
    expect(checkedIds(smooth.children ?? [])).toEqual(['shape-smooth']);
    expect(byId(smooth.children ?? [], 'shape-smooth').args).toEqual({ routing: undefined });

    const ortho = byId(menuItemsFor(EDGE, connection({ routing: 'orthogonal' })), 'line-shape');
    expect(checkedIds(ortho.children ?? [])).toEqual(['shape-orthogonal']);
    expect(byId(ortho.children ?? [], 'shape-curved').args).toEqual({ routing: 'curved' });
  });

  it('Direction checks one-way or two-way and offers Reverse unchecked', () => {
    const oneWay = byId(menuItemsFor(EDGE, connection()), 'direction');
    expect(checkedIds(oneWay.children ?? [])).toEqual(['direction-one-way']);
    const twoWay = byId(menuItemsFor(EDGE, connection({ isBidirectional: true })), 'direction');
    expect(checkedIds(twoWay.children ?? [])).toEqual(['direction-two-way']);
    expect(byId(twoWay.children ?? [], 'direction-reverse').args).toEqual({ direction: 'reverse' });
  });

  it('is empty in read-only mode (nothing on a line is navigation)', () => {
    expect(menuItemsFor(EDGE, { ...connection({ waypointCount: 3 }), readOnly: true })).toEqual([]);
    expect(menuItemsFor(HANDLE, { ...connection({ waypointCount: 3 }), readOnly: true })).toEqual([]);
  });
});

describe('menuItemsFor — pane', () => {
  const PANE = { kind: 'pane' } as const;

  it('offers paste, add, groups, selection, layout, view and grid toggles on layer7', () => {
    const items = menuItemsFor(PANE, ctx({ clipboardHasContent: true }));
    expect(ids(items)).toEqual([
      'paste-here',
      'add-here',
      'add-domain-group-here',
      'select-all',
      'tidy',
      'route-connections',
      'fit-view',
      'toggle-grid',
      'toggle-snap',
    ]);
    expect(byId(items, 'paste-here').shortcut).toBe('⌘ V');
    expect(byId(items, 'paste-here').disabled).toBeUndefined();
    expect(byId(items, 'select-all').shortcut).toBe('⌘ A');
    expect(byId(items, 'fit-view').shortcut).toBe('⇧ 1');
    expect(byId(items, 'toggle-grid').checked).toBe(true);
    expect(byId(items, 'toggle-snap').checked).toBe(false);
  });

  it('disables Paste when the clipboard is empty, with a reason', () => {
    const paste = byId(menuItemsFor(PANE, ctx()), 'paste-here');
    expect(paste.disabled).toBe(true);
    expect(paste.disabledReason).toBe('Nothing to paste');
  });

  it('Add here lists exactly the kinds the palette offers, by their palette labels', () => {
    const add = byId(menuItemsFor(PANE, ctx({ allowedKinds: ['component', 'actor', 'externalSystem'] })), 'add-here');
    expect(add.children?.map((c) => c.label)).toEqual(['Component', 'Actor', 'External system']);
    expect(add.children?.[0]).toMatchObject({ action: 'add-here', args: { kind: 'component' } });
  });

  it('leaves out the domain-group entry on a container diagram', () => {
    expect(ids(menuItemsFor(PANE, ctx({ diagramKind: 'container' })))).not.toContain('add-domain-group-here');
  });

  it('hides Tidy / Route when the editor wired no handler, and disables them while a layout runs', () => {
    const none = menuItemsFor(PANE, ctx({ canTidy: false, canRouteConnections: false }));
    expect(ids(none)).not.toContain('tidy');
    expect(ids(none)).not.toContain('route-connections');
    const busy = menuItemsFor(PANE, ctx({ layoutBusy: true }));
    expect(byId(busy, 'tidy').disabled).toBe(true);
    expect(byId(busy, 'route-connections').disabledReason).toMatch(/running/);
  });

  it('adds "Re-route everything (ignore pins)" after Route connections when the editor wired it', () => {
    // The pass that overrides pinned routes is a deliberate extra entry, never the
    // default — "Route connections" honours pins.
    const items = menuItemsFor(PANE, ctx({ canRouteConnectionsAll: true }));
    const order = ids(items);
    expect(order.indexOf('route-connections-all')).toBe(order.indexOf('route-connections') + 1);
    expect(byId(items, 'route-connections-all')).toMatchObject({
      label: 'Re-route everything (ignore pins)',
      action: 'route-connections-all',
    });
    expect(byId(menuItemsFor(PANE, ctx({ canRouteConnectionsAll: true, layoutBusy: true })), 'route-connections-all').disabled).toBe(true);
    expect(ids(menuItemsFor(PANE, ctx()))).not.toContain('route-connections-all');
  });

  it('read-only keeps only Select all and Fit view', () => {
    const items = menuItemsFor(PANE, ctx({ readOnly: true, clipboardHasContent: true }));
    expect(ids(items)).toEqual(['select-all', 'fit-view']);
    expect(items.some((i) => i.divider)).toBe(false);
  });
});

describe('menuItemsFor — selection', () => {
  const SELECTION: MenuTarget = { kind: 'selection', elementIds: ['a', 'b'] };
  const selection = (elementCount: number, landscapeCount = elementCount, over: Partial<MenuContext> = {}) =>
    ctx({ selection: { elementCount, landscapeCount }, ...over });

  it('offers align, distribute, lifecycle, grouping, copy and delete', () => {
    const items = menuItemsFor(SELECTION, selection(3));
    expect(ids(items)).toEqual([
      'align',
      'distribute',
      'lifecycle',
      'group-into-domain-group',
      'copy',
      'delete-selection',
    ]);
    expect(byId(items, 'align').children?.map((c) => c.label)).toEqual([
      'Left',
      'Centre',
      'Right',
      'Top',
      'Middle',
      'Bottom',
    ]);
    expect(byId(items, 'align').children?.[1].args).toEqual({ alignAxis: 'centerX' });
    expect(byId(items, 'distribute').children?.map((c) => c.args)).toEqual([
      { distributeAxis: 'horizontal' },
      { distributeAxis: 'vertical' },
    ]);
    expect(byId(items, 'lifecycle').children?.every((c) => c.checked === undefined)).toBe(true);
    expect(byId(items, 'delete-selection')).toMatchObject({ danger: true, shortcut: 'Del' });
  });

  it('disables Distribute below three elements', () => {
    const two = byId(menuItemsFor(SELECTION, selection(2)), 'distribute');
    expect(two.disabled).toBe(true);
    expect(two.disabledReason).toMatch(/three/);
    expect(byId(menuItemsFor(SELECTION, selection(3)), 'distribute').disabled).toBeUndefined();
  });

  it('grouping needs landscape members and a layer7 board', () => {
    const bandOnly = byId(menuItemsFor(SELECTION, selection(2, 0)), 'group-into-domain-group');
    expect(bandOnly.disabled).toBe(true);
    expect(ids(menuItemsFor(SELECTION, selection(2, 2, { diagramKind: 'container' })))).not.toContain(
      'group-into-domain-group',
    );
  });

  it('is empty in read-only mode', () => {
    expect(menuItemsFor(SELECTION, selection(3, 3, { readOnly: true }))).toEqual([]);
  });
});

describe('menuItemsFor — group', () => {
  const GROUP = { kind: 'group', name: 'Core' } as const;

  it('offers rename, tidy, colour, select members and remove', () => {
    const items = menuItemsFor(GROUP, ctx());
    expect(ids(items)).toEqual(['rename-group', 'tidy-group', 'group-color', 'select-members', 'remove-group']);
    expect(byId(items, 'remove-group').danger).toBe(true);
  });

  it('drops Tidy when the editor supplies no group-tidy handler', () => {
    expect(ids(menuItemsFor(GROUP, ctx({ canTidyGroup: false })))).not.toContain('tidy-group');
  });

  it('is empty in read-only mode', () => {
    expect(menuItemsFor(GROUP, ctx({ readOnly: true }))).toEqual([]);
  });
});

describe('menuItemsFor — tab', () => {
  const TAB = { kind: 'tab', diagramId: 'd1' } as const;
  const tab = (over: Partial<NonNullable<MenuContext['tab']>> = {}, more: Partial<MenuContext> = {}) =>
    ctx({ tab: { canRename: true, canConfigure: true, canDuplicate: true, canDelete: true, isLastLandscape: false, ...over }, ...more });

  it('offers rename, settings, duplicate and delete when the host wired them all', () => {
    const items = menuItemsFor(TAB, tab());
    expect(ids(items)).toEqual([
      'rename-diagram', 'diagram-settings', 'duplicate-diagram', 'delete-diagram',
    ]);
    expect(items.filter((i) => i.divider)).toHaveLength(1);
    expect(byId(items, 'delete-diagram').danger).toBe(true);
  });

  it('hides each entry whose host callback is absent', () => {
    expect(ids(menuItemsFor(TAB, tab({ canRename: false }))))
      .toEqual(['diagram-settings', 'duplicate-diagram', 'delete-diagram']);
    expect(ids(menuItemsFor(TAB, tab({ canConfigure: false }))))
      .toEqual(['rename-diagram', 'duplicate-diagram', 'delete-diagram']);
    expect(ids(menuItemsFor(TAB, tab({ canConfigure: false, canDuplicate: false, canDelete: false }))))
      .toEqual(['rename-diagram']);
    const onlyDelete = menuItemsFor(TAB, tab({ canRename: false, canConfigure: false, canDuplicate: false }));
    expect(ids(onlyDelete)).toEqual(['delete-diagram']);
    expect(onlyDelete.some((i) => i.divider)).toBe(false);
    expect(menuItemsFor(TAB, tab({
      canRename: false, canConfigure: false, canDuplicate: false, canDelete: false,
    }))).toEqual([]);
  });

  it('refuses to delete the last landscape', () => {
    const remove = byId(menuItemsFor(TAB, tab({ isLastLandscape: true })), 'delete-diagram');
    expect(remove.disabled).toBe(true);
    expect(remove.disabledReason).toMatch(/last landscape/);
  });

  it('is empty in read-only mode and without tab facts', () => {
    expect(menuItemsFor(TAB, tab({}, { readOnly: true }))).toEqual([]);
    expect(menuItemsFor(TAB, ctx())).toEqual([]);
  });
});

describe('menuItemsFor — invariants', () => {
  const everyMenu = (): MenuItem[][] => {
    const connection = { isBidirectional: true, waypointCount: 1, hasLabelPosition: true, route: 'auto' as const };
    return [
      menuItemsFor({ kind: 'node', elementId: 'a' }, ctx({ element: app(), domainGroups: ['Core'] })),
      menuItemsFor({ kind: 'edge', connectionId: 'c' }, ctx({ connection })),
      menuItemsFor({ kind: 'edgeHandle', connectionId: 'c', index: 0 }, ctx({ connection })),
      menuItemsFor({ kind: 'pane' }, ctx({ clipboardHasContent: true })),
      menuItemsFor({ kind: 'selection', elementIds: ['a', 'b', 'c'] }, ctx({ selection: { elementCount: 3, landscapeCount: 3 } })),
      menuItemsFor({ kind: 'group', name: 'Core' }, ctx()),
      menuItemsFor(
        { kind: 'tab', diagramId: 'd' },
        ctx({ tab: { canRename: true, canConfigure: true, canDuplicate: true, canDelete: true, isLastLandscape: false } }),
      ),
    ];
  };

  it('gives every item a unique id within its menu, including submenu entries', () => {
    for (const items of everyMenu()) {
      const all = items.flatMap((i) => [i, ...(i.children ?? [])]);
      const seen = new Set(all.map((i) => i.id));
      expect(seen.size).toBe(all.length);
    }
  });

  it('gives every non-divider leaf an action and every divider no label', () => {
    // Recursive since Attach at ▸ Source ▸ … made submenus two levels deep: a
    // node with children is a submenu and needs no action, a leaf needs one.
    const check = (item: MenuItem): void => {
      if (item.divider) {
        expect(item.label).toBe('');
        return;
      }
      if (item.children && item.children.length > 0) {
        for (const child of item.children) check(child);
      } else {
        expect(item.action, item.id).toBeDefined();
      }
    };
    for (const items of everyMenu()) {
      for (const item of items) check(item);
    }
  });

  it('never starts or ends a menu with a divider, and never doubles one', () => {
    for (const items of everyMenu()) {
      expect(items[0]?.divider).toBeUndefined();
      expect(items[items.length - 1]?.divider).toBeUndefined();
      for (let i = 1; i < items.length; i += 1) {
        expect(items[i].divider && items[i - 1].divider).toBeFalsy();
      }
    }
  });
});

// ── Change kind ▸ (4B) ───────────────────────────────────────────────────────

describe('menuItemsFor — change kind', () => {
  const NODE = { kind: 'node', elementId: 'a1' } as const;

  it('lists the kinds the caller says are reachable', () => {
    const items = menuItemsFor(
      NODE,
      ctx({ element: { ...app(), changeableKinds: ['actor', 'externalSystem'] } }),
    );
    const entry = byId(items, 'change-kind');
    expect(entry.disabled).toBeUndefined();
    expect(entry.children?.map((c) => c.label)).toEqual(['Actor', 'External system']);
    expect(entry.children?.[0].args).toEqual({ newKind: 'actor' });
  });

  it('is offered disabled, with the reason, when nothing is reachable', () => {
    const entry = byId(
      menuItemsFor(
        NODE,
        ctx({
          element: {
            ...app(),
            changeableKinds: [],
            kindChangeRefusal: 'kindChange.hasContainerDiagram',
          },
        }),
      ),
      'change-kind',
    );
    expect(entry.disabled).toBe(true);
    expect(entry.disabledReason).toBe(
      'This application has a container diagram — delete that view first',
    );
  });

  it('falls back to a generic reason when the caller gave none', () => {
    const entry = byId(
      menuItemsFor(NODE, ctx({ element: { ...app(), changeableKinds: [] } })),
      'change-kind',
    );
    expect(entry.disabled).toBe(true);
    expect(entry.disabledReason).toBe('This diagram does not hold that kind');
  });

  it('is not offered at all in read-only mode', () => {
    const items = menuItemsFor(NODE, ctx({ readOnly: true, element: app() }));
    expect(items.some((item) => item.id === 'change-kind')).toBe(false);
  });
});
