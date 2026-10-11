// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The frame's half of the protocol: configure, load, save, and a merge when
 * the save is refused as an overlap. The iframe is a mock; the messages are
 * the ones draw.io's JSON protocol uses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { translator } from '../i18n'
import { linksFromXml } from '../model/drawing'
import { renderShell } from './testing/renderShell'
import { DrawingEditor } from './DrawingEditor'
import type { DrawingKeeper } from './DrawingEditor'
import {
  drawingConfig, drawingFrameQuery, drawingFrameSrc, elementShapeXml, frameTarget, savedDrawing, savedXml, svgBytes,
  withElementNames,
} from './drawingProtocol'

afterEach(() => cleanup())

const s = translator('en')
const ADDRESS = `sha256:${'ab'.repeat(32)}`
const XML = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
  + '<UserObject id="s" label="Billing" link="element:billing"><mxCell parent="1" vertex="1">'
  + '<mxGeometry x="1" y="2" width="3" height="4" as="geometry"/></mxCell></UserObject></root></mxGraphModel>'
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>'
const ORIGIN = 'drawing://local'

function dataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/** The iframe's window, with postMessage recorded, after the listener is up. */
function frameWindow(): { win: Window; posted: () => { data: string; target: string }[]; actions: () => { action: string; [key: string]: unknown }[] } {
  const frame = screen.getByTestId('drawing-frame') as HTMLIFrameElement
  const win = frame.contentWindow
  if (!win) throw new Error('the frame has no window')
  const posted: { data: string; target: string }[] = []
  win.postMessage = ((data: unknown, target?: string) => {
    posted.push({ data: String(data), target: String(target) })
  }) as Window['postMessage']
  return { win, posted: () => posted, actions: () => posted.map((one) => JSON.parse(one.data) as { action: string }) }
}

function hear(win: Window, data: unknown, origin = ORIGIN): void {
  window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), source: win, origin }))
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
  it('opens embedded, in the app language and look, keeping changes until a save lands, and does not name libs', () => {
    expect(drawingFrameQuery('nl')).toBe('embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1&keepmodified=1&ui=min&lang=nl&dark=0')
    expect(drawingFrameQuery('nl', 'dark')).toContain('&dark=1')
    expect(drawingFrameQuery('nl')).not.toContain('libs=')
    expect(frameTarget('drawing://local')).toBe('drawing://local')
    expect(frameTarget('https://draw.example/editor')).toBe('https://draw.example')
    expect(drawingFrameSrc('drawing://local', 'de')).toBe(
      'drawing://local/?embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1&keepmodified=1&ui=min&lang=de&dark=0',
    )
  })

  it('sends the elements as uncompressed XML, each a UserObject pointing at its element, labelled in plain text', () => {
    const shape = elementShapeXml({ id: 'billing', name: 'Billing <core>' })
    expect(shape.startsWith('<')).toBe(true)
    expect(shape).toContain('<UserObject')
    expect(shape).toContain('label="Billing &lt;core&gt;"')
    expect(shape).not.toContain('html=1')
    expect(shape).toContain('link="element:billing"')
    const config = drawingConfig([{ id: 'billing', name: 'Billing <core>' }], 'Elements')
    expect(config.compressXml).toBe(false)
    expect(config.defaultLibraries).toBe('elements;c4')
    expect(config.enabledLibraries).toEqual(['elements', 'c4'])
    expect(config.expandLibraries).toBe(true)
    const data = (config.libraries[0] as { entries: { libs: { data: { xml: string }[] }[] }[] }).entries[0].libs[0].data
    expect(data[0].xml).toBe(shape)
  })

  it('keeps the XML the save named, and never a compressed one', () => {
    const compressed = '<mxfile><diagram id="p">tZZNc5sw</diagram></mxfile>'
    expect(savedXml(compressed, XML)).toBe(XML)
    expect(savedXml(XML, undefined)).toBe(XML)
    expect(savedXml(compressed, undefined)).toBeUndefined()
    expect(savedXml(compressed, compressed)).toBeUndefined()
  })

  it('keeps an SVG as a picture, and nothing else', () => {
    expect(svgBytes(dataUri(SVG))).toBeDefined()
    expect(svgBytes(dataUri(`<?xml version="1.0"?><!DOCTYPE svg>${SVG}`))).toBeDefined()
    expect(svgBytes(dataUri('<html><body>no</body></html>'))).toBeUndefined()
    expect(svgBytes('data:image/png;base64,iVBORw0KGgo=')).toBeUndefined()
    expect(svgBytes('not a picture')).toBeUndefined()
  })

  it('labels each pointing shape with its element\'s name, HTML as HTML, and leaves the rest', () => {
    const xml = '<mxGraphModel><root>'
      + '<UserObject id="a" label="Old" link="element:billing"><mxCell vertex="1" style="rounded=0;"/></UserObject>'
      + '<mxCell id="b" value="&lt;b&gt;Ledger&lt;/b&gt;" lvElement="ledger" style="html=1;" vertex="1"/>'
      + '<mxCell id="c" value="Was" lvElement="orders" style="html=1;" vertex="1"/>'
      + '<mxCell id="d" value="Free text" vertex="1"/>'
      + '<UserObject id="e" label="Gone" link="element:nobody"><mxCell vertex="1"/></UserObject>'
      + '</root></mxGraphModel>'
    const named = withElementNames(xml, [
      { id: 'billing', name: 'Billing & co' }, { id: 'ledger', name: 'Ledger' }, { id: 'orders', name: 'A < B' },
    ])
    expect(named).toContain('label="Billing &amp; co"')
    // The label already reads as the name: its formatting stays.
    expect(named).toContain('value="&lt;b&gt;Ledger&lt;/b&gt;"')
    expect(named).toContain('value="A &amp;lt; B"')
    expect(named).toContain('value="Free text"')
    expect(named).toContain('label="Gone"')
  })
})

