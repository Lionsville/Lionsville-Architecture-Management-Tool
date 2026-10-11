// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every change to the register does, written once (ADR-0036): every
 * place that keeps a register — memory, this browser, a folder, a server —
 * reads its entries, hands them here, and keeps what comes back. So the rules
 * are the same wherever the register lives, the way `scopeState.applySteps`
 * is the one writer every scope repository shares.
 *
 * Each change answers the register as it now is and the ids it changed or
 * removed — what a repository's *since* says — or a refusal, as a value with
 * a key, and nothing changed.
 *
 * - **Add** makes an entry: a fresh id, a pseudonym, active.
 * - **Change** corrects a name, an address or a kind.
 * - **Leave** marks someone as left on a day. What leaving does beyond the
 *   register — ending their assignments — is not the register's: see
 *   `leave.ts`.
 * - **Merge** keeps one entry and turns the other into a redirect with no
 *   name, so every id the history holds still resolves. Final.
 * - **Forget** takes the name and the address away; the entry reads as its
 *   pseudonym from then on. Final: the register keeps no history of a name.
 * - **Remove** takes a forgotten entry away, and every redirect into it, after
 *   which a reference to it reads *a former colleague*.
 * - **Bring in** takes entries carried from elsewhere — a working file — by
 *   their ids, and never gives a name back to an entry forgotten here.
 */
import { isDay } from '../model/lifecycle'
import type {
  NewPerson, PeopleRefusal, Person, PersonId, PersonPatch, PersonState,
} from './person'
import { isEmail, isRedirect, mintPersonId, normalEmail, normalName } from './person'
import { drawPseudonym } from './pseudonym'

/** A change made: the register as it now is, and which ids it changed or took away. */
export type Changed = {
  people: Person[]
  changed: PersonId[]
  removed: PersonId[]
}

/** A change refused, and nothing changed. */
export type RefusedChange = { refused: PeopleRefusal }

export type ChangeAnswer = Changed | RefusedChange

/** Where a new entry's id and pseudonym come from: random, unless a test says otherwise. */
export type Minting = {
  id?: (taken: ReadonlySet<PersonId>) => PersonId
  pseudonym?: (taken: ReadonlySet<string>) => string
}

/** A change, as a repository is handed one. */
export type PeopleChange =
  | { kind: 'add'; person: NewPerson }
  | { kind: 'change'; id: PersonId; patch: PersonPatch }
  | { kind: 'leave'; id: PersonId; on: string }
  | { kind: 'merge'; from: PersonId; into: PersonId }
  | { kind: 'forget'; id: PersonId; on: string }
  | { kind: 'remove'; id: PersonId }
  | { kind: 'bringIn'; people: readonly Person[] }

const refused = (key: PeopleRefusal): RefusedChange => ({ refused: key })

/** The change applied to the register, or the refusal. Neither argument is changed. */
export function changePeople(people: readonly Person[], change: PeopleChange, minting: Minting = {}): ChangeAnswer {
  switch (change.kind) {
    case 'add': return add(people, change.person, minting)
    case 'change': return correct(people, change.id, change.patch)
    case 'leave': return leave(people, change.id, change.on)
    case 'merge': return merge(people, change.from, change.into)
    case 'forget': return forget(people, change.id, change.on)
    case 'remove': return remove(people, change.id)
    case 'bringIn': return bringIn(people, change.people)
    default: {
      const unexpected: never = change
      return unexpected
    }
  }
}

/** The id of the entry the last `add` made: the one in `changed` that the register did not hold before. */
export function addedId(answer: Changed): PersonId {
  return answer.changed[0]
}

function replaced(people: readonly Person[], next: Person): Person[] {
  return people.map((person) => (person.id === next.id ? next : person))
}

function find(people: readonly Person[], id: PersonId): Person | RefusedChange {
  const found = people.find((person) => person.id === id)
  if (!found) return refused('people.unknown')
  if (isRedirect(found)) return refused('people.merged')
  return found
}

function add(people: readonly Person[], input: NewPerson, minting: Minting): ChangeAnswer {
  const name = normalName(input.name ?? '')
  if (!name) return refused('people.nameRequired')
  const email = input.email?.trim() ? input.email : undefined
  if (email !== undefined && !isEmail(email)) return refused('people.badEmail')
  const ids = new Set(people.map((person) => person.id))
  const codes = new Set(people.map((person) => person.pseudonym))
  const id = (minting.id ?? mintPersonId)(ids)
  const person: Person = {
    id, name, pseudonym: (minting.pseudonym ?? drawPseudonym)(codes), kind: input.kind ?? 'internal', state: 'active',
    ...(email !== undefined ? { email: normalEmail(email) } : {}),
  }
  return { people: [...people, person], changed: [id], removed: [] }
}

