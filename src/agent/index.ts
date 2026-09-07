/**
 * An agent as a peer of the menu (ADR-0007): the vocabulary a coding agent
 * speaks to a running app, and the pure functions that answer it.
 *
 * The first module in the tree that exists for a client that is not a person.
 * It knows the landscape and nothing about how it is drawn or where it is
 * saved; what listens for an agent is the desktop's main process, and what
 * answers is the shell, both compiling against this file.
 */
export type {
  AgentAnswer, AgentRefusal, AgentRequest, ArgumentSchema, InputSchema, ToolContent, ToolName,
  ToolSpec, ToolTier,
} from './tools'
export {
  REFUSAL_SENTENCE, TOOLS, TOOL_NAMES, checkArguments, isToolName, json, refused, text, toolSpec,
} from './tools'
export type { ReadView } from './answer'
export { answer } from './answer'
export type { SessionView } from './handle'
export { handle } from './handle'
export type { Prepared, WriteView } from './commandFor'
export { commandFor } from './commandFor'
export type { InspectReport } from './inspect'
export { INSPECT_LIMIT, boundsOf, inspect } from './inspect'
