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
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { HostCommand } from '../platform/hostCommands'
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
  it('reach the shell and the workspace, each subscribing for itself', () => {
    expect(show().listeners()).toBe(2)
  })

  it('Export… hands the project over as a working file', async () => {
    const view = show()
    view.send({ type: 'export' })

    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    expect(view.documents.saved[0].name).toBe('acme-landscape.lvarch')
    expect(view.documents.saved[0].mediaType).toBe('application/zip')
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
