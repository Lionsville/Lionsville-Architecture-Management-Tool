// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Put back what a page held and never wrote (`ports/PendingSteps.ts`): each
 * line applied to its scope expecting the revision it was made against.
 *
 * Where the scope moved since — another tab changed it, the write landed after
 * all — the line is laid onto the scope as it is now, step by step, keeping
 * only the steps that touch no record anybody changed since the line's base
 * (as the line's prints of those records say) and that still apply: nothing
 * is put over anybody's work. What could not be put back is counted, for the
 * one sentence that says so. A line answered either way is let go of; one
 * that met a failure is kept for the next open.
 */
import { fromArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { RECORD_LISTS, recordsChanged, stableText } from '../model/recordKey'
import type { RecordKey } from '../model/recordKey'
import type { HeldSteps, PendingSteps } from '../ports/PendingSteps'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { fingerprint, SCOPE_MOVED } from './revision'
import { nodeAt } from './scopeAccess'
import { applySteps } from './scopeState'
import type { ScopeState, ScopeStep } from './scopeState'

/** What was put back, and how many steps could not be. */
export type Recovered = { put: number; dropped: number }

export async function recoverPending(
  scopes: Pick<ScopeRepository, 'apply' | 'tree' | 'state'>, pending: PendingSteps | undefined,
  report?: (message: string, cause?: unknown) => void,
): Promise<Recovered> {
  const said: Recovered = { put: 0, dropped: 0 }
  if (!pending) return said
  const lines = await pending.left()
  for (const line of lines) {
    try {
      const scope = line.scope.id ?? nodeAt(await scopes.tree(), line.scope.address)?.id
      if (scope === undefined) { line.release(); continue }
      const answer = await scopes.apply([{ scope, steps: line.steps, expects: line.base }])
      if (!('refused' in answer)) {
        line.release()
        said.put += 1
        continue
      }
      const over = answer.refused === SCOPE_MOVED ? await ontoNow(scopes, scope, line) : { put: 0, dropped: line.steps.length }
      line.release()
      if (over.dropped > 0) report?.(`a held change was not put back whole: ${answer.refused}, ${over.dropped} of ${line.steps.length} steps left out`)
      said.put += over.put
      said.dropped += over.dropped
    } catch (cause) {
      // Kept for the next open: a source that could not be asked now has not said no.
      report?.('a held change could not be put back', cause)
    }
  }
  return said
}

/** A line laid onto the scope as it is now: the steps that touch nothing changed since its base. */
async function ontoNow(scopes: Pick<ScopeRepository, 'apply' | 'state'>, scope: string, line: HeldSteps): Promise<Recovered> {
  const all = line.steps.length
  const now = line.touched ? await scopes.state(scope) : undefined
  if (!now || !line.touched) return { put: 0, dropped: all }
  const kept = stepsOntoNow(now, line.steps, line.touched)
  if (kept.length === 0) return { put: 0, dropped: all }
  const answer = await scopes.apply([{ scope, steps: kept, expects: now.revision }])
  return 'refused' in answer ? { put: 0, dropped: all } : { put: 1, dropped: all - kept.length }
}

/**
 * The steps of a held line that can go onto the scope as it is now: each in
 * turn, kept where it applies and every record it changes is either one the
 * line's base held as it is now or one a kept step of the line made.
 */
export function stepsOntoNow(now: ScopeState, steps: readonly ScopeStep[], touched: Readonly<Record<string, string | null>>): ScopeStep[] {
  const model = fromArrays(now.model)
  const theirs = new Set(Object.keys(touched).filter((key) => printOf(model, key) !== touched[key]))
  const kept: ScopeStep[] = []
  let content: ScopeState = now
  for (const step of steps) {
    const applied = applySteps(content, [step])
    if (!applied.ok || applied.records.some((record) => theirs.has(keyOf(record)))) continue
    kept.push(step)
    content = { ...content, ...applied.content }
  }
  return kept
}

/** A record's key in a held line. */
export function keyOf(record: RecordKey): string {
  return `${record.kind}:${record.id}`
}

/**
 * What a page holds beside its steps: each record that differs between the
 * model at the steps' base and the model now (`recordsChanged`, which compares
 * objects first, so it costs little on every change), with a print of it at
 * the base.
 */
export function touchedSince(base: Model, now: Model): Record<string, string | null> {
  return Object.fromEntries(recordsChanged(base, now).map((record) => [keyOf(record), printOf(base, keyOf(record))]))
}

/** A record's print as it is in this model, by its key in a held line; `null` where it is not there. */
function printOf(model: Model, key: string): string | null {
  const at = key.indexOf(':')
  const kind = key.slice(0, at)
  const id = key.slice(at + 1)
  if (kind === 'scope') return print(ownFields(model))
  const list = (RECORD_LISTS as Record<string, keyof Model>)[kind]
  if (list === undefined) return null
  const found = (model[list] as Record<string, unknown> | undefined)?.[id]
  return found === undefined ? null : print(found)
}

/** The model's fields that are no list of records and no order: the scope's own record, as `recordsChanged` reads it. */
function ownFields(model: Model): Record<string, unknown> {
  const lists = new Set<string>([...Object.values(RECORD_LISTS), 'order'])
  return Object.fromEntries(Object.entries(model).filter(([key]) => !lists.has(key)))
}

function print(value: unknown): string {
  return fingerprint([stableText(value)])
}
