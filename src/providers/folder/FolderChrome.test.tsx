// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The folder's remote as its own chrome says it (ADR-0005): what the pull as
 * the folder opened answered, the push after an entry, and the two answers to
 * a folder and a remote that both moved on.
 *
 * Git is not here; what is under test is that every answer it can give ends
 * up as a notice or a strip, never a modal and never a blocked save — and
 * that *take theirs* has what is open read again while *keep ours* leaves it
 * alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import type { PullOutcome, PushOutcome, ResolveOutcome, SyncSide } from '../../platform/sync'
import type { SourceChromeProps } from '../../ports/ProviderParts'
import { FolderChrome } from './FolderChrome'
import { FolderPreferences } from './FolderPreferences'
import { folderOwn, pushingAfterRecord } from './folderOwn'
import type { FolderOwn, FolderSync } from './folderOwn'

afterEach(() => cleanup())

function remote(answers: { push?: PushOutcome; resolve?: ResolveOutcome; available?: boolean } = {}) {
  const calls = { pushes: 0, resolved: [] as SyncSide[] }
  const sync: FolderSync = {
    available: () => Promise.resolve(answers.available ?? true),
    keeping: () => Promise.resolve(true),
    pull: () => Promise.resolve('done'),
    push: () => { calls.pushes += 1; return Promise.resolve(answers.push ?? 'done') },
    resolve: (side) => { calls.resolved.push(side); return Promise.resolve(answers.resolve ?? 'done') },
    record: () => Promise.resolve(true),
  }
  return { sync, calls }
}

async function own(sync: FolderSync, pushAfterSnapshot: boolean, pulled?: PullOutcome) {
  const repositories = memoryRepositories()
  await repositories.settings.write({ of: 'person' }, { git: { pullOnOpen: false, pushAfterSnapshot } })
  const held = folderOwn({ settings: repositories.settings, sync, ...(pulled ? { pulled } : {}), diagnostics: new RecordingDiagnostics() })
  return { held, history: pushingAfterRecord(repositories.history, held), repositories }
}

function chrome(held: FolderOwn | undefined) {
  const notify = vi.fn()
  const reread = vi.fn()
  const props: SourceChromeProps<FolderOwn> = {
    own: held, notify, reread, open: () => {}, screen: {} as never, movedBy: 'person' as never,
    preferences: { read: () => ({}), write: () => {} },
  }
  render(<FolderChrome {...props} />)
  return { notify, reread }
}

/** Everything the fakes have queued, carried out and drawn. */
const settled = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))

describe('what the pull as the folder opened becomes', () => {
  it('nothing, when it went well, or where the folder is not the source', async () => {
    const { notify } = chrome((await own(remote().sync, false, 'done')).held)
    expect(screen.queryByTestId('sync-notice')).toBeNull()
    expect(notify).not.toHaveBeenCalled()
    cleanup()
    chrome(undefined)
    expect(screen.queryByTestId('sync-notice')).toBeNull()
  })

  it('a notice, when the remote refused — the folder still opened', async () => {
    const { notify } = chrome((await own(remote().sync, false, 'credentials')).held)
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/refused this machine/), 'warning')
  })

  it('the standing strip, when the two sides disagree', async () => {
    chrome((await own(remote().sync, false, 'diverged')).held)
    expect(screen.getByTestId('sync-notice')).toBeDefined()
    expect(screen.getByText('Take theirs')).toBeDefined()
    expect(screen.getByText('Keep ours')).toBeDefined()
  })
})

describe('the push after an entry', () => {
  it('happens when this person says so, and says it did', async () => {
    const held = remote()
    const { held: parts, history } = await own(held.sync, true)
    const { notify } = chrome(parts)
    await act(async () => { await history.record({ subject: 'Monday' }) })
    await settled()
    expect(held.calls.pushes).toBe(1)
    expect(notify).toHaveBeenCalledWith('Pushed to the remote.', 'success')
  })

  it('does not happen when this person does not say so', async () => {
    const held = remote()
    const { history } = await own(held.sync, false)
    await history.record({ subject: 'Monday' })
    await settled()
    expect(held.calls.pushes).toBe(0)
  })

  it('never unmakes the entry: a refusal is a notice', async () => {
    const held = remote({ push: 'unreachable' })
    const { held: parts, history, repositories } = await own(held.sync, true)
    await repositories.scopes.create('acme', { name: 'Acme' })
    const { notify } = chrome(parts)
    let written: readonly unknown[] = []
    await act(async () => { written = await history.record({ subject: 'Monday' }) })
    await settled()
    expect(written.length).toBeGreaterThan(0)
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/was not pushed/), 'warning')
    expect(screen.queryByTestId('sync-notice')).toBeNull()
  })

  it('turns a rejection into the same strip a diverged pull gives', async () => {
    const held = remote({ push: 'rejected' })
    const { held: parts, history } = await own(held.sync, true)
    chrome(parts)
    await act(async () => { await history.record({ subject: 'Monday' }) })
    await settled()
    expect(screen.getByTestId('sync-notice')).toBeDefined()
  })
})

