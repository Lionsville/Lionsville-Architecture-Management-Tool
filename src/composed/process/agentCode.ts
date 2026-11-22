// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: an agent's script.
 *
 * What a host fills to run one and what it is answered (ADR-0051): the mode's
 * tools answered over a host, the port a sandbox is handed in through, the
 * limits a host shared by many holds a script to, and a simulation as it is
 * kept until it is run. Apart from the handler, which this reaches and a
 * process that only lists the tools does not; and apart from the interpreter
 * (`agentSandbox`), which only the thread a script runs in loads.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { isCodeTool } from '../../agent/code/codeTools'
export { SHARED_HOST_LIMITS } from '../../agent/code/limits'
export type { ScriptLimits } from '../../agent/code/limits'
export { codeMode } from '../../agent/code/query'
export type { CodeHost, ScriptReport } from '../../agent/code/host'
export type { Sandbox, SandboxAnswer, SandboxOutcome, SandboxRun } from '../../agent/code/sandbox'
export type { HeldScope, Simulation } from '../../agent/code/held'
