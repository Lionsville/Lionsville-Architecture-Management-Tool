// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Finding something on the sheet by name (ADR-0012 §6).
 *
 * The page is laid out from the model's own trees, so "where is *dunning*" is
 * a question the laid-out page can answer and the model alone cannot: an
 * element that is not drawn — a function on a sheet that does not draw its
 * area, an actor when the rail is off — is not a hit, because there is nothing
 * to scroll to. The walk is in reading order, rail first and the unmapped band
 * last, so the list a person sees runs down the page the way the page does.
 *
 * The rule for "found" is the one every free-text filter uses
 * (`model/textSearch.matchesQuery`): case and accents folded, every word must
 * occur. Pure, so the list is pinned in node and the page only draws it.
 */
import type { DesignElement } from '../model'
import { matchesQuery } from '../model/textSearch'
import type { LaidOutSheet } from './sheet'

/** Which band a hit is drawn in; the page says the word for each. */
export type SheetBand = 'actor' | 'phase' | 'step' | 'area' | 'grouping' | 'capability' | 'unmapped'

export type SheetHit = {
  element: DesignElement
  band: SheetBand
  /** The name of what it sits in, where that helps tell two hits apart. */
  within?: string
}

/** Everything the page draws, in reading order. */
export function drawnOnSheet(page: LaidOutSheet): SheetHit[] {
  const hits: SheetHit[] = []
  for (const row of page.actors) hits.push({ element: row.element, band: 'actor' })
  if (page.journey) {
    const phaseName = new Map(page.journey.phases.map((phase) => [phase.id, phase.name]))
    for (const phase of page.journey.phases) {
      hits.push({ element: phase, band: 'phase', within: page.journey.element.name })
    }
    for (const lane of page.journey.lanes) {
      for (const cell of lane.cells) {
        for (const step of cell.steps) {
          hits.push({ element: step.element, band: 'step', within: phaseName.get(cell.phaseId) })
        }
      }
    }
  }
  for (const area of page.areas) {
    hits.push({ element: area.element, band: 'area' })
    for (const group of area.groupings) {
      hits.push({ element: group.element, band: 'grouping', within: area.element.name })
      for (const capability of group.capabilities) {
        hits.push({ element: capability.element, band: 'capability', within: group.element.name })
      }
    }
    for (const capability of area.capabilities) {
      hits.push({ element: capability.element, band: 'capability', within: area.element.name })
    }
  }
  for (const element of page.unmapped) hits.push({ element, band: 'unmapped' })
  return hits
}

/** The hits whose name matches `query`; every one of them for a blank query. */
export function findOnSheet(page: LaidOutSheet, query: string): SheetHit[] {
  return drawnOnSheet(page).filter((hit) => matchesQuery(query, [hit.element.name]))
}
