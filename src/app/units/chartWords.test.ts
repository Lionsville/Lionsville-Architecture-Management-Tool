// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the chart says beside a unit (ADR-0036 §7): the domains it serves by
 * name, its days with the plan that brings or ends it, and what it hides when
 * it is folded; and what the whole chart holds, for its summary.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { rollUpWords, servesBadge, summaryWords, unitBadges } from './chartWords'
import type { BadgeReading } from './chartWords'

const t = translator('en')
const LABELS: Record<string, string> = { customer: 'Customer', shipping: 'Shipping', warehouse: 'Warehouse', finance: 'Finance', people: 'People' }
const scopeLabel = (path: string) => LABELS[path] ?? path
const reading = (over: Partial<BadgeReading> = {}): BadgeReading => ({
  day: '2026-10-11', today: '2026-10-11', language: 'en', t, scopeLabel, plans: {}, ...over,
})

describe('the domains a unit serves', () => {
  it('names each by its scope, up to three', () => {
    expect(servesBadge(['customer', 'shipping', 'warehouse'], scopeLabel, t)).toEqual({ key: 'serves', text: 'serves Customer · Shipping · Warehouse' })
  })

  it('names the first two of more, counts the rest, and keeps the whole list', () => {
    expect(servesBadge(['customer', 'shipping', 'warehouse', 'finance'], scopeLabel, t)).toEqual({
      key: 'serves', text: 'serves Customer · Shipping and 2 more', full: 'Customer · Shipping · Warehouse · Finance',
    })
  })
})

describe('a unit\'s badges', () => {
  it('says nothing of a unit serving one domain, there today with no end', () => {
    expect(unitBadges({ serves: ['shipping'], ended: false }, reading())).toEqual([])
  })

  it('says a start still to come and an end on the day or later, each with the plan that sets it', () => {
    const plans = { introduces: { id: 'tr-7', number: 7 }, retires: { id: 'tr-9', number: 9 } }
    const badges = unitBadges({ serves: [], begins: '2027-01-01', ends: '2027-06-30', ended: false }, reading({ plans }))
    expect(badges.map((one) => one.text)).toEqual(['from 1 Jan 2027 · TR-0007', 'ends 30 Jun 2027 · TR-0009'])
  })

  it('says the days alone where no plan sets them', () => {
    const badges = unitBadges({ serves: [], begins: '2027-01-01', ends: '2027-06-30', ended: false }, reading())
    expect(badges.map((one) => one.text)).toEqual(['from 1 Jan 2027', 'ends 30 Jun 2027'])
  })

  it('leaves a start that has come, and an end before the chart\'s day that left nobody behind', () => {
    expect(unitBadges({ serves: [], begins: '2026-01-01', ends: '2026-09-30', ended: false }, reading())).toEqual([])
  })

  it('says a unit has ended with people still in it, and the plan that ended it', () => {
    const badges = unitBadges({ serves: [], ends: '2026-12-31', ended: true }, reading({ day: '2027-01-01', plans: { retires: { id: 'tr-9', number: 9 } } }))
    expect(badges).toEqual([{ key: 'ended', text: 'ended 31 Dec 2026 · TR-0009 · people still assigned' }])
    expect(unitBadges({ serves: [], ends: '2026-12-31', ended: true }, reading({ day: '2027-01-01' }))[0].text).toBe('ended 31 Dec 2026 · people still assigned')
  })
})

describe('what a folded unit hides', () => {
  it('counts its units and people always, and its vacancies and findings where there are any, those marked', () => {
    expect(rollUpWords({ units: 4, people: 1, vacant: 0, findings: 0 }, t)).toEqual([
      { key: 'units', text: '4 units', warn: false }, { key: 'people', text: '1 person', warn: false },
    ])
    expect(rollUpWords({ units: 1, people: 12, vacant: 2, findings: 1 }, t).map((part) => [part.text, part.warn])).toEqual([
      ['1 unit', false], ['12 people', false], ['2 vacant', true], ['1 to look at', true],
    ])
  })

  it('says it in Dutch and German too', () => {
    const rolled = { units: 3, people: 9, vacant: 1, findings: 2 }
    expect(rollUpWords(rolled, translator('nl')).map((part) => part.text)).toEqual(['3 eenheden', '9 mensen', '1 vacature', '2 om naar te kijken'])
    expect(rollUpWords(rolled, translator('de')).map((part) => part.text)).toEqual(['3 Einheiten', '9 Personen', '1 unbesetzt', '2 zum Ansehen'])
  })
})

describe('what a whole chart holds, for its summary', () => {
  it('says its units and people, its vacancies where there are any, and never counts the findings it lists', () => {
    expect(summaryWords({ units: 13, people: 37, vacant: 0 }, t)).toEqual([
      { key: 'units', text: '13 units', warn: false }, { key: 'people', text: '37 people', warn: false },
    ])
    expect(summaryWords({ units: 1, people: 1, vacant: 2 }, t).map((part) => [part.text, part.warn])).toEqual([
      ['1 unit', false], ['1 person', false], ['2 vacant', true],
    ])
    expect(summaryWords({ units: 2, people: 3, vacant: 1 }, translator('nl')).map((part) => part.text)).toEqual(['2 eenheden', '3 mensen', '1 vacature'])
  })
})
