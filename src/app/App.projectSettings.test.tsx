// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * A scope's settings, from a scope that is open: one page, the home's, so what the
 * session did is written as it leaves and each field lands by itself, as a step.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { answering, heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
import { bareScope } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: { diagrams: { onSettingsChange?: (id: string, settings: { name: string; author: string }) => void } }) => (
      <button type="button" data-testid="edit-the-diagram" onClick={() => props.diagrams.onSettingsChange?.('d1', { name: 'L7', author: 'Grace' })}>
        edit
      </button>
    ),
  }
})

afterEach(() => cleanup())

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: { name: 'Landscape', elements: [], relations: [], diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })] },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

const saved = (store: HeldRepositories) => store.read('acme/landscape')

async function openSettings() {
  fireEvent.click(screen.getByTestId('scope-switcher-open'))
  fireEvent.click(await screen.findByText('Settings…'))
  await screen.findByTestId('scope-settings-page')
}

async function moveUnderGlobex() {
  await openSettings()
  fireEvent.change(await screen.findByLabelText('Filed under'), { target: { value: 'globex' } })
  fireEvent.click(await screen.findByTestId('settings-move'))
}

describe('a scope’s settings, from the scope that is open', () => {
  it('takes the scope to its new address with what was done in it, and leaves nothing behind', async () => {
    const store = heldRepositories([project(), bareScope('globex', 'Globex', 'domain')])
    renderApp({ repositories: store, boot: { initialProject: project() } })
    fireEvent.click(screen.getByTestId('edit-the-diagram'))
    await moveUnderGlobex()
    await waitFor(async () => expect((await store.read('globex/landscape'))?.model.diagrams[0].author).toBe('Grace'))
    expect(await store.read('acme/landscape')).toBeUndefined()
  })

  it('moves the scopes filed under the open one with it', async () => {
    const child: ScopeSnapshot = { ...bareScope('acme/landscape/team', 'Team', 'team') }
    const store = heldRepositories([project(), child, bareScope('globex', 'Globex', 'domain')])
    renderApp({ repositories: store, boot: { initialProject: project() } })
    await moveUnderGlobex()
    await waitFor(async () => expect(await store.read('acme/landscape')).toBeUndefined())
    expect((await store.read('globex/landscape/team'))?.model.name).toBe('Team')
  })

  it('says so where the move is refused, and moves nothing', async () => {
    const store = answering(
      heldRepositories([project(), bareScope('globex', 'Globex', 'domain')]),
      { move: () => Promise.resolve({ refused: 'shell.scopeTaken' }) },
    )
    renderApp({ repositories: store, boot: { initialProject: project() } })
    await moveUnderGlobex()
    expect(await screen.findByText(/already/)).toBeTruthy()
    expect(await store.read('globex/landscape')).toBeUndefined()
    expect(await store.read('acme/landscape')).toBeTruthy()
  })

  it('writes the name and the author by themselves, and keeps what the session did', async () => {
    const store = heldRepositories([project()])
    renderApp({ repositories: store, boot: { initialProject: project() } })
    fireEvent.click(screen.getByTestId('edit-the-diagram'))
    await openSettings()
    const name = await screen.findByTestId('settings-name')
    fireEvent.change(name, { target: { value: 'Renamed' } })
    fireEvent.blur(name)
    await waitFor(async () => expect((await saved(store))?.model.name).toBe('Renamed'))
    fireEvent.click(screen.getByRole('button', { name: 'On exports' }))
    const author = await screen.findByTestId('settings-author')
    fireEvent.change(author, { target: { value: 'Ada' } })
    fireEvent.blur(author)
    await waitFor(async () => {
      const held = await saved(store)
      expect(held?.model.defaultAuthor).toBe('Ada')
      expect(held?.model.diagrams[0].author).toBe('Grace')
    })
  })

  it('takes a change back with the frame’s undo', async () => {
    const store = heldRepositories([project()])
    renderApp({ repositories: store, boot: { initialProject: project() } })
    await openSettings()
    const name = await screen.findByTestId('settings-name')
    fireEvent.change(name, { target: { value: 'Renamed' } })
    fireEvent.blur(name)
    await waitFor(async () => expect((await saved(store))?.model.name).toBe('Renamed'))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await saved(store))?.model.name).toBe('Landscape'))
  })

  it('changes nothing on a scope that could not be read whole', async () => {
    const store = heldRepositories([{ ...project(), unreadable: ['model.json'] }])
    renderApp({ repositories: store, boot: { initialProject: { ...project(), unreadable: ['model.json'] } } })
    await openSettings()
    const name = await screen.findByTestId('settings-name')
    fireEvent.change(name, { target: { value: 'Renamed' } })
    fireEvent.blur(name)
    await waitFor(async () => expect((await saved(store))?.model.name).toBe('Landscape'))
  })
})
