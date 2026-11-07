// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { ADR_STATUSES, adrMovesFrom } from '../model/adr'
import { ABOUT_THE_SCOPE, aboutOptions, movesOf, standingOf, stepsOf } from './adrList'

describe('where a record stands', () => {
  it('reads every status as open, in force or ended', () => {
    expect(ADR_STATUSES.map(standingOf)).toEqual(['open', 'open', 'inForce', 'ended', 'ended'])
  })

  it('has a verb for every move the machine allows, and one primary at most', () => {
    for (const status of ADR_STATUSES) {
      const moves = movesOf(status)
      expect(moves.map((one) => one.to)).toEqual(adrMovesFrom(status))
      expect(moves.every((one) => one.label !== 'adr.moveTo')).toBe(true)
      expect(moves.filter((one) => one.primary).length).toBeLessThanOrEqual(1)
    }
  })

  it('names what comes next, and keeps the end of a record out of the way', () => {
    expect(movesOf('proposed').find((one) => one.primary)?.to).toBe('reviewing')
    expect(movesOf('reviewing').find((one) => one.primary)?.to).toBe('accepted')
    expect(movesOf('accepted')).toEqual([expect.objectContaining({ to: 'superseded', more: true })])
  })

  it('steps through the life with one step current', () => {
    const say = (key: string) => key
    for (const status of ADR_STATUSES) {
      expect(stepsOf(status, say).filter((one) => one.state === 'current')).toHaveLength(1)
    }
    expect(stepsOf('superseded', say).map((one) => one.id)).toEqual(['proposed', 'reviewing', 'accepted', 'superseded'])
    expect(stepsOf('rejected', say).at(-1)?.id).toBe('rejected')
  })
})

describe('what a record is about', () => {
  const subjects = [{ id: 'billing', name: 'Billing' }, { id: 'crm', name: 'CRM' }]

  it('keeps every application, those with records first, and those that left the model', () => {
    const options = aboutOptions([{}, { subjectId: 'crm' }, { subjectId: 'crm' }, { subjectId: 'gone' }], subjects)
    expect(options.map((one) => [one.value, one.group, one.count])).toEqual([
      [ABOUT_THE_SCOPE, 'scope', 1], ['crm', 'withRecords', 2], ['billing', 'none', 0], ['gone', 'removed', 1],
    ])
  })
})
