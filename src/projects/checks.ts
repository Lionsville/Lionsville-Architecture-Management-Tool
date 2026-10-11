// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the tree contradicts about itself (ADR-0012 §9).
 *
 * **Nothing here is stored, and nothing here is a refusal.** Every answer is a
 * value with a key, computed from the index and from a scope's own document,
 * and none of them is ever a reason a save fails. That is the whole design
 * position of the record: two scopes that each define `erp` are somebody
 * mid-migration or two teams naming the same thing on the same afternoon, and
 * a tool that refused the second definition would refuse the state every real
 * merge goes through. The same holds for a stand-in nobody defines, a name
 * that has gone stale, and a system nobody has said whose it is.
 *
 * Ten findings, in two families, because they are answered from two different
 * places and cost two different amounts:
 *
 * - {@link identityFindings} reads the **index** and nothing else — conflict,
 *   drift, dangling, proposal. One fold over the entries answers for the whole
 *   organisation, which is what lets the first screen put a finding line on
 *   every row of the tree without loading a single model.
 * - {@link documentFindings} reads **one scope's own document** — the owner's
 *   detail on a stand-in, an unattributed outsider, a relation end nobody
 *   holds, a master drawn nowhere, a shape on a drawing that points at an
 *   element this scope does not hold, the two the business layer already
 *   answers, and a cause that explains an observation of a scope below.
 *   Paid by the scope that is open, once per model.
 *
 * **Why `business/`'s two arrive as an argument.** `unmappedFunctions` and
 * `coverageOf` stay where they are — they are the business layer's arithmetic
 * and the sheet draws them — but `projects` sits *below* `business` in the
 * import matrix and may not reach up for them. So the caller that has both (a
 * page, which may import either) computes them and hands the two lists in.
 * That is the same rule the index follows in the other direction, and it keeps
 * this module testable with two plain arrays.
 */
import type { StringKey, Translate } from '../i18n/strings'
import { OWNER_DETAIL } from '../model'
import type { DesignElement, ElementId, OwnerDetailField } from '../model'
import type { HostModel } from '../model/hostModel'
import { causeLabel, liveCauses } from '../observations/observation'
import { accountabilityGaps } from '../model/operatingModel'
import { ownsOf } from '../model/conway'
import { today } from '../model/lifecycle'
import { unitFindings } from '../model/units'
import { unitTypeLanes } from '../model/unitOrder'
import type { Assignment, Organisation, UnitFinding } from '../model/units'
import type { ScopeIndex } from './scopeIndex'
import { ancestorScopes } from './scopePath'
import type { ScopePath } from './scopePath'

/**
 * Every finding this module can produce, as keys — `platform/errors.ts` style,
 * because a finding is shown to a person and this module has no language.
 *
 * `check.notDrawn` is **information and not a fault**: a thing can be real,
 * owned and documented without being on anybody's board yet, and drawing it in
 * the same colour as a conflict would teach people to ignore the colour.
 */
export type CheckKey =
  /** Two scopes define this id at the same depth. */
  | 'check.conflict'
  /** A stand-in's or a declaration's cached name or ref disagrees with the master. */
  | 'check.drift'
  /** A stand-in of something no scope in the tree defines. */
  | 'check.dangling'
  /** A relation ending on an id this scope does not hold. */
  | 'check.danglingEnd'
  /** A function defined here that no ancestor has named: this domain is proposing it. */
  | 'check.proposal'
  /** Fields on a stand-in that belong to the scope that defines it. */
  | 'check.ownedElsewhere'
  /** `outside`, and nobody has said whose it is. */
  | 'check.unattributed'
  /** A master no view in its own scope draws. Information. */
  | 'check.notDrawn'
  /** A shape on a drawing points at an element this scope does not hold. */
  | 'check.drawingLinkMissing'
  /** A function assigned to nobody and claimed by nobody. */
  | 'check.unmapped'
  /** A function with no `supports` and no `assigned`: nothing and nobody does it. */
  | 'check.uncovered'
  /**
   * A service used by another team's application and not marked shared
   * (ADR-0014): being offered, whether or not anybody said so.
   */
  | 'check.offeredNotShared'
  /**
   * A cause here explains an observation of a scope below (ADR-0032 §9): a
   * link ADR-0021 allowed and nothing makes any more, kept and drawn. Names
   * the cause below that explains that observation, where there is one —
   * linking that one instead is the repair.
   */
  | 'check.causeExplainsObservationBelow'
  /**
   * A responsibility of the operating model that is not exactly one role's
   * *A* (ADR-0036 §2): nobody is accountable for it, or several roles are —
   * named in `detail` where there are.
   */
  | 'check.accountability'
  /**
   * A unit type of the operating model that sits nowhere (3.6.1): not at the
   * top, and in no unit type that sits anywhere (`model/unitOrder.ts`), so
   * every unit made of it would sit where its type may not.
   */
  | 'check.unitTypeNowhere'
  /**
   * The organisation as it is, on a day (ADR-0036 §3), read off the index:
   * fewer people in a role of a unit than its slot's minimum, more than its
   * maximum; a unit under a type it may not sit in, one serving several
   * domains under a type that serves one, one owning more applications than
   * its type's limit; an assignment still running in a unit or a role that
   * has ended; a unit still there under a unit type that has ended
   * (ADR-0036 §6); and a person whose shares add up to more than all of their
   * time — about each scope that keeps one of their assignments, named by
   * the register, never here.
   */
  | 'check.roleVacant'
  | 'check.roleOverMax'
  | 'check.unitMisplaced'
  | 'check.unitSpans'
  | 'check.unitOverLimit'
  | 'check.assignmentEnded'
  | 'check.unitTypeEnded'
  | 'check.personOverloaded'

