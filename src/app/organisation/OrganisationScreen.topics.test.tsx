// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Topics on the homes (ADR-0042), through the whole shell over a real store:
 * the card on the organisation's home and the catalogue behind it, a topic
 * made there, the tree's ↗ row, and a link stopped from the scope's own home —
 * each a step in the topic, read back from where it is kept.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { heldRepositories } from '../testing/heldRepositories'
import { renderApp } from '../testing/renderShell'
import { readScope } from '../../projects/scopeAccess'
import type { ScopeSnapshot } from '../../projects/scope'

afterEach(() => cleanup())

const TODAY = () => '2026-09-12'

function scope(path: string, name: string, over: Partial<ScopeSnapshot> = {}): ScopeSnapshot {
  return { path, model: { name, elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [], ...over }
}

/** An organisation with a domain, and a topic under the topics place relevant to it since always. */
const TREE = [
  scope('', 'Acme Logistics'),
  scope('sales', 'Sales', { kind: 'domain' }),
  scope('topics', 'Topics', { kind: 'domain' }),
  scope('topics/security', 'Security', { kind: 'domain', relevantTo: [{ path: 'sales' }] }),
]

describe('topics on the homes', () => {
  it('counts the topics on the organisation\'s card, opens the catalogue, and makes a topic there', async () => {
    const repositories = heldRepositories(TREE)
    renderApp({ repositories, today: TODAY })
    // Not `open-topics`: that is the tree's row for the Topics place.
    const card = await screen.findByTestId('open-topic-catalogue')
    await waitFor(() => expect(screen.getByTestId('organisation-cards').textContent).toContain('1 topic'))
    // The tree says the topic under the scope it is relevant to.
    expect(await screen.findByTestId('topic-under-sales-topics/security')).toBeTruthy()
    fireEvent.click(card)
    const catalogue = await screen.findByTestId('topics-catalogue')
    expect(within(catalogue).getByTestId('topic-row-topics/security').textContent).toContain('Sales')
    fireEvent.click(screen.getByTestId('topics-new'))
    fireEvent.change(await screen.findByTestId('topic-name'), { target: { value: 'Privacy' } })
    fireEvent.click(screen.getByTestId('topic-create'))
    await waitFor(() => expect(screen.getByTestId('topic-row-topics/privacy')).toBeTruthy())
    expect((await readScope(repositories.scopes, 'topics/privacy'))?.model.name).toBe('Privacy')
    expect(within(screen.getByTestId('topic-detail')).getByRole('heading', { name: 'Privacy' })).toBeTruthy()
  })

  it('shows the topic on the scope\'s home, and stops the link there from today, kept as history in the topic', async () => {
    const repositories = heldRepositories(TREE)
    renderApp({ repositories, today: TODAY })
    fireEvent.click(await screen.findByTestId('home-sales'))
    const chip = await screen.findByTestId('relevant-topics/security')
    fireEvent.click(chip.querySelector('svg')!)
    await waitFor(async () => expect((await readScope(repositories.scopes, 'topics/security'))?.relevantTo).toEqual([{ path: 'sales', until: '2026-09-11' }]))
    await waitFor(() => expect(screen.queryByTestId('relevant-topics/security')).toBeNull())
  })

  it('shows no Topics card on a home below the organisation', async () => {
    renderApp({ repositories: heldRepositories(TREE), today: TODAY })
    fireEvent.click(await screen.findByTestId('home-sales'))
    await screen.findByTestId('relevant-topics')
    expect(screen.queryByTestId('open-topic-catalogue')).toBeNull()
  })
})
