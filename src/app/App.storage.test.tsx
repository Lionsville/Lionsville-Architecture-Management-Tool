// @vitest-environment jsdom
/**
 * The session that leaves nothing behind, and says so.
 *
 * When browser storage refuses at boot the composition swaps in memory stores.
 * Everything then works — and nothing survives the tab. Because those stores
 * never fail, `useStorageNotice` is never called and the user was told
 * precisely nothing; they would find out on the next morning's first coffee.
 *
 * A standing notice rather than a toast: it is true for the whole session, not
 * an event within it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { cleanup, screen } from '@testing-library/react'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

describe('App and the storage it was given', () => {
  it('shows the notice from the first render when nothing will be kept', () => {
    renderApp({ source: { kind: 'memory' } })
    expect(screen.getByTestId('storage-notice').textContent)
      .toContain('This browser could not save the design')
  })

  it('says nothing when storage works, which is the ordinary case', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })

  it('assumes storage works when nobody said otherwise', () => {
    renderApp()
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })
})

describe('what the root’s home says you are working from', () => {
  // The source is a fact about the folder, and the folder is the root: the
  // root's home says it, and the workspace's bar — which has crumbs where
  // the source used to be — does not. The memory case is the one where
  // saying so matters most: the strip at the foot says it, and so does the
  // home.
  const project = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  it('names the folder', () => {
    renderApp({ source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Folder · Architecture')
  })

  it('says when it is the browser, and when it is nowhere', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    expect(screen.getByTestId('working-source').textContent).toBe('In this browser')
    cleanup()
    renderApp({ source: { kind: 'memory' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Not kept anywhere')
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })

  it('keeps it off the bar over an open scope, where the crumbs are', () => {
    renderApp({ initialProject: project, source: { kind: 'memory' } })
    expect(screen.queryByTestId('working-source')).toBeNull()
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })
})
