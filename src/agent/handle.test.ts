/**
 * The handler over a session view: which tools are answered, and which refusals
 * come first. The read tier's answers themselves are `answer.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { HostModel } from '../model/fromInterchange'
import { fromArrays } from '../model/normalised'
import { handle } from './handle'
import type { SessionView } from './handle'

const host: HostModel = {
  name: 'Landscape',
  customerName: 'Acme',
  elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} }],
  connections: [],
  diagrams: [{ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ elementId: 'billing', x: 0, y: 0 }] }],
}

function session(over: Partial<SessionView> = {}): SessionView {
  const model = fromArrays(host)
  return {
    indexed: () => model,
    current: () => host,
    activeDiagramId: () => 'l7',
    groupDecisions: () => [],
    blocked: () => undefined,
    ...over,
  }
}

describe('handle', () => {
  it('answers a read tool from the session', () => {
    const out = handle({ id: '1', tool: 'project.current', args: {} }, session())
    expect(out.ok).toBe(true)
    if (out.ok && out.content[0].type === 'text') {
      expect(JSON.parse(out.content[0].text)).toMatchObject({ name: 'Landscape', elements: 1 })
    }
  })

  it('refuses a tool it does not know, naming it', () => {
    expect(handle({ id: '1', tool: 'elements.destroy', args: {} }, session()))
      .toEqual({ ok: false, refusal: 'agent.unknownTool', detail: 'elements.destroy' })
  })

  it('still answers a read while the session is blocked', () => {
    const out = handle({ id: '1', tool: 'elements.list', args: {} }, session({ blocked: () => 'agent.conflict' }))
    expect(out.ok).toBe(true)
  })

  it('hands bad arguments back as a refusal rather than an answer', () => {
    expect(handle({ id: '1', tool: 'element.describe', args: { id: 7 } }, session()))
      .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})
