// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder's history where nothing can keep one: a browser tab given a folder,
 * which has no git to run.
 *
 * It keeps nothing and says so rather than failing: a record closes nothing
 * and answers no entry, which the history contract calls ordinary, and a
 * history read answers none. That is what such a tab has always had — no
 * snapshots — said in the repositories' terms.
 */
import type { FolderGit } from '../../adapters/folder/folderGit'

export function unkeptHistory(): FolderGit {
  return {
    keeping: () => Promise.resolve(false),
    start: () => Promise.resolve(),
    changes: () => Promise.resolve([]),
    commit: () => Promise.resolve(undefined),
    log: () => Promise.resolve([]),
    treeAt: () => Promise.resolve([]),
    readAt: () => Promise.resolve([]),
    tags: () => Promise.resolve([]),
    tag: () => Promise.resolve('exists'),
  }
}
