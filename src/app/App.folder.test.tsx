// @vitest-environment jsdom
/**
 * The desktop's first run, and the end of "somewhere in the app".
 *
 * A desktop build that has not been given a folder used to show the picker over
 * browser storage — which on the desktop is a leveldb inside `userData`:
 * invisible, unbacked-up, and the thing ADR-0003 retired. It now asks, and the
 * question is the whole screen, because there is nothing behind it to look at.
 *
 * A browser tab is unaffected, and that is half the test: it cannot offer a
 * folder, so it must still offer everything else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { ProjectSnapshot } from '../projects/project'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const project = (): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name: 'Landscape',
    customerName: 'Acme',
    elements: [],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

describe('a desktop with no folder yet', () => {
  it('asks for one instead of listing projects kept inside the app', () => {
    renderApp({
      projects: new InMemoryProjectStore([project()]),
      onChooseWorkingDirectory: () => {},
      needsFolder: true,
      storage: 'browser',
    })

    expect(screen.getByTestId('choose-folder')).toBeDefined()
    expect(screen.queryByText('Landscape')).toBeNull()
  })

  it('offers the folders this machine has used before', () => {
    const open = vi.fn()
    renderApp({
      onChooseWorkingDirectory: () => {},
      needsFolder: true,
      onOpenWorkingDirectory: open,
      recentFolders: [{ root: '/Users/someone/Architecture', name: 'Architecture' }],
    })

    fireEvent.click(screen.getByText('Architecture'))
    expect(open).toHaveBeenCalledWith('/Users/someone/Architecture')
  })

  it('asks the shell for a folder, which is the only layer that can', () => {
    const choose = vi.fn()
    renderApp({ onChooseWorkingDirectory: choose, needsFolder: true })

    fireEvent.click(screen.getByText('Choose a folder…'))
    expect(choose).toHaveBeenCalled()
  })
})

describe('once there is a folder', () => {
  it('goes back to being the app', () => {
    renderApp({
      projects: new InMemoryProjectStore([project()]),
      onChooseWorkingDirectory: () => {},
      needsFolder: true,
      workingDirectory: { name: 'Architecture' },
      storage: 'folder',
    })

    expect(screen.queryByTestId('choose-folder')).toBeNull()
    expect(screen.getByTestId('working-directory').textContent).toContain('Architecture')
  })
})

describe('a browser tab', () => {
  it('never sees the question, because it cannot answer it', () => {
    renderApp({ projects: new InMemoryProjectStore([project()]) })

    expect(screen.queryByTestId('choose-folder')).toBeNull()
    expect(screen.getByText('Projects')).toBeDefined()
  })

  it('is offered a folder where the browser has one, and never made to choose', () => {
    // Chromium can hand a page a real directory; a tab that can have a folder
    // is still a tab that works perfectly well without one.
    renderApp({ projects: new InMemoryProjectStore([project()]), onChooseWorkingDirectory: () => {} })

    expect(screen.queryByTestId('choose-folder')).toBeNull()
    expect(screen.getByTestId('working-directory').textContent).toContain('inside the app')
  })
})
