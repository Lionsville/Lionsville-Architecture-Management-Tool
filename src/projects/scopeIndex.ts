// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One identity across the organisation: who owns an id, and who else draws it
 * (ADR-0012 §2).
 *
 * An element id is unique across the whole tree rather than within one
 * document, and that single change is what makes federation cheap: a domain
 * drawing another domain's ERP writes a record with **the same id**, so there
 * is no join table, no alias, and no `{scope, id}` pair to resolve. What it
 * costs is this — an index over every scope's `model.json`, computed once per
 * open and again whenever the watcher says the folder changed.
 *
 * **Everything organisation-wide is derived, and nothing is stored.** There is
 * no register file, no owner field and no materialised list: a list every
 * domain edits is a merge conflict every domain edits, and a derived one is
 * right by construction. That is the same choice groups-derived-from-projects
 * was, for the same reason.
 *
 * **Three things one record can be**, told apart by what it carries and never
 * by a type field (§3):
 *
 * - a **definition** — no `ref`. The deepest one in the tree is the **master**:
 *   that scope answers for the thing, and its name is the name.
 * - a **declaration** — a definition above the master. The thin first layer,
 *   `{ id, kind, name }`, which names the thing until somebody deeper takes it
 *   and is a cache from then on. It yields; it never overrules.
 * - a **stand-in** — `ref` present. Drawn here, defined there.
 *
 * One rule therefore serves two opposite directions of authority, which is the
 * point. Business functions are top-down: the organisation defines
 * `fulfilment`, a domain refines it by holding a stand-in with children under
 * it, so the organisation's record stays the deepest and the name stays the
 * organisation's. Applications are bottom-up: retail defines `erp`, that is the
 * master, and a rename there is retail's to make.
 *
 * **Uniqueness is a check, not a refusal.** Two scopes that each define `erp`
 * are a conflict *finding* — somebody is mid-migration, or two teams named the
 * same thing on the same afternoon — and a tool that refused the second
 * definition would refuse the state every real merge goes through. The findings
 * themselves are `checks.ts`; this file only says what is true.
 *
 * **Why it lives in `projects/` and not in `model/`.** The whole of it is
 * arithmetic over paths, and what a path IS belongs here: depth is the rule
 * that decides a master, and `model/` may not know that a scope exists. The
 * cost is that `agent/`, which may not import `projects`, cannot name this type
 * — so it declares the lookups it needs and is handed them, the way it is
 * handed a `RendererView`.
 *
 * Pure: `(path, model)` pairs in, answers out. No store, no React, no promise.
 */
import type {
  DesignElement, ElementId, ElementKind, Lifecycle, LifecycleDates, PlatformArchetype, Relation, RelationType,
} from '../model'
import { DATED_PHASES, isDay } from '../model/lifecycle'
import { isBlankRef } from '../model/person'
import type { PersonRef } from '../model/person'
import type { Transition } from '../model/transition'
import type { CauseAbove, ScopeAnalysis } from '../model/observation'
import type { OperatingRule, Responsibility, Role, UnitType } from '../model/operatingModel'
import { isUnit } from '../model/units'
import type { Assignment, Organisation, UnitMove } from '../model/units'
import type { Citation } from '../model/citable'
import type { Evaluation } from '../model/evaluation'
import type { Principle, PrincipleGroup } from '../model/principle'
import type { KeptCheckMark } from '../model/checkMarks'
import { ShellError } from '../platform/errors'
import { flattenScopes } from './scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from './scope'
import { scopeSegments } from './scopePath'
import type { ScopePath } from './scopePath'

/**
 * What the tree knows about one id.
 *
 * `name` and `kind` come from the master where there is one, and from a
 * stand-in's cache where there is not — a dangling id is still worth naming on
 * screen, and the cached name is the only name anybody wrote down.
 */
