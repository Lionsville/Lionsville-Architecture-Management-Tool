/**
 * A replacement as one gesture (ADR-0010).
 *
 * Starting a migration touches a dozen things: the new application, drawn
 * beside the old on every board the old is on; the dates on both; who
 * replaces whom; the tap that feeds the new one during the shadow run; and
 * the plan that names all of it, with its two milestones and a body to write
 * the business case into. It is one thing that happened, so it is one
 * transaction here and one undo step there.
 *
 * Three inputs and no more: what goes (or sheds part of itself), what
 * arrives, and the two days. Which interface moves when is *not* asked —
 * that is the work, and `porting.ts` is where it is written afterwards.
 *
 * ## The tap
 *
 * During the shadow run the interfaces still terminate on the old
 * application; the new one sees the same data by tapping the old. So the tap
 * runs old → new, is one line rather than a twin per interface, and ends the
 * day before cutover whatever the port table says — cutover is the day the
 * old one is *gone*, and a line valid on a day its end is gone is the first
 * thing the checks would report.
 *
 * The words — the plan's title, the tap's label, the milestones, the body —
 * come in as arguments, because this file is the model and the model knows
 * no language.
 */
import { placeOn } from './commands'
import type { Command } from './commands'
import { placedNode, placementRect } from './placement'
import { addDays } from './transition'
import type { Transition, TransitionRole } from './transition'
import type { DesignElement, DesignModel, ElementId, PlacedNode, Relation } from './types'

/** How far to the right of the original the new one is drawn. */
const GAP = 40

export type ReplacementRequest = {
  /** What the plan moves interfaces off: `retires` when it goes, `changes` when it stays (a split). */
  from: { elementId: ElementId; role: Extract<TransitionRole, 'retires' | 'changes'> }[]
  /** What arrives: an element that exists, or one to make in the image of the first source. */
  to: { elementId: ElementId } | { name: string }
  /** The shadow run: the new one live, the old ones retiring, the tap open. `yyyy-mm-dd`. */
  shadowFrom: string
  /** The day the old ones are gone and the tap closes. */
  cutover: string
  words: {
    planTitle: string
    tapLabel: string
    shadowMilestone: string
    cutoverMilestone: string
    body: string
    owner?: string
  }
}

export type ReplacementIds = {
  element(name: string): ElementId
  connection(): string
  transition: string
}

export type Replacement = {
  commands: Command[]
  planId: string
  /** The introduced element, whether made here or already there. */
  toId: ElementId
}

/** Everything the gesture writes, as one transaction. */
export function replacementCommands(
  model: DesignModel,
  request: ReplacementRequest,
  ids: ReplacementIds,
  planNumber: number,
): Replacement {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const sources = request.from.map((one) => byId.get(one.elementId)).filter((e): e is DesignElement => Boolean(e))
  const first = sources[0]
  const commands: Command[] = []

  // --- what arrives -----------------------------------------------------------
  let toId: ElementId
  if ('elementId' in request.to) {
    toId = request.to.elementId
    // An element that exists keeps its dates unless it has none: a person
    // who dated it already said when it goes live.
    const to = byId.get(toId)
    if (to && !to.lifecycleDates?.live) {
      commands.push({ type: 'element.update', id: toId, patch: { lifecycleDates: { ...to.lifecycleDates, live: request.shadowFrom } } })
    }
  } else {
    toId = ids.element(request.to.name)
    const seed = first
    const element: DesignElement = {
      id: toId,
      kind: seed?.kind ?? 'application',
      name: request.to.name,
      lifecycle: 'planned',
      lifecycleDates: { live: request.shadowFrom },
      isManaged: seed?.isManaged ?? true,
      aspects: {},
      ...(seed?.category !== undefined ? { category: seed.category } : {}),
      ...(seed?.parentId !== undefined ? { parentId: seed.parentId } : {}),
    }
    commands.push({ type: 'element.create', element })
    // Beside the original on every board the original is on, in the same
    // zone and group, so it appears where a reader will look for it.
    if (seed) {
      for (const diagram of model.diagrams) {
        const held = placedNode(diagram, seed.id)
        if (!held) continue
        const rect = placementRect(seed.kind, held)
        const placement: PlacedNode = {
          id: toId,
          x: rect.x + rect.width + GAP,
          y: rect.y,
          ...(held.zone !== undefined ? { zone: held.zone } : {}),
          ...(held.group !== undefined ? { group: held.group } : {}),
        }
        commands.push(placeOn(diagram.id, [placement]))
      }
    }
  }

  // --- what goes, and the tap from each ---------------------------------------
  for (const one of request.from) {
    const source = byId.get(one.elementId)
    if (!source) continue
    if (one.role === 'retires') {
      commands.push({
        type: 'element.update',
        id: source.id,
        patch: {
          lifecycleDates: { ...source.lifecycleDates, retiring: request.shadowFrom, retired: request.cutover },
          successorId: toId,
        },
      })
    }
    const tap: Relation = {
      id: ids.connection(),
      type: 'flow',
      sourceId: source.id,
      targetId: toId,
      label: request.words.tapLabel,
      isBidirectional: false,
      lineStyle: 'dashed',
      validFrom: request.shadowFrom,
      validUntil: addDays(request.cutover, -1),
    }
    commands.push({ type: 'relation.create', relation: tap })
  }

  // --- the plan ---------------------------------------------------------------
  const transition: Transition = {
    id: ids.transition,
    number: planNumber,
    title: request.words.planTitle,
    status: 'draft',
    from: request.shadowFrom,
    to: request.cutover,
    ...(request.words.owner ? { owner: request.words.owner } : {}),
    elements: [
      ...request.from.filter((one) => byId.has(one.elementId)),
      { elementId: toId, role: 'introduces' },
    ],
    decisions: [],
    milestones: [
      { date: request.shadowFrom, name: request.words.shadowMilestone },
      { date: request.cutover, name: request.words.cutoverMilestone },
    ],
    body: request.words.body,
  }
  commands.push({ type: 'transition.add', transition })

  return { commands, planId: transition.id, toId }
}
