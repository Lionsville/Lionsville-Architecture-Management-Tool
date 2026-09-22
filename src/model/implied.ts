// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The interface a container line implies when it refines nothing
 * (ADR-0013, redone).
 *
 * Work does not always start at the top. Somebody draws the container diagram
 * first, joins their API to another application's, and the landscape never
 * hears about it — so the model computes what those lines add up to: one
 * application interface per pair of applications with unrefined container
 * lines between them.
 *
 * **Nothing is written, and nothing is drawn.** An implied interface is not a
 * row, and the landscape does not draw a ghost of one: a line nobody agreed to
 * is exactly the clutter this step exists to remove, and a picture that shows
 * what might be true teaches a reader to distrust the rest of it. It is a
 * finding instead, with an *Accept* that writes the real line and lands every
 * container line on it as one step.
 *
 * Pure, so the roadmap's page, the agent's `roadmap.check` and the accept
 * itself all read the same answer.
 */
import { transaction } from './commands'
import type { Command } from './commands'
import { applicationOf, isContainerLine } from './refines'
import type { Held } from './refines'
import type { ElementId, Relation } from './types'

export type ImpliedInterface = {
  /** The two applications, in the direction the first container line runs. */
  sourceId: ElementId
  targetId: ElementId
  /** Both ways: a bidirectional landing, or landings running each way. */
  isBidirectional: boolean
  /** The container lines that add up to it, in the order the model holds them. */
  relations: Relation[]
}

/** One row per pair, whichever way its lines run. */
const pairKey = (a: ElementId, b: ElementId) => JSON.stringify([a, b].sort())

/**
 * Every interface the container lines imply, in the order the first line of
 * each was written.
 *
 * A pair is one entry however many lines run between it and whichever way
 * they run — the union of the directions, which is what an accepted line has
 * to carry to be true of all of them. A line inside one application implies
 * nothing: two containers of the same application talking to each other is
 * the container diagram's own business and never an interface.
 */
export function impliedInterfaces(relations: readonly Relation[], held: Held): ImpliedInterface[] {
  const byPair = new Map<string, ImpliedInterface>()
  for (const relation of relations) {
    if (relation.refines !== undefined) continue
    if (!isContainerLine(relation, held)) continue
    const source = applicationOf(relation.sourceId, held)
    const target = applicationOf(relation.targetId, held)
    if (source === target) continue
    const found = byPair.get(pairKey(source, target))
    if (!found) {
      byPair.set(pairKey(source, target), {
        sourceId: source,
        targetId: target,
        isBidirectional: relation.isBidirectional === true,
        relations: [relation],
      })
      continue
    }
    found.relations.push(relation)
    // The union: another line the other way, or one that says both, makes the
    // interface both. The direction of the first line is the one an accepted
    // one-way line is drawn in.
    if (relation.isBidirectional === true || found.sourceId !== source) found.isBidirectional = true
  }
  return [...byPair.values()]
}


/**
 * Accepting one: the application interface written, and every container line
 * landed on it, as ONE step.
 *
 * The label is the first one any of the container lines carries — somebody has
 * already said what flows there, and asking again would be asking twice — and
 * the two names otherwise, which is at least true.
 */
export function acceptImplied(
  implied: ImpliedInterface,
  id: string,
  nameOf: (elementId: ElementId) => string,
): Command {
  const said = implied.relations.find((row) => row.label !== undefined && row.label !== '')?.label
  const label = said ?? `${nameOf(implied.sourceId)} → ${nameOf(implied.targetId)}`
  return transaction([
    {
      type: 'relation.create',
      relation: {
        id,
        type: 'flow',
        sourceId: implied.sourceId,
        targetId: implied.targetId,
        label,
        ...(implied.isBidirectional ? { isBidirectional: true } : {}),
      },
    },
    // After the line exists: the writer refuses a landing on a row that is not
    // there, and would be right to.
    ...implied.relations.map((row) => ({
      type: 'relation.update' as const,
      id: row.id,
      patch: { refines: id },
    })),
  ])
}
