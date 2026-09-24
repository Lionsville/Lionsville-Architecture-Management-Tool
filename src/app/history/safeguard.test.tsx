// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

/**
 * The snapshot *Replace here* takes first (ADR-0025, amended): taken where the
 * folder keeps a history, skipped where it keeps none, and a refusal to go on
 * where it was due and could not be taken.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { translator } from '../../i18n'
import type { ProjectHistory } from '../../ports/ProjectHistory'
import type { ScopeSnapshot } from '../../projects/scope'
import { useProjectHistory } from './useProjectHistory'

const s = translator('en')
const project = (): ScopeSnapshot => ({
  path: 'acme', model: { name: 'Acme', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
})

function history(over: Partial<ProjectHistory>): ProjectHistory {
  return {
    available: () => Promise.resolve(true),
    keeping: () => Promise.resolve(true),
    start: () => Promise.resolve(),
    snapshot: () => Promise.resolve(true),
    entries: () => Promise.resolve([]),
    projectAt: () => Promise.resolve(undefined),
    label: () => Promise.resolve('labelled'),
    ...over,
  } as ProjectHistory
}

function hook(held: ProjectHistory, notify = vi.fn(), save = vi.fn(() => Promise.resolve())) {
  return renderHook(() => useProjectHistory({
    history: held, project, steps: () => [], save, indexed: () => ({}) as never,
    dispatch: () => undefined, notify, s,
  })).result
}

describe('the snapshot before a replace', () => {
  it('is taken where the folder keeps a history, after the folder is written out, and says so', async () => {
    const snapshot = vi.fn(() => Promise.resolve(true))
    const save = vi.fn(() => Promise.resolve())
    const notify = vi.fn()
    const result = hook(history({ snapshot }), notify, save)
    expect(await result.current.safeguard()).toBe(true)
    expect(save).toHaveBeenCalled()
    expect(snapshot).toHaveBeenCalledWith('Before a working file replaced this')
    expect(notify).toHaveBeenCalledWith(s('history.takenBeforeReplace'), 'info')
  })

  it('is not taken where the folder keeps no history, and the replace goes on as the dialog warned', async () => {
    const snapshot = vi.fn(() => Promise.resolve(true))
    const result = hook(history({ keeping: () => Promise.resolve(false), snapshot }))
    expect(await result.current.safeguard()).toBe(true)
    expect(snapshot).not.toHaveBeenCalled()
  })

  it('stops the replace where it was due and could not be taken', async () => {
    const notify = vi.fn()
    const result = hook(history({ snapshot: () => Promise.reject(new Error('disk full')) }), notify)
    expect(await result.current.safeguard()).toBe(false)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Nothing was replaced'), 'error')
  })
})
