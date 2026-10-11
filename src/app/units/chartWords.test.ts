// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the chart says beside a unit (ADR-0036 §7): the domains it serves by
 * name, and its days with the plan that brings or ends it.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { servesBadge, unitBadges } from './chartWords'
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
