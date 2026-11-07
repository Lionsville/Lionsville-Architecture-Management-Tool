// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The facts about a record the rows and the agent's words share (`inspector/elementRows`):
 * who is asked what, whom an actor may belong to, and who answers for it in words.
 */
import type { DesignElement, DesignModel, ElementId } from '../model/types';
import type { Translate } from '../i18n/strings';
import type { AnsweredBy, PartyElsewhere } from './props';
import { isBlankRef } from '../model/person';
import type { PersonRef } from '../model/person';
import type { PersonNames } from '../people/ui/names';

/**
 * Who sells it — asked of an application and of nothing else.
 *
 * It used to be asked of three kinds, and the other two turned out to BE
 * applications (ADR-0012 §4): a management tool has a vendor because it is a
 * piece of software somebody bought, and so does a system from outside.
 */
export function showVendor(kind: DesignElement['kind']): boolean {
  return kind === 'application';
}

export function showTechnology(kind: DesignElement['kind']): boolean {
  return kind === 'application' || kind === 'component';
}

/**
 * Whether it is ours is a question about a system and about a party — a
 * customer's portal, a regulator. A capability or a step is ours by
 * definition, because it is a thing this organisation does.
 */
export function showOutside(kind: DesignElement['kind']): boolean {
  return kind === 'application' || kind === 'actor';
}

/** The choices under *Belongs to*, grouped by the scope that keeps them. */
export interface PartyChoices {
  /** This scope's own actors, stand-ins included. */
  here: readonly { id: ElementId; name: string }[];
  /** The actors each scope above keeps and this one does not, nearest first. */
  above: readonly { where: string; parties: readonly PartyElsewhere[] }[];
  /**
   * The party the record names where nothing above offers it — a scope that
   * is gone, a sibling's actor. Offered under its id so the field shows what
   * is written rather than a blank, and a person can see it and change it.
   */
  unknown?: ElementId;
}

/**
 * Which actors *Belongs to* may name (ADR-0012 §4): this scope's own, then
 * those of the scopes above that this one holds no record of, as the host
 * hands them over. An id held here is this scope's, even when it is a
 * stand-in of an actor above: the record is the same actor.
 */
export function partyChoices(
  element: DesignElement,
  model: DesignModel,
  elsewhere: readonly PartyElsewhere[] = [],
): PartyChoices {
  const here = model.elements
    .filter((other) => other.kind === 'actor' && other.id !== element.id)
    .map(({ id, name }) => ({ id, name }));
  const held = new Set(model.elements.map((other) => other.id));
  const above: { where: string; parties: PartyElsewhere[] }[] = [];
  for (const party of elsewhere) {
    if (held.has(party.id)) continue;
    const group = above.find((one) => one.where === party.where);
    if (group) group.parties.push(party);
    else above.push({ where: party.where, parties: [party] });
  }
  const offered = (id: ElementId) =>
    here.some((one) => one.id === id) || above.some((group) => group.parties.some((one) => one.id === id));
  const named = element.partyId;
  return {
    here,
    above,
    ...(named !== undefined && !offered(named) ? { unknown: named } : {}),
  };
}

/** What to call the party a record names: its name where this scope or one above keeps it. */
function partyName(
  partyId: ElementId | undefined,
  model: DesignModel,
  elsewhere: readonly PartyElsewhere[] = [],
): string | undefined {
  if (partyId === undefined) return undefined;
  return model.elements.find((other) => other.id === partyId)?.name
    ?? elsewhere.find((other) => other.id === partyId)?.name;
}

/**
 * Who answers for a record, in words (ADR-0036 §8): its own owner, the owner
 * its master names for a stand-in, or — where nobody wrote one — whoever the
 * operating model's rule works out on the day, with the role and the unit
 * that make them it. Nothing where none of the three says anyone.
 */
export function ownerText(
  element: Pick<DesignElement, 'owner'>, names: PersonNames, t: Translate, answeredBy?: AnsweredBy,
): string | undefined {
  const written: PersonRef | undefined = isBlankRef(element.owner) ? answeredBy?.owner : element.owner;
  if (!isBlankRef(written)) return names.text(written);
  const worked = answeredBy?.workedOut;
  if (!worked || worked.people.length === 0) return undefined;
  const who = worked.people.map((id) => names.text({ person: id })).join(', ');
  return t('record.ownerWorkedOut', { who, role: worked.role, unit: worked.unit });
}

/**
 * The record in one line, for the panel beside the canvas: "Owner · Vendor ·
 * Technology · Outside", whichever are set. Empty when none is, so the panel
 * can say so instead. The owner reads through the register, and where
 * nobody wrote one, it is whoever the rule works out (ADR-0036 §8); without
 * `people` a picked owner reads as nobody's name.
 */
export function recordSummary(
  element: DesignElement,
  model: DesignModel,
  t: Translate,
  parties?: readonly PartyElsewhere[],
  people?: { names: PersonNames; answeredBy?: AnsweredBy },
): string[] {
  const parts: string[] = [];
  const owner = people ? ownerText(element, people.names, t, people.answeredBy) : typeof element.owner === 'string' ? element.owner : undefined;
  if (owner) parts.push(`${t('field.owner')}: ${owner}`);
  if (element.vendor) parts.push(`${t('field.vendor')}: ${element.vendor}`);
  if (element.technology) parts.push(`${t('field.technology')}: ${element.technology}`);
  if (element.outside) {
    const party = partyName(element.partyId, model, parties);
    parts.push(party ? t('record.outsideOf', { name: party }) : t('field.outside'));
  }
  const successor = model.elements.find((other) => other.id === element.successorId)?.name;
  if (successor) parts.push(`${t('field.successor')}: ${successor}`);
  return parts;
}
