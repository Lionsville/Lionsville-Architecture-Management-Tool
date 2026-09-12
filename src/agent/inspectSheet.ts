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
 */
import { sheetPage } from '../business'
import type { Coverage } from '../business'
import type { Diagram, Model } from '../model/normalised'
import { toArrays } from '../model/normalised'
import type { ElementId } from '../model/types'

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
  /** The stakeholder rail; empty when the sheet does not draw it. */
  actors: { total: number; some: { id: ElementId; name: string; depth: number; outside: boolean }[] }
  areas: {
    total: number
    some: {
      id: ElementId
      name: string
      /** The domain it is assigned to, when its record says one. */
      domain?: string
      groupings: {
        id: ElementId
        name: string
        capabilities: {
          id: ElementId
          name: string
          depth: number
          coverage: Coverage
          supportedBy: ElementId[]
          assignedTo: ElementId[]
        }[]
      }[]
    }[]
  }
  /** Function roots no domain has been given and this sheet does not draw (§9). */
  unmapped: { total: number; some: { id: ElementId; name: string }[] }
  /** What the page adds up to, whatever the lists above had room for. */
  counts: {
    phases: number
    steps: number
    lanes: number
    capabilities: number
    uncovered: number
  }
}

export function inspectSheet(model: Model, diagram: Diagram, limit = SHEET_LIMIT): SheetReport {
  const arrays = toArrays(model)
  const page = sheetPage(arrays, diagram)

  const capabilities = page.areas.flatMap((area) =>
    area.groupings.flatMap((group) => group.capabilities))

  return {
    diagramId: diagram.id,
    name: diagram.name,
    kind: 'sheet',
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
      some: page.actors.slice(0, limit).map((row) => ({
        id: row.element.id, name: row.element.name, depth: row.depth, outside: row.outside,
      })),
    },
    areas: {
      total: page.areas.length,
      some: page.areas.slice(0, limit).map((area) => ({
        id: area.element.id,
        name: area.element.name,
        ...(area.domain !== undefined ? { domain: area.domain } : {}),
        groupings: area.groupings.map((group) => ({
          id: group.element.id,
          name: group.element.name,
          capabilities: group.capabilities.map((capability) => ({
            id: capability.element.id,
            name: capability.element.name,
            depth: capability.depth,
            coverage: capability.coverage.coverage,
            supportedBy: capability.coverage.supportedBy,
            assignedTo: capability.coverage.assignedTo,
          })),
        })),
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