function correct(people: readonly Person[], id: PersonId, patch: PersonPatch): ChangeAnswer {
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state === 'forgotten') return refused('people.forgotten')
  const name = patch.name === undefined ? found.name : normalName(patch.name)
  if (!name) return refused('people.nameRequired')
  if (typeof patch.email === 'string' && patch.email.trim() && !isEmail(patch.email)) return refused('people.badEmail')
  const { email: _was, ...rest } = found
  const email = patch.email === undefined ? found.email : patch.email?.trim() ? normalEmail(patch.email) : undefined
  const next: Person = { ...rest, name, kind: patch.kind ?? found.kind, ...(email !== undefined ? { email } : {}) }
  return { people: replaced(people, next), changed: [id], removed: [] }
}

function leave(people: readonly Person[], id: PersonId, on: string): ChangeAnswer {
  if (!isDay(on)) return refused('people.badDay')
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state !== 'active') return refused('people.notActive')
  return { people: replaced(people, { ...found, state: 'left', leftOn: on }), changed: [id], removed: [] }
}

function forget(people: readonly Person[], id: PersonId, on: string): ChangeAnswer {
  if (!isDay(on)) return refused('people.badDay')
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state === 'forgotten') return refused('people.forgotten')
  const { name: _name, email: _email, ...rest } = found
  const next: Person = { ...rest, state: 'forgotten', leftOn: found.leftOn ?? on, forgottenOn: on }
  return { people: replaced(people, next), changed: [id], removed: [] }
}

function remove(people: readonly Person[], id: PersonId): ChangeAnswer {
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state !== 'forgotten') return refused('people.notForgotten')
  // Every redirect into it goes with it: nothing is left to connect what pointed at either.
  const gone = new Set([id, ...people.filter((person) => person.mergedInto === id).map((person) => person.id)])
  return { people: people.filter((person) => !gone.has(person.id)), changed: [], removed: [...gone] }
}

function merge(people: readonly Person[], from: PersonId, into: PersonId): ChangeAnswer {
  const absorbed = find(people, from)
  if ('refused' in absorbed) return absorbed
  const kept = find(people, into)
  if ('refused' in kept) return kept
  if (from === into || kept.state === 'forgotten') return refused('people.badMerge')
  const redirect: Person = { id: from, pseudonym: absorbed.pseudonym, kind: absorbed.kind, state: absorbed.state, mergedInto: into }
  // A redirect into the one absorbed now points at the one kept, so no chain is ever longer than one.
  const repointed = people.filter((person) => person.mergedInto === from).map((person) => person.id)
  const next = people.map((person) => {
    if (person.id === from) return redirect
    return person.mergedInto === from ? { ...person, mergedInto: into } : person
  })
  return { people: next, changed: [from, ...repointed], removed: [] }
}

const RANK: Record<PersonState, number> = { active: 0, left: 1, forgotten: 2 }

/**
 * One entry carried in, against the one held under its id. Whichever is
 * further along wins — a redirect over anything, forgotten over left, left
 * over active — so a file never gives a name back, never undoes a merge and
 * never brings back someone who left. At the same point the one carried in
 * wins, as a working file's scope replaces the one at its address; but a name
 * is never replaced by none, so a file made without names brought back into
 * the register it came from leaves the names standing.
 */
function broughtOver(held: Person, carried: Person): Person {
  if (isRedirect(held)) return held
  if (isRedirect(carried)) return carried
  if (RANK[held.state] > RANK[carried.state]) return held
  if (RANK[carried.state] > RANK[held.state] || carried.name !== undefined) return carried
  return {
    ...carried,
    ...(held.name !== undefined ? { name: held.name } : {}),
    ...(held.email !== undefined ? { email: held.email } : {}),
  }
}

const FIELDS = ['id', 'name', 'email', 'pseudonym', 'kind', 'state', 'leftOn', 'forgottenOn', 'mergedInto'] as const

/** Whether two entries say the same, whatever order their keys were written in. */
export function samePerson(one: Person, other: Person): boolean {
  return FIELDS.every((field) => one[field] === other[field])
}

function bringIn(people: readonly Person[], carried: readonly Person[]): ChangeAnswer {
  const byId = new Map(people.map((person) => [person.id, person]))
  const changed: PersonId[] = []
  for (const entry of carried) {
    const held = byId.get(entry.id)
    const next = held ? broughtOver(held, entry) : entry
    if (held && samePerson(held, next)) continue
    byId.set(entry.id, next)
    changed.push(entry.id)
  }
  return { people: [...byId.values()], changed, removed: [] }
}
