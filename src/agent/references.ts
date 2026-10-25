// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's `references.list` (ADR-0043 §9, §10): what a document in a
 * scope may refer to — its views and elements, the principles in force there
 * and their aspects, every building block's requirements and every scope's
 * evaluation of one, its decisions and observations — each with the markdown
 * that refers to it. The same catalogue the editor's *Insert ▾* and the
 * completion while typing read (`search/referables.ts`), so a person and an
 * agent refer to the same things in the same words.
 */
import { findReferables } from '../documentation/references'
import type { Translate } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { referablesIn } from '../search/referables'
import type { AgentAnswer } from './tools'
import { json, refused } from './tools'
import type { TreeView } from './tree'

/** The scope open, as the reads that may answer from it are handed it. */
type Open = { readonly path: string; readonly current: HostModel }

/** At most this many, best first: enough to choose from, never the whole organisation. */
const LIMIT = 50

/** Where no words are lent, the keys: the markdown, which is what is written, does not need them. */
const KEYS: Translate = (key) => key

export async function listReferences(args: unknown, tree: TreeView | undefined, open: Open | undefined, s: Translate = KEYS): Promise<AgentAnswer> {
  const asked = (args ?? {}) as { scope?: string; query?: string }
  const path = asked.scope ?? open?.path
  if (path === undefined) return refused('agent.noProject')
  const model = open && open.path === path ? open.current : (await tree?.read(path))?.model
  if (!model) return refused('agent.unknownScope', path || 'the organisation')
  const records = tree?.records?.()
  const names = new Map((tree?.scopes() ?? []).map((one) => [one.path, one.name]))
  const all = referablesIn({
    model,
    principles: records?.inForce(path).map(({ scope, principle }) => ({ scope, principle })) ?? [],
    blocks: records?.blocks() ?? [], evaluations: records?.evaluations() ?? [],
    scopeLabel: (at) => names.get(at) ?? (at || s('common.organisation')), s,
  })
  const found = findReferables(all, asked.query ?? '', LIMIT)
  return json({
    scope: path, count: all.length,
    references: found.map((one) => ({ kind: one.kind, label: one.label, ...(one.detail ? { detail: one.detail } : {}), markdown: one.markdown, block: one.block })),
  })
}
