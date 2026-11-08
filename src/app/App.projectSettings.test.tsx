// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * A scope's settings, from a scope that is open: one page, the home's, so what the
 * session did is written as it leaves and each field lands by itself, as a step.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { HostCommand } from '../platform/hostCommands'
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

  it('puts a field back with Escape and keeps the page; the next Escape closes it', async () => {
    renderApp({ repositories: heldRepositories([project()]), boot: { initialProject: project() } })
    await openSettings()
    const name = await screen.findByTestId('settings-name') as HTMLInputElement
    fireEvent.change(name, { target: { value: 'Half typed' } })
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(name.value).toBe('Landscape')
    expect(screen.getByTestId('scope-settings-page')).toBeDefined()
    fireEvent.keyDown(name, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('scope-settings-page')).toBeNull())
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

/**
 * Every field of the page is a step the Edit menu's Undo and ⌘Z take back, as
 * the frame's ↶ does — on the home, where no session is open to hear them —
 * and still after the page has closed. *Filed under* and *Served by* are not,
 * and the page's first line says so.
 */
describe('a setting taken back', () => {
  function show() {
    const listeners: ((command: HostCommand) => void)[] = []
    const store = heldRepositories([project()])
    renderApp({
      repositories: store, boot: { initialProject: project() },
      host: { commands: (listener) => { listeners.push(listener); return () => { listeners.splice(listeners.indexOf(listener), 1) } } },
    })
    const send = (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) })
    return { store, send }
  }
  const model = async (store: HeldRepositories) => (await saved(store))?.model
  const leave = (field: HTMLElement, value: string) => {
    fireEvent.change(field, { target: { value } })
    fireEvent.blur(field)
  }

  it('the name, by the menu’s Undo, and by ⌘Z once the page has closed', async () => {
    const { store, send } = show()
    await openSettings()
    leave(await screen.findByTestId('settings-name'), 'Renamed')
    await waitFor(async () => expect((await model(store))?.name).toBe('Renamed'))
    send({ type: 'undo' })
    await waitFor(async () => expect((await model(store))?.name).toBe('Landscape'))
    leave(await screen.findByTestId('settings-name'), 'Renamed again')
    await waitFor(async () => expect((await model(store))?.name).toBe('Renamed again'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('scope-settings-page')).toBeNull())
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    await waitFor(async () => expect((await model(store))?.name).toBe('Landscape'))
  })

  it('leaves the Undo to a text field that has the focus', async () => {
    const { store } = show()
    await openSettings()
    const name = await screen.findByTestId('settings-name')
    leave(name, 'Renamed')
    await waitFor(async () => expect((await model(store))?.name).toBe('Renamed'))
    name.focus()
    fireEvent.keyDown(name, { key: 'z', ctrlKey: true })
    await new Promise((settle) => setTimeout(settle, 50))
    expect((await model(store))?.name).toBe('Renamed')
  })

  it('what this is, the description and the links', async () => {
    const { store, send } = show()
    await openSettings()
    const type = await screen.findByTestId('scope-type-field') as HTMLSelectElement
    const before = type.value
    const other = Array.from(type.options).find((option) => option.value !== before && !option.disabled)!.value
    fireEvent.change(type, { target: { value: other } })
    await waitFor(() => expect((screen.getByTestId('scope-type-field') as HTMLSelectElement).value).toBe(other))
    send({ type: 'undo' })
    await waitFor(() => expect((screen.getByTestId('scope-type-field') as HTMLSelectElement).value).toBe(before))

    leave(screen.getByPlaceholderText('Who they are, what this landscape covers, who to ask.'), 'What it covers')
    await waitFor(async () => expect((await model(store))?.description).toBe('What it covers'))
    send({ type: 'undo' })
    await waitFor(async () => expect((await model(store))?.description ?? '').toBe(''))

    fireEvent.click(screen.getByRole('button', { name: 'Links' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add a link' }))
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'https://wiki.example' } })
    fireEvent.blur(screen.getByLabelText('Address'))
    await waitFor(async () => expect((await saved(store))?.links?.map((link) => link.url)).toEqual(['https://wiki.example']))
    send({ type: 'undo' })
    await waitFor(async () => expect((await saved(store))?.links ?? []).toEqual([]))
    expect(screen.queryByDisplayValue('https://wiki.example')).toBeNull()
  })

  it('the client and the default author', async () => {
    const { store, send } = show()
    await openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'On exports' }))
    leave(await screen.findByTestId('settings-client'), 'Globex')
    await waitFor(async () => expect((await saved(store))?.client).toBe('Globex'))
    send({ type: 'undo' })
    await waitFor(async () => expect((await saved(store))?.client ?? '').toBe(''))
    leave(await screen.findByTestId('settings-author'), 'Ada')
    await waitFor(async () => expect((await model(store))?.defaultAuthor).toBe('Ada'))
    send({ type: 'undo' })
    await waitFor(async () => expect((await model(store))?.defaultAuthor ?? '').toBe(''))
  })
})
