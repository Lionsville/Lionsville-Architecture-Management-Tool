// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the agent's vocabulary.
 *
 * The tools, their schemas and refusals, the protocol the agent's server
 * speaks, and what each asks of its host (ADR-0007). The handler is an entry
 * of its own.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { Driving } from '../../agent/driving'
export { RPC, isJsonRpcRequest, respond } from '../../agent/mcpProtocol'
export type { JsonRpcRequest, JsonRpcResponse, Relay } from '../../agent/mcpProtocol'
export type { AcrossWork, ChangeAcross, ChangedAcross } from '../../agent/merge'
export { OBSERVATIONS_METHOD, RECORDS_PARAGRAPH, SHEET_MAPPING_PARAGRAPH, STRUCTURE_DEFAULTS, TREE_TOOLS_PARAGRAPH } from '../../agent/method'
export type { PeopleView } from '../../agent/people'
export { isTreeTool } from '../../agent/scopeTree'
export type { ScopeHeader, ScopeRead, ScopesView, TreeRefusal, TreeRefused } from '../../agent/scopeTree'
export type { ShellView } from '../../agent/shell'
export {
  ON_THE_REGISTER, ON_THE_TREE, REFUSAL_SENTENCE, TOOLS, TOOL_NAMES, checkArguments, isToolName, json, refused, toolSpec,
} from '../../agent/tools'
export type { AgentAnswer, AgentRefusal, AgentRequest, InputSchema, ToolName, ToolSpec } from '../../agent/tools'
export { listChecks } from '../../agent/tree'
export type { TreeView } from '../../agent/tree'
