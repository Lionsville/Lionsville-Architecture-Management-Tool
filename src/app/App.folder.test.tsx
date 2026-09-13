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
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

describe('a desktop with no folder yet', () => {
  it('asks for one instead of listing projects kept inside the app', () => {
    renderApp({
      scopes: new InMemoryScopeStore([project()]),
      onChooseWorkingDirectory: () => {},
      needsFolder: true,
      source: { kind: 'browserStorage' },
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
      scopes: new InMemoryScopeStore([project()]),
      onChooseWorkingDirectory: () => {},
      needsFolder: true,
      source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' },
    })

    expect(screen.queryByTestId('choose-folder')).toBeNull()
    expect(screen.getByTestId('working-source').textContent).toContain('Architecture')
  })
})

describe('a browser tab', () => {
  it('never sees the question, because it cannot answer it', () => {
    renderApp({ scopes: new InMemoryScopeStore([project()]) })

    expect(screen.queryByTestId('choose-folder')).toBeNull()
    // The organisation's home, which is what a tab opens on.
    expect(screen.getByTestId('organisation-cards')).toBeDefined()
  })

  it('is offered a folder where the browser has one, and never made to choose', () => {
    // Chromium can hand a page a real directory; a tab that can have a folder
    // is still a tab that works perfectly well without one.
    renderApp({ scopes: new InMemoryScopeStore([project()]), onChooseWorkingDirectory: () => {} })

    expect(screen.queryByTestId('choose-folder')).toBeNull()
    expect(screen.getByTestId('working-source').textContent).toContain('In this browser')
    expect(screen.getByRole('button', { name: 'Choose folder…' })).toBeDefined()
  })

  it('says so when a folder was picked and did not open', async () => {
    // The shell has no toast bar of its own. A pick that ended in a refusal —
    // write access declined, a browser that will not hand out that folder —
    // used to be a line in the console and a screen that did not change.
    renderApp({
      scopes: new InMemoryScopeStore([project()]),
      onChooseWorkingDirectory: () => {},
      folderFailure: Object.assign(new Error('write access was denied'), { name: 'NotAllowedError' }),
    })

    expect((await screen.findByRole('alert')).textContent).toContain('The folder could not be opened')
    expect(screen.getByRole('alert').textContent).toContain('write access was denied')
  })
})
