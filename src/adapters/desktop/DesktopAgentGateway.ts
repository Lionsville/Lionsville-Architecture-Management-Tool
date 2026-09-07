/**
 * The agent seam, over the desktop's own two messages (ADR-0007).
 *
 * Main relays a tool call as `agent:request`; this hands it to whoever is
 * listening and sends the answer back as `agent:answer`, correlated by the id
 * main put on the request. The handler's promise is awaited here so that a
 * handler which throws still produces an answer: a client is waiting, and a
 * refusal it can read beats a timeout it has to guess about.
 */
import type { AgentAnswer, AgentRequest } from '../../agent/tools'
import { refused } from '../../agent/tools'
import type { AgentServerPatch, AgentServerStatus } from '../../platform/agentServer'
import { reasonOf } from '../../platform/errors'
import type { AgentGateway } from '../../ports/AgentGateway'
import type { DesktopAgent } from './channel'

export class DesktopAgentGateway implements AgentGateway {
  readonly id = 'desktop'

  constructor(private readonly channel: DesktopAgent) {}

  on(handler: (request: AgentRequest) => Promise<AgentAnswer>): () => void {
    return this.channel.onRequest((request) => {
      void Promise.resolve()
        .then(() => handler(request))
        .catch((cause: unknown): AgentAnswer => refused('agent.noAnswer', reasonOf(cause)))
        .then((answer) => this.channel.answer(request.id, answer))
        // The answer itself could not be sent — the channel is gone. Nothing
        // is left to tell.
        .catch(() => undefined)
    })
  }

  status(): Promise<AgentServerStatus> {
    return this.channel.status()
  }

  onStatus(listener: (status: AgentServerStatus) => void): () => void {
    return this.channel.onStatus(listener)
  }

  configure(patch: AgentServerPatch): Promise<AgentServerStatus> {
    return this.channel.configure(patch)
  }

  newToken(): Promise<AgentServerStatus> {
    return this.channel.newToken()
  }
}
