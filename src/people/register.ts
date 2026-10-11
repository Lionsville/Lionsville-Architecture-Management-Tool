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
 *   name, so every id the history holds still resolves. Final. An active
 *   entry merged into one that has left is told which is true
 *   (`MergeLeaving`): *still here* clears the leaving, *left* keeps it — and
 *   what leaving does to the roles of the one absorbed is `leave.ts`'s.
 *   Told nothing, it is refused rather than guessed.
 * - **Forget** takes the name and the address away; the entry reads as its
 *   pseudonym from then on. Final: the register keeps no history of a name.
 * - **Remove** takes a forgotten entry away, and every redirect into it, after
 *   which a reference to it reads *a former colleague*. The register keeps
 *   each id it removed — the id alone, random and naming nobody — so that
 *   nothing carried in later brings the entry back.
 * - **Bring in** takes entries carried from elsewhere — a working file — by
 *   their ids, and the ids removed there. Whichever is further gone wins:
 *   removed, then forgotten, then merged, then left, then active. So a file
 *   never gives a name, an address or an active state back, never undoes a
 *   merge and never brings back an entry removed here — and a forgetting or
 *   a removal carried in applies here too: forgetting travels, un-forgetting
 *   does not.
 */
import { isDay } from '../model/lifecycle'
import type {
  MergeLeaving, NewPerson, PeopleRefusal, Person, PersonId, PersonPatch, PersonState,
} from './person'
import { isEmail, isRedirect, mergeAsks, mintPersonId, normalEmail, normalName } from './person'
import { drawPseudonym } from './pseudonym'

/**
 * A change made: the register as it now is, which ids it changed or took
 * away, and which ids are to be remembered as removed from now on — those it
 * removed, and those a file carried in said were removed there.
 */
export type Changed = {
  people: Person[]
  changed: PersonId[]
  removed: PersonId[]
  /** Ids to keep as removed (the ids alone): what a later bring-in is held to. */
  tombstones: PersonId[]
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
  | { kind: 'merge'; from: PersonId; into: PersonId; leaving?: MergeLeaving }
  | { kind: 'forget'; id: PersonId; on: string }
  | { kind: 'remove'; id: PersonId }
  | { kind: 'bringIn'; people: readonly Person[]; removed?: readonly PersonId[] }

const refused = (key: PeopleRefusal): RefusedChange => ({ refused: key })

/**
 * The change applied to the register, or the refusal. No argument is changed.
 * `removed` is every id the register has removed and remembers: what a bring-in
 * never brings back.
 */
export function changePeople(
  people: readonly Person[], change: PeopleChange, minting: Minting = {}, removed: ReadonlySet<PersonId> = new Set(),
): ChangeAnswer {
  switch (change.kind) {
    case 'add': return add(people, change.person, minting)
    case 'change': return correct(people, change.id, change.patch)
    case 'leave': return leave(people, change.id, change.on)
    case 'merge': return merge(people, change.from, change.into, change.leaving)
    case 'forget': return forget(people, change.id, change.on)
    case 'remove': return remove(people, change.id)
    case 'bringIn': return bringIn(people, change.people, change.removed ?? [], removed)
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
  return { people: [...people, person], changed: [id], removed: [], tombstones: [] }
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
  return { people: replaced(people, next), changed: [id], removed: [], tombstones: [] }
}

function leave(people: readonly Person[], id: PersonId, on: string): ChangeAnswer {
  if (!isDay(on)) return refused('people.badDay')
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state !== 'active') return refused('people.notActive')
  return { people: replaced(people, { ...found, state: 'left', leftOn: on }), changed: [id], removed: [], tombstones: [] }
}

function forget(people: readonly Person[], id: PersonId, on: string): ChangeAnswer {
  if (!isDay(on)) return refused('people.badDay')
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state === 'forgotten') return refused('people.forgotten')
  const { name: _name, email: _email, ...rest } = found
  const next: Person = { ...rest, state: 'forgotten', leftOn: found.leftOn ?? on, forgottenOn: on }
  return { people: replaced(people, next), changed: [id], removed: [], tombstones: [] }
}

function remove(people: readonly Person[], id: PersonId): ChangeAnswer {
  const found = find(people, id)
  if ('refused' in found) return found
  if (found.state !== 'forgotten') return refused('people.notForgotten')
  // Every redirect into it goes with it: nothing is left to connect what pointed at either.
  const gone = new Set([id, ...people.filter((person) => person.mergedInto === id).map((person) => person.id)])
  return { people: people.filter((person) => !gone.has(person.id)), changed: [], removed: [...gone], tombstones: [...gone] }
}

