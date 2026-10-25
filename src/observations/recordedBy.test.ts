// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { isMine, whoRecords } from './recordedBy'

describe('who records (ADR-0038, amended §10)', () => {
  it('is the account where the source has accounts, with the entry it is linked to', () => {
    expect(whoRecords({ id: 'acc-1', name: 'Ada' }, { id: 'pe-1', name: 'Ada Example' }))
      .toEqual({ name: 'Ada', account: 'acc-1', person: 'pe-1' })
    expect(whoRecords({ id: 'acc-1', name: 'Ada' }, undefined)).toEqual({ name: 'Ada', account: 'acc-1' })
  })

  it('is This is me on a source with no accounts', () => {
    expect(whoRecords(undefined, { id: 'pe-1', name: 'Ada Example' })).toEqual({ name: 'Ada Example', person: 'pe-1' })
  })

  it('is nobody with neither, rather than a word that names no one', () => {
    expect(whoRecords(undefined, undefined)).toBeUndefined()
    expect(whoRecords(undefined, { id: 'pe-1', name: '' })).toBeUndefined()
  })

  it('says the agent an agent recorded through', () => {
    expect(whoRecords(undefined, { id: 'pe-1', name: 'Ada' }, 'An agent')).toEqual({ name: 'Ada', person: 'pe-1', via: 'An agent' })
  })
})

describe('mine', () => {
  it('is recorded by my account, by the person I am, or seen by that person', () => {
    expect(isMine({ recordedBy: { name: 'Ada', account: 'acc-1' } }, 'acc-1', undefined)).toBe(true)
    expect(isMine({ recordedBy: { name: 'Ada', person: 'pe-1' } }, undefined, 'pe-1')).toBe(true)
    expect(isMine({ by: { person: 'pe-1' } }, undefined, 'pe-1')).toBe(true)
  })

  it('is not somebody else\'s, a name typed in, or anything with nobody said', () => {
    expect(isMine({ recordedBy: { name: 'Bo', account: 'acc-2' } }, 'acc-1', 'pe-1')).toBe(false)
    expect(isMine({ by: 'Ada Example' }, 'acc-1', 'pe-1')).toBe(false)
    expect(isMine({ recordedBy: { name: 'Ada', person: 'pe-1' } }, undefined, undefined)).toBe(false)
  })
})
