// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest';
import {
  menuItemsFor,
  type ConnectionMenuFacts,
  type ElementMenuFacts,
  type MenuActionId,
  type MenuContext,
  type MenuItem,
  type MenuTarget,
} from './menuItems';
import { dispatchMenuAction, MENU_ACTIONS, type MenuActionHost } from './useMenuActions';
import { NODE_ACTIONS } from './menuActions/node';
import { LINE_ACTIONS } from './menuActions/line';
import { PANE_ACTIONS } from './menuActions/pane';
import { SELECTION_ACTIONS } from './menuActions/selection';
import { GROUP_ACTIONS } from './menuActions/group';
import { TAB_ACTIONS } from './menuActions/tab';

/**
 * The dispatcher is a table, and the type says every `MenuActionId` has an
 * entry. These tests say the same from the other side: whatever a menu can
 * actually offer — every target, both canvases, every fact that adds an entry —
 * finds an entry, and an entry that is not a handler is a declared silence
 * that touches nothing.
 */

const TARGETS: MenuTarget[] = [
  { kind: 'node', elementId: 'a1' },
  { kind: 'edge', connectionId: 'c1' },
  { kind: 'edgeHandle', connectionId: 'c1', index: 0 },
  { kind: 'pane' },
  { kind: 'group', groupId: 'core' },
  { kind: 'selection', elementIds: ['a1', 'a2', 'a3'] },
  { kind: 'tab', diagramId: 'd1' },
];

const ELEMENTS: ElementMenuFacts[] = [
  { kind: 'application', lifecycle: 'live', zone: 'landscape', group: 'core', hasContainerDiagram: true, isBoundaryApplication: false, changeableKinds: ['component'] },
  { kind: 'application', lifecycle: 'live', zone: 'landscape', hasContainerDiagram: false, isBoundaryApplication: false },
  { kind: 'application', lifecycle: 'live', hasContainerDiagram: false, isBoundaryApplication: true, standIn: true },
  { kind: 'platform', lifecycle: 'planned', hasContainerDiagram: false, isBoundaryApplication: false },
  { kind: 'platformService', lifecycle: 'live', hasContainerDiagram: false, isBoundaryApplication: false },
  { kind: 'component', lifecycle: 'retiring', hasContainerDiagram: false, isBoundaryApplication: false },
];

const CONNECTIONS: ConnectionMenuFacts[] = [
  { isBidirectional: false, waypointCount: 2, hasLabelPosition: true, route: 'manual', sourceSide: 'top' },
  { isBidirectional: true, waypointCount: 0, hasLabelPosition: false, route: 'auto', landsOn: [{ id: 'k1', name: 'API' }], isLanding: true, landedOn: 'k1' },
  { isBidirectional: false, waypointCount: 0, hasLabelPosition: false, route: 'none' },
];

function contexts(): MenuContext[] {
  const out: MenuContext[] = [];
  for (const diagramKind of ['layer7', 'container'] as const) {
    for (const readOnly of [false, true]) {
      for (let i = 0; i < Math.max(ELEMENTS.length, CONNECTIONS.length); i++) {
        out.push({
          readOnly,
          platform: 'mac',
          diagramKind,
          groups: [{ id: 'core', name: 'Core' }],
          clipboardHasContent: true,
          allowedKinds: ['application', 'actor', 'component'],
          canAddExisting: true,
          showGrid: true,
          snapToGrid: true,
          canTidy: true,
          canRouteConnections: true,
          canRouteConnectionsAll: true,
          canTidyGroup: true,
          element: ELEMENTS[i % ELEMENTS.length],
          connection: CONNECTIONS[i % CONNECTIONS.length],
          selection: { elementCount: 3, landscapeCount: 2 },
          tab: { canRename: true, canConfigure: true, canDuplicate: true, canDelete: true, canHistory: true, isLastLandscape: false },
        });
      }
    }
  }
  return out;
}

function actionsIn(items: MenuItem[], into: Set<MenuActionId>): Set<MenuActionId> {
  for (const item of items) {
    if (item.action) into.add(item.action);
    if (item.children) actionsIn(item.children, into);
  }
  return into;
}

function everyOfferedAction(): Set<MenuActionId> {
  const offered = new Set<MenuActionId>();
  for (const ctx of contexts()) {
    for (const target of TARGETS) actionsIn(menuItemsFor(target, ctx), offered);
  }
  return offered;
}

describe('the menu action table', () => {
  it('has an entry for every action any menu offers', () => {
    const offered = [...everyOfferedAction()].sort();
    const missing = offered.filter((id) => !(id in MENU_ACTIONS));
    expect(missing).toEqual([]);
    for (const id of offered) {
      const entry = MENU_ACTIONS[id];
      expect(typeof entry === 'function' || typeof entry.answeredBy === 'string').toBe(true);
    }
  });

  it('holds nothing a menu cannot offer', () => {
    const offered = everyOfferedAction();
    const unreachable = Object.keys(MENU_ACTIONS).filter((id) => !offered.has(id as MenuActionId));
    expect(unreachable).toEqual([]);
  });

  it('is assembled from families that never answer the same action twice', () => {
    const families = [NODE_ACTIONS, LINE_ACTIONS, PANE_ACTIONS, SELECTION_ACTIONS, GROUP_ACTIONS, TAB_ACTIONS];
    const keys = families.flatMap((family) => Object.keys(family));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(Object.keys(MENU_ACTIONS).length);
  });

  it('declares only group and tab actions as answered elsewhere', () => {
    const elsewhere = Object.entries(MENU_ACTIONS)
      .filter(([, entry]) => typeof entry !== 'function')
      .map(([id, entry]) => [id, typeof entry === 'function' ? '' : entry.answeredBy]);
    expect(Object.fromEntries(elsewhere)).toEqual({
      'rename-group': 'intercept',
      'tidy-group': 'intercept',
      'group-color': 'intercept',
      'rename-diagram': 'tabMenu',
      'diagram-settings': 'tabMenu',
      'duplicate-diagram': 'tabMenu',
      'duplicate-diagram-as-of': 'tabMenu',
      'delete-diagram': 'tabMenu',
      'diagram-history': 'tabMenu',
    });
  });

  it('touches nothing on the host but its intercept for an action answered elsewhere', () => {
    for (const [id, entry] of Object.entries(MENU_ACTIONS)) {
      if (typeof entry === 'function') continue;
      const read: string[] = [];
      const host = new Proxy({} as MenuActionHost, {
        get(_target, property) {
          read.push(String(property));
          return undefined;
        },
      });
      dispatchMenuAction(
        { id, label: id, action: id as MenuActionId },
        { target: { kind: 'pane' }, screen: { x: 0, y: 0 }, flowPosition: { x: 0, y: 0 } },
        host,
      );
      expect(read).toEqual(['intercept']);
    }
  });
});
