// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Applied, ScopeRepository } from '../ports/ScopeRepository'
import type { ScopeState } from '../ports/ScopeRepository'
import { readsAfterWrites } from './readsAfterWrites'

/** A repository whose writes land when the test says, and whose reads answer what has landed by then. */
function slowRepository() {
  let count = 1
  const landings: (() => void)[] = []
  const reads: string[] = []
  const repository = {
    id: 'slow',
    extra: () => 'kept',
    state: (scope: string) => {
      reads.push(scope)
      const seen = count
      return Promise.resolve({ revision: String(seen) } as unknown as ScopeState)
    },
    apply: () => new Promise<Applied>((resolve) => {
      landings.push(() => { count += 1; resolve({ revisions: [String(count)] }) })
    }),
  } as unknown as ScopeRepository & { extra(): string }
  return { repository, reads, land: () => landings.shift()?.() }
}

const flushed = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('readsAfterWrites', () => {
  it('reads a scope only once the write to it under way has landed: a reopen straight after leaving shows the edit', async () => {
    const { repository, land } = slowRepository()
    const scopes = readsAfterWrites(repository)
    const write = scopes.apply([{ scope: 'team', steps: [] }])
    const read = scopes.state('team')
    await flushed()
    land()
    await write
    expect((await read)?.revision).toBe('2')
  })

  it('reads again where a write began while the read was out', async () => {
    const { repository, reads, land } = slowRepository()
    const scopes = readsAfterWrites(repository)
    const read = scopes.state('team')
    const write = scopes.apply([{ scope: 'team', steps: [] }])
    await flushed()
    land()
    await write
    expect((await read)?.revision).toBe('2')
    expect(reads).toEqual(['team', 'team'])
  })

  it('leaves a read of another scope alone, and keeps what else the repository has', async () => {
    const { repository, reads } = slowRepository()
    const scopes = readsAfterWrites(repository) as typeof repository
    void scopes.apply([{ scope: 'team', steps: [] }])
    expect((await scopes.state('other'))?.revision).toBe('1')
    expect(reads).toEqual(['other'])
    expect(scopes.extra()).toBe('kept')
    expect(scopes.id).toBe('slow')
  })

  it('answers after a refused write as after any other: the read is of what it left', async () => {
    const repository = {
      id: 'refusing',
      state: () => Promise.resolve({ revision: '1' } as unknown as ScopeState),
      apply: () => Promise.reject(new Error('no')),
    } as unknown as ScopeRepository
    const scopes = readsAfterWrites(repository)
    await expect(scopes.apply([{ scope: 'team', steps: [] }])).rejects.toThrow('no')
    expect((await scopes.state('team'))?.revision).toBe('1')
  })
})
