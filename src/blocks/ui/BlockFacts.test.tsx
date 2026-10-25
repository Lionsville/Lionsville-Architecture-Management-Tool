// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** The inspector's line about building blocks (ADR-0043 §8). */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { BlockFacts, BlockFactsProvider } from './BlockFacts'
import type { BlockFactsAccess } from './BlockFacts'

afterEach(cleanup)

const facts = (): BlockFactsAccess => ({
  chosenAs: (id) => (id === 'app-broker' ? [{ block: 'blk-gw', blockName: 'Message gateway', sbb: 'Broker A', scope: 'sales', scopeName: 'Sales' }] : []),
  openBlock: vi.fn(),
})

describe('what the inspector says about building blocks', () => {
  it('says an element is the solution a scope chose, and opens that evaluation', () => {
    const access = facts()
    renderShell(<BlockFactsProvider value={access}><BlockFacts element={{ id: 'app-broker', kind: 'application' }} /></BlockFactsProvider>)
    expect(screen.getByTestId('block-facts').textContent).toContain('Is Broker A, the Message gateway chosen for Sales.')
    fireEvent.click(screen.getByRole('button', { name: 'The evaluation' }))
    expect(access.openBlock).toHaveBeenCalledWith('blk-gw', 'sales')
  })

  it('opens a building block\'s page from the block, and says nothing of an element nobody chose', () => {
    const access = facts()
    renderShell(<BlockFactsProvider value={access}><BlockFacts element={{ id: 'blk-gw', kind: 'buildingBlock' }} /><BlockFacts element={{ id: 'crm', kind: 'application' }} /></BlockFactsProvider>)
    fireEvent.click(screen.getByTestId('block-facts-open'))
    expect(access.openBlock).toHaveBeenCalledWith('blk-gw')
    expect(screen.getAllByTestId('block-facts')).toHaveLength(1)
  })

  it('says nothing where the host gives no facts', () => {
    renderShell(<BlockFacts element={{ id: 'blk-gw', kind: 'buildingBlock' }} />)
    expect(screen.queryByTestId('block-facts')).toBeNull()
  })
})