export type IndexEntry = {
  id: ElementId
  kind: ElementKind
  /** The authoritative name: the master's, or a cache where nobody defines it. */
  name: string
  /**
   * The deepest scope that defines it — the scope that answers for it.
   *
   * Absent when no scope in the tree holds a definition, which is the dangling
   * case: every record of it is a stand-in of something nobody has written
   * down. *Link* is how such a record gets a master (§10); until then it is a
   * finding and never a refusal.
   */
  master?: ScopePath
  /**
   * What the master files it under — a namespace under a cluster, a component
   * under its application.
   *
   * The master's, because the tree is a fact about the thing and a stand-in
   * may not carry one (§3): a landscape hosting its containers in a namespace
   * draws a stand-in of the namespace and reads what it sits in from here.
   */
  parentId?: ElementId
  /**
   * Definitions above the master, deepest first — the thin layer that yields.
   *
   * The master is not in here. A tree with one definition therefore has an
   * empty list, which is the ordinary case for both directions of authority.
   */
  declarations: ScopePath[]
  /** Every scope holding a stand-in of it, in path order: who else draws it. */
  drawnIn: ScopePath[]
  /**
   * Scopes whose cached `name` or `ref` disagrees with the master — the drift
   * of §2's table, said here because it is a fact about the tree rather than
   * an opinion about it.
   *
   * Stand-ins AND declarations: a declaration is the thin first layer that
   * yielded when somebody deeper took the id, and from that moment its name is
   * a cache like any other. A refresh rewrites them; a person does not.
   *
   * Empty is the ordinary case, and it is empty rather than absent because
   * every reader folds over it.
   */
  stale: ScopePath[]
  /**
   * Two or more definitions at the master's own depth, in path order.
   *
   * Absent is ordinary and present is a finding on every scope named. The
   * master is the first of them by path, so that everything else in this index
   * still has one answer while a person decides which of the two to turn into
   * a stand-in.
   */
  conflict?: ScopePath[]
  /**
   * Every scope that defines this id, in path order, where some define a unit
   * and others something that is not one (3.7.5): two different things under
   * one id. Absent is ordinary. The master above stays the deepest whatever
   * its kind, and the organisation reads the unit from its own deepest
   * definition (`units`), so neither hides the other while a person decides
   * which keeps the id.
   */
  kindClash?: ScopePath[]
  /**
   * Nobody in this organisation owns it, as the master's record says (§4).
   *
   * Here rather than looked up per row, because the register draws it for
   * every application in the tree and the index has already read every record
   * to build this. The same reasoning as `name`: what is cheap in the one pass
   * is expensive as a load per card.
   */
  outside?: true
  /** Which actor an outside application belongs to, where that has been said. */
  partyId?: ElementId
  /**
   * Who answers for it, as its master says (ADR-0036 §8): a person picked
   * from the register, by id, or text as typed. A stand-in carries no owner
   * of its own (§3), so a scope drawing the thing shows the master's from
   * here — the id, which the register names; never a name the register
   * holds.
   */
  owner?: PersonRef
  /**
   * What a platform is, as its master says (ADR-0014). A stand-in carries
   * nothing the owner answers for, so a landscape drawing the cluster reads
   * whether it is a place from here, the way it reads what it is filed under.
   */
  platformArchetype?: PlatformArchetype
  /** A service offered beyond the team that maintains it, as its master says (ADR-0014). */
  shared?: true
  /**
   * The day it is gone, as its master's `lifecycleDates.retired` says
   * (ADR-0009). A stand-in carries no dates of its own (§3), so a landscape
   * standing on another scope's cluster reads the day the cluster goes from
   * here — what `model/liveness.ts` is handed as `retiredOf`. Only the day,
   * and only a real one: the rest of the lifecycle stays the master's to show.
   */
  retired?: string
  /**
   * Its phase as its master stores it, where that is not `live`, and its
   * dated phases, where it has any (ADR-0009): what says whether it is there
   * on a day (`lifecycle.phaseAt`) where the master is in another scope — a
   * Conway map on its day reads an application of another scope's this way.
   * For that question only; what a card shows is still the master's.
   */
  lifecycle?: Exclude<Lifecycle, 'live'>
  lifecycleDates?: LifecycleDates
  /**
   * Where the stand-ins say the definition was last seen — kept ONLY where
   * nobody defines it (§3).
   *
   * A dangling id has no master to point at, and the cached `ref` on its
   * stand-ins is the one address anybody wrote down. A scope drawing such a
   * thing from the register carries the same address, so that every record
   * of it keeps saying the same thing until *link* or a definition settles it.
   * Absent as soon as there is a master, because then the master's path is
   * the answer and a second one would be a second answer.
   */
  cachedRef?: string
}

/** One row, and the scope whose `model.json` holds it. */
export type IndexedRelation = { scope: ScopePath; relation: Relation }
/**
 * A plan another scope filed, with where — and the elements it names, as
 * that scope holds them.
 *
 * Carried here because a roadmap above draws the plan's band and has nothing
 * else to draw it from: what the plan introduces and retires are that scope's
 * elements, with that scope's dates on them, and this model does not hold
 * them. Only the ones the plan names, in the plan's order; an id the scope
 * has no record for is left out rather than drawn as a blank.
 */
export type IndexedTransition = {
  scope: ScopePath
  transition: Transition
  elements: readonly DesignElement[]
}

/**
 * One scope's analysis as a scope above reads it (ADR-0032 §1): its own
 * observations, causes, solutions and experiments, in number order.
 */
export type IndexedAnalysis = ScopeAnalysis & { scope: ScopePath }

/** A unit, as the scope that answers for it holds it (ADR-0036 §3): an actor with a type. */
export type IndexedUnit = { scope: ScopePath; unit: DesignElement }

/** An assignment, and the scope that keeps it: its unit's (ADR-0036 §4). */
export type IndexedAssignment = { scope: ScopePath; assignment: Assignment }

/**
 * A finding marked as intended, and the scope that keeps it: the scope the
 * finding is about (ADR-0036, amended). `model/checkMarks`'s `KeptCheckMark`.
 */
export type IndexedCheckMark = KeptCheckMark

