// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A scope that could not be read whole, put back (`ScopeState.unreadable`,
 * `projects/putBack.ts`): opened to be looked at with the two ways back on
 * its notice, the history's page offering the whole scope rather than a
 * restore, and the scope opened again reading whole — in memory, the
 * implementation every suite runs first, with nothing to mend by hand.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installReactFlowMocks } from '../../editor/reactFlowTestSetup'
import { MemoryStore } from '../../adapters/memory/MemoryStore'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { spoilKept } from '../../adapters/repositories/testing/spoil'
import type { Spoiled } from '../../ports/Repositories.contract'
import { element } from '../../ports/Repositories.contract'
import type { Repositories } from '../../ports/Repositories'
import { placeWhole, readScope } from '../../projects/scopeAccess'
import { emptyContent } from '../../projects/scopeState'
import type { ScopeId } from '../../projects/scopeState'
import { renderApp } from '../testing/renderShell'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

/** A scope with one element, recorded, and then made one this build cannot read whole: torn, or a later version's. */
async function spoiled(how: Spoiled = 'damaged'): Promise<{ repositories: Repositories; acme: ScopeId; store: MemoryStore }> {
  const store = new MemoryStore()
  const repositories = memoryRepositories(store)
  const acme = await placeWhole(repositories.scopes, 'acme', {
    ...emptyContent('Acme'), model: { ...emptyContent('Acme').model, elements: [element('crews', 'Crews')] },
  })
  await repositories.history.record({ subject: 'Crews in' })
  await spoilKept(store, acme, how)
  return { repositories, acme, store }
}

describe('a scope that could not be read whole', () => {
  it('is put back from the history, and opens again reading whole', async () => {
    const { repositories, acme } = await spoiled()
    const project = await readScope(repositories.scopes, 'acme')
    expect(project?.unreadable?.length).toBeGreaterThan(0)
    renderApp({ repositories, boot: { initialProject: project } })

    const notice = await screen.findByTestId('unreadable-notice')
    expect(within(notice).getByTestId('unreadable-bring-in').textContent).toBe('Bring in a working file…')
    fireEvent.click(within(notice).getByTestId('unreadable-put-back'))
    expect(within(await screen.findByTestId('history-list')).getByText('Crews in')).toBeDefined()
    const putBack = await screen.findByTestId('history-restore')
    // Offered although what could be read is what the snapshot held: the part that could not be read is not.
    await waitFor(() => expect((putBack as HTMLButtonElement).disabled).toBe(false))
    expect(putBack.textContent).toBe('Put back the whole scope…')
    fireEvent.click(putBack)
    // Nothing is promised that is not so: what could not be read is kept first, or nothing is put back.
    expect((await screen.findByRole('dialog')).textContent).not.toContain('The history keeps everything')
    fireEvent.click(await screen.findByRole('button', { name: 'Put back' }))

    await waitFor(() => expect(screen.queryByTestId('unreadable-notice')).toBeNull())
    const state = await repositories.scopes.state(acme)
    expect(state?.unreadable).toBeUndefined()
    expect(state?.model.elements.map((one) => one.id)).toEqual(['crews'])
    expect(await screen.findByText(/The scope is back as it was on .* An entry of the scope as it stood/)).toBeDefined()
    // The scope as it stood, unread and all, is an entry of its history, before the put back.
    const [kept] = (await repositories.history.entries({ scopes: [acme] })).entries
    expect(kept.subject).toBe('Before it was put back from the history')
  })

  /**
   * A scope a later version wrote is somebody's newer work: a stale tab offers
   * no way to put it back, and the notice says to update the app.
   */
  it('offers nothing to put back where a later version wrote it, and says to update the app', async () => {
    const { repositories, acme, store } = await spoiled('later')
    const project = await readScope(repositories.scopes, 'acme')
    expect(project?.later).toBe(true)
    renderApp({ repositories, boot: { initialProject: project } })
    const notice = await screen.findByTestId('unreadable-notice')
    expect(notice.textContent).toContain('Update the app to change it.')
    expect(within(notice).queryByTestId('unreadable-put-back')).toBeNull()
    expect(within(notice).queryByTestId('unreadable-bring-in')).toBeNull()
    const raw = await store.transaction(['contents'], 'read', (tx) => tx.get<{ format: number }>('contents', acme))
    expect(raw?.format).toBe(2)
  })

  it('names the ways every source has, and a file to mend only where its source says there is one', async () => {
    const { repositories } = await spoiled()
    const project = await readScope(repositories.scopes, 'acme')
    renderApp({ repositories, boot: { initialProject: project } })
    const said = (await screen.findByTestId('unreadable-notice')).textContent ?? ''
    expect(said).toContain('Put it back from the history, or bring in a working file.')
    expect(said).not.toContain('Mend')
    cleanup()
    renderApp({ repositories, boot: { initialProject: project }, provider: { sayings: { unreadableKey: 'folder.unreadableScope' } } })
    expect((await screen.findByTestId('unreadable-notice')).textContent).toContain('Mend the file')
  })

  it('offers no way back where the source may not be written', async () => {
    const { repositories } = await spoiled()
    const project = await readScope(repositories.scopes, 'acme')
    renderApp({ repositories, boot: { initialProject: project }, provider: { readOnlyAt: () => true } })
    const notice = await screen.findByTestId('unreadable-notice')
    expect(within(notice).queryByTestId('unreadable-put-back')).toBeNull()
    expect(within(notice).queryByTestId('unreadable-bring-in')).toBeNull()
  })
})