/**
 * The sentence for each finding, published as a table (ADR-0012 §9).
 *
 * Every module that draws a finding — the organisation screen, a card on a
 * board, a sheet's inspector — reads this rather than naming a key of its own,
 * which is the rule `decisions` publishes `STATUS_LABEL` for. A `Record` so a
 * finding added without words is a compile error here rather than a blank line
 * on somebody's screen; the key and the string key are the same word because
 * there is nothing for a second name to add.
 *
 * Every sentence takes `{name}` and, where it names another scope, `{scope}`.
 */
export const CHECK_LABEL: Record<CheckKey, StringKey> = {
  'check.conflict': 'check.conflict',
  'check.drift': 'check.drift',
  'check.dangling': 'check.dangling',
  'check.danglingEnd': 'check.danglingEnd',
  'check.proposal': 'check.proposal',
  'check.ownedElsewhere': 'check.ownedElsewhere',
  'check.unattributed': 'check.unattributed',
  'check.notDrawn': 'check.notDrawn',
  'check.drawingLinkMissing': 'check.drawingLinkMissing',
  'check.unmapped': 'check.unmapped',
  'check.uncovered': 'check.uncovered',
  'check.offeredNotShared': 'check.offeredNotShared',
  'check.causeExplainsObservationBelow': 'check.causeExplainsObservationBelow',
  'check.accountability': 'check.accountability',
  'check.unitTypeNowhere': 'check.unitTypeNowhere',
  'check.roleVacant': 'check.roleVacant',
  'check.roleOverMax': 'check.roleOverMax',
  'check.unitMisplaced': 'check.unitMisplaced',
  'check.unitSpans': 'check.unitSpans',
  'check.unitOverLimit': 'check.unitOverLimit',
  'check.assignmentEnded': 'check.assignmentEnded',
  'check.unitTypeEnded': 'check.unitTypeEnded',
  'check.personOverloaded': 'check.personOverloaded',
}

/**
 * The sentence where the finding has nothing to name beside it — no cause
 * below explains the observation yet — for the one finding whose repair
 * names a record when there is one.
 */
const CHECK_LABEL_BARE: Partial<Record<CheckKey, StringKey>> = {
  'check.causeExplainsObservationBelow': 'check.causeExplainsObservationBelowBare',
  'check.accountability': 'check.accountabilityNobody',
}

/**
 * One finding as the sentence a person reads, filled in.
 *
 * The one place the table above is turned into words, so every screen that
 * says a finding says the same thing: the register, the technology page, the
 * organisation screen's *Needs attention* and a stand-in's note on a board.
 * `scopeName` is the caller's, because what to call a scope — its name, or
 * the word for the organisation — is the screen's vocabulary and not this
 * module's; so is `personName`, because a person's name is the register's,
 * and a finding about one says who by id.
 */
export function findingSentence(
  finding: Finding, s: Translate, scopeName: (path: ScopePath) => string,
  personName?: (id: string) => string,
): string {
  const key = finding.detail === undefined ? CHECK_LABEL_BARE[finding.key] ?? CHECK_LABEL[finding.key] : CHECK_LABEL[finding.key]
  return s(key, {
    // A finding about a person carries their id; the name is the register's (ADR-0036 §8).
    name: finding.person !== undefined && personName ? personName(finding.person) : finding.name,
    scope: scopeName(finding.scopes?.[0] ?? ''),
    detail: finding.detail ?? '',
    count: finding.count ?? 0,
    limit: finding.limit ?? 0,
  })
}

