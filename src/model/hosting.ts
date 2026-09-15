/**
 * What an application runs on, read off its containers (ADR-0013, redone).
 *
 * Hosting is a container-level fact. An application is not deployed anywhere —
 * the things it is made of are, and usually on more than one place: the API in
 * a namespace, the database on the cluster itself. Asking the question on the
 * application therefore got an answer somebody had to keep true by hand, and
 * kept it true by not changing it.
 *
 * So the row is written from the container and the application's answer is the
 * roll-up. The exception is an application with no containers at all — an
 * outside system, a SaaS service, a bought package — which has nothing to roll
 * up and says where it runs itself; a vendor-hosted service saying "hosted by
 * the vendor" is a true sentence and the only one anybody can write about it.
 *
 * Pure, and the one answer three readers share: the badge on the card, the
 * retiring-platform finding, and the record's *Runs on* line.
 */
import type { DesignElement, ElementId, Relation } from './types'

/** The containers filed under an application, in the order the model holds them. */
export function containersOf(
  elements: readonly DesignElement[],
  applicationId: ElementId,
): DesignElement[] {
  return elements.filter((element) => element.kind === 'component' && element.parentId === applicationId)
}

/**
 * Whether this element may carry a `hostedOn` row of its own.
 *
 * A container always may. An application may only when it has no containers:
 * with any, its hosting is theirs, and a row beside them would be a second
 * answer to one question — which is exactly what this change exists to stop.
 */
export function mayBeHosted(
  elements: readonly DesignElement[],
  elementId: ElementId,
): boolean {
  const element = elements.find((held) => held.id === elementId)
  if (element === undefined) return true
  if (element.kind !== 'application') return true
  return containersOf(elements, elementId).length === 0
}

export type Hosting = {
  /** The platforms it stands on, by id, without repeats and in row order. */
  platformIds: ElementId[]
  /** Where the answer came from: its containers, or its own row. */
  from: 'containers' | 'itself'
  /** How many containers stand on something — what *Runs on* counts. */
  containers: number
}

/**
 * Where this application runs: the union of its containers' places, or its own
 * where it has no containers.
 *
 * Answered for a container too, which is simply its own rows — so a caller
 * with an id and no interest in which of the two it has can just ask.
 */
export function hostingOf(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  elementId: ElementId,
): Hosting {
  const element = model.elements.find((held) => held.id === elementId)
  const own = () => [...new Set(model.relations
    .filter((row) => row.type === 'hostedOn' && row.sourceId === elementId)
    .map((row) => row.targetId))]
  if (element?.kind !== 'application') {
    return { platformIds: own(), from: 'itself', containers: 0 }
  }
  const containers = containersOf(model.elements, elementId)
  if (containers.length === 0) {
    return { platformIds: own(), from: 'itself', containers: 0 }
  }
  const held = new Set(containers.map((container) => container.id))
  const ids: ElementId[] = []
  const standing = new Set<ElementId>()
  for (const row of model.relations) {
    if (row.type !== 'hostedOn' || !held.has(row.sourceId)) continue
    standing.add(row.sourceId)
    if (!ids.includes(row.targetId)) ids.push(row.targetId)
  }
  return { platformIds: ids, from: 'containers', containers: standing.size }
}
