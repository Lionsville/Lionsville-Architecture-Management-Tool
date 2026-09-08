/**
 * Time on the facts (ADR-0009).
 *
 * The load-bearing test is the last one: a model that carries no dates answers
 * exactly what it answered before dates existed, on every day you can ask
 * about. Everything added in this phase is optional, and that test is what says
 * so — if it ever fails, this stopped being an addition and became a migration.
 */
import { describe, expect, it } from 'vitest'
import {
  connectionLiveAt, datesIn, datesInOrder, hasDates, isDay, phaseAt, today,
} from './lifecycle'
import type { DesignConnection, DesignElement, Lifecycle, LifecycleDates } from './types'

function element(lifecycle: Lifecycle, lifecycleDates?: LifecycleDates): DesignElement {
  return {
    id: 'wms', kind: 'application', name: 'Warehouse Management',
    lifecycle, lifecycleDates, isManaged: true, aspects: {},
  }
}

function connection(over: Partial<DesignConnection> = {}): DesignConnection {
  return { id: 'c1', sourceId: 'a', targetId: 'b', isBidirectional: false, ...over }
}

describe('isDay', () => {
  it('accepts a day', () => {
    expect(isDay('2026-09-08')).toBe(true)
    expect(isDay('2028-02-29')).toBe(true)
  })

  it('refuses what is not one', () => {
    expect(isDay('2026-02-31')).toBe(false)
    expect(isDay('2027-02-29')).toBe(false)
    expect(isDay('2026-13-01')).toBe(false)
    expect(isDay('2026-9-8')).toBe(false)
    expect(isDay('08-09-2026')).toBe(false)
    expect(isDay('')).toBe(false)
    expect(isDay(undefined)).toBe(false)
    expect(isDay(20260908)).toBe(false)
  })
})

describe('phaseAt', () => {
  it('answers the stored phase before any date has come', () => {
    const wms = element('planned', { live: '2027-04-01' })
    expect(phaseAt(wms, '2026-09-08')).toBe('planned')
    expect(phaseAt(wms, '2027-03-31')).toBe('planned')
  })

  it('moves on the day itself', () => {
    const wms = element('planned', { live: '2027-04-01' })
    expect(phaseAt(wms, '2027-04-01')).toBe('live')
  })

  it('walks the whole hybrid phase', () => {
    const old = element('live', { retiring: '2027-04-01', retired: '2028-01-31' })
    expect(phaseAt(old, '2026-12-31')).toBe('live')
    expect(phaseAt(old, '2027-06-01')).toBe('retiring')
    expect(phaseAt(old, '2028-01-31')).toBe('retired')
    expect(phaseAt(old, '2030-01-01')).toBe('retired')
  })

  it('lets a date that has passed overrule a stored phase that disagrees', () => {
    // "Planned", with a go-live two years ago, is a landscape nobody updated.
    // The date is the more specific statement.
    expect(phaseAt(element('planned', { live: '2024-01-01' }), '2026-09-08')).toBe('live')
  })

  it('ignores a date that is not a day rather than failing over it', () => {
    // The file is text a person may edit; a typo must not take a canvas down.
    expect(phaseAt(element('live', { retired: 'soon' as string }), '2030-01-01')).toBe('live')
  })
})

describe('datesInOrder', () => {
  it('accepts dates that run forwards, and a single date on its own', () => {
    expect(datesInOrder({ live: '2027-01-01', retiring: '2028-01-01', retired: '2029-01-01' })).toBe(true)
    // Plenty of things were there before anybody wrote a go-live down.
    expect(datesInOrder({ retired: '2029-01-01' })).toBe(true)
    expect(datesInOrder(undefined)).toBe(true)
    expect(datesInOrder({})).toBe(true)
  })

  it('accepts two phases on one day, which is what a same-day cutover is', () => {
    expect(datesInOrder({ retiring: '2028-01-01', retired: '2028-01-01' })).toBe(true)
  })

  it('refuses dates that run backwards', () => {
    expect(datesInOrder({ live: '2028-01-01', retiring: '2027-01-01' })).toBe(false)
    expect(datesInOrder({ retiring: '2028-06-01', retired: '2028-01-01' })).toBe(false)
  })
})

describe('connectionLiveAt', () => {
  it('draws a line with no window on every day', () => {
    expect(connectionLiveAt(connection(), '1999-01-01')).toBe(true)
    expect(connectionLiveAt(connection(), '2099-01-01')).toBe(true)
  })

  it('holds a line back until it starts, inclusive', () => {
    const sync = connection({ validFrom: '2027-04-01' })
    expect(connectionLiveAt(sync, '2027-03-31')).toBe(false)
    expect(connectionLiveAt(sync, '2027-04-01')).toBe(true)
  })

  it('keeps a line on its last day and not after it', () => {
    // `validUntil` is the day it is switched off, which is the day a person
    // writing it down means.
    const sync = connection({ validUntil: '2028-01-31' })
    expect(connectionLiveAt(sync, '2028-01-31')).toBe(true)
    expect(connectionLiveAt(sync, '2028-02-01')).toBe(false)
  })

  it('draws the temporary lines of a hybrid run only while it runs', () => {
    const facade = connection({ validFrom: '2027-04-01', validUntil: '2028-01-31' })
    expect(connectionLiveAt(facade, '2027-01-01')).toBe(false)
    expect(connectionLiveAt(facade, '2027-09-01')).toBe(true)
    expect(connectionLiveAt(facade, '2028-06-01')).toBe(false)
  })
})

describe('hasDates and datesIn', () => {
  it('knows whether anything says anything about time', () => {
    expect(hasDates(element('live'))).toBe(false)
    expect(hasDates(element('live', {}))).toBe(false)
    expect(hasDates(element('live', { retired: '2028-01-01' }))).toBe(true)
    expect(hasDates(connection())).toBe(false)
    expect(hasDates(connection({ validUntil: '2028-01-01' }))).toBe(true)
  })

  it('collects every day the model has an opinion about, once, in order', () => {
    expect(datesIn({
      elements: [
        element('live', { retiring: '2027-04-01', retired: '2028-01-31' }),
        element('planned', { live: '2027-04-01' }),
      ],
      connections: [connection({ validFrom: '2027-04-01', validUntil: '2028-01-31' })],
    })).toEqual(['2027-04-01', '2028-01-31'])
  })

  it('has no days for a landscape that carries none', () => {
    expect(datesIn({ elements: [element('live')], connections: [connection()] })).toEqual([])
  })
})

describe('today', () => {
  it('writes the day the way the model writes one', () => {
    expect(today(new Date(2026, 8, 8))).toBe('2026-09-08')
    expect(today(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(isDay(today())).toBe(true)
  })
})

describe('a landscape with no dates', () => {
  const DAYS = [
    '1970-01-01', '2020-06-15', '2026-09-08', '2027-04-01', '2030-12-31', '2099-01-01',
  ]

  it('answers its stored phase on every day there is', () => {
    // The property this whole phase rests on: everything added is optional, and
    // a project that ignores all of it behaves exactly as it did before.
    for (const lifecycle of ['planned', 'live', 'retiring', 'retired'] as const) {
      for (const day of DAYS) {
        expect(phaseAt(element(lifecycle), day), `${lifecycle} on ${day}`).toBe(lifecycle)
      }
    }
  })

  it('draws every line on every day there is', () => {
    for (const day of DAYS) expect(connectionLiveAt(connection(), day)).toBe(true)
  })
})
