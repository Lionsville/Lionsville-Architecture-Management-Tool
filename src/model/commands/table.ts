// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every command there is, and its entry: what `apply` looks a command up in.
 *
 * Each family file answers for a slice of the vocabulary in `../commands.ts`;
 * this puts the slices together and the type holds the sum to the whole of
 * `Command['type']`, so a command added to the vocabulary without an entry is
 * a type error here rather than a step the writer silently falls through.
 * One entry, one module: a command's entry is testable on its own.
 */
import type { CommandTable } from './handler'
import { DIAGRAM_COMMANDS } from './diagrams'
import { ELEMENT_COMMANDS } from './elements'
import { GROUP_COMMANDS } from './groups'
import { MEMBER_COMMANDS } from './members'
import { CAUSE_COMMANDS, EXPERIMENT_COMMANDS, OBSERVATION_COMMANDS, SOLUTION_COMMANDS } from './analysis'
import { PROJECT_COMMANDS } from './project'
import { DECISION_COMMANDS, TRANSITION_COMMANDS } from './records'
import { RELATION_COMMANDS } from './relations'
import { ROUTE_COMMANDS } from './routes'

export const COMMAND_TABLE: CommandTable = {
  ...ELEMENT_COMMANDS,
  ...RELATION_COMMANDS,
  ...MEMBER_COMMANDS,
  ...GROUP_COMMANDS,
  ...ROUTE_COMMANDS,
  ...DIAGRAM_COMMANDS,
  ...DECISION_COMMANDS,
  ...TRANSITION_COMMANDS,
  ...OBSERVATION_COMMANDS,
  ...CAUSE_COMMANDS,
  ...SOLUTION_COMMANDS,
  ...EXPERIMENT_COMMANDS,
  ...PROJECT_COMMANDS,
}
