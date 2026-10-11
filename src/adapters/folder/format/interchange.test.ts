// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the working file's interchange carries out of the repositories, where
 * the caller holds scopes of its own: a session's scope, which knows its
 * library's entries and not their bytes.
 */
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../../memory/memoryRepositories'
import { readScope } from '../../../projects/scopeAccess'
import type { ScopeSnapshot } from '../../../projects/scope'
import { readFileSync } from 'node:fs'
import { contentAddressOf } from '../../../model/imageName'
import { toDiagram } from '../../../model/normalised'
import { sealBytes, unsealBytes } from '../../../projects/sealedFile'
import { bringIn, carryOut, open } from './interchange'
import { seed } from './testing/organisation'

/** A scope as a session holds it: read as the app reads one, with no bytes. */
async function asHeld(repositories: ReturnType<typeof memoryRepositories>, address: string): Promise<ScopeSnapshot> {
  const held = await readScope(repositories.scopes, address)
  if (!held) throw new Error(`no scope at ${address}`)
  expect(held.imageLibrary).toBeUndefined()
  return held
}

describe('carrying out scopes the caller holds', () => {
  it('reads a held scope\'s pictures from where the source keeps them', async () => {
    const repositories = memoryRepositories()
    await seed(repositories)
    const held = await asHeld(repositories, 'application-landscape')

    const carried = await carryOut(repositories, { held: [held] })

    expect(Object.keys(unzipSync(carried.bytes))).toContain('application-landscape/images/depot.png')
    expect(carried.without).toEqual([])
  })

  it('names a picture whose bytes are not there, rather than leaving it out in silence', async () => {
    const repositories = memoryRepositories()
    await seed(repositories)
    const held = await asHeld(repositories, 'depots')
    const gone = { ...held.images![0], name: 'gone.png' }

    const carried = await carryOut(repositories, { held: [{ ...held, images: [...held.images!, gone] }] })

    expect(carried.without).toEqual(['depots/images/gone.png'])
  })

  it('carries no held scope from outside the scope it carries out', async () => {
    const repositories = memoryRepositories()
    await seed(repositories)
    const outside = await asHeld(repositories, 'depots')

    const carried = await carryOut(repositories, { from: 'application-landscape', held: [outside] })

    const inside = Object.keys(unzipSync(carried.bytes))
    expect(inside.filter((path) => path.endsWith('scope.json'))).toEqual(['scope.json'])
    expect(inside.filter((path) => path.startsWith('images/'))).toEqual(['images/depot.png'])
  })
})

describe('a drawing\'s picture, carried out and brought back', () => {
  const svg = readFileSync(new URL('../../../model/testing/drawio/nested-groups.svg', import.meta.url))

  /** An organisation with one drawing whose picture is the real export, its bytes put and named. */
  async function drawn(): Promise<{ repositories: ReturnType<typeof memoryRepositories>; address: string }> {
    const repositories = memoryRepositories()
    await seed(repositories)
    const tree = await repositories.scopes.tree()
    const scope = tree.root.children.find((node) => node.address === 'depots')!.id
    const put = await repositories.images.put(scope, 'drawing.svg', new Uint8Array(svg))
    if ('refused' in put) throw new Error(put.refused)
    const diagram = toDiagram({
      id: 'ctx', kind: 'drawing', name: 'Context', members: [],
      drawing: { xml: '<mxGraphModel><root/></mxGraphModel>', picture: put.contentAddress, links: [] },
    })
    const applied = await repositories.scopes.apply([{ scope, steps: [{ stepId: 'drawn', at: Date.now(), command: { type: 'diagram.create', diagram } }] }])
    if ('refused' in applied) throw new Error(String(applied.refused))
    return { repositories, address: put.contentAddress }
  }

  it('carries the picture as a file named by its address, and brings it into another source, byte for byte', async () => {
    const { repositories, address } = await drawn()
    expect(address).toBe(await contentAddressOf(new Uint8Array(svg)))
    const carried = await carryOut(repositories)
    const file = `depots/images/.drawings/${address.slice('sha256:'.length)}.svg`
    const inside = unzipSync(carried.bytes)
    expect(Object.keys(inside)).toContain(file)
    expect(inside[file]).toEqual(new Uint8Array(svg))

    for (const bytes of [carried.bytes, await unsealBytes(await sealBytes(carried.bytes, 'correct horse', { iterations: 1000 }), 'correct horse')]) {
      const opened = await open(bytes!, '')
      if ('refused' in opened) throw new Error(opened.refused)
      const elsewhere = memoryRepositories()
      await bringIn(elsewhere, opened)
      const there = (await elsewhere.scopes.tree()).root.children.find((node) => node.address === 'depots')!.id
      expect((await elsewhere.images.bytesAt(there, address))?.bytes).toEqual(new Uint8Array(svg))
      // Not a picture of the library there either.
      expect((await elsewhere.images.list(there, '')).images.some((entry) => entry.contentAddress === address)).toBe(false)
    }
  })
})
