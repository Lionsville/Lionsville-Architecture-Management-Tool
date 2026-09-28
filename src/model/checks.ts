// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the dates contradict (ADR-0009).
 *
 * A landscape with dates on it can be wrong in ways a landscape without them
 * cannot. The four below are the ones that cost money: something retires with
 * things still hanging off it, a replacement that lands after the thing it
 * replaces has gone, a line that outlives one of its ends, and a plan whose
 * window closed while it was still running.
 *
 * **They catch contradictions, never staleness.** Nothing here can tell that a
 * landscape is out of date — only that it disagrees with itself. A project
 * nobody has touched for a year will pass every one of these and still be
 * fiction, and no check can be written that would say so. ADR-0009 says this
 * out loud as an accepted cost, and it is repeated here because the list
 * looking thorough is exactly what would make somebody trust it too far.
 *
 * Pure and node-tested, and deliberately not part of the reducer: a landscape
 * mid-edit disagrees with itself constantly, and a model that refused to hold a
 * contradiction would refuse the keystroke in the middle of typing a date.
 *
 * In `model/` and not in `roadmap/` beside the page that draws them, because
 * the import matrix said so and was right: an agent asks for these too
 * (`roadmap.check`), and `agent` may not see `roadmap`. They are arithmetic
 * over a landscape, which is what this module is for.
 */
import { isDay, phaseAt } from './lifecycle'
import { ancestorPlatforms } from './hosting'
import type { PlatformTree } from './hosting'
import { impliedInterfaces } from './implied'
import { livenessOf } from './liveness'
import type { Liveness } from './liveness'
import { isFlow, isTechnologyRelation } from './relations'
import { addDays, isTransitionFinished } from './transition'
import type { Transition } from './transition'
import type { DesignElement, DesignModel, ElementId, Relation, RelationType } from './types'

export type FindingKind =
  /** Something retires while things are still connected to it. */
  | 'retiresWithDependants'
  /** Its replacement does not go live until after it is gone. */
  | 'successorTooLate'
  /** It retires and nothing is named to replace it. */
  | 'successorMissing'
  /** A line is still valid on a day one of its ends is retired. */
  | 'lineOutlivesEnd'
  /**
   * What it runs on or uses retires before it does (ADR-0013): the technology
   * risk every portfolio tool sells, over dates the model already has. On the
   * element that is left standing on nothing — an application by way of the
   * roll-up over its containers, a container by its own row.
   */
  | 'platformRetiresFirst'
  /**
   * Container interfaces run between two applications with no application
   * interface written for them (ADR-0013, redone): work that started at the
   * container diagram and never reached the landscape. Offered with an
   * *Accept* that writes the line and lands every one of them on it.
   */
  | 'impliedInterface'
  /** A plan is still running after the day it was due to end. */
  | 'planOverdue'

/**
 * What a finding is about. `relation` since ADR-0012 §5 — a row between two
 * things is not always a connection, and a page that clicks through to one
 * needs to know which list to look in, not what to call it.
 */
export type FindingSubject = 'element' | 'relation' | 'transition'

export type Finding = {
  kind: FindingKind
  subject: FindingSubject
  /** What it is about; what a click on the row should open. */
  id: string
  /** What that thing is called. */
  name: string
  /** The other thing the sentence names — a successor, a neighbour, a day. */
  detail?: string
  /** How many, where the finding is about several. */
  count?: number
  /**
   * For a `relation` subject: which kind of row it was (ADR-0012 §5), so the
   * sentence can say *supports* where it means supports. The key its label is
   * under lives in `model/relations.RELATION_LABEL`; this is the fact.
   */
  relationType?: RelationType
}

export type CheckContext = {
  model: Pick<DesignModel, 'elements' | 'relations'> & { transitions?: Transition[] }
  /** The day "now" is, so a test is not at the mercy of the clock. */
  today: string
  /**
   * The platform tree where this scope holds stand-ins (ADR-0014 §2.7): a
   * container in a namespace goes when the cluster goes, and the namespace
   * drawn here carries no `parentId` of its own — nor a retirement date,
   * which the tree's `retiredOf` says for it (ADR-0012 §3, `liveness.ts`).
   */
  platformTree?: PlatformTree
}

/** The day an element is gone, if it has one. */
function retiredOn(element: DesignElement): string | undefined {
  const day = element.lifecycleDates?.retired
  return isDay(day) ? day : undefined
}

/** What every finding below reads: the model, by id, and the rules over it. */
type Reading = {
  model: CheckContext['model']
  byId: Map<ElementId, DesignElement>
  live: Liveness
  tree: PlatformTree
  today: string
}

