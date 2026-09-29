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
import { SCOPE_RECORD, sameRecord, sameValue } from '../../model/recordKey'
import { isSafeScopePath, isWithinScope, ROOT_SCOPE } from '../../projects/scopePath'
import { applySteps, emptyContent, partlyReadRefusal, putBackOf, STEP_ELSEWHERE } from '../../projects/scopeState'
import type { Revision, ScopeAddress, ScopeContent, ScopeId, ScopeState, ScopeStep } from '../../projects/scopeState'
import type {
  Applied, Created, Moved, NewScope, Refused, Removed, ScopeNode, ScopeRepository, ScopeTree, StepsFor,
} from '../../ports/ScopeRepository'
import type { Transaction } from './KeyedStore'
import {
  allScopes, closeEntry, forget, indexChanged, makeAncestors, makeScope, META_KEY, mintId, parentOf, readContent, readMeta, readModel, readState,
  says, scopeAt, writeContent,
} from './kept'
import type { KeptScope, Meta } from './kept'
import type { Source } from './source'
import { bytesMissing } from './imageNames'
import { appliedTo, letGo, remember } from './stepIds'

/**
 * One scope's new steps in an apply, its runs one after the other; `putBack`
 * where the scope was not read whole and the run puts it back, so it is
 * written even where what it puts back is what could be read, and what was
 * there is kept first.
 */
type Run = { kept: KeptScope; steps: ScopeStep[]; putBack?: { subject: string } }

/** What one scope's run came to, before it is written. */
type Planned = {
  kept: KeptScope; before: ScopeContent; content: ScopeContent; records: readonly RecordKey[]; at: number
  putBack?: { subject: string }
}

export class KeptScopes implements ScopeRepository {
  readonly id: string

  private readonly source: Source

