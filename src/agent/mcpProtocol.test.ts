/**
 * The protocol on its own, with a plain object at each end.
 *
 * These cases moved here with the file they test. What is left in
 * `electron/main/mcp.test.ts` is the conversation a real client has with the
 * listener; what is here needs neither a socket nor a port, which is the whole
 * reason the protocol is a pure file.
 */
import { describe, expect, it } from 'vitest'
import { json, refused } from './tools'
import { authorised, respond, toolResult } from './mcpProtocol'

const TOKEN = 'a-token-long-enough-to-be-one-0123456789'

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
