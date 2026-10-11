// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Leaving, and what it does beyond the register (ADR-0036 §10): the seam the
 * step that brings assignments hooks into, and *What we hold*.
 */
import { describe, expect, it } from 'vitest'
import { holdText, keptName, pointerLine, ruleLine, whatWeHold } from './hold'
import { forgetPerson, leavePerson, mergePerson } from './leave'
import type { LeaveConsequence, LeavingRegister, MergingRegister } from './leave'
import type { Person } from './person'
import { changePeople } from './register'

function registerOver(start: Person[]): LeavingRegister & MergingRegister & { people: () => Person[] } {
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
    merge: (from, into, leaving) => run({ kind: 'merge', from, into, ...(leaving ? { leaving } : {}) }, into),
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

  it('runs nothing more where the register did what leaving does itself, and says how much it ended', async () => {
    // A register that ends a leaver's assignments as it marks them, as a server may, says so with `ended`.
    const inner = registerOver([ada, { ...ada, id: 'pe-bo', name: 'Bo Visser' }])
    const register: LeavingRegister = {
      endsAssignments: true,
      read: inner.read,
      leave: async (id, on) => { const answer = await inner.leave(id, on); return 'refused' in answer ? answer : { ...answer, ended: 3 } },
      forget: async (id, on) => { const answer = await inner.forget(id, on); return 'refused' in answer ? answer : { ...answer, ended: 2 } },
    }
    let ran = 0
    const consequence: LeaveConsequence = () => { ran += 1; return Promise.resolve(9) }
    expect(await leavePerson(register, [consequence], 'pe-ada', '2026-10-31')).toMatchObject({ person: { state: 'left' }, ended: 3 })
    expect(await forgetPerson(register, [consequence], 'pe-bo', '2026-10-31')).toMatchObject({ person: { state: 'forgotten' }, ended: 2 })
    expect(ran).toBe(0)
  })
})

/**
 * A merge of somebody active into an entry that has left (ADR-0036 §9): told
 * *left*, the absorbed entry's roles end on the leaving day by leaving's own
 * consequences — first, and the register after — and told *still here*, nothing
 * ends and the leaving is cleared.
 */
describe('merging into an entry that has left', () => {
  const gone: Person = { ...ada, id: 'pe-gone', state: 'left', leftOn: '2026-03-31' }
  const twin: Person = { ...ada, id: 'pe-twin', name: 'Ada Verbeek-Smit', email: undefined, pseudonym: 'GHJK' }

  it('ends the absorbed entry\'s roles on the leaving day first, then merges, when told left', async () => {
    const register = registerOver([gone, twin])
    const seen: string[] = []
    const ends: LeaveConsequence = (person, lastDay) => {
      seen.push(`${person.id} ${lastDay} ${register.people().find((one) => one.id === 'pe-twin')?.mergedInto ?? 'not yet merged'}`)
      return Promise.resolve(2)
    }
    expect(await mergePerson(register, [ends], 'pe-twin', 'pe-gone', 'left')).toMatchObject({ person: { id: 'pe-gone', state: 'left' }, ended: 2 })
    expect(seen).toEqual(['pe-twin 2026-03-31 not yet merged'])
  })

  it('ends nothing when told still here, and the leaving is cleared', async () => {
    const register = registerOver([gone, twin])
    let ran = false
    const answer = await mergePerson(register, [() => { ran = true; return Promise.resolve(1) }], 'pe-twin', 'pe-gone', 'stillHere')
    expect(answer).toMatchObject({ person: { id: 'pe-gone', state: 'active' }, ended: 0 })
    expect(ran).toBe(false)
  })

  it('ends nothing where the register refuses, and is refused where it is told nothing', async () => {
    const register = registerOver([gone, twin])
    let ran = false
    const consequence: LeaveConsequence = () => { ran = true; return Promise.resolve(1) }
    expect(await mergePerson(register, [consequence], 'pe-twin', 'pe-gone')).toEqual({ refused: 'people.mergeAsks' })
    expect(await mergePerson(register, [consequence], 'pe-twin', 'pe-twin', 'left')).toEqual({ refused: 'people.badMerge' })
    expect(ran).toBe(false)
  })

  it('leaves the ending to a register that ends assignments itself', async () => {
    const inner = registerOver([gone, twin])
    const told: (string | undefined)[] = []
    const register: MergingRegister = {
      endsAssignments: true,
      read: inner.read,
      merge: async (from, into, leaving) => {
        told.push(leaving)
        const answer = await inner.merge(from, into, leaving)
        return 'refused' in answer ? answer : { ...answer, ended: 4 }
      },
    }
    let ran = 0
    expect(await mergePerson(register, [() => { ran += 1; return Promise.resolve(9) }], 'pe-twin', 'pe-gone', 'left')).toMatchObject({ ended: 4 })
    expect([ran, told]).toEqual([0, ['left']])
  })
})

