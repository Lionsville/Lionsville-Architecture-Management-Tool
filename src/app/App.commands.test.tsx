// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The File menu, and the document the operating system opens us with.
 *
 * Nothing here is a new capability — every command is something the toolbar can
 * already do, which is what a menu is for. What is worth pinning is the
 * routing: the shell takes the commands about folders, the workspace takes the
 * ones about the project that is open, and each subscribes for itself rather
 * than one of them switching over commands it does not own.
 *
 * The editor is stubbed. What is under test is the wiring between a command and
 * the store, and a real canvas would only slow it down.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import type { HostCommand } from '../platform/hostCommands'
import { FILE_MENU, HELP_MENU, PREFERENCES_ITEM, THEME_ITEMS, offered } from '../platform/menu'
import { translator } from '../i18n'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { ScopeSnapshot } from '../projects/scope'
import { sealBytes, unsealBytes } from '../projects/sealedFile'
import { workingFileBytes } from '../projects/workingFile'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      diagrams: { onSettingsChange?: (id: string, settings: { name: string }) => void }
    }) => (
      <button
        data-testid="edit-the-diagram"
        onClick={() => props.diagrams.onSettingsChange?.('d1', { name: 'Edited' })}
      >
        edit
      </button>
    ),
  }
})

afterEach(() => cleanup())

const project = (name = 'Landscape'): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name,
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The command stream, as the preload would hand it over. */
function show(over: Parameters<typeof renderApp>[0] = {}) {
  const listeners: ((command: HostCommand) => void)[] = []
  const projects = new InMemoryScopeStore([project()])
  const harness = renderApp({
    scopes: projects,
    ...over,
    boot: { initialProject: project(), ...over.boot },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
      ...over.host,
    },
  })
  return {
    ...harness,
    projects,
    listeners: () => listeners.length,
    send: (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) }),
  }
}

/** Type the password into the dialog that is up, twice where it asks twice. */
async function seal(password: string) {
  await waitFor(() => expect(screen.getByTestId('password')).toBeDefined())
  fireEvent.change(screen.getByTestId('password'), { target: { value: password } })
  fireEvent.change(screen.getByTestId('password-repeat'), { target: { value: password } })
  fireEvent.click(screen.getByTestId('password-confirm'))
}

async function enter(password: string) {
  await waitFor(() => expect(screen.getByTestId('password')).toBeDefined())
  fireEvent.change(screen.getByTestId('password'), { target: { value: password } })
  fireEvent.click(screen.getByTestId('password-confirm'))
}