/** A unit put under another parent on a day by a plan (ADR-0036 §6), and the plan that does it and the scope that keeps that plan. */
export type IndexedMove = { scope: ScopePath; plan: { id: string; number: number }; move: UnitMove }

/**
 * An actor a plan introduces or retires (ADR-0036 §6), the plan and the scope
 * that keeps it: what the organisation chart names beside a unit's first and
 * last day. Actors only — a unit is an actor with a type — so the index does
 * not carry every element every plan names.
 */
export type IndexedUnitPlan = { scope: ScopePath; plan: { id: string; number: number }; unitId: ElementId; role: 'introduces' | 'retires' }

/** The operating model as the organisation keeps it (ADR-0036 §2): each list, in the organisation's order. */
export type IndexedOperatingModel = {
  unitTypes: readonly UnitType[]
  roles: readonly Role[]
  responsibilities: readonly Responsibility[]
  operatingRules: readonly OperatingRule[]
}

const NO_OPERATING_MODEL: IndexedOperatingModel = { unitTypes: [], roles: [], responsibilities: [], operatingRules: [] }

/**
 * Where an observation was folded into another scope's (ADR-0021): the scope
 * above that absorbed it, and the observation there that stands for it now.
 */
export type Absorption = {
  /** The scope the absorbed observation lives in, and its id there. */
  scope: ScopePath
  id: string
  /** The scope that absorbed it, and the observation it went into. */
  by: ScopePath
  into: string
  /** What that observation is called, for the line the scope below shows. */
  intoTitle: string
  date: string
}

/**
 * The answers, over a tree that has already been read.
 *
 * Functions rather than exposed maps, because two of them are derived orders
 * (`register`, `entries`) and one is a set the id policy is handed every time
 * it mints a key. Everything is computed once in {@link indexScopes}; nothing
 * here walks the tree again.
 */
export type ScopeIndex = {
  /** What the tree knows about one id, or `undefined` if it has never seen it. */
  lookup(id: ElementId): IndexEntry | undefined
  /**
   * Every application in the organisation, by name — the derived register of
   * §2, which the register page reads and nothing commits.
   *
   * Applications only, and deliberately: a function's name and an
   * application's name have nothing to do with each other, and a register that
   * mixed them would be a list of two things.
   */
  register(): IndexEntry[]
  /** Every entry, in id order. What the checks walk. */
  entries(): IndexEntry[]
  /**
   * Every id spoken for anywhere in the tree — elements and rows both, because
   * they share a document's namespace (`model/keys.ts`).
   *
   * What {@link ../model/keys.idPolicy} is handed, so a new element drawn in
   * one scope cannot take a name a sibling has used.
   *
   * The index's own set rather than a copy of it, because minting a key asks
   * for it and copying a hundred thousand ids per ask would be the shape the
   * budget line watches for. Nothing may write to it; `idPolicy` takes its own
   * copy before adding what it has handed out.
   */
  takenIds(): Set<string>
  /**
   * Every row in the tree that points AT this id, wherever it was written.
   *
   * The cross-scope half of coverage (§9): the applications supporting a
   * capability defined at the organisation are in a landscape's model, so a
   * sheet drawn at the root has to read rows it does not hold. Per id rather
   * than as one list of every row, so a page pays for the functions it draws.
   */
  rowsTo(id: ElementId, types?: readonly RelationType[]): IndexedRelation[]
  /**
   * Every row in the tree with this id at EITHER end, wherever it was written
   * — what an overview drawing a stand-in imports the interfaces from.
   */
  rowsOf(id: ElementId): IndexedRelation[]
  /**
   * The initiatives filed in the scopes under this one (ADR-0012 §7): every
   * plan marked `initiative` in a scope strictly below `path`, by scope and
   * then by number. What a roadmap draws under its own plans, and what the
   * organisation screen's card counts.
   */
  initiativesBelow(path: ScopePath): IndexedTransition[]
  /**
   * The analysis of every scope strictly below `path` (ADR-0032 §1), one
   * entry per scope that has any, in path order: local to those scopes, and
   * read here with nothing shared first. Which of them a session may read is
   * the source's answer; an index is built over what the source read.
   */
  analysisBelow(path: ScopePath): IndexedAnalysis[]
  /**
   * The analysis of every scope read, in path order — above, below and
   * beside alike. What the merge screen searches when it searches across
   * scopes (ADR-0035 §2): the records of the scopes the source let this
   * session read, causes and solutions as well as observations.
   */
  analyses(): IndexedAnalysis[]
  /**
   * A scope's principles and its groups of them (ADR-0041), by number and in
   * the scope's order; both empty where it keeps none. What every scope below
   * reads as *From <scope>*, and a scope a topic is relevant to as the
   * topic's (ADR-0042).
   */
  principlesAt(path: ScopePath): ScopePrinciples
  /**
   * Every citation of a principle, by any scope's records, with the scope
   * that keeps it (ADR-0041 §7): how a principle is used is counted across
   * the tree, and a principle something cites is not removed.
   */
  citations(): readonly KeptCitation[]
  /**
   * Every building block defined anywhere, with the scope that keeps it, in
   * path order (ADR-0043 §8): what the register of building blocks lists.
   * A stand-in of one is not a second block.
   */
  buildingBlocks(): readonly KeptBlock[]
  /** Every scope's evaluations of building blocks, with the scope that evaluates (ADR-0043 §4, §8). */
  evaluations(): readonly KeptEvaluation[]
  /** Every scope that keeps principles or groups of them, in path order. */
  principleScopes(): readonly ScopePath[]
  /**
   * What the scopes above `path` say explains its records (ADR-0032 §4), by
   * the id of the record explained: every cause above whose link names a
   * record of `path`. Derived from the explaining cause, because the link is
   * written where that cause lives and the scope below is only told.
   */
  explainedFromAbove(path: ScopePath): Map<string, CauseAbove[]>
  /**
   * The observations of `path` that a scope above folded into one of its own
   * (ADR-0021), by id — derived from the absorbing scope's history, because a
   * record is written where it lives and the scope below is only told.
   */
  absorbedFrom(path: ScopePath): Map<string, Absorption>
  /**
   * Every unit in the organisation (ADR-0036 §3), as the scope that answers
   * for it holds it, in id order — the derived register of units, as
   * {@link register} is of applications. A stand-in of a unit is not one.
   */
  units(): IndexedUnit[]
  /**
   * Every assignment in the organisation (ADR-0036 §4), scope by scope in
   * path order and in each scope's own order. Ids only: who a person is, is
   * the register's to say.
   */
  assignments(): IndexedAssignment[]
  /**
   * Every finding marked as intended in the organisation (ADR-0036, amended),
   * scope by scope in path order and in each scope's own order: what a list
   * of findings is split by (`model/checkMarks.splitMarked`), so a mark kept
   * in a scope below silences the finding where the organisation lists it.
   */
  checkMarks(): IndexedCheckMark[]
  /**
   * The operating model (ADR-0036 §2), as the organisation — the root scope
   * — keeps it; empty lists where it keeps none, or was not read.
   */
  operatingModel(): IndexedOperatingModel
  /**
   * Every unit a plan moves under another parent on a day (ADR-0036 §6),
   * plan by plan in each scope's own order, scope by scope in path order: the
   * moves of every plan that was not abandoned.
   */
  moves(): IndexedMove[]
  /**
   * Every actor a plan introduces or retires (ADR-0036 §6), plan by plan in
   * each scope's own order, scope by scope in path order: every plan's but
   * an abandoned one's.
   */
  unitPlans(): IndexedUnitPlan[]
  /**
   * The units, the assignments, the operating model and the plans' moves
   * together: what `model/units.ts` asks its questions of — who manages a
   * unit, what the organisation contradicts on a day — and what
   * `organisationOn` reads a day of.
   */
  organisation(): Organisation
  /** The scopes this was built from, in path order. */
  scopes(): ScopePath[]
  /**
   * The type each scope says it is from the operating model (ADR-0036,
   * amended 17 October 2026), by path: a unit type's id, for the scopes whose
   * header says one and whose store read it.
   */
  scopeTypes(): ReadonlyMap<ScopePath, string>
}

