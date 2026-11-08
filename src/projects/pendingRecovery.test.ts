// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import type { HeldSteps, PendingSteps } from '../ports/PendingSteps'
import { recoverPending } from './pendingRecovery'
import { landed, readScope, stepOf } from './scopeAccess'

const crews = { type: 'element.create', element: { id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: false, aspects: {} } } as const

/** A line that holds what it is given, and says which were let go of. */
function held(lines: HeldSteps[]): PendingSteps & { released: number[] } {
  const released: number[] = []
  return {
    released,
    hold: () => true,
    clear: () => undefined,
    left: () => Promise.resolve(lines.map((line, n) => ({ ...line, release: () => { released.push(n) } }))),
  }
}

describe('recoverPending', () => {
  it('puts back a line made against the revision the scope is at, by identity or by address', async () => {
    const repositories = memoryRepositories()
    const acme = landed(await repositories.scopes.create('acme', { name: 'Acme' })).id
    const base = (await readScope(repositories.scopes, 'acme'))!.revision!
    const line = held([{ scope: { address: 'acme' }, base, steps: [stepOf(crews)], at: 1 }])
    expect(await recoverPending(repositories.scopes, line)).toBe(1)
    expect((await repositories.scopes.state(acme))!.model.elements.map((one) => one.id)).toContain('crews')
    expect(line.released).toEqual([0])
  })

  it('refuses a line over a scope that moved since, lets it go, and writes nothing over it', async () => {
    const repositories = memoryRepositories()
    const acme = landed(await repositories.scopes.create('acme', { name: 'Acme' })).id
    const base = (await readScope(repositories.scopes, 'acme'))!.revision!
    // The write landed after all, or another tab changed the scope.
    landed(await repositories.scopes.apply([{ scope: acme, steps: [stepOf({ ...crews, element: { ...crews.element, id: 'theirs', name: 'Theirs' } })], expects: base }]))
    const line = held([{ scope: { id: acme, address: 'acme' }, base, steps: [stepOf(crews)], at: 1 }])
    const said: string[] = []
    expect(await recoverPending(repositories.scopes, line, (message) => { said.push(message) })).toBe(0)
    expect((await repositories.scopes.state(acme))!.model.elements.map((one) => one.id)).toEqual(['theirs'])
    expect(line.released).toEqual([0])
    expect(said[0]).toContain('shell.scopeMoved')
  })

  it('keeps a line it could not ask about for the next open, and answers nothing with no line', async () => {
    const repositories = memoryRepositories()
    const failing = { ...repositories.scopes, apply: () => Promise.reject(new Error('closed')) }
    const line = held([{ scope: { id: 'x', address: 'acme' }, base: 'r', steps: [stepOf(crews)], at: 1 }])
    expect(await recoverPending(failing, line)).toBe(0)
    expect(line.released).toEqual([])
    expect(await recoverPending(repositories.scopes, undefined)).toBe(0)
  })
})
