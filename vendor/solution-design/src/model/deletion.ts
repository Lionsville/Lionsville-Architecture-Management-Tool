import { DEFAULT_TRANSLATE, type StringKey, type Translate } from '../i18n/strings';
import type { DesignModel, ElementId } from '../types';

/**
 * What a delete is about to take away. Counted here, phrased here, and decided
 * here — the dialog only renders the sentence.
 *
 * The structural selection shape (rather than an import of `Selection` from
 * `editor/`) keeps the layering one-way: `model/` is the layer `editor/` reads,
 * never the other way round. `Selection` satisfies it.
 */
export interface DeletionSelection {
  elementIds: readonly ElementId[];
  connectionIds: readonly string[];
  domainGroups: readonly string[];
}

export interface DeletionSummary {
  /** Elements the user selected; deleting them removes them from the MODEL. */
  elements: number;
  /** Connections the user selected explicitly. */
  connections: number;
  /** Domain-group boxes; their members survive, they just stop belonging. */
  domainGroups: number;
  /**
   * Connections that go along with the elements without having been selected —
   * a connection dies with either endpoint. Counted separately because it is the
   * part of a delete nobody sees coming, and therefore the part worth saying.
   */
  cascadingConnections: number;
}

export function deletionSummary(model: DesignModel, selection: DeletionSelection): DeletionSummary {
  const elementIds = new Set(selection.elementIds);
  const explicit = new Set(selection.connectionIds);
  const cascading = model.connections.filter(
    (c) => !explicit.has(c.id) && (elementIds.has(c.sourceId) || elementIds.has(c.targetId)),
  );
  return {
    elements: elementIds.size,
    connections: explicit.size,
    domainGroups: new Set(selection.domainGroups).size,
    cascadingConnections: cascading.length,
  };
}

/**
 * Whether this delete is worth stopping for.
 *
 * Two things it deliberately does NOT stop for. A selection of nothing but
 * domain-group boxes is a layout edit — the boxes go, every element in them
 * stays — so a confirmation there would train people to click through the one
 * that matters. And a lone element is already covered by the richer
 * `DeleteElementDialog`, which asks a better question than "are you sure":
 * remove it from this diagram, or delete it from the model everywhere.
 *
 * What is left is exactly the two cases the editor used to delete in silence: a
 * connection (one keystroke, no dialog, and the line is gone from the model) and
 * a multi-selection (one keystroke, and everything in it is gone at once).
 */
export function needsDeleteConfirmation(summary: DeletionSummary): boolean {
  if (summary.elements === 0 && summary.connections === 0) return false;
  if (summary.connections > 0) return true;
  return summary.elements + summary.domainGroups >= 2;
}

/**
 * "3 elements, 1 connection and 2 groups" — the parts that are actually there.
 *
 * Takes the translator rather than reaching for context so it stays pure; with
 * none it answers in English, which is what every existing caller and test asked
 * of it before this file spoke two languages.
 */
export function describeDeletion(
  summary: DeletionSummary,
  translate: Translate = DEFAULT_TRANSLATE,
): string {
  const count = (n: number, one: StringKey, other: StringKey) =>
    translate(n === 1 ? one : other, { count: n });
  const parts = [
    summary.elements > 0
      ? count(summary.elements, 'deletion.elementOne', 'deletion.elementOther')
      : '',
    summary.connections > 0
      ? count(summary.connections, 'deletion.connectionOne', 'deletion.connectionOther')
      : '',
    summary.domainGroups > 0
      ? count(summary.domainGroups, 'deletion.groupOne', 'deletion.groupOther')
      : '',
  ].filter(Boolean);
  if (parts.length === 0) return translate('deletion.nothing');
  if (parts.length === 1) return parts[0];
  return translate('deletion.joined', {
    head: parts.slice(0, -1).join(', '),
    last: parts[parts.length - 1],
  });
}
