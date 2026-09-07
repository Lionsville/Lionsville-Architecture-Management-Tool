/**
 * Where an agent's calls arrive (ADR-0007).
 *
 * The traffic runs the other way from `HostCommands`: there the host tells and
 * the app listens; here the host *asks* and the app *answers*. Each request is
 * one tool call an MCP client made to the desktop's main process, relayed to
 * the window; the answer goes back the same way and becomes the client's
 * result.
 *
 * Absent on a shell that has no host to relay for — a browser tab — the way
 * `history?` is, rather than a null object that answers nothing. What the
 * request and the answer look like is `agent/tools.ts`, which both ends of
 * the wire compile against.
 */
import type { AgentAnswer, AgentRequest } from '../agent/tools'

export interface AgentGateway {
  readonly id: string

  /**
   * Every request, until the returned function is called. Answer each one:
   * a request nobody answers is a client waiting on a timeout.
   */
  on(handler: (request: AgentRequest) => Promise<AgentAnswer>): () => void
}
