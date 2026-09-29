// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * This browser's own strip: whether its database can be written now, how full
 * it is getting, whether it keeps anything at all, and the questions about
 * the work its older storage kept.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BrowserDatabase } from '../../adapters/webStorage/browserRepositories'
import type { Earlier, EarlierStanding } from '../../adapters/webStorage/earlierScopes'
import type { Standing } from '../../adapters/webStorage/IndexedDbStore'
import type { SourceChromeProps } from '../../ports/ProviderParts'
import { BrowserChrome } from './BrowserChrome'
import { browserOwn } from './browserOwn'

afterEach(() => cleanup())

function database(initial: Standing = 'open') {
  let now = initial
  const listeners = new Set<(standing: Standing) => void>()
  const held: BrowserDatabase = {
    standing: () => now,
    onStanding: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    pressure: () => Promise.resolve(undefined),
    persisted: () => Promise.resolve(undefined),
    keep: () => Promise.resolve(true),
  }
  return { held, become: (next: Standing) => act(() => { now = next; for (const listener of listeners) listener(next) }) }
}

function earlier(standing: Partial<EarlierStanding> = {}) {
  const asked: string[] = []
  const held: Earlier = {
    standing: () => Promise.resolve({ asking: false, left: [], refused: [], diverged: [], ...standing }),
    bringOver: (addresses) => { asked.push(`bring ${(addresses ?? []).join(',') || 'all'}`); return Promise.resolve({ refused: [], diverged: [] }) },
    leave: (addresses) => { asked.push(`leave ${(addresses ?? []).join(',') || 'all'}`); return Promise.resolve({ refused: [], diverged: [] }) },
  }
  return { held, asked }
}

function show(options: { standing?: Standing; earlier?: Earlier } = {}) {
  const db = database(options.standing)
  const made = browserOwn(db.held, options.earlier)
  const notify = vi.fn()
  const reread = vi.fn()
  const props: SourceChromeProps<typeof made.own> = {
    current: true, own: made.own, notify, reread, open: () => {}, screen: {} as never, movedBy: 'person' as never,
    preferences: { read: () => ({}), write: () => {} },
  }
  render(<BrowserChrome {...props} />)
  return { ...made, db, notify, reread }
}

const settled = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))

describe('whether the database can be written now', () => {
  it('says nothing while it can', () => {
    show()
    expect(screen.queryByTestId('browser-standing')).toBeNull()
  })

  it('says another tab holds it, and that this one carries on once it lets go', () => {
    const { db } = show({ standing: 'blocked' })
    expect(screen.getByTestId('browser-standing').textContent).toContain('Another tab')
    db.become('open')
    expect(screen.queryByTestId('browser-standing')).toBeNull()
  })

  it('says the page has to be reloaded, once it does', () => {
    const { db } = show()
    db.become('reload')
    expect(screen.getByTestId('browser-standing').textContent).toContain('Reload the page')
  })
})

describe('how full it is getting', () => {
  it('says nothing while there is room', () => {
    const { heard, notify } = show()
    act(() => { heard({ used: 10, budget: 100 }); heard({ used: 79, budget: 100 }) })
    expect(notify).not.toHaveBeenCalled()
  })

  it('says so once, however many writes go past the line', () => {
    const { heard, notify } = show()
    act(() => { heard({ used: 80, budget: 100 }); heard({ used: 85, budget: 100 }); heard({ used: 90, budget: 100 }) })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toContain('80%')
    expect(notify.mock.calls[0][1]).toBe('warning')
  })

  it('says so again after there has been room in between', () => {
    const { heard, notify } = show()
    act(() => { heard({ used: 90, budget: 100 }); heard({ used: 20, budget: 100 }); heard({ used: 95, budget: 100 }) })
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('does not divide by a budget of nothing', () => {
    const { heard, notify } = show()
    act(() => { heard({ used: 10, budget: 0 }) })
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('where the database would not open at all', () => {
  it('says, and keeps saying, that nothing here outlives the tab', () => {
    const { fell } = show()
    expect(screen.queryByTestId('storage-notice')).toBeNull()
    act(() => fell())
    expect(screen.getByTestId('storage-notice').textContent).toContain('This browser could not save the design')
  })
})

describe('the work the older storage kept', () => {
  it('asks once, where the database was lost after a copy, and brings the older copy back on a yes', async () => {
    const older = earlier({ asking: true })
    const { reread, notify } = show({ earlier: older.held })
    await settled()
    fireEvent.click(screen.getByText('Bring the older copy over'))
    await settled()
    expect(older.asked).toEqual(['bring all'])
    expect(reread).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('brought over'), 'info')
  })

  it('asks per scope where one changed in both places, and leaves it on a no', async () => {
    const older = earlier({ diverged: ['acme', 'globex'] })
    const { reread } = show({ earlier: older.held })
    await settled()
    expect(screen.getByText(/“acme” changed both here/)).toBeDefined()
    expect(screen.getByText(/“globex” changed both here/)).toBeDefined()
    fireEvent.click(screen.getAllByText('Keep what is here')[1])
    await settled()
    expect(older.asked).toEqual(['leave globex'])
    expect(reread).not.toHaveBeenCalled()
  })

  it('says once what was left behind, and what could not be brought over', async () => {
    const older = earlier({ left: [{ path: 'acme', why: 'unread' }], refused: ['globex'] })
    const { notify } = show({ earlier: older.held })
    await settled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('acme'), 'info')
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('globex'), 'warning')
    expect(screen.queryByText('Bring the older copy over')).toBeNull()
  })

  it('asks nothing where nothing is waiting', async () => {
    const { notify } = show({ earlier: earlier().held })
    await settled()
    expect(notify).not.toHaveBeenCalled()
    expect(screen.queryByText('Bring the older copy over')).toBeNull()
  })
})
