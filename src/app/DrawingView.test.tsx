// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { translator } from '../i18n'
import type { DesignDiagram } from '../model'
import { axeFindings } from './testing/axe'
import { renderShell } from './testing/renderShell'
import { DrawingView } from './DrawingView'
import { drawingPage } from './WorkspaceEditor'

afterEach(() => cleanup())

const s = translator('en')
const files = { save: () => Promise.resolve() }
const trail = { report: () => {} }

const drawing = (picture?: string): DesignDiagram => ({
  id: 'ctx', kind: 'drawing', name: 'Context', members: [],
  ...(picture ? { drawing: { xml: '<mxfile/>', picture, links: [] } } : {}),
})

const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')

describe('DrawingView', () => {
  it('says a drawing with no picture is not drawn yet, what one is, and offers to start', () => {
    const images = { bytesAt: () => Promise.resolve(undefined), put: vi.fn() }
    renderShell(<DrawingView diagram={drawing()} scope="acme" images={images} origin={() => 'drawing://local'} dispatch={vi.fn()} documents={files} diagnostics={trail} notify={vi.fn()} onNewView={vi.fn()} s={s} />)
    expect(screen.getByTestId('drawing-not-drawn').textContent).toContain('Not drawn yet')
    expect(screen.queryByTestId('drawing-picture')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start drawing' })).toBeTruthy()
    expect(screen.getByTestId('drawing-new-board')).toBeTruthy()
  })

  it('says why there is no editor here and the way on, with no disabled button', () => {
    const get = vi.fn()
    renderShell(<DrawingView diagram={drawing()} scope="acme" images={undefined} onGetDesktop={get} s={s} />)
    expect(screen.getByTestId('drawing-editor-unavailable').textContent).toContain('cannot be edited in this browser')
    expect(screen.queryByTestId('drawing-edit')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Get the desktop app' }))
    expect(get).toHaveBeenCalled()
  })

  it('says a drawing written without its editor holds shapes, and its links can still be read', () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
      + '<UserObject id="s" label="Billing" link="element:billing"><mxCell parent="1" vertex="1"><mxGeometry width="3" height="4" as="geometry"/></mxCell></UserObject>'
      + '<mxCell id="n" value="A note" parent="1" vertex="1"><mxGeometry width="3" height="4" as="geometry"/></mxCell></root></mxGraphModel>'
    const held = { ...drawing(), drawing: { xml, links: [{ shapeId: 's', elementId: 'billing', area: { x: 0, y: 0, width: 3, height: 4 } }] } } as unknown as DesignDiagram
    renderShell(<DrawingView diagram={held} scope="acme" images={undefined} elements={[{ id: 'billing', name: 'Billing' }]} readOnly s={s} />)
    expect(screen.getByTestId('drawing-not-pictured').textContent).toContain('Written, but not pictured yet')
    expect(screen.getByTestId('drawing-statement').textContent).toContain('1 of 2 shapes point at the model')
    fireEvent.click(screen.getByTestId('drawing-points-s'))
    expect(screen.getByTestId('drawing-reader').textContent).toContain('Billing')
  })

  it('shows the picture when the bytes are there, and the same words when they are not', async () => {
    const images = {
      bytesAt: (scope: string, address: string) => Promise.resolve(
        scope === 'acme' && address === 'sha256:aa' ? { mediaType: 'image/svg+xml', bytes: svg } : undefined,
      ),
    }
    renderShell(<DrawingView diagram={drawing('sha256:aa')} scope="acme" images={images} s={s} />)
    expect(await screen.findByTestId('drawing-picture')).toBeTruthy()

    cleanup()
    renderShell(<DrawingView diagram={drawing('sha256:gone')} scope="acme" images={images} readOnly s={s} />)
    expect(await screen.findByTestId('drawing-not-drawn')).toBeTruthy()
  })

  it('offers no Edit on a read-only view, and puts nothing', async () => {
    const put = vi.fn()
    const images = { bytesAt: () => Promise.resolve({ mediaType: 'image/svg+xml', bytes: svg }), put }
    renderShell(
      <DrawingView
        diagram={drawing('sha256:aa')} scope="acme" images={images} readOnly
        origin={() => 'drawing://local'} dispatch={vi.fn()} documents={files} diagnostics={trail} notify={vi.fn()} s={s}
      />,
    )
    expect(await screen.findByTestId('drawing-picture')).toBeTruthy()
    expect(screen.queryByTestId('drawing-edit')).toBeNull()
    expect(screen.queryByTestId('drawing-editor-unavailable')).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })
})

describe('saving a drawing', () => {
  it('calls the repository\'s put on the repository, so a put that reads its own fields works', async () => {
    class Kept {
      readonly connection = { kept: [] as Uint8Array[] }
      bytesAt() { return Promise.resolve(undefined) }
      put(_scope: string, _name: string, bytes: Uint8Array) {
        this.connection.kept.push(bytes)
        return Promise.resolve({ contentAddress: `sha256:${'cd'.repeat(32)}` })
      }
    }
    const images = new Kept()
    const dispatch = vi.fn(() => true)
    renderShell(
      <DrawingView
        diagram={drawing()} scope="acme" images={images}
        origin={() => 'drawing://local'} dispatch={dispatch} documents={files} diagnostics={trail} notify={vi.fn()} s={s}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start drawing' }))
    const frame = screen.getByTestId('drawing-frame') as HTMLIFrameElement
    const win = frame.contentWindow!
    win.postMessage = (() => {}) as Window['postMessage']
    const hear = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), source: win, origin: 'drawing://local' }))
    hear({ event: 'save', xml: '<mxGraphModel><root/></mxGraphModel>' })
    hear({ event: 'export', format: 'svg', message: { action: 'export', format: 'xmlsvg' }, data: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"/>')}` })
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1))
    expect(images.connection.kept).toHaveLength(1)
  })
})

