// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A look as a state of the whole window (ADR-0027, amended): the band says the day
 * and who sees it, one press goes back, a deliberate press makes it the view's own
 * as one step, undo is off while it lasts, and the address carries it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <output data-testid="editor" /> }
})

afterEach(() => cleanup())

const board = (asOf?: string): ScopeSnapshot => ({
  path: 'acme',
  model: {
    name: 'Acme', elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Landscape', placements: [], ...(asOf ? { asOf } : {}) })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

const open = (day: string, asOf?: string) => {
  const repositories = heldRepositories([board(asOf)])
  return { ...renderApp({ repositories, boot: { initialProject: board(asOf), initialLook: { view: 'd1', day } } }) }
}

describe('looking at another day', () => {
  it('says the day and who sees it, and undo is off', async () => {
    open('2027-06-01')
    expect(await screen.findByText('Looking at 1 Jun 2027')).toBeTruthy()
    expect(screen.getByText(/Only on your screen/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true)
  })

  it('goes back to today in one press', async () => {
    open('2027-06-01')
    fireEvent.click(await screen.findByRole('button', { name: 'Back to today' }))
    await waitFor(() => expect(screen.queryByText(/Only on your screen/)).toBeNull())
  })

  it('goes back to the view\'s own day where it has one', async () => {
    open('2029-02-01', '2027-06-01')
    expect(await screen.findByRole('button', { name: 'Back to 1 Jun 2027' })).toBeTruthy()
  })

  it('makes the day the view\'s own as one deliberate step, and is then no look', async () => {
    open('2027-06-01')
    fireEvent.click(await screen.findByRole('button', { name: 'Make this the view’s day' }))
    await waitFor(() => expect(screen.queryByText(/Only on your screen/)).toBeNull())
    fireEvent.click(screen.getByTestId('frame-activity'))
    expect((await screen.findByRole('list', { name: 'Activity' })).children).toHaveLength(1)
  })

  it('carries the look in the address', async () => {
    open('2027-06-01')
    await screen.findByText(/Only on your screen/)
    await waitFor(() => expect(window.location.hash).toContain('day=2027-06-01'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    await waitFor(() => expect(window.location.hash).not.toContain('day='))
  })
})
