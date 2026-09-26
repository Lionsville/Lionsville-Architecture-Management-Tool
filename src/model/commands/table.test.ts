// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The table `apply` looks a command up in. The type already refuses a table
 * missing a kind; these pin what a type cannot see — that the object built at
 * run time holds exactly the vocabulary, and that no two families answer for
 * the same kind, which a spread would settle silently in favour of the last.
 */
import { describe, expect, it } from 'vitest'
import { apply } from '../reducer'
import { fromArrays } from '../normalised'
import { diagram } from '../testFixtures'
import type { CommandType } from './handler'
import { COMMAND_TABLE } from './table'
import { DIAGRAM_COMMANDS } from './diagrams'
import { ELEMENT_COMMANDS } from './elements'
import { GROUP_COMMANDS } from './groups'
import { MEMBER_COMMANDS } from './members'
import { CAUSE_COMMANDS, EXPERIMENT_COMMANDS, OBSERVATION_COMMANDS, SOLUTION_COMMANDS } from './analysis'
import { PROJECT_COMMANDS } from './project'
import { DECISION_COMMANDS, TRANSITION_COMMANDS } from './records'
import { RELATION_COMMANDS } from './relations'
import { ROUTE_COMMANDS } from './routes'

/**
 * Every kind of command, written out once more. Typed as a record over the
 * union, so a kind added to the vocabulary and not here — or here and not
 * there — fails the typecheck of this file as well as of the table.
 */
const EVERY_TYPE: Record<CommandType, true> = {
  'element.create': true, 'element.update': true, 'element.delete': true,
  'standin.refresh': true, 'element.link': true,
  'relation.create': true, 'relation.update': true, 'relation.delete': true,
  'member.set': true, 'member.remove': true, 'node.set': true, 'node.remove': true,
  'group.set': true, 'group.remove': true, 'box.set': true, 'box.remove': true,
  'route.set': true, 'route.clear': true, 'board.set': true,
  'diagram.create': true, 'diagram.rename': true, 'diagram.settings': true,
  'diagram.update': true, 'diagram.delete': true,
  'decision.add': true, 'decision.update': true, 'decision.remove': true,
  'transition.add': true, 'transition.update': true, 'transition.remove': true,
  'observation.add': true, 'observation.update': true, 'observation.remove': true,
  'cause.add': true, 'cause.update': true, 'cause.remove': true,
  'solution.add': true, 'solution.update': true, 'solution.remove': true,
  'experiment.add': true, 'experiment.update': true, 'experiment.remove': true,
  'project.settings': true, 'transaction': true, 'restore': true,
}

const FAMILIES = [
  ELEMENT_COMMANDS, RELATION_COMMANDS, MEMBER_COMMANDS, GROUP_COMMANDS, ROUTE_COMMANDS,
  DIAGRAM_COMMANDS, DECISION_COMMANDS, TRANSITION_COMMANDS, OBSERVATION_COMMANDS,
  CAUSE_COMMANDS, SOLUTION_COMMANDS, EXPERIMENT_COMMANDS, PROJECT_COMMANDS,
]

describe('the command table', () => {
  it('has an entry for every command type, and for nothing else', () => {
    expect(Object.keys(COMMAND_TABLE).sort()).toEqual(Object.keys(EVERY_TYPE).sort())
    for (const entry of Object.values(COMMAND_TABLE)) expect(typeof entry.apply).toBe('function')
  })

  it('takes each entry from exactly one family', () => {
    const answered = FAMILIES.flatMap((family) => Object.keys(family))
    expect(answered.length).toBe(new Set(answered).size)
    expect(answered.sort()).toEqual(Object.keys(EVERY_TYPE).sort())
  })

  it('answers through an entry alone exactly as through apply', () => {
    const held = fromArrays({ name: 'Design', elements: [], relations: [], diagrams: [diagram('d1', { name: 'Before' })] })
    const command = { type: 'diagram.rename', id: 'd1', name: 'After', coalesce: 'k' } as const
    const alone = COMMAND_TABLE['diagram.rename'].apply(held, command, { meta: { coalesce: 'k' }, apply })
    expect(alone.ok && alone.model.diagrams.d1.name).toBe('After')
    expect(alone).toEqual(apply(held, command))
  })

  it('answers a type it has no entry for as the switch it replaced did, and never from the prototype', () => {
    const held = fromArrays({ name: 'Design', elements: [], relations: [], diagrams: [diagram('d1')] })
    for (const type of ['nonsense', 'constructor', 'toString', '__proto__']) {
      expect(apply(held, { type } as never)).toBeUndefined()
    }
  })
})