describe('commands from the host', () => {
  it('reach the shell and the workspace through one bus, subscribed to once', () => {
    // One subscription to the host, because the web's overflow sends into the
    // same bus (ADR-0005): the shell and the workspace each listen to the bus
    // for what they own, and neither knows who pressed the item.
    expect(show().listeners()).toBe(1)
  })

  it('Export… asks for a password and hands the working set over sealed under it', async () => {
    const view = show()
    view.send({ type: 'export' })

    await seal('correct horse')
    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('landscape.lvarch')
    expect(view.documents.saved[0].mediaType).toBe('application/octet-stream')
    expect(await unsealBytes(view.documents.saved[0].bytes as Uint8Array, 'correct horse')).toBeDefined()
  })

  it('Export… from the organisation’s home writes the same file, with nothing open (ADR-0023)', async () => {
    const view = show()
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(screen.queryByTestId('crumb-')).toBeNull())
    view.send({ type: 'export' })

    await seal('correct horse')
    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('landscape.lvarch')
    expect(await unsealBytes(view.documents.saved[0].bytes as Uint8Array, 'correct horse')).toBeDefined()
  })

  it('a sealed document from the OS asks for its password, and opens on the right one', async () => {
    const view = show()
    view.send({
      type: 'openDocument',
      name: 'theirs.lvarch',
      bytes: await sealBytes(workingFileBytes([project('From a colleague')]), 'correct horse', { iterations: 1_000 }),
    })

    await enter('incorrect horse')
    await waitFor(() => expect(screen.getByText(/not the password/)).toBeDefined())
    await enter('correct horse')
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText('From a colleague')).toBeDefined())
  })

  it('a document from the OS lands on a home too, into the scope that home is about', async () => {
    const view = show()
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(screen.queryByTestId('crumb-')).toBeNull())
    view.send({
      type: 'openDocument',
      name: 'theirs.lvarch',
      bytes: workingFileBytes([{ ...project('From a colleague'), path: '' }]),
    })

    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(async () => expect((await view.projects.load(''))?.model.name).toBe('From a colleague'))
  })

  it('the theme is chosen outright, from the View menu or the overflow', async () => {
    const view = show({ boot: { initialPreferences: { themeMode: 'light' } } })
    view.send({ type: 'theme', mode: 'dark' })
    await waitFor(async () => {
      expect(await view.preferences.read()).toMatchObject({ themeMode: 'dark' })
    })
  })

  it('reports the theme to the host, so a radio item can be right', async () => {
    const reported: string[] = []
    const view = show({ host: { onThemeMode: (mode) => reported.push(mode) } })
    expect(reported).toEqual(['system'])
    view.send({ type: 'theme', mode: 'light' })
    await waitFor(() => expect(reported.at(-1)).toBe('light'))
  })

  it('reports whether a scope is open, so the items about one can be enabled only then', async () => {
    // The third fact main is told (ADR-0005, amended): true with the project
    // open, false once the person is back on the organisation's home.
    const reported: boolean[] = []
    show({ host: { onScopeOpen: (open) => reported.push(open) } })
    expect(reported).toEqual([true])
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(reported.at(-1)).toBe(false))
  })

  it('opens the manual in the app\'s language, outside the app', () => {
    const view = show({ boot: { initialPreferences: { language: 'nl' } } })
    view.send({ type: 'manual' })
    expect(view.hostControls.openExternal).toHaveBeenCalledWith(
      'https://github.com/Lionsville/Lionsville-Architecture-Management-Tool/blob/main/docs/manual.nl.md',
    )
  })

  it('Undo from the host takes back the last step, and a focused field keeps its own', async () => {
    const view = show()
    const named = async () => (await view.projects.load('acme/landscape'))?.model.diagrams[0].name
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    view.send({ type: 'save' })
    await waitFor(async () => expect(await named()).toBe('Edited'))
    // A text field with focus gets the page's own undo, as Electron's role gave it.
    view.hostControls.editInField.mockReturnValueOnce(true)
    view.send({ type: 'undo' })
    expect(view.hostControls.editInField).toHaveBeenCalledWith('undo')
    view.send({ type: 'save' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(await named()).toBe('Edited')
    // Nothing focused: the app's one stack.
    view.send({ type: 'undo' })
    view.send({ type: 'save' })
    await waitFor(async () => expect(await named()).toBe('L7'))
  })

  it('Save writes now rather than waiting for the idle timer', async () => {
    const view = show()
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    view.send({ type: 'save' })

    await waitFor(async () => {
      const held = await view.projects.load('acme/landscape')
      expect(held?.model.diagrams[0].name).toBe('Edited')
    })
  })

  it('a document from the OS asks where it goes, and replaces the open scope only on "here"', async () => {
    const view = show()
    view.send({
      type: 'openDocument',
      name: 'theirs.lvarch',
      bytes: workingFileBytes([project('From a colleague')]),
    })

    // The warning names what replacing writes over (ADR-0025).
    await waitFor(() => expect(screen.getByText(/writes over “Landscape”/)).toBeDefined())
    expect(screen.queryByText('From a colleague')).toBeNull()
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText('From a colleague')).toBeDefined())
  })

  it('a cancelled landing writes nothing and says nothing', async () => {
    const view = show()
    view.send({
      type: 'openDocument', name: 'theirs.lvarch', bytes: workingFileBytes([project('From a colleague')]),
    })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByTestId('open-into-here')).toBeNull())
    expect((await view.projects.load('acme/landscape'))?.model.name).toBe('Landscape')
    expect(screen.queryByText('From a colleague')).toBeNull()
  })

  it('a new folder is offered where one can be chosen, checked for what it holds, and written with the file at its root', async () => {
    const placed: string[][] = []
    const view = show({
      folder: {
        onChooseForWorkingFile: () => Promise.resolve({
          name: 'Elsewhere',
          occupied: true,
          place: (scopes) => { placed.push(scopes.map((scope) => scope.path)); return Promise.resolve() },
        }),
      },
    })
    view.send({
      type: 'openDocument',
      name: 'theirs.lvarch',
      bytes: workingFileBytes([{ ...project('From a colleague'), path: 'org' }, { ...project('Under it'), path: 'org/retail' }]),
    })
    await waitFor(() => expect(screen.getByTestId('open-into-folder')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-folder'))

    // Not empty: a second yes before anything is written there.
    await waitFor(() => expect(screen.getByText(/already holds “Elsewhere”/)).toBeDefined())
    fireEvent.click(screen.getByText('Replace'))
    await waitFor(() => expect(placed).toEqual([['', 'retail']]))
    // And nothing here was touched.
    expect((await view.projects.load('acme/landscape'))?.model.name).toBe('Landscape')
  })

  it('offers no folder where none can be chosen', async () => {
    const view = show()
    view.send({
      type: 'openDocument', name: 'theirs.lvarch', bytes: workingFileBytes([project('From a colleague')]),
    })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    expect(screen.queryByTestId('open-into-folder')).toBeNull()
  })

  it('Open Folder… asks the shell, which is the only layer that can', () => {
    const choose = vi.fn()
    const view = show({ folder: { onChoose: choose } })
    view.send({ type: 'chooseFolder' })

    expect(choose).toHaveBeenCalled()
  })

  it('a folder from the Recent menu is opened by its root', () => {
    const open = vi.fn()
    const view = show({ folder: { onOpen: open } })
    view.send({ type: 'openFolder', root: '/Users/someone/Architecture' })

    expect(open).toHaveBeenCalledWith('/Users/someone/Architecture')
  })

  it('lets go when the app does', () => {
    const view = show()
    cleanup()
    expect(view.listeners()).toBe(0)
  })
})

