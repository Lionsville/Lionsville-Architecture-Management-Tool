// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sandbox, held to what it is for: a script reaches nothing but the
 * calls it is handed, and every way it can cost too much is stopped — each
 * limit tripped here by a script written to trip it.
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { quickjsSandbox } from './quickjs'
import type { SandboxAnswer, SandboxOutcome, SandboxRun } from './sandbox'

const sandbox = quickjsSandbox()
afterAll(() => sandbox.dispose?.())

const LIMITS = { cpuMs: 300, wallMs: 2_000, memoryBytes: 16 * 1024 * 1024, stackBytes: 64 * 1024 }

type Asked = { method: string; args: unknown; scope: string | undefined }

function run(script: string, over: Partial<SandboxRun> = {}, asked: Asked[] = []): Promise<SandboxOutcome> {
  return sandbox.run({
    script,
    methods: ['elements.list', 'elements.describe', 'search'],
    limits: LIMITS,
    call: (method, args, scope) => {
      asked.push({ method, args: JSON.parse(args), scope })
      return Promise.resolve<SandboxAnswer>({ ok: true, value: JSON.stringify({ method, scope: scope ?? null }) })
    },
    ...over,
  })
}

const returned = async (script: string, over: Partial<SandboxRun> = {}): Promise<unknown> => {
  const outcome = await run(script, over)
  if (!outcome.ok) throw new Error(JSON.stringify(outcome))
  return JSON.parse(outcome.result)
}

describe('a script in the sandbox', () => {
  it('is the body of an async function with lv in scope, and answers what it returns as JSON', async () => {
    const asked: Asked[] = []
    const outcome = await run('const a = await lv.elements.list({ kind: "application" }); const b = await lv.search(); return [a, b, 1 + 1]', {}, asked)
    expect(outcome).toMatchObject({ ok: true })
    expect(JSON.parse((outcome as { result: string }).result)).toEqual([{ method: 'elements.list', scope: null }, { method: 'search', scope: null }, 2])
    expect(asked).toEqual([
      { method: 'elements.list', args: { kind: 'application' }, scope: undefined },
      { method: 'search', args: {}, scope: undefined },
    ])
    expect(await returned('return')).toBeNull()
    expect(await returned('return () => 1')).toBeNull()
  })

  it('binds a scope with lv.in, and starts from the one it was given', async () => {
    const asked: Asked[] = []
    await run('await lv.elements.list(); await lv.in("acme/retail").elements.list(); await lv.in("").search()', { scope: 'acme' }, asked)
    expect(asked.map((one) => one.scope)).toEqual(['acme', 'acme/retail', ''])
  })

  it('reaches nothing of the process it runs in', async () => {
    expect(await returned(`return [
      typeof require, typeof process, typeof module, typeof globalThis.global, typeof fetch, typeof XMLHttpRequest, typeof WebSocket,
      typeof setTimeout, typeof setInterval, typeof setImmediate, typeof queueMicrotask, typeof console, typeof WebAssembly,
      typeof Deno, typeof Bun, typeof window, typeof document, typeof navigator, typeof Worker, typeof importScripts, typeof host,
    ]`)).toEqual(Array.from({ length: 21 }, () => 'undefined'))
    // What it can build for itself is still inside: a function made from text sees the same nothing.
    expect(await returned('return [new Function("return typeof process")(), (0, eval)("typeof require")]')).toEqual(['undefined', 'undefined'])
    expect(await returned('return Object.keys(lv).sort()')).toEqual(['elements', 'in', 'search'])
    // No module can be asked for, by either way of asking.
    expect(await run('const fs = await import("node:fs"); return typeof fs')).toMatchObject({ ok: false })
    // lv cannot be given more than it was made with, and its calls hand over strings alone.
    expect(await returned('"use strict"; try { lv.extra = 1; return "set" } catch (e) { return e.name }')).toBe('TypeError')
    expect(await returned('const answer = await lv.search(); return Object.getPrototypeOf(answer) === Object.prototype')).toBe(true)
  })

  it('throws a refusal where it was made, with its key, and the script may catch it', async () => {
    const refusing: SandboxRun['call'] = () => Promise.resolve({ ok: false, refusal: 'agent.unknownId', message: 'element nowhere' })
    expect(await returned('try { await lv.elements.describe({ id: "nowhere" }) } catch (e) { return [e.name, e.refusal, e.message] }', { call: refusing }))
      .toEqual(['Refusal', 'agent.unknownId', 'element nowhere'])
    expect(await run('await lv.elements.describe({ id: "nowhere" })', { call: refusing })).toMatchObject({ ok: false, thrown: 'Refusal: element nowhere' })
  })

  it('says a script that throws, or will not compile, in the script\'s own words', async () => {
    expect(await run('throw new Error("mine")')).toMatchObject({ ok: false, thrown: 'mine' })
    expect(await run('return (')).toMatchObject({ ok: false, thrown: expect.stringContaining('SyntaxError') as string })
    // A text that closes the function it was made the body of runs on as a program, with less in reach than it had.
    expect(await run('}); globalThis.seen = typeof lv + typeof host; (async () => {')).toMatchObject({ ok: true, result: 'null' })
    expect(await returned('return typeof host + typeof names + typeof bind + typeof AsyncFunction')).toBe('undefined'.repeat(4))
  })
})