/**
 * The rows that depend on something retiring, on the day it goes.
 *
 * **What counts as depending on it** (ADR-0012 §5, ADR-0013):
 *
 * - a `flow`, either way — an interface is plugged in at both ends;
 * - a `uses` or `hostedOn` row where the retiring thing is the platform or
 *   service being stood on.
 *
 * And nothing else. Its own `uses` and `hostedOn` go with it; the other way
 * round — a platform retiring under a thing still on it — is
 * `platformRetiresFirst`'s. `assigned` says who answers for a thing, and a
 * team does not depend on what it is responsible for. `supports`, `serves` and
 * `realises` say what covers or delivers a capability or a service: one left
 * without it is a gap the enterprise map (ADR-0012 §9) and the service
 * report's *realised by* show on their day, and a function retiring out from
 * under an application that supports it strands nothing.
 *
 * **Its containers are it.** A line into a container of a retiring
 * application — landed or not — is a line into the application, so it counts.
 * **One interface counts once**: a landing and the application line it
 * refines are one interface said twice, and so are two landings of it.
 */
function dependantsOf(element: DesignElement, gone: string, { byId, live, model }: Reading): number {
  const ours = (id: ElementId) => {
    if (id === element.id) return true
    const held = byId.get(id)
    return held?.kind === 'component' && held.parentId === element.id
  }
  const theDayBefore = addDays(gone, -1)
  const counted = new Set<string>()
  for (const relation of model.relations) {
    const far = farEnd(relation, element.id, ours)
    if (far === undefined) continue
    const near = far === relation.sourceId ? relation.targetId : relation.sourceId
    // A row with its own window that closes in time is the correct answer to
    // this problem, not an instance of it — and a row whose other end goes by
    // then goes with it.
    if (!live.windowHolds(relation, gone) || live.goneOn(far, gone)) continue
    // A container of ours that was gone before we were took its lines with it.
    if (near !== element.id && live.goneOn(near, theDayBefore)) continue
    counted.add(relation.refines ?? relation.id)
  }
  return counted.size
}

/** The far end of a row that depends on this thing, by the list above; `undefined` for any other row. */
function farEnd(relation: Relation, id: ElementId, ours: (id: ElementId) => boolean): ElementId | undefined {
  if (isFlow(relation)) {
    const source = ours(relation.sourceId)
    const target = ours(relation.targetId)
    // A line between two of its own parts goes with it.
    if (source === target) return undefined
    return source ? relation.targetId : relation.sourceId
  }
  if (isTechnologyRelation(relation) && relation.targetId === id && relation.sourceId !== id) return relation.sourceId
  return undefined
}

/**
 * Who replaces it, as the model says: the field, or — where the field is
 * empty — what the plans that retire it introduce (ADR-0010). A plan that was
 * abandoned names nobody: it is the record of an intention given up, and its
 * successor is not coming. A draft, agreed, running or done plan still says
 * what is meant to take over.
 */
function successorsOf(element: DesignElement, { model }: Reading): ElementId[] {
  if (element.successorId) return [element.successorId]
  return (model.transitions ?? [])
    .filter((plan) => plan.status !== 'abandoned')
    .filter((plan) => plan.elements.some((one) => one.elementId === element.id && one.role === 'retires'))
    .flatMap((plan) => plan.elements.filter((one) => one.role === 'introduces').map((one) => one.elementId))
}

/** Something that retires: who still depends on it, and who takes over. */
function retirementFindings(reading: Reading): Finding[] {
  const found: Finding[] = []
  for (const element of reading.model.elements) {
    const gone = retiredOn(element)
    if (!gone) continue

    // Who is still talking to it on the day it goes: `retired` names the day
    // it is gone, so anything still there that day is left hanging.
    const count = dependantsOf(element, gone, reading)
    if (count) {
      found.push({ kind: 'retiresWithDependants', subject: 'element', id: element.id, name: element.name, count, detail: gone })
    }

    const named = successorsOf(element, reading)
    if (named.length === 0) {
      found.push({ kind: 'successorMissing', subject: 'element', id: element.id, name: element.name, detail: gone })
      continue
    }
    // Live strictly after the day the old one is gone: a same-day cutover is
    // the plan working, not a gap. Through a plan, too late is when nothing it
    // introduces has arrived by then — a merge into one of two new things is
    // answered by whichever is there.
    const successors = named.map((id) => reading.byId.get(id)).filter((held): held is DesignElement => held !== undefined)
    if (successors.length > 0 && successors.every((successor) => phaseAt(successor, gone) === 'planned')) {
      found.push({ kind: 'successorTooLate', subject: 'element', id: element.id, name: element.name, detail: successors[0].name })
    }
  }
  return found
}

/**
 * A row whose window holds a day one of its ends is gone. A landing with no
 * window of its own says what its interface says, so where the interface is
 * reported the landing is not reported again: one contradiction, one line.
 */
