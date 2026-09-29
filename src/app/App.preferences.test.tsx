// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The preferences dialog, from the command that opens it to the two seams it
 * writes through (ADR-0005).
 *
 * The rule under test is scope: a setting is written to whatever it is about.
 * Language goes to the preferences blob, the update check goes to the host's
 * own store, and the machine flags go to the folder — and a section whose
 * scope this shell does not have is absent, not disabled.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { heldRepositories } from './testing/heldRepositories'
import type { HostCommand } from '../platform/hostCommands'
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'
import type { ScopeSnapshot } from '../projects/scope'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape', elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

function fakeUpdates(initial: UpdateSettings = { checkAutomatically: true, channel: 'stable' }) {
  let held = initial
  const writes: UpdateSettingsPatch[] = []
  const store: UpdateSettingsStore = {
    id: 'fake',
    read: () => Promise.resolve(held),
    write: (patch) => { writes.push(patch); held = { ...held, ...patch }; return Promise.resolve(held) },
  }
  return { store, writes }
}

function show(over: Parameters<typeof renderApp>[0] = {}) {
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    repositories: heldRepositories([project()]),
    ...over,
    boot: { initialProject: project(), ...over.boot },
    host: { commands: (listener) => { listeners.push(listener); return () => {} }, ...over.host },
  })
  return {
    ...harness,
    send: (command: HostCommand) => act(() => { for (const held of listeners) held(command) }),
  }
}

const opened = async (view: ReturnType<typeof show>) => {
  view.send({ type: 'preferences' })
  await waitFor(() => expect(screen.getByTestId('preferences-dialog')).toBeDefined())
}

describe('opening it', () => {
  it('answers the preferences command, from the menu bar or the overflow', async () => {
    const view = show()
    expect(screen.queryByTestId('preferences-dialog')).toBeNull()
    await opened(view)
  })

  it('is reachable from the overflow on the web', async () => {
    show()
    fireEvent.click(screen.getByTestId('overflow-button'))
    fireEvent.click(await screen.findByText('Preferences…'))
    await waitFor(() => expect(screen.getByTestId('preferences-dialog')).toBeDefined())
  })
})

describe('the application scope', () => {
  it('changes the language of the whole shell, and remembers it', async () => {
    const view = show()
    await opened(view)
    fireEvent.click(screen.getByText('Nederlands'))
    await waitFor(() => expect(screen.getByText('Voorkeuren')).toBeDefined())
    expect(await view.preferences.read()).toMatchObject({ language: 'nl' })
  })

  it('changes the theme, the same way the View menu does', async () => {
    const view = show()
    await opened(view)
    fireEvent.click(screen.getByText('Dark'))
    await waitFor(async () => {
      expect(await view.preferences.read()).toMatchObject({ themeMode: 'dark' })
    })
  })
})

describe('the update check', () => {
  it('is absent on a host with no store for it', async () => {
    const view = show()
    await opened(view)
    expect(screen.queryByText('UPDATES')).toBeNull()
  })

  it('is read from the host and written back to it', async () => {
    const updates = fakeUpdates({ checkAutomatically: true, channel: 'stable' })
    const view = show({ host: { updateSettings: updates.store } })
    await opened(view)
    const box = await screen.findByLabelText('Check for updates automatically') as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    await waitFor(() => expect(updates.writes).toEqual([{ checkAutomatically: false }]))
    // Nothing of it in the blob: it belongs to the host, not to the renderer.
    expect(JSON.stringify(await view.preferences.read() ?? {})).not.toContain('checkAutomatically')
  })

  it('switches the channel through the same store (ADR-0006)', async () => {
    const updates = fakeUpdates()
    const view = show({ host: { updateSettings: updates.store } })
    await opened(view)
    fireEvent.click(await screen.findByText('Beta'))
    await waitFor(() => expect(updates.writes).toEqual([{ channel: 'beta' }]))
  })
})

describe('what the open source\'s provider puts here', () => {
  it('is drawn under the app\'s own sections, handed what the provider handed with its parts', async () => {
    const view = show({
      provider: {
        own: 'this folder',
        preferencesPanel: ({ own }) => <p data-testid="source-preferences">{`about ${String(own)}`}</p>,
      },
    })
    await opened(view)
    expect(screen.getByTestId('source-preferences').textContent).toBe('about this folder')
  })

  it('falls over on its own, with the dialog still standing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const view = show({ provider: { preferencesPanel: () => { throw new Error('the panel fell over') } } })
      await opened(view)
      expect(screen.getByTestId('crash-fallback')).toBeDefined()
      expect(screen.getByTestId('preferences-dialog')).toBeDefined()
    } finally {
      spy.mockRestore()
    }
  })
})
