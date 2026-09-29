// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The first run where a way in is needed first, and the end of "somewhere in
 * the app".
 *
 * A desktop build that has not been given a folder used to show the picker over
 * browser storage — invisible, unbacked-up, and the thing ADR-0003 retired. It
 * now asks, and the question is the whole screen, because there is nothing
 * behind it to look at.
 *
 * A browser tab is unaffected, and that is half the test: nothing needs its
 * answer first, so it must still offer everything else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { heldRepositories } from './testing/heldRepositories'
import type { SourceWayIn } from '../platform/sourceProvider'
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

/** The way in a host needs taken first, as the boot hands it over (`SourceWayIn`). */
function wayIn(over: Partial<SourceWayIn> = {}): SourceWayIn {
  return {
    kind: 'elsewhere', labelKey: 'picker.chooseFolder', firstLabelKey: 'folder.choose', introKey: 'folder.body',
    hostMenu: true, required: true, onConnect: () => {}, ...over,
  }
}

describe('where work has nowhere to be kept yet', () => {
  it('asks where it should live instead of listing scopes kept inside the app', () => {
    renderApp({
      repositories: heldRepositories([project()]),
      provider: { sourceNeeded: true, waysIn: [wayIn()] },
    })

    expect(screen.getByTestId('first-run')).toBeDefined()
    expect(screen.getByText('Where should your projects live?')).toBeDefined()
    // In the words of the way in it asks for.
    expect(screen.getByText(/keeps your projects in it as files/)).toBeDefined()
    expect(screen.queryByText('Landscape')).toBeNull()
  })

  it('offers the places this machine has worked from before', () => {
    const reopen = vi.fn()
    renderApp({
      provider: {
        sourceNeeded: true,
        waysIn: [wayIn({ onReopen: reopen, recent: [{ key: '/Users/someone/Architecture', label: 'Architecture' }] })],
      },
    })

    fireEvent.click(screen.getByText('Architecture'))
    expect(reopen).toHaveBeenCalledWith('/Users/someone/Architecture')
  })

  it('takes the way in it asks for, and offers every other beside it', () => {
    const connect = vi.fn()
    const other = vi.fn()
    renderApp({
      provider: {
        sourceNeeded: true,
        waysIn: [wayIn({ onConnect: connect }), { kind: 'other', labelKey: 'Somewhere else', onConnect: other }],
      },
    })

    fireEvent.click(screen.getByText('Choose a folder…'))
    expect(connect).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Somewhere else'))
    expect(other).toHaveBeenCalled()
  })
})

describe('once work has somewhere to be', () => {
  it('goes back to being the app', () => {
    renderApp({
      repositories: heldRepositories([project()]),
      source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' },
      provider: { waysIn: [wayIn()] },
    })

    expect(screen.queryByTestId('first-run')).toBeNull()
    expect(screen.getByTestId('working-source').textContent).toContain('Architecture')
  })
})

describe('a browser tab', () => {
  it('never sees the question, because nothing needs it answered first', () => {
    renderApp({ repositories: heldRepositories([project()]) })

    expect(screen.queryByTestId('first-run')).toBeNull()
    // The organisation's home, which is what a tab opens on.
    expect(screen.getByTestId('organisation-cards')).toBeDefined()
  })

  it('is offered a way in where there is one, and never made to take it', () => {
    renderApp({ repositories: heldRepositories([project()]), provider: { waysIn: [wayIn({ required: false })] } })

    expect(screen.queryByTestId('first-run')).toBeNull()
    expect(screen.getByTestId('working-source').textContent).toContain('In this browser')
    expect(screen.getByRole('button', { name: 'Choose folder…' })).toBeDefined()
  })

  it('says so, in the way in\'s own sentence, when one was taken and did not open', async () => {
    // The shell has no toast bar of its own. A pick that ended in a refusal —
    // write access declined, a browser that will not hand out that folder —
    // used to be a line in the console and a screen that did not change.
    renderApp({
      repositories: heldRepositories([project()]),
      provider: { waysIn: [wayIn({ required: false })] },
      boot: {
        sourceFailure: Object.assign(new Error('write access was denied'), { name: 'NotAllowedError' }),
        sourceFailureKey: 'shell.folderNotOpened',
      },
    })

    expect((await screen.findByRole('alert')).textContent).toContain('The folder could not be opened')
    expect(screen.getByRole('alert').textContent).toContain('write access was denied')
  })
})
