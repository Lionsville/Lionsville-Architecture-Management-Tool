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
import { nodeAt } from '../../projects/scopeAccess'
import { slug } from '../../model/keys'
import { readWorkingFile, writeWorkingFile } from './workingFile'

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
