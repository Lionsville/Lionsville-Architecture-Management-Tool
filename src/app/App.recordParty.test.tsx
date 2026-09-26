// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Belongs to* offers the parties a scope can see (ADR-0012 §4): its own, and
 * those the scopes above it keep. The shipped example's payment provider is an
 * outside application of the landscape whose party is one of the
 * organisation's actors, which the landscape holds no record of — the field
 * used to offer the landscape's actors only, and so showed a blank where the
 * party was and could not keep it.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { ScopeSnapshot } from '../projects/scope'
import { EXAMPLES, exampleScopes } from './examples'
import { renderApp } from './testing/renderShell'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

// The example as the organisation itself, the way a person gets it into an
// empty folder.
const top = EXAMPLES[0].path
const example: ScopeSnapshot[] = exampleScopes(EXAMPLES[0]).map((scope) => ({
  ...scope, path: scope.path === top ? '' : scope.path.slice(top.length + 1),
}))
const landscape = example.find((scope) => scope.model.diagrams.some((diagram) => diagram.kind === 'layer7'))!
const organisation = example.find((scope) => scope.path === '')!

async function recordOf(id: string) {
  renderApp({ scopes: new InMemoryScopeStore(example), boot: { initialProject: landscape } })
  const card = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    expect(found, id).not.toBeNull()
    return found!
  })
  card.focus()
  fireEvent.keyDown(card, { key: 'Enter' })
  fireEvent.keyDown(card, { key: 'Enter' })
  return screen.findByTestId('element-record')
}

// The whole app on the whole example, and a record opened from its board: the
// work is the render, and each wait below is for the thing it needs. Alone on
// a laptop it takes under a second; on the runner, with coverage and the
// suite's other workers beside it, it took seven (Check, 26 September 2026:
// 6955 ms and 6890 ms, against the default 5 s). So it has the other
// whole-app suites' 20 s, which is also longer than any one wait: a wait that
// is never met fails naming what it waited for, not as a timed-out test.
describe('whose an outside application is, from a scope below the party', { timeout: 20_000 }, () => {
  const payments = landscape.model.elements.find((one) => one.id === 'payments')!
  const party = organisation.model.elements.find((one) => one.id === payments.partyId)!

  it('is the example’s case: the party is the organisation’s and not the landscape’s', () => {
    expect(payments.outside).toBe(true)
    expect(party.kind).toBe('actor')
    expect(landscape.model.elements.some((one) => one.id === party.id)).toBe(false)
  })

  it('shows the party the record names, and offers it under the scope that keeps it', async () => {
    const record = await recordOf('payments')
    const field = within(record).getByLabelText('Belongs to')
    expect(field.textContent).toBe(party.name)
    fireEvent.mouseDown(field)
    const listbox = await screen.findByRole('listbox')
    const options = within(listbox).getAllByRole('option').map((one) => one.textContent)
    // The landscape's own actors, and the organisation's under its name.
    expect(options).toContain('Commercial team')
    expect(options).toContain(party.name)
    expect(within(listbox).getByText(organisation.model.name)).toBeDefined()
    // A stand-in the landscape keeps is offered once, as the landscape's.
    expect(options.filter((one) => one === 'Commercial team')).toHaveLength(1)
  })
})
