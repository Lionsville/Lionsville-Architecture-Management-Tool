// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A shape's point at an element, read from `link` and from `lvElement`, and
 * where that area sits on the picture — held to a real export: the XML and
 * the `xmlsvg` the pinned draw.io (32.4.1) made of it, run headless on the
 * drawing scheme (`testing/drawio/`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { DesignDiagram } from './types'
import { areaOnPicture, drawingBounds, drawingsPointingAt, linksFromXml, pictureFrame, svgFrame } from './drawing'

const EXPORTED_XML = readFileSync(new URL('./testing/drawio/nested-groups.drawio', import.meta.url), 'utf8')
const EXPORTED_SVG = readFileSync(new URL('./testing/drawio/nested-groups.svg', import.meta.url), 'utf8')

/** The rectangle draw.io drew for a cell, in the picture's own units, read off the SVG. */
function drawnRect(svg: string, cellId: string): { x: number; y: number; width: number; height: number } {
  const from = svg.indexOf(`data-cell-id="${cellId}"`)
  const rect = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg.slice(from))
  if (from < 0 || !rect) throw new Error(`no rect for ${cellId}`)
  const [x, y, width, height] = rect.slice(1).map(Number)
  return { x, y, width, height }
}

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
  it('lays each link on the shape draw.io drew for it, in a real export', () => {
    const picture = svgFrame(EXPORTED_SVG)!
    const frame = pictureFrame(EXPORTED_XML, picture)!
    const links = linksFromXml(EXPORTED_XML)
    expect(links.map((link) => link.shapeId)).toEqual(['a', 'b'])
    for (const link of links) {
      const place = areaOnPicture(link.area, frame)!
      const drawn = drawnRect(EXPORTED_SVG, link.shapeId)
      // Within a unit of the picture: draw.io draws on half-unit lines.
      expect(Math.abs(place.left * picture.width - drawn.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(place.top * picture.height - drawn.y)).toBeLessThanOrEqual(1)
      expect(place.width * picture.width).toBeCloseTo(drawn.width, 0)
      expect(place.height * picture.height).toBeCloseTo(drawn.height, 0)
    }
  })

  it('finds the shapes\' box: nested groups summed, an edge\'s waypoint in, a hidden shape out', () => {
    // draw.io said this export's box was x 199.5, y 139.5, 581 by 389: the
    // shapes' box and half a stroke around it.
    expect(drawingBounds(EXPORTED_XML)).toEqual({ x: 200, y: 140, width: 580, height: 380 })
    const hidden = cell('', 'x="10" y="20" width="40" height="30"').replace('<mxCell id="2"', '<mxCell id="2" visible="0"')
    expect(drawingBounds(hidden)).toBeUndefined()
    expect(drawingBounds('')).toBeUndefined()
  })

  it('takes the export\'s size and the shapes\' origin, and the shapes\' box where the picture names no size', () => {
    expect(pictureFrame(cell(''), { x: 0, y: 0, width: 41, height: 31 })).toEqual({ x: 10, y: 20, width: 41, height: 31 })
    expect(pictureFrame(cell(''), undefined)).toEqual({ x: 10, y: 20, width: 40, height: 30 })
    expect(pictureFrame('', undefined)).toBeUndefined()
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
