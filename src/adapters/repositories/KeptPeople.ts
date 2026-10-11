// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `PeopleRepository` over a keyed store (ADR-0036): one value per entry on a
 * shelf of its own, by id, and nothing of it on any shelf a scope, the index
 * or the history keeps — so no step, entry or checkpoint ever holds a name
 * from it, and a forget is one `put`.
 *
 * Every change writes one line to the register's log in the same transaction
 * (`peopleLog`): which ids it changed and which it took away. The revision is
 * the source's mark and the number of that line, so *what changed since* is
 * the lines after it, as it is for the index (`KeptIndex.ts`).
 *
 * The rules are `people/register.ts`'s: an entry is read, the change worked
 * out over every entry, and only what changed is written back. Every id it
 * removes is kept on a shelf of its own (`peopleRemoved`), the id alone, so
 * nothing brought in later gives the entry back.
 */
import type { PersonId, Person } from '../../people/person'
import { personFrom } from '../../people/person'
import { changePeople } from '../../people/register'
import type { ChangeAnswer, Changed, Minting, PeopleChange } from '../../people/register'
import type { MergeLeaving, NewPerson, PersonPatch } from '../../people/person'
import type {
  PeopleBrought, PeopleChanges, PeopleRead, PeopleRefused, PeopleRepository, PersonRemoved, PersonWritten,
} from '../../ports/PeopleRepository'
import type { Revision } from '../../projects/scopeState'
import type { Transaction } from './KeyedStore'
import { readMeta, sequenceKey } from './kept'
import type { Source } from './source'

/** Where the register's count of changes is kept, beside the source's own marks. */
const PEOPLE_META_KEY = 'people'

/** How many lines of the log are kept: a reader further behind reads the whole register again. */
const LOG_KEPT = 1000

type PeopleMeta = { seq: number }

type Logged = { changed: PersonId[]; removed: PersonId[] }

async function seqOf(tx: Transaction): Promise<number> {
  return (await tx.get<PeopleMeta>('meta', PEOPLE_META_KEY))?.seq ?? 0
}

async function removedIds(tx: Transaction): Promise<PersonId[]> {
  return (await tx.range<unknown>('peopleRemoved', {})).map(({ key }) => key)
}

async function everyone(tx: Transaction): Promise<Person[]> {
  return (await tx.range<unknown>('people', {})).flatMap(({ value }) => {
    const person = personFrom(value)
    return person ? [person] : []
  })
}

export class KeptPeople implements PeopleRepository {
  readonly id: string

  private readonly source: Source
  private readonly minting: Minting

  constructor(source: Source, minting: Minting = {}) {
    this.source = source
    this.minting = minting
    this.id = source.id
  }

  list(): Promise<PeopleRead> {
    return this.source.read(async (tx) => ({
      revision: await this.revision(tx), people: await everyone(tx), removed: await removedIds(tx),
    }))
  }

  read(id: PersonId): Promise<Person | undefined> {
    return this.source.read(async (tx) => personFrom(await tx.get('people', id)))
  }

  async add(person: NewPerson): Promise<PersonWritten | PeopleRefused> {
    return this.written(await this.apply({ kind: 'add', person }))
  }

  async change(id: PersonId, patch: PersonPatch): Promise<PersonWritten | PeopleRefused> {
    return this.written(await this.apply({ kind: 'change', id, patch }))
  }

