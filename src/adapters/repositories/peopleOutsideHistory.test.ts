// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The register is the one place a name is kept (ADR-0036 §8): a step that
 * names a person holds their id, and no step, no history entry, no state at
 * an entry and no row of the index holds their name — in a store, every
 * shelf but the register's own is free of it; in a folder, no commit holds
 * the register's file.
 *
 * As far as there is anything that names a person yet: an element's owner
 * picked from the register, written here as the reference it will be. The
 * one exception the decision makes — a signature keeps the name it was signed
 * with — has no field to be written in until signing takes a person.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from '../../model/commands'
import { pickedPerson } from '../../model/person'
import type { DesignElement } from '../../model/types'
import type { Repositories } from '../../ports/Repositories'
import { step } from '../../ports/Repositories.contract'
import { FakeDirectory } from '../folder/fakeDirectory'
import { folderRepositories } from '../folder/folderRepositories'
import { memoryGit } from '../folder/memoryGit'
import { memoryRepositories } from '../memory/memoryRepositories'
import { MemoryStore } from '../memory/MemoryStore'
import { SHELVES } from './KeyedStore'

const NAME = /Pia|Schulz|pia\.schulz/

/** Pia in the register, an application she owns by id, a record of it, and her leaving and being forgotten. */
async function namedAndRecorded(repositories: Repositories): Promise<{ scope: string; id: string }> {
  const added = await repositories.people.add({ name: 'Pia Schulz', email: 'pia.schulz@acme.example' })
  if ('refused' in added) throw new Error(added.refused)
  const created = await repositories.scopes.create('acme', { name: 'Acme Logistics' })
  if ('refused' in created) throw new Error(created.refused)
  const owned = {
    id: 'crm', kind: 'application', name: 'Customer relations', lifecycle: 'live', isManaged: true, aspects: {},
    owner: pickedPerson(added.person.id),
  } as unknown as DesignElement
  const commands: Command[] = [
    { type: 'element.create', element: owned },
    { type: 'element.update', id: 'crm', patch: { description: 'Who the customers are.' } },
  ]
  const applied = await repositories.scopes.apply([{ scope: created.id, steps: commands.map(step) }])
  if ('refused' in applied) throw new Error(applied.refused)
  await repositories.history.record({ subject: 'Owned by the register' })
  await repositories.people.leave(added.person.id, '2026-08-14')
  return { scope: created.id, id: added.person.id }
}

/** Every state, every entry and the state at each, and the index, as text. */
async function everythingButTheRegister(repositories: Repositories, scope: string): Promise<string> {
  const tree = await repositories.scopes.tree()
  const scopes = [tree.root.id, scope]
  const parts: unknown[] = [tree, await repositories.index.read()]
  for (const id of scopes) {
    parts.push(await repositories.scopes.state(id))
    const { entries } = await repositories.history.entries({ scopes: [id] })
    parts.push(entries)
    for (const entry of entries) parts.push(await repositories.history.stateAt(id, entry.id))
  }
  return JSON.stringify(parts)
}

describe('no step, entry or index row holds a name from the register', () => {
  it('in a store: the id is everywhere it is named, and the name only on the register’s own shelf', async () => {
    const store = new MemoryStore()
    const repositories = memoryRepositories(store)
    const { scope, id } = await namedAndRecorded(repositories)
    const elsewhere = await everythingButTheRegister(repositories, scope)
    expect(elsewhere).toContain(id)
    expect(elsewhere).not.toMatch(NAME)
    const shelves = await store.transaction(SHELVES, 'read', async (tx) => {
      const held: Record<string, string> = {}
      for (const shelf of SHELVES) held[shelf] = JSON.stringify(await tx.range(shelf, {}))
      return held
    })
    expect(Object.entries(shelves).filter(([, text]) => NAME.test(text)).map(([shelf]) => shelf)).toEqual(['people'])
  })

  it('in a folder: nothing the history reads holds the name, and no commit holds the register', async () => {
    const root = new FakeDirectory()
    const git = memoryGit(root)
    const repositories = folderRepositories({ root, git })
    const { scope, id } = await namedAndRecorded(repositories)
    const elsewhere = await everythingButTheRegister(repositories, scope)
    expect(elsewhere).toContain(id)
    expect(elsewhere).not.toMatch(NAME)
    const commits = await git.log({ limit: 100 })
    expect(commits.length).toBeGreaterThan(0)
    for (const commit of commits) {
      const files = await git.treeAt(commit.sha, '')
      expect(files.map((file) => file.path), commit.sha).not.toContain('.lionsville-architecture/people.json')
      expect(JSON.stringify(await git.texts(files.map((file) => file.blob)))).not.toMatch(NAME)
    }
  })
})
