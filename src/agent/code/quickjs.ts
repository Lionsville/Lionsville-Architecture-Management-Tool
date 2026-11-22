// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sandbox that ships (ADR-0050): QuickJS compiled to WebAssembly, an
 * interpreter inside an interpreter.
 *
 * **Why this one.** A script must not reach the process it runs in, and the
 * host's own JavaScript engine offers no boundary that holds a memory limit
 * and stops a chain of promises. QuickJS as WebAssembly is a second engine
 * with nothing of the host's in it: no `require`, no `process`, no `fetch`,
 * no timers — it has the language and what is put into it, which here is one
 * function. It builds for nothing and loads in a page and in node alike.
 *
 * **What crosses.** One function in (`SandboxCall`), strings only: a
 * method's name, its argument as JSON, a scope. One string out: what the
 * script returned, as JSON, serialised inside the interpreter. `lv` itself
 * is built inside, by {@link PRELUDE}, out of that one function and the list
 * of method names. No host object is ever handed in, so there is no host
 * object to climb out through.
 *
 * **How it is stopped.**
 * - Processing: the interrupt handler, asked by the interpreter every few
 *   thousand operations — inside a regular expression too — against the time
 *   spent *inside* it, added up over the script's first run and every round
 *   of pending jobs. An interrupt cannot be caught by the script.
 * - Memory and stack: the runtime's own limits. A script that catches the
 *   error it gets goes on to meet the next one, or the interrupt.
 * - The clock: a timer here, which only has to cover the time a script
 *   waits on its calls, since the time it computes is the interrupt's.
 * - A count the caller keeps (calls, writes): the call answers `stop`.
 *
 * **One runtime a script, one module for all of them.** A runtime holds
 * nothing of the script before it. The module is the interpreter's
 * instance, kept while scripts end of themselves. It is let go of whole,
 * and the next script given a new one, where a script was stopped or left
 * work behind it — its runtime is not torn down around what it still held —
 * and where the host's own stack overflowed under the interpreter, since
 * nothing unwound the interpreter's stack then.
 *
 * The only file that imports the interpreter, and it imports nothing else
 * of this tree but types, so a thread that runs it loads this file alone.
 */
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core'
import type { QuickJSContext, QuickJSDeferredPromise, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten-core'
import releaseSync from '@jitl/quickjs-wasmfile-release-sync'
import type { ScriptLimit } from './limits'
import type { Sandbox, SandboxAnswer, SandboxOutcome, SandboxRun } from './sandbox'

/** Where the interpreter's WebAssembly comes from, where the package's own way of finding it is not the host's. */
export type QuickJsSource = {
  /** The compiled module, where the host fetched and compiled the file itself. */
  readonly wasmModule?: WebAssembly.Module
  /** The file's bytes. */
  readonly wasmBinary?: ArrayBuffer
  /** The file's address. */
  readonly wasmLocation?: string
}

/**
 * `lv`, built inside the interpreter from the one function it is handed.
 * Run once per script; answers a function that takes the script's text and
 * answers a promise of what it returned, as JSON.
 *
 * The script is made into an async function by the interpreter's own
 * constructor, in the global scope: `lv` is its one argument, and neither
 * the function it calls out through nor anything else of this prelude is in
 * its reach. A script whose text closes that function early runs the rest
 * as a program in the same interpreter, with less in scope than it had.
 */
const PRELUDE = `(function (host, names, scope) {
  'use strict'
  const refusal = (text) => {
    let said
    try { said = JSON.parse(text) } catch (e) { said = { message: String(text) } }
    const error = new Error(said.message)
    error.name = 'Refusal'
    error.refusal = said.refusal
    return error
  }
  const parsed = (text) => { try { return JSON.parse(text) } catch (e) { return text } }
  const bind = (bound) => {
    const lv = {}
    for (const name of names) {
      const call = (args) => host(name, args === undefined ? '{}' : JSON.stringify(args), bound).then(parsed, (text) => { throw refusal(text) })
      const dot = name.indexOf('.')
      if (dot < 0) lv[name] = call
      else (lv[name.slice(0, dot)] ??= {})[name.slice(dot + 1)] = call
    }
    for (const area of Object.values(lv)) if (typeof area === 'object') Object.freeze(area)
    lv.in = (path) => bind(String(path))
    return Object.freeze(lv)
  }
  const lv = bind(scope)
  const AsyncFunction = (async () => {}).constructor
  return (script) => new AsyncFunction('lv', script)(lv).then((value) => JSON.stringify(value === undefined ? null : value) ?? 'null')
})`

/** The interpreter's own words for its three limits, which a script that does not catch them is failed with. */
const LIMIT_OF: Readonly<Record<string, ScriptLimit>> = {
  'interrupted': 'cpu',
  'out of memory': 'memory',
  'stack overflow': 'stack',
}

/** A failure inside the interpreter, as the message a script's own failure is said with — or the limit it is. */
function failureOf(dumped: unknown): { limit: ScriptLimit } | { thrown: string } {
  if (dumped && typeof dumped === 'object') {
    const { name, message } = dumped as { name?: unknown; message?: unknown }
    // The stack's is said under more than one name, by whichever part of the interpreter ran out of it.
    const limit = typeof message === 'string' && (name === 'InternalError' || message === 'stack overflow') ? LIMIT_OF[message] : undefined
    if (limit) return { limit }
    if (typeof message === 'string') return { thrown: typeof name === 'string' && name !== 'Error' ? `${name}: ${message}` : message }
  }
  if (typeof dumped === 'string') return { thrown: dumped }
  try {
    return { thrown: JSON.stringify(dumped) ?? String(dumped) }
  } catch {
    return { thrown: String(dumped) }
  }
}

/** The host's own stack gave out under the interpreter: not an error of the script's that the interpreter caught. */
function hostStackOverflow(error: unknown): boolean {
  return error instanceof RangeError
}

/** One script's run: its runtime, the time it has computed, and how it ends. */
class Run {
  private readonly runtime: QuickJSRuntime
  private readonly vm: QuickJSContext
  private readonly pending = new Set<QuickJSDeferredPromise>()
  private spent = 0
  private since: number | undefined
  private stopped: ScriptLimit | undefined
  private ended = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private finish: (outcome: SandboxOutcome) => void = () => {}
  /** Set where the interpreter is no longer to be trusted, and the module is to be let go of. */
  broken = false
  private readonly run: SandboxRun

  constructor(module: QuickJSWASMModule, run: SandboxRun) {
    this.run = run
    this.runtime = module.newRuntime()
    this.runtime.setMemoryLimit(run.limits.memoryBytes)
    this.runtime.setMaxStackSize(run.limits.stackBytes)
    this.runtime.setInterruptHandler(() => {
      if (this.stopped !== undefined) return true
      if (this.since !== undefined && this.spent + (performance.now() - this.since) > run.limits.cpuMs) this.stopped = 'cpu'
      return this.stopped !== undefined
    })
    this.vm = this.runtime.newContext()
  }

  private cpuMs(): number {
    return Math.round(this.spent)
  }

  /** Work inside the interpreter, timed: the only time the processing limit counts. */
  private inside<T>(work: () => T): T {
    this.since = performance.now()
    try {
      return work()
    } finally {
      this.spent += performance.now() - this.since
      this.since = undefined
    }
  }

  private end(outcome: SandboxOutcome): void {
    if (this.ended) return
    this.ended = true
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.finish(outcome)
  }

  private stop(limit: ScriptLimit): void {
    this.stopped ??= limit
    this.end({ ok: false, limit: this.stopped, cpuMs: this.cpuMs() })
  }

  /** The host's stack overflowed under the interpreter, or it failed in a way of its own: the script is over. */
  private failed(error: unknown): void {
    this.broken = true
    if (hostStackOverflow(error)) this.stop('stack')
    else this.end({ ok: false, thrown: 'the script could not be run', cpuMs: this.cpuMs() })
  }

  /** Run what the script queued: the continuations of whatever was just settled. */
  private pump(): void {
    if (this.ended) return
    try {
      const jobs = this.inside(() => this.runtime.executePendingJobs())
      if (jobs.error) {
        const failure = failureOf(this.vm.dump(jobs.error))
        jobs.error.dispose()
        // A job that threw is a promise nobody caught, which the script's own promise says; a limit is the end.
        if ('limit' in failure) this.stop(failure.limit)
      }
      // An interrupt inside a function that awaits rejects that function's promise and leaves no error here:
      // the limit was met all the same, whatever the script had returned by then.
      if (this.stopped !== undefined) this.stop(this.stopped)
    } catch (error) {
      this.failed(error)
    }
  }

  /** The one function a script has: a call out, answered later with a string. */
  private hostFunction(): QuickJSHandle {
    return this.vm.newFunction('host', (nameHandle, argsHandle, scopeHandle) => {
      const name = this.vm.getString(nameHandle)
      const args = this.vm.typeof(argsHandle) === 'string' ? this.vm.getString(argsHandle) : '{}'
      const scope = this.vm.typeof(scopeHandle) === 'string' ? this.vm.getString(scopeHandle) : undefined
      const deferred = this.vm.newPromise()
      this.pending.add(deferred)
      const settle = (answer: SandboxAnswer): void => {
        if (this.ended || !this.pending.delete(deferred)) return
        if ('stop' in answer) {
          deferred.dispose()
          this.stop(answer.stop)
          return
        }
        try {
          const said = this.vm.newString(answer.ok ? answer.value : JSON.stringify({ refusal: answer.refusal, message: answer.message }))
          if (answer.ok) deferred.resolve(said)
          else deferred.reject(said)
          said.dispose()
          deferred.dispose()
        } catch (error) {
          this.failed(error)
          return
        }
        this.pump()
      }
      this.run.call(name, args, scope).then(settle, () => settle({ ok: false, refusal: 'agent.failed', message: 'the call failed where it was answered' }))
      return deferred.handle
    })
  }

  /** Start the script, and answer how it ended. */
  start(): Promise<SandboxOutcome> {
    const outcome = new Promise<SandboxOutcome>((resolve) => { this.finish = resolve })
    this.timer = setTimeout(() => { this.stop('wall') }, this.run.limits.wallMs)
    try {
      const prelude = this.inside(() => this.vm.evalCode(PRELUDE, 'lv.js'))
      const build = this.vm.unwrapResult(prelude)
      const host = this.hostFunction()
      const names = this.vm.unwrapResult(this.vm.evalCode(`(${JSON.stringify(this.run.methods)})`, 'names.js'))
      const scope = this.run.scope === undefined ? this.vm.undefined : this.vm.newString(this.run.scope)
      const runner = this.vm.unwrapResult(this.inside(() => this.vm.callFunction(build, this.vm.undefined, host, names, scope)))
      for (const handle of [build, host, names, scope]) handle.dispose()
      const text = this.vm.newString(this.run.script)
      const called = this.inside(() => this.vm.callFunction(runner, this.vm.undefined, text))
      text.dispose()
      runner.dispose()
      if (called.error) {
        // The script would not compile: its own words, or the stack or memory it took to read it.
        const failure = failureOf(this.vm.dump(called.error))
        called.error.dispose()
        if ('limit' in failure) this.stop(failure.limit)
        else this.end({ ok: false, thrown: failure.thrown, cpuMs: this.cpuMs() })
        return outcome
      }
      const promise = called.value
      this.vm.resolvePromise(promise).then((settled) => {
        if (this.ended) {
          if (settled.error) settled.error.dispose()
          else settled.value.dispose()
          return
        }
        if (settled.error) {
          const failure = failureOf(this.vm.dump(settled.error))
          settled.error.dispose()
          if ('limit' in failure) this.stop(this.stopped ?? failure.limit)
          else this.end({ ok: false, thrown: failure.thrown, cpuMs: this.cpuMs() })
          return
        }
        const result = this.vm.getString(settled.value)
        settled.value.dispose()
        this.end({ ok: true, result, cpuMs: this.cpuMs() })
      }, (error: unknown) => { this.failed(error) })
      promise.dispose()
      this.pump()
    } catch (error) {
      // What the interpreter itself threw while the script was set up: an error of its own about a limit, or the host's stack.
      const failure = hostStackOverflow(error) ? undefined : failureOf((error as { cause?: unknown }).cause ?? error)
      if (failure && 'limit' in failure) this.stop(failure.limit)
      else this.failed(error)
    }
    return outcome
  }

  /**
   * Let go of everything the script held, where it ended of itself with
   * nothing left waiting. A script that was stopped, or that left a call or a
   * job behind it, still holds values the runtime would have to be torn down
   * around: that runtime is left as it is and its interpreter let go of whole
   * instead, which frees the same memory and cannot fail halfway.
   */
  dispose(): void {
    if (this.stopped !== undefined || this.pending.size > 0 || this.broken) {
      this.broken = true
      return
    }
    try {
      if (this.runtime.hasPendingJob()) {
        this.broken = true
        return
      }
      this.vm.dispose()
      this.runtime.dispose()
    } catch {
      this.broken = true
    }
  }
}

/**
 * The sandbox over QuickJS. The interpreter is loaded when the first script
 * is run and never before, so a host that is never sent one never pays for it.
 */
export function quickjsSandbox(source: QuickJsSource = {}): Sandbox {
  let loading: Promise<QuickJSWASMModule> | undefined
  const load = (): Promise<QuickJSWASMModule> => {
    const customised = Object.keys(source).length > 0
    loading ??= newQuickJSWASMModuleFromVariant(customised ? newVariant(releaseSync, source) : releaseSync)
    loading.catch(() => { loading = undefined })
    return loading
  }
  return {
    async run(run) {
      const module = await load()
      const script = new Run(module, run)
      try {
        return await script.start()
      } finally {
        script.dispose()
        if (script.broken) loading = undefined
      }
    },
    dispose() {
      loading = undefined
    },
  }
}