/**
 * The same findings counted rather than said — "2 conflicts · 1 drifting".
 *
 * A second table because a line that counts wants a noun and a line that
 * explains wants a sentence, and one string cannot be both. One pair per
 * finding, because every language this ships in tells one from many.
 */
export const CHECK_SHORT: Record<CheckKey, { one: StringKey; other: StringKey }> = {
  'check.conflict': { one: 'check.short.conflict.one', other: 'check.short.conflict.other' },
  'check.drift': { one: 'check.short.drift.one', other: 'check.short.drift.other' },
  'check.dangling': { one: 'check.short.dangling.one', other: 'check.short.dangling.other' },
  'check.danglingEnd': { one: 'check.short.danglingEnd.one', other: 'check.short.danglingEnd.other' },
  'check.proposal': { one: 'check.short.proposal.one', other: 'check.short.proposal.other' },
  'check.ownedElsewhere': { one: 'check.short.ownedElsewhere.one', other: 'check.short.ownedElsewhere.other' },
  'check.unattributed': { one: 'check.short.unattributed.one', other: 'check.short.unattributed.other' },
  'check.notDrawn': { one: 'check.short.notDrawn.one', other: 'check.short.notDrawn.other' },
  'check.drawingLinkMissing': { one: 'check.short.drawingLinkMissing.one', other: 'check.short.drawingLinkMissing.other' },
  'check.unmapped': { one: 'check.short.unmapped.one', other: 'check.short.unmapped.other' },
  'check.uncovered': { one: 'check.short.uncovered.one', other: 'check.short.uncovered.other' },
  'check.offeredNotShared': { one: 'check.short.offeredNotShared.one', other: 'check.short.offeredNotShared.other' },
  'check.causeExplainsObservationBelow': {
    one: 'check.short.causeExplainsObservationBelow.one', other: 'check.short.causeExplainsObservationBelow.other',
  },
  'check.accountability': { one: 'check.short.accountability.one', other: 'check.short.accountability.other' },
  'check.unitTypeNowhere': { one: 'check.short.unitTypeNowhere.one', other: 'check.short.unitTypeNowhere.other' },
  'check.roleVacant': { one: 'check.short.roleVacant.one', other: 'check.short.roleVacant.other' },
  'check.roleOverMax': { one: 'check.short.roleOverMax.one', other: 'check.short.roleOverMax.other' },
  'check.unitMisplaced': { one: 'check.short.unitMisplaced.one', other: 'check.short.unitMisplaced.other' },
  'check.unitSpans': { one: 'check.short.unitSpans.one', other: 'check.short.unitSpans.other' },
  'check.unitOverLimit': { one: 'check.short.unitOverLimit.one', other: 'check.short.unitOverLimit.other' },
  'check.assignmentEnded': { one: 'check.short.assignmentEnded.one', other: 'check.short.assignmentEnded.other' },
  'check.unitTypeEnded': { one: 'check.short.unitTypeEnded.one', other: 'check.short.unitTypeEnded.other' },
  'check.personOverloaded': { one: 'check.short.personOverloaded.one', other: 'check.short.personOverloaded.other' },
}

/**
 * One finding: what it is, where, and about what.
 *
 * `scope` is the scope the finding is ABOUT — the one holding the record that
 * causes it — because that is what a tree row counts and what a page opens.
 * `scopes` is everybody else it names: the other definition in a conflict, the
 * master a stale cache should be pointing at.
 */
export type Finding = {
  key: CheckKey
  scope: ScopePath
  /** The element or relation the finding is about. */
  id: string
  /** What to call it on screen — the master's name, or the cache where there is none. */
  name: string
  /** The other scopes the finding names, in path order. */
  scopes?: ScopePath[]
  /** Which fields (`check.ownedElsewhere`), in the order this module lists them. */
  fields?: string[]
  /** The other thing the sentence names — the consumers of an offering, by name. */
  detail?: string
  /** True where this is worth knowing and is not a fault. See {@link CheckKey}. */
  information?: true
  /**
   * The view the finding is in, where it is about something on a view and not
   * an element: a shape on a drawing (`check.drawingLinkMissing`). Opening the
   * finding opens that view; `id` still tells one shape from another.
   */
  view?: string
  /**
   * The person a finding is about, by register id (`check.personOverloaded`):
   * `name` is then the id too, and a screen asks the register what to call
   * them (ADR-0036 §8). No finding ever holds a register name.
   */
  person?: string
  /** How many, where the sentence says: holders of a role, applications owned, a share in per cent. */
  count?: number
  /** The bound `count` is held to: a slot's minimum or maximum, a type's limit. */
  limit?: number
}

