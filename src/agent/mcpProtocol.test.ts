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

  /**
   * A host may answer tools of its own: listed after the vocabulary, whatever
   * the host left out of it, and called through the relay with what the
   * client sent — checking those arguments is the host's.
   */
  describe('a host\'s own tools', () => {
    const almanac: ToolSpec<string> = {
      name: 'almanac.read', tier: 'read', description: 'Read a page of the almanac.',
      inputSchema: { type: 'object', properties: { page: { type: 'integer', description: 'Which page.' } }, additionalProperties: false },
    }
    const cleanup: ToolSpec<string> = {
      name: 'almanac.remove', tier: 'write', description: 'Take a page out.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    }
    type Listed = { name: string; annotations: Record<string, boolean> }
    const listOf = async (options: Parameters<typeof respond>[3]) => {
      const answer = await respond({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, quiet, server, options)
      return (answer as { result: { tools: Listed[] } }).result.tools
    }

    it('lists them after the vocabulary, with the hints their tier and name give', async () => {
      const tools = await listOf({ hostTools: [almanac, cleanup] })
      const names = tools.map((tool) => tool.name)
      expect(names.slice(-2)).toEqual(['almanac.read', 'almanac.remove'])
      expect(names).toContain('elements.list')
      expect(tools.find((tool) => tool.name === 'almanac.read')!.annotations).toEqual({ readOnlyHint: true, destructiveHint: false })
      expect(tools.find((tool) => tool.name === 'almanac.remove')!.annotations).toEqual({ readOnlyHint: false, destructiveHint: true })
    })

    it('lists them whatever the host left out of the vocabulary', async () => {
      const names = (await listOf({ tools: () => false, hostTools: [almanac] })).map((tool) => tool.name)
      expect(names).toEqual(['almanac.read'])
    })

    it('lists none that takes a name the vocabulary has', async () => {
      const shadow: ToolSpec<string> = { ...almanac, name: 'elements.list', description: 'Not the vocabulary\'s.' }
      const tools = await listOf({ hostTools: [shadow] })
      expect(tools.filter((tool) => tool.name === 'elements.list')).toHaveLength(1)
      expect(JSON.stringify(tools)).not.toContain('Not the vocabulary')
    })

    it('hands a call to the relay with the arguments as they came', async () => {
      const asked: unknown[] = []
      const relay = { ...quiet, ask: async (request: unknown) => { asked.push(request); return json({ page: 12, text: 'Rain.' }) } }
      const called = await respond(
        { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'almanac.read', arguments: { page: 'twelve' } } },
        relay, server, { tools: () => false, hostTools: [almanac] },
      )
      expect(asked).toEqual([{ id: '7', tool: 'almanac.read', args: { page: 'twelve' } }])
      expect(called).toMatchObject({ result: { content: [{ type: 'text' }] } })
      expect((called as { result: { isError?: boolean } }).result.isError).toBeUndefined()
    })

    it('leaves the list as it was where a host has none', async () => {
      expect(await listOf({ hostTools: [] })).toEqual(await listOf({}))
    })
  })

  it('turns an answer into a result, and a refusal into an error result', () => {
    expect(toolResult(json({ a: 1 }))).toEqual({ content: [{ type: 'text', text: '{\n  "a": 1\n}' }] })
    expect(toolResult(refused('agent.off'))).toEqual({
      content: [{ type: 'text', text: 'agent.off: The app is not accepting agent connections. Turn them on in Connect an agent.' }],
      isError: true,
    })
  })
})
