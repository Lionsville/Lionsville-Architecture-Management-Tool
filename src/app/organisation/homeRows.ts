// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a scope's home says of each thing it holds, in one line each: led by the
 * name and the fact, because a count is what a person looks for and the
 * sentence about what a page is for helps once. What the scope does not hold
 * falls out of the rows into one line of names.
 *
 * Pure over what is already read (`organisationPages`), so nothing here loads
 * and a row cannot say anything its page would not.
 */
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import type { Language, Translate } from '../../i18n'
import { STATUS_LABEL as ADR_STATUS_LABEL } from '../../decisions'
import type { DesignDiagram } from '../../model'
import { STATE_LABEL as CAUSE_STATE_LABEL } from '../../observations/observationScope'
import { PLAN_STATUS_LABEL } from '../../roadmap/labels'
import { findingWords } from '../../roadmap/ui/FindingSentence'
import type { OrganisationPages, StatusTally } from './organisationPages'

/** "3 accepted, 1 proposed", in the vocabulary's own order and without zeroes. */
function tallyLine<T extends string>(tally: StatusTally<T>, label: Record<T, Parameters<Translate>[0]>, s: Translate): string {
  return tally.map((one) => s('org.statusCount', { count: one.count, status: s(label[one.status]).toLowerCase() })).join(', ')
}

const joined = (...parts: readonly string[]) => parts.filter(Boolean).join('. ')

/** What a view's row says after its name. */
export function viewFact(view: DesignDiagram, pages: OrganisationPages, language: Language, s: Translate): string {
  switch (view.kind) {
    case 'layer7':
    case 'container': {
      if (view.members.length === 0) return s('org.viewEmpty')
      const count = plural(s, { one: 'org.onItOne', other: 'org.onItOther' }, view.members.length)
      return view.asOf ? `${s('org.viewAsOf', { date: formatDay(view.asOf, language) })}, ${count}` : count
    }
    case 'sheet':
      return sheetFact(pages, s)
    case 'map':
      return pages.business.functions === 0 ? s('org.viewEmpty') : s('org.factLaidRows')
    case 'technology':
      return s('org.factLaidRows')
    case 'drawing':
      return view.drawing?.xml ? s('org.factDrawn') : s('org.viewEmpty')
    case 'chart':
      return s('org.factLaidUnits')
    case 'conway':
      return s('org.factConway')
    default: {
      const unexpected: never = view.kind
      return unexpected
    }
  }
}

export function sheetFact(pages: OrganisationPages, s: Translate): string {
  const { journeys, areas, functions, stakeholders, unmapped } = pages.business
  if (journeys + areas + functions + stakeholders === 0) return s('org.viewEmpty')
  return [
    plural(s, { one: 'org.journeysOne', other: 'org.journeysOther' }, journeys),
    plural(s, { one: 'org.areasOne', other: 'org.areasOther' }, areas),
    plural(s, { one: 'org.functionsOne', other: 'org.functionsOther' }, functions),
    plural(s, { one: 'org.stakeholdersOne', other: 'org.stakeholdersOther' }, stakeholders),
    unmapped > 0 ? plural(s, { one: 'org.unmappedOne', other: 'org.unmappedOther' }, unmapped) : '',
  ].filter(Boolean).join(', ')
}

/** The problems, the bright spots apart (ADR-0038 §6), the causes by state, and the root causes with how many a solution covers. */
export function observationsFact(pages: OrganisationPages, below: number, s: Translate): string {
  const counts = pages.observations
  const { total, bright, roots, solutions } = counts
  return [
    total > 0 ? plural(s, { one: 'org.observationsOne', other: 'org.observationsOther' }, total) : '',
    bright > 0 ? plural(s, { one: 'org.brightOne', other: 'org.brightOther' }, bright) : '',
    tallyLine(counts.causes, CAUSE_STATE_LABEL, s),
    roots > 0 && solutions > 0
      ? plural(s, { one: 'solution.coverageOne', other: 'solution.coverageOther' }, roots, { count: counts.covered, total: roots })
      : roots > 0 ? plural(s, { one: 'org.rootCausesOne', other: 'org.rootCausesOther' }, roots) : '',
    // What the scopes below observed (ADR-0032 §1): local to them, off the index.
    below > 0 ? plural(s, { one: 'org.localBelowOne', other: 'org.localBelowOther' }, below) : '',
  ].filter(Boolean).join(', ')
}

export function holdsObservations(pages: OrganisationPages, below: number): boolean {
  const { total, bright, causes } = pages.observations
  return total + bright + below > 0 || causes.length > 0
}

export function decisionsFact(pages: OrganisationPages, s: Translate): string {
  return tallyLine(pages.decisions.byStatus, ADR_STATUS_LABEL, s)
}

/** The plans, the initiatives from below, and the first thing the dates disagree about: the one sentence kept from the old card. */
export function roadmapFact(pages: OrganisationPages, initiatives: number, s: Translate): string {
  const { total, byStatus, finding } = pages.roadmap
  return joined(
    [
      total > 0 ? plural(s, { one: 'org.plansOne', other: 'org.plansOther' }, total) : '',
      tallyLine(byStatus, PLAN_STATUS_LABEL, s),
      initiatives > 0 ? plural(s, { one: 'org.initiativesOne', other: 'org.initiativesOther' }, initiatives) : '',
    ].filter(Boolean).join(', '),
    finding ? findingWords(finding, s) : '',
  )
}
