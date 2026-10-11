// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The working file for a process with no screen, run where one runs: in
 * node, with no DOM, over the memory repositories a server would hand in in
 * place of its own.
 */
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { organisation, seed } from '../../adapters/folder/format/testing/organisation'
import type { Repositories } from '../../ports/Repositories'
import { nodeAt, readScope } from '../../projects/scopeAccess'
import { MemoryStore } from '../../adapters/memory/MemoryStore'
import { spoilKept } from '../../adapters/repositories/testing/spoil'
import { bringIn, open } from '../../adapters/folder/format/interchange'
import type { Spoiled } from '../../ports/Repositories.contract'
import { slug } from '../../model/keys'
import { readWorkingFile, writeWorkingFile } from './workingFile'
import { unzipSync } from 'fflate'
import type { Person } from '../../people/person'

/** The repositories, with every picture put and every run applied written down, in order. */
function watched(repositories: Repositories): { repositories: Repositories; said: string[] } {
  const said: string[] = []
  const around = <T extends object>(target: T, name: string, write: (...args: never[]) => string): T => new Proxy(target, {
    get(held, key) {
      const value = Reflect.get(held, key, held) as unknown
      if (typeof value !== 'function') return value
      const bound = (value as (...args: unknown[]) => unknown).bind(held)
      return key === name ? (...args: never[]) => { said.push(write(...args)); return bound(...args) } : bound
    },
  })
  return {
    said,
    repositories: {
      ...repositories,
      images: around(repositories.images, 'put', (_scope: string, name: string) => `put ${name}`),
      scopes: around(repositories.scopes, 'apply', (runs: readonly { steps: readonly { command: { type: string } }[] }[]) =>
        `apply ${runs.flatMap((run) => run.steps.map((step) => step.command.type)).join(' ')}`),
    },
  }
}

