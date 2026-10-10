// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { drawingPictureAddresses, drawingProse, linksFromXml } from './drawing'

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

  it('reads nothing from an empty drawing', () => {
    expect(linksFromXml('')).toEqual([])
    expect(drawingProse('')).toBe('')
  })
})
