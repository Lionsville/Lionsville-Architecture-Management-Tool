// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The register as the shell holds it (ADR-0036 §13): a change answers once
 * the register has been read again, and what that read says is there to ask
 * at once — before anything is drawn — so an agent's next call names whom
 * its last one added. A read that answers after a later one changes nothing.
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Person } from '../../people/person'
import type { PeopleRead } from '../../ports/PeopleRepository'
import { heldRepositories } from '../testing/heldRepositories'
import { usePeopleRegister } from './usePeopleRegister'

const TODAY = '2026-10-11'
const names = (people: readonly Person[] | undefined) => (people ?? []).map((person) => person.name)

function mount(repositories = heldRepositories()) {
  return renderHook(() => usePeopleRegister({ repositories, readOnly: false, today: () => TODAY, failed: () => {} }))
}

describe('usePeopleRegister', () => {
  it('answers a change only once the register is read again, and says it before it is drawn', async () => {
    const { result } = mount()
    await waitFor(() => expect(result.current.people).toEqual([]))
    const drawn = result.current
    // One act: nothing is drawn until it ends.
    await act(async () => {
      const added = await drawn.agent.add({ name: 'Sara Kaya' })
      expect('person' in added).toBe(true)
      expect(names(drawn.current())).toEqual(['Sara Kaya'])
      expect(drawn.people).toEqual([])
    })
    expect(names(result.current.people)).toEqual(['Sara Kaya'])
  })

  it('keeps the newer register when an older read answers last', async () => {
    const repositories = heldRepositories()
    const { result } = mount(repositories)
    await waitFor(() => expect(result.current.people).toEqual([]))
    // Hold every read from here on, to answer them in the order the test says.
    const list = repositories.people.list.bind(repositories.people)
    const held: ((read: PeopleRead) => void)[] = []
    repositories.people.list = () => new Promise<PeopleRead>((resolve) => { held.push(resolve) })
    const before = await list()
    act(() => result.current.refresh())
    await repositories.people.add({ name: 'Ruben Dekker' })
    act(() => result.current.refresh())
    await waitFor(() => expect(held).toHaveLength(2))
    const after = await list()
    await act(async () => { held[1](after) })
    await waitFor(() => expect(names(result.current.current())).toEqual(['Ruben Dekker']))
    await act(async () => { held[0](before) })
    expect(names(result.current.current())).toEqual(['Ruben Dekker'])
    expect(names(result.current.people)).toEqual(['Ruben Dekker'])
  })
})
