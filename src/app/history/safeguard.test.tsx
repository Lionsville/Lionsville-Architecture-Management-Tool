// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * The snapshot *Replace here* takes first (ADR-0025, amended; ADR-0031 §1):
 * `record` over the scope being replaced, once what is on screen is written,
 * and a refusal to go on where it was due and could not be taken.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
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

function hook(made: 'entries' | 'nothing' | Error = 'entries', notify = vi.fn(), save = vi.fn(() => Promise.resolve())) {
  const scopes = heldRepositories([project()])
  const history: FakeHistory = fakeHistory(scopes.scopes, [], made)
  const { result } = renderHook(() => useProjectHistory({
    history, scopes: scopes.scopes, project, steps: () => [], save, indexed: () => ({}) as never,
    dispatch: () => undefined, notify, s,
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
    expect(history.recorded).toEqual([{ scopes: [(await scopes.read('acme'))?.id], subject: 'Before a working file replaced this' }])
    expect(notify).toHaveBeenCalledWith(s('history.takenBeforeReplace'), 'info')
  })

  it('says nothing where there was nothing to record, and the replace goes on', async () => {
    const notify = vi.fn()
    const { result } = hook('nothing', notify)
    expect(await result.current.safeguard()).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it('stops the replace where it was due and could not be taken', async () => {
    const notify = vi.fn()
    const { result } = hook(new Error('no room left'), notify)
    expect(await result.current.safeguard()).toBe(false)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Nothing was replaced'), 'error')
  })
})
