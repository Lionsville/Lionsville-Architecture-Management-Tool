// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { SavedDocument } from '../../ports/DocumentGateway'
import type { HistoryEntry } from '../../ports/HistoryRepository'
import { useSaveUnread } from './saveUnread'

const ENTRY = { scope: 'a', id: 'e1', at: '2026-11-07T10:00:00Z' } as unknown as HistoryEntry
const history = { unreadAt: () => Promise.resolve({ extension: 'txt', mediaType: 'text/plain', text: 'what would not read' }) }

function saving(keep: (doc: SavedDocument) => Promise<void | 'cancelled'>) {
  const notify = vi.fn()
  const { result } = renderHook(() => useSaveUnread({ history, keep, scopeName: () => 'Scope', notify, s: (key) => key }))
  result.current!(ENTRY)
  return notify
}

afterEach(() => cleanup())

describe('saving what could not be read', () => {
  it('says saved when it was', async () => {
    const notify = saving(() => Promise.resolve())
    await waitFor(() => { expect(notify).toHaveBeenCalledWith('history.savedUnread', 'success') })
  })

  it('says nothing when the person closed the dialog', async () => {
    const keep = vi.fn((_doc: SavedDocument) => Promise.resolve('cancelled' as const))
    const notify = saving(keep)
    await waitFor(() => { expect(keep).toHaveBeenCalled() })
    await new Promise((done) => { setTimeout(done, 0) })
    expect(notify).not.toHaveBeenCalled()
  })

  it('says why when it could not', async () => {
    const notify = saving(() => Promise.reject(new Error('full')))
    await waitFor(() => { expect(notify).toHaveBeenCalledWith('shell.saveFileFailed', 'error') })
  })
})
