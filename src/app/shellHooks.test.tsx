// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The shell's hooks that hold a rule, each mounted alone: where the shell is
 * and how it moves, the page a destination opens on, the ways in a provider
 * offers, and the preferences dialog's optimistic write. `App` composes them;
 * the App suites pin the same behaviour end to end.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { SourceWayIn } from '../platform/sourceProvider'
import type { UpdateSettings } from '../platform/updateSettings'
import { translator } from '../i18n'
import type { ShellPreferences } from './useShellPreferences'
import { useShellNavigation } from './useShellNavigation'
import { initialPageFor } from './useShellAgent'
import { useProviderParts } from './useProviderParts'
import { useMachineSettings } from './useMachineSettings'

const s = translator('en')

function scope(path: string): ScopeSnapshot {
  return {
    path,
    model: {
      name: path || 'Organisation', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }
}

describe('where the shell is', () => {
  function mount(held: ScopeSnapshot[] = [scope(''), scope('north')]) {
    const prefs = { writePreference: vi.fn() } as unknown as ShellPreferences
    const refreshTree = { current: vi.fn() }
    const failed = vi.fn()
    const view = renderHook(() => useShellNavigation({
      initialProject: undefined, projects: new InMemoryScopeStore(held), watchProject: undefined, prefs,
      failedRef: { current: failed }, refreshTree,
    }))
    return { view, prefs, refreshTree }
  }

  it('enters a scope on the board it was opened for, and remembers it as the last one', () => {
    const { view, prefs } = mount()
    act(() => view.result.current.enter(scope('north'), { page: 'board', id: 'd2' }))
    expect(view.result.current.project?.activeDiagramId).toBe('d2')
    expect(view.result.current.initialPage).toEqual({ page: 'board', id: 'd2' })
    expect(prefs.writePreference).toHaveBeenCalledWith({ lastScope: 'north' })
    act(() => view.result.current.enter(scope('north'), { page: 'decisions', id: 'adr-1' }))
    expect(view.result.current.project?.activeDiagramId).toBe('d1')
  })

  it('goes home by closing the scope and its page, and reads the tree again', () => {
    const { view, refreshTree } = mount()
    act(() => view.result.current.enter(scope('north'), { page: 'roadmap' }))
    act(() => view.result.current.goHome('north'))
    expect(view.result.current.project).toBeUndefined()
    expect(view.result.current.initialPage).toBeUndefined()
    expect(view.result.current.home).toBe('north')
    expect(refreshTree.current).toHaveBeenCalled()
  })

  it('opens a scope by its path, and reads the tree again where the path names nothing', async () => {
    const { view, refreshTree } = mount()
    act(() => view.result.current.openScopeAt('north', { page: 'roadmap' }))
    await waitFor(() => expect(view.result.current.project?.path).toBe('north'))
    act(() => view.result.current.openScopeAt('nowhere'))
    await waitFor(() => expect(refreshTree.current).toHaveBeenCalled())
    expect(view.result.current.project?.path).toBe('north')
    expect(view.result.current.home).toBe(ROOT_SCOPE)
  })
})

describe('the page a destination opens on', () => {
  it('is the same word, with what is missing falling back to the page that holds it', () => {
    expect(initialPageFor({ page: 'board', id: 'd1' })).toEqual({ page: 'board', id: 'd1' })
    expect(initialPageFor({ page: 'board' })).toBeUndefined()
    expect(initialPageFor({ page: 'sheet' })).toEqual({ page: 'sheet' })
    expect(initialPageFor({ page: 'plan' })).toEqual({ page: 'roadmap' })
    expect(initialPageFor({ page: 'document' })).toEqual({ page: 'documentation' })
    expect(initialPageFor({ page: 'home' })).toBeUndefined()
  })
})

describe('the ways in a provider offers', () => {
  const way = (over: Partial<SourceWayIn> = {}): SourceWayIn => ({ kind: 'elsewhere', labelKey: 'Connect…', onConnect: () => {}, ...over })

  it('stand as registered, relabelled, or not at all — and one that throws costs only its own label', () => {
    const report = vi.fn()
    const { result } = renderHook(() => useProviderParts({
      provider: {
        waysIn: [
          way({ kind: 'plain' }),
          way({ kind: 'relabelled', offer: () => ({ labelKey: 'Sign in…' }) }),
          way({ kind: 'hidden', offer: () => null }),
          way({ kind: 'throws', offer: () => { throw new Error('no') } }),
        ],
      },
      source: { kind: 'browserStorage' },
      diagnostics: { report, recent: () => [] },
      openSomewhere: vi.fn(),
    }))
    expect(result.current.offered?.map((one) => [one.kind, one.labelKey])).toEqual([
      ['plain', 'Connect…'], ['relabelled', 'Sign in…'], ['throws', 'Connect…'],
    ])
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ where: 'sourceOffer', message: 'throws' }))
    expect(result.current.takeScopeSession).toBeUndefined()
    expect(result.current.overflowSource).toBeUndefined()
  })
})

describe('the preferences dialog\'s machine settings', () => {
  it('are read when it opens, changed at once, and put back from the host when a write fails', async () => {
    const held: UpdateSettings = { checkAutomatically: true, channel: 'stable' }
    const store = {
      read: vi.fn(() => Promise.resolve(held)),
      write: vi.fn(() => Promise.reject(new Error('refused'))),
    }
    const failed = vi.fn()
    const notify = vi.fn()
    const { result } = renderHook(() => useMachineSettings({
      updateSettings: store as never, folderSettings: undefined, history: undefined,
      failedRef: { current: failed }, notify, s,
    }))
    expect(store.read).not.toHaveBeenCalled()
    act(() => result.current.setOpen(true))
    await waitFor(() => expect(result.current.updates).toEqual(held))
    act(() => result.current.changeUpdates({ checkAutomatically: false }))
    expect(result.current.updates?.checkAutomatically).toBe(false)
    await waitFor(() => expect(result.current.updates?.checkAutomatically).toBe(true))
    expect(failed).toHaveBeenCalledWith('updateSettings.write', expect.any(Error))
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('refused'), 'error')
  })
})