/**
 * What an entry carries of its master's own detail — the tree facts (§3) a
 * stand-in may not carry and every scope drawing the thing reads from here.
 */
type MasterDetail = Pick<
  IndexEntry, 'parentId' | 'outside' | 'partyId' | 'owner' | 'platformArchetype' | 'shared' | 'retired' | 'lifecycle' | 'lifecycleDates'
>

/**
 * Those fields off a record, each only where it says something: an entry
 * with a field present and empty is not what the master wrote. Read from a
 * definition as it is indexed and again from the master as the entry is
 * built, so the list of fields is said once.
 */
function masterDetailOf(held: {
  parentId?: ElementId; outside?: boolean; partyId?: ElementId; owner?: PersonRef; platformArchetype?: PlatformArchetype
  shared?: boolean; retired?: string; lifecycle?: Lifecycle; lifecycleDates?: LifecycleDates
}): MasterDetail {
  const retired = held.retired ?? held.lifecycleDates?.retired
  const dated = DATED_PHASES.filter((phase) => isDay(held.lifecycleDates?.[phase]))
  return {
    ...(held.parentId !== undefined ? { parentId: held.parentId } : {}),
    ...(held.outside ? { outside: true as const } : {}),
    ...(held.partyId !== undefined ? { partyId: held.partyId } : {}),
    ...(held.owner !== undefined && !isBlankRef(held.owner) ? { owner: held.owner } : {}),
    ...(held.platformArchetype !== undefined ? { platformArchetype: held.platformArchetype } : {}),
    ...(held.shared ? { shared: true as const } : {}),
    ...(isDay(retired) ? { retired } : {}),
    ...(held.lifecycle !== undefined && held.lifecycle !== 'live' ? { lifecycle: held.lifecycle } : {}),
    ...(dated.length ? { lifecycleDates: Object.fromEntries(dated.map((phase) => [phase, held.lifecycleDates![phase]])) } : {}),
  }
}

