// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Analysis, Cause, Observation } from './observation'
import type { Experiment, Solution, SolutionWork } from './solution'
import { experimentKey, isDirection, solutionGraph, solutionKey, trailKey } from './solutionGraph'

const observation = (id: string): Observation => ({
  id, number: 1, title: id, date: '2026-06-01', impact: 'minor', seen: 1, body: '', history: [],
})
const cause = (id: string, explains: string[]): Cause => ({
  id, number: 1, title: id, state: 'verified', body: '', explains: explains.map((one) => ({ id: one, strength: 'normal' })),
})
const solution = (id: string, state: Solution['state'], addresses: string[], over: Partial<Solution> = {}): Solution => ({
  id, number: 1, title: id, state, addresses: addresses.map((one) => ({ id: one, strength: 'strong' })),
  validatedWith: [], attempts: [], body: '', history: [], ...over,
})
const experiment = (id: string, tests: string[], outcome: Experiment['outcome'] = 'running'): Experiment => ({
  id, number: 1, title: id, tests, hypothesis: 'h', outcome, body: '',
})

// o1 ← c1 ← r1 (root), o2 ← r2 (root), c3 explains nothing yet.
const analysis: Analysis = {
  observations: [observation('o1'), observation('o2')],
  causes: [cause('c1', ['o1']), cause('r1', ['c1']), cause('r2', ['o2']), cause('c3', [])],
}
const work: SolutionWork = {
  solutions: [
    solution('s1', 'testing', ['r1']),
    solution('s2', 'adopted', ['c1'], { plan: 'tr1' }),
    solution('s3', 'dropped', ['r2'], { droppedFrom: 'proven' }),
  ],
  experiments: [experiment('e1', ['s1']), experiment('e2', ['s2']), experiment('e3', ['s3']), experiment('e4', [])],
}

const laneOf = (graph: ReturnType<typeof solutionGraph>, key: string) => graph.nodes.find((node) => node.key === key)?.lane

describe('solutionGraph', () => {
  it('draws the roots and what is addressed, then directions, experiments and structural', () => {
    const graph = solutionGraph(analysis, work, [{ id: 'tr1', status: 'done', elements: [] }])
    expect(graph.laneKinds).toEqual(['causes', 'directions', 'experiments', 'structural'])
    expect(graph.nodes.filter((node) => node.lane === 0).map((node) => node.key).sort()).toEqual(['c1', 'r1', 'r2'])
    expect(laneOf(graph, solutionKey('s1'))).toBe(1)
    expect(laneOf(graph, experimentKey('e1'))).toBe(2)
    expect(laneOf(graph, solutionKey('s2'))).toBe(3)
    const s2 = graph.nodes.find((node) => node.key === solutionKey('s2'))
    expect(s2?.kind === 'solution' && s2.phase).toBe('implemented')
  })
  it('leaves out dropped solutions, their experiments, and experiments that test nothing, unless asked', () => {
    const graph = solutionGraph(analysis, work, [])
    expect(laneOf(graph, solutionKey('s3'))).toBeUndefined()
    expect(laneOf(graph, experimentKey('e3'))).toBeUndefined()
    expect(laneOf(graph, experimentKey('e4'))).toBeUndefined()
    const shown = solutionGraph(analysis, work, [], { showDropped: true })
    expect(laneOf(shown, solutionKey('s3'))).toBe(3)
    expect(isDirection(work.solutions[2])).toBe(false)
  })
  it('runs every line left to right', () => {
    const graph = solutionGraph(analysis, work, [], { showDropped: true })
    for (const edge of graph.edges) expect(laneOf(graph, edge.from)!).toBeLessThan(laneOf(graph, edge.to)!)
    expect(graph.edges).toContainEqual({ from: solutionKey('s1'), to: experimentKey('e1'), kind: 'tests', strength: 'normal' })
    expect(graph.edges).toContainEqual({ from: trailKey('s2'), to: experimentKey('e2'), kind: 'tests', strength: 'normal' })
  })
  it('keeps the direction a structural solution was, and runs its chain through it', () => {
    const proven: SolutionWork = {
      solutions: [solution('s1', 'proven', ['r1'])],
      experiments: [experiment('e1', ['s1'], 'refuted'), experiment('e2', ['s1'], 'confirmed')],
    }
    const graph = solutionGraph(analysis, proven, [])
    expect(laneOf(graph, trailKey('s1'))).toBe(1)
    expect(laneOf(graph, solutionKey('s1'))).toBe(3)
    expect(graph.edges.filter((edge) => edge.to === solutionKey('s1'))).toEqual([
      { from: experimentKey('e2'), to: solutionKey('s1'), kind: 'proves', strength: 'normal' },
    ])
    expect(graph.edges).toContainEqual({ from: 'r1', to: trailKey('s1'), kind: 'addresses', strength: 'strong' })
    expect(graph.edges).toContainEqual({ from: trailKey('s1'), to: experimentKey('e1'), kind: 'tests', strength: 'normal' })
    expect(graph.edges).toContainEqual({ from: trailKey('s1'), to: experimentKey('e2'), kind: 'tests', strength: 'normal' })
    const trail = graph.nodes.find((node) => node.key === trailKey('s1'))
    const structural = graph.nodes.find((node) => node.key === solutionKey('s1'))
    expect(trail?.row).toBe(structural?.row)
  })
  it('draws the lines around an experiment with how firmly it bears on the solution', () => {
    const firm: SolutionWork = {
      solutions: [solution('s1', 'proven', ['r1'])],
      experiments: [{ ...experiment('e1', ['s1'], 'confirmed'), strength: { s1: 'strong' } }],
    }
    const graph = solutionGraph(analysis, firm, [])
    expect(graph.edges.filter((edge) => edge.kind === 'tests' || edge.kind === 'proves').map((edge) => edge.strength)).toEqual(['strong', 'strong'])
  })
  it('reaches a structural solution nothing confirmed from its direction directly', () => {
    const waived: SolutionWork = { solutions: [solution('s1', 'proven', ['r1'], { waived: 'Not trialled' })], experiments: [] }
    const graph = solutionGraph(analysis, waived, [])
    expect(graph.edges).toContainEqual({ from: trailKey('s1'), to: solutionKey('s1'), kind: 'became', strength: 'normal' })
    expect(graph.edges.some((edge) => edge.from === 'r1' && edge.to === solutionKey('s1'))).toBe(false)
  })
  it('draws no direction twice for a solution that is still one', () => {
    const graph = solutionGraph(analysis, work, [])
    expect(laneOf(graph, trailKey('s1'))).toBeUndefined()
    expect(graph.nodes.filter((node) => node.kind === 'trail').map((node) => node.id)).toEqual(['s2'])
  })
  it('puts the whole analysis on the left when asked for the whole chain', () => {
    const graph = solutionGraph(analysis, work, [], { wholeChain: true })
    expect(graph.laneKinds).toEqual(['observations', 'causes', 'roots', 'directions', 'experiments', 'structural'])
    expect(laneOf(graph, 'o1')).toBe(0)
    expect(laneOf(graph, 'r1')).toBe(2)
    expect(laneOf(graph, solutionKey('s1'))).toBe(3)
    expect(graph.edges.some((edge) => edge.kind === 'explains')).toBe(true)
  })
  it('lands in the same place every time', () => {
    const rows = () => solutionGraph(analysis, work, [], { wholeChain: true }).nodes.map((node) => `${node.key}@${node.lane}:${node.row}`)
    expect(rows()).toEqual(rows())
  })
})
