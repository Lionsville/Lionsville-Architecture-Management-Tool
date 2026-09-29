// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The folder's revision: a fingerprint of the files a scope is kept as
 * (ADR-0031 §2). The refusal a stale save meets, and the fingerprint itself,
 * are every store's (`projects/revision.ts`); which files are fingerprinted,
 * and in what order, is the folder's.
 */
import { fingerprint } from '../../projects/revision'
import type { FolderFile } from './format/folderFormat'

/**
 * A scope's revision, from the files it is kept as: every path and what is in
 * it, in path order, so the order a folder happened to list them in does not
 * make two revisions of one state.
 */
export function folderRevision(files: readonly FolderFile[]): string {
  const sorted = [...files].sort((one, other) => (one.path < other.path ? -1 : one.path > other.path ? 1 : 0))
  return fingerprint(sorted.flatMap((file) => [file.path, 'text' in file ? file.text : file.bytes]))
}
