// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Opening a folder (ADR-0003, ADR-0005): what it is given, what it answers,
 * and the two things it does before anything in it is read.
 *
 * **The pull**, where this person said to pull when the folder opens: before
 * the first scope is read, so what opens is what was pulled, and before the
 * watcher starts, so a fast-forward's writes are never reported as somebody
 * else's change. It begins with an entry of everything — the app writes files
 * without recording them, and a fast-forward that touched unrecorded work
 * would refuse. Everything about it may say no, and a refusal is a notice the
 * folder's chrome shows rather than a failure to open.
 *
 * **The format pass** (ADR-0012 §11): an older folder is transformed rather
 * than quietly half-read, and the transformation is a pass rather than a
 * rewrite on save, because the files the format has stopped writing only
 * leave the folder when a scope is written back. It asks the folder first and
 * almost always gets nothing, so it needs nothing to remember that it has run
 * — the folder itself is the record. An entry comes first where the folder
 * keeps a history the desktop can record into; where not — a browser tab, a
 * folder with no git — it upgrades anyway and says so in the trail. Refusing
 * to open somebody's work for want of an entry would be the worse answer.
 */
import type { FolderChannel } from '../../adapters/desktop/rememberingWrites'
import type { DirectoryHandleLike } from '../../adapters/folder/DirectoryHandle'
import { FileSystemFolderSettings } from '../../adapters/folder/FileSystemFolderSettings'
import { FileSystemScopeStore } from '../../adapters/folder/FileSystemScopeStore'
import type { FolderGit } from '../../adapters/folder/folderGit'
import type { PersonSettings } from '../../adapters/folder/FolderSettingsRepository'
import type { StampCache } from '../../adapters/folder/folderPictures'
import { folderRepositories } from '../../adapters/folder/folderRepositories'
import type { PlaceStore } from '../../adapters/folder/folderScopes'
import { memoryGit } from '../../adapters/folder/memoryGit'
import type { StepStore } from '../../adapters/folder/stepMemory'
import { translator } from '../../i18n'
import type { Translate } from '../../i18n'
import type { PullOutcome } from '../../platform/sync'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { ProviderParts, SourceChanges } from '../../ports/ProviderParts'
import type { Repositories } from '../../ports/Repositories'
import { isFormatPath } from '../../projects/folderFormat'
import { upgradeProjects } from '../../projects/migration'
import { folderOwn, pushingAfterRecord, syncSettingsOf } from './folderOwn'
import type { FolderOwn, FolderSync } from './folderOwn'

/**
 * What a folder source needs to be given: the handle to work through, and what
 * the folder is called and where it is — and, where the host keeps them, its
 * history, the step ids its repositories applied, and what this person does
 * about it.
 *
 * A browser's handle has no path to give, so `root` falls back to the name —
 * which is all a tab knows about where it is, and enough to tell two folders
 * apart within one tab. It has no git either: its history, and what it keeps
 * about the folder, are kept in the browser's database beside the folder's
 * handle; where there is no database, for as long as the tab is open.
 */
export type FolderOpening = {
  handle: DirectoryHandleLike
  name: string
  root: string
  git?: FolderGit
  steps?: StepStore
  places?: PlaceStore
  stamps?: StampCache
  person?: PersonSettings
  /** The folder's remote, where the host can reach one (the desktop's). */
  sync?: FolderSync
  /** What the desktop's watcher says, and which of it is this window's own writes coming back. */
  channel?: FolderChannel
  /**
   * The person just pointed the app at this folder — a pick, the Recent list —
   * rather than it being the one this machine worked in last: the moment the
   * folder may offer to bring along the work this browser kept.
   */
  chosen?: boolean
  /** Where its history is kept, in the provider's sentence, where it has a history of its own to keep. */
  historyNoteKey?: string
}

export type FolderParts = ProviderParts<FolderOwn> & { own: FolderOwn }

/** What the folder is handed from the shell's side: the trail, and the person's language for what it records. */
export type FolderBase = {
  readonly diagnostics: Diagnostics
  readonly s?: Translate
  /** Where this boot kept work before any source was chosen: this browser's own, or memory. */
  readonly beneath?: Repositories
}

/** Pull, where this person said to and there is a history to pull into; nothing where not. */
async function pullOnOpen(opening: FolderOpening, base: FolderBase, s: Translate): Promise<PullOutcome | undefined> {
  const { sync, person } = opening
  if (!sync || !person) return undefined
  try {
    if (!syncSettingsOf(await person.read()).pullOnOpen) return undefined
    // No history, no remote: nothing to pull, and nothing to say about it.
    if (!await sync.keeping()) return undefined
    await sync.record(s('history.beforeSync'))
    return await sync.pull()
  } catch (cause) {
    base.diagnostics.report({ level: 'warn', where: 'sync', message: 'pull on open failed', cause })
    return undefined
  }
}

