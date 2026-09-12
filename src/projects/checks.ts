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
 *   holds, a master drawn nowhere, and the two the business layer already
 *   answers. Paid by the scope that is open, once per model.
 *
 * **Why `business/`'s two arrive as an argument.** `unmappedFunctions` and
 * `coverageOf` stay where they are — they are the business layer's arithmetic
 * and the sheet draws them — but `projects` sits *below* `business` in the
 * import matrix and may not reach up for them. So the caller that has both (a
 * page, which may import either) computes them and hands the two lists in.
 * That is the same rule the index follows in the other direction, and it keeps
 * this module testable with two plain arrays.
 */
import type { StringKey } from '../i18n'
import { OWNER_DETAIL } from '../model'
import type { DesignElement, ElementId, OwnerDetailField } from '../model'
import type { HostModel } from '../model/fromInterchange'
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
  /** A function assigned to nobody and claimed by nobody. */
  | 'check.unmapped'
  /** A function with no `supports` and no `assigned`: nothing and nobody does it. */
  | 'check.uncovered'

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
  'check.unmapped': 'check.unmapped',
  'check.uncovered': 'check.uncovered',
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
  'check.unmapped': { one: 'check.short.unmapped.one', other: 'check.short.unmapped.other' },
  'check.uncovered': { one: 'check.short.uncovered.one', other: 'check.short.uncovered.other' },
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
  /** True where this is worth knowing and is not a fault. See {@link CheckKey}. */
  information?: true
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
    }
  }
  return found
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
      const fields = OWNER_DETAIL.filter((field) => detailSaidOn(element, field))
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
    // A master no view in its own scope draws. Information: a record and a
    // drawing are two acts (§10), and a master with no view is ordinary.
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
  return found
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

/** Is this element a member of any view in this scope? */
function drawnIn(model: HostModel, id: ElementId): boolean {
  return model.diagrams.some((diagram) => diagram.members.some((member) => member.id === id))
}

/** A dangling row, named by its label or by the two ends it claims to join. */
function nameOf(model: HostModel, relationId: string, end: ElementId): string {
  const relation = model.relations.find((held) => held.id === relationId)
  if (relation?.label) return relation.label
  const named = (id: ElementId) => model.elements.find((held) => held.id === id)?.name ?? id
  return relation ? `${named(relation.sourceId)} → ${named(relation.targetId)}` : end
}
