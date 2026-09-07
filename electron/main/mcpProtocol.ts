/**
 * The Model Context Protocol, as much of it as this app speaks (ADR-0007).
 *
 * Streamable HTTP, server side, by hand: a JSON-RPC request arrives in a POST,
 * a JSON-RPC response goes back in the body. That is the whole transport for
 * a server that never pushes — no event stream, no resumption, no session
 * store — and it is why this file is a few hundred lines and not a dependency
 * tree. The desktop ships nothing from `node_modules` at runtime
 * (`electron-builder.cjs` says why), and the SDK would have brought express,
 * hono and ajv along for a loopback relay of twenty tools. The SDK's *client*
 * is what the tests and the smoke run connect with, so what is spoken here is
 * checked against what a real client expects rather than against a reading
 * of the specification.
 *
 * Pure. Node's `http` and Electron are `mcp.ts`'s business; this file takes a
 * parsed request and answers with a response, so it can be tested with a
 * plain object at each end.
 */
import type { AgentAnswer, AgentRequest, ToolContent } from '../../src/agent/tools'
import { REFUSAL_SENTENCE, TOOLS } from '../../src/agent/tools'
import { randomUUID } from 'node:crypto'
import type { AgentClient } from '../../src/platform/agentServer'

/**
 * The newest version this server speaks, and the ones it will answer a client
 * in. A client names the version it wants in `initialize`; the server answers
 * with that one if it can, and its own newest otherwise, which is what the
 * specification asks.
 */
export const PROTOCOL_VERSION = '2025-06-18'
const SPOKEN_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

export type JsonRpcId = string | number | null

export type JsonRpcRequest = {
  jsonrpc: '2.0'
  id?: JsonRpcId
  method: string
  params?: unknown
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string; data?: unknown } }

/** JSON-RPC's own error codes, and the two MCP adds nothing to. */
export const RPC = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const

/** What the protocol layer needs from whoever owns the window. */
export type Relay = {
  /** Hand a tool call to the app and wait for its answer. */
  ask(request: AgentRequest): Promise<AgentAnswer>
  /** A client introduced itself. */
  onInitialized(client: AgentClient): void
  /** A client said goodbye — the DELETE the SDK sends on close. */
  onClosed(): void
}

export type ServerIdentity = { name: string; version: string }

/** The one sentence a client is handed on connect, so it knows what it is talking to. */
export const INSTRUCTIONS =
  'This is the Lionsville Architecture Management Tool with a project open on screen. '
  + 'Read the landscape with the read tools, and prefer ids from elements.list over guessing. '
  + 'Every change you make shows in the app\'s Activity list and is undone with ⌘Z.'

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const held = value as Record<string, unknown>
  return held['jsonrpc'] === '2.0' && typeof held['method'] === 'string'
}

/**
 * Answer one JSON-RPC message. A notification (no id) is answered with
 * nothing, which the transport turns into a 202.
 */
export async function respond(
  message: JsonRpcRequest, relay: Relay, server: ServerIdentity,
): Promise<JsonRpcResponse | undefined> {
  if (message.id === undefined) {
    // `notifications/initialized` and the like: acknowledged by the 202.
    return undefined
  }
  const id = message.id
  const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, text: string, data?: unknown): JsonRpcResponse =>
    ({ jsonrpc: '2.0', id, error: { code, message: text, ...(data !== undefined ? { data } : {}) } })
  const params = (message.params ?? {}) as Record<string, unknown>

  switch (message.method) {
    case 'initialize': {
      const wanted = params['protocolVersion']
      const client = params['clientInfo'] as Partial<AgentClient> | undefined
      relay.onInitialized({
        name: typeof client?.name === 'string' && client.name ? client.name : 'an agent',
        version: typeof client?.version === 'string' ? client.version : '',
      })
      return ok({
        protocolVersion: typeof wanted === 'string' && SPOKEN_VERSIONS.includes(wanted) ? wanted : PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: server,
        instructions: INSTRUCTIONS,
      })
    }

    case 'ping':
      return ok({})

    case 'tools/list':
      return ok({
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: {
            readOnlyHint: tool.tier === 'read',
            // A remove is the one kind of change ⌘Z is the only way back from
            // once the person has moved on; a client may ask before one.
            destructiveHint: tool.name.endsWith('.remove'),
            openWorldHint: false,
          },
        })),
      })

    case 'tools/call': {
      const name = params['name']
      if (typeof name !== 'string') return fail(RPC.invalidParams, 'tools/call needs a name')
      const answer = await relay.ask({ id: String(id), tool: name, args: params['arguments'] ?? {} })
      return ok(toolResult(answer))
    }

    case 'resources/list':
      return ok({ resources: [] })

    case 'resources/read':
      return fail(RPC.invalidParams, 'no such resource')

    default:
      return fail(RPC.methodNotFound, `method not found: ${message.method}`)
  }
}

