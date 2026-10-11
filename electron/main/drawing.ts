// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The drawing editor's scheme, and the files it serves.
 *
 * The editor is not part of the app's page. It is a frame on an origin of its
 * own, served from the files shipped beside the app, and its policy is its
 * own: it reaches its own files and nothing else — no network — it frames
 * nothing, and only the app may frame it. The app's window allows this scheme
 * and no other frame.
 *
 * No Electron in here. The path check, the policy and the answer are
 * arithmetic a test can run; main wires them to the protocol.
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { DESKTOP_DRAWING_ORIGIN } from '../../src/platform/drawingOrigin.ts'

/** The placeholder `PreConfig.js` carries for the two origins, rewritten as the file is served. */
export const DRAWING_ORIGIN_TOKEN = '__DRAWING_ORIGIN__'

/**
 * Where the pruned files are.
 *
 * A packaged app has them in `extraResources`, under `process.resourcesPath`.
 * An unpackaged run has the directory the fetch script wrote, beside this
 * bundle.
 */
export function drawingDirectory(options: {
  packaged: boolean
  resourcesPath: string
  moduleDir: string
}): string {
  return options.packaged
    ? join(options.resourcesPath, 'drawio')
    : join(options.moduleDir, '..', '..', 'build', 'drawio')
}

/**
 * Whether `filePath` is a file inside `root`.
 *
 * The same check the app scheme uses. `relative` collapses a traversal, and
 * the result has to still sit under the directory — with a trailing separator
 * in the comparison `relative` already made, so a sibling `drawio-evil/` does
 * not pass a naive `startsWith`.
 */
export function withinRoot(root: string, filePath: string): boolean {
  const inside = relative(root, filePath)
  return Boolean(inside) && !inside.startsWith('..') && !isAbsolute(inside)
}

/** The file a URL asks for, or a refusal when the path leaves the directory. */
export function locateWithin(root: string, pathname: string): { filePath: string } | { forbidden: true } {
  const requested = decodeURIComponent(pathname)
  const filePath = resolve(root, `.${requested === '/' ? '/index.html' : requested}`)
  if (!withinRoot(root, filePath)) return { forbidden: true }
  return { filePath }
}

/**
 * A frame may navigate here.
 *
 * The drawing scheme only. The main frame is the app's own page, and
 * `will-navigate` already keeps that one; this is the question for every
 * other frame.
 */
export function allowsDrawingNavigation(url: string): boolean {
  return url.startsWith('drawing://')
}

/**
 * What a frame inside the editor may hold besides the editor's own files: an
 * empty document, one written from the page, a picture it made. The editor
 * builds such frames for itself — a print preview, a measurement — and none
 * of them is an address on the network.
 */
const INSIDE_THE_EDITOR = /^(about:blank|about:srcdoc|blob:drawing:\/\/local\/|data:)/

/**
 * Cancel this frame navigation.
 *
 * The main frame is not this listener's. The frame the app holds stays on the
 * drawing scheme. A frame the editor holds — its parent is on the drawing
 * scheme — may also hold a blank, written or made document, which never
 * leaves the machine; anything else is cancelled there too.
 */
export function frameNavigationCancelled(url: string, isMainFrame: boolean, parentUrl?: string): boolean {
  if (isMainFrame) return false
  if (allowsDrawingNavigation(url)) return false
  const insideEditor = parentUrl !== undefined && allowsDrawingNavigation(parentUrl)
  return !(insideEditor && INSIDE_THE_EDITOR.test(url))
}

/**
 * The policy the drawing files are served with.
 *
 * `connect-src 'self'`: the editor reads its own languages (`resources/dia*.txt`)
 * with a request to its own origin, and with `'none'` it never finishes
 * loading — the smoke run proves that against the real files. The origin
 * serves the pruned files and nothing else, so `'self'` reaches no network.
 * There is no `frame-src`, and `frame-ancestors` names the app: nothing but
 * the app's window may frame the editor. Scripts and styles are the files
 * themselves; `'unsafe-eval'` is the editor compiling a shape, and
 * `'wasm-unsafe-eval'` is the layout it ships, the same allowance the app's
 * router needs.
 */
export function drawingContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'frame-ancestors app://local',
  ].join('; ')
}

/**
 * Why the editor cannot be served from `root`, or nothing.
 *
 * An unpackaged run serves the tree `build/fetchDrawio.ts` writes, and a
 * checkout that never ran it has none: Edit then opens a frame that answers
 * not found, with nothing anywhere saying why. Main says it once, at start.
 */
export function drawingFilesMissing(root: string): string | undefined {
  if (existsSync(join(root, 'index.html'))) return undefined
  return `the drawing editor's files are not at ${root}; run node build/fetchDrawio.ts`
}

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.txt': 'text/plain',
}

/**
 * Replace the origin placeholder with the desktop's origin.
 *
 * The file on disk keeps the token, so a host that serves the same files can
 * write its own origin. Served from here, both URLs are `drawing://local`,
 * and `EXPORT_URL` is left as the file has it — null, not a convert service.
 */
export function withDrawingOrigin(source: string, origin = DESKTOP_DRAWING_ORIGIN): string {
  return source.replaceAll(DRAWING_ORIGIN_TOKEN, origin)
}

/** One request on the drawing scheme. */
export async function drawingFileResponse(root: string, requestUrl: string): Promise<Response> {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return new Response('not found', { status: 404 })
  }
  if (url.protocol !== 'drawing:' || url.host !== 'local') return new Response('not found', { status: 404 })

  let located: ReturnType<typeof locateWithin>
  try {
    located = locateWithin(root, url.pathname)
  } catch {
    return new Response('forbidden', { status: 403 })
  }
  if ('forbidden' in located) return new Response('forbidden', { status: 403 })

  let bytes: Buffer
  try {
    bytes = await readFile(located.filePath)
  } catch {
    return new Response('not found', { status: 404 })
  }

  const name = located.filePath.split(/[/\\]/).pop() ?? ''
  // A `Buffer` is not a body the DOM types accept. A copy is.
  const body = name === 'PreConfig.js' ? withDrawingOrigin(bytes.toString('utf8')) : new Uint8Array(bytes)
  const headers = new Headers()
  headers.set('Content-Type', MIME[extname(located.filePath).toLowerCase()] ?? 'application/octet-stream')
  headers.set('Content-Security-Policy', drawingContentSecurityPolicy())
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(body, { status: 200, headers })
}
