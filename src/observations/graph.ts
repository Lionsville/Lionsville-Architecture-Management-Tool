// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The analysis as a picture: observations on the left, causes in the lanes
 * after them, root causes on the right (ADR-0021, ADR-0032).
 *
 * Laid out here, in lanes and rows rather than pixels, so the page draws what
 * a node test can assert. A lane is a depth — zero for the observations, one
 * for a cause that explains only observations, one more per cause between —
 * except that every root cause stands in the last lane, whatever depth it
 * was said at, and nothing else does. A row is a position in the lane,
 * chosen to keep the lines short: each node sits near the average row of
 * what it explains (a barycentre pass, one sweep left to right), and ties
 * keep the record order. No force simulation:
 * the picture must land in the same place every time the page opens, and a
 * team pointing at "the one third from the top" needs it to still be there.
 *
 * Merged observations are not drawn — their sightings and their links moved
 * to the survivor — and neither is an observation from below that this scope
 * absorbed, nor an archived one, here or below: closed is out of the analysis. What is drawn of a node is on the node: the size of a mark is its
 * impact, its tint how often it was seen, a dashed outline an assumed cause,
 * the weight of a line the strength of the link.
 *
 * The Analysis tab draws `analysisPicture` (ADR-0032 §8): the same lanes, a
 * section per scope — this scope's on the right, each scope below in a
 * boundary to the left of it, nested as the tree nests — with the solutions
 * in a last lane, and whatever the filters left (`filter.ts`) placed as if
 * nothing else were there. `analysisGraph` stays the one lane set the
 * Solutions tab's whole chain is drawn from.
 */
import {
  absorbedBy, causeDepth, isArchived, isMerged, isRootCause,
} from './observation'
import type { Analysis, Cause, CauseStrength, Observation, ObservationBelow, ScopeAnalysis } from './observation'
import type { Solution } from './solution'

export type GraphNode =
  | {
    kind: 'observation'
    /** `id`, or `scope#id` for one of a scope below, so the two cannot collide. */
    key: string
    id: string
    /** Present for an observation of a scope below. */
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
  /** How many lanes there are; the root causes stand in the last, and only they. */
  lanes: number
}

export function nodeKey(id: string, scope?: string): string {
  return scope === undefined ? id : `${scope}#${id}`
}

/**
 * The picture over this scope's analysis and the observations of the scopes
 * below. Rows are assigned lane by lane; every node has one.
 */