function lineFindings({ model, byId, live }: Reading): Finding[] {
  const outlived = new Map<string, ElementId>()
  for (const relation of model.relations) {
    const end = live.outlivedEnd(relation)
    if (end !== undefined) outlived.set(relation.id, end)
  }
  const found: Finding[] = []
  for (const relation of model.relations) {
    const end = outlived.get(relation.id)
    if (end === undefined) continue
    if (live.windowOf(relation) !== relation && outlived.has(relation.refines!)) continue
    const nameOf = (id: ElementId) => byId.get(id)?.name ?? id
    found.push({
      kind: 'lineOutlivesEnd',
      subject: 'relation',
      relationType: relation.type,
      id: relation.id,
      name: relation.label || `${nameOf(relation.sourceId)} → ${nameOf(relation.targetId)}`,
      detail: nameOf(end),
    })
  }
  return found
}

/**
 * The platform goes before the thing standing on it (ADR-0013). Counted on the
 * platform's last day: a thing not gone by then is left standing on nothing. A
 * row with its own window that closes in time is, as above, the correct answer
 * and not an instance. A platform goes when anything above it goes (ADR-0014
 * §2.7): the earliest day in its chain, and the finding names the platform
 * that actually goes. A platform this scope holds as a stand-in is dated by
 * the scope that defines it, through the tree.
 */
function platformFindings({ model, byId, live, tree }: Reading): Finding[] {
  const standingOn = (id: ElementId, relation: Relation): { platform: DesignElement; day: string } | undefined => {
    const platform = byId.get(id)
    if (!platform) return undefined
    const chain = platform.kind === 'platform' ? [platform, ...ancestorPlatforms(model.elements, id, tree)] : [platform]
    let goes: { platform: DesignElement; day: string } | undefined
    for (const one of chain) {
      const day = live.goneFrom(one.id)
      if (day !== undefined && (goes === undefined || day < goes.day)) goes = { platform: one, day }
    }
    if (goes === undefined || !live.windowHolds(relation, goes.day)) return undefined
    return goes
  }
  const found: Finding[] = []
  for (const relation of model.relations) {
    if (!isTechnologyRelation(relation)) continue
    const thing = byId.get(relation.sourceId)
    const goes = standingOn(relation.targetId, relation)
    if (!thing || !goes) continue
    // Gone by then itself, or — a container — with its application.
    if (live.goneOn(thing.id, goes.day)) continue
    // Reported on the application, by name, because that is what a person is
    // looking for — and a container's row says WHICH of its containers is
    // standing on nothing (ADR-0013, redone).
    const parent = thing.kind === 'component' && thing.parentId !== undefined ? byId.get(thing.parentId) : undefined
    found.push({
      kind: 'platformRetiresFirst', subject: 'element',
      id: parent?.id ?? thing.id,
      name: parent?.name ?? thing.name,
      detail: parent ? `${goes.platform.name} · ${thing.name}` : goes.platform.name,
      relationType: relation.type,
    })
  }
  return found
}

/**
 * Container lines that add up to an interface nobody has drawn (ADR-0013).
 * Not a contradiction in the dates, which is what the rest of this file is
 * about, and here for the reason the file's own header gives: an agent asks
 * for the findings too, and this is the list it asks for.
 */
function impliedFindings({ model, byId, live, today }: Reading): Finding[] {
  return impliedInterfaces(model.relations, (id) => byId.get(id), { day: today, live }).map((implied) => ({
    kind: 'impliedInterface', subject: 'relation', relationType: 'flow',
    // The first of the lines: what a click opens, and what the accept is
    // found again by.
    id: implied.relations[0].id,
    name: byId.get(implied.sourceId)?.name ?? implied.sourceId,
    detail: byId.get(implied.targetId)?.name ?? implied.targetId,
    count: implied.relations.length,
  }))
}

/** A plan still running after the day it was due to end. */
function planFindings({ model, today }: Reading): Finding[] {
  return (model.transitions ?? [])
    .filter((transition) => !isTransitionFinished(transition) && isDay(transition.to) && transition.to < today)
    .map((transition) => ({
      kind: 'planOverdue', subject: 'transition', id: transition.id, name: transition.title, detail: transition.to,
    }))
}

/**
 * "Worst" is by kind rather than by count: a retirement with things still
 * plugged into it is an outage, and a plan a week overdue is a conversation.
 */
const SEVERITY: Record<FindingKind, number> = {
  retiresWithDependants: 0,
  successorTooLate: 1,
  platformRetiresFirst: 2,
  lineOutlivesEnd: 3,
  planOverdue: 4,
  successorMissing: 5,
  // Last: nothing is broken, there is a picture missing. A landscape being
  // drawn bottom-up would otherwise open with a list of its own progress.
  impliedInterface: 6,
}

/** Everything the dates disagree about, worst first. */
export function findings({ model, today, platformTree = {} }: CheckContext): Finding[] {
  const reading: Reading = {
    model,
    byId: new Map(model.elements.map((element) => [element.id, element])),
    live: livenessOf(model, platformTree),
    tree: platformTree,
    today,
  }
  const found = [
    ...retirementFindings(reading),
    ...lineFindings(reading),
    ...platformFindings(reading),
    ...impliedFindings(reading),
    ...planFindings(reading),
  ]
  return found.sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind] || a.name.localeCompare(b.name))
}
