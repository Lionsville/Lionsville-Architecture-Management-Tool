// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * The snapshot *Replace here* takes first (ADR-0025, amended; ADR-0031 §1):
 * `record` over the scope being replaced, once what is on screen is written,
 * and a refusal to go on where it was due and could not be taken.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { translator } from '../../i18n'
import type { ScopeSnapshot } from '../../projects/scope'
import { heldRepositories } from '../testing/heldRepositories'
import { fakeHistory } from '../testing/fakeHistory'
import type { FakeHistory } from '../testing/fakeHistory'
import { useProjectHistory } from './useProjectHistory'

const s = translator('en')
const project = (): ScopeSnapshot => ({
  path: 'acme', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
})

const rail = (): ScopeSnapshot => ({
  path: 'acme/rail', model: { name: 'Rail', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
})

function hook(
  made: 'entries' | 'nothing' | Error = 'entries', notify = vi.fn(), save = vi.fn(() => Promise.resolve()),
  kept?: () => Promise<boolean>,
) {
  const scopes = heldRepositories([project(), rail()])
  const history: FakeHistory = fakeHistory(scopes.scopes, [], made)
  const { result } = renderHook(() => useProjectHistory({
    history, scopes: scopes.scopes, project, steps: () => [], save, indexed: () => ({}) as never,
    dispatch: () => undefined, notify, s, ...(kept ? { kept } : {}),
  }))
  return { result, history, scopes }
}

describe('the snapshot before a replace', () => {
  it('records the scope being replaced, after what is on screen is written, and says so', async () => {
    const save = vi.fn(() => Promise.resolve())
    const notify = vi.fn()
    const { result, history, scopes } = hook('entries', notify, save)
    expect(await result.current.safeguard()).toBe(true)
    expect(save).toHaveBeenCalled()
    expect(history.recorded).toEqual([{
      scopes: [(await scopes.read('acme'))?.id, (await scopes.read('acme/rail'))?.id],
      subject: 'Before a working file replaced this',
    }])
    expect(notify).toHaveBeenCalledWith(s('history.takenBeforeReplace'), 'info')
  })

  it('records every scope under the one being replaced, because a replace reaches them all', async () => {
    const { result, history, scopes } = hook()
    await result.current.safeguard()
    expect(history.recorded[0].scopes).toContain((await scopes.read('acme/rail'))?.id)
  })

  it('records nothing where no history is kept here, and the replace goes on', async () => {
    const notify = vi.fn()
    const save = vi.fn(() => Promise.resolve())
    const { result, history } = hook('entries', notify, save, () => Promise.resolve(false))
    expect(await result.current.safeguard()).toBe(true)
    expect(save).toHaveBeenCalled()
    expect(history.recorded).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })

  it('records where a history is kept here', async () => {
    const { result, history } = hook('entries', vi.fn(), undefined, () => Promise.resolve(true))
    expect(await result.current.safeguard()).toBe(true)
    expect(history.recorded).toHaveLength(1)
  })

  it('says nothing where there was nothing to record, and the replace goes on', async () => {
    const notify = vi.fn()
    const { result } = hook('nothing', notify)
    expect(await result.current.safeguard()).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it('records nothing, and stops the replace, where what is on screen could not be written first', async () => {
    const notify = vi.fn()
    const { result, history } = hook('entries', notify, vi.fn(() => Promise.reject(new Error('the scope was refused'))))
    expect(await result.current.safeguard()).toBe(false)
    expect(history.recorded).toEqual([])
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('the scope was refused'), 'error')
  })

  it('stops the replace where it was due and could not be taken', async () => {
    const notify = vi.fn()
    const { result } = hook(new Error('no room left'), notify)
    expect(await result.current.safeguard()).toBe(false)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Nothing was replaced'), 'error')
  })
})

describe('a snapshot', () => {
  it('records nothing, and says why, where what is on screen could not be written first', async () => {
    const notify = vi.fn()
    const { result, history } = hook('entries', notify, vi.fn(() => Promise.reject(new Error('the scope was refused'))))
    await act(async () => { result.current.take('Monday') })
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringContaining('the scope was refused'), 'error'))
    expect(history.recorded).toEqual([])
  })
})

