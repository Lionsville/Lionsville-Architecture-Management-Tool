// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { StringKey, Translate } from '../i18n/strings';
import { MODEL_ENGLISH } from './words';
import type { DesignDiagram, DesignModel, ElementId } from './types';
import { rolesEndedBy } from './units';
import type { Assignment, RoleHeld } from './units';

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
  /**
   * How many of the selected elements are stand-ins (ADR-0012 §3).
   *
   * Worth saying because it is the part of a delete people ASSUME wrong in the
   * other direction: deleting a stand-in takes this scope's record of the
   * thing, and the thing itself stays where it is defined. Nobody has ever
   * needed reassuring that deleting a definition deletes it, so only this
   * number is drawn.
   */
  standIns: number;
  /**
   * Who stops holding which role in which unit among the elements: the delete
   * takes their assignments with it (`commands/elements.ts`). Named, because
   * it is the part of deleting a unit that reaches past the board — the
   * People page, a person's load, who manages whom.
   */
  roles: readonly RoleHeld[];
  /** Assignments in them already over, which go too and end nobody's role. */
  earlierAssignments: number;
}

/** How many named roles a confirmation lists before it says how many more. */
export const ROLES_LISTED = 5;

/**
 * The same selection, minus the one element this diagram may never lose: the
 * application its container view is about.
 *
 * A container diagram's boundary box IS the application, so select-all, a
 * rubber band over the whole board and Cut all hand the application to a delete
 * that would take it out of the model — and out of the landscape, and take
 * every interface ending on it along (`reducer.deleteElement`). The menu's
 * *Remove from diagram* and the single-element dialog have both said no to that
 * since they existed; this is the same no, said where a selection passes.
 *
 * Dropped from the selection rather than refused whole, because the rest of the
 * gesture is perfectly meaningful — clearing a container view's contents is
 * exactly what somebody selecting all of it is asking for, and the boundary is
 * not contents. Removing the view itself is `removeContainerDiagram`, from the
 * boards table.
 *
 * Generic in the selection so the editor's own `Selection` survives the trip,
 * and idempotent, so the path that summarises and the path that writes may both
 * ask.
 */
export function deletableSelection<S extends DeletionSelection>(
  selection: S,
  diagram: Pick<DesignDiagram, 'kind' | 'applicationElementId'> | undefined,
): S {
  const boundary = diagram?.kind === 'container' ? diagram.applicationElementId : undefined;
  if (boundary === undefined || !selection.elementIds.includes(boundary)) return selection;
  return { ...selection, elementIds: selection.elementIds.filter((id) => id !== boundary) };
}

/**
 * What a selection's delete takes away. `model.assignments` is the scope's, as
 * the session holds them; an editor handed none names nobody. `today` tells a
 * role still held from an assignment already over; absent, every one is held.
 */
export function deletionSummary(
  model: DesignModel & { readonly assignments?: readonly Assignment[] },
  selection: DeletionSelection,
  today?: string,
): DeletionSummary {
  const elementIds = new Set(selection.elementIds);
  const explicit = new Set(selection.connectionIds);
  const ended = rolesEndedBy(model.assignments ?? [], elementIds, today);
  const cascading = model.relations.filter(
    (c) => !explicit.has(c.id) && (elementIds.has(c.sourceId) || elementIds.has(c.targetId)),
  );
  return {
    elements: elementIds.size,
    connections: explicit.size,
    domainGroups: new Set(selection.domainGroups).size,
    cascadingConnections: cascading.length,
    standIns: model.elements.filter((e) => elementIds.has(e.id) && e.ref !== undefined).length,
    roles: ended.roles,
    earlierAssignments: ended.earlier,
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
  translate: Translate = MODEL_ENGLISH,
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
  const listed = parts.length === 1
    ? parts[0]
    : translate('deletion.joined', {
      head: parts.slice(0, -1).join(', '),
      last: parts[parts.length - 1],
    });
  // Appended rather than woven in: it is a clause about what the delete does
  // NOT take, and a list of counts is the wrong shape for that (ADR-0012 §3).
  return summary.standIns > 0
    ? translate('deletion.withStandIns', {
      what: listed,
      count: summary.standIns,
    })
    : listed;
}

/** What a confirmation needs to name a role that ends: the person, the role and the unit, as the screen calls them. */
export interface RoleNames {
  person(id: string): string;
  role(id: string): string;
  unit(id: string): string;
}

/**
 * The roles a delete ends, as sentences a person reads before confirming it:
 * "Ada Lovelace stops being Product owner in Webshop." — each, up to
 * {@link ROLES_LISTED}, then how many more; then the assignments already over
 * that go too. Nothing where the delete ends no role. Said here so a board's
 * confirmation and a sheet's say the same thing.
 */
export function rolesEndedSentences(
  summary: Pick<DeletionSummary, 'roles' | 'earlierAssignments'>,
  names: RoleNames,
  translate: Translate = MODEL_ENGLISH,
): string[] {
  const lines = summary.roles.slice(0, ROLES_LISTED).map((one) => translate('deletion.roleEnds', {
    who: names.person(one.person), role: names.role(one.roleId), unit: names.unit(one.unitId),
  }));
  const more = summary.roles.length - ROLES_LISTED;
  if (more > 0) lines.push(translate(more === 1 ? 'deletion.rolesMoreOne' : 'deletion.rolesMoreOther', { count: more }));
  const earlier = summary.earlierAssignments;
  if (earlier > 0) lines.push(translate(earlier === 1 ? 'deletion.earlierOne' : 'deletion.earlierOther', { count: earlier }));
  return lines;
}
