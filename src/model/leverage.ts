/**
 * What an application leverages: the services it uses, and the platforms
 * behind them (ADR-0014).
 *
 * An application says one thing per question. `hostedOn` a platform is where
 * a container runs; `uses` a service is what it consumes — the consumer's
 * statement, about the offering and not the product: a team asks for message
 * brokering, and which broker delivers it this year is the platform team's
 * business, said once as `realises`. Which platforms an application actually
 * depends on is therefore never stored: it is read through the services it
 * uses and what realises them, here, so the record, the register and the
 * agent cannot disagree about it.
 *
 * `uses` a platform stays legal for the team that genuinely binds to one
 * instance. It is not the normal answer, and it is answered beside the
 * services rather than folded into them, so a reader can see which kind of
 * dependency it is.
 *
 * **The rows may be another scope's.** A landscape writes what its
 * applications use; the platform scope writes what realises each service; a
 * consumer of a service may be a landscape the service's scope has never
 * opened. So every reader takes `elsewhere` — the rows the rest of the tree
 * wrote about the ids in question, the way the platform report takes them —
 * and answers over both lists, never a row twice.
 *
 * Roll-up, as hosting rolls up: an application leverages what it uses itself
 * and what its containers use, because a container's `uses` is the
 * application's dependency as much as its `hostedOn` is the application's
 * place.
 */
import { containersOf } from './hosting'
import type { DesignElement, ElementId, Relation } from './types'

export type LeverageOptions = {
  /** Rows written in other scopes that name the ids asked about (ADR-0012 §2). */
  elsewhere?: readonly Relation[]
}

type Rows = { elements: readonly DesignElement[]; relations: readonly Relation[] }

/** The scope's rows, then the tree's, and never a row twice. */
function rowsOf(model: Rows, options: LeverageOptions): Relation[] {
  const seen = new Set<string>()
  const rows: Relation[] = []
  for (const relation of [...model.relations, ...(options.elsewhere ?? [])]) {
    if (seen.has(relation.id)) continue
    seen.add(relation.id)
    rows.push(relation)
  }
  return rows
}

function kindOf(model: Rows, id: ElementId): DesignElement['kind'] | undefined {
  return model.elements.find((held) => held.id === id)?.kind
}

/** The ids an application's `uses` rows are written from: itself, and its containers. */
function consumersUnder(model: Rows, applicationId: ElementId): Set<ElementId> {
  const held = new Set<ElementId>([applicationId])
  if (kindOf(model, applicationId) === 'application') {
    for (const container of containersOf(model.elements, applicationId)) held.add(container.id)
  }
  return held
}

/** The targets of the `uses` rows from an application and its containers, in row order, once each. */
function usedBy(model: Rows, applicationId: ElementId, options: LeverageOptions): ElementId[] {
  const from = consumersUnder(model, applicationId)
  const ids: ElementId[] = []
  for (const row of rowsOf(model, options)) {
    if (row.type !== 'uses' || !from.has(row.sourceId) || ids.includes(row.targetId)) continue
    ids.push(row.targetId)
  }
  return ids
}

/**
 * The services an application uses, itself or through its containers, in
 * row order. An id this scope does not hold is taken to be a service: a
 * `uses` row ends on a service or a platform, and the platforms this scope
 * knows are told apart by kind.
 */
export function servicesOf(model: Rows, applicationId: ElementId, options: LeverageOptions = {}): ElementId[] {
  return usedBy(model, applicationId, options).filter((id) => kindOf(model, id) !== 'platform')
}

/** The platforms an application binds to directly by `uses`, beside the services (ADR-0014 §2.5). */
export function platformsBoundTo(model: Rows, applicationId: ElementId, options: LeverageOptions = {}): ElementId[] {
  return usedBy(model, applicationId, options).filter((id) => kindOf(model, id) === 'platform')
}

/** The platforms that realise a service, in row order, once each. */
export function platformsBehind(model: Rows, serviceId: ElementId, options: LeverageOptions = {}): ElementId[] {
  const ids: ElementId[] = []
  for (const row of rowsOf(model, options)) {
    if (row.type !== 'realises' || row.targetId !== serviceId || ids.includes(row.sourceId)) continue
    ids.push(row.sourceId)
  }
  return ids
}

/**
 * The applications that consume a service, in row order, once each: a
 * container's row counts for its application, because a team owns
 * applications and not containers. A consumer this scope does not hold is
 * named as the row names it.
 */
export function consumersOf(model: Rows, serviceId: ElementId, options: LeverageOptions = {}): ElementId[] {
  const ids: ElementId[] = []
  for (const row of rowsOf(model, options)) {
    if (row.type !== 'uses' || row.targetId !== serviceId) continue
    const held = model.elements.find((one) => one.id === row.sourceId)
    const application = held?.kind === 'component' && held.parentId !== undefined ? held.parentId : row.sourceId
    if (!ids.includes(application)) ids.push(application)
  }
  return ids
}

export type Leverage = {
  /** The services it uses, each with the platforms behind it. */
  services: { id: ElementId; platformIds: ElementId[] }[]
  /** The platforms it binds to directly, beside the services. */
  platformIds: ElementId[]
}

/** What an application leverages: the services, the platforms behind each, and any platform bound to directly. */
export function leverageOf(model: Rows, applicationId: ElementId, options: LeverageOptions = {}): Leverage {
  return {
    services: servicesOf(model, applicationId, options)
      .map((id) => ({ id, platformIds: platformsBehind(model, id, options) })),
    platformIds: platformsBoundTo(model, applicationId, options),
  }
}

/** The same, said by name, for a line a person reads. */
export type LeverageLine = {
  services: { id: ElementId; name: string; platforms: { id: ElementId; name: string }[] }[]
  platforms: { id: ElementId; name: string }[]
}

export function describeLeverage(
  leverage: Leverage,
  nameOf: (id: ElementId) => string | undefined,
): LeverageLine {
  const named = (id: ElementId) => ({ id, name: nameOf(id) ?? id })
  return {
    services: leverage.services.map((one) => ({ ...named(one.id), platforms: one.platformIds.map(named) })),
    platforms: leverage.platformIds.map(named),
  }
}