/** An index over nothing: what a session has before anything has been read. */
export const EMPTY_INDEX: ScopeIndex = indexScopes([])

/**
 * Build the index from every scope's records and rows.
 *
 * One pass per list into three maps. The depth of a path is worked out once per
 * scope rather than once per record, and no entry is ever searched for — both
 * because this is paid on every open over a whole organisation, and an
 * ancestor walk per element would not show at all on one scope (ADR-0004's
 * budget line is `index`).
 *
 * Later scopes do not overwrite earlier ones: which definition is the master is
 * decided by depth and then by path, so the answer does not depend on the order
 * a store happened to enumerate its folders in.
 */
/** A building block, with the scope that keeps it (ADR-0043 §1). */
export type KeptBlock = { readonly scope: ScopePath; readonly block: DesignElement }

/** An evaluation of a building block, with the scope that evaluates it (ADR-0043 §4). */
export type KeptEvaluation = { readonly scope: ScopePath; readonly evaluation: Evaluation }

/** A scope's building blocks and its evaluations, each with the path. */
function keepBlocks(blocks: KeptBlock[], evaluations: KeptEvaluation[], path: ScopePath, model: ScopeModel['model']): void {
  for (const element of model.elements) if (element.kind === 'buildingBlock' && element.ref === undefined) blocks.push({ scope: path, block: element })
  for (const evaluation of model.evaluations ?? []) evaluations.push({ scope: path, evaluation })
}

/** A citation, with the scope that keeps the record that cites. */
export type KeptCitation = { readonly scope: ScopePath; readonly citation: Citation }

/** One scope's principles and groups, as the index reads them (ADR-0041). */
export type ScopePrinciples = { readonly principles: readonly Principle[]; readonly groups: readonly PrincipleGroup[] }

const NO_PRINCIPLES: ScopePrinciples = { principles: [], groups: [] }

/** A scope's principles and groups kept by its path, in number order, where it has either; and its citations, each with the path. */
function keepPrinciples(kept: Map<ScopePath, ScopePrinciples>, cited: KeptCitation[], path: ScopePath, model: ScopeModel['model']): void {
  for (const citation of model.citations ?? []) cited.push({ scope: path, citation })
  if (!model.principles?.length && !model.principleGroups?.length) return
  kept.set(path, { principles: [...(model.principles ?? [])].sort((a, b) => a.number - b.number), groups: model.principleGroups ?? [] })
}