  async leave(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused> {
    return this.written(await this.apply({ kind: 'leave', id, on }))
  }

  async merge(from: PersonId, into: PersonId, leaving?: MergeLeaving): Promise<PersonWritten | PeopleRefused> {
    return this.written(await this.apply({ kind: 'merge', from, into, ...(leaving ? { leaving } : {}) }), into)
  }

  async forget(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused> {
    return this.written(await this.apply({ kind: 'forget', id, on }))
  }

  async remove(id: PersonId): Promise<PersonRemoved | PeopleRefused> {
    const { answer, revision } = await this.apply({ kind: 'remove', id })
    if ('refused' in answer) return answer
    return { revision: revision!, removed: answer.removed }
  }

  async bringIn(people: readonly Person[], removed: readonly PersonId[] = []): Promise<PeopleBrought> {
    const { answer, revision } = await this.apply({ kind: 'bringIn', people, removed })
    if ('refused' in answer) throw new Error(`bringing people in was refused: ${answer.refused}`)
    return { revision: revision!, changed: answer.changed }
  }

  since(revision: Revision): Promise<PeopleChanges | undefined> {
    return this.source.read(async (tx) => {
      const meta = await readMeta(tx)
      const seq = await seqOf(tx)
      const from = sequenceOf(revision, meta.nonce)
      if (from === undefined || from > seq) return undefined
      const lines = await tx.range<Logged>('peopleLog', { from: sequenceKey(from + 1) })
      if (lines.length !== seq - from) return undefined
      const changed = new Set<PersonId>()
      const removed = new Set<PersonId>()
      for (const { value } of lines) {
        for (const id of value.changed) changed.add(id)
        for (const id of value.removed) removed.add(id)
      }
      const now: Person[] = []
      for (const id of changed) {
        const person = personFrom(await tx.get('people', id))
        if (person) now.push(person)
      }
      const here = new Set(now.map((person) => person.id))
      return { revision: `${meta.nonce}.p${seq}`, changed: now, removed: [...removed].filter((id) => !here.has(id)) }
    })
  }

  /** One change, worked out over every entry and kept in one transaction; a refusal writes nothing. */
  private apply(change: PeopleChange): Promise<Answered> {
    return this.source.write(async (tx) => {
      const removed = change.kind === 'bringIn' ? new Set(await removedIds(tx)) : undefined
      const answer = changePeople(await everyone(tx), change, this.minting, removed)
      if ('refused' in answer) return { answer }
      return { answer, revision: await this.land(tx, answer) }
    })
  }

  private async revision(tx: Transaction): Promise<Revision> {
    return `${(await readMeta(tx)).nonce}.p${await seqOf(tx)}`
  }

  /** What a change wrote, kept: the entries it changed put, those it took away deleted, and a line in the log. */
  private async land(tx: Transaction, answer: Changed): Promise<Revision> {
    const byId = new Map(answer.people.map((person) => [person.id, person]))
    for (const id of answer.changed) tx.put('people', id, byId.get(id))
    for (const id of answer.removed) tx.delete('people', id)
    for (const id of answer.tombstones) tx.put('peopleRemoved', id, true)
    const moved = answer.changed.length + answer.removed.length + answer.tombstones.length > 0
    const seq = await seqOf(tx) + (moved ? 1 : 0)
    if (moved) {
      tx.put('meta', PEOPLE_META_KEY, { seq } satisfies PeopleMeta)
      tx.put('peopleLog', sequenceKey(seq), { changed: answer.changed, removed: answer.removed } satisfies Logged)
      if (seq > LOG_KEPT) tx.deleteRange('peopleLog', { below: sequenceKey(seq - LOG_KEPT + 1) })
    }
    return `${(await readMeta(tx)).nonce}.p${seq}`
  }

  private written(answered: Answered, show?: PersonId): PersonWritten | PeopleRefused {
    const { answer, revision } = answered
    if ('refused' in answer) return answer
    const id = show ?? answer.changed[0]
    return { revision: revision!, person: structuredClone(answer.people.find((person) => person.id === id)!) }
  }
}

type Answered = { answer: ChangeAnswer; revision?: Revision }

/** A revision's line number, where it is this source's register's; `undefined` for anything else. */
function sequenceOf(revision: string, nonce: string): number | undefined {
  const [mark, line, ...rest] = String(revision).split('.')
  if (mark !== nonce || rest.length > 0 || !/^p\d+$/.test(line ?? '')) return undefined
  return Number(line.slice(1))
}