describe('the working file, from node', () => {
  it('needs no screen to run in', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined')
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined')
  })

  it('writes what the repositories hold, and reads it into others as the same organisation', async () => {
    const source = memoryRepositories()
    await seed(source)
    const written = await writeWorkingFile(source)
    expect(written.name).toBe('acme-logistics.lvarch')
    expect(written.without).toEqual([])

    const target = memoryRepositories()
    const read = await readWorkingFile(target, written.bytes)
    if ('refused' in read) throw new Error(read.refused)
    expect(read.landed).toEqual(['', 'application-landscape', 'depots'])
    expect(read.arrival.short).toBeUndefined()
    expect(read.arrival.accounted).toBe(true)
    expect(Buffer.from((await writeWorkingFile(target)).bytes).equals(Buffer.from(written.bytes))).toBe(true)
  })

  it('reads an organisation whose top draws nothing back as it wrote it', async () => {
    // A scope that draws nothing is ordinary; its children draw.
    const [root, ...under] = organisation()
    const drawless = [{ ...root, model: { ...root.model, diagrams: [] }, activeDiagramId: '' }, ...under]
    const source = memoryRepositories()
    await seed(source, drawless)
    const written = await writeWorkingFile(source)

    const target = memoryRepositories()
    const read = await readWorkingFile(target, written.bytes)
    if ('refused' in read) throw new Error(read.refused)
    expect(read.landed).toEqual(['', 'application-landscape', 'depots'])
    expect(read.arrival.short).toBeUndefined()
    expect(read.arrival.accounted).toBe(true)
    const top = await readScope(target.scopes, '')
    expect(top?.model.diagrams).toEqual([])
    expect(top?.activeDiagramId).toBe('')
    expect((await readScope(target.scopes, 'application-landscape'))?.model.diagrams.length).toBeGreaterThan(0)
    // Equal but for what each repository mints for itself: an identity, a revision, a time.
    const content = async (repositories: Repositories, address: string) => {
      const { id: _id, revision: _revision, updatedAt: _updatedAt, ...rest } = (await readScope(repositories.scopes, address)) ?? {}
      return rest
    }
    for (const address of read.landed) expect(await content(target, address)).toEqual(await content(source, address))
    expect(Buffer.from((await writeWorkingFile(target)).bytes).equals(Buffer.from(written.bytes))).toBe(true)
  })

  it('lands every scope as a replace, in one apply, with each picture\'s bytes put first', async () => {
    const source = memoryRepositories()
    await seed(source)
    const { bytes } = await writeWorkingFile(source)
    const { repositories, said } = watched(memoryRepositories())

    await readWorkingFile(repositories, bytes)

    expect(said).toEqual(['put depot.png', 'put diagrams/ctx.png', 'put yard.png', 'apply scope.replace scope.replace scope.replace'])
  })

  it('records an entry before replacing what is there, and one of each scope it landed, with the subjects given', async () => {
    const source = memoryRepositories()
    await seed(source)
    const { bytes } = await writeWorkingFile(source)
    const target = memoryRepositories()
    await readWorkingFile(target, bytes)
    // A later version of the same organisation, which changes every scope it lands on.
    const later = memoryRepositories()
    await seed(later, organisation().map((scope) => ({ ...scope, model: { ...scope.model, description: 'Later.' } })))

    await readWorkingFile(target, (await writeWorkingFile(later)).bytes, {
      before: 'Before the file came in', subject: 'Brought in from a file',
    })

    const tree = await target.scopes.tree()
    for (const address of ['', 'application-landscape', 'depots']) {
      const page = await target.history.entries({ scopes: [nodeAt(tree, address)!.id] })
      expect(page.entries.map((entry) => entry.subject)).toEqual(['Brought in from a file', 'Before the file came in'])
    }
  })

  it('writes no content where the landing is refused, and keeps the entry recorded before it', async () => {
    const source = memoryRepositories()
    await seed(source)
    const { bytes } = await writeWorkingFile(source)
    const target = memoryRepositories()
    await readWorkingFile(target, bytes)
    const later = memoryRepositories()
    await seed(later, organisation().map((scope) => ({ ...scope, model: { ...scope.model, description: 'Later.' } })))
    const refusing: Repositories = {
      ...target,
      scopes: new Proxy(target.scopes, {
        get: (held, key) => (key === 'apply'
          ? () => Promise.resolve({ refused: 'shell.scopeMoved' })
          : (Reflect.get(held, key, held) as (...args: unknown[]) => unknown).bind(held)),
      }),
    }

    await expect(readWorkingFile(refusing, (await writeWorkingFile(later)).bytes, { before: 'Before the file came in' }))
      .rejects.toMatchObject({ key: 'shell.scopeMoved' })

    const tree = await target.scopes.tree()
    const root = nodeAt(tree, '')!
    expect((await target.scopes.state(root.id))?.model.description).not.toBe('Later.')
    expect((await target.history.entries({ scopes: [root.id] })).entries.map((entry) => entry.subject)).toEqual(['Before the file came in'])
  })

  it('writes one scope and those under it, when asked from an address', async () => {
    const source = memoryRepositories()
    const [, landscape, depots] = organisation()
    await seed(source, [...organisation(), { ...depots, path: 'application-landscape/north', model: { ...depots.model, name: 'North' } }])
    const written = await writeWorkingFile(source, { from: 'application-landscape' })
    expect(written.name).toBe(`${slug(landscape.model.name)}.lvarch`)

    const target = memoryRepositories()
    const read = await readWorkingFile(target, written.bytes, { at: 'elsewhere' })
    if ('refused' in read) throw new Error(read.refused)
    expect(read.landed).toEqual(['elsewhere', 'elsewhere/north'])
    expect(read.arrival.short).toBeUndefined()
  })

  it('refuses bytes that are no working file, and writes nothing', async () => {
    const target = memoryRepositories()
    expect(await readWorkingFile(target, new TextEncoder().encode('not a working file'))).toEqual({ refused: 'shell.unknownFile' })
    expect((await target.scopes.tree()).root.children).toEqual([])
  })

  it('refuses to write from an address that holds no scope', async () => {
    await expect(writeWorkingFile(memoryRepositories(), { from: 'nowhere' })).rejects.toMatchObject({ key: 'shell.scopeGone' })
  })
})

