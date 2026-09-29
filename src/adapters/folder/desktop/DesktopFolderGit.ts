// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's history on the desktop: the machine's own git, over the
 * channel to the main process (`platform/node/gitEntries.ts` on the other
 * side), bound to the folder the person chose.
 */
import type { DesktopHistory } from '../../desktop/channel'
import { crossedFromMain } from '../../desktop/crossedFromMain'
import type { CommitsWanted, CommittedFile, FolderChange, FolderCommit, FolderGit, FolderTag, TreeEntry } from '../folderGit'

/**
 * A call over the channel, its failure said as the refusal main sent: a key,
 * or a git refused in the folder with the setting named, rather than the
 * channel's own wrapping of it (`adapters/desktop/crossedFromMain.ts`).
 */
function said<T>(call: Promise<T>): Promise<T> {
  return call.catch((cause: unknown) => { throw crossedFromMain(cause) })
}

export class DesktopFolderGit implements FolderGit {
  private readonly git: DesktopHistory
  private readonly root: string

  constructor(git: DesktopHistory, root: string) {
    this.git = git
    this.root = root
  }

  keeping(): Promise<boolean> {
    return said(this.git.isRepository(this.root))
  }

  start(): Promise<void> {
    return said(this.git.startHistory(this.root))
  }

  readiness(): Promise<'ready' | 'midway' | 'detached'> {
    return said(this.git.readiness(this.root))
  }

  changes(): Promise<FolderChange[]> {
    return said(this.git.changes(this.root))
  }

  commit(paths: readonly string[], message: string): Promise<string | undefined> {
    return said(this.git.commitPaths(this.root, [...paths], message))
  }

  head(): Promise<string | undefined> {
    return said(this.git.head(this.root))
  }

  log(wanted: CommitsWanted): Promise<FolderCommit[]> {
    const { paths, ...rest } = wanted
    return said(this.git.log(this.root, { ...rest, ...(paths ? { paths: [...paths] } : {}) }))
  }

  treeAt(sha: string, within: string): Promise<TreeEntry[]> {
    return said(this.git.treeAt(this.root, sha, within))
  }

  readAt(sha: string, paths: readonly string[]): Promise<CommittedFile[]> {
    return said(this.git.readAt(this.root, sha, [...paths]))
  }

  texts(ids: readonly string[]): Promise<Record<string, string>> {
    return said(this.git.texts(this.root, [...ids]))
  }

  sizes(ids: readonly string[]): Promise<Record<string, number>> {
    return said(this.git.sizes(this.root, [...ids]))
  }

  blobsAt(at: readonly { sha: string; path: string }[]): Promise<(string | undefined)[]> {
    return said(this.git.blobsAt(this.root, at.map((one) => ({ ...one }))))
  }

  tags(): Promise<FolderTag[]> {
    return said(this.git.tags(this.root))
  }

  tag(sha: string, name: string, message: string): Promise<'done' | 'exists'> {
    return said(this.git.tag(this.root, sha, name, message))
  }
}
