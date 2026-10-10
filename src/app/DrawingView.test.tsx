// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { translator } from '../i18n'
import type { DesignDiagram } from '../model'
import { renderShell } from './testing/renderShell'
import { DrawingView } from './DrawingView'

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
})
