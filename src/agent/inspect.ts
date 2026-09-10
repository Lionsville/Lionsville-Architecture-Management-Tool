/**
 * The layout report (ADR-0007): what an agent is told when it asks whether a
 * diagram looks right.
 *
 * Structure first, pixels second. Most "does this look right" questions have
 * a geometric answer, and a model reasons far better over *A overlaps B by
 * 40 px* than over a bitmap. So this is arithmetic over placements and
 * routes — boxes that overlap, a line that cuts through a box, an element
 * whose centre is in a band other than the one it says it is in, a group
 * member outside its group, elements nothing connects to, and how full each
 * band is — with the canonical sizes from `model/placement.ts`, which is what
 * the canvas draws a box at unless a person resized it.
 *
 * Bounded. Every list is capped and its total said beside it, because a
 * report on a two-thousand element landscape with four thousand overlaps
 * listed is a report nobody reads; and it has a budget (`measure.ts`), because
 * the loop an agent runs is inspect, move, inspect again.
 */
import { drawnPolyline } from '../model/routes'
import type { Diagram, Model } from '../model/normalised'
import { routesOf } from '../model/normalised'
import { domainGroupForPoint, domainGroupRectMap, placementRect, rectCenter, unionRects } from '../model/placement'
import type { DiagramPlacement, ElementId, Layer7Zone, Point, Rect } from '../model/types'
import { canvasRect, zoneForPoint, zoneRect } from '../model/zones'
import { segmentIntersectsRect } from '../layout/geometry'

/** How many of each finding the report lists. The totals are always whole. */
export const INSPECT_LIMIT = 40

const ZONES: readonly Layer7Zone[] = ['actors', 'inputChannels', 'externalSystems', 'landscape', 'management']

export type InspectReport = {
  diagramId: string
  name: string
  kind: 'layer7' | 'container'
  /** The box around every drawn element, in flow coordinates. */
  bounds?: Rect
  /** A landscape's board, which the bands divide. */
  canvas?: Rect
  /** Where each band is, so a coordinate can be chosen inside one rather than guessed. */
  bands?: { zone: Layer7Zone; rect: Rect }[]
  /** Every domain group's box, with the cards filed under it. */
  groups?: { name: string; rect: Rect; members: ElementId[] }[]
  drawn: { elements: number; connections: number }
  /** Pairs of boxes that overlap, with how far. */
  overlaps: { total: number; some: { a: ElementId; b: ElementId; width: number; height: number }[] }
  /** A line that cuts through a box that is not one of its ends. */
  crossings: { total: number; some: { connectionId: string; elementId: ElementId }[] }
  /** Elements whose centre is in another band than the one they are filed in. */
  outsideZone: { total: number; some: { elementId: ElementId; zone: Layer7Zone; actually: Layer7Zone }[] }
  /** Group members whose centre is not inside their group's box. */
  outsideGroup: { total: number; some: { elementId: ElementId; domainGroup: string; actually?: string }[] }
  /** Elements outside the board a landscape is drawn on. */
  offCanvas: { total: number; some: ElementId[] }
  /** Drawn elements no drawn connection ends on. */
  orphans: { total: number; some: ElementId[] }
  /** Drawn connections with a stored route versus those the canvas routes on the fly. */
  routes: { stored: number; floating: number }
  /** Per band: how many, and how much of the band their boxes cover. */
  density?: { zone: Layer7Zone; elements: number; fill: number }[]
}

export function inspect(model: Model, diagram: Diagram, limit = INSPECT_LIMIT): InspectReport {
  const rects = new Map<ElementId, Rect>()
  for (const id of diagram.order.placements) {
    const element = model.elements[id]
    if (element) rects.set(id, placementRect(element.kind, diagram.placements[id]))
  }

  const connections = model.order.relations
    .map((id) => model.relations[id])
    .filter((c) => rects.has(c.sourceId) && rects.has(c.targetId))

  const report: InspectReport = {
    diagramId: diagram.id,
    name: diagram.name,
    kind: diagram.kind,
    bounds: unionRects([...rects.values()]),
    drawn: { elements: rects.size, connections: connections.length },
    overlaps: overlaps(rects, limit),
    crossings: crossings(diagram, rects, connections, limit),
    outsideZone: { total: 0, some: [] },
    outsideGroup: { total: 0, some: [] },
    offCanvas: { total: 0, some: [] },
    orphans: orphans(rects, connections, limit),
    routes: { stored: 0, floating: 0 },
  }

  const stored = routesOf(diagram)
  for (const c of connections) {
    if (stored[c.id]?.waypoints.length) report.routes.stored += 1
    else report.routes.floating += 1
  }

  if (diagram.kind === 'layer7') {
    const canvas = canvasRect(diagram.layoutConfig)
    report.canvas = canvas
    report.bands = ZONES.map((zone) => ({ zone, rect: zoneRect(zone, diagram.layoutConfig) }))
    const groups = domainGroupRectMap(diagram.layoutConfig)
    report.groups = [...groups.entries()].map(([name, rect]) => ({
      name, rect, members: diagram.order.placements.filter((id) => diagram.placements[id].domainGroup === name),
    }))
    const perZone = new Map<Layer7Zone, { elements: number; area: number }>()
    for (const [id, rect] of rects) {
      const placement = diagram.placements[id]
      const centre = rectCenter(rect)
      const zone = placement.zone ?? 'landscape'
      const actually = zoneForPoint(centre, diagram.layoutConfig)
      if (actually !== zone) {
        report.outsideZone.total += 1
        if (report.outsideZone.some.length < limit) report.outsideZone.some.push({ elementId: id, zone, actually })
      }
      if (placement.domainGroup !== undefined) {
        const inside = domainGroupForPoint(centre, groups)
        if (inside !== placement.domainGroup) {
          report.outsideGroup.total += 1
          if (report.outsideGroup.some.length < limit) {
            report.outsideGroup.some.push({ elementId: id, domainGroup: placement.domainGroup, actually: inside })
          }
        }
      }
      if (!within(rect, canvas)) {
        report.offCanvas.total += 1
        if (report.offCanvas.some.length < limit) report.offCanvas.some.push(id)
      }
      const tally = perZone.get(zone) ?? { elements: 0, area: 0 }
      tally.elements += 1
      tally.area += rect.width * rect.height
      perZone.set(zone, tally)
    }
    report.density = ZONES.map((zone) => {
      const band = zoneRect(zone, diagram.layoutConfig)
      const tally = perZone.get(zone) ?? { elements: 0, area: 0 }
      const area = band.width * band.height
      return { zone, elements: tally.elements, fill: area > 0 ? round(tally.area / area) : 0 }
    })
  }

  return report
}

