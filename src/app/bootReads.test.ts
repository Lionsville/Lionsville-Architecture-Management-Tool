// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The reads a first paint waits on, asked only where there is something to
 * learn from them: each one is a request in line in front of the first view
 * wherever the source is somewhere else.
 */
import { describe, expect, it, vi } from 'vitest'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import { scopeAt } from '../ports/ScopeStore.contract'
import { DEFAULT_LOCAL_SETTINGS } from '../projects/folderSettings'
import { pullOnOpen, upgradeFormat } from './bootReads'
import type { BootShell } from './bootReads'

function settings(pull: boolean): FolderSettingsStore & { readLocal: ReturnType<typeof vi.fn>; readFolder: ReturnType<typeof vi.fn> } {
  return {
    id: 'settings',
    readFolder: vi.fn(() => Promise.resolve({ legacyOrganisationName: 'Acme Logistics' })),
    readLocal: vi.fn(() => Promise.resolve({ ...DEFAULT_LOCAL_SETTINGS, git: { ...DEFAULT_LOCAL_SETTINGS.git, pullOnOpen: pull } })),
    writeLocal: () => Promise.resolve(),
  } as never
}

function history(pullsOnOpen?: false): ProjectHistory & { pulled: ReturnType<typeof vi.fn> } {
  const pulled = vi.fn(() => Promise.resolve('done' as const))
  return {
    available: () => Promise.resolve(true),
    keeping: () => Promise.resolve(true),
    start: () => Promise.resolve(),
    snapshot: () => Promise.resolve(true),
    entries: () => Promise.resolve([]),
    projectAt: () => Promise.resolve(undefined),
    label: () => Promise.resolve('done'),
    sync: {
      remote: () => Promise.resolve(undefined),
      pull: pulled,
      push: () => Promise.resolve('done'),
      resolve: () => Promise.resolve('done'),
      ...(pullsOnOpen === false ? { pullsOnOpen } : {}),
    },
    pulled,
  } as never
}

function shell(parts: Partial<BootShell>): BootShell {
  return {
    scopes: new InMemoryScopeStore([]),
    source: { kind: 'memory' },
    diagnostics: new RecordingDiagnostics(),
    ...parts,
  } as BootShell
}

describe('pullOnOpen', () => {
  it('pulls where the folder says so', async () => {
    const kept = history()
    expect(await pullOnOpen(shell({ history: kept, folderSettings: settings(true) }), () => 'before')).toBe('done')
    expect(kept.pulled).toHaveBeenCalledTimes(1)
  })

  it('does not ask the folder anything where the history is pulled by whoever keeps the folder', async () => {
    const kept = history(false)
    const asked = settings(true)
    expect(await pullOnOpen(shell({ history: kept, folderSettings: asked }), () => 'before')).toBeUndefined()
    expect(asked.readLocal).not.toHaveBeenCalled()
    expect(kept.pulled).not.toHaveBeenCalled()
  })
})

describe('upgradeFormat', () => {
  it('does not read the folder\'s settings when nothing is in an older format', async () => {
    const asked = settings(false)
    const store = Object.assign(new InMemoryScopeStore([scopeAt('acme', 'Acme')]), { outdated: () => Promise.resolve([]) })
    await upgradeFormat(shell({ scopes: store, folderSettings: asked }), () => 'before')
    expect(asked.readFolder).not.toHaveBeenCalled()
  })

  it('names the organisation from the folder\'s settings when there is something to rewrite', async () => {
    const asked = settings(false)
    const store = Object.assign(new InMemoryScopeStore([scopeAt('acme', 'Acme')]), { outdated: () => Promise.resolve(['acme']) })
    await upgradeFormat(shell({ scopes: store, folderSettings: asked }), () => 'before')
    expect(asked.readFolder).toHaveBeenCalledTimes(1)
    expect((await store.load(''))?.model.name).toBe('Acme Logistics')
  })
})
