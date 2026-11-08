// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Help on this page: F1, row one's ?, the Help menu's item and the desktop's
 * menu bar open the help at one place, the page's where a page is up over a
 * view. The reviewer found F1 at the board's place on Decisions, Observations,
 * Roadmap and a record's page with a board open underneath, while row one's ?
 * gave the page's: every way in now sends `manualHere`, answered by one resolver.
 *
 * The editor is stubbed: the board under the page is what matters, not its canvas.
 * A record's page is drawn by the editor, so it is held in `helpKeys.test.ts`
 * with every other page, each with a view open underneath.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { heldRepositories } from './testing/heldRepositories'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="the-board" /> }
})

afterEach(() => cleanup())

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

function show(over: { hostMenu?: boolean } = {}) {
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    repositories: heldRepositories([project()]),
    boot: { initialProject: project() },
    host: {
      ...(over.hostMenu ? { hostMenu: true } : {}),
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  return {
    ...harness,
    send: (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) }),
    /** The section every way to the help at this screen opens at, said once if they agree. */
    places: () => {
      const at = () => String(harness.hostControls.openHelp.mock.lastCall?.[0] ?? '').replace(/^[^#]*#?/, '')
      act(() => { fireEvent.keyDown(window, { key: 'F1' }) })
      const f1 = at()
      fireEvent.click(screen.getByTestId('frame-help-here'))
      const press = at()
      for (const held of [...listeners]) act(() => held({ type: 'manualHere' }))
      const menu = at()
      return f1 === press && press === menu ? f1 : `F1 ${f1}, ? ${press}, menu ${menu}`
    },
  }
}

/** Row two's place by its name, or its More's. */
async function go(name: string) {
  const row = screen.queryAllByRole('button', { name, exact: true } as never)
  if (row.length > 0) fireEvent.click(row[0])
  else {
    fireEvent.click(document.querySelector('[data-guide="frame.more"]') as HTMLElement)
    fireEvent.click(await within(await screen.findByRole('menu')).findByText(name))
  }
}

describe('Help on this page, with a board open underneath', () => {
  it('opens at the board while the board is up', async () => {
    const view = show()
    await screen.findByTestId('the-board')
    expect(view.places()).toBe('board')
  })

  for (const [name, place] of [['Decisions', 'decisions'], ['Observations', 'observations'], ['Roadmap', 'roadmap']] as const) {
    it(`opens at ${place} on ${name}, not at the board`, async () => {
      const view = show()
      await screen.findByTestId('the-board')
      await go(name)
      await waitFor(() => expect(view.places()).toBe(place))
    })
  }

  it('leaves F1 to the desktop\'s menu bar, which sends the same command', async () => {
    const view = show({ hostMenu: true })
    await screen.findByTestId('the-board')
    await go('Decisions')
    await waitFor(() => {
      view.send({ type: 'manualHere' })
      expect(view.hostControls.openHelp).toHaveBeenLastCalledWith(expect.stringMatching(/#decisions$/))
    })
    view.hostControls.openHelp.mockClear()
    act(() => { fireEvent.keyDown(window, { key: 'F1' }) })
    expect(view.hostControls.openHelp).not.toHaveBeenCalled()
  })
})