/**
 * Everything on a record that belongs to whoever DEFINES the thing
 * (ADR-0012 §3).
 *
 * Said once in `model/standIn.ts` and re-exported here, because three modules
 * need the same answer: this one reports the fields when they appear on a
 * stand-in, `mayEdit.ts` refuses writes to them, and the reducer's
 * `element.link` drops them. A field in one list and not the others would be a
 * field the inspector greys out and the agent accepts, or one a link leaves
 * behind for these checks to complain about for ever.
 */
export { OWNER_DETAIL } from '../model'
export type { OwnerDetailField } from '../model'

/**
 * Which of the owner's detail this record actually says something with.
 *
 * Published because two callers ask it: this module reports the fields when
 * they appear on a stand-in, and `gestures.ts` asks whether the scope a
 * definition is about to move into already holds a record of its own — a thin
 * declaration yields, which is what a declaration is for, and a record with
 * the owner's detail on it is somebody's work and is refused.
 */
export function ownerDetailOn(element: DesignElement): OwnerDetailField[] {
  return OWNER_DETAIL.filter((field) => detailSaidOn(element, field))
}

/**
 * Is this field one the owning scope answers for?
 *
 * `lifecycle`, `isManaged` and `aspects` are required on the type and present
 * on every record, so their mere presence says nothing — a stand-in read back
 * from a file carries them because the file's reader put them there. What
 * counts is a value that says something: a lifecycle that is not the default,
 * an aspect map with a key in it.
 */
function detailSaidOn(element: DesignElement, field: OwnerDetailField): boolean {
  switch (field) {
    // The three every record carries. See the note above. An ABSENT lifecycle
    // is a hand-written file leaving out what it had nothing to say about, and
    // reporting it would be reporting the absence of a field.
    case 'lifecycle': return element.lifecycle !== undefined && element.lifecycle !== 'live'
    case 'isManaged': return element.isManaged === true
    case 'aspects': return Object.keys(element.aspects ?? {}).length > 0
    default: return element[field] !== undefined
  }
}

/**
 * The findings the index alone can answer, for the whole organisation.
 *
 * One fold over the entries, in id order, so a screen drawing a line per scope
 * pays for the tree once rather than once per row — the shape ADR-0004 keeps
 * catching.
 */
export function identityFindings(index: ScopeIndex): Finding[] {
  const found: Finding[] = []
  for (const entry of index.entries()) {
    // Two definitions at the same depth: a finding on BOTH scopes, because
    // neither of them is the one that is wrong.
    if (entry.conflict) {
      for (const scope of entry.conflict) {
        found.push({
          key: 'check.conflict', scope, id: entry.id, name: entry.name,
          scopes: entry.conflict.filter((held) => held !== scope),
        })
      }
    }
    for (const scope of entry.stale) {
      found.push({
        key: 'check.drift', scope, id: entry.id, name: entry.name,
        ...(entry.master !== undefined ? { scopes: [entry.master] } : {}),
      })
    }
    // Nobody defines it. Every record of it is a stand-in of something that
    // was never written down — *link* is how one gets a master (§10).
    if (entry.master === undefined) {
      for (const scope of entry.drawnIn) {
        found.push({ key: 'check.dangling', scope, id: entry.id, name: entry.name })
      }
    } else if (entry.kind === 'function' && proposedAt(entry.master, index, entry.id)) {
      // A domain's own function that the organisation never named (§2). Shown
      // on the organisation sheet as not yet modelled at that level, which is
      // a conversation and not a fault.
      found.push({ key: 'check.proposal', scope: entry.master, id: entry.id, name: entry.name })
    } else if (entry.kind === 'platformService' && !entry.shared) {
      // Offered whether or not anybody ticked the box (ADR-0014): a value
      // somebody typed wins and is left as typed, and where nobody has, the
      // rows say. On the service, in the scope that answers for it, naming
      // the consumers — because that is what the maintainer needs to know.
      const { outside } = offeredBeyond(index, entry.id)
      if (outside.length > 0) {
        found.push({
          key: 'check.offeredNotShared', scope: entry.master, id: entry.id, name: entry.name,
          fields: outside.map((one) => one.id),
          detail: outside.map((one) => one.name).join(', '),
        })
      }
    }
  }
  return found
}

