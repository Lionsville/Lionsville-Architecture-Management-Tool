// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { StepMemory, stepsInMemory } from './stepMemory'

describe('applied step ids', () => {
  it('remembers where a step went, through a store another opening reads', async () => {
    const store = stepsInMemory()
    await new StepMemory(store).remember([{ stepId: 'one', scope: 'acme' }])
    expect(await new StepMemory(store).where('one')).toEqual({ scope: 'acme' })
    expect(await new StepMemory(store).where('two')).toBeUndefined()
  })

  it('remembers for a day at least, and lets go after two', async () => {
    let now = 1_000_000
    const store = stepsInMemory()
    const memory = new StepMemory(store, () => now)
    await memory.remember([{ stepId: 'one', scope: 'acme' }])
    now += 24 * 60 * 60 * 1000
    expect(await memory.where('one')).toEqual({ scope: 'acme' })
    now += 24 * 60 * 60 * 1000
    expect(await memory.where('one')).toBeUndefined()
    await memory.remember([{ stepId: 'two', scope: 'acme' }])
    expect(Object.keys(await store.read() ?? {})).toEqual(['two'])
  })

  it('remembers a step whose write was begun with what it was to leave, until it is known to have landed', async () => {
    const store = stepsInMemory()
    const memory = new StepMemory(store)
    await memory.pend([{ stepId: 'one', scope: 'acme', expected: 'after' }])
    expect(await new StepMemory(store).where('one')).toEqual({ scope: 'acme', expected: 'after' })
    await memory.remember([{ stepId: 'one', scope: 'acme' }])
    expect(await new StepMemory(store).where('one')).toEqual({ scope: 'acme' })
  })

  it('remembers a pending step as landed once its scope is read at what it was to leave, and forgets one refused', async () => {
    const memory = new StepMemory()
    await memory.pend([{ stepId: 'one', scope: 'acme', expected: 'after' }, { stepId: 'two', scope: 'acme', expected: 'other' }])
    await memory.promote('acme', 'after')
    expect(await memory.where('one')).toEqual({ scope: 'acme' })
    expect(await memory.where('two')).toEqual({ scope: 'acme', expected: 'other' })
    await memory.forget(['one', 'two'])
    expect(await memory.where('one')).toEqual({ scope: 'acme' })
    expect(await memory.where('two')).toBeUndefined()
  })
})
