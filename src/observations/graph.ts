// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The analysis as a picture: observations on the left, causes in the lanes
 * after them, root causes on the right (ADR-0021).
 *
 * Laid out here, in lanes and rows rather than pixels, so the page draws what
 * a node test can assert. A lane is a depth — zero for the observations, one
 * for a cause that explains only observations, one more per cause between —
 * and a row is a position in the lane, chosen to keep the lines short: each
 * node sits near the average row of what it explains (a barycentre pass, one
 * sweep left to right), and ties keep the record order. No force simulation:
 * the picture must land in the same place every time the page opens, and a
 * team pointing at "the one third from the top" needs it to still be there.
 *
 * Merged observations are not drawn — their sightings and their links moved
 * to the survivor — and neither is an observation from below that this scope
 * absorbed, nor an archived one, here or below: closed is out of the analysis. What is drawn of a node is on the node: the size of a mark is its
 * impact, its tint how often it was seen, a dashed outline an assumed cause,
 * the weight of a line the strength of the link.
 */
import {
  absorbedBy, causeDepth, isArchived, isMerged, isRootCause,
} from './observation'
import type { Analysis, Cause, CauseStrength, Observation, SharedObservation } from './observation'

export type GraphNode =
  | {
    kind: 'observation'
    /** `id`, or `scope#id` for one shared from below, so the two cannot collide. */
    key: string
    id: string
    /** Present for an observation a scope below shared. */
    scope?: string
    observation: Observation
    lane: 0
    row: number
  }
  | {
    kind: 'cause'
    key: string
    id: string
    cause: Cause
    root: boolean
    lane: number
    row: number
  }

export type GraphEdge = {
  /** The node explained — an observation or a shallower cause. */
  from: string
  /** The cause that explains it. */
  to: string
  strength: CauseStrength
}

export type AnalysisGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** How many lanes there are; the root causes stand in the last. */
  lanes: number
}

export function nodeKey(id: string, scope?: string): string {
  return scope === undefined ? id : `${scope}#${id}`
}

/**
 * The picture over this scope's analysis and the observations shared from
 * below. Rows are assigned lane by lane; every node has one.
 */
export function analysisGraph(analysis: Analysis, shared: readonly SharedObservation[] = []): AnalysisGraph {
  const { observations, causes } = analysis
  const drawnObservations: GraphNode[] = []
  for (const observation of observations) {
    if (isMerged(observations, observation.id) || isArchived(observation)) continue
    drawnObservations.push({
      kind: 'observation', key: nodeKey(observation.id), id: observation.id, observation, lane: 0, row: 0,
    })
  }
  for (const { scope, observation } of shared) {
    if (absorbedBy(observations, observation.id, scope) || isArchived(observation)) continue
    drawnObservations.push({
      kind: 'observation', key: nodeKey(observation.id, scope), id: observation.id, scope, observation, lane: 0, row: 0,
    })
  }

  const causeNodes: GraphNode[] = causes.map((cause) => ({
    kind: 'cause', key: nodeKey(cause.id), id: cause.id, cause,
    root: isRootCause(cause, causes), lane: causeDepth(cause, causes), row: 0,
  }))

  const known = new Set([...drawnObservations, ...causeNodes].map((node) => node.key))
  const edges: GraphEdge[] = []
  for (const cause of causes) {
    for (const link of cause.explains) {
      const from = nodeKey(link.id, link.scope)
      if (!known.has(from)) continue
      edges.push({ from, to: nodeKey(cause.id), strength: link.strength })
    }
  }

  const lanes = Math.max(1, ...causeNodes.map((node) => node.lane + 1))
  const nodes = [...drawnObservations, ...causeNodes]
  assignRows(nodes, edges, lanes)
  return { nodes, edges, lanes }
}

/**
 * One sweep left to right. The first lane keeps record order; every later
 * lane orders its nodes by the mean row of what they explain, so a cause sits
 * beside its observations and a root beside its causes.
 */
function assignRows(nodes: GraphNode[], edges: readonly GraphEdge[], lanes: number): void {
  const rowOf = new Map<string, number>()
  for (let lane = 0; lane < lanes; lane += 1) {
    const inLane = nodes.filter((node) => node.lane === lane)
    const centre = (node: GraphNode): number | undefined => {
      const explained = edges.filter((edge) => edge.to === node.key).map((edge) => rowOf.get(edge.from))
      const known = explained.filter((row): row is number => row !== undefined)
      return known.length ? known.reduce((sum, row) => sum + row, 0) / known.length : undefined
    }
    const keyed = inLane.map((node, index) => ({ node, index, centre: lane === 0 ? index : centre(node) }))
    keyed.sort((a, b) => {
      // A node explaining nothing yet goes to the bottom of its lane, in order.
      if (a.centre === undefined && b.centre === undefined) return a.index - b.index
      if (a.centre === undefined) return 1
      if (b.centre === undefined) return -1
      return a.centre - b.centre || a.index - b.index
    })
    keyed.forEach(({ node }, row) => {
      node.row = row
      rowOf.set(node.key, row)
    })
  }
}

/** Where each node is drawn, in pixels, for a lane width and a row height. */
export type Placed = { key: string; x: number; y: number }

/**
 * Pixels from lanes and rows. Every lane is centred on the tallest one, so a
 * lane with two nodes sits level with the middle of a lane with nine rather
 * than hanging from the top.
 */
export function placeGraph(
  graph: AnalysisGraph, size: { laneWidth: number; rowHeight: number; top?: number; left?: number },
): Placed[] {
  const rowsIn = (lane: number) => graph.nodes.filter((node) => node.lane === lane).length
  const tallest = Math.max(1, ...Array.from({ length: graph.lanes }, (_, lane) => rowsIn(lane)))
  const left = size.left ?? 0
  const top = size.top ?? 0
  return graph.nodes.map((node) => {
    const offset = (tallest - rowsIn(node.lane)) / 2
    return {
      key: node.key,
      x: left + node.lane * size.laneWidth + size.laneWidth / 2,
      y: top + (node.row + offset) * size.rowHeight + size.rowHeight / 2,
    }
  })
}