function merge(people: readonly Person[], from: PersonId, into: PersonId, leaving: MergeLeaving | undefined): ChangeAnswer {
  const absorbed = find(people, from)
  if ('refused' in absorbed) return absorbed
  const kept = find(people, into)
  if ('refused' in kept) return kept
  // A forgotten entry is merged into nobody, as nobody is merged into one: its records
  // would read as the name of the entry kept, and the forget would be undone.
  if (from === into || kept.state === 'forgotten' || absorbed.state === 'forgotten') return refused('people.badMerge')
  // Somebody active going into an entry that has left is still here, or left: told, never guessed.
  const asks = mergeAsks(absorbed, kept)
  if (asks && leaving === undefined) return refused('people.mergeAsks')
  const redirect: Person = { id: from, pseudonym: absorbed.pseudonym, kind: absorbed.kind, state: absorbed.state, mergedInto: into }
  // Still here: the entry kept is active again, and nothing of its leaving is kept for the policy to count from.
  const { leftOn: _left, ...here } = kept
  const back = asks && leaving === 'stillHere'
  // A redirect into the one absorbed now points at the one kept, so no chain is ever longer than one.
  const repointed = people.filter((person) => person.mergedInto === from).map((person) => person.id)
  const next = people.map((person) => {
    if (person.id === from) return redirect
    if (back && person.id === into) return { ...here, state: 'active' as const }
    return person.mergedInto === from ? { ...person, mergedInto: into } : person
  })
  return { people: next, changed: [from, ...repointed, ...(back ? [into] : [])], removed: [], tombstones: [] }
}

/**
 * How far gone an entry is, for a bring-in: whichever of two is further wins.
 * A redirect is past leaving and short of forgetting — a merge is undone by
 * nothing, but a forgetting carried in still reaches it. A removal, the
 * furthest, is not an entry: it is an id the register remembers.
 */
const RANK: Record<PersonState | 'merged', number> = { active: 0, left: 1, merged: 2, forgotten: 3 }

function rankOf(person: Person): number {
  return isRedirect(person) ? RANK.merged : RANK[person.state]
}

/**
 * One entry carried in, against the one held under its id: whichever is
 * further gone wins, so a file never gives a name, an address or an active
 * state back and never undoes a merge. At the same point the one carried in
 * wins, as a working file's scope replaces the one at its address — but a
 * name is never replaced by none, so a file made without names, brought back
 * into the register it came from, leaves the names standing; a redirect held
 * stays as it is.
 */
function broughtOver(held: Person, carried: Person): Person {
  const rank = { held: rankOf(held), carried: rankOf(carried) }
  if (rank.held > rank.carried) return held
  if (rank.held === rank.carried && isRedirect(held)) return held
  if (rank.carried === RANK.forgotten || isRedirect(carried) || carried.name !== undefined) return carried
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

/** Where a redirect ends: the first id along it that is no redirect, or that the register does not hold. */
function endOf(byId: ReadonlyMap<PersonId, Person>, id: PersonId): PersonId {
  const seen = new Set<PersonId>()
  let at = id
  for (let held = byId.get(at); held?.mergedInto !== undefined && !seen.has(at); held = byId.get(at)) {
    seen.add(at)
    at = held.mergedInto
  }
  return at
}

function bringIn(
  people: readonly Person[], carried: readonly Person[], carriedRemoved: readonly PersonId[], removedHere: ReadonlySet<PersonId>,
): ChangeAnswer {
  const byId = new Map(people.map((person) => [person.id, person]))
  const changed = new Set<PersonId>()
  const gone = new Set<PersonId>()
  const tombstones = new Set<PersonId>()
  const heldBefore = new Set(byId.keys())
  const takeAway = (id: PersonId) => {
    byId.delete(id)
    changed.delete(id)
    if (heldBefore.has(id)) gone.add(id)
    tombstones.add(id)
  }
  // A removal carried in is a removal here: the entry goes, and every redirect into it.
  for (const id of carriedRemoved) {
    if (removedHere.has(id) || tombstones.has(id)) continue
    tombstones.add(id)
    for (const held of [...byId.values()]) if (held.id === id || held.mergedInto === id) takeAway(held.id)
  }
  for (const entry of carried) {
    if (removedHere.has(entry.id) || tombstones.has(entry.id)) continue
    const held = byId.get(entry.id)
    const next = held ? broughtOver(held, entry) : entry
    if (held && samePerson(held, next)) continue
    // A redirect that would lead back to its own entry is a loop, and both would read as nobody: what is held stays.
    if (next.mergedInto !== undefined && next !== held && endOf(byId, next.mergedInto) === entry.id) continue
    byId.set(entry.id, next)
    changed.add(entry.id)
  }
  // Every redirect one step long again, and none into an entry removed here.
  for (const person of [...byId.values()]) {
    if (person.mergedInto === undefined) continue
    const end = endOf(byId, person.mergedInto)
    if (removedHere.has(end) || tombstones.has(end)) takeAway(person.id)
    else if (end !== person.mergedInto) {
      byId.set(person.id, { ...person, mergedInto: end })
      changed.add(person.id)
    }
  }
  return { people: [...byId.values()], changed: [...changed], removed: [...gone], tombstones: [...tombstones] }
}
