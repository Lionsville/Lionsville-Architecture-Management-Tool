import type { DesignModel, ElementId, ElementKind } from '../model/types';
import { fold, queryTokens } from '../model/textSearch';
import { bestMatches, matchesTokens, NO_MATCH, searchIndex } from './searchIndex';

/**
 * ⌘F — find an element by what you remember about it.
 *
 * The haystack is name, category, vendor and technology: on a real landscape you
 * remember "the SAP one" or "the Kafka thing" as often as you remember the name
 * somebody gave the box. Description is deliberately NOT searched — it is a
 * paragraph, and one long description would out-match every name on the board.
 *
 * Order matters more than it looks. Elements on the diagram you are already
 * looking at come first, because focusing one of those is a pan and focusing any
 * other is a diagram switch — a heavier thing to do by accident. Within each
 * half, a name that STARTS with the query beats one that merely contains it,
 * then alphabetical so the list is stable while you type.
 *
 * That order is now five bands over an index that is already in name order
 * (`searchIndex.ts`), rather than a filter, a map and a sort over every element
 * per keystroke — which also means the scan stops once the top band is full,
 * and "which diagram is this on" is a map lookup rather than a walk over every
 * diagram's placements.
 *
 * Pure, and it takes the model rather than the editor state, so the dialog is a
 * rendering of this and nothing else.
 */
export interface ElementSearchHit {
  id: ElementId;
  name: string;
  kind: ElementKind;
  /** What the row shows under the name: category / vendor / technology. */
  detail?: string;
  /** The diagram the focus will land on; absent when the element is placed nowhere. */
  diagramId?: string;
  diagramName?: string;
  /** True when that diagram is the one already open. */
  onActiveDiagram: boolean;
}

/** How many hits the dialog will ever show — a scroll list, not a report. */
export const SEARCH_RESULT_LIMIT = 20;

export function searchElements(
  model: DesignModel,
  query: string,
  activeDiagramId: string,
  limit: number = SEARCH_RESULT_LIMIT,
): ElementSearchHit[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  const folded = fold(query.trim());
  const index = searchIndex(model);
  const onActiveDiagram = index.places.carries.get(activeDiagramId);

  return bestMatches(index.elements, limit, 5, (entry) => {
    if (!matchesTokens(tokens, entry.fields)) return NO_MATCH;
    const prefix = entry.name.startsWith(folded) ? 0 : 1;
    if (onActiveDiagram?.has(entry.element.id)) return prefix;
    if (index.places.first.has(entry.element.id)) return 2 + prefix;
    return 4; // placed on no diagram at all — findable, but last
  }).map(({ element }) => {
    // The active diagram wins whenever the element is on it; otherwise the first
    // diagram that carries it, which is the one the focus will switch to.
    const onActive = onActiveDiagram?.has(element.id) ?? false;
    const diagram = onActive
      ? model.diagrams.find((d) => d.id === activeDiagramId)
      : index.places.first.get(element.id);
    return {
      id: element.id,
      name: element.name,
      kind: element.kind,
      detail: [element.category, element.vendor, element.technology].filter(Boolean).join(' · ') || undefined,
      diagramId: diagram?.id,
      diagramName: diagram?.name,
      onActiveDiagram: onActive,
    };
  });
}
