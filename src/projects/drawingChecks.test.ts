// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing's links, as the checks read them: a shape that points at an
 * element this scope does not hold, and a pointer that counts as drawn.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { DesignDiagram, DesignElement, DrawingLink, Relation } from '../model'
import type { HostModel } from '../model/hostModel'
import { documentFindings, findingSentence, tally } from './checks'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

const s = translator('en')

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over }
}

function scope(path: string, elements: DesignElement[], relations: Relation[] = []): ScopeModel {
  return { path, model: { elements, relations } }
}

const area = { x: 0, y: 0, width: 10, height: 10 }
const link = (shapeId: string, elementId: string): DrawingLink => ({ shapeId, elementId, area })

function drawing(id: string, name: string, links: DrawingLink[]): DesignDiagram {
  return { id, kind: 'drawing', name, members: [], drawing: { xml: '<mxGraphModel/>', links } }
}

function document(over: Partial<HostModel> = {}): HostModel {
  return { name: 'A landscape', elements: [], relations: [], diagrams: [], ...over }
}

describe('a shape that points at an element this scope does not hold', () => {
  const index = indexScopes([
    scope('retail', [element('wms')]),
    scope('finance', [element('ledger')]),
  ])

  it('names the drawing and the missing id, and not an element this scope holds', () => {
    const model = document({
      elements: [element('wms'), element('erp', { ref: 'finance' })],
      diagrams: [drawing('ctx', 'Context', [
        link('a', 'wms'),
        link('b', 'gone'),
        link('c', 'ledger'),
        link('d', 'erp'),
      ])],
    })
    const findings = documentFindings({ scope: 'retail', model, index })
      .filter((finding) => finding.key === 'check.drawingLinkMissing')
    expect(findings).toEqual([
      {
        key: 'check.drawingLinkMissing', scope: 'retail', id: 'ctx:b', name: 'Context',
        fields: ['gone'], detail: 'gone',
      },
      {
        key: 'check.drawingLinkMissing', scope: 'retail', id: 'ctx:c', name: 'Context',
        fields: ['ledger'], detail: 'ledger',
      },
    ])
    expect(findingSentence(findings[0], s, () => '')).toBe(
      'A shape on Context points at gone, which this scope does not hold — point it at an element here, or remove the shape',
    )
    expect(tally(findings)).toEqual({ 'check.drawingLinkMissing': 2 })
  })

  it('says nothing about a drawing with no such shape', () => {
    const model = document({
      elements: [element('wms')],
      diagrams: [drawing('ctx', 'Context', [link('a', 'wms')])],
    })
    expect(documentFindings({ scope: 'retail', model, index })
      .filter((finding) => finding.key === 'check.drawingLinkMissing')).toEqual([])
  })
})

describe('a drawing\'s pointer counts as drawn', () => {
  const index = indexScopes([scope('retail', [element('wms'), element('erp')])])

  it('does not report notDrawn for an element a drawing in this scope points at', () => {
    const model = document({
      elements: [element('wms'), element('erp')],
      diagrams: [drawing('ctx', 'Context', [link('a', 'wms')])],
    })
    const findings = documentFindings({ scope: 'retail', model, index })
      .filter((finding) => finding.key === 'check.notDrawn')
    expect(findings.map((finding) => finding.id)).toEqual(['erp'])
  })

  it('still reports an element nothing here points at and no board holds', () => {
    const model = document({ elements: [element('wms')], diagrams: [] })
    expect(documentFindings({ scope: 'retail', model, index })
      .filter((finding) => finding.key === 'check.notDrawn')).toEqual([
      { key: 'check.notDrawn', scope: 'retail', id: 'wms', name: 'wms', information: true },
    ])
  })
})
