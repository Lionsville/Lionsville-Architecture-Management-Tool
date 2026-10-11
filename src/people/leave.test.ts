// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Leaving, and what it does beyond the register (ADR-0036 §10): the seam the
 * step that brings assignments hooks into, and *What we hold*.
 */
import { describe, expect, it } from 'vitest'
import { holdText, whatWeHold } from './hold'
import { forgetPerson, leavePerson } from './leave'
import type { LeaveConsequence, LeavingRegister } from './leave'
import type { Person } from './person'
import { changePeople } from './register'

function registerOver(start: Person[]): LeavingRegister & { people: () => Person[] } {
  let people = start
  const run = (change: Parameters<typeof changePeople>[1], id: string) => {
    const answer = changePeople(people, change)
    if ('refused' in answer) return Promise.resolve(answer)
    people = answer.people
    return Promise.resolve({ person: people.find((one) => one.id === id)! })
  }
  return {
    people: () => people,
    read: (id) => Promise.resolve(people.find((one) => one.id === id)),
    leave: (id, on) => run({ kind: 'leave', id, on }, id),
    forget: (id, on) => run({ kind: 'forget', id, on }, id),
  }
}

const ada: Person = { id: 'pe-ada', name: 'Ada Verbeek', email: 'ada@acme.example', pseudonym: 'BCDF', kind: 'internal', state: 'active' }

describe('leaving', () => {
  it('marks the register first, then runs every consequence with the person and their last day', async () => {
    const register = registerOver([ada])
    const seen: [string, string, string][] = []
    const ends: LeaveConsequence = (person, lastDay) => {
      seen.push([person.id, person.state, lastDay])
      return Promise.resolve(2)
    }
    const left = await leavePerson(register, [ends, () => Promise.resolve(1)], 'pe-ada', '2026-10-31')
    expect(left).toMatchObject({ person: { state: 'left', leftOn: '2026-10-31' }, ended: 3 })
    expect(seen).toEqual([['pe-ada', 'left', '2026-10-31']])
  })

  it('runs no consequence where the register refuses', async () => {
    let ran = false
    const register = registerOver([ada])
    const refused = await leavePerson(register, [() => { ran = true; return Promise.resolve(1) }], 'pe-nobody', '2026-10-31')
    expect(refused).toEqual({ refused: 'people.unknown' })
    expect(ran).toBe(false)
  })

  it('treats forgetting someone still active as their leaving that day, and someone who left as nothing more', async () => {
    const register = registerOver([ada, { ...ada, id: 'pe-gone', state: 'left', leftOn: '2026-01-01' }])
    const ran: string[] = []
    const consequence: LeaveConsequence = (person) => { ran.push(person.id); return Promise.resolve(1) }
    expect(await forgetPerson(register, [consequence], 'pe-ada', '2026-10-11')).toMatchObject({ person: { state: 'forgotten' }, ended: 1 })
    expect(await forgetPerson(register, [consequence], 'pe-gone', '2026-10-11')).toMatchObject({ ended: 0 })
    expect(ran).toEqual(['pe-ada'])
    expect(await forgetPerson(register, [consequence], 'pe-gone', '2026-10-12')).toEqual({ refused: 'people.forgotten' })
  })
})

describe('what we hold', () => {
  it('says the entry, what was merged into it, and what points at it, as one document', () => {
    const merged: Person = { id: 'pe-was', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-ada' }
    const held = whatWeHold(ada, [ada, merged], { thisIsMe: true, mentions: [{ scope: 'acme', kind: 'observation', id: 'ob-1', title: 'Seen by Ada' }] })
    expect(held).toEqual({
      register: { id: 'pe-ada', name: 'Ada Verbeek', email: 'ada@acme.example', pseudonym: 'BCDF', kind: 'internal', state: 'active', leftOn: null, forgottenOn: null },
      mergedFrom: ['pe-was'], thisIsMe: true, assignments: [], namedIn: [],
      mentions: [{ scope: 'acme', kind: 'observation', id: 'ob-1', title: 'Seen by Ada' }],
    })
    expect(JSON.parse(holdText(held))).toEqual(held)
    const gone = whatWeHold({ id: 'pe-g', pseudonym: '7KQM', kind: 'external', state: 'forgotten', leftOn: '2026-01-01', forgottenOn: '2026-04-01' }, [])
    expect(gone.register).toMatchObject({ name: null, email: null, forgottenOn: '2026-04-01' })
    expect(gone.thisIsMe).toBe(false)
  })
})
