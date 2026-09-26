// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The shell without a mouse: the keyboard half of the accessibility audit
 * (`docs/accessibility.md`) for what is around the board.
 *
 * - Every command the menu carries is a menu item in the web's `⋯`, which is
 *   a button and so pressed with Enter or Space, and walked with the arrows.
 *   On the desktop the same list is the operating system's menu bar, which
 *   the platform makes keyboard-reachable (F10 / Alt on Windows and Linux,
 *   Ctrl+F2 on macOS); that half is not something a jsdom test can press.
 * - A dialog opened from the keyboard takes the focus, keeps it while it is
 *   open, and hands it back to where it was when it closes.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { FILE_MENU, HELP_MENU, PREFERENCES_ITEM, THEME_ITEMS, offered } from '../platform/menu'
import type { MenuItemSpec } from '../platform/menu'
import { translator } from '../i18n'
import { EXAMPLES, exampleScopes } from './examples'
import { renderApp } from './testing/renderShell'

// The whole app over the whole example, under coverage beside every other
// file: a board takes longer than a component to measure and draw.
configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const top = EXAMPLES[0].path
const example = exampleScopes(EXAMPLES[0]).map((scope) => ({
  ...scope, path: scope.path === top ? '' : scope.path.slice(top.length + 1),
}))
const landscape = example.find((scope) => scope.model.diagrams.some((diagram) => diagram.kind === 'layer7'))!
const s = translator('en')

function show() {
  renderApp({ scopes: new InMemoryScopeStore(example), boot: { initialProject: landscape } })
}

async function overflow(): Promise<HTMLElement> {
  const button = await screen.findByRole('button', { name: /More/ })
  // A native button: Enter and Space press it, which is what a click is here.
  expect(button.tagName).toBe('BUTTON')
  button.focus()
  fireEvent.click(button)
  return screen.findByRole('menu')
}

describe('the shell without a mouse', { timeout: 20_000 }, () => {
  it('carries every command the web offers as a menu item in the ⋯, walked with the arrows', async () => {
    show()
    const menu = await overflow()
    const can = { history: false, folders: false, scope: true }
    const items = [...offered(FILE_MENU, 'web', can), ...offered(HELP_MENU, 'web', can)]
      .filter((entry): entry is MenuItemSpec => entry.kind === 'item')
    const labels = [...items.map((item) => s(item.label)), s(PREFERENCES_ITEM.label), ...THEME_ITEMS.map((one) => s(one.label))]
    const named = [...menu.querySelectorAll('[role^="menuitem"]')].map((item) => item.textContent)
    for (const label of labels) expect(named.some((text) => text?.includes(label))).toBe(true)

    // MUI's menu takes the focus on the first item; ↓ moves it to the next.
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true))
    const first = document.activeElement
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).not.toBe(first)
    expect(document.activeElement?.getAttribute('role')).toMatch(/menuitem/)
  })

  it('opens a dialog from the keyboard, keeps the focus in it, and hands it back on Escape', async () => {
    show()
    const button = await screen.findByRole('button', { name: /More/ })
    const menu = await overflow()
    fireEvent.keyDown(within(menu).getByRole('menuitem', { name: s(PREFERENCES_ITEM.label) }), { key: 'Enter' })
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    // Focus sent outside comes back: the dialog is modal, and its trap says so.
    // (The trap asks whether the window has the focus, which jsdom never says.)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    // The trap takes it back to its own frame, the modal around the dialog.
    const modal = dialog.closest<HTMLElement>('.MuiModal-root')!
    button.focus()
    await waitFor(() => expect(modal.contains(document.activeElement)).toBe(true))

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(button))
  })
})
