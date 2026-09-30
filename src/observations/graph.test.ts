// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  PICTURE_SIZE, analysisGraph, analysisPicture, fitZoom, openEnds, pictureCounts, pictureKey, pictureLinks, placeGraph, solutionKey,
  traceChain,
} from './graph'
import type { Analysis, Cause, Observation, ScopeAnalysis } from './observation'
import type { Solution } from './solution'

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
    cause('r1', 3, [{ id: 'c1', strength: 'strong' }, { id: 'c2', strength: 'normal' }], { root: true }),
  ],
}

describe('analysisGraph', () => {
  it('leaves an archived observation out, here and from below, and the lines to it with it', () => {
    const closed: Analysis = {
      ...analysis,
      observations: analysis.observations.map((one) => (one.id === 'o2' ? { ...one, archived: true as const } : one)),
    }
    const below = [{ scope: 'acme/x', observation: observation('b1', 1, { archived: true }) }]
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

  it('puts every root cause in the root lane whatever its depth, and a cause nobody said is a root beside its depth', () => {
    const said: Analysis = {
      observations: analysis.observations,
      causes: [
        cause('c1', 1, [{ id: 'o1', strength: 'strong' }]),
        cause('d1', 2, [{ id: 'c1', strength: 'strong' }]),
        cause('r1', 3, [{ id: 'o2', strength: 'strong' }], { root: true }),
        cause('r2', 4, [{ id: 'd1', strength: 'strong' }], { root: true }),
        cause('open', 5, [{ id: 'o3', strength: 'normal' }]),
      ],
    }
    const graph = analysisGraph(said)
    const lane = (key: string) => graph.nodes.find((node) => node.key === key)?.lane
    expect(lane('c1')).toBe(1)
    expect(lane('d1')).toBe(2)
    expect(lane('open')).toBe(1)
    expect(lane('r1')).toBe(3)
    expect(lane('r2')).toBe(3)
    expect(graph.lanes).toBe(4)
    const roots = graph.nodes.filter((node) => node.kind === 'cause' && node.root).map((node) => node.key)
    expect(roots).toEqual(['r1', 'r2'])
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
    const below = [
      { scope: 'acme/claims', observation: observation('b1', 1) },
      { scope: 'acme/claims', observation: observation('b2', 2) },
    ]
    const graph = analysisGraph(merged, below)
    expect(graph.nodes.map((node) => node.key)).toEqual(['o1', 'acme/claims#b2'])
  })

  it('keeps a link to an observation below apart from one to a local id that happens to match', () => {
    const graph = analysisGraph(
      { observations: [observation('x', 1)], causes: [cause('c1', 1, [{ id: 'x', scope: 'acme/claims', strength: 'weak' }])] },
      [{ scope: 'acme/claims', observation: observation('x', 9) }],
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

const solution = (id: string, number: number, addresses: Solution['addresses'], over: Partial<Solution> = {}): Solution => ({
  id, number, title: id, state: 'idea', addresses, validatedWith: [], attempts: [], body: '', history: [], ...over,
})

/** The organisation, two scopes right below it, and one below the first of those. */
const tree: ScopeAnalysis[] = [
  {
    scope: '',
    observations: [observation('o1', 1)],
    causes: [
      cause('c1', 1, [{ id: 'o1', strength: 'strong' }]),
      cause('r1', 2, [{ id: 'c1', strength: 'normal' }, { id: 'b1', scope: 'acme', strength: 'weak' }], { root: true }),
    ],
    solutions: [solution('s1', 1, [{ id: 'r1', strength: 'normal' }])],
    experiments: [],
  },
  {
    scope: 'acme',
    observations: [observation('a1', 1), observation('a2', 2)],
    causes: [cause('b1', 1, [{ id: 'a1', strength: 'normal' }, { id: 'a2', strength: 'normal' }])],
    solutions: [], experiments: [],
  },
  {
    scope: 'acme/rail',
    observations: [observation('x1', 1)],
    causes: [cause('y1', 1, [{ id: 'x1', strength: 'normal' }])],
    solutions: [], experiments: [],
  },
  { scope: 'zeta', observations: [observation('z1', 1)], causes: [], solutions: [], experiments: [] },
]

describe('analysisPicture', () => {
  const picture = (scopes = tree, visible?: Set<string>) => analysisPicture(scopes, { here: '', size: 'large', visible })
  const at = (drawn: ReturnType<typeof picture>, key: string) => drawn.nodes.find((node) => node.key === key)

  it('lays this scope out in its lanes, the solutions last, and every heading even where a lane is empty', () => {
    const drawn = picture()
    expect(drawn.lanes.map((lane) => lane.lane)).toEqual(['observations', 'causes', 'roots', 'solutions'])
    expect(at(drawn, 'o1')?.lane).toBe(0)
    expect(at(drawn, 'r1')?.lane).toBe(2)
    expect(at(drawn, solutionKey('s1'))?.lane).toBe(3)
    // This scope's lanes start to the right of every boundary.
    const right = Math.max(...drawn.boundaries.map((box) => box.x + box.width))
    expect(drawn.hereX).toBeGreaterThan(right)
    expect(at(drawn, 'o1')!.x).toBe(drawn.hereX)
  })

  it('draws each scope below in a boundary to the left, nested as the tree nests, in path order', () => {
    const drawn = picture()
    expect(drawn.boundaries.map((box) => [box.scope, box.depth])).toEqual([['acme', 1], ['acme/rail', 2], ['zeta', 1]])
    const box = (scope: string) => drawn.boundaries.find((one) => one.scope === scope)!
    const inside = (outer: ReturnType<typeof box>, inner: { x: number; y: number }) => (
      inner.x >= outer.x && inner.y >= outer.y && inner.x < outer.x + outer.width && inner.y < outer.y + outer.height
    )
    expect(inside(box('acme'), box('acme/rail'))).toBe(true)
    expect(inside(box('acme/rail'), at(drawn, 'acme/rail#x1')!)).toBe(true)
    expect(inside(box('acme'), at(drawn, 'acme#a1')!)).toBe(true)
    expect(inside(box('acme/rail'), at(drawn, 'acme#a1')!)).toBe(false)
    // The scope below's own lanes stand to the right of the one nested in it.
    expect(at(drawn, 'acme#a1')!.x).toBeGreaterThan(box('acme/rail').x + box('acme/rail').width)
    expect(box('zeta').y).toBeGreaterThan(box('acme').y + box('acme').height)
    expect(box('acme')).toMatchObject({ observations: 2, causes: 1 })
  })

  it('marks the lines that cross a boundary: a cause above explaining a cause below', () => {
    const drawn = picture()
    const crossing = drawn.edges.filter((edge) => edge.crossing)
    expect(crossing).toEqual([{ from: 'acme#b1', to: 'r1', kind: 'explains', strength: 'weak', crossing: true }])
    expect(drawn.edges).toContainEqual({ from: 'r1', to: solutionKey('s1'), kind: 'addresses', strength: 'normal', crossing: false })
  })

  it('lands the same records in the same place, whatever order the scopes come in', () => {
    const once = picture()
    const shuffled = picture([tree[0], tree[3], tree[2], tree[1]])
    expect(shuffled).toEqual(once)
    expect(picture()).toEqual(once)
  })

  it('removes what the filters hid before it places anything, so what is left closes up', () => {
    const drawn = picture(tree, new Set(['o1', 'c1', 'r1', 'acme/rail#x1', 'acme/rail#y1']))
    expect(drawn.nodes.map((node) => node.key).sort()).toEqual(['acme/rail#x1', 'acme/rail#y1', 'c1', 'o1', 'r1'])
    // A boundary holding nothing but the scope below it stays, around that one; one holding nothing goes.
    expect(drawn.boundaries.map((box) => box.scope)).toEqual(['acme', 'acme/rail'])
    expect(drawn.height).toBeLessThan(picture().height)
    // Without anything below, this scope's lanes start at the margin.
    const alone = picture(tree, new Set(['o1', 'c1']))
    expect(alone.boundaries).toEqual([])
    expect(alone.hereX).toBe(24)
    expect(alone.zoneY).toBeUndefined()
  })

  it('leaves out an archived observation, a dropped solution, and one absorbed from below', () => {
    const closed: ScopeAnalysis[] = [
      {
        ...tree[0],
        observations: [observation('o1', 1, { history: [{ date: 'd', kind: 'recorded' }, { date: 'd', kind: 'absorbed', id: 'a2', scope: 'acme', seen: 1 }] })],
        solutions: [solution('s1', 1, [], { state: 'dropped' })],
      },
      { ...tree[1], observations: [observation('a1', 1, { archived: true }), observation('a2', 2)] },
    ]
    const keys = picture(closed).nodes.map((node) => node.key)
    expect(keys).not.toContain('acme#a1')
    expect(keys).not.toContain('acme#a2')
    expect(keys).not.toContain(solutionKey('s1'))
  })

  it('gives a lane with nothing in it only the room its heading needs', () => {
    const empty: ScopeAnalysis = { scope: '', observations: [], causes: [], solutions: [], experiments: [] }
    const bare = picture([empty, tree[1]])
    expect(bare.lanes.map((lane) => lane.lane)).toEqual(['observations', 'causes', 'roots', 'solutions'])
    const steps = bare.lanes.slice(1).map((lane, index) => lane.x - bare.lanes[index].x)
    expect(steps.every((step) => step < PICTURE_SIZE.large.lane)).toBe(true)
    // A lane holding a record keeps a slot's pitch: here the causes lane is empty and the rest are not.
    const noCause = picture([{ ...tree[0], causes: [cause('r1', 2, [{ id: 'o1', strength: 'normal' }], { root: true })] }])
    expect(at(noCause, 'r1')!.x - at(noCause, 'o1')!.x).toBeLessThan(2 * PICTURE_SIZE.large.lane)
    expect(at(noCause, solutionKey('s1'))!.x - at(noCause, 'r1')!.x).toBe(PICTURE_SIZE.large.lane)
  })

  it('sizes the slots by the size asked for', () => {
    const small = analysisPicture(tree, { here: '', size: 'small' })
    expect(at(small, 'r1')!.x - at(small, 'o1')!.x).toBe(2 * PICTURE_SIZE.small.lane)
    expect(at(picture(), 'r1')!.x - at(picture(), 'o1')!.x).toBe(2 * PICTURE_SIZE.large.lane)
  })

  it('reads a scope below as the scope being read, keyed as its own', () => {
    const drawn = analysisPicture([tree[1], tree[2]], { here: 'acme', size: 'large' })
    expect(drawn.nodes.map((node) => node.key).sort()).toEqual(['a1', 'a2', 'acme/rail#x1', 'acme/rail#y1', 'b1'])
    expect(drawn.boundaries.map((box) => box.scope)).toEqual(['acme/rail'])
  })
})

describe('pictureCounts', () => {
  it('counts what the picture draws, the scopes below included, and what a filter left', () => {
    expect(pictureCounts(tree, '')).toEqual({ observed: 5, analysed: 4, assumed: 4, verified: 0, roots: 1, openEnds: 1 })
    expect(pictureCounts([tree[0]], '')).toEqual({ observed: 1, analysed: 1, assumed: 2, verified: 0, roots: 1, openEnds: 0 })
    const left = new Set(['o1', 'c1', 'r1', 'acme/rail#x1', 'acme/rail#y1'])
    expect(pictureCounts(tree, '', { visible: left })).toEqual({ observed: 2, analysed: 2, assumed: 3, verified: 0, roots: 1, openEnds: 1 })
  })

  it('leaves out what is closed or folded in, and takes an explanation from above as analysed', () => {
    const closed: ScopeAnalysis[] = [
      { ...tree[0], observations: [observation('o1', 1, { history: [{ date: 'd', kind: 'absorbed', id: 'a2', scope: 'acme', seen: 1 }] })] },
      { ...tree[1], observations: [observation('a1', 1, { archived: true }), observation('a2', 2)], causes: [] },
    ]
    expect(pictureCounts(closed, '').observed).toBe(1)
    const lone: ScopeAnalysis[] = [{ scope: 'acme', observations: [observation('a9', 9)], causes: [], solutions: [], experiments: [] }]
    expect(pictureCounts(lone, 'acme').analysed).toBe(0)
    expect(pictureCounts(lone, 'acme', { above: () => new Map([['a9', [{}]]]) }).analysed).toBe(1)
  })
})

describe('pictureLinks and openEnds', () => {
  it('keys a link by the scope of the record at each end', () => {
    expect(pictureKey('', '', 'o1')).toBe('o1')
    expect(pictureKey('', 'acme', 'o1')).toBe('acme#o1')
    expect(pictureLinks(tree, '')).toContainEqual({ from: 'acme#b1', to: 'r1', kind: 'explains', strength: 'weak' })
    expect(pictureLinks(tree, '')).toContainEqual({ from: 'acme/rail#x1', to: 'acme/rail#y1', kind: 'explains', strength: 'normal' })
  })

  it('finds the causes that are not root causes and that nothing explains, here, below or from above', () => {
    expect([...openEnds(tree, '')].sort()).toEqual(['acme/rail#y1'])
    const read = [tree[0], { ...tree[1], causes: [...tree[1].causes, cause('b2', 2, [])] }]
    expect([...openEnds(read, '')].sort()).toEqual(['acme#b2'])
    const lone: ScopeAnalysis[] = [{ ...tree[0], causes: [cause('c9', 9, [])] }]
    expect([...openEnds(lone, '')]).toEqual(['c9'])
    expect([...openEnds(lone, '', (scope) => (scope === '' ? new Map([['c9', [{}]]]) : undefined))]).toEqual([])
  })

  it('takes a cause below that a scope above it explains as not open, even where that scope is not read', () => {
    // Read from acme, the organisation's r1 is not read: b1 is open until the tree says r1 explains it.
    const read = [tree[1], tree[2]]
    expect([...openEnds(read, 'acme')]).toEqual(['b1', 'acme/rail#y1'])
    const fromRoot = (scope: string) => (scope === 'acme' ? new Map([['b1', [{}]]]) : undefined)
    expect([...openEnds(read, 'acme', fromRoot)]).toEqual(['acme/rail#y1'])
    // And a cause of the scope below, explained from above it, is not open either.
    const both = (scope: string) => (scope === 'acme/rail' ? new Map([['y1', [{}]]]) : fromRoot(scope))
    expect([...openEnds(read, 'acme', both)]).toEqual([])
  })
})

describe('fitZoom', () => {
  it('fits the whole picture, no larger than 110 %', () => {
    expect(fitZoom({ width: 400, height: 300 }, { width: 2000, height: 2000 })).toBe(1.1)
    expect(fitZoom({ width: 1000, height: 500 }, { width: 908, height: 908 })).toBe(0.9)
  })

  it('fits the height instead where fitting both would go below 75 %, and never below 40 %', () => {
    expect(fitZoom({ width: 4000, height: 500 }, { width: 1008, height: 808 })).toBe(0.75)
    expect(fitZoom({ width: 4000, height: 2000 }, { width: 1008, height: 1008 })).toBe(0.5)
    expect(fitZoom({ width: 4000, height: 8000 }, { width: 1008, height: 1008 })).toBe(0.4)
  })

  it('is 100 % while the window has not been measured', () => {
    expect(fitZoom({ width: 400, height: 300 }, { width: 0, height: 0 })).toBe(1)
  })
})

describe('traceChain', () => {
  it('follows the lines both ways from a record, and not sideways', () => {
    const edges = [
      { from: 'o1', to: 'c1' }, { from: 'o2', to: 'c1' }, { from: 'c1', to: 'r1' }, { from: 'r1', to: 's1' },
      { from: 'o3', to: 'c3' },
    ]
    expect([...traceChain('c1', edges)].sort()).toEqual(['c1', 'o1', 'o2', 'r1', 's1'])
    // From one observation, its causes and what lies behind them; not the observation beside it.
    expect([...traceChain('o1', edges)].sort()).toEqual(['c1', 'o1', 'r1', 's1'])
    expect([...traceChain('o3', edges)].sort()).toEqual(['c3', 'o3'])
  })
})