/** Who maintains a service, and who uses it from another team (ADR-0014). */
export type Offering = {
  /** The actors it is `assigned` to, by id, in row order. */
  maintainers: ElementId[]
  /**
   * The applications using it whose own team is another actor: a component's
   * application, since a team owns applications and not containers. Each once,
   * in row order. Empty where nothing is said to a maintainer, and where a
   * consumer has no party to compare — the tree cannot say either way, and a
   * finding that guessed would be one nobody could clear.
   */
  outside: { id: ElementId; name: string; partyId: ElementId }[]
}

/**
 * Whether a service is being offered beyond its own team, read off the rows
 * the tree holds rather than off a field (ADR-0014): the actor it is assigned
 * to in the platform scope, and the applications using it wherever their
 * landscapes wrote the row. Whose an application is comes from `partyId`,
 * which already means which actor it belongs to.
 *
 * Shared with the register and the inspector's derived answer, so the tick,
 * the finding and the row on the technology page cannot disagree.
 */
export function offeredBeyond(index: ScopeIndex, serviceId: ElementId): Offering {
  const maintainers = [...new Set(index.rowsTo(serviceId, ['assigned']).map(({ relation }) => relation.sourceId))]
  const outside: Offering['outside'] = []
  if (maintainers.length === 0) return { maintainers, outside }
  const seen = new Set<ElementId>()
  for (const { relation } of index.rowsTo(serviceId, ['uses'])) {
    const consumer = index.lookup(relation.sourceId)
    if (!consumer) continue
    const application = consumer.kind === 'component' && consumer.parentId !== undefined
      ? index.lookup(consumer.parentId) ?? consumer
      : consumer
    if (seen.has(application.id)) continue
    seen.add(application.id)
    const partyId = application.partyId
    if (partyId === undefined || maintainers.includes(partyId)) continue
    outside.push({ id: application.id, name: application.name, partyId })
  }
  return { maintainers, outside }
}

/**
 * Does no scope above this one define the id?
 *
 * The master is the deepest definition, so "above it" is exactly the
 * declarations — which the index has already worked out.
 *
 * A master with no ancestor IN THE INDEX is not a proposal: there is nobody
 * for it to be proposing to. Usually that is the organisation itself; it is
 * also an index built over a subtree, which a `.lvarch` of one domain and
 * every test that names its own paths is.
 */
function proposedAt(master: ScopePath, index: ScopeIndex, id: ElementId): boolean {
  const known = new Set(index.scopes())
  const above = ancestorScopes(master).filter((path) => known.has(path))
  if (above.length === 0) return false
  const entry = index.lookup(id)
  return !(entry?.declarations ?? []).some((path) => above.includes(path))
}

/**
 * What `business/` already answers about this scope's functions, handed in.
 *
 * Two lists of ids, computed by whoever has both modules in reach. See the
 * note at the top for why this is an argument and not an import.
 */
export type BusinessFindings = {
  /** Assigned to nobody and claimed by nobody (`business/sheetDiagram`). */
  unmapped?: readonly ElementId[]
  /** No `supports` and no `assigned` (`business/coverage`). */
  uncovered?: readonly ElementId[]
}

/**
 * The findings about one scope's own document.
 *
 * Everything here needs the records themselves, which is why it is not in
 * {@link identityFindings}: a page that wanted these for twenty scopes would
 * be loading twenty models, and there is no screen that wants that.
 */
