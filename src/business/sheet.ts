// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The business architecture as one page, laid out (ADR-0012 §6).
 *
 * A sheet has no geometry: what it draws is the four trees, their order and
 * their depth, so the page is *computed* rather than dragged. This file is
 * that computation, and it is written the way `roadmap/timeline.ts` is
 * written — in rows, phases and depths rather than in pixels. A page turns a
 * cell into a chevron and a depth into a card; nothing here has an opinion
 * about how wide one is, which is what lets the whole layout be tested in
 * node and drawn twice (a screen, and a PNG for an agent) from one answer.
 *
 * Four bands, in the order they are read:
 *
 * - **the stakeholder rail** — the `actor` tree down the side, with the
 *   parties from outside the organisation marked, and under it the units
 *   this sheet uses (ADR-0036, amended 12 October 2026);
 * - **the journey** — the phases across the top, and under them one row per
 *   lane with the common path first (`lanes.ts` derives where a lane forks,
 *   rejoins and merely passes through);
 * - **the areas** — a `function` root per column, its groupings inside it and
 *   their capabilities under those, each capability carrying what covers it
 *   (`coverage.ts`);
 * - **what is not yet mapped** — the function roots no domain has been given.
 *
 * **Depth is drawing, and the model does not know the words** (§4). A
 * `function` at depth 0 is an area, at depth 1 a grouping, at depth 2 a
 * capability; anything deeper is a refinement of a capability and keeps its
 * depth so the page can indent it rather than drop it. That rule is applied
 * here and nowhere else.
 *
 * With one clause on top of it, which a person authoring a sheet needs and a
 * hand-edited file wanted anyway: **a leaf is a leaf at any depth**. A
 * function directly under an area with nothing inside it is a capability and
 * draws as a card, not as a grouping box with no contents — so "add a
 * capability to this area" is a thing somebody can do, and a grouping whose
 * last capability was deleted goes back to reading as one card rather than as
 * an empty frame. A grouping is therefore a child of an area *with something
 * under it*, which is also the only state in which the two are told apart on
 * screen.
 */
import type { DesignDiagram, DesignElement, DesignModel, ElementId, Relation } from '../model'
import { isUnit } from '../model/units'
import { coverageOf, type FunctionCoverage } from './coverage'
import { journeyOf } from './lanes'
import { rootsOfKind, unmappedFunctions } from './sheetDiagram'
import { childrenOf, flatten, inOrder } from './tree'

/**
 * Where on the rail a row is drawn (ADR-0036, amended 12 October 2026):
 * the parties' tree, the units this sheet uses, or the rest of the scope's
 * units, drawn only when *All units* asks for them.
 */
export type RailGroup = 'parties' | 'used' | 'other'

/** A row of the stakeholder rail. */
export type SheetActor = {
  element: DesignElement
  /** How far in it is drawn: 0 is a top-level party, deeper is one of its own. Always 0 outside the parties. */
  depth: number
  /** Not part of this organisation (ADR-0012 §3). */
  outside: boolean
  group: RailGroup
  /**
   * Why a unit is drawn among *Units on this sheet*: what it is responsible
   * for that the sheet draws, in the page's order, and whether it has a lane.
   * Only on that group.
   */
  uses?: { responsibleFor: DesignElement[]; lane: boolean }
}

/**
 * How the rail is drawn for this person, this session: never the sheet's,
 * and never saved. `allUnits` draws every unit of the scope; `kept` are units
 * drawn among the parties anyway — a stakeholder typed as a unit while the
 * sheet was up, which does not leave the rail under the cursor.
 */
export type RailOptions = {
  allUnits?: boolean
  kept?: ReadonlySet<ElementId>
}

/** One step in a lane's cell. */
export type SheetStep = {
  element: DesignElement
  /**
   * Somebody outside the organisation does this — the lane is an outside
   * party's, or an outside actor is `assigned` to the step. Drawn as such, so
   * the map can say a phase is covered by nobody inside (ADR-0012 §4).
   */
  outside: boolean
}

