// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register's rules, written once (ADR-0036 §8–§10). The contract suite
 * holds every implementation to them through a repository; these hold the
 * rules themselves, where a repository would need a store to show them.
 */
import { describe, expect, it } from 'vitest'
import type { Person } from './person'
import { entriesOf, isEmail, isPeopleRefusal, isRedirect, mintPersonId, normalEmail, normalName, personFrom } from './person'
import { addedId, changePeople } from './register'
import type { ChangeAnswer, Changed } from './register'
import { drawPseudonym, isPseudonym, PSEUDONYM_ALPHABET } from './pseudonym'

let next = 0
const minting = {
  id: () => `pe-${String(++next).padStart(4, '0')}`,
  pseudonym: () => `B${String(next).padStart(3, '2')}`,
}

function done(answer: ChangeAnswer): Changed {
  if ('refused' in answer) throw new Error(`refused ${answer.refused}`)
  return answer
}

function added(people: readonly Person[], name: string, email?: string): { people: Person[]; id: string } {
  const answer = done(changePeople(people, { kind: 'add', person: { name, ...(email ? { email } : {}) } }, minting))
  return { people: answer.people, id: addedId(answer) }
}

describe('an entry', () => {
  it('is made with an id from nowhere near the name, a pseudonym, active and internal', () => {
    const { people, id } = added([], ' Pia  Schulz ', 'PIA@acme.example')
    expect(people).toEqual([{ id, name: 'Pia Schulz', email: 'pia@acme.example', pseudonym: expect.any(String), kind: 'internal', state: 'active' }])
  })

  it('mints ids none of the register holds', () => {
    let calls = 0
    const random = () => new Uint8Array(8).fill(calls++ < 2 ? 0 : 1)
    expect(mintPersonId(new Set(['pe-0000000000000000']), random)).toBe('pe-0101010101010101')
    expect(mintPersonId(new Set())).toMatch(/^pe-[0-9a-f]{16}$/)
  })

  it('reads back from a file tolerantly, dropping what an entry must not carry', () => {
    expect(personFrom({ id: 'pe-1', pseudonym: 'BCDF', name: 'Ada', email: 'ada@acme.example', state: 'active', kind: 'external', note: 'x' }))
      .toEqual({ id: 'pe-1', pseudonym: 'BCDF', name: 'Ada', email: 'ada@acme.example', state: 'active', kind: 'external' })
    expect(personFrom({ id: 'pe-1', pseudonym: 'BCDF', name: 'Ada', state: 'forgotten', forgottenOn: '2026-01-01', leftOn: '2025-12-01' }))
      .toEqual({ id: 'pe-1', pseudonym: 'BCDF', kind: 'internal', state: 'forgotten', forgottenOn: '2026-01-01', leftOn: '2025-12-01' })
    expect(personFrom({ id: 'pe-1', pseudonym: 'BCDF', name: 'Ada', mergedInto: 'pe-2', state: 'odd' }))
      .toEqual({ id: 'pe-1', pseudonym: 'BCDF', kind: 'internal', state: 'active', mergedInto: 'pe-2' })
    expect(personFrom({ id: 'pe-1' })).toBeUndefined()
    expect(personFrom({ pseudonym: 'BCDF' })).toBeUndefined()
    expect(personFrom([])).toBeUndefined()
    expect(personFrom('pe-1')).toBeUndefined()
  })

  it('says what is an address and how names and addresses are kept', () => {
    expect(isEmail(' a@b ')).toBe(true)
    expect(isEmail('a b@c')).toBe(false)
    expect(isEmail('nobody')).toBe(false)
    expect(normalEmail(' A@B.example ')).toBe('a@b.example')
    expect(normalName('  Eva   Lind ')).toBe('Eva Lind')
    expect(isPeopleRefusal('people.unknown')).toBe(true)
    expect(isPeopleRefusal('shell.scopeMoved')).toBe(false)
  })
})

describe('a pseudonym', () => {
  it('is four characters nobody misreads, and none the register holds', () => {
    const draws = [0, 0, 0, 0, 0.99, 0.5, 0.25, 0]
    let at = 0
    const code = drawPseudonym(new Set(['2222']), () => draws[at++ % draws.length])
    expect(code).toBe('ZH82')
    expect(isPseudonym(code)).toBe(true)
    expect(isPseudonym('ab12')).toBe(false)
    expect(isPseudonym('BCD')).toBe(false)
    expect(isPseudonym(7)).toBe(false)
    expect([...drawPseudonym(new Set())].every((character) => PSEUDONYM_ALPHABET.includes(character))).toBe(true)
  })

  it('grows a character once four are crowded', () => {
    const crowded = new Set(Array.from({ length: Math.ceil(PSEUDONYM_ALPHABET.length ** 4 / 2) }, (_, at) => String(at)))
    expect(drawPseudonym(crowded)).toHaveLength(5)
  })
})

