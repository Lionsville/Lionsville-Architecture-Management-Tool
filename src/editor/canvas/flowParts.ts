// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/* What the canvas hands React Flow beside its cards and lines: which lines take a tab, the group a right-click selects, and the options. */
import type { Edge } from '@xyflow/react';
import type { Selection } from '../useEditorState';

/**
 * The lines that take a tab: only those of what is selected. React Flow draws the
 * lines ahead of the cards, so with every line in the tab order Tab walked them all
 * before the first card; a line is reached from its card instead. A line that says
 * for itself whether it takes the focus keeps its word.
 */
export function linesInTabOrder<E extends Pick<Edge, 'id' | 'source' | 'target' | 'focusable'>>(
  edges: readonly E[],
  elements: ReadonlySet<string>,
  lines: ReadonlySet<string>,
): E[] {
  return edges.map((edge) => {
    if (edge.focusable !== undefined) return edge;
    const reached = lines.has(edge.id) || elements.has(edge.source) || elements.has(edge.target);
    return reached ? { ...edge, focusable: true } : edge;
  });
}

/** One group selected, as a right-click on it selects it: the panel says what the menu acts on. */
export const selectGroup = (groupId: string): Selection => ({ elementIds: [], connectionIds: [], domainGroups: [groupId] });

/**
 * React Flow's attribution stays off the canvas, where it sat under the key in a
 * corner of every board: the library is MIT-licensed and named with its licence in
 * the notices the app ships, which is where a reader finds what it is built on.
 */
export const FLOW_OPTIONS = { hideAttribution: true } as const;
