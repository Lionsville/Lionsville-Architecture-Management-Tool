// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the boot reads before the first render, besides the scope it reopens.
 *
 * Out of `main.tsx` so it can be tested: that file renders at module load, and
 * these are the steps a first paint waits on. Each is a question the source is
 * asked before anything is on screen, so each is written to cost nothing where
 * its answer is already known — over a network, every one of them is a request
 * standing in line in front of the first view.
 */
import type { Diagnostics } from '../ports/Diagnostics'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { ScopeStore } from '../ports/ScopeStore'
import { upgradeProjects } from '../projects/migration'
import type { PullOutcome } from '../platform/sync'
import type { WorkingSource } from '../platform/workingSource'

/** As much of the shell as the two reads ask. */
export type BootShell = {
  scopes: ScopeStore
  source: WorkingSource
  diagnostics: Diagnostics
  history?: ProjectHistory
  folderSettings?: FolderSettingsStore
}

/**
 * Pull from the folder's remote, if this machine says so (ADR-0005).
 *
 * Here, at the edge, because of when it has to happen: before the project is
 * read, so what opens is what was pulled, and before the watcher starts, so a
 * fast-forward's writes are never reported as somebody else's change. It
 * begins with a snapshot — the app writes files without committing them, and
 * a fast-forward that touched unrecorded work would refuse — under the only
 * message a boot can draft. Everything about it may say no, and a refusal is
 * a notice the shell shows rather than a failure to open.
 *
 * A history whose remote is pulled by whoever keeps the folder for everybody
 * (`ProjectSync.pullsOnOpen`) is not asked at all: the settings read, and the
 * questions after it, would be requests the first paint waits on for an
 * answer this machine does not act on.
 */
export async function pullOnOpen(shell: BootShell, beforeSync: () => string): Promise<PullOutcome | undefined> {
  const { history, folderSettings } = shell
  if (!history?.sync || history.sync.pullsOnOpen === false || !folderSettings) return undefined
  try {
    if (!(await folderSettings.readLocal()).git.pullOnOpen) return undefined
    // No repository, no remote: nothing to pull, and nothing to say about it.
    if (!await history.keeping()) return undefined
    await history.snapshot(beforeSync())
    return await history.sync.pull()
  } catch (cause) {
    shell.diagnostics.report({ level: 'warn', where: 'sync', message: 'pull on open failed', cause })
    return undefined
  }
}

/**
 * Every project in this source, in the format this build writes.
 *
 * ADR-0012 §11: an older folder is transformed rather than quietly half-read,
 * and the transformation is a pass rather than a rewrite on save, because the
 * files the format has stopped writing only leave the folder when a project is
 * written back. It asks the store first and almost always gets nothing, so it
 * needs no preference to remember it has run — the folder itself is the record.
 *
 * The snapshot comes first where there is one to take (ADR-0008 keeps what the
 * folder looked like), and where there is not — a browser tab, a folder with no
 * git — it migrates anyway and says so in the trail. Refusing to open somebody's
 * work for want of a commit would be the worse answer.
 *
 * The folder's settings are read only when there is something to rewrite: they
 * hold the name a folder from before scopes gave its organisation, which is
 * what the pass is about to write, and nothing a current folder needs.
 */
export async function upgradeFormat(shell: BootShell, beforeUpgrade: () => string): Promise<void> {
  const { history, diagnostics, folderSettings } = shell
  // The organisation's name, where a build before scopes put it: `folder.json`
  // (ADR-0012 §1). The key is left in the file: nothing this build writes into
  // a person's folder is a settings file of ours (ADR-0023), and once the root
  // has its name nothing reads the key again.
  const rootName = async (): Promise<string | undefined> => {
    const settings = await folderSettings?.readFolder().catch((cause: unknown) => {
      diagnostics.report({ level: 'warn', where: 'formatUpgrade', message: 'the folder settings could not be read', cause })
      return undefined
    })
    return settings?.legacyOrganisationName
      ?? (shell.source.kind === 'folder' ? shell.source.name : undefined)
  }
  const tally = await upgradeProjects(shell.scopes, {
    rootName,
    record: history && (async () => {
      if (!await history.available() || !await history.keeping()) return false
      return history.snapshot(beforeUpgrade())
    }),
  }).catch((cause: unknown) => {
    diagnostics.report({
      level: 'error', where: 'formatUpgrade', message: 'upgrading the file format failed', cause,
    })
    return undefined
  })
  // Counts, never names: this line goes to a log file the user is invited to
  // hand over. Silent when there was nothing to do, which is almost always.
  if (!tally || (tally.upgraded === 0 && tally.created === 0 && tally.failed === 0)) return
  diagnostics.report({
    level: tally.failed ? 'warn' : 'info',
    where: 'formatUpgrade',
    message: `upgraded ${tally.upgraded} scopes, created ${tally.created}, failed ${tally.failed}, snapshot ${tally.recorded}`,
  })
}
