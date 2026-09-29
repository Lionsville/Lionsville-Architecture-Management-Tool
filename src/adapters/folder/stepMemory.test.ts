// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { StepMemory, stepsInMemory } from './stepMemory'

describe('applied step ids', () => {
  it('remembers where a step went, through a store another opening reads', async () => {
    const store = stepsInMemory()
    await new StepMemory(store).remember([{ stepId: 'one', scope: 'acme' }])
    expect(await new StepMemory(store).where('one')).toBe('acme')
    expect(await new StepMemory(store).where('two')).toBeUndefined()
  })

  it('remembers for a day at least, and lets go after two', async () => {
    let now = 1_000_000
    const store = stepsInMemory()
    const memory = new StepMemory(store, () => now)
    await memory.remember([{ stepId: 'one', scope: 'acme' }])
    now += 24 * 60 * 60 * 1000
    expect(await memory.where('one')).toBe('acme')
    now += 24 * 60 * 60 * 1000
    expect(await memory.where('one')).toBeUndefined()
    await memory.remember([{ stepId: 'two', scope: 'acme' }])
    expect(Object.keys(await store.read() ?? {})).toEqual(['two'])
  })
})
