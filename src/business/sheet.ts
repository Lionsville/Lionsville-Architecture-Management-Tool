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
 *   parties from outside the organisation marked;
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
 * here and nowhere else, so a hand-edited file that puts a capability
 * straight under an area draws as an empty grouping — visibly wrong in the
 * place where it *is* wrong, rather than quietly rearranged into looking
 * right.
 */
import type { DesignDiagram, DesignElement, DesignModel, ElementId, Relation } from '../model'
import { coverageOf, type FunctionCoverage } from './coverage'
import { journeyOf } from './lanes'
import { rootsOfKind } from './sheetDiagram'
import { childrenOf, flatten } from './tree'

/** A row of the stakeholder rail. */
export type SheetActor = {
  element: DesignElement
  /** How far in it is drawn: 0 is a top-level party, deeper is one of its own. */
  depth: number
  /** Not part of this organisation (ADR-0012 §3). */
  outside: boolean
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
  groupings: SheetGrouping[]
}

export type SheetPage = {
  /** The rail, or empty when the sheet does not draw it. */
  actors: SheetActor[]
  /** Absent when the sheet names no journey, or names one this scope does not hold. */
  journey?: SheetJourney
  areas: SheetArea[]
  /**
   * Function roots no domain has been given and this sheet does not draw
   * (ADR-0012 §9). Until scopes exist, no function has one — so this is the
   * roots the sheet was not told to draw, which is the same band and the same
   * question: nobody has said where this belongs.
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
): SheetPage {
  const { elements, relations } = model
  const byId = new Map(elements.map((element) => [element.id, element]))
  const coverage = coverageOf(relations)

  const functions = elements.filter((element) => element.kind === 'function')
  const drawn = sheet.areas ?? rootsOfKind(elements, 'function').map((element) => element.id)
  const areas = drawn
    .map((id) => byId.get(id))
    .filter((element): element is DesignElement => element !== undefined)
    .map((element) => areaOf(element, functions, coverage))

  return {
    actors: sheet.showActors === false ? [] : railOf(elements),
    journey: journeyFor(model, sheet, byId),
    areas,
    unmapped: rootsOfKind(elements, 'function')
      .filter((element) => !(element.scopes?.length) && !drawn.includes(element.id)),
  }
}

/** The actor tree, flattened with the depth each row is drawn at. */
function railOf(elements: readonly DesignElement[]): SheetActor[] {
  const actors = elements.filter((element) => element.kind === 'actor')
  return flatten(actors).map(({ element, depth }) => ({
    element,
    depth,
    outside: element.outside === true,
  }))
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
  return {
    element,
    ...(element.scopes?.[0] !== undefined ? { domain: element.scopes[0] } : {}),
    groupings: childrenOf(functions, element.id).map((grouping) => ({
      element: grouping,
      // The whole tree under a grouping rather than its children alone: a
      // capability somebody refined further is drawn one step in, not dropped.
      capabilities: flatten(functions, grouping.id).slice(1).map(({ element: leaf, depth }) => ({
        element: leaf,
        depth,
        coverage: coverage.get(leaf.id) ?? UNCOVERED,
      })),
    })),
  }
}
