// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { RefObject } from 'react';
import type { ElementId, ElementKind, Point } from '../../../model/types';
import type { EditorActions, PlacementMove, Selection } from '../../useEditorState';
import type { ClipboardPayload } from '../../../model/clipboard';
import type { AttachSidesPatch } from '../../../model/routes';
import type { Translate } from '../../../i18n/strings';
import type { AlignAxis, DistributeAxis, NodeBounds } from '../../../layout/alignDistribute';
import type { DesignDiagram, DesignModel } from '../../../model/types';
import type { MenuActionArgs, MenuActionId, MenuItem } from '../menuItems';
import type { ContextMenuState } from '../useContextMenu';

/**
 * Everything a menu action may reach for. The canvas fills this in from its own
 * props and React Flow; a handler never touches anything else, which is what
 * keeps each one a few lines from `MenuActionId` to one call.
 */
export interface MenuActionHost {
  model: DesignModel;
  diagram: DesignDiagram;
  actions: EditorActions;
  selection: Selection;
  setSelection(selection: Selection): void;
  /** Live, measured node rects — the only place real sizes exist (see alignDistribute). */
  nodeBounds(): NodeBounds[];
  fitView(): void;
  /** Session clipboard shared with the keyboard shortcuts. */
  clipboardRef?: RefObject<ClipboardPayload | null>;
  pasteCountRef?: RefObject<number>;
  /** The palette-drop seed path: kind + flow position, zone resolved by the canvas. */
  addElementAt(kind: ElementKind, position: Point): void;
  addDomainGroupAt?(position: Point): void;
  /** *Add here ▸ Existing application…*: the host's picker, landing at the click. */
  addExistingAt?(position: Point): void;
  /** What a drop at `center` would assign (layer7 zone + group); mirrors the drag rules. */
  resolveDrop?(elementId: ElementId, center: Point): Pick<PlacementMove, 'zone' | 'group'>;
  /** The double-click path: open or create the application's container diagram. */
  openApplication?(elementId: ElementId): void;
  /** Make the application's container diagram, on purpose (the menu's *Create container diagram*). */
  createContainer?(elementId: ElementId): void;
  /** "Open documentation": the editor shows the element's page. */
  openDocumentation?(elementId: ElementId): void;
  requestRename?(elementId: ElementId): void;
  /** Opens the delete dialog (remove from diagram / delete from model). */
  requestDelete?(elementId: ElementId): void;
  /**
   * Opens the confirmation for a delete that would otherwise happen in silence.
   * Both are OPTIONAL and both fall back to the action itself, so a canvas that
   * wires no dialog behaves exactly as it did before the confirmation existed.
   */
  requestDeleteConnection?(connectionId: string): void;
  requestDeleteSelection?(selection: Selection): void;
  tidy?(): void;
  /** "Route connections": honours pinned and hand-drawn routes. */
  routeConnections?(): void;
  /** "Re-route everything (ignore pins)": the same pass with nothing preserved. */
  routeConnectionsAll?(): void;
  /** "Reset to automatic route" — deletes the stored row and re-routes (the editor owns the pass). */
  resetRoute?(connectionId: string): void;
  /** "Attach at ▸ Source / Target ▸ side" — fixes an end's side and re-routes (the editor owns the pass). */
  setRouteSides?(connectionId: string, sides: AttachSidesPatch): void;
  toggleGrid(): void;
  toggleSnap(): void;
  align(axis: AlignAxis): void;
  distribute(axis: DistributeAxis): void;
  /** Enter connect mode from this element; the next node click completes it. */
  startConnection(elementId: ElementId): void;
  /** Start the inline label editor on this connection. */
  editLabel(connectionId: string): void;
  /** Open the icon grid for this element, anchored at the click point. */
  pickIcon?(elementId: ElementId, screen: Point): void;
  /**
   * First refusal for the canvas wrapper — Layer 7 owns the group popovers and
   * the inline group rename. Return true when the item was handled.
   */
  intercept?(item: MenuItem, state: ContextMenuState): boolean;
  /**
   * The UI language's lookup, for the handful of actions that write a NAME
   * into the model ("Group selection" invents one). Optional and English by
   * default, so the pure dispatch stays testable without a React tree.
   */
  translate?: Translate;
}

/** One picked item, with what every handler would otherwise work out again. */
export interface MenuActionCall {
  host: MenuActionHost;
  state: ContextMenuState;
  args: MenuActionArgs;
  /** The elements the item is about: the clicked node, or the whole selection. */
  elementIds: ElementId[];
  /** The first of them — the one a single-element action is about. */
  elementId: ElementId | undefined;
  /** The line under the click, when the menu was opened on one or on its bend. */
  connectionId: string | undefined;
}

/** What one menu action does. A few lines each: when one grows, the growth belongs in `model/`. */
export type MenuActionHandler = (call: MenuActionCall) => void;

/**
 * An action this dispatcher does nothing with, on purpose, and who does
 * instead. Declared rather than left out, because an action with no entry is
 * a press that vanishes without a trace — and the table has to say which of
 * its silences are meant.
 *
 * - `intercept`: the canvas wrapper takes it first (`MenuActionHost.intercept`)
 *   — Layer 7's group popovers and inline group rename. A canvas that wires
 *   no such wrapper offers no group menu to press it from.
 * - `tabMenu`: the diagram tab's menu, which the toolbar builds and answers
 *   itself; it never reaches the canvas.
 */
export interface AnsweredElsewhere {
  readonly answeredBy: 'intercept' | 'tabMenu';
}

export type MenuActionEntry = MenuActionHandler | AnsweredElsewhere;

/** One family's slice of the table: only real action ids, each at most once. */
export type MenuActionFamily = { readonly [A in MenuActionId]?: MenuActionEntry };
