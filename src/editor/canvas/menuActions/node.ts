// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ElementId, Layer7Zone } from '../../../model/types';
import { serializeSelection } from '../../../model/clipboard';
import {
  placedNodes,
  domainGroupRectMap,
  freeSlotIn,
  freeZonePosition,
  placementSize,
  rectContains,
} from '../../../model/placement';
import { nodeFigure } from '../../../model/kinds';
import { GRID_SIZE } from '../gridSize';
import { occupiedRects } from './geometry';
import type { MenuActionFamily, MenuActionHost } from './types';

/** What a right-click on a box offers. */
export const NODE_ACTIONS = {
  'open-container': ({ host, elementId }) => {
    if (elementId) host.openApplication?.(elementId);
  },
  'create-container': ({ host, elementId }) => {
    if (elementId) host.createContainer?.(elementId);
  },
  'open-documentation': ({ host, elementId }) => {
    if (elementId) host.openDocumentation?.(elementId);
  },
  // F2 says `rename` on a line too, so the label editor answers it there.
  rename: ({ host, state: { target }, connectionId }) => {
    if (target.kind === 'node') host.requestRename?.(target.elementId);
    else if (connectionId) host.editLabel(connectionId);
  },
  'start-connection': ({ host, elementId }) => {
    if (elementId) host.startConnection(elementId);
  },
  // The item opens the picker; the picker writes the key. A hundred marks is
  // a grid with a search field, not a nested menu, so this action ends here
  // and `LogoPickerPopover` calls `updateElement` itself.
  'pick-icon': ({ host, state, elementId }) => {
    if (elementId) host.pickIcon?.(elementId, state.screen);
  },
  'set-lifecycle': ({ host: { actions }, args, elementIds }) => {
    if (!args.lifecycle) return;
    if (elementIds.length === 1) actions.updateElement(elementIds[0], { lifecycle: args.lifecycle });
    else actions.updateElements(elementIds, { lifecycle: args.lifecycle });
  },
  'move-to-zone': ({ host, args, elementId }) => {
    if (elementId && args.zone) moveToZone(host, elementId, args.zone);
  },
  'change-kind': ({ host, args, elementId }) => {
    if (elementId && args.newKind) host.actions.changeElementKind(elementId, args.newKind);
  },
  'set-domain-group': ({ host, args, elementId }) => {
    if (elementId) setDomainGroup(host, elementId, args.group);
  },
  duplicate: ({ host, elementIds }) => {
    const payload = serializeSelection(host.model, host.diagram, elementIds);
    if (payload) host.actions.pasteClipboard(payload, { x: GRID_SIZE, y: GRID_SIZE });
  },
  copy: ({ host, elementIds }) => {
    copy(host, elementIds);
  },
  cut: ({ host, elementIds }) => {
    if (copy(host, elementIds)) {
      host.actions.deleteSelection({ elementIds, connectionIds: [], domainGroups: [] });
    }
  },
  'remove-from-diagram': ({ host, elementId }) => {
    if (elementId) host.actions.removeFromDiagram(elementId);
  },
  'delete-from-model': ({ host, elementId }) => {
    if (elementId) host.requestDelete?.(elementId);
  },
} satisfies MenuActionFamily;

/** Copy the elements to the session clipboard; false when none of them is placed here. */
function copy(host: MenuActionHost, elementIds: ElementId[]): boolean {
  const payload = serializeSelection(host.model, host.diagram, elementIds);
  if (!payload || !host.clipboardRef) return false;
  host.clipboardRef.current = payload;
  if (host.pasteCountRef) host.pasteCountRef.current = 0;
  return true;
}

/**
 * "Move to zone": a free cascade slot inside the target band, zone and group
 * re-resolved from the new centre exactly as a drop would resolve them.
 */
function moveToZone(host: MenuActionHost, elementId: ElementId, zone: Layer7Zone): void {
  const { diagram, model, actions } = host;
  if (diagram.kind !== 'layer7') return;
  const placement = placedNodes(diagram).find((p) => p.id === elementId);
  const element = model.elements.find((e) => e.id === elementId);
  if (!placement || !element || (placement.zone ?? 'landscape') === zone) return;
  const occupied = occupiedRects(host, elementId, (p) => (p.zone ?? 'landscape') === zone);
  // The band it is MOVING to is what it will be drawn as when it lands.
  const figure = nodeFigure(element, zone);
  const position = freeZonePosition(zone, figure, occupied, diagram.geometry);
  const size = placementSize(figure, placement);
  const centre = { x: position.x + size.width / 2, y: position.y + size.height / 2 };
  actions.movePlacements([
    { id: elementId, ...position, ...(host.resolveDrop?.(elementId, centre) ?? { zone, group: undefined }) },
  ]);
}

/**
 * "Domain group ▸": join the group, and — like a drop — end up inside its box:
 * a node already inside keeps its spot, one outside moves to a free slot in it.
 */
function setDomainGroup(host: MenuActionHost, elementId: ElementId, name: string | undefined): void {
  const { diagram, model, actions } = host;
  if (diagram.kind !== 'layer7') return;
  if (name === undefined) {
    actions.setDomainGroup(elementId, undefined);
    return;
  }
  const rect = domainGroupRectMap(diagram.geometry?.groups).get(name);
  const placement = placedNodes(diagram).find((p) => p.id === elementId);
  const element = model.elements.find((e) => e.id === elementId);
  if (!rect || !placement || !element) return;
  const figure = nodeFigure(element, placement.zone);
  const size = placementSize(figure, placement);
  const centre = { x: placement.x + size.width / 2, y: placement.y + size.height / 2 };
  if (rectContains(rect, centre)) {
    actions.setDomainGroup(elementId, name);
    return;
  }
  const occupied = occupiedRects(host, elementId, (p) => p.group === name);
  // Insets keep a moved-in card clear of the border and of the name pill on top.
  const position = freeSlotIn(rect, figure, occupied, { x: 24, y: 36 });
  actions.movePlacements([{ id: elementId, ...position, zone: 'landscape', group: name }]);
}