export function indexScopes(models: readonly ScopeModel[]): ScopeIndex {
  type Held = {
    id: ElementId
    definitions: Definition[]
    standIns: { path: ScopePath; kind: ElementKind; name: string; ref: string }[]
  }

  type Definition = { path: ScopePath; depth: number; kind: ElementKind; name: string; unit: boolean } & MasterDetail

  const held = new Map<ElementId, Held>()
  const taken = new Set<string>()
  const incoming = new Map<ElementId, IndexedRelation[]>()
  const touching = new Map<ElementId, IndexedRelation[]>()
  const paths: ScopePath[] = []
  const principles = new Map<ScopePath, ScopePrinciples>()
  const citations: KeptCitation[] = []
  const blocks: KeptBlock[] = []
  const evaluations: KeptEvaluation[] = []
  // The type each scope says it is from the operating model (ADR-0036, amended 17 October 2026).
  const scopeTypes = new Map<ScopePath, string>(models.flatMap((one) => (one.unitTypeId !== undefined ? [[one.path, one.unitTypeId] as const] : [])))
  const initiatives: IndexedTransition[] = []
  const analyses: IndexedAnalysis[] = []
  const absorptions: Absorption[] = []
  const fromAbove = new Map<ScopePath, Map<string, CauseAbove[]>>()
  const unitDefinitions: IndexedUnit[] = []
  const assignments: IndexedAssignment[] = []
  const checkMarks: IndexedCheckMark[] = []
  const moves: IndexedMove[] = []
  const unitPlans: IndexedUnitPlan[] = []
  let operating = NO_OPERATING_MODEL

  const at = (id: ElementId): Held => {
    const found = held.get(id) ?? { id, definitions: [], standIns: [] }
    held.set(id, found)
    return found
  }

  for (const { path, model } of [...models].sort((a, b) => a.path.localeCompare(b.path))) {
    paths.push(path)
    const depth = scopeSegments(path).length
    for (const element of model.elements) {
      taken.add(element.id)
      const row = at(element.id)
      if (element.ref === undefined) {
        row.definitions.push({ path, depth, kind: element.kind, name: element.name, unit: isUnit(element), ...masterDetailOf(element) })
        if (isUnit(element)) unitDefinitions.push({ scope: path, unit: element })
      } else {
        row.standIns.push({ path, kind: element.kind, name: element.name, ref: element.ref })
      }
    }
    for (const relation of model.relations) {
      taken.add(relation.id)
      const row = { scope: path, relation }
      const rows = incoming.get(relation.targetId) ?? []
      rows.push(row)
      incoming.set(relation.targetId, rows)
      for (const end of new Set([relation.sourceId, relation.targetId])) {
        const held = touching.get(end) ?? []
        held.push(row)
        touching.set(end, held)
      }
    }
    initiatives.push(...initiativesOf(path, model))
    const analysis = analysisOf(path, model)
    if (analysis) {
      analyses.push(analysis)
      readAcross(analysis, absorptions, fromAbove)
    }
    for (const assignment of model.assignments ?? []) assignments.push({ scope: path, assignment })
    checkMarks.push(...checkMarksOf(path, model))
    moves.push(...movesOf(path, model))
    unitPlans.push(...unitPlansOf(path, model))
    if (path === '') operating = operatingOf(model)
    keepPrinciples(principles, citations, path, model)
    keepBlocks(blocks, evaluations, path, model)
  }

  const entries = new Map<ElementId, IndexEntry>()
  for (const row of held.values()) {
    // Deepest first, then by path, so the master of a tie is the same scope
    // whatever order the store listed them in.
    const definitions = [...row.definitions]
      .sort((a, b) => b.depth - a.depth || a.path.localeCompare(b.path))
    const master = definitions[0]
    const tied = definitions.filter((one) => one.depth === master?.depth)
    // A name nobody defines is the cache somebody wrote down, which is better
    // than the id and is the only name a dangling record has.
    const named = master ?? row.standIns[0]
    // A cache is only stale against a master; with no definition anywhere
    // there is nothing for one to disagree with, and the finding is that
    // nobody defines it at all (dangling) rather than that the copy is old.
    const stale = master === undefined ? [] : [
      ...row.standIns.filter((one) => one.name !== master.name || one.ref !== master.path),
      // A declaration carries a name and no `ref` — there is nothing for it to
      // point at, so only the name can have gone stale.
      ...definitions.slice(tied.length).filter((one) => one.name !== master.name),
    ].map((one) => one.path).sort()
    entries.set(row.id, {
      id: row.id,
      kind: named?.kind ?? 'application',
      name: named?.name ?? row.id,
      ...(master ? { master: master.path } : {}),
      declarations: definitions.slice(tied.length).map((one) => one.path),
      // The master's, not the tree's: a declaration above it is a cache, and
      // a stand-in may not carry any of these at all (§3).
      ...(master ? masterDetailOf(master) : {}),
      ...(master === undefined && row.standIns[0] !== undefined ? { cachedRef: row.standIns[0].ref } : {}),
      drawnIn: row.standIns.map((one) => one.path),
      stale,
      ...(tied.length > 1 ? { conflict: tied.map((one) => one.path).sort() } : {}),
      ...kindClashOf(definitions),
    })
  }

  const inIdOrder = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id))
  const units = unitsAtTheirMaster(unitDefinitions)
  const organisation = organisationOf(units, assignments, operating, moves)

  return {
    lookup: (id) => entries.get(id),
    register: () => inIdOrder
      .filter((entry) => entry.kind === 'application')
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    entries: () => inIdOrder,
    takenIds: () => taken,
    rowsTo: (id, types) => {
      const rows = incoming.get(id) ?? []
      return types ? rows.filter((row) => types.includes(row.relation.type)) : [...rows]
    },
    rowsOf: (id) => [...(touching.get(id) ?? [])],
    initiativesBelow: (path) => initiatives.filter(({ scope }) => (
      path === '' ? scope !== '' : scope.startsWith(`${path}/`)
    )),
    analysisBelow: (path) => analyses.filter(({ scope }) => (
      path === '' ? scope !== '' : scope.startsWith(`${path}/`)
    )),
    analyses: () => [...analyses],
    principlesAt: (path) => principles.get(path) ?? NO_PRINCIPLES,
    citations: () => citations,
    buildingBlocks: () => [...blocks].sort((a, b) => a.scope.localeCompare(b.scope) || a.block.name.localeCompare(b.block.name)),
    evaluations: () => evaluations,
    principleScopes: () => [...principles.keys()].sort(),
    explainedFromAbove: (path) => new Map(fromAbove.get(path) ?? []),
    absorbedFrom: (path) => {
      const found = new Map<string, Absorption>()
      for (const one of absorptions) if (one.scope === path && !found.has(one.id)) found.set(one.id, one)
      return found
    },
    units: () => [...units],
    assignments: () => [...assignments],
    checkMarks: () => [...checkMarks],
    operatingModel: () => operating,
    moves: () => [...moves],
    unitPlans: () => [...unitPlans],
    organisation: () => organisation,
    scopes: () => [...paths],
    scopeTypes: () => scopeTypes,
  }
}

/**
 * Every scope that defines an id, where some define a unit and others
 * something that is not one (3.7.5); nothing otherwise.
 */
function kindClashOf(definitions: readonly { path: ScopePath; unit: boolean }[]): { kindClash?: ScopePath[] } {
  return definitions.some((one) => one.unit) && definitions.some((one) => !one.unit)
    ? { kindClash: [...new Set(definitions.map((one) => one.path))].sort() } : {}
}

