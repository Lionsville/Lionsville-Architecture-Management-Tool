// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One platform service, and what would be stranded if it were withdrawn
 * (ADR-0014 §2.8).
 *
 * The other side of the platform report. A platform's report asks *this is
 * being retired; what is on it*; a service's asks *this is being withdrawn;
 * who leans on it* — which is the question a platform team owns: who
 * maintains the offering, what delivers it this year, who consumes it and
 * from which scopes, and which of them would be left with nothing on the day
 * it goes.
 *
 * Derived from the rows, as the platform report is, and over the tree's rows
 * as well as this scope's: the maintainer and what realises it are the
 * platform scope's rows, and every consumer is a landscape's. A consumer that
 * uses it through a container is named by the application, since a team owns
 * applications and not containers, with the container said beside it.
 *
 * **Stranded** is on the day it goes: with a retirement date, every consumer
 * with a row still open on that day, from a container — and an application —
 * not gone by then; without one, every consumer there is — withdrawing it
 * would strand all of them, which is what the question asks. A row with its
 * own window that closes in time is the correct answer and not an instance.
 */
import type { HostModel } from './hostModel'
import { isDay } from './lifecycle'
import { livenessOf } from './liveness'
import type { PlatformDescribe, PlatformEnd } from './platformReport'
import type { DesignElement, ElementId, Relation } from './types'

export type ServiceConsumer = PlatformEnd & {
  /** The container the row was written from, where it was not the application itself. */
  via?: { id: ElementId; name: string }
  /** The row that says so, for a page that opens it. */
  relationId: string
}

export type ServiceReportOptions = {
  /** Rows written in other scopes that name this service (ADR-0012 §2). */
  elsewhere?: readonly Relation[]
  describe?: PlatformDescribe
  /** The day it is read; absent counts every row. */
  today?: string
}

export type ServiceReport = {
  service: PlatformEnd & { shared: boolean; retiredOn?: string }
  /** The actors it is assigned to. */
  maintainers: PlatformEnd[]
  /** The platforms that realise it. Empty is a real gap. */
  realisedBy: PlatformEnd[]
  /** Everything that uses it, by application, with where it was written. */
  consumers: ServiceConsumer[]
  /** The scopes the consumers were written in, where `describe` says so. */
  scopes: string[]
  /** The consumers still on it the day it goes — or all of them, where no day is set. */
  stranded: ServiceConsumer[]
  counts: { maintainers: number; realisedBy: number; consumers: number; stranded: number }
}

export function serviceReport(
  model: Pick<HostModel, 'elements' | 'relations'>,
  serviceId: ElementId,
  options: ServiceReportOptions = {},
): ServiceReport | undefined {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const service = byId.get(serviceId)
  if (!service) return undefined
  const day = options.today
  const describe = options.describe

  const end = (id: ElementId): PlatformEnd => {
    const held = byId.get(id)
    const told = describe?.(id)
    const kind = held?.kind ?? told?.kind
    return {
      id, name: told?.name ?? held?.name ?? id, known: held !== undefined || told !== undefined,
      ...(kind !== undefined ? { kind } : {}),
      ...(told?.where !== undefined ? { where: told.where } : {}),
    }
  }

  const seen = new Set<string>()
  const every: Relation[] = []
  for (const relation of [...model.relations, ...(options.elsewhere ?? [])]) {
    if (seen.has(relation.id)) continue
    seen.add(relation.id)
    every.push(relation)
  }
  // What is there, by the rules every reader shares (`liveness.ts`): an end
  // this scope holds as a stand-in, or not at all, is dated by what `describe`
  // says for it — and with nobody saying, it is not gone.
  const live = livenessOf({ elements: model.elements, relations: every }, { retiredOf: (id) => describe?.(id)?.retired })
  const rows = day === undefined ? every : every.filter((relation) => live.thereOn(relation, day))
  const byName = (a: PlatformEnd, b: PlatformEnd) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  const sources = (type: Relation['type']) =>
    [...new Set(rows.filter((r) => r.type === type && r.targetId === serviceId).map((r) => r.sourceId))]
      .map(end).sort(byName)

  const using = usesByApplication(rows, serviceId, byId, describe)
  const consumerOf = (applicationId: ElementId, use: Use): ServiceConsumer => ({
    ...end(applicationId),
    relationId: use.relation.id,
    ...(use.via ? { via: { id: use.via, name: describe?.(use.via)?.name ?? byId.get(use.via)?.name ?? use.via } } : {}),
  })
  // One consumer per application, by its first row: a team owns applications,
  // and the container the row was written from is said beside it.
  const consumers = [...using].map(([applicationId, uses]) => consumerOf(applicationId, uses[0])).sort(byName)

  const retiredOn = service.lifecycleDates?.retired
  const goes = isDay(retiredOn) ? retiredOn : undefined
  // Stranded is judged per row, not by the first: an application with one
  // container that goes before the service and another still on it on the
  // day is stranded, by the one still on it. A row is still on it when its
  // window holds the day and neither the container it was written from nor
  // its application is gone by then — the service itself is, by definition.
  const stillOn = (applicationId: ElementId, use: Use) => live.windowHolds(use.relation, goes!)
    && !live.goneOn(use.relation.sourceId, goes!) && !live.goneOn(applicationId, goes!)
  const stranded = goes === undefined
    ? consumers
    : [...using].flatMap(([applicationId, uses]) => {
      const on = uses.find((use) => stillOn(applicationId, use))
      return on ? [consumerOf(applicationId, on)] : []
    }).sort(byName)
  const maintainers = sources('assigned')
  const realisedBy = sources('realises')
  const scopes = [...new Set(consumers.map((one) => one.where).filter((one): one is string => one !== undefined))].sort()

  return {
    service: { ...end(serviceId), shared: service.shared === true, ...(goes !== undefined ? { retiredOn: goes } : {}) },
    maintainers,
    realisedBy,
    consumers,
    scopes,
    stranded,
    counts: { maintainers: maintainers.length, realisedBy: realisedBy.length, consumers: consumers.length, stranded: stranded.length },
  }
}

/** One `uses` row onto the service, and the container it was written from, where it was one. */
type Use = { relation: Relation; via?: ElementId }

/**
 * The `uses` rows onto the service, by the application they belong to, in row
 * order. A container is known by this scope's record or by what `describe`
 * says for it, so a consumer another scope wrote is named by its application
 * as one written here is.
 */
function usesByApplication(
  rows: readonly Relation[],
  serviceId: ElementId,
  byId: ReadonlyMap<ElementId, Pick<DesignElement, 'kind' | 'parentId'>>,
  describe: PlatformDescribe | undefined,
): Map<ElementId, Use[]> {
  const using = new Map<ElementId, Use[]>()
  for (const relation of rows) {
    if (relation.type !== 'uses' || relation.targetId !== serviceId) continue
    const held = byId.get(relation.sourceId) ?? describe?.(relation.sourceId)
    const parentId = held?.kind === 'component' ? held.parentId : undefined
    const applicationId = parentId ?? relation.sourceId
    const uses = using.get(applicationId) ?? []
    uses.push({ relation, ...(parentId !== undefined ? { via: relation.sourceId } : {}) })
    using.set(applicationId, uses)
  }
  return using
}
