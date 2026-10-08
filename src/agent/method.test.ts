// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The method an agent is handed on connect says what the records are for
 * (ADR-0032 §10): a root cause is said by a person, and local and global are
 * places, not a permission.
 */
import { describe, expect, it } from 'vitest'
import { OBSERVATIONS_METHOD } from './method'

describe('the method sent on connect', () => {
  it('says a root cause is said by a person, and that the agent never says one on its own judgement', () => {
    expect(OBSERVATIONS_METHOD).toContain('A root cause is said by a person, never inferred')
    expect(OBSERVATIONS_METHOD).toContain('a cause nothing explains yet is an open end, not a root')
    expect(OBSERVATIONS_METHOD).toContain('Never make a cause a root cause, or a root cause a cause again, on your own judgement')
  })

  it('says local and global are places, not a permission, and that nothing is shared', () => {
    expect(OBSERVATIONS_METHOD).toContain('Local and global are places, not a permission')
    expect(OBSERVATIONS_METHOD).toContain('Nothing is shared')
    expect(OBSERVATIONS_METHOD).toContain('the scope below explains its own observations')
    expect(OBSERVATIONS_METHOD).not.toMatch(/\bshared observation\b|share it/)
  })

  it('says observations and causes are merged, what merge.plan is for, and that a merge may cross scopes', () => {
    expect(OBSERVATIONS_METHOD).toContain('is merged (observation.merge)')
    expect(OBSERVATIONS_METHOD).toContain('two causes that say the same thing are merged too (cause.merge)')
    expect(OBSERVATIONS_METHOD).toContain('merge.plan says what a merge would do')
    expect(OBSERVATIONS_METHOD).toContain('A merge may take records of any scope')
  })

  it('asks for where and by whom rather than guessing them', () => {
    expect(OBSERVATIONS_METHOD).toContain('Where and by whom are required: ask rather than guess')
  })
})
