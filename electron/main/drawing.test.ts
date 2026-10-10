// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The drawing scheme: a path stays inside the directory, a frame stays on the
 * scheme, and the files are served with a policy that reaches nothing.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  allowsDrawingNavigation, drawingContentSecurityPolicy, drawingDirectory, drawingFileResponse,
  frameNavigationCancelled, locateWithin, withDrawingOrigin, withinRoot, DRAWING_ORIGIN_TOKEN,
} from './drawing'

describe('a frame stays on the drawing scheme', () => {
  it('allows the scheme and refuses every other', () => {
    expect(allowsDrawingNavigation('drawing://local/')).toBe(true)
    expect(allowsDrawingNavigation('drawing://local/index.html?embed=1')).toBe(true)
    expect(allowsDrawingNavigation('https://app.diagrams.net/')).toBe(false)
    expect(allowsDrawingNavigation('app://local/')).toBe(false)
    expect(allowsDrawingNavigation('file:///tmp/index.html')).toBe(false)
  })

  it('cancels a frame that leaves the scheme, and leaves the main frame to will-navigate', () => {
    expect(frameNavigationCancelled('https://app.diagrams.net/', false)).toBe(true)
    expect(frameNavigationCancelled('drawing://local/index.html', false)).toBe(false)
    expect(frameNavigationCancelled('app://local/', true)).toBe(false)
    expect(frameNavigationCancelled('https://app.diagrams.net/', true)).toBe(false)
  })
})

describe('a path stays inside the directory', () => {
  const root = '/var/drawio'

  it('keeps a file under the root and refuses one that leaves it', () => {
    expect(withinRoot(root, '/var/drawio/js/app.min.js')).toBe(true)
    expect(withinRoot(root, '/var/drawio')).toBe(false)
    expect(withinRoot(root, '/var/drawio-evil/js/app.min.js')).toBe(false)
    expect(withinRoot(root, '/etc/passwd')).toBe(false)
  })

  it('resolves a traversal to a refusal', () => {
    expect(locateWithin(root, '/../../etc/passwd')).toEqual({ forbidden: true })
    expect(locateWithin(root, '/js/app.min.js')).toEqual({ filePath: '/var/drawio/js/app.min.js' })
    expect(locateWithin(root, '/')).toEqual({ filePath: '/var/drawio/index.html' })
  })
})

describe('the files are served closed off', () => {
  it('allows no network and names no frame', () => {
    const policy = drawingContentSecurityPolicy()
    expect(policy).toContain("connect-src 'none'")
    expect(policy).not.toContain('frame-src')
    expect(policy).not.toContain('https:')
    expect(policy).not.toContain('diagrams.net')
  })

  it('keeps the packaged files under resources and the unpackaged ones beside the bundle', () => {
    expect(drawingDirectory({ packaged: true, resourcesPath: '/apps/resources', moduleDir: '/src/out/main' }))
      .toBe('/apps/resources/drawio')
    expect(drawingDirectory({ packaged: false, resourcesPath: '/apps/resources', moduleDir: '/src/out/main' }))
      .toBe('/src/build/drawio')
  })

  it('rewrites the origin placeholder and refuses a path that leaves the directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'drawio-'))
    mkdirSync(join(root, 'js'))
    writeFileSync(join(root, 'js/PreConfig.js'), `window.DRAWIO_BASE_URL = '${DRAWING_ORIGIN_TOKEN}';\nwindow.EXPORT_URL = null;\n`)
    writeFileSync(join(root, 'index.html'), '<!doctype html>')

    const served = await drawingFileResponse(root, 'drawing://local/js/PreConfig.js')
    expect(served.status).toBe(200)
    expect(served.headers.get('Content-Security-Policy')).toBe(drawingContentSecurityPolicy())
    const text = await served.text()
    expect(text).toContain("window.DRAWIO_BASE_URL = 'drawing://local';")
    expect(text).not.toContain(DRAWING_ORIGIN_TOKEN)
    expect(text).toContain('window.EXPORT_URL = null;')

    // A slash encoded in a segment survives URL parsing and is a traversal once decoded.
    const escaped = `drawing://local/${encodeURIComponent('../etc/passwd')}`
    expect((await drawingFileResponse(root, escaped)).status).toBe(403)
    expect((await drawingFileResponse(root, 'drawing://other/index.html')).status).toBe(404)
    expect((await drawingFileResponse(root, 'https://app.diagrams.net/')).status).toBe(404)
  })
})

describe('withDrawingOrigin', () => {
  it('writes the desktop origin over the placeholder', () => {
    const rewritten = withDrawingOrigin(`a ${DRAWING_ORIGIN_TOKEN} b ${DRAWING_ORIGIN_TOKEN}`)
    expect(rewritten).toBe('a drawing://local b drawing://local')
  })
})
