/**
 * The desktop app's main process.
 *
 * Phase 6A of the roadmap: the scaffold, and the one question worth answering
 * before any of it is worth building — does this renderer run at all outside a
 * browser tab? The editor routes edges in WebAssembly on a module worker and
 * exports PNG through the DOM; if any of that will not load under a custom
 * protocol, the desktop plan changes shape. Hence `--smoke` at the bottom of
 * this file: it drives the real production bundle in a real window and reports.
 *
 * What this process does NOT do yet: files. No IPC channel, no dialogs, no
 * watcher (6B/6C). The renderer is the web shell unchanged, still keeping its
 * projects in localStorage — which is exactly why `app://` has to be a
 * *standard* scheme; see below.
 */
import { app, BrowserWindow, protocol, net, shell } from 'electron'
import { access } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startUpdates } from './updates'

/**
 * Registering the scheme has to happen before `ready`, and this statement being
 * reached in time is exactly why this file is bundled as CommonJS.
 *
 * Electron loads an ESM main asynchronously and does not hold `ready` for it, so
 * as an ES module these lines run *after* the event they must precede. Nothing
 * reports that: the scheme registers without its privileges, the document gets a
 * null origin, every `'self'` in the CSP matches nothing, localStorage throws
 * SecurityError, and the window sits on its loading state looking like a slow
 * network. See the note in `electron.vite.config.ts`.
 *
 * `standard: true` is then not decoration either. A non-standard scheme has
 * localStorage and IndexedDB *disabled* and throws on the FileSystem API, and
 * this shell keeps projects and preferences in localStorage. It also buys a real
 * origin, which `file://` (null origin) does not: module workers and a
 * meaningful CSP both need one.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true },
  },
])

/** One host, so `app://local/x` has a stable origin to resolve URLs against. */
const APP_ORIGIN = 'app://local'

/** Where `electron-vite` puts the built renderer, relative to this bundle. */
const RENDERER_ROOT = resolve(__dirname, '../renderer')

/**
 * The renderer's own budget.
 *
 * `'wasm-unsafe-eval'` is the libavoid router: compiling WebAssembly is barred by
 * a plain `script-src 'self'`, and without it the editor silently draws straight
 * lines. `'unsafe-inline'` for styles is Emotion, which injects the MUI theme as
 * style tags — MUI cannot run without it. `blob:` covers the module worker and
 * the PNG export; `connect-src` needs `data:`/`blob:` for the same two.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
}

/**
 * Serve the built renderer over `app://`.
 *
 * The path check is the whole security of this handler: a URL is attacker-
 * reachable the moment the app opens someone else's document, and
 * `app://local/../../etc/passwd` must not read a file. `normalize` collapses the
 * traversal, and the result has to still sit under the renderer directory —
 * checked with a trailing separator, so a sibling `renderer-evil/` does not pass
 * a naive `startsWith`.
 */
function serveRenderer(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'local') return new Response('not found', { status: 404 })

    const requested = decodeURIComponent(url.pathname)
    const filePath = resolve(RENDERER_ROOT, `.${requested === '/' ? '/index.html' : requested}`)
    const inside = relative(RENDERER_ROOT, filePath)
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) {
      return new Response('forbidden', { status: 403 })
    }
    try {
      await access(filePath)
    } catch {
      return new Response('not found', { status: 404 })
    }

    if (process.argv.includes('--smoke')) process.stderr.write(`app:// ${requested} -> ${filePath}\n`)
    const response = await net.fetch(pathToFileURL(filePath).toString())
    const headers = new Headers(response.headers)
    headers.set('Content-Type', MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
    headers.set('Content-Security-Policy', CSP)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(response.body, { status: 200, headers })
  })
}

/**
 * A window that can draw the editor and nothing else.
 *
 * `sandbox: true` with `contextIsolation: true` and `nodeIntegration: false` is
 * the default posture for a renderer that will, in 6C, be handed file contents
 * from other people. Everything the renderer may do to the filesystem will go
 * through a validated IPC call in main; it never gets `require`.
 */
function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0e0b16',
    // macOS only: the app draws to the top of the window instead of sitting
    // under a strip of grey. The renderer then owes the window the two things
    // the title bar was doing — room for the traffic lights, and something to
    // drag the window by. Both come from `src/core/windowChrome.ts`, which
    // reads the platform off the preload bridge.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  // Nothing in this app opens a second window or navigates away from itself. A
  // link in a document is the browser's job, not ours.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(RENDERER_URL)) event.preventDefault()
  })

  return window
}

/**
 * Dev serves over http so Vite can hot-reload; the packaged app serves over
 * `app://`. That split means the protocol handler is only exercised in a
 * production build — which is what `npm run smoke:desktop` runs, and why the
 * smoke build is the go/no-go rather than the dev server.
 */
const RENDERER_URL = process.env['ELECTRON_RENDERER_URL'] ?? `${APP_ORIGIN}/`

void app.whenReady().then(() => {
  if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer()

  // Before the window, because it must not wait on one: the check is
  // background work that never touches the UI, and a slow release page must
  // not delay the first paint. It returns immediately unless this is a real
  // installed app — see updates.ts.
  startUpdates()

  const mainWindow = createWindow()

  // A load that neither finishes nor fails is the hardest thing to read from
  // outside the process: no window, no error, no exit. Say what went wrong.
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    process.stderr.write(`did-fail-load ${code} ${description} ${url}\n`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`render-process-gone ${details.reason}\n`)
  })

  // Under --smoke, say what the renderer said. A blank window with a passing
  // process is the failure mode this whole phase exists to catch, and it is
  // indistinguishable from success without this.
  if (process.argv.includes('--smoke')) {
    mainWindow.webContents.on('console-message', (event) => {
      process.stderr.write(`renderer[${event.level}] ${event.message}\n`)
    })
    mainWindow.webContents.session.webRequest.onErrorOccurred(({ url, error }) => {
      process.stderr.write(`request failed ${error} ${url}\n`)
    })
  }
  mainWindow.webContents.on('console-message', (event) => {
    process.stderr.write(`renderer[${event.level}] ${event.message}\n`)
  })

  void mainWindow.loadURL(RENDERER_URL).then(async () => {
    if (!process.argv.includes('--smoke')) return
    const { runSmoke } = await import('./smoke')
    await runSmoke(mainWindow)
  })
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow().loadURL(RENDERER_URL)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
