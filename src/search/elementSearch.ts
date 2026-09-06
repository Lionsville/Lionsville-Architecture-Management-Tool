import type { DesignModel, ElementId, ElementKind } from '../model/types';
import { fold, matchesQuery, queryTokens } from '../model/textSearch';

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
  if (queryTokens(query).length === 0) return [];
  const folded = fold(query.trim());

  const hits: ElementSearchHit[] = [];
  for (const element of model.elements) {
    if (!matchesQuery(query, [element.name, element.category, element.vendor, element.technology])) {
      continue;
    }
    // The active diagram wins whenever the element is on it; otherwise the first
    // diagram that carries it, which is the one the focus will switch to.
    const onActive = model.diagrams.some(
      (d) => d.id === activeDiagramId && d.placements.some((p) => p.elementId === element.id),
    );
    const diagram = onActive
      ? model.diagrams.find((d) => d.id === activeDiagramId)
      : model.diagrams.find((d) => d.placements.some((p) => p.elementId === element.id));
    hits.push({
      id: element.id,
      name: element.name,
      kind: element.kind,
      detail: [element.category, element.vendor, element.technology].filter(Boolean).join(' · ') || undefined,
      diagramId: diagram?.id,
      diagramName: diagram?.name,
      onActiveDiagram: onActive,
    });
  }

  const rank = (hit: ElementSearchHit) => {
    if (hit.onActiveDiagram) return fold(hit.name).startsWith(folded) ? 0 : 1;
    if (hit.diagramId) return fold(hit.name).startsWith(folded) ? 2 : 3;
    return 4; // placed on no diagram at all — findable, but last
  };

  return hits
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
