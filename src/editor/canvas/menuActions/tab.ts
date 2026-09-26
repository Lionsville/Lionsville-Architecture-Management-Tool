// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { MenuActionFamily } from './types';

/**
 * A diagram tab's menu. The toolbar builds it and answers every entry itself
 * (`EditorToolbar`'s `handleTabMenuSelect`), so none of these reaches the
 * canvas; they are here so that the table names every action there is.
 */
export const TAB_ACTIONS = {
  'rename-diagram': { answeredBy: 'tabMenu' },
  'diagram-settings': { answeredBy: 'tabMenu' },
  'duplicate-diagram': { answeredBy: 'tabMenu' },
  'duplicate-diagram-as-of': { answeredBy: 'tabMenu' },
  'delete-diagram': { answeredBy: 'tabMenu' },
  'diagram-history': { answeredBy: 'tabMenu' },
} satisfies MenuActionFamily;
