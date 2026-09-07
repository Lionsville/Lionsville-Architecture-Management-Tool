/**
 * The server, connected to by the real SDK client.
 *
 * What is being tested is the conversation, not a reading of the spec: the
 * client the agents actually use has to get through `initialize`, list the
 * tools, call one and read a refusal, against a server written by hand. The
 * relay behind it is a plain object, because what the app answers is
 * `agent/`'s business and tested there.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { AgentAnswer, AgentRequest } from '../../src/agent/tools'
import { json, refused } from '../../src/agent/tools'
import type { AgentClient } from '../../src/platform/agentServer'
import { agentEndpoint } from '../../src/platform/agentServer'
import { listen } from './mcpServer'
import type { AgentListener } from './mcpServer'
import { authorised, respond, toolResult } from './mcpProtocol'

const TOKEN = 'a-token-long-enough-to-be-one-0123456789'

let open: AgentListener[] = []
afterEach(async () => {
  for (const held of open) await held.close()
  open = []
})

function relay() {
  const asked: AgentRequest[] = []
  const clients: AgentClient[] = []
  let closed = 0
  let answer: AgentAnswer = json({ name: 'Landscape' })
  return {
    asked, clients, closed: () => closed,
    say: (next: AgentAnswer) => { answer = next },
    relay: {
      ask: async (request: AgentRequest) => { asked.push(request); return answer },
      onInitialized: (client: AgentClient) => { clients.push(client) },
      onClosed: () => { closed += 1 },
    },
  }
}

async function start(port = 0) {
  const wire = relay()
  const held = await listen({ port, token: TOKEN, relay: wire.relay, server: { name: 'lvarch-test', version: '0.0.0' } })
  open.push(held)
  return { ...wire, listener: held }
}

async function connect(port: number, token = TOKEN) {
  const client = new Client({ name: 'test-agent', version: '1.2.3' })
  const transport = new StreamableHTTPClientTransport(new URL(agentEndpoint(port)), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  })
  await client.connect(transport)
  // `close()` on its own drops the connection without a word; the goodbye is
  // a separate call, and the app's *connected* state has an idle rule for
  // clients that never make it.
  return Object.assign(client, { goodbye: () => transport.terminateSession() })
}

describe('an SDK client against the server', () => {
  it('connects, learns who it is talking to, and is remembered by name until it says goodbye', async () => {
    const { listener, clients, closed } = await start()
    const client = await connect(listener.port)
    expect(client.getServerVersion()).toEqual({ name: 'lvarch-test', version: '0.0.0' })
    expect(client.getInstructions()).toContain('Activity')
    expect(clients).toEqual([{ name: 'test-agent', version: '1.2.3' }])
    expect(closed()).toBe(0)
    await client.goodbye()
    expect(closed()).toBe(1)
    await client.close()
  })

  it('lists the tools with their schemas', async () => {
    const { listener } = await start()
    const client = await connect(listener.port)
    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name)
    expect(names).toContain('project.current')
    expect(names).toContain('elements.list')
    const describe = tools.find((tool) => tool.name === 'element.describe')!
    expect(describe.inputSchema).toMatchObject({ type: 'object', required: ['id'] })
    expect(describe.annotations).toMatchObject({ readOnlyHint: true })
    await client.close()
  })

  it('relays a call to the app and hands back what it said', async () => {
    const { listener, asked } = await start()
    const client = await connect(listener.port)
    const result = await client.callTool({ name: 'project.current', arguments: {} })
    expect(asked).toEqual([{ id: expect.any(String), tool: 'project.current', args: {} }])
    expect(result.content).toEqual([{ type: 'text', text: '{\n  "name": "Landscape"\n}' }])
    expect(result.isError).toBeFalsy()
    await client.close()
  })

  it('hands a refusal back as a tool error with the key and the sentence', async () => {
    const { listener, say } = await start()
    say(refused('agent.unknownId', 'element ghost'))
    const client = await connect(listener.port)
    const result = await client.callTool({ name: 'element.describe', arguments: { id: 'ghost' } })
    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{
      type: 'text', text: 'agent.unknownId: Nothing in the project has that id. (element ghost)',
    }])
    await client.close()
  })

  it('refuses a wrong token before anything reaches the app', async () => {
    const { listener, asked, clients } = await start()
    await expect(connect(listener.port, 'not-the-token-at-all-0123456789')).rejects.toMatchObject({ code: 401 })
    expect(asked).toEqual([])
    expect(clients).toEqual([])
  })

  it('answers a plain request without a token with 401 and nothing else', async () => {
    const { listener } = await start()
    const response = await fetch(agentEndpoint(listener.port), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
  })

  it('takes another port when the kept one is busy, and says which', async () => {
    const first = await start()
    const second = await start(first.listener.port)
    expect(second.listener.port).not.toBe(first.listener.port)
    const client = await connect(second.listener.port)
    await client.close()
  })

  it('stops answering once closed', async () => {
    const { listener } = await start()
    await listener.close()
    open = []
    await expect(fetch(agentEndpoint(listener.port))).rejects.toThrow()
  })
})

describe('the protocol on its own', () => {
  const server = { name: 's', version: '1' }
  const quiet = { ask: async () => json({}), onInitialized: () => {}, onClosed: () => {} }

  it('answers a notification with nothing', async () => {
    expect(await respond({ jsonrpc: '2.0', method: 'notifications/initialized' }, quiet, server)).toBeUndefined()
  })

  it('names a method it does not have', async () => {
    expect(await respond({ jsonrpc: '2.0', id: 1, method: 'prompts/list' }, quiet, server))
      .toMatchObject({ id: 1, error: { code: -32601 } })
  })

  it('speaks the version the client asks for when it can', async () => {
    const old = await respond({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, quiet, server)
    expect(old).toMatchObject({ result: { protocolVersion: '2025-03-26' } })
    const unknown = await respond({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, quiet, server)
    expect(unknown).toMatchObject({ result: { protocolVersion: '2025-06-18' } })
  })

  it('compares tokens without a shortcut', () => {
    expect(authorised(`Bearer ${TOKEN}`, TOKEN)).toBe(true)
    expect(authorised(`bearer ${TOKEN}`, TOKEN)).toBe(true)
    expect(authorised(`Bearer ${TOKEN}x`, TOKEN)).toBe(false)
    expect(authorised(TOKEN, TOKEN)).toBe(false)
    expect(authorised(undefined, TOKEN)).toBe(false)
  })

  it('turns an answer into a result, and a refusal into an error result', () => {
    expect(toolResult(json({ a: 1 }))).toEqual({ content: [{ type: 'text', text: '{\n  "a": 1\n}' }] })
    expect(toolResult(refused('agent.off'))).toEqual({
      content: [{ type: 'text', text: 'agent.off: The app is not accepting agent connections. Turn them on in Connect an agent.' }],
      isError: true,
    })
  })
})
