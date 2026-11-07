// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One principle absorbing others of its scope, as the commands of one step
 * (ADR-0041 §6), said once for the page and the agent: the survivor as the merge
 * leaves it, each absorbed one kept with `mergedInto`, and what this scope says of
 * them brought along: its citations, under the aspect's new number and once each
 * where the survivor is already cited the same way, and their comments.
 *
 * A citation in another scope is that scope's to write, and no step of this one
 * can: {@link PrincipleMerge.citedElsewhere} is for the caller to ask about first
 * (`check.citationGone` says it afterwards). Pure.
 */
import { carryThread } from '../comments/travel'
import type { Citation } from '../model/citable'
import type { Command } from '../model/commands'
import { commentsToCommands } from '../model/commands'
import { citationList, commentList, principlesOf } from '../model/normalised'
import type { Model } from '../model/normalised'
import { mergePrinciples } from '../model/principle'
import type { PrincipleId } from '../model/principle'

export type PrincipleMerge = {
  commands: Command[]
  /** Each absorbed aspect's number before and after, for what is said about it. */
  renumbered: { from: PrincipleId; aspect: number; now: number }[]
}

/** The step, or nothing where there is no such survivor or nothing to absorb. */
export function principleMerge(model: Model, scope: string, into: PrincipleId, from: readonly PrincipleId[]): PrincipleMerge | undefined {
  const held = principlesOf(model)
  const survivor = held[into]
  const absorbed = [...new Set(from)].filter((id) => id !== into).flatMap((id) => (held[id] ? [held[id]] : []))
  if (!survivor || absorbed.length === 0) return undefined
  const merged = mergePrinciples(survivor, absorbed)
  const commands: Command[] = [
    { type: 'principle.update', id: into, patch: merged.survivor },
    ...merged.absorbed.map((one): Command => ({ type: 'principle.update', id: one.id, patch: { mergedInto: into } })),
  ]
  const leaving = new Set(absorbed.map((one) => one.id))
  const here = (citation: Citation) => citation.principle.scope === scope
  const key = (citation: Pick<Citation, 'about' | 'stance' | 'aspect'>) => JSON.stringify([citation.about.kind, citation.about.id, citation.stance, citation.aspect ?? null])
  const taken = new Set(citationList(model).filter((one) => here(one) && one.principle.id === into).map(key))
  for (const citation of citationList(model)) {
    if (!here(citation) || !leaving.has(citation.principle.id)) continue
    const now = citation.aspect === undefined ? undefined
      : merged.renumbered.find((one) => one.from === citation.principle.id && one.aspect === citation.aspect)?.now
    const carried = { ...citation, ...(now !== undefined ? { aspect: now } : {}) }
    if (taken.has(key(carried))) {
      commands.push({ type: 'citation.remove', id: citation.id })
      continue
    }
    taken.add(key(carried))
    commands.push({ type: 'citation.update', id: citation.id, patch: { principle: { scope, id: into }, ...(now !== undefined ? { aspect: now } : {}) } })
  }
  let comments = commentList(model)
  for (const one of absorbed) {
    comments = carryThread({ scope, comments }, { scope, comments }, { kind: 'principle', id: one.id }, { kind: 'principle', id: into }).to
  }
  commands.push(...commentsToCommands(model, comments))
  return { commands, renumbered: merged.renumbered }
}
