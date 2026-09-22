// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { analysisGraph, placeGraph } from './graph'
import type { Analysis, Cause, Observation } from './observation'

const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: id, date: '2026-09-01', impact: 'minor', seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, explains: Cause['explains'], over: Partial<Cause> = {}): Cause => ({
  id, number, title: id, state: 'assumed', body: '', explains, ...over,
})

const analysis: Analysis = {
  observations: [observation('o1', 1), observation('o2', 2), observation('o3', 3)],
  causes: [
    cause('c1', 1, [{ id: 'o1', strength: 'strong' }, { id: 'o2', strength: 'weak' }]),
    cause('c2', 2, [{ id: 'o3', strength: 'normal' }]),
    cause('r1', 3, [{ id: 'c1', strength: 'strong' }, { id: 'c2', strength: 'normal' }]),
  ],
}

describe('analysisGraph', () => {
  it('leaves an archived observation out, here and from below, and the lines to it with it', () => {
    const closed: Analysis = {
      ...analysis,
      observations: analysis.observations.map((one) => (one.id === 'o2' ? { ...one, archived: true as const } : one)),
    }
    const below = [{ scope: 'acme/x', observation: observation('b1', 1, { shared: true, archived: true }) }]
    const graph = analysisGraph(closed, below)
    expect(graph.nodes.map((node) => node.key)).not.toContain('o2')
    expect(graph.nodes.map((node) => node.key)).not.toContain('acme/x#b1')
    expect(graph.edges.map((edge) => edge.from)).toEqual(['o1', 'o3', 'c1', 'c2'])
  })

  it('lays observations in lane 0, causes by depth, the root last', () => {
    const graph = analysisGraph(analysis)
    const lane = (key: string) => graph.nodes.find((node) => node.key === key)?.lane
    expect(lane('o1')).toBe(0)
    expect(lane('c1')).toBe(1)
    expect(lane('c2')).toBe(1)
    expect(lane('r1')).toBe(2)
    expect(graph.lanes).toBe(3)
    const root = graph.nodes.find((node) => node.key === 'r1')
    expect(root?.kind === 'cause' && root.root).toBe(true)
  })

  it('draws every link once, from the explained thing to the cause', () => {
    const graph = analysisGraph(analysis)
    expect(graph.edges).toContainEqual({ from: 'o1', to: 'c1', strength: 'strong' })
    expect(graph.edges).toContainEqual({ from: 'c1', to: 'r1', strength: 'strong' })
    expect(graph.edges).toHaveLength(5)
  })

  it('orders a lane by the mean row of what each node explains', () => {
    const swapped: Analysis = {
      ...analysis,
      causes: [
        cause('c1', 1, [{ id: 'o3', strength: 'strong' }]),
        cause('c2', 2, [{ id: 'o1', strength: 'normal' }]),
      ],
    }
    const graph = analysisGraph(swapped)
    const row = (key: string) => graph.nodes.find((node) => node.key === key)?.row
    // c2 explains the first observation, so it sits above c1 despite its number.
    expect(row('c2')).toBe(0)
    expect(row('c1')).toBe(1)
  })

  it('leaves out a merged observation, and an absorbed one from below', () => {
    const merged: Analysis = {
      observations: [
        observation('o1', 1, { history: [{ date: 'd', kind: 'recorded' }, { date: 'd', kind: 'absorbed', id: 'o2', seen: 1 }, { date: 'd', kind: 'absorbed', id: 'b1', scope: 'acme/claims', seen: 1 }] }),
        observation('o2', 2),
      ],
      causes: [],
    }
    const shared = [
      { scope: 'acme/claims', observation: observation('b1', 1, { shared: true }) },
      { scope: 'acme/claims', observation: observation('b2', 2, { shared: true }) },
    ]
    const graph = analysisGraph(merged, shared)
    expect(graph.nodes.map((node) => node.key)).toEqual(['o1', 'acme/claims#b2'])
  })

  it('keeps a link to a shared observation apart from one to a local id that happens to match', () => {
    const graph = analysisGraph(
      { observations: [observation('x', 1)], causes: [cause('c1', 1, [{ id: 'x', scope: 'acme/claims', strength: 'weak' }])] },
      [{ scope: 'acme/claims', observation: observation('x', 9, { shared: true }) }],
    )
    expect(graph.edges).toEqual([{ from: 'acme/claims#x', to: 'c1', strength: 'weak' }])
  })
})

describe('placeGraph', () => {
  it('centres a short lane on the tallest one', () => {
    const graph = analysisGraph(analysis)
    const placed = new Map(placeGraph(graph, { laneWidth: 200, rowHeight: 50 }).map((one) => [one.key, one]))
    // Three observations: rows 0..2, so the middle of the lane is y = 75.
    expect(placed.get('o2')?.y).toBe(75)
    // The one root sits level with that middle.
    expect(placed.get('r1')?.y).toBe(75)
    expect(placed.get('r1')?.x).toBe(500)
  })
})
