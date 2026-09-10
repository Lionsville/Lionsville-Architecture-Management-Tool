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
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { HostCommand } from '../platform/hostCommands'
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'
import { DEFAULT_LOCAL_SETTINGS } from '../projects/folderSettings'
import type { LocalSettings, LocalSettingsPatch } from '../projects/folderSettings'
import type { ProjectSnapshot } from '../projects/project'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project = (): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name: 'Landscape', customerName: 'Acme', elements: [], relations: [],
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

function fakeFolderSettings(initial: LocalSettings = DEFAULT_LOCAL_SETTINGS) {
  let held = initial
  const writes: LocalSettingsPatch[] = []
  const store: FolderSettingsStore = {
    id: 'fake',
    readFolder: () => Promise.resolve({}),
    readLocal: () => Promise.resolve(held),
    writeLocal: (patch) => {
      writes.push(patch)
      held = { git: { ...held.git, ...patch.git } }
      return Promise.resolve()
    },
  }
  return { store, writes }
}

const history = (available: boolean): ProjectHistory => ({
  available: () => Promise.resolve(available),
  keeping: () => Promise.resolve(true),
  start: () => Promise.resolve(),
  snapshot: () => Promise.resolve(true),
  entries: () => Promise.resolve([]),
  projectAt: () => Promise.resolve(undefined),
  label: () => Promise.resolve('done'),
})

function show(over: Parameters<typeof renderApp>[0] = {}) {
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    projects: new InMemoryProjectStore([project()]),
    initialProject: project(),
    commands: (listener) => { listeners.push(listener); return () => {} },
    ...over,
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
    const view = show({ updateSettings: updates.store })
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
    const view = show({ updateSettings: updates.store })
    await opened(view)
    fireEvent.click(await screen.findByText('Beta'))
    await waitFor(() => expect(updates.writes).toEqual([{ channel: 'beta' }]))
  })
})

describe('the machine scope', () => {
  it('is absent without a folder', async () => {
    const view = show({ history: history(true) })
    await opened(view)
    expect(screen.queryByText(/ON THIS MACHINE/)).toBeNull()
  })

  it('is absent with a folder but no history — a tab with a directory handle', async () => {
    const view = show({ folderSettings: fakeFolderSettings().store })
    await opened(view)
    await act(() => Promise.resolve())
    expect(screen.queryByText(/ON THIS MACHINE/)).toBeNull()
  })

  it('is absent when the history says this machine cannot keep one', async () => {
    const view = show({ folderSettings: fakeFolderSettings().store, history: history(false) })
    await opened(view)
    await act(() => Promise.resolve())
    expect(screen.queryByText(/ON THIS MACHINE/)).toBeNull()
  })

  it('writes to the folder, as a patch, and says it stays on this machine', async () => {
    const folder = fakeFolderSettings()
    const view = show({ folderSettings: folder.store, history: history(true) })
    await opened(view)
    expect(await screen.findByText('THIS FOLDER, ON THIS MACHINE')).toBeDefined()
    expect(screen.getByText(/local\.json/)).toBeDefined()

    fireEvent.click(screen.getByLabelText(/Push after every snapshot/))
    await waitFor(() => expect(folder.writes).toEqual([{ git: { pushAfterSnapshot: true } }]))
    // Not a project change: the document's dirty state does not move.
    expect(screen.getByTestId('saved-indicator').textContent).toBe('Not saved yet')
    // And nothing of it in the blob either.
    expect(JSON.stringify(await view.preferences.read() ?? {})).not.toContain('pushAfterSnapshot')
  })
})