describe('the app\'s look, as its theme resolves it', () => {
  const images = { bytesAt: () => Promise.resolve({ mediaType: 'image/svg+xml', bytes: svg }), put: vi.fn() }
  const view = () => (
    <DrawingView
      diagram={drawing('sha256:aa')} scope="acme" images={images}
      origin={() => 'drawing://local'} dispatch={vi.fn()} documents={files} diagnostics={trail} notify={vi.fn()} s={s}
    />
  )

  it('draws the picture in the theme\'s colour scheme, and opens the editor in the theme\'s look', async () => {
    for (const mode of ['light', 'dark'] as const) {
      renderShell(view(), { mode })
      const picture = await screen.findByTestId('drawing-picture')
      expect(picture.style.colorScheme).toBe(mode)
      fireEvent.click(screen.getByTestId('drawing-edit'))
      expect(screen.getByTestId('drawing-frame').getAttribute('src')).toContain(`&dark=${mode === 'dark' ? 1 : 0}`)
      cleanup()
    }
  })
})

describe('one drawing per mount', () => {
  it('keys a drawing\'s page by the drawing, so an open editor is gone when another drawing is up', () => {
    const parts = {
      props: {
        project: { id: 'acme', path: 'acme' },
        source: { repositories: { images: undefined } },
        shell: { drawingOrigin: () => 'drawing://local', language: 'en', notify: vi.fn(), s },
        files: { documents: files },
        host: { diagnostics: trail },
      },
      session: { model: { elements: [] }, dispatch: vi.fn() },
      show: vi.fn(),
    } as unknown as Parameters<typeof drawingPage>[0]
    const one = drawingPage(parts, { ...drawing(), id: 'one' }, { readOnly: false }) as ReactElement<{ documents?: unknown; diagnostics?: unknown }>
    const other = drawingPage(parts, { ...drawing(), id: 'other' }, { readOnly: true }) as ReactElement<{ readOnly?: boolean }>
    expect(one.key).toBe('one')
    // The editor's exports reach the device through the workspace's own channel.
    expect(one.props.documents).toBe(files)
    expect(one.props.diagnostics).toBe(trail)
    expect(other.key).toBe('other')
    expect(other.props.readOnly).toBe(true)
  })

  it('closes the editor when the view below it is another drawing', () => {
    const images = { bytesAt: () => Promise.resolve(undefined), put: vi.fn() }
    const page = (id: string) => (
      <DrawingView
        key={id} diagram={{ ...drawing(), id }} scope="acme" images={images}
        origin={() => 'drawing://local'} dispatch={vi.fn()} documents={files} diagnostics={trail} notify={vi.fn()} s={s}
      />
    )
    const shown = renderShell(page('one'))
    fireEvent.click(screen.getByRole('button', { name: 'Start drawing' }))
    expect(screen.getByTestId('drawing-frame')).toBeTruthy()
    shown.rerender(page('other'))
    expect(screen.queryByTestId('drawing-frame')).toBeNull()
  })
})