/** What one lane does in one phase. */
export type SheetCell = {
  phaseId: ElementId
  /** This lane's own steps in that phase, in order. */
  steps: SheetStep[]
  /** Inside the span with nothing of its own: what the row above does happens here. */
  passThrough: boolean
  /** Between this lane's fork and join, inclusive. Outside it, the row is not drawn at all. */
  inSpan: boolean
}

export type SheetLane = {
  /** The actor whose path this is; absent for the common row, and for a lane nobody holds. */
  actor?: DesignElement
  /** The id the steps named, which is a fact even when the scope holds no such actor. */
  actorId?: ElementId
  fork?: ElementId
  join?: ElementId
  cells: SheetCell[]
}

export type SheetJourney = {
  element: DesignElement
  /** The phases across the top, in the journey's own order. */
  phases: DesignElement[]
  /** The common row first, then one row per lane. */
  lanes: SheetLane[]
}

export type SheetCapability = {
  element: DesignElement
  /** 1 under its grouping; deeper is a refinement of a capability. */
  depth: number
  coverage: FunctionCoverage
}

export type SheetGrouping = {
  element: DesignElement
  capabilities: SheetCapability[]
}

export type SheetArea = {
  element: DesignElement
  /**
   * The domain this area is assigned to, when the record says one
   * (`scopes[0]`, ADR-0012 §3). One rather than all of them, because the card
   * has room for a chip and not for a list; the record keeps every one.
   */
  domain?: string
  /** The children of the area that hold something: the white boxes. */
  groupings: SheetGrouping[]
  /**
   * The children of the area that hold nothing: capabilities sitting straight
   * in the column, drawn after the boxes. A column reads as boxes and then
   * loose cards rather than interleaving the two, which is the one thing this
   * split costs — the model's order within each list is kept.
   */
  capabilities: SheetCapability[]
}

export type LaidOutSheet = {
  /** The rail, or empty when the sheet does not draw it: the parties, then the units used, then (asked) the rest. */
  actors: SheetActor[]
  /** The units of the scope the rail leaves out: what *All units* would add. */
  unitsNotDrawn: number
  /** Absent when the sheet names no journey, or names one this scope does not hold. */
  journey?: SheetJourney
  areas: SheetArea[]
  /**
   * Function roots this sheet does not draw that nobody has mapped
   * (ADR-0012 §9, ADR-0040 §6): neither they nor anything under them handed
   * to a domain or taken up by one — the question nobody has answered yet,
   * where this belongs.
   */
  unmapped: DesignElement[]
}

const UNCOVERED: FunctionCoverage = { supportedBy: [], assignedTo: [], coverage: 'uncovered' }

/**
 * The page, from the model and the sheet that says what it is of.
 *
 * Everything is read in one pass over the relations and a handful over the
 * elements, for the reason ADR-0004 found four times: a page that asks per
 * row is a page that walks the model once per capability.
 */
export function sheetPage(
  model: Pick<DesignModel, 'elements' | 'relations'>,
  sheet: Pick<DesignDiagram, 'journeyId' | 'lanes' | 'areas' | 'showActors'>,
  /**
   * Rows written in another scope of the same organisation (ADR-0012 §2).
   *
   * A sheet at the root draws capabilities the root defines, and the
   * applications that support them are in a landscape's model — so without
   * this every capability on the organisation's own page would read as
   * uncovered. Handed in rather than looked up: `business` may not import
   * `projects`, and the index is what knows where a row is.
   *
   * Absent is one scope on its own, which is what every sheet was before the
   * tree had an index.
   */
  elsewhere: readonly Relation[] = [],
  /** How this person has the rail drawn, for the session. Absent: the parties and the units the sheet uses. */
  rail: RailOptions = {},
  /**
   * The functions a scope below holds a stand-in of (ADR-0040 §6): taken up,
   * and so not waiting in the band. The host's, because `business` reads no
   * tree; absent, only what this scope handed on is read.
   */
  takenUp?: ReadonlySet<ElementId>,
): LaidOutSheet {
  const { elements, relations } = model
  const byId = new Map(elements.map((element) => [element.id, element]))
  const coverage = coverageOf(relations, elsewhere)

  const functions = elements.filter((element) => element.kind === 'function')
  const drawn = sheet.areas ?? rootsOfKind(elements, 'function').map((element) => element.id)
  const areas = drawn
    .map((id) => byId.get(id))
    .filter((element): element is DesignElement => element !== undefined)
    .map((element) => areaOf(element, functions, coverage))

  const journey = journeyFor(model, sheet, byId)
  const drawnRail = sheet.showActors === false
    ? { actors: [], unitsNotDrawn: 0 }
    : railOf(elements, usedHere(model.relations, elsewhere, areas, journey), rail)

  return {
    ...drawnRail,
    journey,
    areas,
    // The rule itself is `unmappedFunctions`; what this band adds is "and this
    // sheet is not already drawing it", which is about the page and not about
    // the model.
    unmapped: unmappedFunctions(elements, takenUp).filter((element) => !drawn.includes(element.id)),
  }
}

