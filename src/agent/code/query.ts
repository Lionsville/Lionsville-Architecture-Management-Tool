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
 * caller, and a line about it for the host's trail.
 */
import { checkArguments, json, refused, text } from '../tools'
import type { AgentAnswer, AgentRefusal, AgentRequest } from '../tools'
import { apiOf } from './api'
import type { ApiMethod } from './api'
import { codeToolSpec, isCodeTool } from './codeTools'
import { describeApi } from './describe'
import type { CodeHost, ScriptReport } from './host'
import { CALLS_PER_CHARGE, MOST_FAILURE_TEXT, limitDetail } from './limits'
import type { ScriptLimit } from './limits'
import type { SandboxAnswer, SandboxCall } from './sandbox'

/** Code mode on one host: what is kept between its calls. */
export type CodeMode = {
  /** One of code mode's tools, answered over the host as this caller holds it. */
  answer(request: AgentRequest, host: CodeHost): Promise<AgentAnswer>
}

const bytesOf = (value: string): number => new TextEncoder().encode(value).length

/** SHA-256 of a text as hex, by the platform's own digest: the same in a page and in node. */
export async function fingerprintOf(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Whether a call of this method may change something: every tier but read, and not a report that only looks. */
function changes(method: ApiMethod): boolean {
  return method.tool.tier === 'write' || (method.tool.tier === 'see' && method.tool.onASheet !== 'read')
}

const refusedInScript = (refusal: AgentRefusal, message: string): SandboxAnswer => ({ ok: false, refusal, message })

/** A refusal as a script is thrown it: the key, and the detail where there is one. */
function thrownFor(answer: Extract<AgentAnswer, { ok: false }>): SandboxAnswer {
  return refusedInScript(answer.refusal, answer.detail ?? answer.refusal)
}

/** A plain call's answer as a script is handed it. A picture has no place in one. */
function handed(answer: AgentAnswer): SandboxAnswer {
  if (!answer.ok) return thrownFor(answer)
  const block = answer.content[0]
  if (answer.content.length !== 1 || !block || block.type !== 'text') {
    return refusedInScript('agent.notInScript', 'the call answers something other than data: use the plain tool')
  }
  return { ok: true, value: block.text }
}

/** What one script's calls came to, counted where they are answered. */
type Counted = {
  calls: number
  writes: number
  readonly scopesRead: Set<string>
  readonly scopesWritten: Set<string>
}

/** The arguments a script passed, as an object, with the scope `lv` was bound to where the method takes one and none was said. */
function argumentsOf(method: ApiMethod, raw: string, bound: string | undefined): Record<string, unknown> | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  const args = parsed as Record<string, unknown>
  const scoped = 'scope' in method.tool.inputSchema.properties && args.scope === undefined && bound !== undefined
  return scoped ? { ...args, scope: bound } : args
}

/** The calls of a script that reads, answered and counted. */
function reading(host: CodeHost, api: readonly ApiMethod[], counted: Counted): SandboxCall {
  const byName = new Map(api.map((method) => [method.name, method]))
  return async (name, raw, bound) => {
    counted.calls += 1
    if (counted.calls > host.limits.calls) return { stop: 'calls' }
    if (counted.calls % CALLS_PER_CHARGE === 0 && host.charge && !host.charge()) return { stop: 'rate' }
    const method = byName.get(name)
    if (!method) return refusedInScript('agent.unknownTool', name)
    if (method.notInScript !== undefined) return refusedInScript('agent.notInScript', `${name}: ${method.notInScript}`)
    if (changes(method)) return refusedInScript('agent.notInScript', `${name} changes something, and a query only reads`)
    const args = argumentsOf(method, raw, bound)
    if (!args) return refusedInScript('agent.badArguments', `${name} takes one object`)
    if (typeof args.scope === 'string') counted.scopesRead.add(args.scope)
    return handed(await host.ask({ id: `script-${counted.calls}`, tool: method.tool.name, args }))
  }
}

/** A script's own failure as an answer says it: its message, cut to what an answer carries. */
function failureText(thrown: string): string {
  return thrown.length > MOST_FAILURE_TEXT ? `${thrown.slice(0, MOST_FAILURE_TEXT)}…` : thrown
}

export function codeMode(): CodeMode {
  /** Who has a script running: one at a time each. */
  const running = new Set<string>()

  async function query(rawArgs: unknown, host: CodeHost): Promise<AgentAnswer> {
    const wrong = checkArguments(codeToolSpec('query').inputSchema, rawArgs)
    if (wrong) return refused('agent.badArguments', wrong)
    const { script, scope } = rawArgs as { script: string; scope?: string }
    const bytes = bytesOf(script)
    const counted: Counted = { calls: 0, writes: 0, scopesRead: new Set(), scopesWritten: new Set() }
    // Asked before anything is awaited, so two scripts that arrive together cannot both find nobody running.
    const refusedAt: ScriptLimit | undefined = bytes > host.limits.scriptBytes ? 'script' : running.has(host.holder) ? 'concurrent' : undefined
    if (refusedAt === undefined) running.add(host.holder)
    try {
      const hash = await fingerprintOf(script)
      const said = (outcome: 'ok' | AgentRefusal, more: { cpuMs?: number; resultBytes?: number; limit?: ScriptLimit } = {}): void => {
        const line: ScriptReport = {
          op: 'query', hash, bytes,
          scopesRead: [...counted.scopesRead], scopesWritten: [...counted.scopesWritten],
          calls: counted.calls, writes: counted.writes,
          cpuMs: more.cpuMs ?? 0, resultBytes: more.resultBytes ?? 0,
          ...(more.limit !== undefined ? { limit: more.limit } : {}),
          outcome,
        }
        host.report?.(line)
      }
      const stopped = (limit: ScriptLimit, cpuMs = 0): AgentAnswer => {
        said('agent.scriptLimit', { limit, cpuMs })
        return refused('agent.scriptLimit', limitDetail(limit, host.limits))
      }
      if (refusedAt !== undefined) return stopped(refusedAt)
      const api = apiOf(host.tools)
      const sandbox = await host.sandbox()
      const outcome = await sandbox.run({
        script,
        methods: api.map((method) => method.name),
        ...(scope !== undefined ? { scope } : {}),
        limits: host.limits,
        call: reading(host, api, counted),
      })
      if (!outcome.ok) {
        if ('limit' in outcome) return stopped(outcome.limit, outcome.cpuMs)
        said('agent.scriptFailed', { cpuMs: outcome.cpuMs })
        return refused('agent.scriptFailed', failureText(outcome.thrown))
      }
      const resultBytes = bytesOf(outcome.result)
      if (resultBytes > host.limits.resultBytes) return stopped('result', outcome.cpuMs)
      // Written as text around the script's own JSON rather than parsed and written again.
      const answered = text(`{"result":${outcome.result},"calls":${counted.calls}}`)
      said('ok', { cpuMs: outcome.cpuMs, resultBytes })
      return host.named ? await host.named(answered) : answered
    } finally {
      if (refusedAt === undefined) running.delete(host.holder)
    }
  }

  return {
    answer(request, host) {
      if (!isCodeTool(request.tool)) return Promise.resolve(refused('agent.unknownTool', request.tool))
      switch (request.tool) {
        case 'api.describe': return Promise.resolve(describeApi(request.args, host.tools, host.limits))
        case 'query': return query(request.args, host)
        default: {
          const unexpected: never = request.tool
          return Promise.resolve(json(unexpected))
        }
      }
    },
  }
}