describe('reading a linked shape', () => {
  const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
    + '<UserObject id="a" label="Fleet Register" link="element:fleet"><mxCell parent="1" vertex="1"><mxGeometry width="30" height="40" as="geometry"/></mxCell></UserObject>'
    + '<UserObject id="b" label="Billing" link="element:billing"><mxCell parent="1" vertex="1"><mxGeometry x="40" width="30" height="40" as="geometry"/></mxCell></UserObject>'
    + '<UserObject id="c" label="Old tool" link="element:gone"><mxCell parent="1" vertex="1"><mxGeometry x="80" width="30" height="40" as="geometry"/></mxCell></UserObject>'
    + '</root></mxGraphModel>'
  const area = { x: 0, y: 0, width: 30, height: 40 }
  const held = {
    ...drawing(), drawing: {
      xml, picture: 'sha256:aa',
      links: [{ shapeId: 'a', elementId: 'fleet', area }, { shapeId: 'b', elementId: 'billing', area }, { shapeId: 'c', elementId: 'gone', area }],
    },
  } as unknown as DesignDiagram
  const images = { bytesAt: () => Promise.resolve({ mediaType: 'image/svg+xml', bytes: svg }) }
  const elements = [{ id: 'fleet', name: 'Vehicle Register', kind: 'application' }, { id: 'billing', name: 'Billing', kind: 'application', description: 'Turns orders into invoices.' }]

  it('opens the element in the panel beside the picture, and its page from there', async () => {
    const onOpen = vi.fn()
    renderShell(<DrawingView diagram={held} scope="acme" images={images} elements={elements} onOpen={onOpen} s={s} />)
    fireEvent.click(await screen.findByTestId('drawing-area-b'))
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByTestId('drawing-reader-description').textContent).toContain('invoices')
    fireEvent.click(screen.getByTestId('drawing-reader-open'))
    expect(onOpen).toHaveBeenCalledWith({ page: 'element', id: 'billing' })
  })

  it('says which links have gone wrong, by name, and how many, on the bar and in the list', async () => {
    renderShell(<DrawingView diagram={held} scope="acme" images={images} elements={elements} s={s} />)
    const links = await screen.findByTestId('drawing-links')
    expect(links.textContent).toBe('3 links · 2 need a look')
    fireEvent.click(links)
    expect(screen.getByTestId('drawing-trouble-a').textContent).toContain('The picture still says Fleet Register')
    expect(screen.getByTestId('drawing-trouble-c').textContent).toContain('No longer in this scope')
    expect(screen.getByTestId('drawing-link-b').textContent).toBe('Billing')
    expect(screen.getByTestId('drawing-area-b').getAttribute('data-marked')).not.toBeNull()
    expect(screen.getByTestId('drawing-area-a').getAttribute('data-state')).toBe('stale')
  })

  it('a pressed shape whose element is gone opens the list, which says so', async () => {
    renderShell(<DrawingView diagram={held} scope="acme" images={images} elements={elements} s={s} />)
    fireEvent.click(await screen.findByTestId('drawing-area-c'))
    expect(screen.getByTestId('drawing-links-panel')).toBeTruthy()
    expect(screen.queryByTestId('drawing-reader')).toBeNull()
  })

  it('has nothing axe finds on the picture with its list open', async () => {
    const { container } = renderShell(<DrawingView diagram={held} scope="acme" images={images} elements={elements} s={s} />)
    fireEvent.click(await screen.findByTestId('drawing-links'))
    expect(await axeFindings(container)).toEqual([])
  })

  it('offers no Edit to a reader, and says it once; export stays', async () => {
    renderShell(<DrawingView diagram={held} scope="acme" images={images} elements={elements} readOnly documents={files} s={s} />)
    await screen.findByTestId('drawing-picture')
    expect(screen.getByTestId('drawing-statement').textContent).toContain('You may read this.')
    expect(screen.queryByTestId('drawing-edit')).toBeNull()
    expect(screen.getByRole('button', { name: 'Export…' })).toBeTruthy()
  })
})
