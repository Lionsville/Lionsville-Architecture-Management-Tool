// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What a source says on the frame: its word, a band, what holds a home it cannot
 * read yet, and the place only it has. Without any of it, the frame is what it is
 * for a folder, and *Connect an agent* stays the dialog.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ScopeSnapshot } from '../../projects/scope'
import type { SourceFrame } from '../../ports/ProviderParts'
import { heldRepositories } from '../testing/heldRepositories'
import { renderApp } from '../testing/renderShell'

afterEach(() => { cleanup(); window.location.hash = '' })

const root = {
  path: '', model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [], decisions: [] }, activeDiagramId: '', logoLibrary: [],
} as unknown as ScopeSnapshot

const withFrame = (frame: SourceFrame) => renderApp({ repositories: heldRepositories([root]), provider: { frame } })

describe('a source on the frame', () => {
  it('says its own word with its mark, and the word opens Your work with what it has to say first', async () => {
    withFrame({ word: () => ({ text: '2 to settle', tone: 'waiting', short: '2' }), YourWork: () => <p>Two of yours clash</p> })
    const word = await screen.findByRole('button', { name: '2 to settle' })
    expect(word.dataset.tone).toBe('waiting')
    fireEvent.click(word)
    expect(await screen.findByText('Two of yours clash')).toBeTruthy()
  })

  it('draws a band of its own', async () => {
    withFrame({ bands: () => [{ id: 'out', tone: 'problem', title: 'You are signed out.' }] })
    expect(await screen.findByText('You are signed out.')).toBeTruthy()
  })

  it('holds a home it cannot read yet, so nothing offers to start again', async () => {
    withFrame({ holding: () => true, Hold: () => <p>This organisation could not be read</p> })
    expect(await screen.findByText('This organisation could not be read')).toBeTruthy()
    expect(screen.queryByTestId('frame-new-view')).toBeNull()
    expect(screen.queryByText('Acme Logistics', { selector: 'h1, h2, h3, h4, h5, h6' })).toBeNull()
  })

  it('has a page for agents where it says so, a place of its own the frame button goes to', async () => {
    withFrame({ Agents: () => <p>What agents did</p> })
    fireEvent.click(await screen.findByTestId('agent-glyph'))
    expect(await screen.findByText('What agents did')).toBeTruthy()
    expect(document.querySelector('[data-place-page]')?.textContent).toContain('What agents did')
    await waitFor(() => expect(window.location.hash).toContain('agents'))
  })

  it('keeps the dialog where it has no such page', async () => {
    renderApp({ repositories: heldRepositories([root]) })
    fireEvent.click(await screen.findByTestId('agent-glyph'))
    await waitFor(() => expect(screen.getByTestId('connect-agent-dialog')).toBeTruthy())
  })
})