export function documentFindings(deps: {
  scope: ScopePath
  model: HostModel
  index: ScopeIndex
  business?: BusinessFindings
}): Finding[] {
  const { scope, model, index, business } = deps
  const found: Finding[] = []
  const held = new Set(model.elements.map((element) => element.id))

  for (const element of model.elements) {
    if (element.ref !== undefined) {
      // Ignored on a stand-in, and reported if present (§3). Reported rather
      // than stripped on save: somebody wrote it, and a file quietly losing
      // fields is worse than a line saying which scope answers for them.
      const fields = ownerDetailOn(element)
      if (fields.length > 0) {
        const owner = index.lookup(element.id)?.master
        found.push({
          key: 'check.ownedElsewhere', scope, id: element.id, name: element.name,
          fields: [...fields],
          ...(owner !== undefined ? { scopes: [owner] } : {}),
        })
      }
      continue
    }
    // Outside the organisation, and nobody has said whose it is (§4). A gap
    // the tool shows rather than a state it stores.
    //
    // Applications only. `partyId` says which ACTOR a thing belongs to, so an
    // outside actor is the party rather than a thing missing one — Customers
    // and Regulators on a stakeholder rail are outside by definition, and a
    // finding on every one of them would be the whole rail underlined in
    // orange on the day it was drawn.
    if (element.kind === 'application' && element.outside && element.partyId === undefined) {
      found.push({ key: 'check.unattributed', scope, id: element.id, name: element.name })
    }
    // A master nothing in its own scope draws. Information: a record and a
    // drawing are two acts (§10), and a master with no view is ordinary. A
    // drawing that points at it counts, the same way a board that holds it does.
    if (index.lookup(element.id)?.master === scope && !drawnIn(model, element.id)) {
      found.push({
        key: 'check.notDrawn', scope, id: element.id, name: element.name, information: true,
      })
    }
  }

  // A relation end this scope does not hold. Ordinary when the id is one the
  // tree knows — that is a row reaching into another domain, which is what
  // organisation-wide ids are for — and a finding when nobody holds it at all.
  for (const relation of model.relations) {
    for (const end of [relation.sourceId, relation.targetId]) {
      if (held.has(end) || index.lookup(end)) continue
      found.push({
        key: 'check.danglingEnd', scope, id: relation.id, name: nameOf(model, relation.id, end),
        // The id nobody holds, which is what a person needs and is not the
        // row's own id.
        fields: [end],
      })
    }
  }

  const named = (id: ElementId) => model.elements.find((held) => held.id === id)?.name
    ?? index.lookup(id)?.name ?? id
  for (const id of business?.unmapped ?? []) {
    found.push({ key: 'check.unmapped', scope, id, name: named(id) })
  }
  for (const id of business?.uncovered ?? []) {
    found.push({ key: 'check.uncovered', scope, id, name: named(id) })
  }
  return [
    ...found, ...drawingLinkFindings(scope, model, held), ...causesOverObservationsBelow(scope, model, index),
    ...operatingModelFindings(scope, model),
  ]
}

/**
 * What the operating model contradicts about itself (ADR-0036 §2): every
 * responsibility not exactly one role's *A*, and every unit type that sits
 * nowhere. Only the organisation's model holds one, so a scope below has
 * nothing here; the organisation's home says them with the tree's.
 */
export function operatingModelFindings(scope: ScopePath, model: Pick<HostModel, 'unitTypes' | 'roles' | 'responsibilities'>): Finding[] {
  return [...accountabilityFindings(scope, model), ...nowhereFindings(scope, model)]
}

/**
 * Every responsibility of the operating model that is not exactly one role's
 * *A* (ADR-0036 §2). Only the organisation's model holds one, so a scope
 * below has nothing here.
 */
function accountabilityFindings(scope: ScopePath, model: Pick<HostModel, 'roles' | 'responsibilities'>): Finding[] {
  return accountabilityGaps(model.responsibilities ?? [], model.roles ?? []).map(({ responsibility, accountable }) => ({
    key: 'check.accountability',
    scope,
    id: responsibility.id,
    name: responsibility.name,
    ...(accountable.length ? { detail: accountable.map((role) => role.name).join(', '), fields: accountable.map((role) => role.id) } : {}),
  }))
}

/**
 * Every unit type of the operating model that sits nowhere: not at the top,
 * and in no unit type that sits anywhere, so no unit of it can be placed
 * without a finding of its own. Only the organisation's model holds one.
 */
function nowhereFindings(scope: ScopePath, model: Pick<HostModel, 'unitTypes'>): Finding[] {
  return unitTypeLanes(model.unitTypes ?? []).nowhere.map((type) => ({ key: 'check.unitTypeNowhere', scope, id: type.id, name: type.name }))
}

/**
 * A shape on a drawing whose element this scope does not hold.
 *
 * One per shape, in diagram order then link order. The tree knowing the id
 * is not enough: a drawing points at an element this scope holds, a
 * definition or a stand-in, and an id only another scope holds is missing
 * here.
 */
function drawingLinkFindings(scope: ScopePath, model: HostModel, held: ReadonlySet<ElementId>): Finding[] {
  const found: Finding[] = []
  for (const diagram of model.diagrams) {
    if (diagram.kind !== 'drawing') continue
    for (const link of diagram.drawing?.links ?? []) {
      if (held.has(link.elementId)) continue
      found.push({
        key: 'check.drawingLinkMissing',
        scope,
        id: `${diagram.id}:${link.shapeId}`,
        view: diagram.id,
        name: diagram.name,
        fields: [link.elementId],
        detail: link.elementId,
      })
    }
  }
  return found
}