/**
 * A working file never lands over a scope that could not be read whole, but
 * where a person asked for it to put that scope back — and never over one a
 * later version wrote, asked or not.
 */
/** Every entry a register holds, as it holds them. */
async function everyone(repositories: Repositories): Promise<readonly Person[]> {
  return (await repositories.people.list()).people
}

function added(answer: { person: Person } | { refused: string }): Person {
  if ('refused' in answer) throw new Error(answer.refused)
  return answer.person
}

describe('the people register in a working file (ADR-0036 §8)', () => {
  it('goes with the whole organisation, and lands by its ids', async () => {
    const source = memoryRepositories()
    await seed(source)
    const pia = added(await source.people.add({ name: 'Pia Schulz', email: 'pia@acme.example' }))
    const gijs = added(await source.people.add({ name: 'Gijs Mulder' }))
    added(await source.people.leave(gijs.id, '2026-08-14'))
    const { bytes } = await writeWorkingFile(source)

    const target = memoryRepositories()
    const read = await readWorkingFile(target, bytes)
    if ('refused' in read) throw new Error(read.refused)
    expect(read.arrival.short).toBeUndefined()
    expect(await everyone(target)).toEqual(await everyone(source))
    expect((await target.people.read(pia.id))?.email).toBe('pia@acme.example')
  })

  it('made without names holds no name and no address, and reads as pseudonyms where it lands', async () => {
    const source = memoryRepositories()
    await seed(source)
    const pia = added(await source.people.add({ name: 'Pia Schulz', email: 'pia.schulz@acme.example' }))
    const { bytes } = await writeWorkingFile(source, { withoutNames: true })
    const text = Object.values(unzipSync(bytes)).map((held) => new TextDecoder().decode(held)).join('\n')
    expect(text).not.toMatch(/Pia|Schulz|pia\.schulz/)
    expect(text).toContain(pia.pseudonym)

    const target = memoryRepositories()
    await readWorkingFile(target, bytes)
    expect(await target.people.read(pia.id)).toEqual({ id: pia.id, pseudonym: pia.pseudonym, kind: 'internal', state: 'active' })
  })

  it('brought back where it came from, gives no name back to an entry forgotten meanwhile, and takes no name away', async () => {
    const source = memoryRepositories()
    await seed(source)
    const pia = added(await source.people.add({ name: 'Pia Schulz' }))
    const kees = added(await source.people.add({ name: 'Kees Vos' }))
    const named = (await writeWorkingFile(source)).bytes
    const nameless = (await writeWorkingFile(source, { withoutNames: true })).bytes
    added(await source.people.forget(pia.id, '2026-10-11'))
    await readWorkingFile(source, named)
    await readWorkingFile(source, nameless)
    expect((await source.people.read(pia.id))?.name).toBeUndefined()
    expect((await source.people.read(kees.id))?.name).toBe('Kees Vos')
  })

  it('from before an erasure gives nobody back, and carries a removal to where it lands: forgetting travels', async () => {
    const source = memoryRepositories()
    await seed(source)
    const pia = added(await source.people.add({ name: 'Pia Schulz', email: 'pia@acme.example' }))
    const lastMonth = (await writeWorkingFile(source)).bytes
    const copy = memoryRepositories()
    await readWorkingFile(copy, lastMonth)
    expect((await copy.people.read(pia.id))?.name).toBe('Pia Schulz')

    added(await source.people.forget(pia.id, '2026-10-11'))
    const removed = await source.people.remove(pia.id)
    if ('refused' in removed) throw new Error(removed.refused)
    await readWorkingFile(source, lastMonth)
    expect(await source.people.read(pia.id)).toBeUndefined()
    expect(JSON.stringify(await source.people.list())).not.toMatch(/Pia|Schulz|pia@/)

    await readWorkingFile(copy, (await writeWorkingFile(source)).bytes)
    expect(await copy.people.read(pia.id)).toBeUndefined()
    expect((await copy.people.list()).removed).toContain(pia.id)
  })

  it('from an address carries the entries those scopes name, and the ones they were merged into', async () => {
    const source = memoryRepositories()
    const [, landscape] = organisation()
    const lindt = added(await source.people.add({ name: 'Eva Lindt' }))
    const lind = added(await source.people.add({ name: 'Eva Lind' }))
    added(await source.people.add({ name: 'Kees Vos' }))
    added(await source.people.merge(lindt.id, lind.id))
    const owned = {
      ...landscape,
      model: { ...landscape.model, elements: landscape.model.elements.map((element, at) => (at === 0 ? { ...element, owner: { person: lindt.id } as unknown as string } : element)) },
    }
    await seed(source, [organisation()[0], owned])
    const { bytes } = await writeWorkingFile(source, { from: 'application-landscape' })
    const target = memoryRepositories()
    await readWorkingFile(target, bytes, { at: 'elsewhere' })
    expect((await everyone(target)).map((person) => person.id).sort()).toEqual([lind.id, lindt.id].sort())
  })

  it('is no part of a file from an organisation that keeps nobody', async () => {
    const source = memoryRepositories()
    await seed(source)
    const { bytes } = await writeWorkingFile(source)
    expect(Object.keys(unzipSync(bytes))).not.toContain('.lionsville-architecture/people.json')
    const opened = await open(bytes, '')
    expect('refused' in opened ? opened : opened.people).toBeUndefined()
  })
})