/**
 * Each unit where its deepest definition as a unit is — the master among
 * units, a tie to the first path: a declaration above it is a cache, and a
 * record of another kind under the same id (`kindClash`) does not take it
 * away. In id order.
 */
function unitsAtTheirMaster(definitions: readonly IndexedUnit[]): IndexedUnit[] {
  const deepest = new Map<ElementId, { scope: ScopePath; depth: number }>()
  for (const { scope, unit } of definitions) {
    const depth = scopeSegments(scope).length
    const held = deepest.get(unit.id)
    if (!held || depth > held.depth || (depth === held.depth && scope.localeCompare(held.scope) < 0)) deepest.set(unit.id, { scope, depth })
  }
  return definitions
    .filter(({ scope, unit }) => deepest.get(unit.id)?.scope === scope)
    .sort((a, b) => a.unit.id.localeCompare(b.unit.id))
}

/** A scope's findings marked as intended, each with the scope that keeps it, in the scope's order. */
function checkMarksOf(path: ScopePath, model: ScopeModel['model']): IndexedCheckMark[] {
  return (model.checkMarks ?? []).map((mark) => ({ scope: path, mark }))
}

/** The plans a scope flags as initiatives, by number, each with the elements it names as the scope holds them. */
function initiativesOf(path: ScopePath, model: ScopeModel['model']): IndexedTransition[] {
  const flagged = (model.transitions ?? []).filter((transition) => transition.initiative)
  if (flagged.length === 0) return []
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  return [...flagged].sort((a, b) => a.number - b.number).map((transition) => ({
    scope: path,
    transition,
    elements: transition.elements
      .map((one) => byId.get(one.elementId))
      .filter((element): element is DesignElement => element !== undefined),
  }))
}

/** The organisation the index answers with: what `model/units.ts` asks its questions of. */
function organisationOf(
  units: readonly IndexedUnit[], assignments: readonly IndexedAssignment[], operating: IndexedOperatingModel, moves: readonly IndexedMove[],
): Organisation {
  return {
    units: units.map(({ unit }) => unit),
    assignments: assignments.map(({ assignment }) => assignment),
    roles: operating.roles,
    unitTypes: operating.unitTypes,
    ...(moves.length ? { moves: moves.map(({ move }) => move) } : {}),
  }
}

/** The units a scope's plans move (ADR-0036 §6): every plan's but an abandoned one's, in the scope's order. */
export function movesOf(path: ScopePath, model: Pick<ScopeModel['model'], 'transitions'>): IndexedMove[] {
  return (model.transitions ?? [])
    .filter((transition) => transition.status !== 'abandoned')
    .flatMap((transition) => (transition.moves ?? []).map((move) => ({
      scope: path, plan: { id: transition.id, number: transition.number }, move,
    })))
}

/** The actors a scope's plans introduce and retire (ADR-0036 §6): every plan's but an abandoned one's, in the scope's order. */
export function unitPlansOf(path: ScopePath, model: Pick<ScopeModel['model'], 'transitions' | 'elements'>): IndexedUnitPlan[] {
  const plans = (model.transitions ?? []).filter((transition) => transition.status !== 'abandoned')
  if (plans.length === 0) return []
  const actors = new Set(model.elements.filter((element) => element.kind === 'actor').map((element) => element.id))
  return plans.flatMap((transition) => transition.elements.flatMap(({ elementId, role }) => (
    (role === 'introduces' || role === 'retires') && actors.has(elementId)
      ? [{ scope: path, plan: { id: transition.id, number: transition.number }, unitId: elementId, role }]
      : []
  )))
}

/** The organisation's operating model, off its thin read. */
function operatingOf(model: ScopeModel['model']): IndexedOperatingModel {
  return {
    unitTypes: model.unitTypes ?? [],
    roles: model.roles ?? [],
    responsibilities: model.responsibilities ?? [],
    operatingRules: model.operatingRules ?? [],
  }
}

/**
 * What one scope's analysis says about the scopes below it: the observations
 * it absorbed from them, and the records of theirs its causes explain. Both
 * are written in this scope and read by the one below (ADR-0021 §4, ADR-0032 §4).
 */
function readAcross(
  analysis: IndexedAnalysis, absorptions: Absorption[], fromAbove: Map<ScopePath, Map<string, CauseAbove[]>>,
): void {
  const by = analysis.scope
  for (const observation of analysis.observations) {
    for (const event of observation.history) {
      if (event.kind !== 'absorbed' || event.scope === undefined || event.id === undefined) continue
      absorptions.push({
        scope: event.scope, id: event.id, by, into: observation.id, intoTitle: observation.title, date: event.date,
      })
    }
  }
  for (const cause of analysis.causes) {
    for (const link of cause.explains) {
      if (link.scope === undefined) continue
      const byId = fromAbove.get(link.scope) ?? new Map<string, CauseAbove[]>()
      fromAbove.set(link.scope, byId)
      byId.set(link.id, [...(byId.get(link.id) ?? []), { scope: by, cause, strength: link.strength }])
    }
  }
}

