// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * The first screen of a new organisation, the first steps once it has a name, the
 * example as a place, and the status word beside them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from './testing/axe'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const example = { key: 'one', path: 'one', label: 'One', description: 'An operator, filled in.', scopes: [] }

describe('an organisation nobody has started', () => {
  const start = () => {
    const onVisitExample = vi.fn()
    const repositories = heldRepositories([])
    renderApp({ repositories, offersFirstRun: true, examples: [example], onVisitExample, provider: { sayings: { labelKey: 'shell.sourceBrowser', riskKey: 'browser.risk' } } })
    return { onVisitExample, repositories }
  }

  it('offers one way forward per intent, and says what can lose the work before there is any', async () => {
    start()
    await screen.findByTestId('first-run-page')
    expect(screen.getByRole('heading', { name: 'Start your own' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Look around an example' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Carry on with work you have' })).toBeDefined()
    expect(screen.getByTestId('first-risk').textContent).toContain('Clearing this browser')
    expect(await axeFindings()).toEqual([])
  })

  it('leaves for the first steps as soon as it has a name', async () => {
    const { repositories } = start()
    fireEvent.change(await screen.findByTestId('organisation-name-field'), { target: { value: 'Northline' } })
    fireEvent.click(screen.getByTestId('first-run-start'))
    await screen.findByTestId('organisation-next')
    expect(screen.queryByTestId('first-run-page')).toBeNull()
    expect((await repositories.read(''))?.model.name).toBe('Northline')
  })

  it('opens the example as a place, writing nothing here', async () => {
    const { onVisitExample, repositories } = start()
    fireEvent.click(await screen.findByTestId('open-example'))
    expect(onVisitExample).toHaveBeenCalledWith(example)
    expect((await repositories.read(''))?.model.name ?? '').toBe('')
  })

  it('names the press beside where the work is kept for what it does there: another folder, where one is open', async () => {
    const onConnect = vi.fn()
    renderApp({
      repositories: heldRepositories([]), offersFirstRun: true, examples: [example], onVisitExample: vi.fn(),
      provider: {
        sayings: { labelKey: 'shell.sourceBrowser' },
        waysIn: [{ kind: 'folder', labelKey: 'picker.chooseFolder', firstLabelKey: 'folder.choose', onConnect, offer: () => ({ labelKey: 'picker.changeFolder' }) }],
      },
    })
    await screen.findByTestId('first-run-page')
    expect(screen.getByTestId('first-kept-folder').textContent).toBe('Work from another folder…')
    expect(screen.queryByText('Choose a folder…')).toBeNull()
    fireEvent.click(screen.getByTestId('first-kept-folder'))
    expect(onConnect).toHaveBeenCalled()
  })

  it('does not stand in the way of a page asked for by address', async () => {
    renderApp({ repositories: heldRepositories([]), offersFirstRun: true, boot: { initialProject: undefined, initialFramePage: 'preferences' } })
    expect(await screen.findByTestId('preferences-page')).toBeDefined()
    expect(screen.queryByTestId('first-run-page')).toBeNull()
  })
})

describe('the example, visited', () => {
  it('says so on every screen, with the two ways out', async () => {
    const onKeep = vi.fn()
    const onLeave = vi.fn()
    renderApp({ repositories: heldRepositories([]), offersFirstRun: true, visiting: { name: 'One', onKeep, onLeave } })
    await screen.findByTestId('example-band')
    fireEvent.click(screen.getByTestId('example-keep'))
    expect(onKeep).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('example-leave'))
    expect(onLeave).toHaveBeenCalled()
  })
})

describe('Your work', () => {
  it('says the place in a sentence, what can lose it, and when a copy was last saved', async () => {
    renderApp({ repositories: heldRepositories([]), provider: { sayings: { labelKey: 'shell.sourceBrowser', whereKey: 'browser.where', riskKey: 'browser.risk' } } })
    const word = await screen.findByTestId('saved-indicator')
    expect(word.textContent).toBe('✓In this browser')
    fireEvent.click(word)
    expect((await screen.findByTestId('work-risk')).textContent).toContain('keep a copy somewhere safe')
    expect(screen.getByText('Last copy saved')).toBeDefined()
    expect(screen.getByText('Never')).toBeDefined()
    await waitFor(() => expect(screen.getByTestId('work-copy')).toBeDefined())
  })
})

describe('a scope’s settings', () => {
  it('have nothing the axe finds, on any of their sections', async () => {
    renderApp({ repositories: heldRepositories([]), boot: { initialProject: undefined, initialHomePage: 'settings' } })
    await screen.findByTestId('scope-settings-page')
    expect(await axeFindings()).toEqual([])
    for (const section of ['Links', 'On exports', 'New landscapes']) {
      fireEvent.click(screen.getByRole('button', { name: section }))
      expect(await axeFindings()).toEqual([])
    }
  })
})

describe('the preferences', () => {
  it('change the density at once, and remember it', async () => {
    const view = renderApp({ repositories: heldRepositories([]), boot: { initialProject: undefined, initialFramePage: 'preferences' } })
    await screen.findByTestId('preferences-page')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Density' })).getByRole('radio', { name: 'Compact' }))
    await waitFor(() => expect(document.documentElement.dataset.density).toBe('compact'))
    expect(await view.preferences.read()).toMatchObject({ density: 'compact' })
  })

  it('show what the canvas remembers, and write it back', async () => {
    const view = renderApp({ repositories: heldRepositories([]), boot: { initialProject: undefined, initialFramePage: 'preferences' } })
    await screen.findByTestId('preferences-page')
    fireEvent.click(screen.getByRole('switch', { name: 'Minimap' }))
    await waitFor(async () => expect(await view.preferences.read()).toMatchObject({ showMinimap: true }))
  })
})