function within(rect: Rect, bounds: Rect): boolean {
  return rect.x >= bounds.x && rect.y >= bounds.y
    && rect.x + rect.width <= bounds.x + bounds.width && rect.y + rect.height <= bounds.y + bounds.height
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Every pair of boxes that overlap. A sweep along x rather than every pair:
 * two thousand boxes are two million pairs, and the sweep only compares a box
 * with the ones that start before it ends.
 */
function overlaps(rects: Map<ElementId, Rect>, limit: number): InspectReport['overlaps'] {
  const sorted = [...rects.entries()].sort((a, b) => a[1].x - b[1].x)
  const out: InspectReport['overlaps'] = { total: 0, some: [] }
  for (let i = 0; i < sorted.length; i++) {
    const [a, ra] = sorted[i]
    const right = ra.x + ra.width
    for (let j = i + 1; j < sorted.length; j++) {
      const [b, rb] = sorted[j]
      if (rb.x >= right) break
      const width = Math.min(right, rb.x + rb.width) - rb.x
      const height = Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y)
      if (width <= 0 || height <= 0) continue
      out.total += 1
      if (out.some.length < limit) out.some.push({ a, b, width: round(width), height: round(height) })
    }
  }
  return out
}

/**
 * Lines that pass through a box that is not one of their own ends. A stored
 * route is graded as the canvas draws it; a floating one as the straight line
 * between the two centres, which is what the canvas falls back to.
 *
 * The obstacles are sorted along x and only the ones a segment's span could
 * touch are tested — the same reason the overlap sweep exists.
 */
function crossings(
  diagram: Diagram,
  rects: Map<ElementId, Rect>,
  connections: readonly Model['relations'][string][],
  limit: number,
): InspectReport['crossings'] {
  const out: InspectReport['crossings'] = { total: 0, some: [] }
  const sorted = [...rects.entries()].sort((a, b) => a[1].x - b[1].x)
  const xs = sorted.map(([, r]) => r.x)
  const widest = sorted.reduce((w, [, r]) => Math.max(w, r.width), 0)
  const stored = routesOf(diagram)

  for (const c of connections) {
    const source = rects.get(c.sourceId)!
    const target = rects.get(c.targetId)!
    const route = stored[c.id]
    const points: Point[] = route?.waypoints.length
      ? drawnPolyline(route.waypoints, source, target, route)
      : [rectCenter(source), rectCenter(target)]
    const hit = new Set<ElementId>()
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]
      const b = points[i + 1]
      const left = Math.min(a.x, b.x) - widest
      const right = Math.max(a.x, b.x)
      for (let k = lowerBound(xs, left); k < sorted.length && xs[k] <= right; k++) {
        const [id, rect] = sorted[k]
        if (id === c.sourceId || id === c.targetId || hit.has(id)) continue
        if (segmentIntersectsRect(a, b, rect)) hit.add(id)
      }
    }
    for (const elementId of hit) {
      out.total += 1
      if (out.some.length < limit) out.some.push({ connectionId: c.id, elementId })
    }
  }
  return out
}

function lowerBound(sorted: readonly number[], value: number): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (sorted[mid] < value) low = mid + 1
    else high = mid
  }
  return low
}

function orphans(
  rects: Map<ElementId, Rect>,
  connections: readonly Model['relations'][string][],
  limit: number,
): InspectReport['orphans'] {
  const connected = new Set<ElementId>()
  for (const c of connections) {
    connected.add(c.sourceId)
    connected.add(c.targetId)
  }
  const out: InspectReport['orphans'] = { total: 0, some: [] }
  for (const id of rects.keys()) {
    if (connected.has(id)) continue
    out.total += 1
    if (out.some.length < limit) out.some.push(id)
  }
  return out
}

/** The placements' box, for a caller that wants to crop to some of them. */
export function boundsOf(model: Model, diagram: Diagram, elementIds: readonly ElementId[]): Rect | undefined {
  const rects: Rect[] = []
  for (const id of elementIds) {
    const placement: DiagramPlacement | undefined = diagram.placements[id]
    const element = model.elements[id]
    if (placement && element) rects.push(placementRect(element.kind, placement))
  }
  return unionRects(rects)
}
