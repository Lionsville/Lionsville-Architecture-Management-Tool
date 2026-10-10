// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pruned PreConfig no longer points at diagrams.net, and the fetch reads
 * the same pin the notices are written from.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DRAWING_ORIGIN_TOKEN } from '../electron/main/drawing'
import { drawioPin } from './dependencyPolicy'
import { drawingPreConfig, drawioWarUrl } from './fetchDrawio'

describe('fetchDrawio', () => {
  it('points the asset at the pin, and the rewritten config at the placeholder', () => {
    expect(drawioWarUrl(drawioPin)).toBe(`https://github.com/jgraph/drawio/releases/download/v${drawioPin.version}/draw.war`)
    const rewritten = drawingPreConfig([
      'window.DRAWIO_BASE_URL = \'https://app.diagrams.net\';',
      'window.DRAWIO_LIGHTBOX_URL = \'https://viewer.diagrams.net\';',
      'window.EXPORT_URL = \'https://convert.diagrams.net/node/export\';',
    ].join('\n'))
    expect(rewritten).not.toContain('diagrams.net')
    expect(rewritten).toContain(`window.DRAWIO_BASE_URL = '${DRAWING_ORIGIN_TOKEN}';`)
    expect(rewritten).toContain(`window.DRAWIO_LIGHTBOX_URL = '${DRAWING_ORIGIN_TOKEN}';`)
    expect(rewritten).toContain('window.EXPORT_URL = null;')
  })

  it('does not keep a version of its own', () => {
    const script = readFileSync(new URL('./fetchDrawio.ts', import.meta.url), 'utf8')
    expect(script).toContain('drawioPin')
    expect(script).not.toContain(drawioPin.version)
    expect(script).not.toContain(drawioPin.sha256)
  })
})
