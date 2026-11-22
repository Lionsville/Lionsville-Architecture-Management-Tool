// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One script, run against a host (ADR-0050): what `query` and `simulate`
 * share. A script is handed to the sandbox with `lv` built from the host's
 * tools; every call out of it is counted, charged and refused here where a
 * script may not make it, before the kind of script decides how it is
 * answered; and what it returns is measured and written into the answer.
 *
 * What the host is told of it is its fingerprint, its counts and how it
 * ended ({@link ScriptReport}) — never anything it said.
 */
import { checkArguments, refused, text } from '../tools'
import type { AgentAnswer, AgentRefusal } from '../tools'
import { apiOf } from './api'
import type { ApiMethod } from './api'
import { codeToolSpec } from './codeTools'
import type { CodeHost, ScriptReport } from './host'
import { CALLS_PER_CHARGE, MOST_FAILURE_TEXT, limitDetail } from './limits'
import type { ScriptLimit } from './limits'
import type { SandboxAnswer, SandboxCall } from './sandbox'

const bytesOf = (value: string): number => new TextEncoder().encode(value).length

/** SHA-256 of a text as hex, by the platform's own digest: the same in a page and in node. */
export async function fingerprintOf(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Whether a call of this method may change something: every tier but read, and not a report that only looks. */
export function changes(method: ApiMethod): boolean {
  return method.tool.tier === 'write' || (method.tool.tier === 'see' && method.tool.onASheet !== 'read')
}

export const refusedInScript = (refusal: AgentRefusal, message: string): SandboxAnswer => ({ ok: false, refusal, message })

/** A plain call's answer as a script is handed it. A picture has no place in one. */
export function handed(answer: AgentAnswer): SandboxAnswer {
  if (!answer.ok) return refusedInScript(answer.refusal, answer.detail ?? answer.refusal)
  const block = answer.content[0]
  if (answer.content.length !== 1 || !block || block.type !== 'text') {
    return refusedInScript('agent.notInScript', 'the call answers something other than data: use the plain tool')
  }
  return { ok: true, value: block.text }
}

/** What one script's calls came to, counted where they are answered. */
export type Counted = {
  calls: number
  writes: number
  readonly scopesRead: Set<string>
  readonly scopesWritten: Set<string>
}

/** One script as its run holds it: its text's fingerprint, the API it sees, and its counts. */
export type Running = {
  readonly hash: string
  readonly host: CodeHost
  readonly api: ReadonlyMap<string, ApiMethod>
  readonly counted: Counted
}

/** A call out of a script, once it has been counted and found callable: the method, and its arguments as an object. */
export type Entered = { readonly n: number; readonly name: string; readonly method: ApiMethod; readonly args: Record<string, unknown> }

/**
 * A call out of a script, met before it is answered: counted, charged, and
 * refused where a script has no such method, may not call it, or passed
 * something other than one object. The scope `lv` was bound to is put on the
 * arguments where the method takes one and none was said.
 */
export function entering({ host, api, counted }: Running, name: string, raw: string, bound: string | undefined): Entered | SandboxAnswer {
  counted.calls += 1
  if (counted.calls > host.limits.calls) return { stop: 'calls' }
  if (counted.calls % CALLS_PER_CHARGE === 0 && host.charge && !host.charge()) return { stop: 'rate' }
  const method = api.get(name)
  if (!method) return refusedInScript('agent.unknownTool', name)
  if (method.notInScript !== undefined) return refusedInScript('agent.notInScript', `${name}: ${method.notInScript}`)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return refusedInScript('agent.badArguments', `${name} takes one object`)
  const given = parsed as Record<string, unknown>
  const scoped = 'scope' in method.tool.inputSchema.properties && given.scope === undefined && bound !== undefined
  return { n: counted.calls, name, method, args: scoped ? { ...given, scope: bound } : given }
}

/** A script's own failure as an answer says it: its message, cut to what an answer carries. */
function failureText(thrown: string): string {
  return thrown.length > MOST_FAILURE_TEXT ? `${thrown.slice(0, MOST_FAILURE_TEXT)}…` : thrown
}

/** How one kind of script is run: the calls it may make, and what its answer says around what it returned. */
export type ScriptKind = {
  readonly op: 'query' | 'simulate'
  call(running: Running): SandboxCall
  /** The answer's fields beside `result`, once the script has returned. */
  answered(running: Running): Record<string, unknown>
}

/**
 * Run one script of this kind for this caller. `running` is who has a
 * script running on this host: one at a time each.
 */
export async function runScript(kind: ScriptKind, rawArgs: unknown, host: CodeHost, running: Set<string>): Promise<AgentAnswer> {
  const wrong = checkArguments(codeToolSpec(kind.op).inputSchema, rawArgs)
  if (wrong) return refused('agent.badArguments', wrong)
  const { script: source, scope } = rawArgs as { script: string; scope?: string }
  const bytes = bytesOf(source)
  const counted: Counted = { calls: 0, writes: 0, scopesRead: new Set(), scopesWritten: new Set() }
  // Asked before anything is awaited, so two scripts that arrive together cannot both find nobody running.
  const refusedAt: ScriptLimit | undefined = bytes > host.limits.scriptBytes ? 'script' : running.has(host.holder) ? 'concurrent' : undefined
  if (refusedAt === undefined) running.add(host.holder)
  try {
    const hash = await fingerprintOf(source)
    const said = (outcome: 'ok' | AgentRefusal, more: { cpuMs?: number; resultBytes?: number; limit?: ScriptLimit } = {}): void => {
      const line: ScriptReport = {
        op: kind.op, hash, bytes,
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
    const held: Running = { hash, host, api: new Map(api.map((method) => [method.name, method])), counted }
    const sandbox = await host.sandbox()
    const outcome = await sandbox.run({
      script: source,
      methods: api.map((method) => method.name),
      ...(scope !== undefined ? { scope } : {}),
      limits: host.limits,
      call: kind.call(held),
    })
    if (!outcome.ok) {
      if ('limit' in outcome) return stopped(outcome.limit, outcome.cpuMs)
      said('agent.scriptFailed', { cpuMs: outcome.cpuMs })
      return refused('agent.scriptFailed', failureText(outcome.thrown))
    }
    const resultBytes = bytesOf(outcome.result)
    if (resultBytes > host.limits.resultBytes) return stopped('result', outcome.cpuMs)
    // Written as text around the script's own JSON rather than parsed and written again.
    const around = JSON.stringify(kind.answered(held))
    const answered = text(`{"result":${outcome.result}${around === '{}' ? '' : `,${around.slice(1, -1)}`}}`)
    said('ok', { cpuMs: outcome.cpuMs, resultBytes })
    return host.named ? await host.named(answered) : answered
  } finally {
    if (refusedAt === undefined) running.delete(host.holder)
  }
}
