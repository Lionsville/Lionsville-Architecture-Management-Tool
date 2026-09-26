// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ElementId } from '../../model/types';
import type { Selection } from '../useEditorState';
import type { MenuActionId, MenuItem, MenuTarget } from './menuItems';
import type { ContextMenuState } from './useContextMenu';
import type { MenuActionEntry, MenuActionHost } from './menuActions/types';
import { NODE_ACTIONS } from './menuActions/node';
import { LINE_ACTIONS } from './menuActions/line';
import { PANE_ACTIONS } from './menuActions/pane';
import { SELECTION_ACTIONS } from './menuActions/selection';
import { GROUP_ACTIONS } from './menuActions/group';
import { TAB_ACTIONS } from './menuActions/tab';

export type {
  AnsweredElsewhere,
  MenuActionCall,
  MenuActionEntry,
  MenuActionHandler,
  MenuActionHost,
} from './menuActions/types';

/**
 * Every action a menu can carry, and what it does — one entry per
 * `MenuActionId`, typed so that an id with no entry does not compile. An action
 * this canvas does nothing with says so, with who does (`AnsweredElsewhere`),
 * instead of falling out of a switch: an id nobody answers is a press that
 * vanishes, and the table is where that has to be a decision.
 */
export const MENU_ACTIONS: { readonly [A in MenuActionId]: MenuActionEntry } = {
  ...NODE_ACTIONS,
  ...LINE_ACTIONS,
  ...PANE_ACTIONS,
  ...SELECTION_ACTIONS,
  ...GROUP_ACTIONS,
  ...TAB_ACTIONS,
};

/** The elements an item is about: the clicked node, or the whole selection. */
function targetElementIds(target: MenuTarget, selection: Selection): ElementId[] {
  if (target.kind === 'node') return [target.elementId];
  if (target.kind === 'selection') return target.elementIds;
  return selection.elementIds;
}

function connectionIdOf(target: MenuTarget): string | undefined {
  return target.kind === 'edge' || target.kind === 'edgeHandle' ? target.connectionId : undefined;
}

/**
 * Map a picked menu item onto the editor. Logic lives in `EditorActions` and the
 * pure helpers; the handler in `MENU_ACTIONS` only decides which one to call
 * with what, and this only finds the handler.
 */
export function dispatchMenuAction(item: MenuItem, state: ContextMenuState, host: MenuActionHost): void {
  if (!item.action || item.disabled) return;
  if (host.intercept?.(item, state)) return;
  const entry = MENU_ACTIONS[item.action];
  if (typeof entry !== 'function') return; // answered elsewhere, and declared so
  const elementIds = targetElementIds(state.target, host.selection);
  entry({
    host,
    state,
    args: item.args ?? {},
    elementIds,
    elementId: elementIds[0],
    connectionId: connectionIdOf(state.target),
  });
}
