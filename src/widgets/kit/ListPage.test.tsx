// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Button } from './Button'
import { List } from './List'
import { ListPage } from './ListPage'

afterEach(() => cleanup())

const rows = [{ id: 'a', label: '', rows: [{ id: 'one', code: 'ADR-0001', text: 'One place where a price is decided' }] }]

describe('one list page', () => {
  it('says its name, then Find, View, how many at the bar\'s end, its tools and New last, then the list', async () => {
    const create = vi.fn()
    renderShell(
      <ListPage
        title="Decisions" counted="12 decisions" about="Kept in this scope"
        filter={{ find: '', onFind: () => {}, findLabel: 'Find a decision' }}
        tools={<Button variant="plain">Groups</Button>}
        create={{ label: 'New decision', onPress: create, testId: 'new' }}
        listTestId="list"
      >
        <List label="Decisions" groups={rows} />
      </ListPage>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Decisions' })).toBeTruthy()
    // The count's one place: the bar's end, before what can be done, not beside the name.
    const said = screen.getByText('12 decisions')
    expect(said.closest('.kit-filter__end')).toBeTruthy()
    expect(said.closest('.kit-list-page__head')).toBeNull()
    expect(screen.getByText('Kept in this scope')).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Find a decision' })).toBeTruthy()
    // View is on every list page, the person's density at least.
    expect(screen.getByRole('button', { name: /View/ })).toBeTruthy()
    const buttons = screen.getAllByRole('button').map((one) => one.textContent)
    expect(buttons.indexOf('Groups')).toBeLessThan(buttons.indexOf('New decision'))
    expect(buttons.at(-1)).toBe('New decision')
    fireEvent.click(screen.getByTestId('new'))
    expect(create).toHaveBeenCalledOnce()
    expect(screen.getByTestId('list').textContent).toContain('One place where a price is decided')
    expect(await axeFindings()).toEqual([])
  })

  it('draws no bar where there is nothing to narrow, and no head where a tab row above names the page', () => {
    const { container } = renderShell(<ListPage><p>Nothing here yet</p></ListPage>)
    expect(container.querySelector('.kit-list-page__bar')).toBeNull()
    expect(container.querySelector('.kit-list-page__head')).toBeNull()
    expect(screen.getByText('Nothing here yet')).toBeTruthy()
  })
})
