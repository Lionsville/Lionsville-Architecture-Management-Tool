// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The ⋯ menu's keys on the web, where no menu bar hears them: every one is the
 * app's in every state, so the browser's own Open, Save Page As and Settings
 * never come up over the app — a key the menu would refuse says why, and one
 * pressed while a dialog is up does nothing at all.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'
import { screenWord } from './App'
import { translator } from '../i18n'

afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-test-dialog]').forEach((held) => held.remove())
})

const organisation: ScopeSnapshot[] = [
  { path: '', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] },
]

/** jsdom is not a Mac: the command key is Ctrl. Answers whether the page claimed the key. */
const press = (key: string, shiftKey = false) => !fireEvent.keyDown(window, { key, ctrlKey: true, shiftKey })

describe('the menu’s keys on the web', () => {
  it('claims Save with nothing open, and says why it saves nothing', async () => {
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    expect(press('s')).toBe(true)
    expect(await screen.findByText(/Nothing is open\. Work saves itself as you go/)).toBeTruthy()
  })

  it('claims Open, Save and Preferences while a dialog is up, and runs none of them', async () => {
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('data-test-dialog', '')
    document.body.append(dialog)
    const hash = window.location.hash
    expect(press('o')).toBe(true)
    expect(press('s')).toBe(true)
    expect(press(',')).toBe(true)
    expect(press('o', true)).toBe(true)
    expect(window.location.hash).toBe(hash)
    expect(screen.queryByText(/Nothing is open\./)).toBeNull()
  })

  it('leaves a key that is none of the menu’s to the browser', async () => {
    renderApp({ repositories: heldRepositories(organisation) })
    await screen.findAllByText('Acme')
    expect(press('t')).toBe(false)
  })
})

describe('the menu’s keys in the example', () => {
  it('says the example is not kept where Save saves nothing', async () => {
    renderApp({ repositories: heldRepositories(organisation), visiting: { name: 'One', onKeep: () => {}, onLeave: () => {} } })
    await screen.findAllByText('Acme')
    expect(press('s')).toBe(true)
    expect(await screen.findByText('The example is not kept. Keep it as your start to save it.')).toBeTruthy()
  })
})

describe('the web’s own words', () => {
  it('says the preferences are this browser’s, for this site', async () => {
    renderApp({ repositories: heldRepositories(organisation), boot: { initialFramePage: 'preferences' } })
    expect(await screen.findByText(/Yours, in this browser and for this site only/)).toBeTruthy()
  })
})

describe('the window’s title', () => {
  it('puts the page on screen first, and the example’s word before it while it is visited', async () => {
    const titles: string[] = []
    renderApp({
      repositories: heldRepositories(organisation), boot: { initialFramePage: 'preferences' },
      visiting: { name: 'One', onKeep: () => {}, onLeave: () => {} },
      host: { onTitle: (organisation: string, scope?: string, here?: string, before?: string) => { titles.push([before, here, scope, organisation].filter(Boolean).join('|')) } },
    })
    await screen.findByTestId('preferences-page')
    await waitFor(() => expect(titles.at(-1)).toBe('Example|Preferences|Acme'))
  })
})

describe('what a page names itself in the window’s title', () => {
  const s = translator('en')
  const open = { path: 'land', name: 'Land', view: { id: 'l7', name: 'Landscape', kind: 'layer7' } }
  const model = { elements: [{ id: 'billing', name: 'Billing' }], decisions: [{ id: 'adr-yard', title: 'Buy the yard system' }] }

  it('names a decision, and a record’s document, before the page they are on', () => {
    expect(screenWord({ open, page: { page: 'decisions', id: 'adr-yard' } } as never, s, model)).toBe('Buy the yard system — Decisions')
    expect(screenWord({ open, page: { page: 'document', id: 'billing' } } as never, s, model)).toBe('Billing — Documentation')
  })

  it('says the page’s word where the record is not this scope’s, and the view where nothing is over it', () => {
    expect(screenWord({ open, page: { page: 'decisions', id: 'adr-above' } } as never, s, model)).toBe('Decisions')
    expect(screenWord({ open, page: { page: 'document', id: 'gone' } } as never, s, model)).toBe('Documentation')
    expect(screenWord({ open } as never, s, model)).toBe('Landscape')
  })
})
