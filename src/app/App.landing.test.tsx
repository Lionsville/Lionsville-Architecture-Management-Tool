// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What the app is on at its first paint when the address asked for a place or
 * a dialog (`bootLanding`): a scope's home rather than one of its boards, and
 * the preferences open over it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { heldRepositories } from './testing/heldRepositories'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

function scope(path: string, name: string, draws: boolean): ScopeSnapshot {
  return {
    path,
    model: {
      name, elements: [], relations: [],
      diagrams: draws ? [laidOut({ id: 'l7', kind: 'layer7' as const, name: 'L7', placements: [] })] : [],
    },
    activeDiagramId: draws ? 'l7' : '',
    logoLibrary: [],
  }
}

const TREE = () => [scope('', 'Acme Logistics', false), scope('retail', 'Retail', true)]

describe('the first paint', () => {
  it('is the home of the scope the address named, and not one of its boards', async () => {
    renderApp({ repositories: heldRepositories(TREE()), boot: { initialProject: undefined, initialHome: 'retail' } })
    // Until the listing is read a home it does not hold reads as the root's.
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Retail'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Retail')
    expect(screen.queryByTestId('saved-indicator')).toBeNull()
  })

  it('is the organisation’s home where nothing was named', async () => {
    renderApp({ repositories: heldRepositories(TREE()) })
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Acme Logistics')
  })

  it('has the preferences open over it where the address asked for them', async () => {
    renderApp({ repositories: heldRepositories(TREE()), boot: { initialProject: undefined, opensDialog: 'preferences' } })
    await waitFor(() => expect(screen.getByTestId('preferences-dialog')).toBeDefined())
  })

  it('has no dialog open over it where the address asked for none', async () => {
    renderApp({ repositories: heldRepositories(TREE()) })
    await screen.findByTestId('organisation-name')
    expect(screen.queryByTestId('preferences-dialog')).toBeNull()
  })
})
