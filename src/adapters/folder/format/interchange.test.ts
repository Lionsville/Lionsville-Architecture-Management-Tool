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
import { carryOut } from './interchange'
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
