// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The binding between the agent seam and the app (ADR-0007, ADR-0019).
 *
 * A few lines on purpose: subscribe to the gateway once, and hand each
 * request to the handler in `agent/` together with the session that is open
 * at that moment and the shell around it. The session is read through a
 * getter rather than held, because the workspace that owns it remounts on
 * every scope switch — and an agent's `app.open` is what causes the switch,
 * so the subscription must outlive it. With no scope open the handler is
 * given no session, and answers what it can about the organisation.
 */
import { useEffect, useRef } from 'react'
import type { SessionView } from '../agent/handle'
import type { ShellView } from '../agent/shell'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'

/**
 * The handler, fetched with the first request rather than with the page. The
 * agent — every tool, its schema and its sentences, and the readers and
 * writers behind them — is the largest module the shell does not draw, and a
 * page with no agent to answer (a browser's, where no gateway is lent) never
 * asks for it. Where one is lent, the first call waits for one script; every
 * call after has it.
 */
const loadHandle = () => import('../agent/handle').then((held) => held.handle)

/**
 * Code mode (ADR-0051), fetched with the first script: the tools that run
 * one, the host they run it against, and the interpreter — its glue a
 * script of its own and its WebAssembly a file beside the app
 * (`build/quickjsWasm.ts`), neither of them loaded by a window nobody sends
 * a script to. One code mode a window: it holds the simulations waiting to
 * be run, and who has a script running.
 */
let code: Promise<(request: AgentRequest, session: () => SessionView | undefined, shell: ShellView | undefined) => Promise<AgentAnswer>> | undefined
const loadCode = () => (code ??= Promise.all([
  import('../agent/code/query'), import('../agent/code/sessionHost'), import('../agent/code/quickjs'),
]).then(([{ codeMode }, { sessionHost }, { quickjsSandbox }]) => {
  const mode = codeMode()
  // The address the build publishes the interpreter at, as the router's file is addressed (`main.tsx`).
  const sandbox = quickjsSandbox({ wasmLocation: new URL(`/${QUICKJS_WASM}`, window.location.origin).href })
  return (request, session, shell) => mode.answer(request, sessionHost({ session, shell, sandbox: () => Promise.resolve(sandbox) }))
}))

/** Which names are code mode's: asked with the handler, of a script as small as the question. */
const loadCodeTools = () => import('../agent/code/codeTools')

/** Where the page fetches the interpreter from: the name `build/quickjsWasm.ts` publishes it under. */
const QUICKJS_WASM = 'quickjs.wasm'

export function useAgentGateway(
  gateway: AgentGateway | undefined,
  session: () => SessionView | undefined,
  shell: ShellView | undefined,
): void {
  // Refs, so a shell whose accessors are rebuilt on render does not mean
  // resubscribing on render: the subscription is per gateway, the view per call.
  const current = useRef({ session, shell })
  current.current = { session, shell }

  useEffect(() => gateway?.on(async (request) => {
    // The session open when the request arrived, not when the handler did.
    const held = current.current
    const session = held.session()
    const [handle, { isCodeTool }] = await Promise.all([loadHandle(), loadCodeTools()])
    // A script, or what a script sees: answered by code mode, over the session open as each of its calls is made.
    if (isCodeTool(request.tool)) return (await loadCode())(request, held.session, held.shell)
    return handle(request, session, held.shell)
  }), [gateway])
}
