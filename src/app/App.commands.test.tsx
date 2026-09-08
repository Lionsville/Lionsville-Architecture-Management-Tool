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
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { HostCommand } from '../platform/hostCommands'
import { FILE_MENU, PREFERENCES_ITEM, THEME_ITEMS, offered } from '../platform/menu'
import { translator } from '../i18n'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { ProjectSnapshot } from '../projects/project'
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

const project = (name = 'Landscape'): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name,
    customerName: 'Acme',
    elements: [],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The command stream, as the preload would hand it over. */
function show(over: Parameters<typeof renderApp>[0] = {}) {
  const listeners: ((command: HostCommand) => void)[] = []
  const projects = new InMemoryProjectStore([project()])
  const harness = renderApp({
    projects,
    initialProject: project(),
    commands: (listener) => {
      listeners.push(listener)
      return () => { listeners.splice(listeners.indexOf(listener), 1) }
    },
    ...over,
  })
  return {
    ...harness,
    projects,
    listeners: () => listeners.length,
    send: (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) }),
  }
}

describe('commands from the host', () => {
  it('reach the shell and the workspace through one bus, subscribed to once', () => {
    // One subscription to the host, because the web's overflow sends into the
    // same bus (ADR-0005): the shell and the workspace each listen to the bus
    // for what they own, and neither knows who pressed the item.
    expect(show().listeners()).toBe(1)
  })

  it('Export… hands the project over as a working file', async () => {
    const view = show()
    view.send({ type: 'export' })

    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('acme-landscape.lvarch')
    expect(view.documents.saved[0].mediaType).toBe('application/zip')
  })

  it('the interchange export hands over topology and semantics only', async () => {
    const view = show()
    view.send({ type: 'exportInterchange' })

    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('acme-landscape.json')
  })

  it('the theme is chosen outright, from the View menu or the overflow', async () => {
    const view = show({ initialPreferences: { themeMode: 'light' } })
    view.send({ type: 'theme', mode: 'dark' })
    await waitFor(async () => {
      expect(await view.preferences.read()).toMatchObject({ themeMode: 'dark' })
    })
  })

  it('reports the theme to the host, so a radio item can be right', async () => {
    const reported: string[] = []
    const view = show({ onThemeMode: (mode) => reported.push(mode) })
    expect(reported).toEqual(['system'])
    view.send({ type: 'theme', mode: 'light' })
    await waitFor(() => expect(reported.at(-1)).toBe('light'))
  })

  it('Save writes now rather than waiting for the idle timer', async () => {
    const view = show()
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    view.send({ type: 'save' })

    await waitFor(async () => {
      const held = await view.projects.load({ group: 'acme', project: 'landscape' })
      expect(held?.model.diagrams[0].name).toBe('Edited')
    })
  })

  it('a document from the OS is opened into the project that is open', async () => {
    const view = show()
    view.send({
      type: 'openDocument',
      name: 'theirs.lvarch',
      bytes: workingFileBytes(project('From a colleague')),
    })

    await waitFor(() => expect(screen.getByText('From a colleague')).toBeDefined())
  })

  it('Open Folder… asks the shell, which is the only layer that can', () => {
    const choose = vi.fn()
    const view = show({ onChooseWorkingDirectory: choose })
    view.send({ type: 'chooseFolder' })

    expect(choose).toHaveBeenCalled()
  })

  it('a folder from the Recent menu is opened by its root', () => {
    const open = vi.fn()
    const view = show({ onOpenWorkingDirectory: open })
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
    await waitFor(() => expect(screen.getByText('Export Working File…')).toBeDefined())
  }

  it('reaches every item the desktop menu bar carries', async () => {
    show({ history, onChooseWorkingDirectory: () => {} })
    await openOverflow()
    // Wait for the history to have answered, so its two items are offered.
    await waitFor(() => expect(screen.getByText('Snapshot…')).toBeDefined())

    const expected = offered(FILE_MENU, 'web', { history: true, folders: true })
      .flatMap((entry) => (entry.kind === 'item' ? [s(entry.label)] : []))
    for (const label of expected) expect(screen.getByText(label), label).toBeDefined()
    for (const item of THEME_ITEMS) expect(screen.getByText(s(item.label))).toBeDefined()
    expect(screen.getByText(s(PREFERENCES_ITEM.label))).toBeDefined()
  })

  it('sends the same command the menu bar would', async () => {
    const view = show({ history })
    await openOverflow()
    fireEvent.click(screen.getByText('Export Working File…'))

    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('acme-landscape.lvarch')
  })

  it('offers no folder where none can be chosen, and no history where none can be kept', async () => {
    show()
    await openOverflow()
    expect(screen.queryByText('Open Folder…')).toBeNull()
    expect(screen.queryByText('Snapshot…')).toBeNull()
  })

  it('is absent on a host that has a menu bar of its own', () => {
    show({ hostMenu: true })
    expect(screen.queryByTestId('overflow-button')).toBeNull()
  })
})
