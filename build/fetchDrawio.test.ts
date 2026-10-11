// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pruned PreConfig no longer points at diagrams.net, the fetch reads the
 * same pin the notices are written from, and a tree made from the pin is
 * left alone — so after one fetch nothing needs the network.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { DRAWING_ORIGIN_TOKEN } from '../electron/main/drawing'
import { drawioPin } from './dependencyPolicy'
import {
  DRAWIO_DIR, DRAWIO_FILES, drawingPreConfig, drawioCacheFile, drawioWarUrl, fetchDrawio, preConfigRefusal, pruneInto,
  treeRefusal,
} from './fetchDrawio'

const PRE_CONFIG = [
  "window.DRAWIO_BASE_URL = 'https://app.diagrams.net';",
  "window.DRAWIO_LIGHTBOX_URL = 'https://viewer.diagrams.net';",
  "window.EXPORT_URL = 'https://convert.diagrams.net/node/export';",
].join('\n')

/** An archive holding every listed file, and one the editor does not need. */
function archive(preConfig = PRE_CONFIG): Uint8Array {
  const files: Record<string, Uint8Array> = { 'js/unused.js': strToU8('// not listed') }
  for (const path of DRAWIO_FILES) files[path] = strToU8(path === 'js/PreConfig.js' ? preConfig : `// ${path}`)
  return zipSync(files)
}

const PIN = { version: '0.0.1', sha256: 'f'.repeat(64), asset: 'draw.war' }

describe('fetchDrawio', () => {
  it('points the asset at the pin, and the rewritten config at the placeholder', () => {
    expect(drawioWarUrl(drawioPin)).toBe(`https://github.com/jgraph/drawio/releases/download/v${drawioPin.version}/draw.war`)
    const rewritten = drawingPreConfig(PRE_CONFIG)
    expect(rewritten).not.toContain('diagrams.net')
    expect(rewritten).toContain(`window.DRAWIO_BASE_URL = '${DRAWING_ORIGIN_TOKEN}';`)
    expect(rewritten).toContain(`window.DRAWIO_LIGHTBOX_URL = '${DRAWING_ORIGIN_TOKEN}';`)
    expect(rewritten).toContain('window.EXPORT_URL = null;')
    expect(preConfigRefusal(rewritten)).toBeUndefined()
  })

  it('refuses a PreConfig the rewrite did not take: a token missing, or diagrams.net left', () => {
    expect(preConfigRefusal(drawingPreConfig("window.DRAWIO_BASE_URL = 'https://app.diagrams.net';"))).toMatch(/once|1 times/)
    const left = `${drawingPreConfig(PRE_CONFIG)}\nwindow.DRAWIO_VIEWER_URL = 'https://viewer.diagrams.net/js/viewer.min.js';`
    expect(preConfigRefusal(left)).toContain('diagrams.net')
    expect(() => pruneInto(mkdtempSync(join(tmpdir(), 'drawio-')), archive('// nothing to rewrite'), PIN)).toThrow(/token/)
  })

  it('unpacks the listed files only, and stamps the tree with the pin it was made from', () => {
    const root = mkdtempSync(join(tmpdir(), 'drawio-'))
    expect(treeRefusal(root, PIN)).toContain('no stamp')
    pruneInto(join(root, DRAWIO_DIR), archive(), PIN)
    expect(existsSync(join(root, DRAWIO_DIR, 'js/unused.js'))).toBe(false)
    expect(readdirSync(join(root, DRAWIO_DIR, 'resources')).sort()).toEqual(['dia.txt', 'dia_de.txt', 'dia_nl.txt'])
    expect(treeRefusal(root, PIN)).toBeUndefined()
    expect(treeRefusal(root, { ...PIN, version: '0.0.2' })).toContain('another draw.io')
    expect(readFileSync(join(root, DRAWIO_DIR, 'js/PreConfig.js'), 'utf8')).toContain(DRAWING_ORIGIN_TOKEN)
  })

  it('leaves a tree that is the pin alone, and fetches nothing for it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'drawio-'))
    pruneInto(join(root, DRAWIO_DIR), archive(), PIN)
    const said: string[] = []
    await fetchDrawio(root, PIN, (line) => said.push(line))
    expect(said).toEqual([`draw.io ${PIN.version}: ${DRAWIO_DIR} is up to date`])
  })

  it('keeps the archive in a cache outside the tree, by version, or where the environment says', () => {
    expect(drawioCacheFile('/repo', PIN, {})).toBe('/repo/node_modules/.cache/drawio/0.0.1.war')
    expect(drawioCacheFile('/repo', PIN, { LVARCH_DRAWIO_CACHE: '/cache' })).toBe('/cache/0.0.1.war')
  })

  it('does not keep a version of its own', () => {
    const script = readFileSync(new URL('./fetchDrawio.ts', import.meta.url), 'utf8')
    expect(script).toContain('drawioPin')
    expect(script).not.toContain(drawioPin.version)
    expect(script).not.toContain(drawioPin.sha256)
  })
})
