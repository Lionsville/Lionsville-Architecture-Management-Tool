// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The write tier: a request turned into one `Command` (ADR-0007).
 *
 * Every tool here is one command, usually a `transaction`, dispatched at the
 * session by the handler — so it is one undo step, one Activity line, and one
 * autosave, exactly as if a person had done it. Nothing here touches the
 * model: it builds the command against the model as it stands and hands it
 * over, and the reducer is the only writer.
 *
 * It takes the id policy and the id maker as arguments, because the session's
 * model is the truth about what is taken and a function that mints its own
 * ids cannot be called twice for the same answer. What comes back with the
 * command is what to answer once it has landed, which is where a new id is
 * told to the agent.
 *
 * This file is the lookup and nothing else: each tool's builder lives with its
 * family under `write/`, and `write/handlers.ts` is the table, typed so that a
 * tool without a builder does not compile.
 */
import type { AgentAnswer, ToolName } from './tools'
import { checkArguments, refused, toolSpec } from './tools'
import { HANDLERS, isCommandTool } from './write/handlers'
import type { Args, Prepared, WriteView } from './write/shared'

export type { Prepared, WriteView } from './write/shared'
export type { CommandTool } from './write/handlers'
export { ANSWERED_BY_SESSION, isCommandTool } from './write/handlers'

/** The command for a request, or the refusal that stops it before the reducer. */
export function commandFor(tool: ToolName, rawArgs: unknown, view: WriteView): Prepared | AgentAnswer {
  const wrong = checkArguments(toolSpec(tool).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  if (!isCommandTool(tool)) return refused('agent.unknownTool', tool)
  return HANDLERS[tool]((rawArgs ?? {}) as Args, view)
}
