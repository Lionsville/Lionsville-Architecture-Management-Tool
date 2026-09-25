// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What is being done about the causes, as a picture (ADR-0026): causes on the
 * left, then the **directions** (solutions still being shaped or tested), the
 * **experiments**, and the **structural** solutions (proven, adopted,
 * implemented).
 *
 * A solution is one record that moves right as it matures; its lane is read
 * off its state, so nobody drags it. Laid out in lanes and rows by the same
 * sweep as the analysis (`graph.ts`): deterministic, so the picture lands in
 * the same place every time the page opens.
 *
 * A structural solution keeps the direction it was: a faded box in the
 * directions lane that the cause's line runs into and the experiments run out
 * of, and the experiments that confirmed it lead on into the structural box.
 * So the picture reads left to right as the solution was worked — cause,
 * direction, the test, what was built — instead of a line from the cause
 * jumping over the experiment. A structural solution nothing confirmed (it
 * was waived) is reached from its direction directly.
 *
 * With the whole chain asked for, the causes lane becomes the analysis's own
 * lanes — observations, then causes by depth — and the solution lanes go on
 * to the right of them: one picture from what was seen to what was built.
 */
import { analysisGraph, assignRows } from './graph'
import type { GraphNode } from './graph'
import { isRootCause } from './observation'
import type { Analysis, Cause, CauseStrength, SharedObservation } from './observation'
import { isLive, solutionPhase } from './solution'
import type { Experiment, Solution, SolutionPhase, SolutionPlan, SolutionState, SolutionWork } from './solution'

export type SolutionLane = 'observations' | 'causes' | 'roots' | 'directions' | 'experiments' | 'structural'

export type SolutionGraphNode =
  | GraphNode
  | {
    kind: 'solution'
    key: string
    id: string
    solution: Solution
    phase: SolutionPhase
    lane: number
    row: number
  }
  | {
    /** A structural solution as the direction it was; selecting it selects the solution. */
    kind: 'trail'
    key: string
    id: string
    solution: Solution
    lane: number
    row: number
  }
  | {
    kind: 'experiment'
    key: string
    id: string
    experiment: Experiment
    lane: number
    row: number
  }

export type SolutionGraphEdge = {
  /** The node on the left. */
  from: string
  /** The node on the right. */
  to: string
  /**
   * `explains` from the analysis, `addresses` from a cause to a solution (or
   * to the direction a structural one was), `tests` from a direction to an
   * experiment, `proves` from a confirmed experiment into the structural
   * solution, `became` from a direction to its structural self with no
   * confirmed experiment between.
   */
  kind: 'explains' | 'addresses' | 'tests' | 'proves' | 'became'
  strength: CauseStrength
}

export type SolutionGraph = {
  nodes: SolutionGraphNode[]
  edges: SolutionGraphEdge[]
  lanes: number
  /** What each lane holds, for its heading. */
  laneKinds: SolutionLane[]
}

export type SolutionGraphOptions = {
  shared?: readonly SharedObservation[]
  /** Observations and the whole analysis to the left of the solutions. */
  wholeChain?: boolean
  /** Dropped solutions, in the lane they were dropped from. */
  showDropped?: boolean
}

const DIRECTIONS: readonly SolutionState[] = ['idea', 'shaped', 'testing']

/** Which of the two solution lanes a solution stands in: a dropped one stays where it stopped. */
export function isDirection(solution: Solution): boolean {
  const state = solution.state === 'dropped' ? solution.droppedFrom ?? 'idea' : solution.state
  return DIRECTIONS.includes(state)
}

/** The keys for a node, one namespace per kind, so an id can never collide across lists. */
export const solutionKey = (id: string): string => `so:${id}`
export const experimentKey = (id: string): string => `ex:${id}`
/** The direction a structural solution was. */
export const trailKey = (id: string): string => `so:${id}#direction`