describe('a script that costs too much is stopped', () => {
  it('at its processing: an endless loop', async () => {
    const outcome = await run('for (;;) {}')
    expect(outcome).toMatchObject({ ok: false, limit: 'cpu' })
    expect(outcome.cpuMs).toBeGreaterThanOrEqual(LIMITS.cpuMs)
    expect(outcome.cpuMs).toBeLessThan(LIMITS.cpuMs + 500)
  })

  it('at its processing: an endless loop the script tries to catch', async () => {
    expect(await run('try { for (;;) {} } catch (e) { return "caught" } finally { for (;;) {} }')).toMatchObject({ ok: false, limit: 'cpu' })
  })

  it('at its processing: a regular expression that backtracks without end', async () => {
    expect(await run('return /^(a+)+$/.test("a".repeat(40) + "!")')).toMatchObject({ ok: false, limit: 'cpu' })
    expect(await run('return "x".repeat(60).replace(/(x+x+)+y/, "")')).toMatchObject({ ok: false, limit: 'cpu' })
  })

  it('at its processing: an endless chain of promises', async () => {
    expect(await run('const again = () => Promise.resolve().then(again); await again()')).toMatchObject({ ok: false, limit: 'cpu' })
    // One nobody waits for, in a script that has long since returned: the processing was spent all the same.
    expect(await run('(async function again() { for (;;) await null })(); return 1')).toMatchObject({ ok: false, limit: 'cpu' })
  })

  it('at its processing, added up over its calls: none of the waiting counts, all of the computing does', async () => {
    const slow: SandboxRun['call'] = () => new Promise((resolve) => { setTimeout(() => resolve({ ok: true, value: '1' }), 150) })
    // Three calls of 150 ms each are 450 ms on the clock and almost none of processing.
    expect(await run('for (let n = 0; n < 3; n++) await lv.search(); return "done"', { call: slow })).toMatchObject({ ok: true })
    // A little computing after each call adds up past the limit, though no one stretch does.
    const busy = 'const spin = (ms) => { const until = Date.now() + ms; while (Date.now() < until) {} }; for (let n = 0; n < 4; n++) { await lv.search(); spin(120) }; return "done"'
    expect(await run(busy)).toMatchObject({ ok: false, limit: 'cpu' })
  })

  it('at its memory: an allocation that does not end', async () => {
    expect(await run('const held = []; for (;;) held.push(new Array(100000).fill("x"))', { limits: { ...LIMITS, cpuMs: 5_000 } }))
      .toMatchObject({ ok: false, limit: 'memory' })
    // One it catches gets it to the next limit, not past it.
    const outcome = await run('const held = []; for (;;) { try { held.push(new Array(100000).fill("x")) } catch (e) {} }', { limits: { ...LIMITS, cpuMs: 1_000 } })
    expect(outcome).toMatchObject({ ok: false })
    expect(['cpu', 'memory']).toContain((outcome as { limit?: string }).limit)
  })

  it('at its stack: a recursion that does not end, whichever stack gives out first', async () => {
    expect(await run('const down = () => down() + 1; return down()')).toMatchObject({ ok: false, limit: 'stack' })
    // Nesting the reader itself recurses on: the script's text, and what it asks the language to read.
    expect(await run(`return ${'('.repeat(8000)}1${')'.repeat(8000)}`)).toMatchObject({ ok: false, limit: 'stack' })
    expect(await run('return JSON.parse("[".repeat(100000) + "]".repeat(100000))')).toMatchObject({ ok: false, limit: 'stack' })
    // And the sandbox runs the next script as if nothing had happened.
    expect(await returned('return 1 + 1')).toBe(2)
  })

  it('on the clock: a call that is never answered', async () => {
    const never: SandboxRun['call'] = () => new Promise(() => {})
    const started = Date.now()
    expect(await run('await lv.search()', { call: never, limits: { ...LIMITS, wallMs: 200 } })).toMatchObject({ ok: false, limit: 'wall' })
    expect(Date.now() - started).toBeLessThan(1_500)
  })

  it('at a count its caller keeps, whatever the script would have caught', async () => {
    let calls = 0
    const counting: SandboxRun['call'] = () => Promise.resolve((calls += 1) > 3 ? { stop: 'calls' } : { ok: true, value: '1' })
    expect(await run('for (;;) { try { await lv.search() } catch (e) {} }', { call: counting })).toMatchObject({ ok: false, limit: 'calls' })
    expect(calls).toBe(4)
  })

  it('and holds nothing over to the next script', async () => {
    await run('globalThis.kept = 1; Object.prototype.kept = 1; return 1')
    expect(await returned('return [typeof kept, ({}).kept === undefined]')).toEqual(['undefined', true])
  })

  it('leaves no timer behind it', async () => {
    const before = process.getActiveResourcesInfo().filter((kind) => kind === 'Timeout').length
    await run('return 1')
    await run('for (;;) {}')
    expect(process.getActiveResourcesInfo().filter((kind) => kind === 'Timeout').length).toBeLessThanOrEqual(before)
  })
})

describe('the file the interpreter is in', () => {
  /**
   * A host that runs scripts on a thread of its own loads this one file
   * there, from source, with nothing to resolve the rest of the tree by: so
   * it imports the interpreter and types, and nothing else of this tree.
   */
  it('loads alone in a plain node process, and runs a script there', () => {
    const program = `
      const { quickjsSandbox } = await import('./src/agent/code/quickjs.ts')
      const outcome = await quickjsSandbox().run({
        script: 'return (await lv.elements.list()).n + 1', methods: ['elements.list'],
        limits: { cpuMs: 500, wallMs: 2000, memoryBytes: 16777216, stackBytes: 65536 },
        call: async () => ({ ok: true, value: '{"n":41}' }),
      })
      console.log(JSON.stringify(outcome))
    `
    const out = execFileSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--input-type=module', '-e', program], {
      cwd: resolve(import.meta.dirname, '../../..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(JSON.parse(out)).toMatchObject({ ok: true, result: '42' })
  }, 60_000)
})
