// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A block's page opened before the tree has been read — from a link on an
 * open scope, or by an agent — has no block to find yet: it is arriving, and
 * the home under it is not shown bare in the meantime.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import { preloadLazyParts } from '../../widgets/lazyPart'
import { renderShell } from '../testing/renderShell'
import { BlocksDoors } from './HomePages'
import type { HomePagesState } from './useHomePages'
import { BlocksProvider } from '../../blocks/ui/BlocksContext'
import type { BlocksAccess } from '../../blocks/ui/BlocksContext'

/** One block and nothing else: every other read answers empty. */
const GATEWAY_ONLY = new Proxy({
  version: 1,
  block: (id: string) => (id === 'blk-gw' ? { scope: '', block: { id: 'blk-gw', kind: 'buildingBlock', name: 'Gateway', lifecycle: 'live', isManaged: false, aspects: {} } } : undefined),
  scopeLabel: () => 'Acme', mayWrite: () => false,
} as Record<string, unknown>, { get: (held, key: string) => (key in held ? held[key] : () => []) }) as unknown as BlocksAccess

// The pages' scripts are here already, so what is drawn is the doors' doing and not a script on its way.
beforeAll(() => preloadLazyParts())
afterEach(() => cleanup())

const asked: HomePagesState = {
  openPage: 'blocks', asked: { page: 'blocks', nonce: 1, select: 'blk-gw' }, open: vi.fn(), close: vi.fn(),
}

describe('a block’s page on a home', () => {
  it('is arriving until the tree has been read', () => {
    renderShell(<BlocksDoors pages={asked} at="" windowChrome={NO_WINDOW_CHROME} ready={false} />)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
  })

  it('is the page itself once the tree has been read', () => {
    renderShell(<BlocksDoors pages={asked} at="" windowChrome={NO_WINDOW_CHROME} ready />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('is nothing while no page of the blocks is asked for', () => {
    renderShell(<BlocksDoors pages={{ ...asked, openPage: undefined }} at="" windowChrome={NO_WINDOW_CHROME} ready={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes back to where it was opened from another screen, and onto the register from the register', () => {
    const back = vi.fn()
    const open = vi.fn()
    // The block's page is the last up, over the register.
    const blockClose = () => screen.getAllByTestId('page-close').at(-1)!
    const drawn = (request: HomePagesState['asked']) => renderShell(
      <BlocksProvider value={GATEWAY_ONLY}>
        <BlocksDoors pages={{ ...asked, asked: request, open }} at="" windowChrome={NO_WINDOW_CHROME} ready back={back} />
      </BlocksProvider>,
    )
    drawn({ ...asked.asked!, returns: true })
    expect(screen.getAllByTestId('page-close')).toHaveLength(2)
    fireEvent.click(blockClose())
    expect(back).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    cleanup()
    drawn(asked.asked)
    fireEvent.click(blockClose())
    expect(open).toHaveBeenCalledWith('blocks')
    expect(back).toHaveBeenCalledTimes(1)
  })
})