describe('the two answers', () => {
  it('take theirs: the remote stands, and what is open is read again', async () => {
    const held = remote()
    const { reread, notify } = chrome((await own(held.sync, false, 'diverged')).held)
    fireEvent.click(screen.getByText('Take theirs'))
    await settled()
    expect(held.calls.resolved).toEqual(['theirs'])
    expect(screen.queryByTestId('sync-notice')).toBeNull()
    expect(reread).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/remote.s version stands/), 'info')
  })

  it('keep ours: our version stands, unread, and not pushed where this person did not say so', async () => {
    const held = remote()
    const { reread } = chrome((await own(held.sync, false, 'diverged')).held)
    fireEvent.click(screen.getByText('Keep ours'))
    await settled()
    expect(held.calls.resolved).toEqual(['ours'])
    expect(screen.queryByTestId('sync-notice')).toBeNull()
    expect(reread).not.toHaveBeenCalled()
    expect(held.calls.pushes).toBe(0)
  })

  it('keep ours pushes straight away where this person pushes after every entry', async () => {
    const held = remote()
    chrome((await own(held.sync, true, 'diverged')).held)
    fireEvent.click(screen.getByText('Keep ours'))
    await settled()
    expect(held.calls.pushes).toBe(1)
  })

  it('a refusal leaves the folder as it was, and the question standing', async () => {
    const held = remote({ resolve: 'unreachable' })
    const { notify } = chrome((await own(held.sync, false, 'diverged')).held)
    fireEvent.click(screen.getByText('Take theirs'))
    await settled()
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Nothing was changed/), 'warning')
    expect(screen.getByTestId('sync-notice')).toBeDefined()
  })
})

describe('what this machine does, in Preferences', () => {
  it('is absent where there is no remote to reach', async () => {
    const repositories = memoryRepositories()
    render(<FolderPreferences own={folderOwn({ settings: repositories.settings, diagnostics: new RecordingDiagnostics() })} notify={vi.fn()} />)
    await settled()
    expect(screen.queryByText('THIS FOLDER, ON THIS MACHINE')).toBeNull()
  })

  it('is absent where this machine has no git at all', async () => {
    render(<FolderPreferences own={(await own(remote({ available: false }).sync, false)).held} notify={vi.fn()} />)
    await settled()
    expect(screen.queryByText('THIS FOLDER, ON THIS MACHINE')).toBeNull()
  })

  it('writes this person\'s settings, and says they stay with this install', async () => {
    const { held, repositories } = await own(remote().sync, false)
    render(<FolderPreferences own={held} notify={vi.fn()} />)
    expect(await screen.findByText('THIS FOLDER, ON THIS MACHINE')).toBeDefined()
    expect(screen.getByText(/nothing is written into the folder/)).toBeDefined()
    fireEvent.click(screen.getByLabelText(/Push after every snapshot/))
    await settled()
    expect(await repositories.settings.read({ of: 'person' })).toEqual({ git: { pullOnOpen: false, pushAfterSnapshot: true } })
  })

  it('puts a setting back, and says so, where it could not be kept', async () => {
    const { held } = await own(remote().sync, false)
    const notify = vi.fn()
    render(<FolderPreferences own={{ ...held, writeSettings: () => Promise.reject(new Error('refused')) }} notify={notify} />)
    fireEvent.click(await screen.findByLabelText(/Push after every snapshot/))
    await settled()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('refused'), 'error')
    expect((screen.getByLabelText(/Push after every snapshot/) as HTMLInputElement).checked).toBe(false)
  })
})