/**
 * Every cause of this scope that explains an observation of a scope below
 * (ADR-0032 §9). The scope below explains its own observations, and this one
 * explains its causes, so the repair is to link the cause below that explains
 * the observation — named in `detail`, and its id after the observation's in
 * `fields`, where there is one.
 */
function causesOverObservationsBelow(scope: ScopePath, model: HostModel, index: ScopeIndex): Finding[] {
  const below = new Map(index.analysisBelow(scope).map((one) => [one.scope, one]))
  const found: Finding[] = []
  // A merged cause is history (ADR-0035 §4): what it still names contradicts nothing.
  for (const cause of liveCauses(model.causes ?? [])) {
    for (const link of cause.explains) {
      const there = link.scope === undefined ? undefined : below.get(link.scope)
      const observation = there?.observations.find((one) => one.id === link.id)
      if (!there || !observation) continue
      const local = liveCauses(there.causes).find((one) => one.explains.some((held) => held.id === observation.id && held.scope === undefined))
      found.push({
        key: 'check.causeExplainsObservationBelow', scope, id: cause.id, name: `${causeLabel(cause)} ${cause.title}`,
        scopes: [there.scope],
        fields: [observation.id, ...(local ? [local.id] : [])],
        ...(local ? { detail: `${causeLabel(local)} ${local.title}` } : {}),
      })
    }
  }
  return found
}

/**
 * What the organisation as it is contradicts on a day (ADR-0036 §3), read off
 * the index and nothing else: its units and assignments across the tree,
 * held against the operating model the organisation keeps. A unit's finding
 * is about the scope that answers for the unit, an assignment's about the
 * scope that keeps it, and a person over all of their time is a finding of
 * each scope that keeps one of their running assignments.
 *
 * `day` is today unless a caller looks at another (ADR-0027).
 */
export function organisationFindings(index: ScopeIndex, day: string = today()): Finding[] {
  return findingsOfOrganisation(organisationAt(index), day)
}

/**
 * The organisation, and where each of its parts is kept: what its findings
 * are worked out from and said about. Off the index for the whole tree; a
 * screen with a scope open lays that scope's live records over it, so what
 * was just changed is what is checked.
 */
export type OrganisationAt = {
  organisation: Organisation
  /** The scope that answers for a unit, and its name and type. */
  unitAt: (unitId: ElementId) => { scope: ScopePath; name: string; type: string } | undefined
  /** The scope that keeps an assignment. */
  assignmentAt: (assignment: Assignment) => ScopePath | undefined
  /**
   * How many applications name a unit as theirs (`partyId`): on a day, those
   * there by their lifecycle that day (ADR-0009); with none, every one.
   */
  owns: (unitId: ElementId, day?: string) => number
}


/** The organisation as the index has it. */
export function organisationAt(index: ScopeIndex): OrganisationAt {
  const units = new Map(index.units().map(({ scope, unit }) => [unit.id, { scope, name: unit.name, type: unit.unitTypeId ?? '' }]))
  const assignments = new Map<Assignment, ScopePath>(index.assignments().map(({ scope, assignment }) => [assignment, scope]))
  return {
    organisation: index.organisation(),
    unitAt: (id) => units.get(id),
    assignmentAt: (assignment) => assignments.get(assignment),
    owns: ownsOf(index.register()),
  }
}

/**
 * Every finding of an organisation on a day, each about the scope that
 * answers for what it is about. `canonical` maps a register id to the entry
 * a merge kept, where the caller holds the register, so a person kept under
 * two ids is one person over all of their time (ADR-0036 §9).
 */
export function findingsOfOrganisation(at: OrganisationAt, day: string, canonical?: (id: string) => string): Finding[] {
  const { organisation } = at
  if (organisation.units.length === 0 && organisation.assignments.length === 0) return []
  const said: Said = {
    at,
    typeName: new Map(organisation.unitTypes.map((type) => [type.id, type.name])),
    roleName: new Map(organisation.roles.map((role) => [role.id, role.name])),
  }
  return unitFindings(organisation, day, { owns: at.owns, ...(canonical ? { canonical } : {}) }).flatMap((one) => organisationFinding(one, said))
}

/** What a finding of the organisation is said with: where each unit and assignment is kept, and what things are called. */
type Said = {
  at: OrganisationAt
  typeName: ReadonlyMap<string, string>
  roleName: ReadonlyMap<string, string>
}

