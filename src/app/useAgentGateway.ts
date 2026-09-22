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
import { handle } from '../agent/handle'
import type { SessionView } from '../agent/handle'
import type { ShellView } from '../agent/shell'
import type { AgentGateway } from '../ports/AgentGateway'

export function useAgentGateway(
  gateway: AgentGateway | undefined,
  session: () => SessionView | undefined,
  shell: ShellView | undefined,
): void {
  // Refs, so a shell whose accessors are rebuilt on render does not mean
  // resubscribing on render: the subscription is per gateway, the view per call.
  const current = useRef({ session, shell })
  current.current = { session, shell }

  useEffect(() => gateway?.on((request) => {
    const held = current.current
    return handle(request, held.session(), held.shell)
  }), [gateway])
}
