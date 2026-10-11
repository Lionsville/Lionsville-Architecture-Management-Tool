// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { drawingPictureAddresses, drawingProse, isCompressedDrawing, linksFromXml } from './drawing'

const NESTED = `
<mxfile>
  <diagram>
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="g" parent="1" vertex="1" value="Group">
          <mxGeometry x="100" y="40" width="200" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="a" parent="g" vertex="1" value="&lt;b&gt;Billing&lt;/b&gt;" link="element:billing">
          <mxGeometry x="10" y="20" width="80" height="40" as="geometry"/>
        </mxCell>
        <UserObject id="b" label="Ledger" link="element:ledger">
          <mxCell parent="g" vertex="1">
            <mxGeometry x="5" y="8" width="40" height="20" as="geometry"/>
          </mxCell>
        </UserObject>
        <mxCell id="note" parent="1" vertex="1" value="A note">
          <mxGeometry x="0" y="0" width="30" height="15" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`

describe('links from a drawing', () => {
  it('sums a nested group and reads a UserObject the same way', () => {
    expect(linksFromXml(NESTED)).toEqual([
      { shapeId: 'a', elementId: 'billing', area: { x: 110, y: 60, width: 80, height: 40 } },
      { shapeId: 'b', elementId: 'ledger', area: { x: 105, y: 48, width: 40, height: 20 } },
    ])
  })

  it('indexes the labels, tags stripped', () => {
    expect(drawingProse(NESTED)).toBe('Group\nBilling\nLedger\nA note')
  })

  it('names every picture a drawing in the head holds', () => {
    expect(drawingPictureAddresses([
      { kind: 'layer7' },
      { kind: 'drawing', drawing: { picture: 'sha256:aa' } },
      { kind: 'drawing' },
      { kind: 'drawing', drawing: { picture: 'sha256:bb' } },
    ])).toEqual(['sha256:aa', 'sha256:bb'])
  })

  it('reads the first page only', () => {
    const two = NESTED.replace('</diagram>', '</diagram><diagram id="p2"><mxGraphModel><root><mxCell id="0"/>'
      + '<mxCell id="z" parent="0" vertex="1" value="Second page" link="element:other"><mxGeometry width="1" height="1" as="geometry"/></mxCell>'
      + '</root></mxGraphModel></diagram>')
    expect(linksFromXml(two).map((link) => link.elementId)).toEqual(['billing', 'ledger'])
    expect(drawingProse(two)).not.toContain('Second page')
  })

  it('says when the first page is kept compressed, and reads no cells from it', () => {
    const compressed = '<mxfile host="local"><diagram id="p" name="Page-1">tZZNc5swEIZ/DXcQDs41cV3</diagram></mxfile>'
    expect(isCompressedDrawing(compressed)).toBe(true)
    expect(linksFromXml(compressed)).toEqual([])
    expect(isCompressedDrawing(NESTED)).toBe(false)
    expect(isCompressedDrawing('<mxGraphModel><root/></mxGraphModel>')).toBe(false)
  })

  it('reads a character reference past the last code point, or a surrogate, as U+FFFD', () => {
    const xml = (value: string) => `<mxGraphModel><root><mxCell id="2" vertex="1" value="${value}"/></root></mxGraphModel>`
    expect(drawingProse(xml('a&#x110000;b'))).toBe('a\ufffdb')
    expect(drawingProse(xml('a&#99999999999;b'))).toBe('a\ufffdb')
    expect(drawingProse(xml('a&#xD800;b'))).toBe('a\ufffdb')
    expect(drawingProse(xml('&#x1F600; &#65;'))).toBe('\u{1F600} A')
  })

  it('decodes a plain label once, and an HTML label as HTML: tags out, entities once more', () => {
    const xml = (value: string, style = '') =>
      `<mxGraphModel><root><mxCell id="2" vertex="1" style="${style}" value="${value}"/></root></mxGraphModel>`
    expect(drawingProse(xml('a &amp;lt; b'))).toBe('a &lt; b')
    expect(drawingProse(xml('Fish &amp;amp; chips&lt;br&gt;today', 'rounded=0;html=1;'))).toBe('Fish & chips today')
    expect(drawingProse(xml('One&amp;nbsp;two', 'html=1'))).toBe('One two')
  })

  it('keeps an attribute called after an object\'s own properties as an attribute', () => {
    const xml = '<mxGraphModel><root><mxCell id="2" vertex="1" constructor="x" __proto__="y" value="Kept"/></root></mxGraphModel>'
    expect(drawingProse(xml)).toBe('Kept')
  })

  it('reads nothing from an empty drawing', () => {
    expect(linksFromXml('')).toEqual([])
    expect(drawingProse('')).toBe('')
  })
})
