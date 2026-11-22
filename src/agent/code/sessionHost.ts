// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Code mode's host over a live session (ADR-0050): how the app on a person's
 * screen fills `CodeHost`, written here rather than in the shell so it is
 * tested in node beside the handler it calls.
 *
 * The scope open is the one a script may change, as it is the one a plain
 * call may: a call out of a script is `handle` over the session open at that
 * moment — a read of another scope is answered from where that scope is
 * kept, a write to one is refused `agent.scopeNotOpen` — and a simulation is
 * landed on that session as one step (`landOnSession`). A call tried on a
 * copy starts no driving session; the run does, so the banner goes up when
 * something changes and not while it is being tried.
 *
 * One caller, since one client is connected to a window at a time; no charge,
 * since nothing meters a loopback; and no trail, since what the app logs of
 * an agent's call is the tool's name and how it was answered.
 */
import { handle, withNames } from '../handle'
import type { SessionView } from '../handle'
import type { ShellView } from '../shell'
import type { CodeHost } from './host'
import { DESKTOP_LIMITS } from './limits'
import type { ScriptLimits } from './limits'
import type { Sandbox } from './sandbox'
import { landOnSession } from './simulate'

export type SessionHostParts = {
  /** The session open now, or nothing while a home is up: read for every call, since the scope open changes. */
  session(): SessionView | undefined
  shell: ShellView | undefined
  /** The interpreter, loaded with the first script. */
  sandbox(): Promise<Sandbox>
  limits?: ScriptLimits
}

export function sessionHost({ session, shell, sandbox, limits = DESKTOP_LIMITS }: SessionHostParts): CodeHost {
  return {
    holder: 'the window',
    limits,
    sandbox,
    ask: (request, over) => {
      const open = session()
      return handle(request, over && open ? over(open) : open, shell)
    },
    named: (answer) => withNames(answer, session(), shell),
    land: (simulation) => Promise.resolve(landOnSession(simulation, session(), shell)),
    plain: (request) => handle(request, session(), shell),
  }
}
