/**
 * The adapter's one promise: every request that arrives gets exactly one
 * answer back on the channel, under its own id, whatever the handler does.
 */
import { describe, expect, it } from 'vitest'
import type { AgentAnswer, AgentRequest } from '../../agent/tools'
import { json } from '../../agent/tools'
import { DesktopAgentGateway } from './DesktopAgentGateway'
import type { DesktopAgent } from './channel'

function channel() {
  const listeners = new Set<(request: AgentRequest) => void>()
  const answers: [string, AgentAnswer][] = []
  const held: DesktopAgent = {
    onRequest(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    answer(id, answer) {
      answers.push([id, answer])
      return Promise.resolve()
    },
  }
  return {
    held, answers,
    send: (request: AgentRequest) => { for (const listener of listeners) listener(request) },
    listening: () => listeners.size,
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('DesktopAgentGateway', () => {
  it('answers a request under its id with what the handler said', async () => {
    const wire = channel()
    new DesktopAgentGateway(wire.held).on(async (request) => json({ echoed: request.tool }))
    wire.send({ id: 'r1', tool: 'project.current', args: {} })
    await settle()
    expect(wire.answers).toEqual([['r1', json({ echoed: 'project.current' })]])
  })

  it('turns a handler that throws into a refusal, so the client is not left waiting', async () => {
    const wire = channel()
    new DesktopAgentGateway(wire.held).on(async () => { throw new Error('boom') })
    wire.send({ id: 'r2', tool: 'project.current', args: {} })
    await settle()
    expect(wire.answers).toEqual([['r2', { ok: false, refusal: 'agent.noAnswer', detail: 'boom' }]])
  })

  it('stops listening when told to', () => {
    const wire = channel()
    const off = new DesktopAgentGateway(wire.held).on(async () => json({}))
    expect(wire.listening()).toBe(1)
    off()
    expect(wire.listening()).toBe(0)
  })
})
