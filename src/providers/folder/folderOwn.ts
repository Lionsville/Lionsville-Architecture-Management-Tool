// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the folder provider hands its own chrome and its part of Preferences
 * (ADR-0005, ADR-0031 §4): the folder's remote where this host can reach one,
 * what this person does about it here, what the pull as the folder opened
 * answered, and what a push after an entry answered.
 *
 * The app knows none of it. It records entries through the folder's history
 * as it would anywhere; the push after one is the provider's, wrapped round
 * that history ({@link pushingAfterRecord}), and what it answered is said by
 * the chrome.
 */
import type { DesktopHistory } from '../../adapters/desktop/channel'
import type { PullOutcome, PushOutcome, ResolveOutcome, SyncSide } from '../../platform/sync'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { HistoryRepository } from '../../ports/HistoryRepository'
import type { Repositories } from '../../ports/Repositories'
import type { SettingsRepository } from '../../ports/SettingsRepository'
import type { Settings } from '../../projects/settings'

/**
 * The folder's git as the desktop's main reaches it, bound to the folder: its
 * remote, and an entry of everything in it — what the folder records before
 * it is pulled or brought up to date.
 */
export type FolderSync = {
  /** Is there a git on this machine at all? Nothing about a remote is offered where there is none. */
  available(): Promise<boolean>
  /** Is the folder keeping a history? There is nothing to pull into one that is not. */
  keeping(): Promise<boolean>
  pull(): Promise<PullOutcome>
  push(): Promise<PushOutcome>
  resolve(side: SyncSide): Promise<ResolveOutcome>
  /** Record everything in the folder under one subject; `false` where nothing had changed. */
  record(subject: string): Promise<boolean>
}

/** The desktop's remote, over the channel main keeps git behind. Each answers with a value, never an exception. */
export function desktopSync(git: DesktopHistory, root: string): FolderSync {
  return {
    available: () => git.available(),
    keeping: () => git.isRepository(root),
    pull: () => git.pull(root),
    push: () => git.push(root),
    resolve: (side) => git.resolve(root, side),
    record: async (subject) => Boolean(await git.snapshot(root, subject)),
  }
}

/** What this person does about the folder's remote on this machine. */
export type SyncSettings = { readonly pullOnOpen: boolean; readonly pushAfterSnapshot: boolean }

/** The person's settings as the folder's repositories keep them: `git`, and nothing asked is nothing done. */
export function syncSettingsOf(held: Settings): SyncSettings {
  const git = held['git']
  const flags = git && typeof git === 'object' && !Array.isArray(git) ? git as Settings : {}
  return { pullOnOpen: flags['pullOnOpen'] === true, pushAfterSnapshot: flags['pushAfterSnapshot'] === true }
}

/**
 * The work this browser kept before a folder was chosen, and the folder just
 * chosen: what the chrome may offer to bring along.
 */
export type FolderAdoption = {
  readonly from: Repositories
  readonly into: Repositories
  /** What the answer is remembered under. */
  readonly root: string
  /** What the question calls the folder. */
  readonly name: string
}

export type FolderOwn = {
  /** What the pull as the folder opened answered, where one was made. */
  readonly pulled?: PullOutcome
  /** Where the folder was just chosen and there is somewhere work was kept before it. */
  readonly adoption?: FolderAdoption
  /** The remote, where this host can reach one. */
  readonly sync?: FolderSync
  /** What this person does about the remote here. */
  readSettings(): Promise<SyncSettings>
  writeSettings(patch: Partial<SyncSettings>): Promise<SyncSettings>
  /** Push, where this person said to after every entry: the moment after one, or after keeping ours. */
  pushIfWanted(): Promise<void>
  /** Hear what a push answered. */
  onPushed(listener: (outcome: PushOutcome) => void): () => void
  /** Into the trail the app keeps: a remote that would not answer, where nobody asked. */
  report(where: string, cause: unknown): void
  /** A line in the trail about what was done: counts, never names — it goes to a file a person hands over. */
  note(level: 'info' | 'warn', where: string, message: string): void
}

/** The folder's own parts, over its settings and its remote. */
export function folderOwn(deps: {
  settings: SettingsRepository
  sync?: FolderSync
  pulled?: PullOutcome
  adoption?: FolderAdoption
  diagnostics: Diagnostics
}): FolderOwn {
  const { settings, sync, pulled, adoption, diagnostics } = deps
  const listeners = new Set<(outcome: PushOutcome) => void>()
  const readSettings = async () => syncSettingsOf(await settings.read({ of: 'person' }))
  return {
    ...(pulled !== undefined ? { pulled } : {}),
    ...(sync ? { sync } : {}),
    ...(adoption ? { adoption } : {}),
    readSettings,
    async writeSettings(patch) {
      return syncSettingsOf(await settings.write({ of: 'person' }, { git: { ...patch } }))
    },
    async pushIfWanted() {
      if (!sync || !(await readSettings()).pushAfterSnapshot) return
      const outcome = await sync.push()
      for (const listener of listeners) listener(outcome)
    },
    onPushed(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    report(where, cause) {
      diagnostics.report({ level: 'warn', where, message: 'rejected', cause })
    },
    note(level, where, message) {
      diagnostics.report({ level, where, message })
    },
  }
}

/**
 * The folder's history, pushing after every entry recorded where this person
 * said to. A push that fails never unmakes the entry, and never reaches the
 * caller: it is reported, and the chrome says what it answered.
 */
export function pushingAfterRecord(history: HistoryRepository, own: FolderOwn): HistoryRepository {
  return {
    id: history.id,
    async record(wanted) {
      const written = await history.record(wanted)
      void own.pushIfWanted().catch((cause: unknown) => own.report('sync.push', cause))
      return written
    },
    entries: (wanted) => history.entries(wanted),
    stateAt: (scope, entry) => history.stateAt(scope, entry),
    label: (scope, entry, name) => history.label(scope, entry, name),
  }
}
