// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an agent is told when it asks about a sheet.
 *
 * `inspect.ts` answers a board in geometry, because a board's questions are
 * geometric — what overlaps, what a line cuts through. A sheet has no
 * geometry at all (ADR-0012 §6): its questions are *which lane does this step
 * belong to*, *what covers this capability*, *which area has nobody*. So the
 * report is the laid-out page itself — the same answer the screen draws, in
 * the same rows and depths — and never a pixel.
 *
 * Bounded, like its sibling, but in three places rather than nine: the rail,
 * the areas and the unmapped band are the lists a page grows in. Inside an
 * area the groupings and their capabilities are whole, because an area with
 * more capabilities than a cap is a modelling problem the report should show
 * rather than hide.
 *
 * An area carries its own leaves beside its groupings, for the same reason
 * the page draws them: a capability with nothing under it is a capability
 * wherever it hangs, and a report that listed only the grouped ones would not
 * see the one a person had just made.
 */
import type { Coverage } from '../business/coverage'
import { DEFAULT_PAPER, MAX_SPAN, isSheetPaper, paperHeight, sheetPaper, sheetPaperWidth, spanOf } from '../business/grid'
import { nameLikelyCut, overlapsOf } from '../business/posterLayout'
import type { PosterTileSize } from '../business/posterLayout'
import { posterPlaces } from '../business/posterPlaces'
import { sheetPage } from '../business/sheet'
import type { RailGroup } from '../business/sheet'
import type { Diagram, Model } from '../model/normalised'
import { fromDiagram, toArrays } from '../model/normalised'
import type { ElementId, SheetPaper } from '../model/types'

/** A tile's width at each size, the narrowest a name is wrapped at. */
const TILE_WIDTH: Readonly<Record<PosterTileSize, number>> = { s: 92, m: 98, l: 128 }

/** How many of each list the report carries. The totals beside them are whole. */
export const SHEET_LIMIT = 40

export type SheetReport = {
  diagramId: string
  name: string
  kind: 'sheet'
  /** Absent when the sheet names no journey, or one this scope does not hold. */
  journey?: {
    id: ElementId
    name: string
    phases: { id: ElementId; name: string }[]
    lanes: {
      /** Absent on the common row, which every lane shares and which is always first. */
      actorId?: ElementId
      name?: string
      /** The first and last phase this lane has a step of its own in. */
      fork?: ElementId
      join?: ElementId
      cells: {
        phaseId: ElementId
        steps: { id: ElementId; name: string; outside: boolean }[]
        /** Inside the span with nothing of its own: as the row above. */
        passThrough: boolean
        /** Between the fork and the join. Outside it the row is not drawn. */
        inSpan: boolean
      }[]
    }[]
  }
  /**
   * The stakeholder rail as a person first sees it; empty when the sheet does
   * not draw it (ADR-0036, amended 12 October 2026). The parties' tree
   * (`group: 'parties'`, a unit with a party under it as its group), then the
   * units the sheet uses (`'used'`, with what each answers for here and
   * whether it has a lane). `unitsNotDrawn` counts the scope's other units,
   * which a person's *All units* draws for their session.
   */
  actors: {
    total: number
    unitsNotDrawn: number
    some: {
      id: ElementId; name: string; depth: number; outside: boolean; group: RailGroup
      responsibleFor?: ElementId[]; lane?: boolean
    }[]
  }
  /**
   * How the areas tile: the canvas the page is laid out on and its width and
   * height in CSS pixels (none for `fit`), the columns the sheet fixes —
   * absent fits the canvas — and the widest an area may be told to be. On
   * paper the page is landscape: an area the sheet does not fix is widened
   * until the page comes under the paper's height, so a drawn area may be
   * wider than the `span` reported here, which is the sheet's own. Set with
   * diagram.update; a render at the canvas's width is `pageWidth`.
   */
  grid: { paper: SheetPaper; width?: number; height?: number; columns?: number; maxSpan: number }
  areas: {
    total: number
    some: {
      id: ElementId
      name: string
      /** The domain it is assigned to, when its record says one. */
      domain?: string
      /** The columns of the grid the sheet fixes for it; one unless it says, and on paper the page may widen an unfixed one. */
      span: number
      groupings: {
        id: ElementId
        name: string
        capabilities: SheetCapabilityReport[]
      }[]
      /** The area's own capabilities: the ones in no grouping. */
      capabilities: SheetCapabilityReport[]
    }[]
  }
  /** Function roots no domain has been given and this sheet does not draw (§9). */
  unmapped: { total: number; some: { id: ElementId; name: string }[] }
  /**
   * Where the poster's blocks are (ADR-0048), in units on its 1860 wide page, and
   * what a person placing it would want said: nothing here is ever fixed by itself.
   */
  poster: {
    /** Whether anybody has placed anything; absent places are the first layout, worked out each time. */
    placed: boolean
    width: number
    height: number
    bandRows: 1 | 2
    tile: PosterTileSize
    blocks: { id: ElementId; x: number; y: number; width: number; height: number }[]
    /** Blocks with no room on the page, on a shelf under it: an area added since. */
    waiting: ElementId[]
    overlaps: { a: string; b: string }[]
    /** Tiles placed by hand: the rest flow. */
    handPlaced: { id: ElementId; col: number; row: number; span?: number }[]
    /** The functions whose answering unit this poster shows on the tile. */
    labels: ElementId[]
    /** Names a tile's clamp would likely cut, as near as arithmetic knows. A print counts the real ones. */
    namesCut: { total: number; some: ElementId[] }
    items: { id: string; kind: 'note' | 'picture'; x?: number; y?: number; width?: number; height?: number }[]
  }
  /** What the page adds up to, whatever the lists above had room for. */
  counts: {
    phases: number
    steps: number
    lanes: number
    capabilities: number
    uncovered: number
  }
}

