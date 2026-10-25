// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `changes.list` (ADR-0038, amended §11, §12): a record's changes, as its
 * reader's *Changes* list says them — the history's entries that wrote it,
 * newest first, each with when, who, via which client, and what it did to
 * the record. Read through the session, which reads the source's history; a
 * source that keeps none answers an empty list that says so.
 */
import type { RecordKey } from '../model/recordKey'
import { aboutOf } from './commenting'
import type { AgentAnswer } from './tools'
import { checkArguments, json, refused, toolSpec } from './tools'
import { scopeAsked, withoutScope } from './tree'

/** One change, as the session reads it from the history. */
export type RecordChangeRead = { at: number; by: string; via?: string; what: string }

/** What the session reads a record's changes with: absent where the source keeps no history. */
export type ChangesOf = (about: RecordKey, scope: string | undefined, limit: number) => Promise<{ changes: readonly RecordChangeRead[]; more: boolean }>

export async function listChanges(
  rawArgs: unknown, session: { indexed(): Parameters<typeof aboutOf>[0]; scopePath(): string; changesOf?: ChangesOf },
): Promise<AgentAnswer> {
  const wrong = checkArguments(toolSpec('changes.list').inputSchema, withoutScope(rawArgs))
  if (wrong) return refused('agent.badArguments', wrong)
  const args = (rawArgs ?? {}) as { about: { kind: string; id: string }; limit?: number }
  const asked = scopeAsked(rawArgs)
  const elsewhere = asked !== undefined && asked !== session.scopePath() ? asked : undefined
  // In the open scope a record is found by its label too; in another, by its id, which is all there is to go on.
  const about = elsewhere === undefined ? aboutOf(session.indexed(), args.about) : { kind: args.about.kind, id: args.about.id } as RecordKey
  if ('ok' in about) return about
  if (!session.changesOf) return json({ about, kept: false, changes: [] })
  const read = await session.changesOf(about, elsewhere, args.limit ?? 20)
  return json({
    about,
    kept: true,
    changes: read.changes.map((one) => ({ at: new Date(one.at).toISOString(), by: one.by, ...(one.via ? { via: one.via } : {}), what: one.what })),
    ...(read.more ? { more: true } : {}),
  })
}