/** Every scope in the folder, in the format this build writes. */
async function upgradeFormat(opening: FolderOpening, base: FolderBase, s: Translate): Promise<void> {
  const { handle, name, sync } = opening
  const { diagnostics } = base
  // The organisation's name, where a build before scopes put it: the folder's
  // own settings (ADR-0012 §1). Read only when there is something to rewrite.
  const rootName = async (): Promise<string | undefined> => {
    const settings = await new FileSystemFolderSettings(handle).readFolder().catch((cause: unknown) => {
      diagnostics.report({ level: 'warn', where: 'formatUpgrade', message: 'the folder settings could not be read', cause })
      return undefined
    })
    return settings?.legacyOrganisationName ?? name
  }
  const tally = await upgradeProjects(new FileSystemScopeStore(handle, diagnostics), {
    rootName,
    record: sync && (async () => {
      if (!await sync.available() || !await sync.keeping()) return false
      return sync.record(s('history.beforeUpgrade'))
    }),
  }).catch((cause: unknown) => {
    diagnostics.report({ level: 'error', where: 'formatUpgrade', message: 'upgrading the file format failed', cause })
    return undefined
  })
  // Counts, never names: this line goes to a log file the person is invited
  // to hand over. Silent when there was nothing to do, which is almost always.
  if (!tally || (tally.upgraded === 0 && tally.created === 0 && tally.failed === 0)) return
  diagnostics.report({
    level: tally.failed ? 'warn' : 'info',
    where: 'formatUpgrade',
    message: `upgraded ${tally.upgraded} scopes, created ${tally.created}, failed ${tally.failed}, snapshot ${tally.recorded}`,
  })
}

/**
 * The desktop's watcher over the folder, as the app hears a change made other
 * than through this window.
 *
 * The whole folder is watched rather than one scope: one watcher for the
 * window, and watching the same root twice is nothing in main. Nothing
 * unwatches it — another scope may be opened a second later, and it costs one
 * handle. A scope hears its OWN files only; the index asks for the whole tree,
 * because a scope three levels down renaming something is what it exists to
 * notice.
 */
function watching(channel: FolderChannel, root: string, diagnostics: Diagnostics): SourceChanges {
  return (scope, onChanged, wholeTree = false) => {
    void channel.files.watch(root).catch((cause: unknown) => {
      diagnostics.report({ level: 'warn', where: 'workingDirectory', message: 'the folder cannot be watched', cause })
    })
    const prefix = scope === '' ? '' : `${scope}/`
    return channel.files.onChanged((change) => {
      if (change.root !== root || !change.path.startsWith(prefix)) return
      if (!wholeTree && !isFormatPath(change.path.slice(prefix.length))) return
      // This window's own writes come back as news, and whether that is news
      // depends on who asks: the open scope just wrote them, and the tree —
      // derived from every scope, this window's writes included — must hear
      // them all.
      if (!wholeTree && channel.ours(change)) return
      onChanged()
    })
  }
}

/** The folder, pulled and brought up to date, and its repositories over it. */
export async function openFolder(opening: FolderOpening, base: FolderBase): Promise<FolderParts> {
  const { handle, name, root, git, steps, places, stamps, person, sync, channel } = opening
  const { diagnostics } = base
  const s = base.s ?? translator('en')
  const pulled = await pullOnOpen(opening, base, s)
  await upgradeFormat(opening, base, s)
  const repositories = folderRepositories({
    // A tab's folder with no database to keep a history in keeps one for as
    // long as the tab is open.
    root: handle, git: git ?? memoryGit(handle, 'this tab'), diagnostics,
    ...(steps ? { steps } : {}), ...(places ? { places } : {}), ...(stamps ? { stamps } : {}),
    ...(person ? { person } : {}),
  })
  const own = folderOwn({
    settings: repositories.settings, diagnostics,
    ...(sync ? { sync } : {}),
    ...(pulled ? { pulled } : {}),
    ...(opening.chosen && base.beneath ? { adoption: { from: base.beneath, into: repositories, root, name } } : {}),
  })
  return {
    repositories: { ...repositories, history: pushingAfterRecord(repositories.history, own) },
    source: { provider: 'folder', name, key: root },
    own,
    // Where the history is kept: the opening's own place, or — where there is
    // none to keep it in — for as long as the tab is open.
    historyNoteKey: git ? opening.historyNoteKey ?? 'folder.historyNote' : 'memory.historyNote',
    ...(channel ? { changes: watching(channel, root, diagnostics) } : {}),
  }
}
