// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Fetch draw.io once, and keep the files the editor needs.
 *
 * It is not an npm dependency and it is not part of the bundle: the pruned
 * tree is what the desktop serves on the drawing scheme, from extraResources,
 * and the web build does not ship it. The version and the checksum are
 * `drawioPin` in `dependencyPolicy.ts`, the same pin the notices are written
 * from.
 *
 *   node build/fetchDrawio.ts           fetch and prune, where the tree is not the pin's
 *   node build/fetchDrawio.ts --check   fail where the tree is not the pin's; fetch nothing
 *
 * **Once, then offline.** The archive is kept in a cache outside the tree
 * (`node_modules/.cache/drawio/<version>.war`, or `LVARCH_DRAWIO_CACHE`),
 * checked against the pin's sha256 every time it is read, and the pruned tree
 * carries a stamp of the version and the checksum it was made from. A tree
 * whose stamp is the pin's, with every file there, is left alone; one that is
 * not is made again from the cached archive; only an archive that is missing
 * or does not match is downloaded. After one fetch, the smoke run and a pack
 * need no network.
 *
 * The archive and the pruned tree are not committed.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { unzipSync } from 'fflate'
import { drawioPin } from './dependencyPolicy.ts'
import { DRAWING_ORIGIN_TOKEN } from '../electron/main/drawing.ts'

/** Where a packaged app's extraResources read the pruned tree from. */
export const DRAWIO_DIR = 'build/drawio'

/** The stamp the pruned tree carries: what it was made from. */
export const DRAWIO_STAMP = '.pin.json'

/**
 * The files the embedded editor loads, and nothing else.
 *
 * Confirmed against the archive and in the smoke run: `index.html` loads
 * `js/bootstrap.js` and `js/main.js`; bootstrap loads `PreConfig.js`,
 * `app.min.js` and, off a diagrams.net host, `PostConfig.js`; the app then
 * loads the shapes, the stencils and the extensions. The three `dia` files are
 * the languages the app speaks, read by the editor with a request to its own
 * origin.
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

type Pin = { version: string; sha256: string; asset: string }

/** The asset the pin names. */
export function drawioWarUrl(pin: { version: string; asset: string }): string {
  return `https://github.com/jgraph/drawio/releases/download/v${pin.version}/${pin.asset}`
}

/** Where the downloaded archive is kept between runs. */
export function drawioCacheFile(root: string, pin: { version: string }, env: Record<string, string | undefined> = process.env): string {
  const dir = env.LVARCH_DRAWIO_CACHE || join(root, 'node_modules', '.cache', 'drawio')
  return join(dir, `${pin.version}.war`)
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

/**
 * Why a rewritten `PreConfig.js` is not one the desktop can serve, or nothing.
 *
 * Both origins carry the token, and no diagrams.net address is left: a
 * release whose PreConfig no longer has the lines the rewrite matches would
 * otherwise ship an editor that reaches out to diagrams.net, quietly.
 */
export function preConfigRefusal(rewritten: string): string | undefined {
  const tokens = rewritten.split(DRAWING_ORIGIN_TOKEN).length - 1
  if (tokens !== 2) return `PreConfig.js carries the origin token ${tokens} times, not twice`
  if (/diagrams\.net/i.test(rewritten)) return 'PreConfig.js still names diagrams.net'
  if (!/window\.EXPORT_URL = null;/.test(rewritten)) return 'PreConfig.js still names an export service'
  return undefined
}

/** The stamp a tree made from this pin carries. */
export function stampFor(pin: Pin): string {
  return `${JSON.stringify({ version: pin.version, sha256: pin.sha256, files: DRAWIO_FILES }, null, 2)}\n`
}

/** Why the pruned tree is not the pin's, or nothing when it is. */
export function treeRefusal(root: string, pin: Pin = drawioPin): string | undefined {
  const out = join(root, DRAWIO_DIR)
  const stamp = join(out, DRAWIO_STAMP)
  if (!existsSync(stamp)) return `${DRAWIO_DIR} has no stamp; run node build/fetchDrawio.ts`
  if (readFileSync(stamp, 'utf8') !== stampFor(pin)) return `${DRAWIO_DIR} was made from another draw.io than ${pin.version}`
  const missing = DRAWIO_FILES.filter((path) => !existsSync(join(out, path)))
  if (missing.length > 0) return `${DRAWIO_DIR} has no ${missing.join(', ')}`
  return undefined
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The archive, from the cache where it is the pin's, downloaded once where it is not. */
async function archive(root: string, pin: Pin, log: (line: string) => void): Promise<Uint8Array> {
  const cached = drawioCacheFile(root, pin)
  if (existsSync(cached)) {
    const bytes = new Uint8Array(readFileSync(cached))
    if (sha256(bytes) === pin.sha256) return bytes
    log(`draw.io: the cached ${cached} is not the pin's; fetching it again`)
  }
  log(`draw.io: fetching ${drawioWarUrl(pin)}`)
  const response = await fetch(drawioWarUrl(pin))
  if (!response.ok) throw new Error(`draw.io could not be fetched: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const hash = sha256(bytes)
  if (hash !== pin.sha256) throw new Error(`draw.io checksum was ${hash}`)
  mkdirSync(dirname(cached), { recursive: true })
  writeFileSync(`${cached}.part`, bytes)
  renameSync(`${cached}.part`, cached)
  return bytes
}

/** The pruned tree, made from the archive: the listed files only, and PreConfig rewritten. */
export function pruneInto(out: string, bytes: Uint8Array, pin: Pin): void {
  const wanted = new Set<string>(DRAWIO_FILES)
  const unpacked = unzipSync(bytes, { filter: (file) => wanted.has(file.name.replaceAll('\\', '/')) })
  rmSync(out, { recursive: true, force: true })
  const found = new Set<string>()
  for (const [name, contents] of Object.entries(unpacked)) {
    const path = name.replaceAll('\\', '/')
    if (!wanted.has(path)) continue
    const file = join(out, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
    found.add(path)
  }
  const missing = DRAWIO_FILES.filter((path) => !found.has(path))
  if (missing.length > 0) throw new Error(`draw.io archive has no ${missing.join(', ')}`)

  const pre = join(out, 'js/PreConfig.js')
  const rewritten = drawingPreConfig(readFileSync(pre, 'utf8'))
  const refused = preConfigRefusal(rewritten)
  if (refused) throw new Error(refused)
  writeFileSync(pre, rewritten)
  writeFileSync(join(out, DRAWIO_STAMP), stampFor(pin))
}

/** Make the pruned tree the pin's, fetching only what the cache does not hold. */
export async function fetchDrawio(root = process.cwd(), pin: Pin = drawioPin, log: (line: string) => void = console.log): Promise<void> {
  if (treeRefusal(root, pin) === undefined) {
    log(`draw.io ${pin.version}: ${DRAWIO_DIR} is up to date`)
    return
  }
  pruneInto(join(root, DRAWIO_DIR), await archive(root, pin, log), pin)
  log(`draw.io ${pin.version}: ${DRAWIO_DIR} written`)
}

if (process.argv[1]?.endsWith('fetchDrawio.ts')) {
  if (process.argv.includes('--check')) {
    const refused = treeRefusal(process.cwd())
    if (refused) {
      console.error(`draw.io: ${refused}`)
      process.exit(1)
    }
    console.log(`draw.io ${drawioPin.version}: ${DRAWIO_DIR} matches the pin`)
  } else {
    await fetchDrawio()
  }
}