describe('a working file over a scope that could not be read whole', () => {
  async function spoiledTarget(how: Spoiled) {
    const store = new MemoryStore()
    const target = memoryRepositories(store)
    await seed(target)
    const id = nodeAt(await target.scopes.tree(), 'application-landscape')!.id
    await spoilKept(store, id, how)
    const source = memoryRepositories()
    await seed(source, organisation().map((scope) => ({ ...scope, model: { ...scope.model, description: 'From the file.' } })))
    return { target, id, bytes: (await writeWorkingFile(source)).bytes, store }
  }

  for (const how of ['damaged', 'later'] as const) {
    it(`lands nothing where nobody asked it to put the scope back (${how})`, async () => {
      const { target, id, bytes, store } = await spoiledTarget(how)
      const raw = await store.transaction(['contents'], 'read', (tx) => tx.get('contents', id))
      await expect(readWorkingFile(target, bytes)).rejects.toMatchObject({ key: how === 'later' ? 'shell.laterNotReplaced' : 'shell.unreadableNotSaved' })
      expect(await store.transaction(['contents'], 'read', (tx) => tx.get('contents', id))).toEqual(raw)
      expect((await readScope(target.scopes, ''))?.model.description).not.toBe('From the file.')
    })
  }

  it('puts the scope back where a person asked, keeping it as it stood first', async () => {
    const { target, id } = await spoiledTarget('damaged')
    const source = memoryRepositories()
    await seed(source, organisation().map((scope) => ({ ...scope, model: { ...scope.model, description: 'From the file.' } })))
    const opened = await open((await writeWorkingFile(source, { from: 'application-landscape' })).bytes, 'application-landscape')
    if ('refused' in opened) throw new Error(opened.refused)
    const brought = await bringIn(target, opened, { putBack: { subject: 'As it stood' } })
    expect(brought.setAside).toEqual([])
    expect((await target.scopes.state(id))?.unreadable).toBeUndefined()
    expect((await target.scopes.state(id))?.model.description).toBe('From the file.')
    expect((await target.history.entries({ scopes: [id] })).entries[0].subject).toBe('As it stood')
  })

  it('puts back no scope a later version wrote, even where a person asked', async () => {
    const { target, id, store } = await spoiledTarget('later')
    const raw = await store.transaction(['contents'], 'read', (tx) => tx.get('contents', id))
    const source = memoryRepositories()
    await seed(source)
    const opened = await open((await writeWorkingFile(source, { from: 'application-landscape' })).bytes, 'application-landscape')
    if ('refused' in opened) throw new Error(opened.refused)
    await expect(bringIn(target, opened, { putBack: { subject: 'As it stood' } })).rejects.toMatchObject({ key: 'shell.laterNotReplaced' })
    expect(await store.transaction(['contents'], 'read', (tx) => tx.get('contents', id))).toEqual(raw)
  })
})
