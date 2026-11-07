// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the agent says and reads of the 4.0.0 model: the organisation's scales and
 * a function's ratings (ADR-0046), the confirmed or assumed mark (ADR-0047),
 * an application's owner as one field (ADR-0036, amended) and Noted (ADR-0038,
 * amended), through the one handler, against the real reducer.
 */
import { describe, expect, it } from 'vitest'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import type { HostModel } from '../model/hostModel'
import type { DesignElement } from '../model/types'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { idPolicy } from '../model/keys'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { AgentAnswer } from './tools'

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, name: id, kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})

const host: HostModel = {
  name: 'Acme', diagrams: [],
  elements: [element('billing'), element('fulfilment', { kind: 'function' }), element('crm')],
  relations: [{ id: 'c1', type: 'flow', sourceId: 'billing', targetId: 'crm' }],
  observations: [{ id: 'ob-1', number: 1, title: 'Seen', date: '2026-11-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-11-01', kind: 'recorded' }] }],
}

function session(path = ''): SessionView & { model: () => Model } {
  let model = fromArrays(host)
  let revision = 0
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => '',
    scopePath: () => path,
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => model.order.elements),
    makeId: (prefix) => `${prefix}-new`,
    today: () => '2026-11-07',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => name,
    revision: () => revision,
    history: () => [],
    undo: () => {},
    images: () => [],
    save: async () => {},
  }
}

const call = (tool: string, args: unknown, held: SessionView) => handle({ id: '1', tool: tool as never, args }, held)
const body = (answer: AgentAnswer) => {
  if (!answer.ok) throw new Error(`${answer.refusal}: ${answer.detail ?? ''}`)
  return JSON.parse(answer.content[0]?.type === 'text' ? answer.content[0].text : '{}')
}

describe('scales and ratings', () => {
  it('sets a scale at the organisation, 1 to 5 unless said, reads it, and takes it away', async () => {
    const held = session()
    expect(body(await call('aspectScale.set', { key: 'maturity', label: 'Maturity' }, held)).scale).toEqual({ key: 'maturity', label: 'Maturity', min: 1, max: 5 })
    await call('aspectScale.set', { key: 'risk', label: 'Risk', min: 0, max: 3 }, held)
    expect(body(await call('aspectScales.list', {}, held)).aspectScales.map((one: { key: string }) => one.key)).toEqual(['maturity', 'risk'])
    // Set again it is changed in place, and what was not said stays.
    await call('aspectScale.set', { key: 'risk', label: 'Exposure' }, held)
    expect(body(await call('aspectScales.list', {}, held)).aspectScales[1]).toEqual({ key: 'risk', label: 'Exposure', min: 0, max: 3 })
    await call('aspectScale.remove', { key: 'risk' }, held)
    expect(body(await call('aspectScales.list', {}, held)).aspectScales).toHaveLength(1)
    expect(await call('aspectScale.set', { key: 'bad', label: 'Bad', min: 5, max: 1 }, held)).toMatchObject({ refusal: 'command.badScale' })
  })

  it('is written at the organisation only', async () => {
    expect(await call('aspectScale.set', { key: 'maturity', label: 'Maturity' }, session('retail'))).toMatchObject({ refusal: 'agent.scopeNotOpen' })
  })

  it('rates a function on a scale the organisation keeps, on it, and takes the rating away with null', async () => {
    const held = session()
    await call('aspectScale.set', { key: 'maturity', label: 'Maturity' }, held)
    expect(await call('element.rate', { id: 'fulfilment', aspect: 'nothing', value: 3 }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    expect(await call('element.rate', { id: 'fulfilment', aspect: 'maturity', value: 6 }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    expect(await call('element.rate', { id: 'billing', aspect: 'maturity', value: 3 }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    expect((await call('element.rate', { id: 'fulfilment', aspect: 'maturity', value: 3 }, held)).ok).toBe(true)
    expect(held.model().elements.fulfilment.ratings).toEqual({ maturity: 3 })
    expect(body(await call('elements.list', {}, held)).elements.find((one: { id: string }) => one.id === 'fulfilment').ratings).toEqual({ maturity: 3 })
    await call('element.rate', { id: 'fulfilment', aspect: 'maturity', value: null }, held)
    expect(held.model().elements.fulfilment.ratings).toBeUndefined()
  })
})

describe('the mark', () => {
  it('says confirmed or assumed on an element and a line, and null takes it off', async () => {
    const held = session()
    await call('element.update', { id: 'billing', certainty: 'assumed' }, held)
    expect(held.model().elements.billing.certainty).toBe('assumed')
    expect(body(await call('elements.list', {}, held)).elements.find((one: { id: string }) => one.id === 'billing').certainty).toBe('assumed')
    expect(await call('element.update', { id: 'billing', certainty: 'perhaps' }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    await call('element.update', { id: 'billing', certainty: null }, held)
    expect('certainty' in held.model().elements.billing).toBe(false)
    await call('connection.update', { id: 'c1', certainty: 'confirmed' }, held)
    expect(held.model().relations.c1.certainty).toBe('confirmed')
    expect(body(await call('connections.list', {}, held)).connections[0].certainty).toBe('confirmed')
  })
})

describe('an application\'s owner', () => {
  it('reads as one field, whichever half was said last', async () => {
    const held = session()
    const line = async () => body(await call('elements.list', {}, held)).elements.find((one: { id: string }) => one.id === 'billing')
    expect((await line()).ownerIs).toBe('nobody')
    await call('element.update', { id: 'billing', owner: 'Revenue systems' }, held)
    expect((await line()).ownerIs).toBe('name')
    expect(held.model().elements.billing.owner).toBe('Revenue systems')
  })
})

describe('Noted', () => {
  it('takes an observation off the waiting list, with the reason in its history, and takes that back', async () => {
    const held = session()
    await call('observation.note', { id: 'ob-1', reason: 'A fact worth keeping' }, held)
    const noted = toArrays(held.model()).observations![0]
    expect(noted.noted).toBe(true)
    expect(noted.history.at(-1)).toEqual({ date: '2026-11-07', kind: 'noted', note: 'A fact worth keeping' })
    expect(body(await call('observations.list', {}, held)).observations[0].noted).toBe(true)
    expect(await call('observation.note', { id: 'ob-1' }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    await call('observation.note', { id: 'ob-1', takeBack: true }, held)
    expect(toArrays(held.model()).observations![0].noted).toBeUndefined()
  })
})
