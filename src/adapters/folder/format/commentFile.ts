// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The comments on a scope's records, as files (ADR-0037 §2, format 13): one
 * JSON list per record commented on, in a folder of the scope's own.
 *
 * ```
 * _comments/<kind>-<id>.json   the thread about one record, oldest first
 * ```
 *
 * **Why the underscore**, as `_operating/`, `_assignments/` and `_checks/`
 * say: a child scope's folder name is a slug and cannot hold one, so no tree
 * already has a scope here, and format 13 takes this folder without moving
 * anybody's scope.
 *
 * **Why one file per record.** A thread is read with its record, and two
 * people commenting on two records change two files: a merge in git, or a
 * sync of the folder, meets the comments of one record at a time. A record
 * nobody has commented on has no file, and a thread emptied loses it.
 *
 * The file's name says the record (`about`), so a row does not repeat it. A
 * kind is one word, so the id is what follows its first dash; an id that a
 * file name could not hold is written escaped, as a URL escapes it.
 *
 * Forgiving in one direction, as the other codecs are: it writes one exact
 * shape and reads what it can of a hand-edited one. A row without an id, an
 * author picked from the register, a time or a body is passed over, and a
 * comment met twice is read once. A file that is not a list at all is said,
 * so the scope opens to be read and not written: a save would have written
 * its thread away.
 */
import type { Comment } from '../../../model/comment'
import { commentOf } from '../../../model/comment'
import type { HostModel } from '../../../model/hostModel'
import { isRecordKind } from '../../../model/recordKey'
import type { RecordKey } from '../../../model/recordKey'
import { parseJson, stableJson } from '../../../projects/text'

/** The folder the threads are kept in. Not a slug, so never a scope's name. */
export const COMMENTS_FOLDER = '_comments'

const FILE = /^_comments\/([A-Za-z]+)-([^/]+)\.json$/

/** The file a record's thread is kept in. */
export function threadPath(about: RecordKey): string {
  return `${COMMENTS_FOLDER}/${about.kind}-${encodeURIComponent(about.id)}.json`
}

/** The record a thread's file is about, by its name; nothing for a path that is not one. */
export function threadOf(path: string): RecordKey | undefined {
  const match = FILE.exec(path)
  if (!match || !isRecordKind(match[1])) return undefined
  try {
    return { kind: match[1], id: decodeURIComponent(match[2]) }
  } catch {
    return undefined
  }
}

/** Whether a path inside a scope's folder is a thread's file. */
export function isThreadPath(path: string): boolean {
  return threadOf(path) !== undefined
}

/** A comment as its thread's file keeps it: everything but what the file's name says. */
function rowOf(comment: Comment): Omit<Comment, 'about'> {
  const { about: _named, ...row } = comment
  return row
}

/** The threads' files, one per record commented on, in the order the comments were written. */
export function commentFiles(model: Pick<HostModel, 'comments'>): { path: string; text: string }[] {
  const threads = new Map<string, Comment[]>()
  for (const comment of model.comments ?? []) {
    const path = threadPath(comment.about)
    threads.set(path, [...threads.get(path) ?? [], comment])
  }
  return [...threads].map(([path, thread]) => ({ path, text: stableJson(thread.map(rowOf)) }))
}

/** Each row of a file that is a list; `undefined` where it is not one. */
function rowsIn(text: string): unknown[] | undefined {
  const held = parseJson(text)
  return Array.isArray(held) ? held : undefined
}

/** Whether a thread's file is there and is not a list — the file a save must not write over. */
export function commentFileUnreadable(text: string | undefined): boolean {
  return text !== undefined && rowsIn(text) === undefined
}

/**
 * The comments out of the threads' files, by path: every file under
 * `_comments/` whose name says a record, in path order, each thread in its
 * file's order. No file is no list, as a folder with no decisions has no
 * `decisions`.
 */
export function commentsFrom(paths: readonly string[], textAt: (path: string) => string | undefined): Pick<HostModel, 'comments'> {
  const seen = new Set<string>()
  const comments: Comment[] = []
  for (const path of [...paths].filter(isThreadPath).sort()) {
    const about = threadOf(path)!
    const text = textAt(path)
    for (const row of (text === undefined ? undefined : rowsIn(text)) ?? []) {
      const comment = commentOf(row, about)
      if (!comment || seen.has(comment.id)) continue
      seen.add(comment.id)
      comments.push({ ...comment, about })
    }
  }
  return comments.length ? { comments } : {}
}