describe('the changes', () => {
  it('refuses a correction, a leave or a forget of nobody, and of a redirect', () => {
    const one = added([], 'Eva Lind')
    const two = added(one.people, 'Eva Lindt')
    const merged = done(changePeople(two.people, { kind: 'merge', from: two.id, into: one.id }))
    expect(changePeople(merged.people, { kind: 'change', id: 'pe-x', patch: { name: 'X' } })).toEqual({ refused: 'people.unknown' })
    expect(changePeople(merged.people, { kind: 'change', id: two.id, patch: { name: 'X' } })).toEqual({ refused: 'people.merged' })
    expect(changePeople(merged.people, { kind: 'leave', id: two.id, on: '2026-10-11' })).toEqual({ refused: 'people.merged' })
    expect(changePeople(merged.people, { kind: 'forget', id: 'pe-x', on: '2026-10-11' })).toEqual({ refused: 'people.unknown' })
    expect(changePeople(merged.people, { kind: 'forget', id: one.id, on: 'soon' })).toEqual({ refused: 'people.badDay' })
    expect(changePeople(merged.people, { kind: 'remove', id: two.id })).toEqual({ refused: 'people.merged' })
    expect(changePeople(merged.people, { kind: 'merge', from: one.id, into: two.id })).toEqual({ refused: 'people.merged' })
    expect(isRedirect(merged.people[1])).toBe(true)
    expect(entriesOf(merged.people).map((person) => person.id)).toEqual([one.id])
  })

  it('refuses a correction that blanks the name or gives an address that is none', () => {
    const { people, id } = added([], 'Ada Verbeek')
    expect(changePeople(people, { kind: 'change', id, patch: { name: '  ' } })).toEqual({ refused: 'people.nameRequired' })
    expect(changePeople(people, { kind: 'change', id, patch: { email: 'none' } })).toEqual({ refused: 'people.badEmail' })
    expect(done(changePeople(people, { kind: 'change', id, patch: { email: '  ' } })).people[0].email).toBeUndefined()
    expect(changePeople(people, { kind: 'add', person: { name: '' } })).toEqual({ refused: 'people.nameRequired' })
  })

  it('repoints every redirect into an entry that is merged on, so none is longer than one step', () => {
    const a = added([], 'Noor Haddad')
    const b = added(a.people, 'Noor Hadad')
    const c = added(b.people, 'N. Haddad')
    const first = done(changePeople(c.people, { kind: 'merge', from: b.id, into: a.id }))
    const second = done(changePeople(first.people, { kind: 'merge', from: a.id, into: c.id }))
    expect(second.changed).toEqual([a.id, b.id])
    expect(second.people.find((person) => person.id === b.id)?.mergedInto).toBe(c.id)
  })

  it('brings entries in without giving a name back or undoing a merge, and changes nothing it already holds', () => {
    const a = added([], 'Gijs Mulder')
    const forgotten = done(changePeople(a.people, { kind: 'forget', id: a.id, on: '2026-10-11' }))
    const named: Person = { ...a.people[0] }
    const brought = done(changePeople(forgotten.people, { kind: 'bringIn', people: [named] }))
    expect(brought.changed).toEqual([])
    expect(brought.people[0].name).toBeUndefined()
    const left: Person = { ...forgotten.people[0], state: 'left' }
    expect(done(changePeople(forgotten.people, { kind: 'bringIn', people: [left] })).changed).toEqual([])
    const redirect: Person = { id: a.id, pseudonym: 'BCDF', kind: 'internal', state: 'active', mergedInto: 'pe-other' }
    expect(done(changePeople(forgotten.people, { kind: 'bringIn', people: [redirect] })).people[0].mergedInto).toBe('pe-other')
    expect(changePeople(a.people, { kind: 'merge', from: a.id, into: a.id })).toEqual({ refused: 'people.badMerge' })
  })

  it('takes the further state carried in, and an entry carried in at the same state as it comes', () => {
    const a = added([], 'Lotte Jansen', 'lotte@acme.example')
    const leftThere: Person = { ...a.people[0], state: 'left', leftOn: '2026-09-30' }
    expect(done(changePeople(a.people, { kind: 'bringIn', people: [leftThere] })).people[0]).toEqual(leftThere)
    const renamed: Person = { ...a.people[0], name: 'Lotte Jansen-Bos' }
    expect(done(changePeople(a.people, { kind: 'bringIn', people: [renamed] })).people[0].name).toBe('Lotte Jansen-Bos')
  })
})
