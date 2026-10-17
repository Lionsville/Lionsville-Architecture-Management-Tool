// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the organisation chart and the Conway map say beside a unit (ADR-0036
 * §7), in words: the domains it serves, by name, and the days it starts and
 * ends, each with the plan that brings it or ends it where a plan does.
 *
 * A badge names rather than counts. *Serves 3 domains* sends the reader to
 * the inspector to find out which; *serves Customer · Shipping · Warehouse*
 * is the answer. A unit serving many is named in part, with how many more,
 * and the whole list goes with it for a tooltip.
 *
 * A folded unit counts, because it stands for what it hides: its units, the
 * people in them, and — only where there are any — the vacancies and the
 * findings, which are what a reader unfolds it for. The chart's summary
 * counts the same way, for the whole chart, and lists its findings rather
 * than counting them.
 *
 * A unit type's name is shortened over a box (3.7.3): a chart of many small
 * boxes spent a line of each on *Organisational unit*, so a word longer than
 * {@link TYPE_WORD_KEPT} letters is cut, and the whole name goes with it for
 * hover and for assistive technology (`TypeLabel`).
 */
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import type { ChartRollUp, ChartUnit } from '../../model/orgChart'
import { transitionLabel } from '../../model/transition'
import type { ScopePath } from '../../projects/scopePath'
import type { UnitPlans } from './unitViewsHere'

/** How many domains a badge names in full; beyond it, it names one fewer and counts the rest. */
export const SERVES_NAMED = 3

/** One thing said beside a unit's name, and — where it is shortened — the whole of it. */
export type UnitBadge = { key: 'serves' | 'begins' | 'ends' | 'ended'; text: string; full?: string }

/**
 * The domains a unit serves, by their scopes' names: every one up to
 * {@link SERVES_NAMED}, and past that the first few and how many more —
 * never *and 1 more*, which is longer than the name it hides.
 */
export function servesBadge(scopes: readonly ScopePath[], scopeLabel: (path: ScopePath) => string, t: Translate): UnitBadge {
  const names = scopes.map(scopeLabel)
  const full = names.join(' · ')
  if (names.length <= SERVES_NAMED) return { key: 'serves', text: t('chart.serves', { names: full }) }
  const named = SERVES_NAMED - 1
  return { key: 'serves', text: t('chart.servesMore', { names: names.slice(0, named).join(' · '), count: names.length - named }), full }
}

/** What a chart reads a unit's badges with. */
export type BadgeReading = {
  /** The chart's day: a unit's end is said while it is still to come on it. */
  day: string
  /** A unit's start is said while it is still to come today. */
  today: string
  language: Language
  t: Translate
  scopeLabel: (path: ScopePath) => string
  plans: UnitPlans
}

/**
 * Beside a unit's name: the domains it serves where it serves more than one;
 * the day it starts, where that is after today; and the day it ends, where
 * that is on the chart's day or later — or that it has ended, people still in
 * it. A start and an end name the plan that introduces or retires the unit.
 */
export function unitBadges(unit: Pick<ChartUnit, 'serves' | 'begins' | 'ends' | 'ended'>, at: BadgeReading): UnitBadge[] {
  const { t, language, plans } = at
  const badges: UnitBadge[] = []
  if (unit.serves.length > 1) badges.push(servesBadge(unit.serves, at.scopeLabel, t))
  if (unit.begins !== undefined && unit.begins > at.today) {
    const day = formatDay(unit.begins, language)
    badges.push({ key: 'begins', text: plans.introduces ? t('chart.beginsBy', { day, plan: transitionLabel(plans.introduces) }) : t('chart.begins', { day }) })
  }
  if (unit.ends === undefined) return badges
  const day = formatDay(unit.ends, language)
  const plan = plans.retires ? transitionLabel(plans.retires) : undefined
  if (unit.ended) badges.push({ key: 'ended', text: plan ? t('chart.endedBy', { day, plan }) : t('chart.ended', { day }) })
  else if (unit.ends >= at.day) badges.push({ key: 'ends', text: plan ? t('chart.endsBy', { day, plan }) : t('chart.ends', { day }) })
  return badges
}

/** One part of what a folded unit says it hides; `warn` for the parts worth unfolding it for. */
export type RollUpPart = { key: 'units' | 'people' | 'vacant' | 'findings'; text: string; warn: boolean }

/** What a folded unit hides, in words: its units and people always, its vacancies and findings where there are any. */
export function rollUpWords(rolled: ChartRollUp, t: Translate): RollUpPart[] {
  const parts: RollUpPart[] = [
    { key: 'units', text: plural(t, { one: 'chart.rollUnitsOne', other: 'chart.rollUnitsOther' }, rolled.units), warn: false },
    { key: 'people', text: plural(t, { one: 'chart.rollPeopleOne', other: 'chart.rollPeopleOther' }, rolled.people), warn: false },
  ]
  if (rolled.vacant > 0) parts.push({ key: 'vacant', text: plural(t, { one: 'chart.rollVacantOne', other: 'chart.rollVacantOther' }, rolled.vacant), warn: true })
  if (rolled.findings > 0) parts.push({ key: 'findings', text: plural(t, { one: 'chart.rollFindingsOne', other: 'chart.rollFindingsOther' }, rolled.findings), warn: true })
  return parts
}

/**
 * What a whole chart holds, in words, for its summary beside it (3.6.1): its
 * units and people always, its vacancies where there are any — the findings
 * are listed under it, so they are not counted.
 */
export function summaryWords(held: Pick<ChartRollUp, 'units' | 'people' | 'vacant'>, t: Translate): RollUpPart[] {
  return rollUpWords({ ...held, findings: 0 }, t)
}

/** A reader's letters: an accent written as a mark after its letter is still one. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The longest word a unit type's name keeps whole on the chart; a longer one keeps {@link TYPE_WORD_CUT} letters and a full stop. */
export const TYPE_WORD_KEPT = 7
export const TYPE_WORD_CUT = 6

/**
 * A unit type's name as the chart's boxes and outline show it (3.7.3): each
 * word longer than {@link TYPE_WORD_KEPT} letters cut to its first
 * {@link TYPE_WORD_CUT} and a full stop, word by word — *Organisational unit*
 * is *Organi. unit* — and everything between the words as it was. Letters
 * are counted as a reader counts them, so an accented one is one.
 */
export function shortTypeName(name: string): string {
  return name.replace(/\S+/gu, (word) => {
    const letters = Array.from(GRAPHEMES.segment(word), (part) => part.segment)
    return letters.length > TYPE_WORD_KEPT ? `${letters.slice(0, TYPE_WORD_CUT).join('')}.` : word
  })
}