/** What this sheet uses each unit for: keyed by the actor, nothing for one it does not use. */
type Uses = Map<ElementId, { responsibleFor: DesignElement[]; lane: boolean }>

/**
 * The actors the page uses (ADR-0036, amended 12 October 2026): the far end
 * of an `assigned` row to something the page draws — an area, a grouping, a
 * capability or a step, here or in a row another scope keeps, which is what
 * *Show who is responsible* chips — and every lane's actor. One pass over
 * the rows, in the page's order.
 */
function usedHere(
  relations: readonly Relation[],
  elsewhere: readonly Relation[],
  areas: readonly SheetArea[],
  journey: SheetJourney | undefined,
): Uses {
  const drawn: DesignElement[] = [
    ...areas.flatMap((area) => [
      area.element,
      ...area.groupings.flatMap((group) => [group.element, ...group.capabilities.map((held) => held.element)]),
      ...area.capabilities.map((held) => held.element),
    ]),
    ...(journey?.lanes.flatMap((lane) => lane.cells.flatMap((cell) => cell.steps.map((step) => step.element))) ?? []),
  ]
  const order = new Map(drawn.map((element, index) => [element.id, index]))
  const uses: Uses = new Map()
  const at = (id: ElementId) => {
    const held = uses.get(id) ?? { responsibleFor: [], lane: false }
    uses.set(id, held)
    return held
  }
  for (const lane of journey?.lanes ?? []) if (lane.actorId !== undefined) at(lane.actorId).lane = true
  for (const relation of [...relations, ...elsewhere]) {
    if (relation.type !== 'assigned') continue
    const index = order.get(relation.targetId)
    if (index === undefined) continue
    const list = at(relation.sourceId).responsibleFor
    if (!list.includes(drawn[index])) list.push(drawn[index])
  }
  for (const held of uses.values()) held.responsibleFor.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  return uses
}

/**
 * The rail: the actor tree without the units, then the units this sheet
 * uses, then — where *All units* is on — the rest of the scope's units.
 *
 * A unit with a party under it stays in the parties' tree as that party's
 * group, so the party is drawn where it always was; a unit kept for the
 * session stays there too. The units after it are a flat list in the tree's
 * order: the organisation chart is where their structure is read.
 */
function railOf(
  elements: readonly DesignElement[],
  uses: Uses,
  options: RailOptions,
): { actors: SheetActor[]; unitsNotDrawn: number } {
  const actors = elements.filter((element) => element.kind === 'actor')
  const byId = new Map(actors.map((element) => [element.id, element]))
  const party = (element: DesignElement) => !isUnit(element) || options.kept?.has(element.id) === true
  // A party's chain upwards is in the tree, whatever each link is.
  const inTree = new Set<ElementId>()
  for (const element of actors) {
    if (!party(element)) continue
    let at: DesignElement | undefined = element
    while (at && !inTree.has(at.id)) {
      inTree.add(at.id)
      at = at.parentId === undefined ? undefined : byId.get(at.parentId)
    }
  }
  const row = (element: DesignElement, group: RailGroup, depth = 0): SheetActor => ({
    element, depth, outside: element.outside === true, group,
  })
  const parties = flatten(actors.filter((element) => inTree.has(element.id)))
    .map(({ element, depth }) => row(element, 'parties', depth))

  // Every unit, in the tree's order, a unit whose parent is filed elsewhere included.
  const ordered = flatten(actors).map(({ element }) => element)
  const reached = new Set(ordered.map((element) => element.id))
  const units = [...ordered, ...inOrder(actors).filter((element) => !reached.has(element.id))]
    .filter((element) => isUnit(element) && !inTree.has(element.id))
  const used = units.filter((element) => uses.has(element.id))
    .map((element) => ({ ...row(element, 'used'), uses: uses.get(element.id)! }))
  const rest = units.filter((element) => !uses.has(element.id))
  return {
    actors: [...parties, ...used, ...(options.allUnits ? rest.map((element) => row(element, 'other')) : [])],
    unitsNotDrawn: options.allUnits ? 0 : rest.length,
  }
}

