/**
 * The listener: Node's own `http`, on the loopback, one endpoint.
 *
 * Separate from `mcp.ts` so it can be started in a test with no Electron in
 * the process, and connected to with the real SDK client. What it knows is a
 * token, a relay and a port; what it does not know is where either came from.
 *
 * The port is asked for, not insisted on. A kept port that is busy at start —
 * another copy of the app, a service that took it since yesterday — means
 * listening on another and telling the caller, which is what the dialog then
 * says. Asking for port 0 is asking the OS to pick.
 */
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { AGENT_ENDPOINT_PATH, AGENT_HOST } from '../../src/platform/agentServer'
import { serve } from './mcpProtocol'
import type { Relay, ServerIdentity } from './mcpProtocol'

/** A tool call's body is small; a megabyte is somebody else's mistake. */
const MAX_BODY_BYTES = 1_048_576

export type AgentListener = {
  readonly port: number
  close(): Promise<void>
}

export async function listen(options: {
  port: number
  token: string
  relay: Relay
  server: ServerIdentity
}): Promise<AgentListener> {
  const server = createServer((request, response) => {
    void handle(request, response, options).catch(() => {
      if (!response.headersSent) response.writeHead(500)
      response.end()
    })
  })
  // A client that holds a connection open must not hold the app's quit.
  server.keepAliveTimeout = 5_000

  const port = await bind(server, options.port).catch(async (cause: unknown) => {
    if ((cause as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw cause
    return bind(server, 0)
  })

  return {
    port,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    }),
  }
}

function bind(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (cause: Error) => { server.off('listening', onListening); reject(cause) }
    const onListening = () => {
      server.off('error', onError)
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, AGENT_HOST)
  })
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  options: { token: string; relay: Relay; server: ServerIdentity },
): Promise<void> {
  const body = await readBody(request)
  if (body === undefined) {
    response.writeHead(413)
    response.end()
    return
  }
  const url = new URL(request.url ?? '/', `http://${AGENT_HOST}`)
  const decision = await serve({
    method: request.method ?? 'GET',
    path: url.pathname,
    authorization: header(request, 'authorization'),
    contentType: header(request, 'content-type'),
    body,
  }, { token: options.token, endpoint: AGENT_ENDPOINT_PATH, relay: options.relay, server: options.server })

  response.writeHead(decision.status, decision.headers ?? {})
  response.end(decision.body ?? '')
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

/** The whole body as text, or `undefined` when it is bigger than any honest call. */
function readBody(request: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        request.destroy()
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}
