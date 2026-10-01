// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Back and Forward on the desktop (ADR-0033): drawn only where the host's
 * `WindowChrome` asks, greyed out at either end of the window's history, and
 * every other way in — the Go menu's commands and the mouse's buttons —
 * moving the same history, from a home as from a scope, and never from behind
 * a dialog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { translator } from '../i18n'
import type { HostCommand } from '../platform/hostCommands'
import { NO_WINDOW_CHROME, windowChromeFor } from '../platform/windowChrome'
import type { ScopeSnapshot } from '../projects/scope'
import { laidOut } from '../model/testFixtures'
import { dialogIsOpen } from './BackForward'
import { ShellToolbar } from './ShellToolbar'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp, renderShell } from './testing/renderShell'

// jsdom has no `ResizeObserver`, and the pane the editor draws into needs one: stubbed, as in every test of this shell.
vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="canvas" /> }
})

const DESKTOP = windowChromeFor({ desktop: true, platform: 'linux' })

/** A Navigation API as much as the bar reads of it, moved by the test. */
class FakeNavigation extends EventTarget {
  canGoBack = false
  canGoForward = false
  move(back: boolean, forward: boolean) {
    this.canGoBack = back
    this.canGoForward = forward
    this.dispatchEvent(new Event('currententrychange'))
  }
}

let back: ReturnType<typeof vi.spyOn>
let forward: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
  forward = vi.spyOn(window.history, 'forward').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (window as { navigation?: unknown }).navigation
})

const props = {
  designName: 'Warehouse landscape',
  crumbs: [{ path: '', name: 'Acme Logistics' }],
  savedAt: null,
  language: 'en' as const,
  onGoHome: () => {},
  onOpenSettings: () => {},
  onOpenDocumentation: () => {},
  onOpenDecisions: () => {},
  onOpenObservations: () => {},
  onOpenRoadmap: () => {},
  onOpenSearch: () => {},
  activity: () => [],
  scopePath: 'retail',
  s: translator('en'),
}

describe('the bar', () => {
  it('draws Back and Forward only where the host’s chrome asks for them', () => {
    const { unmount } = renderShell(<ShellToolbar {...props} windowChrome={NO_WINDOW_CHROME} />)
    expect(screen.queryByTestId('back-forward')).toBeNull()
    unmount()
    renderShell(<ShellToolbar {...props} windowChrome={DESKTOP} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDefined()
  })

  it('draws them first on the bar, before the crumbs', () => {
    renderShell(<ShellToolbar {...props} windowChrome={windowChromeFor({ desktop: true, platform: 'darwin' })} />)
    const bar = screen.getByTestId('shell-toolbar')
    expect(bar.firstElementChild?.getAttribute('data-testid')).toBe('back-forward')
  })

  it('greys them out at either end of the history, as the Navigation API says, and follows it', () => {
    const navigation = new FakeNavigation()
    ;(window as { navigation?: unknown }).navigation = navigation
    renderShell(<ShellToolbar {...props} windowChrome={DESKTOP} />)
    const backButton = () => screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement
    const forwardButton = () => screen.getByRole('button', { name: 'Forward' }) as HTMLButtonElement
    expect(backButton().disabled).toBe(true)
    expect(forwardButton().disabled).toBe(true)
    act(() => navigation.move(true, false))
    expect(backButton().disabled).toBe(false)
    expect(forwardButton().disabled).toBe(true)
    act(() => navigation.move(false, true))
    expect(backButton().disabled).toBe(true)
    expect(forwardButton().disabled).toBe(false)
  })

  it('leaves both pressable where there is no Navigation API, and presses the window’s own', () => {
    renderShell(<ShellToolbar {...props} windowChrome={DESKTOP} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(back).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))
    expect(forward).toHaveBeenCalledTimes(1)
  })

  it('says its two names in the language that is on', () => {
    renderShell(<ShellToolbar {...props} s={translator('de')} windowChrome={DESKTOP} />, { language: 'de' })
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Vorwärts' })).toBeDefined()
  })
})

const landscape: ScopeSnapshot = {
  path: 'acme',
  model: {
    name: 'Acme', elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Board', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
}

/** The app on the desktop's chrome, with the host's command stream in the test's hand. */
function onTheDesktop(initialProject: ScopeSnapshot | undefined, windowChrome = DESKTOP) {
  const listeners: ((command: HostCommand) => void)[] = []
  const view = renderApp({
    repositories: heldRepositories([landscape]),
    boot: { initialProject },
    host: {
      windowChrome,
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  return { ...view, send: (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) }) }
}

describe('the other ways in', () => {
  it('draws the two on the organisation’s home as on the workspace’s bar', async () => {
    onTheDesktop(undefined)
    expect(await screen.findByTestId('back-forward')).toBeDefined()
    cleanup()
    onTheDesktop(landscape)
    expect(await screen.findByTestId('back-forward')).toBeDefined()
  })

  it('moves the history from the Go menu with nothing open, and with a scope open', async () => {
    const home = onTheDesktop(undefined)
    await screen.findByTestId('back-forward')
    home.send({ type: 'back' })
    home.send({ type: 'forward' })
    expect(back).toHaveBeenCalledTimes(1)
    expect(forward).toHaveBeenCalledTimes(1)
    cleanup()
    const open = onTheDesktop(landscape)
    await screen.findByTestId('back-forward')
    open.send({ type: 'back' })
    expect(back).toHaveBeenCalledTimes(2)
  })

  it('takes the mouse’s back and forward buttons where the host asks for Back and Forward, and nowhere else', async () => {
    onTheDesktop(undefined)
    await screen.findByTestId('back-forward')
    fireEvent(window, new MouseEvent('mouseup', { button: 3, bubbles: true }))
    fireEvent(window, new MouseEvent('mouseup', { button: 4, bubbles: true }))
    fireEvent(window, new MouseEvent('mouseup', { button: 0, bubbles: true }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(forward).toHaveBeenCalledTimes(1)
    cleanup()
    onTheDesktop(undefined, NO_WINDOW_CHROME)
    await waitFor(() => expect(screen.getByTestId('shell-toolbar')).toBeDefined())
    fireEvent(window, new MouseEvent('mouseup', { button: 3, bubbles: true }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('takes nothing while a dialog is open', async () => {
    const view = onTheDesktop(landscape)
    await screen.findByTestId('back-forward')
    fireEvent.click(screen.getByRole('button', { name: 'Project settings' }))
    await screen.findByRole('dialog')
    expect(dialogIsOpen()).toBe(true)
    view.send({ type: 'back' })
    fireEvent(window, new MouseEvent('mouseup', { button: 3, bubbles: true }))
    expect(back).not.toHaveBeenCalled()
  })

  it('does not count a dialog something has hidden', () => {
    document.body.insertAdjacentHTML('beforeend', '<div aria-hidden="true"><div role="dialog">kept mounted</div></div>')
    try {
      expect(dialogIsOpen()).toBe(false)
    } finally {
      document.body.lastElementChild?.remove()
    }
  })
})
