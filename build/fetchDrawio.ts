// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Fetch draw.io and keep the files the editor needs.
 *
 * It is not an npm dependency and it is not part of the bundle: the pruned
 * tree is what the desktop serves on the drawing scheme, from extraResources,
 * and the web build does not ship it. The version and the checksum are
 * `drawioPin` in `dependencyPolicy.ts`, the same pin the notices are written
 * from.
 *
 *   node build/fetchDrawio.ts
 *
 * The archive and the pruned tree are not committed.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { unzipSync } from 'fflate'
import { drawioPin } from './dependencyPolicy.ts'
import { DRAWING_ORIGIN_TOKEN } from '../electron/main/drawing.ts'

/** Where a packaged app's extraResources read the pruned tree from. */
export const DRAWIO_DIR = 'build/drawio'

/**
 * The files the embedded editor loads, and nothing else.
 *
 * Confirmed against the archive: `index.html` loads `js/bootstrap.js` and
 * `js/main.js`; bootstrap loads `PreConfig.js`, `app.min.js` and, off a
 * diagrams.net host, `PostConfig.js`; the app then loads the shapes, the
 * stencils and the extensions. The three `dia` files are the languages the
 * app speaks.
 */
export const DRAWIO_FILES = [
  'js/app.min.js',
  'js/extensions.min.js',
  'js/stencils.min.js',
  'js/shapes-14-6-5.min.js',
  'resources/dia.txt',
  'resources/dia_nl.txt',
  'resources/dia_de.txt',
  'js/bootstrap.js',
  'js/PreConfig.js',
  'js/PostConfig.js',
  'js/main.js',
  'styles/grapheditor.css',
  'styles/high-contrast.css',
  'mxgraph/css/common.css',
  'images/github-logo.svg',
  'images/logo-flat-small.png',
  'favicon.ico',
  'mxgraph/images/maximize.gif',
  'index.html',
] as const

/** The asset the pin names. */
export function drawioWarUrl(pin: { version: string; asset: string }): string {
  return `https://github.com/jgraph/drawio/releases/download/v${pin.version}/${pin.asset}`
}

/**
 * `PreConfig.js`, pointed at the drawing origin's placeholder.
 *
 * A truthy value, so the bundle does not fall back to diagrams.net. The
 * desktop handler replaces the token with `drawing://local` as it serves the
 * file. `EXPORT_URL` stays null: nothing is sent to a convert service.
 */
export function drawingPreConfig(source: string): string {
  return source
    .replace(/window\.DRAWIO_BASE_URL\s*=\s*[^;]*;/, `window.DRAWIO_BASE_URL = '${DRAWING_ORIGIN_TOKEN}';`)
    .replace(/window\.DRAWIO_LIGHTBOX_URL\s*=\s*[^;]*;/, `window.DRAWIO_LIGHTBOX_URL = '${DRAWING_ORIGIN_TOKEN}';`)
    .replace(/window\.EXPORT_URL\s*=\s*[^;]*;/, 'window.EXPORT_URL = null;')
}

/** Download, check, unpack the listed files, and rewrite PreConfig. */
export async function fetchDrawio(root = process.cwd(), pin = drawioPin): Promise<void> {
  const response = await fetch(drawioWarUrl(pin))
  if (!response.ok) throw new Error(`draw.io could not be fetched: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== pin.sha256) throw new Error(`draw.io checksum was ${hash}`)

  const unpacked = unzipSync(bytes)
  const out = join(root, DRAWIO_DIR)
  rmSync(out, { recursive: true, force: true })
  const found = new Set<string>()
  for (const [name, contents] of Object.entries(unpacked)) {
    const path = name.replaceAll('\\', '/')
    if (!(DRAWIO_FILES as readonly string[]).includes(path)) continue
    const file = join(out, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
    found.add(path)
  }
  const missing = DRAWIO_FILES.filter((path) => !found.has(path))
  if (missing.length > 0) throw new Error(`draw.io archive has no ${missing.join(', ')}`)

  const pre = join(out, 'js/PreConfig.js')
  writeFileSync(pre, drawingPreConfig(readFileSync(pre, 'utf8')))
}

if (process.argv[1]?.endsWith('fetchDrawio.ts')) {
  await fetchDrawio()
}
