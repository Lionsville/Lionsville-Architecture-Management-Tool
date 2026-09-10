/**
 * What a relation is, and the one place format 3 and the model meet.
 *
 * ADR-0012 §5 turned the single connection into five typed rows. Two of the
 * consequences are arithmetic and live here, so nobody re-derives either:
 *
 * **A flow is the only type this file format has a place for.** Format 3 writes
 * a list called `connections`, and every row in it is a line between two
 * applications — that is what a 1.x build reads and what the interchange format
 * hands other tools. So the boundary is a pair of functions rather than a cast:
 * every connection read is a `flow`, and a row of any other type is *refused*
 * on the way out rather than written into a file somebody else will misread.
 * Both go at format 4, when the file's own list becomes `relations`.
 *
 * **Only a flow means anything by `protocol` and `isBidirectional`.** A
 * capability is not supported over HTTPS and a responsibility does not run both
 * ways. Nothing strips them — a row that carries them keeps them, so a type
 * changed by mistake and changed back loses nothing — but nothing should read
 * them off a row that is not a flow either.
 */
import { ShellError } from '../platform/errors'
import type { StringKey } from '../i18n/strings'
import type { DesignConnection, Relation, RelationType } from './types'

/**
 * Every type, in the order the vocabulary was decided in: the line this tool
 * has always drawn, then the four the business layer needs.
 */
export const RELATION_TYPES: readonly RelationType[] = [
  'flow', 'supports', 'serves', 'realises', 'assigned',
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

/**
 * The rows a format-3 file may hold, from the model's own list.
 *
 * A flow loses only the word `flow`, so the bytes are the bytes a 1.x build
 * wrote and reads. Anything else is a {@link ShellError}: this build can say
 * more than its file can hold, and writing a `supports` row into a list called
 * `connections` would hand every older build a line between two things it has
 * no way to understand. Refusing is the honest half of shipping the model
 * before the format.
 */
export function asConnections(relations: readonly Relation[]): DesignConnection[] {
  return relations.map((relation) => {
    if (!isFlow(relation)) {
      throw new ShellError('relation.notInThisFormat', { type: relation.type })
    }
    const { type: _flow, ...connection } = relation
    return connection
  })
}

/** Every connection a format-3 file holds, as what it has always been. */
export function asRelations(connections: readonly DesignConnection[]): Relation[] {
  return connections.map((connection) => ({ ...connection, type: 'flow' }))
}