/**
 * On the web the overflow is load-bearing: everything that moved out of the
 * toolbar and into the menu bar (ADR-0005) is reachable only through it, so a
 * jsdom test walks the whole list.
 */
describe('the overflow on the web', () => {
  const history: ProjectHistory = {
    available: () => Promise.resolve(true),
    keeping: () => Promise.resolve(true),
    start: () => Promise.resolve(),
    snapshot: () => Promise.resolve(true),
    entries: () => Promise.resolve([]),
    projectAt: () => Promise.resolve(undefined),
    label: () => Promise.resolve('done'),
  }
  const s = translator('en')

  const openOverflow = async () => {
    fireEvent.click(screen.getByTestId('overflow-button'))
    await waitFor(() => expect(screen.getByText('Save a Copy of the Working File…')).toBeDefined())
  }

  it('reaches every item the desktop menu bar carries', async () => {
    show({ folder: { history, onChoose: () => {} } })
    await openOverflow()
    // Wait for the history to have answered, so its two items are offered.
    await waitFor(() => expect(screen.getByText('Snapshot…')).toBeDefined())

    const can = { history: true, folders: true, scope: true }
    const expected = [...offered(FILE_MENU, 'web', can), ...offered(HELP_MENU, 'web', can)]
      .flatMap((entry) => (entry.kind === 'item' ? [s(entry.label)] : []))
    for (const label of expected) expect(screen.getByText(label), label).toBeDefined()
    for (const item of THEME_ITEMS) expect(screen.getByText(s(item.label))).toBeDefined()
    expect(screen.getByText(s(PREFERENCES_ITEM.label))).toBeDefined()
  })

  it('sends the same command the menu bar would', async () => {
    const view = show({ folder: { history } })
    await openOverflow()
    fireEvent.click(screen.getByText('Save a Copy of the Working File…'))

    await seal('correct horse')
    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('landscape.lvarch')
  })

  it('offers no folder where none can be chosen, and no history where none can be kept', async () => {
    show()
    await openOverflow()
    expect(screen.queryByText('Open Folder…')).toBeNull()
    expect(screen.queryByText('Snapshot…')).toBeNull()
  })

  it('is absent on a host that has a menu bar of its own', () => {
    show({ host: { hostMenu: true } })
    expect(screen.queryByTestId('overflow-button')).toBeNull()
  })
})
