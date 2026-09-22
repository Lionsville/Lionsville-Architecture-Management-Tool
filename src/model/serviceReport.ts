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
 * whose row is still open on that day; without one, every consumer there is
 * — withdrawing it would strand all of them, which is what the question
 * asks. A row with its own window that closes in time is the correct answer
 * and not an instance.
 */
import type { HostModel } from './hostModel'
import { isDay, isGoneOn, relationLiveAt } from './lifecycle'
import type { PlatformDescribe, PlatformEnd } from './platformReport'
import type { ElementId, Relation } from './types'

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
  const gone = (id: ElementId) => {
    const held = byId.get(id)
    return day !== undefined && held !== undefined && isGoneOn(held, day)
  }
  const live = (relation: Relation) => (day === undefined || relationLiveAt(relation, day))
    && !gone(relation.sourceId) && !gone(relation.targetId)

  const seen = new Set<string>()
  const rows: Relation[] = []
  for (const relation of [...model.relations, ...(options.elsewhere ?? [])]) {
    if (seen.has(relation.id)) continue
    seen.add(relation.id)
    if (live(relation)) rows.push(relation)
  }
  const byName = (a: PlatformEnd, b: PlatformEnd) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  const sources = (type: Relation['type']) =>
    [...new Set(rows.filter((r) => r.type === type && r.targetId === serviceId).map((r) => r.sourceId))]
      .map(end).sort(byName)

  // One consumer per application, first row wins: a team owns applications,
  // and the container the row was written from is said beside it.
  const consumers: ServiceConsumer[] = []
  const applications = new Set<ElementId>()
  for (const relation of rows) {
    if (relation.type !== 'uses' || relation.targetId !== serviceId) continue
    const held = byId.get(relation.sourceId)
    const via = held?.kind === 'component' && held.parentId !== undefined ? held : undefined
    const applicationId = via?.parentId ?? relation.sourceId
    if (applications.has(applicationId)) continue
    applications.add(applicationId)
    consumers.push({
      ...end(applicationId),
      relationId: relation.id,
      ...(via ? { via: { id: via.id, name: describe?.(via.id)?.name ?? via.name } } : {}),
    })
  }
  consumers.sort(byName)

  const retiredOn = service.lifecycleDates?.retired
  const goes = isDay(retiredOn) ? retiredOn : undefined
  const stranded = goes === undefined
    ? consumers
    : consumers.filter((consumer) => {
      const row = rows.find((r) => r.id === consumer.relationId)
      return row !== undefined && relationLiveAt(row, goes) && !isGoneOn(byId.get(consumer.id) ?? service, goes)
    })
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