/**
 * An answer as a client reads it. A refusal is a tool result with `isError`
 * and one sentence, not a JSON-RPC error: the call reached the app and the
 * app said no, which is an answer the model should read and act on, and a
 * protocol error would be retried or shown to the person instead.
 */
export function toolResult(answer: AgentAnswer): { content: ToolContent[]; isError?: boolean } {
  if (answer.ok) return { content: [...answer.content] }
  const sentence = REFUSAL_SENTENCE[answer.refusal] ?? answer.refusal
  const text = answer.detail ? `${answer.refusal}: ${sentence} (${answer.detail})` : `${answer.refusal}: ${sentence}`
  return { content: [{ type: 'text', text }], isError: true }
}

// --- the HTTP half, as decisions --------------------------------------------------

export type HttpDecision =
  | { status: 200; body: string; headers: Record<string, string> }
  | { status: 200 | 202 | 401 | 404 | 405 | 415 | 400; body?: string; headers?: Record<string, string> }

/**
 * Is this request allowed in? A constant-time compare, because a token check
 * that leaks its length in timing is a token check with a hole in it, however
 * theoretical on a loopback.
 */
export function authorised(header: string | undefined, token: string): boolean {
  if (!header) return false
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return false
  const offered = match[1]
  if (offered.length !== token.length) return false
  let diff = 0
  for (let n = 0; n < token.length; n++) diff |= offered.charCodeAt(n) ^ token.charCodeAt(n)
  return diff === 0
}

/**
 * The transport's rules, method by method. GET is where a client would open
 * an event stream, and 405 is the specification's way of saying this server
 * never pushes; DELETE ends a session this server does not keep.
 */
export async function serve(
  request: { method: string; path: string; authorization?: string; contentType?: string; body: string },
  options: { token: string; endpoint: string; relay: Relay; server: ServerIdentity },
): Promise<HttpDecision> {
  if (request.path !== options.endpoint) return { status: 404 }
  if (!authorised(request.authorization, options.token)) {
    return { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
  }
  // A goodbye: the client is closing its session. This server keeps none, so
  // there is nothing to end — but the app can stop saying *connected*.
  if (request.method === 'DELETE') {
    options.relay.onClosed()
    return { status: 200 }
  }
  // GET is where a client would open an event stream, and 405 is the
  // specification's way of saying this server never pushes.
  if (request.method !== 'POST') return { status: 405, headers: { Allow: 'POST, DELETE' } }
  if (!(request.contentType ?? '').toLowerCase().startsWith('application/json')) return { status: 415 }

  let parsed: unknown
  try {
    parsed = JSON.parse(request.body)
  } catch {
    return {
      status: 400,
      body: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: RPC.parse, message: 'not JSON' } }),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  const messages = Array.isArray(parsed) ? parsed : [parsed]
  if (!messages.every(isJsonRpcRequest)) {
    return {
      status: 400,
      body: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: RPC.invalidRequest, message: 'not a JSON-RPC request' } }),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  const answers: JsonRpcResponse[] = []
  for (const message of messages) {
    const held = await respond(message, options.relay, options.server)
    if (held) answers.push(held)
  }
  if (answers.length === 0) return { status: 202 }
  // A session id on the handshake, and no session behind it. The server keeps
  // no state per client; the id exists so a client that wants to say goodbye
  // has something to say it with, and the DELETE above is that goodbye.
  const opening = messages.some((message) => message.method === 'initialize')
  return {
    status: 200,
    body: JSON.stringify(Array.isArray(parsed) ? answers : answers[0]),
    headers: { 'Content-Type': 'application/json', ...(opening ? { 'Mcp-Session-Id': randomUUID() } : {}) },
  }
}
