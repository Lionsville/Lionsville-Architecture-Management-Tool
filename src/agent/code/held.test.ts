// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The simulations held: a token good once, for a while, for whoever was
 * given it — and one answer for every way it is not.
 */
import { describe, expect, it } from 'vitest'
import { HELD_FOR_MS, MOST_HELD, heldSimulations } from './held'

const SCOPES = [{ scope: 'acme/retail', base: 4, commands: [], tools: ['element.add'], writes: 1 }]

describe('a simulation held', () => {
  it('is taken once by its token, by whoever it was given to', () => {
    const held = heldSimulations()
    const { token, expires } = held.hold('one', 'hash', SCOPES)
    expect(token).toMatch(/^sim_[0-9a-f]{32}$/)
    expect(expires).toBeGreaterThan(Date.now())
    expect(held.take('another', token)).toBeUndefined()
    expect(held.take('one', token)).toMatchObject({ hash: 'hash', scopes: SCOPES })
    expect(held.take('one', token)).toBeUndefined()
    expect(held.take('one', 'sim_nothing')).toBeUndefined()
  })

  it('gives no two the same token', () => {
    const held = heldSimulations()
    const tokens = new Set(Array.from({ length: 12 }, () => held.hold('one', 'hash', SCOPES).token))
    expect(tokens.size).toBe(12)
  })

  it('is let go after fifteen minutes', () => {
    let now = 1_800_000_000_000
    const held = heldSimulations(() => now)
    const { token } = held.hold('one', 'hash', SCOPES)
    now += HELD_FOR_MS - 1
    expect(held.count('one')).toBe(1)
    now += 1
    expect(held.count('one')).toBe(0)
    expect(held.take('one', token)).toBeUndefined()
  })

  it('is one of at most twenty for a caller: the oldest goes, and nobody else\'s', () => {
    const held = heldSimulations()
    const theirs = held.hold('another', 'hash', SCOPES).token
    const first = held.hold('one', 'hash', SCOPES).token
    for (let n = 1; n < MOST_HELD; n++) held.hold('one', 'hash', SCOPES)
    expect(held.count('one')).toBe(MOST_HELD)
    const newest = held.hold('one', 'hash', SCOPES).token
    expect(held.count('one')).toBe(MOST_HELD)
    expect(held.take('one', first)).toBeUndefined()
    expect(held.take('one', newest)).toBeDefined()
    expect(held.take('another', theirs)).toBeDefined()
  })
})
