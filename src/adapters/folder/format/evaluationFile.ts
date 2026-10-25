// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's evaluations of building blocks, as files (ADR-0043 §4, §13): one
 * file per block the scope evaluates, named by the block.
 *
 * ```
 * _evaluations/<block-scope>~<block-id>.json   the block's contexts here, the options, the balls, the choice
 * ```
 *
 * The block's scope is written with dots for its slashes and `-` for the
 * organisation (`model/evaluation.evaluationId`), so the name is one segment
 * and says which block without opening the file. **Why the underscore**, as
 * `_comments/` says: a child scope's folder name is a slug and cannot hold one.
 *
 * Forgiving in one direction, as the other codecs are: a file whose name is
 * not a block's, or whose block does not agree with its name, is passed over,
 * and a ball that is not a level is read as not covered; a file that is not
 * an object is said, so the scope opens to be read and not written.
 */
import { isBlockLevel } from '../../../model/buildingBlock'
import { blockOfEvaluationId, evaluationId } from '../../../model/evaluation'
import type { Coverage, Evaluation } from '../../../model/evaluation'
import type { HostModel } from '../../../model/hostModel'
import { parseJson, stableJson } from '../../../projects/text'

/** The folder the evaluations are kept in. Not a slug, so never a scope's name. */
export const EVALUATIONS_FOLDER = '_evaluations'

const FILE = /^_evaluations\/([^/]+)\.json$/

/** The file an evaluation is kept in. */
export function evaluationPath(evaluation: Pick<Evaluation, 'id'>): string {
  return `${EVALUATIONS_FOLDER}/${encodeURIComponent(evaluation.id)}.json`
}

/** The evaluation a file is, by its name; nothing for a path that is not one. */
function idOf(path: string): string | undefined {
  const match = FILE.exec(path)
  if (!match) return undefined
  try {
    const id = decodeURIComponent(match[1])
    return blockOfEvaluationId(id) ? id : undefined
  } catch {
    return undefined
  }
}

export function isEvaluationPath(path: string): boolean {
  return idOf(path) !== undefined
}

/** The evaluations' files, one per block evaluated. */
export function evaluationFiles(model: Pick<HostModel, 'evaluations'>): { path: string; text: string }[] {
  return (model.evaluations ?? []).map((evaluation) => {
    const { id: _id, ...kept } = evaluation
    void _id
    return { path: evaluationPath(evaluation), text: stableJson(kept) }
  })
}

function objectIn(text: string): Record<string, unknown> | undefined {
  const held = parseJson(text)
  return held && typeof held === 'object' && !Array.isArray(held) ? held as Record<string, unknown> : undefined
}

/** Whether an evaluation's file is there and is not an object — the file a save must not write over. */
export function evaluationFileUnreadable(text: string | undefined): boolean {
  return text !== undefined && objectIn(text) === undefined
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && one !== '') : [])

/** The balls, read forgivingly: a row that is not an object goes, a ball off the levels reads as not covered. */
function coverageOf(value: unknown): Record<string, Record<string, Coverage>> {
  const out: Record<string, Record<string, Coverage>> = {}
  if (!value || typeof value !== 'object') return out
  for (const [sbb, row] of Object.entries(value as Record<string, unknown>)) {
    if (!row || typeof row !== 'object') continue
    out[sbb] = {}
    for (const [capability, cell] of Object.entries(row as Record<string, unknown>)) {
      const held = (cell ?? {}) as Record<string, unknown>
      const how = typeof held.how === 'string' && held.how.trim() ? held.how : undefined
      out[sbb][capability] = { level: isBlockLevel(held.level) ? held.level : 0, ...(how ? { how } : {}) }
    }
  }
  return out
}

function evaluationOf(id: string, text: string | undefined): Evaluation | undefined {
  const held = text === undefined ? undefined : objectIn(text)
  const block = held?.block as Record<string, unknown> | undefined
  if (!held || typeof block?.id !== 'string') return undefined
  // The organisation's path is the empty string, which a hand-edited file may leave out.
  const said = { scope: typeof block.scope === 'string' ? block.scope : '', id: block.id }
  if (evaluationId(said) !== id) return undefined
  const options = [...new Set(strings(held.options))]
  const chosen = typeof held.chosen === 'string' && options.includes(held.chosen) ? held.chosen : undefined
  const decidedBy = typeof held.decidedBy === 'string' && held.decidedBy ? held.decidedBy : undefined
  return {
    id, block: said, contexts: strings(held.contexts), options, coverage: coverageOf(held.coverage),
    ...(chosen !== undefined ? { chosen } : {}),
    ...(decidedBy !== undefined ? { decidedBy } : {}),
  }
}

/** The evaluations out of their files, in path order. */
export function evaluationsFrom(paths: readonly string[], textAt: (path: string) => string | undefined): Pick<HostModel, 'evaluations'> {
  const evaluations = [...paths].filter(isEvaluationPath).sort()
    .map((path) => evaluationOf(idOf(path)!, textAt(path)))
    .filter((one): one is Evaluation => one !== undefined)
  return evaluations.length ? { evaluations } : {}
}
