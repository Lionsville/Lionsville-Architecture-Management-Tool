// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: what a failure looks like.
 *
 * A refusal as a key, a diagnostic and how a trail reads, the names of the
 * controls, and where work is kept as a fact two processes share.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { AGENT_MODE_PARAMETER, DEFAULT_AGENT_MODE, agentModeFrom } from '../../platform/agentServer'
export type { AgentMode } from '../../platform/agentServer'
export type { ControlName } from '../../platform/controlNames'
export { RING_SIZE, formatDiagnostic } from '../../platform/diagnostics'
export type { DiagnosticEntry } from '../../platform/diagnostics'
export { ShellError } from '../../platform/errors'
export type { WorkingSource } from '../../platform/workingSource'
export type { Diagnostics } from '../../ports/Diagnostics'
