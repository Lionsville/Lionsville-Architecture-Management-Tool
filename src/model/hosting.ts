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
import type { DesignElement, ElementId, PlatformArchetype, Relation } from './types'

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

// --- the platform tree (ADR-0014 §2.7) ---------------------------------------

/**
 * What the scope that defines a platform says about it, where this scope
 * holds only a stand-in: what it is filed under, what it is, and whether it
 * is the organisation's. All three are the owner's detail (ADR-0012 §3), so
 * all three come from the index by way of the host, and every reader that
 * walks the tree takes this beside the model. Absent in a shell with no
 * tree, and the walk then goes by whatever this scope holds itself.
 */
export type PlatformTree = {
  parentOf?(platformId: ElementId): ElementId | undefined
  archetypeOf?(platformId: ElementId): PlatformArchetype | undefined
  outsideOf?(platformId: ElementId): boolean | undefined
}

/** What a platform is filed under: its own record's answer, or the tree's. */
export function platformParentOf(
  platform: Pick<DesignElement, 'id' | 'parentId'>,
  tree: PlatformTree = {},
): ElementId | undefined {
  return platform.parentId ?? tree.parentOf?.(platform.id)
}

/**
 * The platforms this one sits in, nearest first and outermost last — the
 * chain every reader walks (ADR-0014 §2.7): the report's *stands on*, the
 * retirement a container inherits, the root the landscape is coloured by.
 * Only platforms, only ones this scope holds, and a loop stops itself.
 */
export function ancestorPlatforms(
  elements: readonly DesignElement[],
  platformId: ElementId,
  tree: PlatformTree = {},
): DesignElement[] {
  const byId = new Map(elements.map((element) => [element.id, element]))
  const chain: DesignElement[] = []
  const seen = new Set<ElementId>([platformId])
  let held = byId.get(platformId)
  while (held?.kind === 'platform') {
    const up = platformParentOf(held, tree)
    if (up === undefined || seen.has(up)) break
    seen.add(up)
    held = byId.get(up)
    if (held?.kind === 'platform') chain.push(held)
  }
  return chain
}

/**
 * Every platform filed under this one, at any depth, in the model's own
 * order. Read by walking each platform's chain upward rather than by
 * children, because a stand-in carries no `parentId` and the tree's answer
 * is per platform, upward.
 */
export function descendantPlatforms(
  elements: readonly DesignElement[],
  platformId: ElementId,
  tree: PlatformTree = {},
): DesignElement[] {
  return elements.filter((element) => (
    element.kind === 'platform' && element.id !== platformId
    && ancestorPlatforms(elements, element.id, tree).some((above) => above.id === platformId)
  ))
}

/**
 * The coarse answer to where something runs: the outermost platform the
 * organisation runs, for each place its containers sit (ADR-0014 §2.7).
 *
 * A namespace sits in a cluster sits in a cloud account, and the landscape is
 * coloured by the cluster: the namespace is the precise place, which the
 * record and the deployment boxes keep, and the account is somebody else's —
 * so the walk stops at the last platform that is not `outside`, and only a
 * chain that is outside throughout answers with its top. Once each, in the
 * order the precise places were in.
 */
export function rootPlatformsOf(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  elementId: ElementId,
  tree: PlatformTree = {},
): ElementId[] {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const outside = (platform: DesignElement) => platform.outside === true || tree.outsideOf?.(platform.id) === true
  const roots: ElementId[] = []
  for (const id of hostingOf(model, elementId).platformIds) {
    const held = byId.get(id)
    if (!held) { if (!roots.includes(id)) roots.push(id); continue }
    const chain = [held, ...ancestorPlatforms(model.elements, id, tree)]
    const ours = chain.filter((platform) => !outside(platform))
    const root = (ours.length > 0 ? ours : chain)[(ours.length > 0 ? ours : chain).length - 1]
    if (!roots.includes(root.id)) roots.push(root.id)
  }
  return roots
}