/** One capability, and what covers it. */
export type SheetCapabilityReport = {
  id: ElementId
  name: string
  depth: number
  coverage: Coverage
  supportedBy: ElementId[]
  assignedTo: ElementId[]
}

/**
 * `takenUp` is what scopes below hold a stand-in of (ADR-0040 §6), so the
 * unmapped band reads both halves, as the page does; absent, only what this
 * scope handed on.
 */
export function inspectSheet(model: Model, diagram: Diagram, limit = SHEET_LIMIT, takenUp?: ReadonlySet<ElementId>): SheetReport {
  const arrays = toArrays(model)
  const page = sheetPage(arrays, diagram, [], {}, takenUp)

  const said = (capability: {
    element: { id: ElementId; name: string }
    depth: number
    coverage: { coverage: Coverage; supportedBy: ElementId[]; assignedTo: ElementId[] }
  }): SheetCapabilityReport => ({
    id: capability.element.id,
    name: capability.element.name,
    depth: capability.depth,
    coverage: capability.coverage.coverage,
    supportedBy: capability.coverage.supportedBy,
    assignedTo: capability.coverage.assignedTo,
  })

  const capabilities = page.areas.flatMap((area) => [
    ...area.groupings.flatMap((group) => group.capabilities),
    ...area.capabilities,
  ])

  const places = posterPlaces(page, fromDiagram(diagram))
  const tile = diagram.poster?.tile ?? 'm'
  const labelled = new Set(diagram.labels ?? [])
  const cut = capabilities.filter((held) => nameLikelyCut(held.element.name, TILE_WIDTH[tile], labelled.has(held.element.id) ? 2 : undefined))

  return {
    diagramId: diagram.id,
    name: diagram.name,
    kind: 'sheet',
    poster: {
      placed: places.placed,
      width: places.width,
      height: places.height,
      bandRows: places.bandRows,
      tile,
      blocks: places.blocks,
      waiting: places.waiting.map((block) => block.id),
      overlaps: overlapsOf(places.blocks),
      handPlaced: Object.values(diagram.cells ?? {}),
      labels: diagram.labels ?? [],
      namesCut: { total: cut.length, some: cut.slice(0, limit).map((held) => held.element.id) },
      items: (diagram.poster?.items ?? []).map((item) => ({ id: item.id, kind: item.kind, ...diagram.itemPlaces?.[item.id] })),
    },
    journey: page.journey && {
      id: page.journey.element.id,
      name: page.journey.element.name,
      phases: page.journey.phases.map((phase) => ({ id: phase.id, name: phase.name })),
      lanes: page.journey.lanes.map((lane) => ({
        ...(lane.actorId !== undefined ? { actorId: lane.actorId } : {}),
        ...(lane.actor ? { name: lane.actor.name } : {}),
        ...(lane.fork !== undefined ? { fork: lane.fork } : {}),
        ...(lane.join !== undefined ? { join: lane.join } : {}),
        cells: lane.cells.map((cell) => ({
          phaseId: cell.phaseId,
          steps: cell.steps.map((step) => ({
            id: step.element.id, name: step.element.name, outside: step.outside,
          })),
          passThrough: cell.passThrough,
          inSpan: cell.inSpan,
        })),
      })),
    },
    actors: {
      total: page.actors.length,
      unitsNotDrawn: page.unitsNotDrawn,
      some: page.actors.slice(0, limit).map((row) => ({
        id: row.element.id, name: row.element.name, depth: row.depth, outside: row.outside, group: row.group,
        ...(row.uses
          ? { responsibleFor: row.uses.responsibleFor.map((element) => element.id), lane: row.uses.lane }
          : {}),
      })),
    },
    grid: {
      paper: isSheetPaper(diagram.paper) || diagram.paper === 'wide' ? diagram.paper : DEFAULT_PAPER,
      ...(sheetPaperWidth(diagram) !== undefined ? { width: sheetPaperWidth(diagram) } : {}),
      ...(sheetPaper(diagram) !== undefined ? { height: paperHeight(sheetPaper(diagram)!) } : {}),
      ...(diagram.columns !== undefined ? { columns: diagram.columns } : {}),
      maxSpan: MAX_SPAN,
    },
    areas: {
      total: page.areas.length,
      some: page.areas.slice(0, limit).map((area) => ({
        id: area.element.id,
        name: area.element.name,
        ...(area.domain !== undefined ? { domain: area.domain } : {}),
        span: spanOf(diagram, area.element.id, MAX_SPAN),
        groupings: area.groupings.map((group) => ({
          id: group.element.id,
          name: group.element.name,
          capabilities: group.capabilities.map(said),
        })),
        capabilities: area.capabilities.map(said),
      })),
    },
    unmapped: {
      total: page.unmapped.length,
      some: page.unmapped.slice(0, limit).map((element) => ({ id: element.id, name: element.name })),
    },
    counts: {
      phases: page.journey?.phases.length ?? 0,
      steps: page.journey?.lanes.reduce(
        (sum, lane) => sum + lane.cells.reduce((row, cell) => row + cell.steps.length, 0), 0,
      ) ?? 0,
      lanes: page.journey?.lanes.length ?? 0,
      capabilities: capabilities.length,
      uncovered: capabilities.filter((held) => held.coverage.coverage === 'uncovered').length,
    },
  }
}