function journeyFor(
  model: Pick<DesignModel, 'elements' | 'relations'>,
  sheet: Pick<DesignDiagram, 'journeyId' | 'lanes'>,
  byId: Map<ElementId, DesignElement>,
): SheetJourney | undefined {
  const root = sheet.journeyId === undefined ? undefined : byId.get(sheet.journeyId)
  if (!root) return undefined

  const outsiders = outsideActors(model.elements)
  const assignedOutside = stepsAssignedOutside(model.relations, outsiders)
  const { phases, lanes } = journeyOf(model.elements, root.id, sheet.lanes ?? [])

  return {
    element: root,
    phases,
    lanes: lanes.map((lane) => {
      const actor = lane.actorId === undefined ? undefined : byId.get(lane.actorId)
      const laneOutside = lane.actorId !== undefined && outsiders.has(lane.actorId)
      const first = phases.findIndex((phase) => phase.id === lane.fork)
      const last = phases.findIndex((phase) => phase.id === lane.join)
      return {
        ...(actor ? { actor } : {}),
        ...(lane.actorId !== undefined ? { actorId: lane.actorId } : {}),
        ...(lane.fork !== undefined ? { fork: lane.fork } : {}),
        ...(lane.join !== undefined ? { join: lane.join } : {}),
        cells: lane.cells.map((cell, index) => ({
          phaseId: cell.phaseId,
          steps: cell.steps.map((element) => ({
            element,
            outside: laneOutside || assignedOutside.has(element.id),
          })),
          passThrough: cell.passThrough,
          inSpan: first !== -1 && index >= first && index <= last,
        })),
      }
    }),
  }
}

/** Every actor the organisation does not own, by id. */
function outsideActors(elements: readonly DesignElement[]): Set<ElementId> {
  return new Set(elements
    .filter((element) => element.kind === 'actor' && element.outside === true)
    .map((element) => element.id))
}

/** The steps an outside party is answerable for — one pass over the rows. */
function stepsAssignedOutside(
  relations: readonly Relation[],
  outsiders: ReadonlySet<ElementId>,
): Set<ElementId> {
  const found = new Set<ElementId>()
  for (const relation of relations) {
    if (relation.type === 'assigned' && outsiders.has(relation.sourceId)) found.add(relation.targetId)
  }
  return found
}

function areaOf(
  element: DesignElement,
  functions: readonly DesignElement[],
  coverage: ReadonlyMap<ElementId, FunctionCoverage>,
): SheetArea {
  const covered = (leaf: DesignElement, depth: number): SheetCapability => ({
    element: leaf,
    depth,
    coverage: coverage.get(leaf.id) ?? UNCOVERED,
  })
  const children = childrenOf(functions, element.id)
  const holds = (id: ElementId) => childrenOf(functions, id).length > 0

  return {
    element,
    ...(element.scopes?.[0] !== undefined ? { domain: element.scopes[0] } : {}),
    groupings: children.filter((child) => holds(child.id)).map((grouping) => ({
      element: grouping,
      // The whole tree under a grouping rather than its children alone: a
      // capability somebody refined further is drawn one step in, not dropped.
      capabilities: flatten(functions, grouping.id).slice(1)
        .map(({ element: leaf, depth }) => covered(leaf, depth)),
    })),
    // A leaf is a leaf at any depth: drawn at the depth a capability inside a
    // grouping is drawn at, because that is what it is.
    capabilities: children.filter((child) => !holds(child.id)).map((leaf) => covered(leaf, 1)),
  }
}
