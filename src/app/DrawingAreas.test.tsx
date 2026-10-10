// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The areas on a drawing's picture: one per link, scaled onto the image, and
 * each opening the element through the destination `app.open` takes.
 *
 * The desktop smoke run drives a real window, so this is where that
 * destination is asserted.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../i18n'
import type { DesignDiagram } from '../model'
import { linksFromXml } from '../model/drawing'
import { renderShell } from './testing/renderShell'
import { DrawingView } from './DrawingView'
import { elementShapeXml } from './drawingProtocol'

afterEach(() => cleanup())

const s = translator('en')

const XML = '<mxGraphModel pageWidth="200" pageHeight="100"><root>'
  + '<mxCell id="0"/><mxCell id="1" parent="0"/>'
  + '<mxCell id="2" parent="1" vertex="1" lvElement="billing">'
  + '<mxGeometry x="10" y="20" width="40" height="30" as="geometry"/>'
  + '</mxCell></root></mxGraphModel>'

const drawing = (picture?: string): DesignDiagram => ({
  id: 'ctx', kind: 'drawing', name: 'Context', members: [],
  ...(picture ? { drawing: { xml: XML, picture, links: linksFromXml(XML) } } : {}),
})

const imagesFor = (svg: string) => ({
  bytesAt: (_scope: string, address: string) => Promise.resolve(
    address === 'sha256:aa' ? { mediaType: 'image/svg+xml', bytes: new TextEncoder().encode(svg) } : undefined,
  ),
})

describe('the palette shape', () => {
  it('carries lvElement beside the element link, and the link is what is read', () => {
    const shape = elementShapeXml({ id: 'billing', name: 'Billing' })
    expect(shape).toContain('link="element:billing"')
    expect(shape).toContain('lvElement="billing"')
    expect(linksFromXml(shape)).toEqual([
      { shapeId: '2', elementId: 'billing', area: { x: 0, y: 0, width: 160, height: 60 } },
    ])
  })
})

describe('areas on the picture', () => {
  it('opens the element the area points at, scaled onto the model page when the picture names no box', async () => {
    const onOpen = vi.fn()
    renderShell(
      <DrawingView
        diagram={drawing('sha256:aa')}
        scope="acme"
        images={imagesFor('<svg xmlns="http://www.w3.org/2000/svg"/>')}
        elements={[{ id: 'billing', name: 'Billing' }]}
        onOpen={onOpen}
        s={s}
      />,
    )
    const area = await screen.findByTestId('drawing-area-2')
    expect(area.getAttribute('aria-label')).toBe('Open Billing')
    expect((area as HTMLButtonElement).style.left).toBe('5%')
    expect((area as HTMLButtonElement).style.top).toBe('20%')
    expect((area as HTMLButtonElement).style.width).toBe('20%')
    expect((area as HTMLButtonElement).style.height).toBe('30%')
    fireEvent.click(area)
    expect(onOpen).toHaveBeenCalledWith({ page: 'element', id: 'billing' })
  })

  it('scales the area to the picture\'s viewBox', async () => {
    renderShell(
      <DrawingView
        diagram={drawing('sha256:aa')}
        scope="acme"
        images={imagesFor('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"/>')}
        onOpen={vi.fn()}
        s={s}
      />,
    )
    const area = await screen.findByTestId('drawing-area-2') as HTMLButtonElement
    expect(area.style.left).toBe('2.5%')
    expect(area.style.top).toBe('10%')
    expect(area.style.width).toBe('10%')
    expect(area.style.height).toBe('15%')
  })

  it('says a drawing with no picture is not drawn yet, and lays no areas', () => {
    renderShell(<DrawingView diagram={drawing()} scope="acme" images={undefined} s={s} />)
    expect(screen.getByTestId('drawing-not-drawn').textContent).toBe('Not drawn yet')
    expect(screen.queryByTestId('drawing-picture')).toBeNull()
    expect(screen.queryByTestId('drawing-area-2')).toBeNull()
  })
})
