// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register of a folder (ADR-0036): `.lionsville-architecture/
 * people.json` at the organisation's root (`format/peopleFile.ts`), beside
 * the organisation's settings and out of the folder's history.
 *
 * Read from the folder every time it is asked, so what it answers is what the
 * folder holds, whoever wrote it; written one change at a time, in the same
 * turn as every other write to the folder (`FolderScopes.serial`), with the
 * rules every register shares (`people/register.ts`).
 *
 * **Its revision is the file, fingerprinted**, so two reads of an unchanged
 * register agree. **What changed since one** is answered against the register
 * as it was at that revision, which this keeps for the last few it answered
 * with, as the folder's index does (`FolderIndex.ts`).
 *
 * **A file it cannot write over is never written over**: one that would not
 * read, or that a later build wrote, is read for what it holds and every
 * change to it refused, because a register read as nobody and written back
 * is everyone lost.
 */
import { ShellError } from '../../platform/errors'
import type { NewPerson, Person, PersonId, PersonPatch } from '../../people/person'
import { changePeople } from '../../people/register'
import type { ChangeAnswer, Minting, PeopleChange } from '../../people/register'
import { fingerprint } from '../../projects/revision'
import type { Revision } from '../../projects/scopeState'
import { stableJson } from '../../projects/text'
import type {
  PeopleBrought, PeopleChanges, PeopleRead, PeopleRefused, PeopleRepository, PersonRemoved, PersonWritten,
} from '../../ports/PeopleRepository'
import type { FolderScopes } from './folderScopes'
import { PEOPLE_PATH, peopleFileText, readPeopleFile } from './format/peopleFile'
import type { PeopleFileRead } from './format/peopleFile'
import { textAt, writeAt } from './handles'

/** How many past revisions it answers *what changed since* for. */
const KEPT = 32

type Held = { revision: Revision; read: PeopleFileRead }

type Answered = { answer: ChangeAnswer; revision?: Revision }

function peopleOf(read: PeopleFileRead): Person[] {
  return read.kind === 'absent' ? [] : read.people
}

/** The ids the register removed, which the file keeps so nothing brings them back. */
function removedOf(read: PeopleFileRead): PersonId[] {
  return read.kind === 'absent' ? [] : read.removed ?? []
}

export class FolderPeopleRepository implements PeopleRepository {
  readonly id = 'folder'
  /** Each revision answered with, and each entry then, by id. */
  private readonly past = new Map<Revision, Map<PersonId, string>>()

  private readonly folder: FolderScopes
  private readonly minting: Minting

  constructor(folder: FolderScopes, minting: Minting = {}) {
    this.folder = folder
    this.minting = minting
  }

  async list(): Promise<PeopleRead> {
    const held = await this.held()
    return { revision: held.revision, people: peopleOf(held.read), removed: removedOf(held.read) }
  }

  async read(id: PersonId): Promise<Person | undefined> {
    return peopleOf((await this.held()).read).find((person) => person.id === id)
  }

  async add(person: NewPerson): Promise<PersonWritten | PeopleRefused> {
    return written(await this.apply({ kind: 'add', person }))
  }

  async change(id: PersonId, patch: PersonPatch): Promise<PersonWritten | PeopleRefused> {
    return written(await this.apply({ kind: 'change', id, patch }))
  }

  async leave(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused> {
    return written(await this.apply({ kind: 'leave', id, on }))
  }

  async merge(from: PersonId, into: PersonId): Promise<PersonWritten | PeopleRefused> {
    return written(await this.apply({ kind: 'merge', from, into }), into)
  }

  async forget(id: PersonId, on: string): Promise<PersonWritten | PeopleRefused> {
    return written(await this.apply({ kind: 'forget', id, on }))
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

  async since(revision: Revision): Promise<PeopleChanges | undefined> {
    const then = this.past.get(revision)
    if (!then) return undefined
    const now = await this.list()
    const changed = now.people.filter((person) => then.get(person.id) !== stableJson(person))
    const here = new Set(now.people.map((person) => person.id))
    return { revision: now.revision, changed: structuredClone(changed), removed: [...then.keys()].filter((id) => !here.has(id)) }
  }

  /** The file as it is now, its revision, and that revision kept for *since*. */
  private async held(): Promise<Held> {
    const text = await textAt(this.folder.root, PEOPLE_PATH)
    const read = readPeopleFile(text)
    const revision = fingerprint(['people', text ?? ''])
    this.past.delete(revision)
    this.past.set(revision, new Map(peopleOf(read).map((person) => [person.id, stableJson(person)])))
    while (this.past.size > KEPT) this.past.delete(this.past.keys().next().value!)
    return { revision, read }
  }

  private apply(change: PeopleChange): Promise<Answered> {
    return this.folder.serial(async () => {
      const { read } = await this.held()
      if (read.kind === 'unwritable') throw new ShellError('people.unwritable')
      const removed = removedOf(read)
      const answer = changePeople(peopleOf(read), change, this.minting, new Set(removed))
      if ('refused' in answer) return { answer }
      if (answer.changed.length + answer.removed.length + answer.tombstones.length === 0) {
        return { answer, revision: (await this.held()).revision }
      }
      await writeAt(this.folder.root, PEOPLE_PATH, peopleFileText(answer.people, [...removed, ...answer.tombstones]))
      return { answer, revision: (await this.held()).revision }
    })
  }
}

function written(answered: Answered, show?: PersonId): PersonWritten | PeopleRefused {
  const { answer, revision } = answered
  if ('refused' in answer) return answer
  const id = show ?? answer.changed[0]
  return { revision: revision!, person: structuredClone(answer.people.find((person) => person.id === id)!) }
}
