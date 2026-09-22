// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The protocol on its own, with a plain object at each end.
 *
 * These cases moved here with the file they test. What is left in
 * `electron/main/mcp.test.ts` is the conversation a real client has with the
 * listener; what is here needs neither a socket nor a port, which is the whole
 * reason the protocol is a pure file.
 */
import { describe, expect, it } from 'vitest'
import type { ToolSpec } from './tools'
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

  /**
   * The two things a host that is not this window has to be able to say. The
   * desktop passes neither, which is what the cases above are: the paragraph
   * about the app on screen, and all twenty-odd tools.
   */
  it('says what the host is, where the host says', async () => {
    const opened = await respond(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, quiet, server,
      { instructions: 'Something else entirely.' },
    )
    expect(opened).toMatchObject({ result: { instructions: 'Something else entirely.' } })
  })

  it('offers only the tools the host has, and answers for the ones it does not', async () => {
    const reads = { tools: (tool: ToolSpec) => tool.tier === 'read' }
    const listed = await respond({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, quiet, server, reads)
    const names = ((listed as { result: { tools: { name: string }[] } }).result.tools).map((tool) => tool.name)
    expect(names).toContain('elements.list')
    expect(names).not.toContain('diagram.render')
    expect(names).not.toContain('app.open')

    // And the list and the answer cannot disagree: the relay is never asked.
    let asked = 0
    const counting = { ...quiet, ask: async () => { asked += 1; return json({}) } }
    const called = await respond(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'diagram.render', arguments: {} } },
      counting, server, reads,
    )
    expect(called).toMatchObject({ result: { isError: true } })
    expect((called as { result: { content: { text: string }[] } }).result.content[0].text).toContain('agent.unknownTool')
    expect(asked).toBe(0)
  })

  it('turns an answer into a result, and a refusal into an error result', () => {
    expect(toolResult(json({ a: 1 }))).toEqual({ content: [{ type: 'text', text: '{\n  "a": 1\n}' }] })
    expect(toolResult(refused('agent.off'))).toEqual({
      content: [{ type: 'text', text: 'agent.off: The app is not accepting agent connections. Turn them on in Connect an agent.' }],
      isError: true,
    })
  })
})
