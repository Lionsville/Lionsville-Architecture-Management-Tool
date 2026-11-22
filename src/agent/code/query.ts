// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Code mode's tools, answered (ADR-0050): a script run against a host, its
 * calls counted and its answer measured.
 *
 * `query` is the script that reads. Every call it makes is one the host
 * answers as it answers a plain call (`host.ts`), so a script reads exactly
 * what its caller may read; what this file adds is what a script needs that
 * a call does not — a count of its calls, a refusal for the calls a script
 * may not make, a measure of what it returns, one script at a time for each
 * caller, and a line about it for the host's trail. `simulate.ts` runs the
 * script that changes things through the same run, over trials.
 */
import { checkArguments, refused } from '../tools'
import type { AgentAnswer, AgentRequest } from '../tools'
import { codeToolSpec, isCodeTool } from './codeTools'
import { describeApi } from './describe'
import { heldSimulations } from './held'
import type { CodeHost } from './host'
import { changes, entering, handed, refusedInScript, runScript } from './script'
import type { Running, ScriptKind } from './script'
import type { SandboxCall } from './sandbox'
import { discard, land, simulating } from './simulate'

/** Code mode on one host: what is kept between its calls. */
export type CodeMode = {
  /** One of code mode's tools, answered over the host as this caller holds it. */
  answer(request: AgentRequest, host: CodeHost): Promise<AgentAnswer>
}

/** The calls of a script that reads, answered and counted. */
function reading(running: Running): SandboxCall {
  return async (name, raw, bound) => {
    const entered = entering(running, name, raw, bound)
    if (!('method' in entered)) return entered
    if (changes(entered.method)) return refusedInScript('agent.notInScript', `${name} changes something, and a query only reads: simulate`)
    if (typeof entered.args.scope === 'string') running.counted.scopesRead.add(entered.args.scope)
    return handed(await running.host.ask({ id: `script-${entered.n}`, tool: entered.method.tool.name, args: entered.args }))
  }
}

const QUERY: ScriptKind = {
  op: 'query',
  call: reading,
  answered: (running) => ({ calls: running.counted.calls }),
}

/**
 * `call`: one plain tool by its name, through the host's own path for one.
 * What makes a client that carries only code mode's tools whole: a picture,
 * the app, the tree and the register are not a script's, and are a call away.
 */
function plainCall(request: AgentRequest, host: CodeHost): Promise<AgentAnswer> {
  const wrong = checkArguments(codeToolSpec('call').inputSchema, request.args)
  if (wrong) return Promise.resolve(refused('agent.badArguments', wrong))
  const { tool, args } = request.args as { tool: string; args?: Record<string, unknown> }
  if (isCodeTool(tool)) return Promise.resolve(refused('agent.badArguments', `${tool} is one of code mode's own tools: call it itself`))
  if (!host.plain) return Promise.resolve(refused('agent.unknownTool', 'call'))
  return host.plain({ id: request.id, tool, args: args ?? {} })
}

export function codeMode(): CodeMode {
  /** Who has a script running: one at a time each. */
  const running = new Set<string>()
  const simulations = heldSimulations()

  return {
    answer(request, host) {
      if (!isCodeTool(request.tool)) return Promise.resolve(refused('agent.unknownTool', request.tool))
      switch (request.tool) {
        case 'api.describe': return Promise.resolve(describeApi(request.args, host.tools, host.limits))
        case 'query': return runScript(QUERY, request.args, host, running)
        case 'simulate': return runScript(simulating(simulations), request.args, host, running)
        case 'run': return land(request.args, host, simulations)
        case 'discard': return Promise.resolve(discard(request.args, host, simulations))
        case 'call': return plainCall(request, host)
        default: {
          const unexpected: never = request.tool
          return Promise.resolve(refused('agent.unknownTool', unexpected))
        }
      }
    },
  }
}
