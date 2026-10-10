// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An agent makes a drawing and writes its XML. The links are read at once.
 * The picture is left unset.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { AgentAnswer } from './tools'

const XML = `
<mxGraphModel><root>
  <mxCell id="0"/>
  <mxCell id="1" parent="0"/>
  <mxCell id="g" parent="1" vertex="1">
    <mxGeometry x="100" y="40" width="200" height="80" as="geometry"/>
  </mxCell>
  <mxCell id="a" parent="g" value="Billing" link="element:billing" vertex="1">
    <mxGeometry x="10" y="20" width="80" height="40" as="geometry"/>
  </mxCell>
</root></mxGraphModel>`

function host(): HostModel {
  return {
    name: 'Landscape',
    elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })],
  }
}

function session(): SessionView {
  let model: Model = fromArrays(host())
  let counter = 0
  return {
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    scopePath: () => 'acme',
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-10-10',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => 0,
    history: () => [],
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(JSON.stringify(out))
  return JSON.parse(out.content[0].text) as Record<string, unknown>
}

describe('an agent and a drawing', () => {
  it('creates one with an anchor and a level, then reads the links from the XML', async () => {
    const held = session()
    const made = parsed(await handle({
      id: '1', tool: 'diagram.create',
      args: { kind: 'drawing', name: 'Context', elementId: 'billing', level: 'context' },
    }, held))
    expect(made).toMatchObject({ kind: 'drawing', name: 'Context', elementId: 'billing', level: 'context' })
    const id = made.id as string
    const updated = parsed(await handle({ id: '2', tool: 'diagram.update', args: { id, xml: XML } }, held))
    expect(updated).toMatchObject({ id, kind: 'drawing' })
    const listed = parsed(await handle({ id: '3', tool: 'diagrams.list', args: {} }, held))
    const row = (listed.diagrams as { id: string; kind: string; elementId?: string; pointsAt?: string[] }[])
      .find((diagram) => diagram.id === id)
    expect(row).toMatchObject({ kind: 'drawing', elementId: 'billing', pointsAt: ['billing'] })
    const drawing = held.current().diagrams.find((diagram) => diagram.id === id)
    expect(drawing?.kind === 'drawing' && drawing.drawing?.picture).toBeUndefined()
    expect(drawing?.kind === 'drawing' && drawing.drawing?.links[0].area).toEqual({ x: 110, y: 60, width: 80, height: 40 })
  })

  it('refuses a drawing anchored to nobody, and a level that is not one', async () => {
    const held = session()
    expect(await handle({ id: '1', tool: 'diagram.create', args: { kind: 'drawing', name: 'Context', elementId: 'nope' } }, held))
      .toMatchObject({ ok: false })
    expect(await handle({ id: '2', tool: 'diagram.create', args: { kind: 'drawing', name: 'Context', level: 'system' } }, held))
      .toMatchObject({ ok: false })
  })
})