/** One of `model/units.ts`'s findings, as the findings of the scopes it is about. */
function organisationFinding(found: UnitFinding, said: Said): Finding[] {
  if (found.kind === 'overloaded') {
    const scopes = [...new Set(found.assignments.map((one) => said.at.assignmentAt(one)).filter((one): one is ScopePath => one !== undefined))]
    return scopes.sort().map((scope) => ({
      key: 'check.personOverloaded', scope, id: found.person, name: found.person, person: found.person,
      count: Math.round(found.load * 100),
    }))
  }
  const unit = said.at.unitAt(found.unitId)
  const type = said.typeName.get(unit?.type ?? '') ?? ''
  const at = { scope: unit?.scope ?? '', id: found.unitId, name: unit?.name ?? found.unitId }
  switch (found.kind) {
    case 'vacant':
      return [{ key: 'check.roleVacant', ...at, detail: said.roleName.get(found.roleId) ?? found.roleId, fields: [found.roleId], count: found.held, limit: found.min }]
    case 'overMax':
      return [{ key: 'check.roleOverMax', ...at, detail: said.roleName.get(found.roleId) ?? found.roleId, fields: [found.roleId], count: found.held, limit: found.max }]
    case 'misplaced':
      return [{ key: 'check.unitMisplaced', ...at, detail: type, ...(found.parentType ? { fields: [found.parentType] } : {}) }]
    case 'spans':
      return [{ key: 'check.unitSpans', ...at, detail: type, count: found.serves }]
    case 'overLimit':
      return [{ key: 'check.unitOverLimit', ...at, detail: type, count: found.owns, limit: found.limit }]
    case 'endedUnit':
    case 'endedRole':
      return [{
        key: 'check.assignmentEnded', ...at, scope: said.at.assignmentAt(found.assignment) ?? at.scope,
        detail: said.roleName.get(found.assignment.roleId) ?? found.assignment.roleId, fields: [found.assignment.id],
      }]
    case 'endedType':
      return [{ key: 'check.unitTypeEnded', ...at, detail: type, fields: [found.unitTypeId] }]
  }
}

/** Every finding about one scope: the tree's about it, then its document's. */
export function scopeFindings(deps: {
  scope: ScopePath
  model: HostModel
  index: ScopeIndex
  business?: BusinessFindings
}): Finding[] {
  return [
    ...identityFindings(deps.index).filter((finding) => finding.scope === deps.scope),
    ...organisationFindings(deps.index).filter((finding) => finding.scope === deps.scope),
    ...documentFindings(deps),
  ]
}

/**
 * Findings grouped by the scope they are about — what a tree of rows reads.
 *
 * A `Map` and not an object: a scope path can be the empty string, and an
 * object keyed by one reads as a bug every time somebody meets it.
 */
export function findingsByScope(findings: readonly Finding[]): Map<ScopePath, Finding[]> {
  const found = new Map<ScopePath, Finding[]>()
  for (const finding of findings) {
    const held = found.get(finding.scope) ?? []
    held.push(finding)
    found.set(finding.scope, held)
  }
  return found
}

/**
 * How many of each — what a finding LINE says, as opposed to a finding list.
 *
 * Information is counted like everything else; which keys a line chooses to
 * mention is the screen's business, and a tally that left one out would make
 * two screens disagree about the same tree.
 */
export function tally(findings: readonly Finding[]): Partial<Record<CheckKey, number>> {
  const found: Partial<Record<CheckKey, number>> = {}
  for (const finding of findings) found[finding.key] = (found[finding.key] ?? 0) + 1
  return found
}

/**
 * Is this element drawn on a view in this scope?
 *
 * A board's member, a drawing in this scope that points at it, or a service
 * or platform where the scope has a technology landscape.
 */
function drawnIn(model: HostModel, id: ElementId): boolean {
  if (model.diagrams.some((diagram) => diagram.members.some((member) => member.id === id))) return true
  if (model.diagrams.some((diagram) =>
    diagram.kind === 'drawing' && (diagram.drawing?.links ?? []).some((link) => link.elementId === id))) return true
  // A technology landscape draws every service and platform the scope holds
  // (ADR-0015), so one of those is drawn wherever the scope has the view.
  const kind = model.elements.find((element) => element.id === id)?.kind
  return (kind === 'platform' || kind === 'platformService')
    && model.diagrams.some((diagram) => diagram.kind === 'technology')
}

/** A dangling row, named by its label or by the two ends it claims to join. */
function nameOf(model: HostModel, relationId: string, end: ElementId): string {
  const relation = model.relations.find((held) => held.id === relationId)
  if (relation?.label) return relation.label
  const named = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? id
  return relation ? `${named(relation.sourceId)} → ${named(relation.targetId)}` : end
}
