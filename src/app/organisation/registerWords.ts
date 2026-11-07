// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register's rows said in words, and the sentence over each tab that says how
 * much of the tree it covers: a derived list can look complete when it is not,
 * and a row in one scope of sixty-seven reads as coverage it does not have.
 */
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import { PLATFORM_ARCHETYPE_LABEL } from '../../model'
import type { Lifecycle } from '../../model'
import type { PersonRef } from '../../model/person'
import { refText } from '../../model/person'
import type { ScopePath } from '../../projects/scopePath'
import type { TechnologyRow } from '../../projects/technologyRegister'
import { technologySummary } from '../../projects/technologyRegister'
import type { RegisterRow } from './register'
import { isUnattributed, registerSummary } from './register'
import { keptIn, platformsOf, servicesOf } from './registerView'
import type { RegisterTab, RegisterWords } from './registerView'

const LIFECYCLE_KEY = {
  planned: 'lifecycle.planned', live: 'lifecycle.live', retiring: 'lifecycle.retiring', retired: 'lifecycle.retired',
} as const satisfies Record<Lifecycle, string>

export function registerWords(s: Translate, language: Language, scopeName: (path: ScopePath) => string, nameOf: (ref: PersonRef) => string = (ref) => refText(ref) ?? ''): RegisterWords {
  const nobody = s('register.nobody')
  const ownerKind: RegisterWords['ownerKind'] = (row) => {
    if (row.outside) return 'outside'
    if (row.owner.kind === 'unit') return 'unit'
    return row.owner.kind === 'named' ? 'named' : 'nobody'
  }
  return {
    scopeName,
    nobody,
    ownerKind,
    owner: (row) => {
      if (row.outside) return row.party !== undefined ? s('register.ownerOutside', { name: row.party }) : s('register.outsideUnattributed')
      if (row.owner.kind === 'unit') return row.ownerUnit ?? row.owner.unitId
      if (row.owner.kind === 'named') return s('register.ownerNamed', { name: nameOf(row.owner.name) })
      return nobody
    },
    lifecycle: ({ lifecycle = 'live', lifecycleDates }) => {
      const word = s(LIFECYCLE_KEY[lifecycle])
      const day = lifecycle === 'retiring' ? lifecycleDates?.retired ?? lifecycleDates?.retiring : lifecycle === 'retired' ? lifecycleDates?.retired : undefined
      return day !== undefined ? `${word} ${formatDay(day, language)}` : word
    },
    archetype: (row) => s(PLATFORM_ARCHETYPE_LABEL[row.platformArchetype ?? 'service']),
    shared: (row, offered) => (row.shared ? s('techRegister.shared') : offered ? s('register.notMarkedShared') : s('techRegister.ownTeam')),
    partOf: (row) => {
      if (row.partOf) return row.partOf.name
      if (row.outside) return row.party !== undefined ? s('register.ownerOutside', { name: row.party }) : s('register.outsideUnattributed')
      return s('register.nothingAbove')
    },
    delivers: (row) => (row.realises.length ? row.realises.map((one) => one.name).join(', ') : s('techRegister.realisesNothing')),
    deliveredBy: (row) => (row.realisedBy.length ? row.realisedBy.map((one) => one.name).join(', ') : s('register.nothing')),
    maintainedBy: (row) => (row.maintainers.length ? row.maintainers.map((one) => one.name).join(', ') : s('techRegister.nobodyMaintains')),
    hasFindings: (has) => (has ? s('register.withFindings') : s('register.withoutFindings')),
  }
}

/** What a tab covers, in one sentence, and then what it disagrees about; nothing is said of what is fine. */
export function coverageSentence(
  tab: RegisterTab, applications: readonly RegisterRow[], technology: readonly TechnologyRow[], scopes: number, s: Translate,
): string {
  if (tab === 'applications') {
    if (applications.length === 0) return s('register.nothingYet')
    const summary = registerSummary(applications)
    const kept = keptIn(applications)
    const named = plural(s, { one: 'register.applicationsOne', other: 'register.applicationsOther' }, summary.applications)
    const whole = kept.most === summary.applications
      ? s('register.coverAll', { what: named, kept: kept.scopes, scopes })
      : s('register.coverMost', { what: named, most: kept.most, kept: kept.scopes, scopes })
    return [
      whole,
      summary.outside > 0 ? plural(s, { one: 'register.coverOutsideOne', other: 'register.coverOutsideOther' }, summary.outside) : '',
      summary.unowned > 0 ? plural(s, { one: 'register.coverUnownedOne', other: 'register.coverUnownedOther' }, summary.unowned) : '',
      summary.definedTwice > 0 ? `${plural(s, { one: 'register.definedTwiceOne', other: 'register.definedTwiceOther' }, summary.definedTwice)}.` : '',
      summary.unattributed > 0 ? `${plural(s, { one: 'register.unattributedOne', other: 'register.unattributedOther' }, applications.filter(isUnattributed).length)}.` : '',
      summary.stale > 0 ? `${plural(s, { one: 'register.staleOne', other: 'register.staleOther' }, summary.stale)}.` : '',
    ].filter(Boolean).join(' ')
  }
  const rows = tab === 'services' ? servicesOf(technology) : platformsOf(technology)
  if (rows.length === 0) return s('register.nothingYet')
  const summary = technologySummary(technology)
  if (tab === 'services') {
    return `${[
      plural(s, { one: 'techRegister.servicesOne', other: 'techRegister.servicesOther' }, summary.services),
      plural(s, { one: 'techRegister.sharedOne', other: 'techRegister.sharedOther' }, summary.shared),
      summary.unrealised > 0 ? plural(s, { one: 'techRegister.unrealisedOne', other: 'techRegister.unrealisedOther' }, summary.unrealised) : '',
      summary.offeredNotShared > 0 ? plural(s, { one: 'techRegister.offeredOne', other: 'techRegister.offeredOther' }, summary.offeredNotShared) : '',
    ].filter(Boolean).join(', ')}.`
  }
  const outside = rows.filter((row) => row.outside).length
  const named = plural(s, { one: 'techRegister.platformsOne', other: 'techRegister.platformsOther' }, rows.length)
  return outside > 0 ? s('register.platformsOutside', { what: named, outside }) : `${named}.`
}
