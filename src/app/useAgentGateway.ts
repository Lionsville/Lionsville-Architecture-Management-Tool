/**
 * The binding between the agent seam and the live session (ADR-0007).
 *
 * A few lines on purpose: subscribe to the gateway, hand each request to the
 * handler in `agent/` together with a narrow view of the session, and send
 * back what it says. The view reads the session through its `current()`-style
 * accessors rather than through props, so a request that arrives between two
 * renders is answered against the model as it stands and not as it last drew.
 *
 * With no project open the shell binds the same hook to no session, and every
 * request is refused with `agent.noProject` — a client is waiting, and a
 * refusal it can read beats a timeout it has to guess about.
 */
import { useEffect, useRef } from 'react'
import { handle } from '../agent/handle'
import type { SessionView } from '../agent/handle'
import { refused } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'

export function useAgentGateway(gateway: AgentGateway | undefined, session: SessionView | undefined): void {
  // A ref, so a session whose accessors are rebuilt on render does not mean
  // resubscribing on render: the subscription is per gateway, the view per call.
  const view = useRef(session)
  view.current = session

  useEffect(() => gateway?.on(async (request) => {
    const held = view.current
    return held ? handle(request, held) : refused('agent.noProject')
  }), [gateway])
}