describe('what we hold', () => {
  it('says the entry, what was merged into it, and what points at it, as one document', () => {
    const merged: Person = { id: 'pe-was', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-ada' }
    const held = whatWeHold(ada, [ada, merged], { thisIsMe: true, mentions: [{ scope: 'acme', kind: 'observation', id: 'ob-1', title: 'Seen by Ada' }] })
    expect(held).toEqual({
      register: { id: 'pe-ada', name: 'Ada Verbeek', email: 'ada@acme.example', pseudonym: 'BCDF', kind: 'internal', state: 'active', leftOn: null, forgottenOn: null },
      mergedFrom: ['pe-was'], thisIsMe: true, assignments: [], namedIn: [], signed: [], derived: [],
      mentions: [{ scope: 'acme', kind: 'observation', id: 'ob-1', title: 'Seen by Ada' }],
    })
    expect(JSON.parse(holdText(held))).toEqual(held)
    const gone = whatWeHold({ id: 'pe-g', pseudonym: '7KQM', kind: 'external', state: 'forgotten', leftOn: '2026-01-01', forgottenOn: '2026-04-01' }, [])
    expect(gone.register).toMatchObject({ name: null, email: null, forgottenOn: '2026-04-01' })
    expect(gone.thisIsMe).toBe(false)
  })
})

describe('what points at a person, as lines of what we hold', () => {
  it('says the record, the field and the scope — and for a kept name, the name as signed or proposed', () => {
    expect(pointerLine({ scope: 'retail', kind: 'plan', id: 'tr-1', label: 'TR-0001', title: 'Replace', field: 'owner', person: 'pe-ada' }))
      .toBe('TR-0001 Replace (retail): owner')
    expect(pointerLine({ scope: '', kind: 'element', id: 'crm', title: 'CRM', field: 'owner', person: 'pe-ada' })).toBe('CRM (the organisation): owner')
    expect(pointerLine({ scope: '', kind: 'decision', id: 'ad-1', label: 'ADR-0001', title: 'One store', field: 'proposed', person: 'pe-ada', signedAs: 'Ada Verbeek' }))
      .toBe('ADR-0001 One store (the organisation), proposed as Ada Verbeek')
    expect(keptName({ signedAs: 'Ada' })).toBe(true)
    expect(keptName({})).toBe(false)
  })

  it('says what a rule makes them own, an application by name and a domain by its scope', () => {
    expect(ruleLine({ kind: 'application', scope: 'retail', id: 'shop', name: 'Shop', day: '2026-10-11' })).toBe('Owner of Shop (retail) on 2026-10-11, worked out from the role')
    expect(ruleLine({ kind: 'domain', scope: 'retail', id: 'retail', name: '', day: '2026-10-11' })).toBe('Owner of the domain retail on 2026-10-11, worked out from the role')
    expect(ruleLine({ kind: 'domain', scope: '', id: '', name: 'Acme', day: '2026-10-11' })).toBe('Owner of the domain Acme on 2026-10-11, worked out from the role')
  })
})
