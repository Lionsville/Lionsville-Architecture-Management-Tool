// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the move screen reads off the tree before anybody presses Move
 * (ADR-0038 §5): the scopes it offers, nearest first and each by its path;
 * why Move cannot be pressed; and, after it was, where the move went, in
 * words.
 *
 * Pure. What a move writes is `planMove`'s (`move.ts`); this file only reads.
 */
import type { StringKey, Translate } from '../i18n/strings'
import { matchesQuery } from '../model/textSearch'
import type { ScopeAnalysis } from '../model/observation'
import type { AcrossOutcome } from './mergeScreen'
import { nearestFirst } from './mergeScreen'
import type { MovePlan, ObservationMoveRefusal } from './move'

/** One scope the screen offers: its path, what it is called there, and why it cannot be picked. */
export type MoveTarget = {
  path: string
  /** Its path from the organisation down, each scope by its name (`scopeTrail`). */
  name: string
  /** Why it cannot be picked: its scope may be read and not changed. */
  closed?: string
}

/**
 * The scopes an observation of `here` may be moved to: every other scope
 * given, nearest first, matched on what they are called by every word of
 * `query`. One the person may read and not change is offered, and says why it
 * cannot be picked (ADR-0035 §2).
 */
export function moveTargets(o: {
  paths: readonly string[]
  here: string
  query: string
  trail: (path: string) => string
  writable: (path: string) => boolean
  t: Translate
}): MoveTarget[] {
  return nearestFirst([...new Set(o.paths)].filter((path) => path !== o.here), o.here)
    .map((path) => ({ path, name: o.trail(path) }))
    .filter((one) => matchesQuery(o.query, [one.name, one.path]))
    .map((one) => (o.writable(one.path) ? one : { ...one, closed: o.t('observation.mergeNotYoursRow', { scope: one.name }) }))
}

/** Every scope read, and an empty one for each scope the tree lists that holds no analysis yet: what a move plans over. */
export function withEveryScope(scopes: readonly ScopeAnalysis[], paths: readonly string[]): ScopeAnalysis[] {
  const held = new Set(scopes.map((one) => one.scope))
  return [
    ...scopes,
    ...paths.filter((path) => !held.has(path)).map((scope) => ({ scope, observations: [], causes: [], solutions: [], experiments: [] })),
  ]
}

/** Why a move is refused, in words. */
export const MOVE_REFUSAL: Record<ObservationMoveRefusal, StringKey> = {
  sameScope: 'observation.moveSameScope',
  missing: 'observation.moveMissing',
  merged: 'observation.moveMerged',
  moved: 'observation.moveMoved',
  archived: 'observation.moveArchived',
  unknownScope: 'observation.moveUnknownScope',
  taken: 'observation.moveTaken',
}

/**
 * Why Move cannot be pressed, in words, or nothing where it can: nothing may
 * be written from here; no scope picked; the plan refuses; one of the two
 * scopes may be read and not changed (a courtesy — the storage refuses it
 * anyway); or only this scope may be written from here.
 */
export function moveBlocked(o: {
  plan: MovePlan | undefined
  here: string
  target: string | undefined
  readOnly: boolean
  /** Another scope may be written from here. */
  across: boolean
  writable: (path: string) => boolean
  trail: (path: string) => string
  t: Translate
}): string | undefined {
  const { plan, t } = o
  if (o.readOnly) return t('observation.moveReadOnly')
  if (o.target === undefined || !plan) return t('observation.movePick')
  if (!plan.ok) return t(MOVE_REFUSAL[plan.refusal])
  const closed = [o.here, o.target].find((path) => !o.writable(path))
  if (closed !== undefined) return t('observation.moveNotYours', { scope: o.trail(closed) })
  if (!o.across) return t('observation.moveNotFromHere')
  return undefined
}

/** Where a move went, said after it (ADR-0038 §5): where it is now and under which number, or why nothing moved. */
export function moveNote(result: AcrossOutcome, moved: { label: string; scope: string }, scopeLabel: (path: string) => string, t: Translate): string {
  if (result.ok) {
    const said = t('observation.movedNote', moved)
    return result.unsaved ? `${said} ${t('observation.mergedUnsaved')}` : said
  }
  if (result.reason === 'partial' && 'changed' in result) {
    return t('observation.movedPartial', { scopes: result.changed.map(scopeLabel).join(', ') })
  }
  if (result.reason === 'refused' && 'refused' in result) {
    const key = MOVE_REFUSAL[result.refused as ObservationMoveRefusal] as StringKey | undefined
    return t('observation.moveNotMadeWhy', { why: key ? t(key) : result.refused })
  }
  if (result.reason === 'shell.scopeReadOnly') {
    const scope = 'scope' in result ? result.scope : undefined
    return scope !== undefined ? t('observation.moveNotMadeYours', { scope: scopeLabel(scope) }) : t('observation.moveNotMade')
  }
  if (result.reason === 'shell.scopeMoved') return t('observation.moveNotMadeMoved')
  if (result.reason === 'gone') return t('observation.moveNotMadeWhy', { why: t('observation.moveUnknownScope') })
  if (result.reason.startsWith('command.')) return t('observation.moveNotMadeWhy', { why: t(result.reason as StringKey) })
  return t('observation.moveNotMade')
}
