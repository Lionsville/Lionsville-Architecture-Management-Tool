// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { placedNodes } from '../../../model/placement';
import type { MenuActionFamily } from './types';

/**
 * What a right-click on a dashed group offers. Three of its five open a
 * popover or an inline editor that belongs to Layer 7, which takes them
 * through `intercept` before this table is asked.
 */
export const GROUP_ACTIONS = {
  'select-members': ({ host, state: { target } }) => {
    if (target.kind !== 'group') return;
    const members = placedNodes(host.diagram)
      .filter((p) => p.group === target.groupId)
      .map((p) => p.id);
    host.setSelection({ elementIds: members, connectionIds: [], domainGroups: [] });
  },
  'remove-group': ({ host, state: { target } }) => {
    if (target.kind === 'group') host.actions.removeDomainGroup(target.groupId);
  },
  'rename-group': { answeredBy: 'intercept' },
  'tidy-group': { answeredBy: 'intercept' },
  'group-color': { answeredBy: 'intercept' },
} satisfies MenuActionFamily;
