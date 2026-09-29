// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One thing a scope holds, named by its kind and its id (ADR-0031 §1).
 *
 * "The history of `erp`" is a question about a record, not about where the
 * record happens to be kept: an element is an element however an
 * implementation keeps it, whole with its scope or one by one. So the history
 * of a thing is asked by its **record key**, and what a step touched is said
 * in the same words — worked out from what the step's commands write
 * (ADR-0028), which is the one account of a command's reach this repository
 * keeps.
 *
 * Coarser than a write key on purpose. `diagram/l7/node/crews` is a node on a
 * board, and the thing a person asks the history of is the board; a patch on
 * an element's aspects is a change to the element. A record key is the first
 * two segments of a write key and nothing under them.
 */
import type { Command } from './commands'
import { writesOf } from './reducer'
import type { WriteKey } from './reducer'

/**
 * The kinds of record a scope holds: one per list the model keeps
 * (`ModelOrder`), the pictures its documents show, and the scope itself — its
 * name, its description and what it says about itself, which a history lists
 * as a thing like any other.
 */
export type RecordKind =
  | 'element' | 'relation' | 'diagram' | 'decision' | 'transition'
  | 'observation' | 'cause' | 'solution' | 'experiment'
  | 'image' | 'scope'

export const RECORD_KINDS: readonly RecordKind[] = [
  'element', 'relation', 'diagram', 'decision', 'transition',
  'observation', 'cause', 'solution', 'experiment', 'image', 'scope',
]

/**
 * One record. `id` is the record's own id — an element's, a view's, an
 * image's name — and the empty string for the scope itself, which has one of
 * it per scope.
 */
export type RecordKey = { readonly kind: RecordKind; readonly id: string }

/** The scope's own record: its name, its description, what it says it is. */
export const SCOPE_RECORD: RecordKey = { kind: 'scope', id: '' }

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === 'string' && (RECORD_KINDS as readonly string[]).includes(value)
}

export function sameRecord(one: RecordKey, other: RecordKey): boolean {
  return one.kind === other.kind && one.id === other.id
}

/**
 * The record a write key is about, or `undefined` for one that names
 * everything (`*`).
 *
 * The model's settings are written as `project/<field>` — the scope's own
 * record here, because what the model calls its project is the scope.
 */
export function recordOfWrite(key: WriteKey): RecordKey | undefined {
  const [head, id = ''] = key.split('/')
  if (head === 'project') return SCOPE_RECORD
  return isRecordKind(head) ? { kind: head, id } : undefined
}

/**
 * Every record a command writes, once each, in the order first written — or
 * `undefined` where the command may write anything at all: a type this build
 * has no descriptor for, or a write key that names everything. A reader
 * filtering a history by record reads `undefined` as *this step may be about
 * any of them*, for the reason `writesOf` gives: a set too small is a step
 * missing from a thing's history, and one too large is only a line to read.
 */
export function recordsOf(command: Command): readonly RecordKey[] | undefined {
  const writes = writesOf(command)
  if (writes === undefined) return undefined
  const found: RecordKey[] = []
  for (const key of writes) {
    const record = recordOfWrite(key)
    if (record === undefined) return undefined
    if (!found.some((held) => sameRecord(held, record))) found.push(record)
  }
  return found
}
