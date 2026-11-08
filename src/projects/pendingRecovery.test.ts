// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import type { HeldSteps, PendingSteps } from '../ports/PendingSteps'
import { recoverPending, touchedSince } from './pendingRecovery'
import { fromArrays } from '../model/normalised'
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
    expect(await recoverPending(repositories.scopes, line)).toEqual({ put: 1, dropped: 0 })
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
    // A line with nothing said of what its records were at its base is not laid onto the scope as it is now.
    expect(await recoverPending(repositories.scopes, line, (message) => { said.push(message) })).toEqual({ put: 0, dropped: 1 })
    expect((await repositories.scopes.state(acme))!.model.elements.map((one) => one.id)).toEqual(['theirs'])
    expect(line.released).toEqual([0])
    expect(said[0]).toContain('shell.scopeMoved')
  })

  it('keeps a line it could not ask about for the next open, and answers nothing with no line', async () => {
    const repositories = memoryRepositories()
    const failing = { ...repositories.scopes, apply: () => Promise.reject(new Error('closed')) }
    const line = held([{ scope: { id: 'x', address: 'acme' }, base: 'r', steps: [stepOf(crews)], at: 1 }])
    expect(await recoverPending(failing, line)).toEqual({ put: 0, dropped: 0 })
    expect(line.released).toEqual([])
    expect(await recoverPending(repositories.scopes, undefined)).toEqual({ put: 0, dropped: 0 })
  })

  it('puts back the steps that touch nothing another tab changed since, and counts the rest', async () => {
    const repositories = memoryRepositories()
    const acme = landed(await repositories.scopes.create('acme', { name: 'Acme' })).id
    const twoApps = [crews, { ...crews, element: { ...crews.element, id: 'fleet', name: 'Fleet' } }]
    landed(await repositories.scopes.apply([{ scope: acme, steps: twoApps.map((one) => stepOf(one)), expects: (await readScope(repositories.scopes, 'acme'))!.revision! }]))
    const base = (await repositories.scopes.state(acme))!
    // The closed tab renamed Crews and Fleet; the open one renamed Fleet and saved.
    const ours = [
      stepOf({ type: 'element.update', id: 'crews', patch: { name: 'Crews (ours)' } }),
      stepOf({ type: 'element.update', id: 'fleet', patch: { name: 'Fleet (ours)' } }),
    ]
    const after = { ...base.model, elements: base.model.elements.map((one) => ({ ...one, name: `${one.name} (ours)` })) }
    const touched = touchedSince(fromArrays(base.model), fromArrays(after))
    expect(Object.keys(touched).sort()).toEqual(['element:crews', 'element:fleet'])
    landed(await repositories.scopes.apply([{ scope: acme, steps: [stepOf({ type: 'element.update', id: 'fleet', patch: { name: 'Fleet (theirs)' } })], expects: base.revision }]))
    const line = held([{ scope: { id: acme, address: 'acme' }, base: base.revision, steps: ours, touched, at: 1 }])
    expect(await recoverPending(repositories.scopes, line)).toEqual({ put: 1, dropped: 1 })
    const names = (await repositories.scopes.state(acme))!.model.elements.map((one) => one.name)
    expect(names).toEqual(['Crews (ours)', 'Fleet (theirs)'])
    expect(line.released).toEqual([0])
  })
})
