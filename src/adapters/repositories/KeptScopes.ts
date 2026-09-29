// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `ScopeRepository` over a keyed store (ADR-0031 §1).
 *
 * Every write is one transaction: an apply to several scopes reads what it
 * needs, decides, and writes every scope, its library, its step ids and the
 * index's log together — or, refused anywhere, writes nothing. So an apply
 * lands whole or not at all, and a page that goes away half-way leaves the
 * store as it was before the apply began.
 */
import type { RecordKey } from '../../model/recordKey'
import { sameRecord, sameValue } from '../../model/recordKey'
import { isSafeScopePath, isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import { applySteps, emptyContent, STEP_ELSEWHERE } from '../../projects/scopeState'
import type { Revision, ScopeAddress, ScopeContent, ScopeId, ScopeState, ScopeStep } from '../../projects/scopeState'
import type {
  Applied, Created, Moved, NewScope, Refused, Removed, ScopeNode, ScopeRepository, ScopeTree, StepsFor,
} from '../../ports/ScopeRepository'
import type { Transaction } from './KeyedStore'
import {
  allScopes, forget, indexChanged, makeAncestors, makeScope, META_KEY, mintId, parentOf, readContent, readMeta, readState, says, scopeAt,
  writeContent,
} from './kept'
import type { KeptScope, Meta } from './kept'
import type { Source } from './source'
import { appliedTo, letGo, remember } from './stepIds'

/** One scope's new steps in an apply, its runs one after the other. */
type Run = { kept: KeptScope; steps: ScopeStep[] }

/** What one scope's run came to, before it is written. */
type Planned = { kept: KeptScope; before: ScopeContent; content: ScopeContent; records: readonly RecordKey[]; at: number }

export class KeptScopes implements ScopeRepository {
  readonly id: string

  constructor(private readonly source: Source) {
    this.id = source.id
  }

  tree(): Promise<ScopeTree> {
    return this.source.read(async (tx) => {
      const scopes = await allScopes(tx)
      const meta = await readMeta(tx)
      return { revision: meta.treeRevision, root: nodeOf(scopes, scopeAt(scopes, ROOT_SCOPE)!) }
    })
  }

  state(scope: ScopeId): Promise<ScopeState | undefined> {
    return this.source.read(async (tx) => {
      const kept = await tx.get<KeptScope>('scopes', scope)
      return kept ? readState(tx, kept) : undefined
    })
  }

  apply(work: readonly StepsFor[]): Promise<Applied | Refused> {
    const now = Date.now()
    return this.source.write(async (tx) => {
      const found = await runsOf(tx, work)
      if ('refused' in found) return found
      const { runs, kept: read } = found
      const planned: Planned[] = []
      for (const { kept, steps } of runs.values()) {
        const { content: before } = await readContent(tx, kept)
        const result = applySteps(before, steps)
        if (!result.ok) return { refused: result.refused, scope: kept.id, stepId: result.stepId }
        if (result.changed) {
          planned.push({ kept, before, content: result.content, records: result.records, at: Math.max(...steps.map((one) => one.at)) })
        }
      }
      for (const [scope, { steps }] of runs) for (const one of steps) remember(tx, one.stepId, scope, now)
      await letGo(tx, now)
      if (planned.length > 0) commit(tx, await readMeta(tx), planned, now)
      return { revisions: work.map(({ scope }) => read.get(scope)!.revision) }
    })
  }

  create(at: ScopeAddress, scope: NewScope): Promise<Created | Refused> {
    if (!isSafeScopePath(at)) return Promise.resolve({ refused: 'shell.badScopePath' })
    return this.source.write(async (tx) => {
      const scopes = await allScopes(tx)
      if (scopeAt(scopes, at)) return { refused: 'shell.scopeTaken' }
      const { name, ...description } = scope
      const made = [...makeAncestors(tx, scopes, at), makeScope(tx, at, emptyContent(name, description))]
      const meta = await readMeta(tx)
      meta.treeRevision = mintId()
      indexChanged(tx, meta, made.map((kept) => kept.id))
      tx.put('meta', META_KEY, meta)
      const kept = made[made.length - 1]
      return { id: kept.id, revision: kept.revision }
    })
  }

  move(scope: ScopeId, to: ScopeAddress, expects?: Revision): Promise<Moved | Refused> {
    return this.source.write(async (tx) => {
      const scopes = await allScopes(tx)
      const kept = scopes.find((one) => one.id === scope)
      const refused = moveRefusal(scopes, kept, to, expects)
      if (refused) return { refused, scope }
      const from = kept!.address
      const moving = scopes.filter((one) => isWithinScope(one.address, from))
      const made = makeAncestors(tx, scopes, to)
      for (const one of moving) {
        one.address = `${to}${one.address.slice(from.length)}`
        one.revision = mintId()
        tx.put('scopes', one.id, one)
      }
      const meta = await readMeta(tx)
      meta.treeRevision = mintId()
      indexChanged(tx, meta, [...made, ...moving].map((one) => one.id))
      tx.put('meta', META_KEY, meta)
      return { revision: kept!.revision }
    })
  }

  remove(scope: ScopeId, expects?: Revision): Promise<Removed | Refused> {
    return this.source.write(async (tx) => {
      const scopes = await allScopes(tx)
      const kept = scopes.find((one) => one.id === scope)
      if (!kept) return { removed: [] }
      if (kept.address === ROOT_SCOPE) return { refused: 'shell.badScopePath', scope }
      if (expects !== undefined && expects !== kept.revision) return { refused: 'shell.scopeMoved', scope }
      const removed = scopes.filter((one) => isWithinScope(one.address, kept.address)).map((one) => one.id)
      for (const id of removed) forget(tx, id)
      const meta = await readMeta(tx)
      meta.treeRevision = mintId()
      indexChanged(tx, meta, [], removed)
      tx.put('meta', META_KEY, meta)
      return { removed }
    })
  }
}

function moveRefusal(
  scopes: readonly KeptScope[], kept: KeptScope | undefined, to: ScopeAddress, expects: Revision | undefined,
): Refused['refused'] | undefined {
  if (!kept) return 'shell.scopeGone'
  if (kept.address === ROOT_SCOPE || !isSafeScopePath(to)) return 'shell.badScopePath'
  if (isWithinScope(to, kept.address)) return 'shell.scopeIntoItself'
  if (scopeAt(scopes, to)) return 'shell.scopeTaken'
  if (expects !== undefined && expects !== kept.revision) return 'shell.scopeMoved'
  return undefined
}

/**
 * Each scope's new steps, its runs one after the other, or the refusal met on
 * the way: a scope gone or read in part, a step id applied to another scope,
 * a revision moved on from. A step already applied to its scope is left out,
 * and a run whose steps have all landed is not compared with what it expects.
 */
async function runsOf(tx: Transaction, work: readonly StepsFor[]): Promise<Runs | Refused> {
  const runs = new Map<ScopeId, Run>()
  const read = new Map<ScopeId, KeptScope>()
  const seen = new Map<string, ScopeId>()
  for (const { scope, steps, expects } of work) {
    const kept = read.get(scope) ?? await readable(tx, scope)
    if ('refused' in kept) return kept
    read.set(scope, kept)
    const fresh: ScopeStep[] = []
    for (const one of steps) {
      const where = seen.get(one.stepId) ?? await appliedTo(tx, one.stepId)
      if (where !== undefined && where !== scope) return { refused: STEP_ELSEWHERE, scope, stepId: one.stepId }
      if (where === undefined) fresh.push(one)
      seen.set(one.stepId, scope)
    }
    if (fresh.length === 0) continue
    if (expects !== undefined && expects !== kept.revision) return { refused: 'shell.scopeMoved', scope }
    const run = runs.get(scope) ?? { kept, steps: [] }
    run.steps.push(...fresh)
    runs.set(scope, run)
  }
  return { runs, kept: read }
}

/** Each scope an apply names, as it stands before the apply; and the runs of those with new steps. */
type Runs = { runs: Map<ScopeId, Run>; kept: Map<ScopeId, KeptScope> }

/** A scope a step may be applied to: there, and read whole. */
async function readable(tx: Transaction, scope: ScopeId): Promise<KeptScope | Refused> {
  const kept = await tx.get<KeptScope>('scopes', scope)
  if (!kept) return { refused: 'shell.scopeGone', scope }
  if ((await readContent(tx, kept)).unreadable) return { refused: 'shell.unreadableNotSaved', scope }
  return kept
}

function mergeRecords(held: readonly RecordKey[], more: readonly RecordKey[]): RecordKey[] {
  return [...held, ...more.filter((record) => !held.some((one) => sameRecord(one, record)))]
}

/** Write what the runs came to: each scope's content and revision, the tree's revision where a node changed, the index's log. */
function commit(tx: Transaction, meta: Meta, planned: readonly Planned[], now: number): void {
  const updatedAt = new Date(now).toISOString()
  let treeMoved = false
  for (const { kept, before, content, records, at } of planned) {
    const said = says(content)
    treeMoved ||= !sameValue(kept.says, said)
    writeContent(tx, kept.id, before.images, content)
    kept.says = said
    kept.revision = mintId()
    kept.updatedAt = updatedAt
    kept.pending = { records: mergeRecords(kept.pending?.records ?? [], records), at: Math.max(kept.pending?.at ?? 0, at) }
    tx.put('scopes', kept.id, kept)
  }
  if (treeMoved) meta.treeRevision = mintId()
  indexChanged(tx, meta, planned.map(({ kept }) => kept.id))
  tx.put('meta', META_KEY, meta)
}

function nodeOf(scopes: readonly KeptScope[], kept: KeptScope): ScopeNode {
  const parent = parentOf(scopes, kept.address)
  const children = scopes
    .filter((child) => child.address !== kept.address && parentOf(scopes, child.address)?.id === kept.id)
    .sort((one, other) => (one.address < other.address ? -1 : 1))
  return {
    ...kept.says, id: kept.id, address: kept.address,
    ...(parent ? { parent: parent.id } : {}),
    ...(kept.updatedAt ? { updatedAt: kept.updatedAt } : {}),
    children: children.map((child) => nodeOf(scopes, child)),
  }
}
