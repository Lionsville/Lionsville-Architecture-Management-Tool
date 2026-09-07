/**
 * The handler over a session view: which tools are answered, and which refusals
 * come first. The read tier's answers themselves are `answer.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/fromInterchange'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { handle } from './handle'
import type { SessionView } from './handle'

const host: HostModel = {
  name: 'Landscape',
  customerName: 'Acme',
  elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} }],
  connections: [],
  diagrams: [{ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ elementId: 'billing', x: 0, y: 0 }] }],
}

/** A session over the real reducer: what the workspace binds, minus React. */
function session(over: Partial<SessionView> = {}): SessionView & { model: () => Model } {
  let model = fromArrays(host)
  let counter = 0
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    groupDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.connections, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-${++counter}`,
    today: () => '2026-09-07',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
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

  it('dispatches a write at the session and answers with the id it minted', () => {
    const held = session()
    const out = handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held)
    expect(out).toMatchObject({ ok: true })
    expect(held.model().elements['crm']).toMatchObject({ name: 'CRM', kind: 'application' })
    expect(held.model().diagrams['l7'].placements['crm']).toMatchObject({ zone: 'landscape' })
  })

  it('refuses a write while the session is blocked, and changes nothing', () => {
    const held = session({ blocked: () => 'agent.conflict' })
    expect(handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held))
      .toEqual({ ok: false, refusal: 'agent.conflict' })
    expect(held.model().elements['crm']).toBeUndefined()
  })

  it('passes the reducer’s own refusal through with its key', () => {
    // The builder checks what it can; a connection whose end has gone between
    // the check and the reducer is the reducer's to refuse, and its key comes
    // back as it is.
    const held = session({
      dispatch: () => undefined,
      indexed: () => {
        const model = fromArrays(host)
        return { ...model, elements: {} }
      },
    })
    expect(handle({ id: '1', tool: 'element.remove', args: { id: 'billing' } }, held))
      .toEqual({ ok: false, refusal: 'agent.unknownId', detail: 'element billing' })
  })

  it('switches to a diagram it created, the way the shell does', () => {
    const switched: string[] = []
    const base = session()
    const held = session({
      ...base,
      dispatch: (command, options) => {
        if (options?.activeDiagramId) switched.push(options.activeDiagramId)
        return base.dispatch(command, options)
      },
    })
    const out = handle({ id: '1', tool: 'diagram.create', args: { kind: 'layer7', name: 'Second' } }, held)
    expect(out.ok).toBe(true)
    expect(switched).toEqual(['l7-1'])
  })
})