export function solutionGraph(
  analysis: Analysis, work: SolutionWork, plans: readonly SolutionPlan[], options: SolutionGraphOptions = {},
): SolutionGraph {
  const { causes } = analysis
  const drawn = work.solutions.filter((one) => options.showDropped || isLive(one))
  const drawnIds = new Set(drawn.map((one) => one.id))

  const nodes: SolutionGraphNode[] = []
  const edges: SolutionGraphEdge[] = []
  const laneKinds: SolutionLane[] = []
  let first: number

  if (options.wholeChain) {
    const chain = analysisGraph(analysis, options.shared ?? [])
    nodes.push(...chain.nodes)
    for (const edge of chain.edges) edges.push({ from: edge.from, to: edge.to, kind: 'explains', strength: edge.strength })
    for (let lane = 0; lane < chain.lanes; lane += 1) {
      laneKinds.push(lane === 0 ? 'observations' : lane === chain.lanes - 1 && chain.lanes > 1 ? 'roots' : 'causes')
    }
    first = chain.lanes
  } else {
    const addressed = new Set(drawn.flatMap((one) => one.addresses.map((address) => address.id)))
    for (const cause of causes) {
      const root = isRootCause(cause, causes)
      if (!root && !addressed.has(cause.id)) continue
      nodes.push({ kind: 'cause', key: cause.id, id: cause.id, cause, root, lane: 0, row: 0 })
    }
    laneKinds.push('causes')
    first = 1
  }

  const known = new Set(nodes.map((node) => node.key))
  const directions = first
  const experimentsLane = first + 1
  const structural = first + 2
  laneKinds.push('directions', 'experiments', 'structural')

  // Where a solution's lines start: the solution itself while it is a
  // direction, the direction it was once it is structural.
  const leftOf = (solution: Solution) => (isDirection(solution) ? solutionKey(solution.id) : trailKey(solution.id))
  for (const solution of drawn) {
    const direction = isDirection(solution)
    nodes.push({
      kind: 'solution', key: solutionKey(solution.id), id: solution.id, solution,
      phase: solutionPhase(solution, plans), lane: direction ? directions : structural, row: 0,
    })
    if (!direction) nodes.push({ kind: 'trail', key: trailKey(solution.id), id: solution.id, solution, lane: directions, row: 0 })
    for (const address of solution.addresses) {
      if (!known.has(address.id)) continue
      edges.push({ from: address.id, to: leftOf(solution), kind: 'addresses', strength: address.strength })
    }
  }

  const byId = new Map(drawn.map((one) => [one.id, one]))
  const proven = new Set<string>()
  for (const experiment of work.experiments) {
    const tested = experiment.tests.filter((id) => drawnIds.has(id))
    if (tested.length === 0) continue
    const key = experimentKey(experiment.id)
    nodes.push({ kind: 'experiment', key, id: experiment.id, experiment, lane: experimentsLane, row: 0 })
    for (const id of tested) {
      const solution = byId.get(id)!
      edges.push({ from: leftOf(solution), to: key, kind: 'tests', strength: 'normal' })
      if (isDirection(solution) || experiment.outcome !== 'confirmed') continue
      edges.push({ from: key, to: solutionKey(id), kind: 'proves', strength: 'normal' })
      proven.add(id)
    }
  }
  for (const solution of drawn) {
    if (isDirection(solution) || proven.has(solution.id)) continue
    edges.push({ from: trailKey(solution.id), to: solutionKey(solution.id), kind: 'became', strength: 'normal' })
  }

  // One sweep over every lane. With the whole chain, the analysis's lanes come
  // out as `analysisGraph` laid them, because it is the same sweep.
  const lanes = structural + 1
  assignRows(nodes, edges, lanes)
  return { nodes, edges, lanes, laneKinds }
}

/** The causes a solution could be written for: every cause, roots first. */
export function causesForProposal(causes: readonly Cause[]): Cause[] {
  const roots = causes.filter((one) => isRootCause(one, causes))
  return [...roots, ...causes.filter((one) => !roots.includes(one))]
}
