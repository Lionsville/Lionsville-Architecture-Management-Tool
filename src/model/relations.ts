// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a relation is: the vocabulary ADR-0012 §5 turned one connection into,
 * and the one piece of arithmetic that falls out of it.
 *
 * **Only a flow means anything by `protocol` and `isBidirectional`.** A
 * capability is not supported over HTTPS and a responsibility does not run both
 * ways. Nothing strips them — a row that carries them keeps them, so a type
 * changed by mistake and changed back loses nothing — but nothing should read
 * them off a row that is not a flow either.
 *
 * What used to live here as well was the pair that folded the model's list into
 * the one called `connections` that format 3 wrote, and the refusal that guarded
 * it. Format 4 writes `relations` with the type on every row, so there is
 * nothing left to fold and nothing left to refuse; `projects/migrate3to4.ts`
 * reads the old spelling, and the interchange export — which is a contract with
 * other tools and does not change — takes its flows through `flowsOf`.
 */
import type { StringKey } from '../i18n/strings'
import type { DesignElement, PlatformArchetype, Relation, RelationType } from './types'

/**
 * Every type, in the order the vocabulary was decided in: the line this tool
 * has always drawn, the four the business layer needs, and the two the
 * physical view needs (ADR-0013).
 */
export const RELATION_TYPES: readonly RelationType[] = [
  'flow', 'supports', 'serves', 'realises', 'assigned', 'uses', 'hostedOn',
]

/**
 * What each type is called. Published as a table because a relation can be
 * shown by any module — the roadmap draws its window today — and no module may
 * name another's string keys.
 */
export const RELATION_LABEL = {
  flow: 'relation.flow',
  supports: 'relation.supports',
  serves: 'relation.serves',
  realises: 'relation.realises',
  assigned: 'relation.assigned',
  uses: 'relation.uses',
  hostedOn: 'relation.hostedOn',
} as const satisfies Record<RelationType, StringKey>

export function isRelationType(held: unknown): held is RelationType {
  return typeof held === 'string' && (RELATION_TYPES as readonly string[]).includes(held)
}

/** The line this tool has always drawn — and the only one a canvas routes. */
export function isFlow(relation: Pick<Relation, 'type'>): boolean {
  return relation.type === 'flow'
}

/** The flows among a list, in the order they were in. */
export function flowsOf(relations: readonly Relation[]): Relation[] {
  return relations.filter(isFlow)
}

// --- the physical view (ADR-0013) -------------------------------------------

/**
 * What a platform can be (ADR-0014), in the order a select offers them: the
 * place something runs, the service something consumes, the network between.
 */
export const PLATFORM_ARCHETYPES: readonly PlatformArchetype[] = ['place', 'service', 'network']

/** What each archetype is called — published, for the reason `RELATION_LABEL` is. */
export const PLATFORM_ARCHETYPE_LABEL = {
  place: 'platformArchetype.place',
  service: 'platformArchetype.service',
  network: 'platformArchetype.network',
} as const satisfies Record<PlatformArchetype, StringKey>

export function isPlatformArchetype(held: unknown): held is PlatformArchetype {
  return typeof held === 'string' && (PLATFORM_ARCHETYPES as readonly string[]).includes(held)
}

/**
 * What this platform is, with the answer a record that says nothing gets:
 * `service`, the archetype that draws nothing nobody asked for.
 */
export function platformArchetypeOf(element: Pick<DesignElement, 'platformArchetype'>): PlatformArchetype {
  return element.platformArchetype ?? 'service'
}

/**
 * The two rows that join something to what runs it or what it consumes
 * (ADR-0013): an application or a component at one end, a platform — or,
 * since ADR-0014, the service a platform realises — at the other. Never drawn
 * on a canvas — the platform's report lists them.
 */
export function isTechnologyRelation(relation: Pick<Relation, 'type'>): boolean {
  return relation.type === 'uses' || relation.type === 'hostedOn'
}

/** What the ends' kinds are, for a row judged against the model it goes into. */
export type KindOf = (id: string) => Pick<DesignElement, 'kind'> | undefined

/**
 * Which of the technology rows' rules this row breaks, if any (ADR-0014 §2.3):
 *
 * | type       | from → to                                           |
 * |------------|-----------------------------------------------------|
 * | `hostedOn` | application \| component → platform                  |
 * | `uses`     | application \| component → platform \| platformService |
 * | `realises` | platform → platformService (beside process → function) |
 * | `assigned` | actor → platformService \| platform (beside function \| step) |
 *
 * Judged on the ends this scope holds: an end nobody here holds is trusted,
 * as every other row's far end is (ADR-0012 §5). `hostedOn` is the strict
 * one, and the reducer refuses it — a platform inside a platform is
 * `parentId`, the one containment, and a row saying the same thing twice is
 * two ways of saying one thing. The other three are the agent's to hold an
 * argument to, since a person's inspector cannot draw them wrong.
 */
export function technologyEndsRefusal(
  row: Pick<Relation, 'type' | 'sourceId' | 'targetId'>,
  kindOf: KindOf,
): RelationType | undefined {
  const source = kindOf(row.sourceId)?.kind
  const target = kindOf(row.targetId)?.kind
  const consumer = source === undefined || source === 'application' || source === 'component'
  switch (row.type) {
    case 'hostedOn':
      return consumer && (target === undefined || target === 'platform') ? undefined : 'hostedOn'
    case 'uses':
      return consumer && (target === undefined || target === 'platform' || target === 'platformService')
        ? undefined : 'uses'
    case 'realises':
      if (source === 'platform' && target !== undefined && target !== 'platformService') return 'realises'
      if (target === 'platformService' && source !== undefined && source !== 'platform') return 'realises'
      return undefined
    case 'assigned':
      if ((target === 'platformService' || target === 'platform') && source !== undefined && source !== 'actor') return 'assigned'
      return undefined
    default:
      return undefined
  }
}
