// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The frame's half of the protocol: configure, load, save, and a merge when
 * the save is refused as an overlap. The iframe is a mock; the messages are
 * the ones draw.io's JSON protocol uses.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { translator } from '../i18n'
import { linksFromXml } from '../model/drawing'
import { renderShell } from './testing/renderShell'
import { DrawingEditor } from './DrawingEditor'
import type { DrawingKeeper } from './DrawingEditor'
import {
  drawingConfig, drawingFrameQuery, drawingFrameSrc, elementShapeXml, frameTarget, isDrawingOverlap, savedDrawing,
} from './drawingProtocol'

afterEach(() => cleanup())

const s = translator('en')
const ADDRESS = `sha256:${'ab'.repeat(32)}`
const XML = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
  + '<UserObject id="s" label="Billing" link="element:billing"><mxCell parent="1" vertex="1">'
  + '<mxGeometry x="1" y="2" width="3" height="4" as="geometry"/></mxCell></UserObject></root></mxGraphModel>'
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>'

function dataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/** The iframe's window, with postMessage recorded, after the listener is up. */
function frameWindow(): { win: Window; posted: () => { data: string; target: string }[] } {
  const frame = screen.getByTestId('drawing-frame') as HTMLIFrameElement
  const win = frame.contentWindow
  if (!win) throw new Error('the frame has no window')
  const posted: { data: string; target: string }[] = []
  win.postMessage = ((data: unknown, target?: string) => {
    posted.push({ data: String(data), target: String(target) })
  }) as Window['postMessage']
  return { win, posted: () => posted }
}

function hear(win: Window, data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), source: win }))
}

function keeper(update: DrawingKeeper['update'], xml: () => string | undefined = () => undefined): {
  keeper: DrawingKeeper
  puts: Uint8Array[]
} {
  const puts: Uint8Array[] = []
  return {
    puts,
    keeper: {
      put: async (bytes) => { puts.push(bytes); return { contentAddress: ADDRESS } },
      update,
      xml,
    },
  }
}

describe('the frame query and the palette', () => {
  it('opens embedded, in the app language, and does not name libs', () => {
    expect(drawingFrameQuery('nl')).toBe('embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1&ui=min&lang=nl')
    expect(drawingFrameQuery('nl')).not.toContain('libs=')
    expect(frameTarget('drawing://local')).toBe('drawing://local')
    expect(frameTarget('https://draw.example/editor')).toBe('https://draw.example')
    expect(drawingFrameSrc('drawing://local', 'de')).toBe(
      'drawing://local/?embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1&ui=min&lang=de',
    )
  })

  it('sends the elements as uncompressed XML, each a UserObject pointing at its element', () => {
    const shape = elementShapeXml({ id: 'billing', name: 'Billing' })
    expect(shape.startsWith('<')).toBe(true)
    expect(shape).toContain('<UserObject')
    expect(shape).toContain('label="Billing"')
    expect(shape).toContain('link="element:billing"')
    const config = drawingConfig([{ id: 'billing', name: 'Billing' }], 'Elements')
    expect(config.defaultLibraries).toBe('elements;c4')
    expect(config.enabledLibraries).toEqual(['elements', 'c4'])
    expect(config.expandLibraries).toBe(true)
    const data = (config.libraries[0] as { entries: { libs: { data: { xml: string }[] }[] }[] }).entries[0].libs[0].data
    expect(data[0].xml).toBe(shape)
  })

  it('treats a channel key as an overlap and a reducer key as the reducer', () => {
    expect(isDrawingOverlap('channel.overlap')).toBe(true)
    expect(isDrawingOverlap('command.gone')).toBe(false)
    expect(isDrawingOverlap('agent.readOnly')).toBe(false)
  })
})

describe('DrawingEditor', () => {
  function open(held: DrawingKeeper, xml?: string) {
    renderShell(
      <DrawingEditor
        origin="drawing://local"
        language="en"
        xml={xml}
        elements={[{ id: 'billing', name: 'Billing' }]}
        paletteTitle="Elements"
        keeper={held}
        notify={() => {}}
        s={s}
      />,
    )
    return frameWindow()
  }

  it('answers configure with the palette and init with the drawing', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }))
    const frame = open(held, XML)
    hear(frame.win, { event: 'configure' })
    hear(frame.win, { event: 'init' })
    const messages = frame.posted().map((one) => JSON.parse(one.data) as { action: string; xml?: string; config?: { defaultLibraries: string } })
    expect(messages.map((one) => one.action)).toEqual(['configure', 'load'])
    expect(messages[0].config?.defaultLibraries).toBe('elements;c4')
    expect(messages[1].xml).toBe(XML)
    expect(frame.posted().every((one) => one.target === 'drawing://local')).toBe(true)
  })

  it('loads an empty model when the drawing has not been drawn', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }))
    const frame = open(held, undefined)
    hear(frame.win, { event: 'init' })
    const load = JSON.parse(frame.posted()[0].data) as { action: string; xml: string }
    expect(load.action).toBe('load')
    expect(load.xml.startsWith('<mxGraphModel>')).toBe(true)
    expect(load.xml).toContain('<mxCell id="0"/>')
  })

  it('saves by asking for xmlsvg, then one diagram update whose links are the XML', async () => {
    const updates: unknown[] = []
    const { keeper: held, puts } = keeper(async (drawing) => { updates.push(drawing); return { ok: true } })
    const frame = open(held, undefined)
    hear(frame.win, { event: 'save', xml: XML })
    expect(JSON.parse(frame.posted().at(-1)?.data ?? '{}')).toEqual({ action: 'export', format: 'xmlsvg' })
    hear(frame.win, { event: 'export', xml: XML, data: dataUri(SVG) })
    await waitFor(() => expect(updates).toHaveLength(1))
    expect(new TextDecoder().decode(puts[0])).toBe(SVG)
    expect(updates[0]).toEqual(savedDrawing(XML, ADDRESS))
    expect((updates[0] as { links: unknown }).links).toEqual(linksFromXml(XML))
  })

  it('merges the newer drawing when the channel refuses the save as an overlap', async () => {
    const newer = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n" parent="1" value="Theirs"/></root></mxGraphModel>'
    let current = XML
    const { keeper: held } = keeper(async () => {
      current = newer
      return { refused: 'channel.overlap' }
    }, () => current)
    const frame = open(held, XML)
    hear(frame.win, { event: 'save', xml: XML })
    hear(frame.win, { event: 'export', xml: XML, data: dataUri(SVG) })
    await waitFor(() => expect(frame.posted().some((one) => JSON.parse(one.data).action === 'merge')).toBe(true))
    const merge = frame.posted().map((one) => JSON.parse(one.data) as { action: string; xml?: string }).find((one) => one.action === 'merge')
    expect(merge?.xml).toBe(newer)
  })

  it('does not merge a refusal the reducer already said', async () => {
    let answered = false
    const { keeper: held } = keeper(async () => { answered = true; return { refused: 'command.gone' } })
    const frame = open(held, XML)
    hear(frame.win, { event: 'export', xml: XML, data: dataUri(SVG) })
    await waitFor(() => expect(answered).toBe(true))
    expect(frame.posted().some((one) => JSON.parse(one.data).action === 'merge')).toBe(false)
  })
})