describe('DrawingEditor', () => {
  function editor(held: DrawingKeeper, more: Partial<Parameters<typeof DrawingEditor>[0]> = {}): ReactElement {
    return (
      <DrawingEditor
        origin={ORIGIN}
        language="en"
        mode="light"
        xml={undefined}
        elements={[{ id: 'billing', name: 'Billing' }]}
        paletteTitle="Elements"
        keeper={held}
        notify={() => {}}
        s={s}
        {...more}
      />
    )
  }

  function open(held: DrawingKeeper, more: Partial<Parameters<typeof DrawingEditor>[0]> = {}) {
    const shown = renderShell(editor(held, more))
    return { ...frameWindow(), rerender: (next: Partial<Parameters<typeof DrawingEditor>[0]>) => shown.rerender(editor(held, { ...more, ...next })) }
  }

  it('frames the editor sandboxed to scripts on its own origin, in the app\'s look', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }))
    open(held, { mode: 'dark' })
    const frame = screen.getByTestId('drawing-frame')
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
    expect(frame.getAttribute('src')).toContain('&dark=1')
  })

  it('answers configure with the palette and init with the drawing, its labels refreshed', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }))
    const frame = open(held, { xml: XML, elements: [{ id: 'billing', name: 'Billing service' }] })
    hear(frame.win, { event: 'configure' })
    hear(frame.win, { event: 'init' })
    const messages = frame.actions() as { action: string; xml?: string; dark?: boolean; config?: { defaultLibraries: string } }[]
    expect(messages.map((one) => one.action)).toEqual(['configure', 'load'])
    expect(messages[0].config?.defaultLibraries).toBe('elements;c4')
    expect(messages[1].xml).toBe(XML.replace('label="Billing"', 'label="Billing service"'))
    expect(messages[1].dark).toBe(false)
    expect(frame.posted().every((one) => one.target === ORIGIN)).toBe(true)
  })

  it('hears nothing from another origin, or from another window', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }))
    const frame = open(held, { xml: XML })
    hear(frame.win, { event: 'init' }, 'https://elsewhere.example')
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event: 'init' }), source: window, origin: ORIGIN }))
    expect(frame.posted()).toHaveLength(0)
  })

  it('loads an empty model when the drawing has not been drawn', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }))
    const frame = open(held)
    hear(frame.win, { event: 'init' })
    const load = frame.actions()[0] as { action: string; xml: string }
    expect(load.action).toBe('load')
    expect(load.xml.startsWith('<mxGraphModel>')).toBe(true)
    expect(load.xml).toContain('<mxCell id="0"/>')
  })

  it('saves the save\'s own XML: xmlsvg asked for, one diagram update, then the editor told it landed', async () => {
    const updates: unknown[] = []
    const { keeper: held, puts } = keeper(async (drawing) => { updates.push(drawing); return { ok: true } })
    const frame = open(held)
    hear(frame.win, { event: 'save', xml: XML })
    expect(frame.actions().at(-1)).toEqual({ action: 'export', format: 'xmlsvg' })
    // draw.io's export carries its own copy compressed; the save's is the one kept.
    hear(frame.win, { event: 'export', format: 'svg', xml: '<mxfile><diagram id="p">tZZNc5sw</diagram></mxfile>', data: dataUri(SVG) })
    await waitFor(() => expect(updates).toHaveLength(1))
    expect(new TextDecoder().decode(puts[0])).toBe(SVG)
    expect(updates[0]).toEqual(savedDrawing(XML, ADDRESS))
    expect((updates[0] as { links: unknown }).links).toEqual(linksFromXml(XML))
    await waitFor(() => expect(frame.actions().at(-1)).toEqual({ action: 'status', modified: false }))
  })

  it('leaves on the editor\'s Exit, and after a save and exit that landed', async () => {
    const onClose = vi.fn()
    const { keeper: held } = keeper(async () => ({ ok: true }))
    const frame = open(held, { onClose })
    hear(frame.win, { event: 'save', xml: XML, exit: true })
    hear(frame.win, { event: 'export', format: 'svg', data: dataUri(SVG) })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    hear(frame.win, { event: 'exit', modified: false })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('stays when a save and exit did not land', async () => {
    const onClose = vi.fn()
    let answered = false
    const { keeper: held } = keeper(async () => { answered = true; return { refused: 'command.gone' } })
    const frame = open(held, { onClose })
    hear(frame.win, { event: 'save', xml: XML, exit: true })
    hear(frame.win, { event: 'export', format: 'svg', data: dataUri(SVG) })
    await waitFor(() => expect(answered).toBe(true))
    expect(onClose).not.toHaveBeenCalled()
    expect(frame.actions().some((one) => one.action === 'status')).toBe(false)
  })

  it('writes only the newer of two saves whose exports finish out of order', async () => {
    const updates: { xml: string }[] = []
    let release: (() => void) | undefined
    let puts = 0
    const held: DrawingKeeper = {
      put: async () => {
        puts += 1
        if (puts === 1) await new Promise<void>((resolve) => { release = resolve })
        return { contentAddress: ADDRESS }
      },
      update: async (drawing) => { updates.push(drawing); return { ok: true } },
      xml: () => undefined,
    }
    const frame = open(held)
    const older = XML.replace('label="Billing"', 'label="Older"')
    hear(frame.win, { event: 'save', xml: older })
    hear(frame.win, { event: 'save', xml: XML })
    hear(frame.win, { event: 'export', format: 'svg', data: dataUri(SVG) })
    hear(frame.win, { event: 'export', format: 'svg', data: dataUri(SVG) })
    await waitFor(() => expect(updates).toHaveLength(1))
    release?.()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(updates.map((one) => one.xml)).toEqual([XML])
  })

  it('merges a drawing somebody else saved while the editor is open, before its first save', () => {
    const newer = '<mxGraphModel><root><mxCell id="0"/><mxCell id="n" parent="0" value="Theirs"/></root></mxGraphModel>'
    let current = XML
    const { keeper: held } = keeper(async () => ({ ok: true }), () => current)
    const frame = open(held, { xml: XML })
    current = newer
    frame.rerender({})
    expect(frame.actions()).toEqual([{ action: 'merge', xml: newer }])
  })

  it('merges the newer drawing when the model goes back to it after this save was refused', async () => {
    const newer = '<mxGraphModel><root><mxCell id="0"/><mxCell id="n" parent="0" value="Theirs"/></root></mxGraphModel>'
    let current = XML
    const { keeper: held } = keeper(async () => ({ ok: true }), () => current)
    const frame = open(held, { xml: XML })
    const mine = XML.replace('label="Billing"', 'label="Mine"')
    hear(frame.win, { event: 'save', xml: mine })
    hear(frame.win, { event: 'export', format: 'svg', data: dataUri(SVG) })
    await waitFor(() => expect(frame.actions().some((one) => one.action === 'status')).toBe(true))
    // The save landed as a step; the channel refused it and the model is theirs.
    current = mine
    frame.rerender({})
    expect(frame.actions().some((one) => one.action === 'merge')).toBe(false)
    current = newer
    frame.rerender({})
    expect(frame.actions().filter((one) => one.action === 'merge')).toEqual([{ action: 'merge', xml: newer }])
  })

  it('reloads the drawing as it is in the editor when the app\'s look changes, still unsaved', () => {
    const { keeper: held } = keeper(async () => ({ ok: true }), () => XML)
    const frame = open(held, { xml: XML })
    frame.rerender({ mode: 'dark' })
    expect(frame.actions().at(-1)).toEqual({ action: 'export', format: 'xml' })
    const edited = XML.replace('label="Billing"', 'label="Edited"')
    hear(frame.win, { event: 'export', format: 'xml', xml: edited })
    expect(frame.actions().slice(-2)).toEqual([
      { action: 'load', xml: edited, dark: true },
      { action: 'status', modified: true },
    ])
  })
})
