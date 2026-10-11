// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { translator } from '../i18n'
import type { DesignDiagram } from '../model'
import { renderShell } from './testing/renderShell'
import { DrawingView } from './DrawingView'
import { drawingPage } from './WorkspaceEditor'

afterEach(() => cleanup())

const s = translator('en')

const drawing = (picture?: string): DesignDiagram => ({
  id: 'ctx', kind: 'drawing', name: 'Context', members: [],
  ...(picture ? { drawing: { xml: '<mxfile/>', picture, links: [] } } : {}),
})

const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')

describe('DrawingView', () => {
  it('says a drawing with no picture is not drawn yet', () => {
    renderShell(<DrawingView diagram={drawing()} scope="acme" images={undefined} s={s} />)
    expect(screen.getByTestId('drawing-not-drawn').textContent).toBe('Not drawn yet')
    expect(screen.queryByTestId('drawing-picture')).toBeNull()
    expect(screen.getByTestId('drawing-edit').textContent).toBe('Edit')
    expect(screen.getByTestId('drawing-editor-unavailable').textContent).toBe('The editor is not available')
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
    renderShell(<DrawingView diagram={drawing('sha256:gone')} scope="acme" images={images} s={s} />)
    expect(await screen.findByTestId('drawing-not-drawn')).toBeTruthy()
  })

  it('offers no Edit on a read-only view, and puts nothing', async () => {
    const put = vi.fn()
    const images = { bytesAt: () => Promise.resolve({ mediaType: 'image/svg+xml', bytes: svg }), put }
    renderShell(
      <DrawingView
        diagram={drawing('sha256:aa')} scope="acme" images={images} readOnly
        origin={() => 'drawing://local'} dispatch={vi.fn()} notify={vi.fn()} s={s}
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
        origin={() => 'drawing://local'} dispatch={dispatch} notify={vi.fn()} s={s}
      />,
    )
    fireEvent.click(screen.getByTestId('drawing-edit'))
    const frame = screen.getByTestId('drawing-frame') as HTMLIFrameElement
    const win = frame.contentWindow!
    win.postMessage = (() => {}) as Window['postMessage']
    const hear = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), source: win, origin: 'drawing://local' }))
    hear({ event: 'save', xml: '<mxGraphModel><root/></mxGraphModel>' })
    hear({ event: 'export', format: 'svg', data: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"/>')}` })
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1))
    expect(images.connection.kept).toHaveLength(1)
  })
})

describe('the app\'s look, as its theme resolves it', () => {
  const images = { bytesAt: () => Promise.resolve({ mediaType: 'image/svg+xml', bytes: svg }), put: vi.fn() }
  const view = () => (
    <DrawingView
      diagram={drawing('sha256:aa')} scope="acme" images={images}
      origin={() => 'drawing://local'} dispatch={vi.fn()} notify={vi.fn()} s={s}
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
      },
      session: { model: { elements: [] }, dispatch: vi.fn() },
      show: vi.fn(),
    } as unknown as Parameters<typeof drawingPage>[0]
    const one = drawingPage(parts, { ...drawing(), id: 'one' }, { readOnly: false }) as ReactElement
    const other = drawingPage(parts, { ...drawing(), id: 'other' }, { readOnly: true }) as ReactElement<{ readOnly?: boolean }>
    expect(one.key).toBe('one')
    expect(other.key).toBe('other')
    expect(other.props.readOnly).toBe(true)
  })

  it('closes the editor when the view below it is another drawing', () => {
    const images = { bytesAt: () => Promise.resolve(undefined), put: vi.fn() }
    const page = (id: string) => (
      <DrawingView
        key={id} diagram={{ ...drawing(), id }} scope="acme" images={images}
        origin={() => 'drawing://local'} dispatch={vi.fn()} notify={vi.fn()} s={s}
      />
    )
    const shown = renderShell(page('one'))
    fireEvent.click(screen.getByTestId('drawing-edit'))
    expect(screen.getByTestId('drawing-frame')).toBeTruthy()
    shown.rerender(page('other'))
    expect(screen.queryByTestId('drawing-frame')).toBeNull()
  })
})
