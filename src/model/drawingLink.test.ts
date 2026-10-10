// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A shape's point at an element, read from `link` and from `lvElement`, and
 * where that area sits on the picture.
 */
import { describe, expect, it } from 'vitest'
import type { DesignDiagram } from './types'
import { areaOnPicture, drawingsPointingAt, linksFromXml, modelFrame, svgFrame } from './drawing'

const cell = (attrs: string, geometry = 'x="10" y="20" width="40" height="30"') =>
  `<mxGraphModel pageWidth="200" pageHeight="100"><root><mxCell id="0"/><mxCell id="1" parent="0"/>`
  + `<mxCell id="2" parent="1" vertex="1" ${attrs}><mxGeometry ${geometry} as="geometry"/></mxCell>`
  + `</root></mxGraphModel>`

describe('lvElement', () => {
  it('reads lvElement as the element id when the cell has no link', () => {
    expect(linksFromXml(cell('lvElement="billing"'))).toEqual([
      { shapeId: '2', elementId: 'billing', area: { x: 10, y: 20, width: 40, height: 30 } },
    ])
  })

  it('keeps link when the cell also carries lvElement', () => {
    expect(linksFromXml(cell('link="element:billing" lvElement="other"'))[0]?.elementId).toBe('billing')
  })

  it('reads lvElement on a UserObject the same way', () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
      + '<UserObject id="b" label="Ledger" lvElement="ledger"><mxCell parent="1" vertex="1">'
      + '<mxGeometry x="5" y="8" width="40" height="20" as="geometry"/></mxCell></UserObject>'
      + '</root></mxGraphModel>'
    expect(linksFromXml(xml)).toEqual([
      { shapeId: 'b', elementId: 'ledger', area: { x: 5, y: 8, width: 40, height: 20 } },
    ])
  })
})

describe('the picture\'s frame', () => {
  it('uses the page the model names, and draw.io\'s page when it names none', () => {
    expect(modelFrame('<mxGraphModel pageWidth="200" pageHeight="100">')).toEqual({ x: 0, y: 0, width: 200, height: 100 })
    expect(modelFrame('<mxGraphModel>')).toEqual({ x: 0, y: 0, width: 850, height: 1100 })
    expect(modelFrame('')).toEqual({ x: 0, y: 0, width: 850, height: 1100 })
  })

  it('reads an SVG viewBox, origin included', () => {
    expect(svgFrame('<svg viewBox="10 20 400 200"></svg>')).toEqual({ x: 10, y: 20, width: 400, height: 200 })
    expect(svgFrame('<svg xmlns="http://www.w3.org/2000/svg"/>')).toBeUndefined()
  })

  it('scales a model area onto that frame', () => {
    expect(areaOnPicture(
      { x: 110, y: 60, width: 80, height: 40 },
      { x: 10, y: 20, width: 400, height: 200 },
    )).toEqual({ left: 0.25, top: 0.2, width: 0.2, height: 0.2 })
  })
})

describe('drawings that point at an element', () => {
  const drawing = (id: string, name: string, elementId?: string): DesignDiagram => ({
    id, kind: 'drawing', name, members: [],
    ...(elementId ? { drawing: { xml: '', links: [{ shapeId: 'a', elementId, area: { x: 0, y: 0, width: 1, height: 1 } }] } } : { drawing: { xml: '', links: [] } }),
  })

  it('lists the drawings whose links point at it, and not one that is only anchored', () => {
    const anchored: DesignDiagram = { ...drawing('anchored', 'Anchored'), elementId: 'billing' }
    const diagrams = [drawing('ctx', 'Context', 'billing'), drawing('dep', 'Deployment', 'ledger'), anchored]
    expect(drawingsPointingAt(diagrams, 'billing').map((diagram) => diagram.name)).toEqual(['Context'])
    expect(drawingsPointingAt(diagrams, 'nobody')).toEqual([])
  })
})
