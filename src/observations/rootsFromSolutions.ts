// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An analysis kept before a root cause was said, as it reads now (ADR-0032 §9).
 *
 * Before ADR-0032 a root cause was derived: a cause nothing explained. Now it
 * is said, `root: true`, and data kept before says nothing. What it meant is
 * the domain's to answer, once, so every place that keeps work answers it the
 * same way — the folder for a folder written before format 9, browser storage
 * and memory for a content kept at their format 1, and a source elsewhere for
 * whatever it kept before. Where the data is older is each one's own business;
 * what older data meant is this.
 *
 * **A cause that a live solution addresses reads as a root cause**, because a
 * solution addressed root causes only (ADR-0026) and that one was what it
 * addressed. **Nothing else becomes one**: a cause that was a root only for
 * want of a deeper cause reads as an open end, which is what it was.
 *
 * **But not one that another cause of its own scope explains.** The writer
 * refuses a root cause somebody explains (`command.rootExplained`), so such a
 * cause stays a cause, and the solution's link to it stays as it was: a
 * solution that addresses no root cause is what its record's question
 * `worksAround` already asks about (`solution.ts`, ADR-0026). A cause of a scope above that explains it
 * does not count, as it does not for the writer. So every place work is kept
 * reads the same data to the same roots, and none to a root its writer would
 * refuse.
 *
 * **`shared` is dropped** from an observation that carries it: nothing is
 * shared any more (§1). The `shared` and `unshared` events stay in its
 * history, as history.
 *
 * Over data that already says its roots it changes nothing a writer would
 * have let stand: a live solution addresses root causes only.
 */
import type { Cause, Observation, Solution } from '../model/observation'
import { isLive } from './solution'

/** The part of a model this reads: the lists of the analysis, any of them absent. */
export type AnalysisKept = {
  readonly observations?: readonly Observation[]
  readonly causes?: readonly Cause[]
  readonly solutions?: readonly Solution[]
}

/** An observation as kept before ADR-0032, which may say it was shared. */
type SharedBefore = Observation & { shared?: unknown }

export function rootsFromSolutions<M extends AnalysisKept>(model: M): M {
  const addressed = new Set((model.solutions ?? []).filter(isLive).flatMap((one) => one.addresses.map((address) => address.id)))
  // What a cause of this scope explains, as the writer reads it: a link that names no scope.
  const explained = new Set((model.causes ?? []).flatMap((one) => one.explains
    .filter((link) => link.scope === undefined && link.id !== one.id).map((link) => link.id)))
  const causes = model.causes?.map((one) => (
    addressed.has(one.id) && !explained.has(one.id) && one.root !== true ? { ...one, root: true as const } : one
  ))
  const observations = (model.observations as readonly SharedBefore[] | undefined)?.map((one) => {
    if (!Object.hasOwn(one, 'shared')) return one
    const { shared: _shared, ...rest } = one
    return rest
  })
  return {
    ...model,
    ...(causes ? { causes } : {}),
    ...(observations ? { observations } : {}),
  }
}