/** A scope's analysis in number order, or nothing where it has none. */
function analysisOf(path: ScopePath, model: ScopeModel['model']): IndexedAnalysis | undefined {
  const byNumber = <T extends { number: number }>(list: readonly T[] | undefined): T[] => [...(list ?? [])].sort((a, b) => a.number - b.number)
  const analysis = {
    scope: path,
    observations: byNumber(model.observations),
    causes: byNumber(model.causes),
    solutions: byNumber(model.solutions),
    experiments: byNumber(model.experiments),
  }
  const empty = !analysis.observations.length && !analysis.causes.length && !analysis.solutions.length && !analysis.experiments.length
  return empty ? undefined : analysis
}

/**
 * What the index needs from a store: the tree's models, or failing that a
 * listing and a load each.
 *
 * The narrowest shape that will do, rather than a `ScopeStore`: building an
 * index must not be one refactor away from being able to save.
 */
export type IndexSource = {
  models?(): Promise<ScopeModel[]>
  list(): Promise<ScopeSummary>
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
}

/**
 * The index over whatever a store can tell us about the tree.
 *
 * `models()` is the cheap road and the one every shipped adapter takes: one
 * file per scope. The fallback is there so that a backend written without it
 * is slower rather than wrong — it loads each scope in full, descriptions,
 * views and all, which is the cost the optional clause exists to avoid.
 *
 * A scope that will not load is left out rather than counted as empty, for the
 * reason the folder store gives: an empty model is the claim "this scope
 * defines nothing", and a read that failed is not evidence for it.
 */
export async function indexOf(source: IndexSource): Promise<ScopeIndex> {
  return indexScopes(await treeModels(source))
}

/**
 * Every scope's records and rows, however the store can answer for them.
 *
 * Said out loud rather than kept inside {@link indexOf}, because the index is
 * not the only pass over the whole tree: re-addressing the refs that point
 * into a moved subtree (`readdress.ts`) asks the same question and must not
 * grow a second way of asking it.
 */
export async function treeModels(source: IndexSource): Promise<ScopeModel[]> {
  if (source.models) return source.models()
  const paths = flattenScopes(await source.list()).map((scope) => scope.path)
  const loaded = await Promise.all(paths.map((path) => source.load(path)))
  // A scope a file of which did not read holds an empty model in its place,
  // which is not the same as defining nothing: left out, like one that did
  // not load.
  return loaded
    .filter((scope): scope is ScopeSnapshot => scope !== undefined && !scope.unreadable?.length)
    .map((scope) => ({ path: scope.path, model: scope.model }))
}

/**
 * Every scope the source holds, in full and in tree order.
 *
 * {@link treeModels} beside it reads one file per scope because the index only
 * needs the records; this reads whole scopes because the working file IS whole
 * scopes (ADR-0018) — every view, every description, every decision, every
 * mark. So there is no `models()` fast path here: a store that has one is
 * answering a narrower question than this one asks.
 *
 * **Refused, naming them, where a scope could not be read** — one the listing
 * names as unreadable, or one it lists that then does not load (ADR-0023,
 * amended). Those used to be left out without a word, and a working file
 * without one of its scopes was saved and handed over as the organisation.
 * A scope that loaded with a file it could not read is not refused: its
 * snapshot says so (`unread`), and the file's manifest carries it.
 */
export async function treeScopes(source: IndexSource): Promise<ScopeSnapshot[]> {
  const listed = await source.list()
  const paths = flattenScopes(listed).map((scope) => scope.path)
  const loaded = await Promise.all(paths.map((path) => source.load(path)))
  // The root is listed whether or not anything was ever written there — a
  // store that is empty is still an organisation — so a root that does not
  // load is nothing yet, and not a scope that would not read.
  const unreadable = [
    ...(listed.unreadable ?? []),
    ...paths.filter((path, at) => loaded[at] === undefined && path !== ''),
  ]
  if (unreadable.length) {
    throw new ShellError('shell.exportUnreadable', { paths: unreadable.map((path) => path || '/').join(', ') })
  }
  return loaded.filter((scope): scope is ScopeSnapshot => scope !== undefined)
}

/**
 * Which scope answers for this id, from anywhere in the tree.
 *
 * The one question `mayEdit` and every read-only field in an inspector asks,
 * said out loud so neither has to know what an `IndexEntry` is.
 */
export function ownerOf(index: ScopeIndex, id: ElementId): ScopePath | undefined {
  return index.lookup(id)?.master
}

/**
 * Is this record, in this scope, the one the tree answers for?
 *
 * True for a master and false for everything else — a stand-in, a declaration
 * that has been overtaken, and an id this scope does not hold at all. A scope
 * the index has never heard of answers `true` for its own ids, which is the
 * honest answer for a session opened before anything listed the tree: the
 * document in front of you is the only authority there is.
 */
export function isMaster(index: ScopeIndex, id: ElementId, scope: ScopePath): boolean {
  const entry = index.lookup(id)
  if (!entry) return true
  return entry.master === scope
}
