// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ElementId } from '../../../model/types';
import { selectDomainGroup } from '../../useEditorState';
import { placedNodes } from '../../../model/placement';
import { groupRectAround, newDomainGroup } from '../domainGroupPlacement';
import { rectOf } from './geometry';
import type { MenuActionFamily, MenuActionHost } from './types';

/** What a right-click on a selection of several offers. */
export const SELECTION_ACTIONS = {
  align: ({ host, args }) => {
    if (args.alignAxis) host.align(args.alignAxis);
  },
  distribute: ({ host, args }) => {
    if (args.distributeAxis) host.distribute(args.distributeAxis);
  },
  'group-into-domain-group': ({ host, elementIds }) => {
    groupIntoNewDomainGroup(host, elementIds);
  },
  'delete-selection': ({ host }) => {
    if (host.requestDeleteSelection) host.requestDeleteSelection(host.selection);
    else host.actions.deleteSelection(host.selection);
  },
} satisfies MenuActionFamily;

/**
 * "Group into new domain group": a box around the landscape members of the
 * selection, membership assigned in the same commit, the new group selected.
 */
function groupIntoNewDomainGroup(host: MenuActionHost, elementIds: ElementId[]): void {
  const { diagram, actions } = host;
  if (diagram.kind !== 'layer7') return;
  const placementsById = new Map(placedNodes(diagram).map((p) => [p.id, p]));
  const members = elementIds.filter((id) => {
    const placement = placementsById.get(id);
    return placement !== undefined && (placement.zone ?? 'landscape') === 'landscape';
  });
  const rects = members.flatMap((id) => {
    const rect = rectOf(host, id);
    return rect ? [rect] : [];
  });
  const box = groupRectAround(rects);
  if (!box || members.length === 0) return;
  const { group } = newDomainGroup({ diagram, translate: host.translate });
  actions.addDomainGroup(group, box, members);
  host.setSelection(selectDomainGroup(group.id));
}
