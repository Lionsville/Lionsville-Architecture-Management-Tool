// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What Enter and Space mean on the board, read off whatever has the focus.
 *
 * React Flow's own keyboard handling is off (`disableKeyboardA11y`), because
 * the keymap owns the arrows and commits the move; Tab still walks the cards
 * and the lines, and this is what makes arriving at one worth something:
 *
 * - on a card, select it — or, with Shift, add it to the selection or take it
 *   out;
 * - on a card while a connection is being drawn (*Connect from here*), end the
 *   line there, which is the keyboard's half of the click that does;
 * - on a line, select it, so its menu (Shift+F10), its label (F2) and Delete
 *   are one key away as they are for a card;
 * - on a group's name, select the group, for its menu and F2 the same way.
 *   Moving and resizing a group stay the pointer's.
 *
 * Pure: the target is asked `closest`, and nothing else, so node tests hand in
 * a plain object.
 */
import type { ElementId } from '../../model/types';
import type { Selection } from '../useEditorState';

export type KeyboardIntent =
  | { readonly kind: 'select'; readonly selection: Selection }
  | { readonly kind: 'connect'; readonly targetId: ElementId };

type Closest = { closest?(selector: string): { getAttribute(name: string): string | null } | null };

/** The id of the card, line or group the event happened on, and which it is. */
export function focusedItem(target: EventTarget | null): { kind: 'node' | 'edge' | 'group'; id: string } | undefined {
  const element = target as Closest | null;
  if (typeof element?.closest !== 'function') return undefined;
  const node = element.closest('.react-flow__node')?.getAttribute('data-id');
  if (node) return { kind: 'node', id: node };
  const edge = element.closest('.react-flow__edge')?.getAttribute('data-id');
  if (edge) return { kind: 'edge', id: edge };
  const group = element.closest('[data-group]')?.getAttribute('data-group');
  return group ? { kind: 'group', id: group } : undefined;
}

export function keyboardIntent(
  key: string,
  shiftKey: boolean,
  target: EventTarget | null,
  selection: Selection,
  connectFrom: ElementId | null,
): KeyboardIntent | undefined {
  if (key !== 'Enter' && key !== ' ') return undefined;
  const item = focusedItem(target);
  if (!item) return undefined;
  if (item.kind !== 'node') {
    if (connectFrom !== null) return undefined;
    const one = [item.id];
    return {
      kind: 'select',
      selection: item.kind === 'edge'
        ? { elementIds: [], connectionIds: one, domainGroups: [] }
        : { elementIds: [], connectionIds: [], domainGroups: one },
    };
  }
  if (connectFrom !== null) return { kind: 'connect', targetId: item.id };
  if (!shiftKey) return { kind: 'select', selection: { elementIds: [item.id], connectionIds: [], domainGroups: [] } };
  const held = selection.elementIds.includes(item.id);
  return {
    kind: 'select',
    selection: {
      ...selection,
      elementIds: held ? selection.elementIds.filter((id) => id !== item.id) : [...selection.elementIds, item.id],
    },
  };
}

/**
 * Whether Enter on this target is the target's own — a card or a line the
 * keyboard is choosing — rather than *open the selected element's page*. It
 * is, unless the focused card is the one already selected: Enter selects, and
 * Enter again opens.
 */
export function enterIsTheItems(target: EventTarget | null, selectedElementId: ElementId | undefined): boolean {
  const item = focusedItem(target);
  if (!item) return false;
  return item.kind !== 'node' || item.id !== selectedElementId;
}
