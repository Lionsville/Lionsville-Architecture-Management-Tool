// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart as two places read it (ADR-0036 §7): the page that
 * draws it, and — while nothing is picked — the inspector beside it, which
 * says what the chart says as a whole (3.6.1). Both read it here, so the
 * counts in one are the boxes in the other: the units on the day and the
 * people in them, and what the organisation contradicts about them, with how
 * many of those findings are about each unit, for what a folded unit says it
 * hides.
 */
import { useMemo } from 'react'
import { findingsByUnit, orgChart, walk } from '../../model/orgChart'
import type { OrgChart } from '../../model/orgChart'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import { findingsOfOrganisation } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import type { UnitViewsHere } from './unitViewsHere'

export type ChartReading = {
  chart: OrgChart
  /** What the organisation contradicts on the day about the units drawn and the people in them. */
  findings: readonly Finding[]
  /** How many of them are about each unit drawn. */
  byUnit: ReadonlyMap<ElementId, number>
}

export function useChartReading(here: UnitViewsHere, day: string, canonical: (id: PersonId) => PersonId): ChartReading {
  const chart = useMemo(
    () => orgChart(here.at.organisation, day, { include: here.includes, canonical }),
    [here, day, canonical],
  )
  return useMemo(() => {
    const units = new Set([...walk(chart.roots)].map((unit) => unit.id))
    const persons = new Set([...walk(chart.roots)].flatMap((unit) => [...unit.slots.flatMap((slot) => slot.holders), ...unit.others].map((one) => canonical(one.person))))
    const findings = findingsOfOrganisation(here.at, day, canonical)
      .filter((finding) => (finding.person !== undefined ? persons.has(canonical(finding.person)) : units.has(finding.id)))
    return { chart, findings, byUnit: findingsByUnit(chart, findings, canonical) }
  }, [here, chart, day, canonical])
}