  constructor(source: Source) {
    this.source = source
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
      for (const { kept, steps, putBack } of runs.values()) {
        const { content: before } = await readContent(tx, kept)
        const result = applySteps(before, steps)
        if (!result.ok) return { refused: result.refused, scope: kept.id, stepId: result.stepId }
        const missing = await bytesMissing(tx, kept.id, before.images, result.content.images, steps)
        if (missing) return { refused: 'shell.imageBytesGone', scope: kept.id, ...(missing.stepId ? { stepId: missing.stepId } : {}) }
        if (result.changed || putBack) {
          const at = Math.max(...steps.map((one) => one.at))
          planned.push({ kept, before, content: result.content, records: result.records, at, ...(putBack ? { putBack } : {}) })
        }
      }
      for (const [scope, { steps }] of runs) for (const one of steps) remember(tx, one.stepId, scope, now)
      await letGo(tx, now)
      if (planned.length > 0) await commit(tx, await readMeta(tx), planned, { now, by: this.source.by })
      return { revisions: work.map(({ scope }) => read.get(scope)!.revision) }
    })
  }

  create(at: ScopeAddress, scope: NewScope): Promise<Created | Refused> {
    if (!isSafeScopePath(at)) return Promise.resolve({ refused: 'shell.badScopePath' })
    return this.source.write(async (tx) => {
      const scopes = await allScopes(tx)
      if (scopeAt(scopes, at)) return { refused: 'shell.scopeTaken' }
      const { name, ...description } = scope
      const made = [...await makeAncestors(tx, scopes, at), await makeScope(tx, at, emptyContent(name, description))]
      const meta = await readMeta(tx)
      meta.treeRevision = mintId()
      indexChanged(tx, meta, made.map((kept) => kept.id))
      tx.put('meta', META_KEY, meta)
      const kept = made[made.length - 1]
      return { id: kept.id, revision: kept.revision }
    })
  }

  /**
   * Every scope under the one moved goes with it, and each closes its open
   * entry as the entry that says it moved (`HistoryEntry.moved`).
   */
  move(scope: ScopeId, to: ScopeAddress, expects?: Revision): Promise<Moved | Refused> {
    const now = Date.now()
    return this.source.write(async (tx) => {
      const scopes = await allScopes(tx)
      const kept = scopes.find((one) => one.id === scope)
      const refused = moveRefusal(scopes, kept, to, expects)
      if (refused) return { refused, scope }
      const from = kept!.address
      const moving = scopes.filter((one) => isWithinScope(one.address, from))
      const made = await makeAncestors(tx, scopes, to)
      const meta = await readMeta(tx)
      for (const one of moving) {
        const was = one.address
        one.address = `${to}${one.address.slice(from.length)}`
        one.revision = mintId()
        one.pending = { records: mergeRecords(one.pending?.records ?? [], [SCOPE_RECORD]), at: Math.max(now, one.pending?.at ?? 0) }
        // Written by the closing, at its new address and with no entry open.
        await closeEntry(tx, meta, one, this.source.by, undefined, { from: was, to: one.address })
      }
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
 * the way: a scope gone, or read in part by a run that does not begin by
 * putting it back, or written by a later version; a step id applied to
 * another scope; a revision moved on from.
 * A step already applied to its scope is left out, and a run whose steps have
 * all landed is not compared with what it expects.
 */
async function runsOf(tx: Transaction, work: readonly StepsFor[]): Promise<Runs | Refused> {
  const runs = new Map<ScopeId, Run>()
  const read = new Map<ScopeId, There>()
  const seen = new Map<string, ScopeId>()
  for (const { scope, steps, expects } of work) {
    const found = read.get(scope) ?? await thereAt(tx, scope)
    if ('refused' in found) return found
    const { kept, partly, later } = found
    read.set(scope, found)
    const fresh: ScopeStep[] = []
    for (const one of steps) {
      const where = seen.get(one.stepId) ?? await appliedTo(tx, one.stepId)
      if (where !== undefined && where !== scope) return { refused: STEP_ELSEWHERE, scope, stepId: one.stepId }
      if (where === undefined) fresh.push(one)
      seen.set(one.stepId, scope)
    }
    const refusal = partly && !runs.has(scope) ? partlyReadRefusal({ ...(later ? { later } : {}) }, fresh) : undefined
    if (refusal) return { refused: refusal, scope }
    if (fresh.length === 0) continue
    if (expects !== undefined && expects !== kept.revision) return { refused: 'shell.scopeMoved', scope }
    const putBack = partly ? putBackOf(fresh) : undefined
    const run = runs.get(scope) ?? { kept, steps: [], ...(putBack ? { putBack } : {}) }
    run.steps.push(...fresh)
    runs.set(scope, run)
  }
  return { runs, kept: new Map([...read].map(([id, { kept }]) => [id, kept])) }
}

/** Each scope an apply names, as it stands before the apply; and the runs of those with new steps. */
type Runs = { runs: Map<ScopeId, Run>; kept: Map<ScopeId, KeptScope> }

/** A scope a step names, whether it was read in part, and whether a later version wrote it; refused where it is not there. */
async function thereAt(tx: Transaction, scope: ScopeId): Promise<There | Refused> {
  const kept = await tx.get<KeptScope>('scopes', scope)
  if (!kept) return { refused: 'shell.scopeGone', scope }
  const read = await readModel(tx, kept)
  return { kept, partly: read.unreadable !== undefined, later: read.later === true }
}

type There = { kept: KeptScope; partly: boolean; later: boolean }

/** When an apply was made, and who a history's entry says made it. */
type Made = { now: number; by: string }

function mergeRecords(held: readonly RecordKey[], more: readonly RecordKey[]): RecordKey[] {
  return [...held, ...more.filter((record) => !held.some((one) => sameRecord(one, record)))]
}

/**
 * Write what the runs came to: each scope's content and revision, the tree's
 * revision where a node changed, the index's log. A scope put back is first
 * kept as it stood, in an entry of its history that holds what its content
 * was kept as, unread and all (`ScopeState.unreadable`).
 */
async function commit(tx: Transaction, meta: Meta, planned: readonly Planned[], made: Made): Promise<void> {
  const { now } = made
  const updatedAt = new Date(now).toISOString()
  let treeMoved = false
  for (const { kept, before, content, records, at, putBack } of planned) {
    if (putBack) await keepAsItStood(tx, meta, kept, made, putBack.subject)
    const said = says(content)
    treeMoved ||= !sameValue(kept.says, said)
    await writeContent(tx, kept.id, before.images, content)
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

/** A scope's open entry closed as the scope stands, with its content as it was kept beside it, and none left open. */
async function keepAsItStood(tx: Transaction, meta: Meta, kept: KeptScope, made: Made, subject: string): Promise<void> {
  const unread = await tx.get<unknown>('contents', kept.id)
  kept.pending = { records: mergeRecords(kept.pending?.records ?? [], [SCOPE_RECORD]), at: Math.max(made.now, kept.pending?.at ?? 0) }
  await closeEntry(tx, meta, kept, made.by, subject, undefined, unread)
  delete kept.pending
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
