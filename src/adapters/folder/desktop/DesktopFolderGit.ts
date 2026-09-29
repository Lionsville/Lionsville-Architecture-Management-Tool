// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's history on the desktop: the machine's own git, over the
 * channel to the main process (`platform/node/gitEntries.ts` on the other
 * side), bound to the folder the person chose.
 */
import type { DesktopHistory } from '../../desktop/channel'
import type { CommitsWanted, CommittedFile, FolderChange, FolderCommit, FolderGit, FolderTag, TreeEntry } from '../folderGit'

export class DesktopFolderGit implements FolderGit {
  constructor(private readonly git: DesktopHistory, private readonly root: string) {}

  keeping(): Promise<boolean> {
    return this.git.isRepository(this.root)
  }

  start(): Promise<void> {
    return this.git.startHistory(this.root)
  }

  changes(): Promise<FolderChange[]> {
    return this.git.changes(this.root)
  }

  commit(paths: readonly string[], message: string): Promise<string | undefined> {
    return this.git.commitPaths(this.root, [...paths], message)
  }

  head(): Promise<string | undefined> {
    return this.git.head(this.root)
  }

  log(wanted: CommitsWanted): Promise<FolderCommit[]> {
    const { paths, ...rest } = wanted
    return this.git.log(this.root, { ...rest, ...(paths ? { paths: [...paths] } : {}) })
  }

  treeAt(sha: string, within: string): Promise<TreeEntry[]> {
    return this.git.treeAt(this.root, sha, within)
  }

  readAt(sha: string, paths: readonly string[]): Promise<CommittedFile[]> {
    return this.git.readAt(this.root, sha, [...paths])
  }

  tags(): Promise<FolderTag[]> {
    return this.git.tags(this.root)
  }

  tag(sha: string, name: string, message: string): Promise<'done' | 'exists'> {
    return this.git.tag(this.root, sha, name, message)
  }
}