export function analysisGraph(analysis: Analysis, below: readonly ObservationBelow[] = []): AnalysisGraph {
  const { observations, causes } = analysis
  const drawnObservations: GraphNode[] = []
  for (const observation of observations) {
    if (isMerged(observations, observation.id) || isArchived(observation)) continue
    drawnObservations.push({
      kind: 'observation', key: nodeKey(observation.id), id: observation.id, observation, lane: 0, row: 0,
    })
  }
  for (const { scope, observation } of below) {
    if (absorbedBy(observations, observation.id, scope) || isArchived(observation)) continue
    drawnObservations.push({
      kind: 'observation', key: nodeKey(observation.id, scope), id: observation.id, scope, observation, lane: 0, row: 0,
    })
  }

  // A cause stands in the lane of its depth; every root cause in the lane
  // after the deepest of them (ADR-0032 §3), because a root is what the team
  // said and not how far from the observations it happens to stand.
  const depths = new Map(causes.map((cause) => [cause.id, causeDepth(cause, causes)]))
  const deepest = Math.max(0, ...causes.filter((cause) => !isRootCause(cause)).map((cause) => depths.get(cause.id)!))
  const rootLane = Math.max(deepest + 1, ...causes.filter(isRootCause).map((cause) => depths.get(cause.id)!))
  const causeNodes: GraphNode[] = causes.map((cause) => ({
    kind: 'cause', key: nodeKey(cause.id), id: cause.id, cause,
    root: isRootCause(cause), lane: isRootCause(cause) ? rootLane : depths.get(cause.id)!, row: 0,
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
 * beside its observations and a root beside its causes. An edge runs from
 * the node on the left to the node on the right, so the solutions picture
 * (`solutionGraph.ts`) lays its lanes out with the same sweep.
 */
export function assignRows(
  nodes: { key: string; lane: number; row: number }[], edges: readonly { from: string; to: string }[], lanes: number,
): void {
  const rowOf = new Map<string, number>()
  for (let lane = 0; lane < lanes; lane += 1) {
    const inLane = nodes.filter((node) => node.lane === lane)
    const centre = (node: { key: string }): number | undefined => {
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
  graph: { nodes: readonly { key: string; lane: number; row: number }[]; lanes: number }, size: { laneWidth: number; rowHeight: number; top?: number; left?: number },
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

// --- the picture in sections (ADR-0032 §8) --------------------------------------------

/** The keys for a node, one namespace per kind, so an id can never collide across lists. */
export const solutionKey = (id: string): string => `so:${id}`
export const experimentKey = (id: string): string => `ex:${id}`

/**
 * The key a record is drawn, selected and filtered under: its own key for a
 * record of this scope, and `scope#…` for one of a scope below.
 */
export function pictureKey(here: string, scope: string, key: string): string {
  return scope === here ? key : nodeKey(key, scope)
}

/**
 * One link between two records, from the record on the left to the one
 * behind it: from what is explained to the cause that explains it, from a
 * cause to a solution that addresses it, from a solution to an experiment
 * that tests it.
 */
export type PictureLink = {
  from: string
  to: string
  kind: 'explains' | 'addresses' | 'tests'
  strength: CauseStrength
}

/** Every link the scopes hold, keyed as `pictureKey` keys them; a link into a scope not read names a key nothing has. */
export function pictureLinks(scopes: readonly ScopeAnalysis[], here: string): PictureLink[] {
  const links: PictureLink[] = []
  for (const { scope, causes, solutions, experiments } of scopes) {
    for (const cause of causes) {
      const to = pictureKey(here, scope, cause.id)
      for (const link of cause.explains) {
        links.push({ from: pictureKey(here, link.scope ?? scope, link.id), to, kind: 'explains', strength: link.strength })
      }
    }
    for (const solution of solutions) {
      const to = pictureKey(here, scope, solutionKey(solution.id))
      for (const link of solution.addresses) {
        links.push({ from: pictureKey(here, scope, link.id), to, kind: 'addresses', strength: link.strength })
      }
    }
    for (const experiment of experiments) {
      const to = pictureKey(here, scope, experimentKey(experiment.id))
      for (const id of experiment.tests) {
        links.push({ from: pictureKey(here, scope, solutionKey(id)), to, kind: 'tests', strength: experiment.strength?.[id] ?? 'normal' })
      }
    }
  }
  return links
}

/**
 * The observations of the scopes read that one of them folded into another,
 * by key: merged within a scope, or absorbed from a scope below. History,
 * read but no longer drawn.
 */
export function absorbedKeys(scopes: readonly ScopeAnalysis[], here: string): Set<string> {
  const gone = new Set<string>()
  for (const { scope, observations } of scopes) {
    for (const observation of observations) {
      for (const event of observation.history) {
        if (event.kind === 'absorbed' && event.id !== undefined) gone.add(pictureKey(here, event.scope ?? scope, event.id))
      }
    }
  }
  return gone
}

/**
 * The open ends (ADR-0032 §3): the causes that are not root causes and that
 * nothing explains — nothing in the scopes read, and, for this scope's own,
 * nothing above (`above`, by id). The analysis is not finished there. Not a
 * finding: a chain still being asked about contradicts nothing.
 */
export function openEnds(
  scopes: readonly ScopeAnalysis[], here: string, above?: ReadonlyMap<string, readonly unknown[]>,
): Set<string> {
  const explained = new Set(pictureLinks(scopes, here).filter((link) => link.kind === 'explains').map((link) => link.from))
  const open = new Set<string>()
  for (const { scope, causes } of scopes) {
    for (const cause of causes) {
      const key = pictureKey(here, scope, cause.id)
      const fromAbove = scope === here && (above?.get(cause.id)?.length ?? 0) > 0
      if (!isRootCause(cause) && !explained.has(key) && !fromAbove) open.add(key)
    }
  }
  return open
}

export type PictureSize = 'large' | 'small'

/**
 * A record's slot and the pitch between lanes and rows, in pixels, per size:
 * a card with its label and title, or a circle with its label under it.
 */
export const PICTURE_SIZE: Record<PictureSize, { width: number; height: number; lane: number; row: number }> = {
  large: { width: 196, height: 52, lane: 232, row: 66 },
  small: { width: 126, height: 74, lane: 146, row: 92 },
}

/** What a lane of this scope's holds, for its heading. */
export type PictureLane = 'observations' | 'causes' | 'deeper' | 'roots' | 'solutions'

type Placing = { key: string; scope: string; lane: number; row: number; x: number; y: number }

export type PictureNode = Placing & (
  | { kind: 'observation'; observation: Observation }
  | { kind: 'cause'; cause: Cause; root: boolean }
  | { kind: 'solution'; solution: Solution }
)

/** A line drawn: `crossing` where it runs between two scopes, which is a cause above explaining a cause below. */
export type PictureEdge = PictureLink & { kind: 'explains' | 'addresses'; crossing: boolean }

/** A scope below, drawn as a boundary around its own lanes and the boundaries of the scopes below it. */
export type PictureBoundary = {
  scope: string
  /** One for a scope right below this one, one more per level. */
  depth: number
  x: number
  y: number
  width: number
  height: number
  /** What its own lanes hold: the counts its heading says. */
  observations: number
  causes: number
}

export type SectionedPicture = {
  nodes: PictureNode[]
  edges: PictureEdge[]
  boundaries: PictureBoundary[]
  /** This scope's lanes, left edge each, for the headings. */
  lanes: { lane: PictureLane; x: number }[]
  /** Where the lane headings stand; with sections to the left, the two zone headings stand above them at `zoneY`. */
  headingY: number
  zoneY?: number
  /** Where this scope's own lanes start. */
  hereX: number
  width: number
  height: number
}

export type PictureOptions = {
  /** The path of the scope being read; the first of the scopes handed in is expected to be it. */
  here: string
  size: PictureSize
  /** What the filters left (`filter.ts`); absent, everything live is drawn. */
  visible?: ReadonlySet<string>
}

const MARGIN = 24
const BOX_PAD = 16
const BOX_HEAD = 36
const STACK_GAP = 18
const LEFT_GAP = 64

type Section = {
  scope: string
  nodes: PictureNode[]
  lanes: number
  tallest: number
  kinds: PictureLane[]
  children: Section[]
  observations: number
  causes: number
}

/**
 * The analysis as one picture, in sections (ADR-0032 §8): this scope's lanes
 * on the right — observations, causes by depth, root causes, solutions — and
 * each scope below in a boundary to the left of them, nested as the tree
 * nests, in path order. Inside a boundary the scope's own lanes run as this
 * scope's do, and the scopes below it stand to their left again.
 *
 * A filter removes records before anything is placed, so what is left closes
 * up rather than leaving holes; and nothing here depends on the order the
 * scopes were handed in, only on their paths and their own lists — so the
 * same records under the same filters land in the same place every time.
 */
export function analysisPicture(scopes: readonly ScopeAnalysis[], options: PictureOptions): SectionedPicture {
  const { here, size } = options
  const slot = PICTURE_SIZE[size]
  const ordered = [...scopes].sort((a, b) => byPath(a.scope, b.scope))
  const gone = absorbedKeys(ordered, here)
  const links = pictureLinks(ordered, here)
  const shown = (key: string) => !gone.has(key) && (options.visible === undefined || options.visible.has(key))
  const sections = new Map<string, Section>()
  for (const one of ordered) sections.set(one.scope, sectionOf(one, here, shown, links))
  const root = sections.get(here) ?? sectionOf({ scope: here, observations: [], causes: [], solutions: [], experiments: [] }, here, shown, links)
  nest(root, [...sections.values()].filter((one) => one.scope !== here))

  const boundaries: PictureBoundary[] = []
  const locals = root.children.length > 0
  const top = MARGIN + (locals ? 52 : 32)
  const column = placeChildren(root.children, MARGIN, top, 1, slot, boundaries)
  const hereX = MARGIN + (locals ? column.width + LEFT_GAP : 0)
  placeOwn(root, hereX, top, slot)

  const nodes = collect(root)
  const placed = new Map(nodes.map((node) => [node.key, node]))
  const edges: PictureEdge[] = []
  for (const link of links) {
    const from = placed.get(link.from)
    const to = placed.get(link.to)
    if (!from || !to || link.kind === 'tests') continue
    edges.push({ ...link, kind: link.kind, crossing: from.scope !== to.scope })
  }
  const ownWidth = (root.lanes - 1) * slot.lane + slot.width
  const ownHeight = root.tallest > 0 ? (root.tallest - 1) * slot.row + slot.height : 0
  return {
    nodes,
    edges,
    boundaries,
    lanes: root.kinds.map((lane, index) => ({ lane, x: hereX + index * slot.lane })),
    headingY: top - 12,
    ...(locals ? { zoneY: MARGIN + 10 } : {}),
    hereX,
    width: hereX + ownWidth + MARGIN,
    height: Math.max(top + ownHeight, top + column.height) + MARGIN,
  }
}

/**
 * One scope's own records in lanes and rows: observations first, causes by
 * depth over the causes that are left, root causes after the deepest, and
 * solutions last. This scope always has every lane, for its headings; a scope
 * below has the lanes it uses.
 */
function sectionOf(
  one: ScopeAnalysis, here: string, shown: (key: string) => boolean, links: readonly PictureLink[],
): Section {
  const key = (id: string) => pictureKey(here, one.scope, id)
  const observations = one.observations.filter((held) => !isArchived(held) && shown(key(held.id)))
  const causes = one.causes.filter((held) => shown(key(held.id)))
  const solutions = one.solutions.filter((held) => held.state !== 'dropped' && shown(key(solutionKey(held.id))))
  const depths = new Map(causes.map((cause) => [cause.id, causeDepth(cause, causes)]))
  const causeLanes = Math.max(1, ...causes.filter((cause) => !isRootCause(cause)).map((cause) => depths.get(cause.id)!))
  const base = { scope: one.scope, row: 0, x: 0, y: 0 }
  const nodes: PictureNode[] = [
    ...observations.map((observation): PictureNode => ({ ...base, key: key(observation.id), kind: 'observation', observation, lane: 0 })),
    ...causes.map((cause): PictureNode => ({
      ...base, key: key(cause.id), kind: 'cause', cause, root: isRootCause(cause),
      lane: isRootCause(cause) ? causeLanes + 1 : depths.get(cause.id)!,
    })),
    ...solutions.map((solution): PictureNode => ({ ...base, key: key(solutionKey(solution.id)), kind: 'solution', solution, lane: causeLanes + 2 })),
  ]
  const lanes = one.scope === here ? causeLanes + 3 : Math.max(0, ...nodes.map((node) => node.lane + 1))
  const inside = new Set(nodes.map((node) => node.key))
  assignRows(nodes, links.filter((link) => inside.has(link.from) && inside.has(link.to)), lanes)
  const rowsIn = (lane: number) => nodes.filter((node) => node.lane === lane).length
  const kinds: PictureLane[] = Array.from({ length: lanes }, (_, lane) => (
    lane === 0 ? 'observations' : lane === causeLanes + 1 ? 'roots' : lane === causeLanes + 2 ? 'solutions' : lane === 1 ? 'causes' : 'deeper'
  ))
  return {
    scope: one.scope, nodes, lanes, kinds, children: [],
    tallest: Math.max(0, ...Array.from({ length: lanes }, (_, lane) => rowsIn(lane))),
    observations: observations.length, causes: causes.length,
  }
}

/**
 * The sections below as a tree under `root`: each under the nearest scope
 * read that holds it, in path order. A section with nothing drawn in it and
 * nothing drawn below it is left out.
 */
function nest(root: Section, below: readonly Section[]): void {
  const sorted = [...below].sort((a, b) => byPath(a.scope, b.scope))
  const holds = (outer: string, inner: string) => outer === '' ? inner !== '' : inner.startsWith(`${outer}/`)
  for (const section of sorted) {
    const parent = [...sorted].reverse().find((other) => other !== section && holds(other.scope, section.scope)) ?? root
    parent.children.push(section)
  }
  const prune = (section: Section): boolean => {
    section.children = section.children.filter(prune)
    return section.nodes.length > 0 || section.children.length > 0
  }
  root.children = root.children.filter(prune)
}

type Slot = (typeof PICTURE_SIZE)[PictureSize]

/** Path order, by code unit rather than by locale, so every machine sorts the tree the same. */
function byPath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** A section's rows placed from `(left, top)`, each lane centred on the tallest. */
function placeOwn(section: Section, left: number, top: number, slot: Slot): void {
  const rowsIn = (lane: number) => section.nodes.filter((node) => node.lane === lane).length
  for (const node of section.nodes) {
    node.x = left + node.lane * slot.lane
    node.y = top + (node.row + (section.tallest - rowsIn(node.lane)) / 2) * slot.row
  }
}

function ownSize(section: Section, slot: Slot): { width: number; height: number } {
  if (section.nodes.length === 0) return { width: 0, height: 0 }
  return { width: (section.lanes - 1) * slot.lane + slot.width, height: (section.tallest - 1) * slot.row + slot.height }
}

/**
 * Boundaries stacked in a column from `(left, top)`, each around the column of
 * its own children and its own lanes to the right of them: how wide and tall
 * the column came out.
 */
function placeChildren(
  children: readonly Section[], left: number, top: number, depth: number, slot: Slot, out: PictureBoundary[],
): { width: number; height: number } {
  let y = top
  let width = 0
  children.forEach((child, index) => {
    const at = out.length
    out.push({ scope: child.scope, depth, x: left, y, width: 0, height: 0, observations: child.observations, causes: child.causes })
    const inner = placeChildren(child.children, left + BOX_PAD, y + BOX_HEAD, depth + 1, slot, out)
    const own = ownSize(child, slot)
    const ownLeft = left + BOX_PAD + (inner.width > 0 ? inner.width + (own.width > 0 ? LEFT_GAP : 0) : 0)
    placeOwn(child, ownLeft, y + BOX_HEAD, slot)
    const boxWidth = ownLeft - left + own.width + BOX_PAD
    const boxHeight = BOX_HEAD + Math.max(inner.height, own.height) + BOX_PAD
    out[at] = { ...out[at], width: Math.max(boxWidth, 2 * BOX_PAD + slot.width), height: boxHeight }
    width = Math.max(width, out[at].width)
    y += boxHeight + (index < children.length - 1 ? STACK_GAP : 0)
  })
  return { width, height: y - top }
}

function collect(section: Section): PictureNode[] {
  return [...section.children.flatMap(collect), ...section.nodes]
}

/**
 * The zoom that fits a picture of `content` into `viewport`, the start of
 * every picture: the whole of it where that reads — no larger than 110 % — and
 * where fitting both ways would go below 75 %, the height only, so it scrolls
 * sideways rather than shrinking past reading. Never below 40 %. A viewport
 * not measured yet is 100 %.
 */
export function fitZoom(content: { width: number; height: number }, viewport: { width: number; height: number }): number {
  if (viewport.width <= 0 || viewport.height <= 0 || content.width <= 0 || content.height <= 0) return 1
  const wide = (viewport.width - 8) / content.width
  const tall = (viewport.height - 8) / content.height
  let zoom = Math.min(1.1, wide, tall)
  if (zoom < 0.75) zoom = Math.min(0.75, tall)
  return Math.max(0.4, Math.round(zoom * 100) / 100)
}

/**
 * What hovering a record traces: the record, everything behind it and
 * everything ahead of it along the lines drawn — its causes, their causes and
 * what addresses them, and what it explains down to the observations.
 */
export function traceChain(key: string, edges: readonly { from: string; to: string }[]): Set<string> {
  const reached = new Set([key])
  for (const [start, end] of [['from', 'to'], ['to', 'from']] as const) {
    const stack = [key]
    const seen = new Set([key])
    while (stack.length) {
      const at = stack.pop()!
      for (const edge of edges) {
        if (edge[start] !== at || seen.has(edge[end])) continue
        seen.add(edge[end])
        reached.add(edge[end])
        stack.push(edge[end])
      }
    }
  }
  return reached
}
