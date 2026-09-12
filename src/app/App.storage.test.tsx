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

describe('what the top bar says you are working from', () => {
  // The bar's first item is the source (ADR-0005), and the memory case is the
  // one where saying so matters most: the strip at the foot says it, and so
  // does the bar.
  const project = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', customerName: 'Acme', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  it('names the folder', () => {
    renderApp({
      initialProject: project,
      source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' },
    })
    expect(screen.getByTestId('working-source').textContent).toBe('Folder · Architecture')
  })

  it('says when it is the browser, and when it is nowhere', () => {
    renderApp({ initialProject: project, source: { kind: 'browserStorage' } })
    expect(screen.getByTestId('working-source').textContent).toBe('In this browser')
    cleanup()
    renderApp({ initialProject: project, source: { kind: 'memory' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Not kept anywhere')
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })
})
