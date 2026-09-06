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
 * Files arrived with ADR-0003: `files.ts` is the channel, and it is the only
 * way the renderer reaches a disk. What is still missing is the watcher, the
 * File menu and the file associations.
 *
 * `app://` remains a *standard* scheme regardless, and not only for the
 * localStorage the browser fallback still uses; see below.
 */
import { app, BrowserWindow, dialog, ipcMain, protocol, net, shell } from 'electron'
import { access } from 'node:fs/promises'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { basename } from 'node:path'
import { readFile } from 'node:fs/promises'
import { installAppMenu, sendCommand } from './appMenu'
import { recentDirectories, registerFileChannel, stopWatching } from './files'
import { log, logFilePath } from './log'
import { checkForUpdatesNow, startUpdates } from './updates'

/**
 * A throw nobody caught. Logged rather than left to Electron's default, which
 * on a packaged app is a silent exit — the failure mode this whole phase is
 * about.
 */
process.on('uncaughtException', (error) => {
  log('main', `uncaughtException ${error.stack ?? error.message}`)
})
process.on('unhandledRejection', (reason) => {
  log('main', `unhandledRejection ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`)
})

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

    if (UNATTENDED) process.stderr.write(`app:// ${requested} -> ${filePath}\n`)
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
    // drag the window by. Both come from `src/platform/windowChrome.ts`, which
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

/**
 * What the renderer's own diagnostics lines start with
 * (`adapters/browser/ConsoleDiagnostics.ts`). Spelled out rather than imported:
 * this bundle compiles against Node and the DOM adapter it lives in does not.
 */
const RENDERER_LOG_PREFIX = '[lvarch]'

/**
 * The smoke run has nobody in front of it. A modal dialog there is not a
 * message, it is a hang — the run waits for a click that never comes and the
 * gate reports a timeout instead of the failure it actually found.
 */
const UNATTENDED = process.argv.includes('--smoke')

/**
 * The smoke run keeps its own `userData`, and therefore its own preferences.
 *
 * `userData` is where Chromium puts localStorage, which is where the renderer
 * writes the preferences — the remembered working directory among them. A smoke
 * run grants itself a temporary folder and opens it with the SAME command the
 * Recent menu sends, so sharing this directory with the installed app means a
 * gate run silently repoints somebody's real app at a folder that is deleted an
 * hour later, and they are asked to choose one again on their next launch.
 *
 * Emptied rather than reused, because a gate that inherits the last run's state
 * is a gate that reports something different on the second run: the migration
 * step counts what it copied, and a run after a run has nothing left to copy.
 *
 * Before `whenReady`, which is the only moment a path can be set.
 */
if (UNATTENDED) {
  const own = join(tmpdir(), 'lvarch-smoke-userdata')
  rmSync(own, { recursive: true, force: true })
  app.setPath('userData', own)
}

/**
 * Documents the OS handed us, until something in the window is listening.
 *
 * Double-clicking a `.lvarch` in Finder starts the app and fires `open-file`
 * before there is a window, never mind a React tree with a subscription in it.
 * Sending the command then is sending it into the dark, so it waits here for
 * the renderer to say it is listening (`app:listening`, from the preload).
 */
const waiting: string[] = []
let listening = false

/**
 * Does the window have work in it that closing would lose?
 *
 * Told by the renderer whenever it changes, because only the renderer knows —
 * and asking at close time would be a round trip inside an event that has to
 * decide synchronously whether to let the window go.
 */
let unsaved = false

/** A `.lvarch` among the arguments — how Windows and Linux say "open this". */
function documentIn(argv: readonly string[]): string | undefined {
  return argv.slice(1).find((held) => held.toLowerCase().endsWith('.lvarch'))
}

/**
 * Open a document the OS gave us.
 *
 * Main reads it, rather than handing the renderer a path to ask for: the file
 * is outside every folder the user granted, and the double click IS the grant —
 * for that one file, once. Nothing about it is added to the granted set.
 *
 * The path never reaches the log. A log file is something the user is invited
 * to hand over, and a path names a person's disk, their customer and often
 * their project.
 */
function openDocument(path: string): void {
  if (!listening) { waiting.push(path); return }
  void readFile(path).then(
    (bytes) => {
      app.addRecentDocument(path)
      sendCommand({ type: 'openDocument', name: basename(path), bytes: new Uint8Array(bytes) })
    },
    (cause: unknown) => log('files', `a document from the OS could not be read: ${String(cause)}`),
  )
}

// macOS: fired before `ready` on a cold start, so it is registered out here
// rather than inside `whenReady`. `preventDefault` stops Electron's own
// handling, which is to do nothing and log a warning.
app.on('open-file', (event, path) => {
  event.preventDefault()
  openDocument(path)
})

/**
 * One instance, so a second double click reaches the window that is already
 * open rather than starting a rival with its own watcher on the same folder.
 *
 * Not under `--smoke`: the gate may run while a real copy is open on the same
 * machine, and a smoke run that quietly quits into somebody's editor session
 * would report a pass it never made.
 */
if (!UNATTENDED && !app.requestSingleInstanceLock()) app.exit(0)

app.on('second-instance', (_event, argv) => {
  const window = BrowserWindow.getAllWindows()[0]
  if (window) {
    if (window.isMinimized()) window.restore()
    window.focus()
  }
  const path = documentIn(argv)
  if (path) openDocument(path)
})

void app.whenReady().then(() => {
  // The first line of every run, and the thing the smoke step looks for: a log
  // that exists but says nothing proves only that a file was created.
  log('main', `started ${app.getVersion()} on ${process.platform} ${process.arch}`)
  if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer()

  // Before the window, because it must not wait on one: the check is background
  // work and a slow release page must not delay the first paint. Its dialog
  // finds a window when it has one to sit on and does without when it does not.
  // It returns immediately unless this is a real installed app — see updates.ts.
  //
  // The menu item is unconditional: checking by hand has to work even in a build
  // that never checks by itself, which is the point of an off switch.
  startUpdates()

  const menu = () => installAppMenu({
    recents: recentDirectories(),
    onCheckForUpdates: checkForUpdatesNow,
  })
  menu()

  // Before the window: the renderer may ask for a folder as soon as it has
  // painted, and a handler registered after that would answer "no such
  // channel" to the first request of the session. The menu is rebuilt whenever
  // the list of folders changes, because a submenu already on screen does not
  // redraw itself.
  registerFileChannel({ onRecentsChanged: menu })

  // Said by the preload the moment anything subscribes. Everything the OS
  // handed us before that has been waiting.
  ipcMain.handle('app:unsaved', (_event, held: unknown) => { unsaved = held === true })

  ipcMain.handle('app:listening', () => {
    listening = true
    for (const path of waiting.splice(0)) openDocument(path)
  })

  // Windows and Linux pass the document as an argument instead of an event.
  const opened = documentIn(process.argv)
  if (opened) openDocument(opened)

  const mainWindow = createWindow()
  guardUnsavedWork(mainWindow)

  // A load that neither finishes nor fails is the hardest thing to read from
  // outside the process: no window, no error, no exit. Say what went wrong.
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    log('renderer', `did-fail-load ${code} ${description} ${url}`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('renderer', `render-process-gone ${details.reason}`)
    // A dead renderer is a window that will never paint again. Without this it
    // stays on screen showing the last frame it managed, and the only way to
    // tell it apart from a very slow app is to wait indefinitely.
    if (UNATTENDED || mainWindow.isDestroyed()) return
    void dialog.showMessageBox(mainWindow, {
      type: 'error',
      message: 'The window stopped responding.',
      detail: `Reason: ${details.reason}.\nDiagnostics: ${logFilePath()}`,
      buttons: ['Reload', 'Close'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0 && !mainWindow.isDestroyed()) mainWindow.webContents.reload()
    })
  })

  // The renderer's console, relayed. This is the desktop half of the
  // diagnostics port: the shell reports through `ConsoleDiagnostics`, which
  // writes a `[lvarch]` line, and that line lands in the log file without an
  // IPC channel having to exist for it.
  //
  // Filtered, for two reasons. `info` and `debug` from libraries we do not own
  // is noise that would push the crash off the end of the file; and it is the
  // one place model content could reach the log, since a third-party
  // `console.log` may carry anything it likes. Our own lines and anything at
  // warning or above get through — see the note at the top of `log.ts`.
  mainWindow.webContents.on('console-message', (event) => {
    const ours = event.message.startsWith(RENDERER_LOG_PREFIX)
    if (!ours && event.level !== 'warning' && event.level !== 'error') return
    log(`renderer[${event.level}]`, event.message)
  })

  // Under --smoke, say everything the renderer said, filter or no filter. A
  // blank window with a passing process is the failure mode this whole phase
  // exists to catch, and it is indistinguishable from success without this.
  if (UNATTENDED) {
    mainWindow.webContents.on('console-message', (event) => {
      if (event.message.startsWith(RENDERER_LOG_PREFIX)) return // already logged above
      if (event.level === 'warning' || event.level === 'error') return
      process.stderr.write(`renderer[${event.level}] ${event.message}\n`)
    })
    mainWindow.webContents.session.webRequest.onErrorOccurred(({ url, error }) => {
      log('renderer', `request failed ${error} ${url}`)
    })
  }

  void mainWindow.loadURL(RENDERER_URL).then(async () => {
    if (!UNATTENDED) return
    const { runSmoke } = await import('./smoke')
    await runSmoke(mainWindow)
  }).catch((error: unknown) => fatal('loading the app', error))
})
  .catch((error: unknown) => fatal('starting up', error))

/**
 * Closing the window must not lose the last few seconds of work.
 *
 * The browser has `beforeunload` for this and shows its own dialog; Electron
 * fires the same event and does NOT — returning a value there cancels the close
 * silently, which is worse than either alternative. So the conversation happens
 * here.
 *
 * It saves rather than asking. Everything in this app is written three seconds
 * after you stop typing; a window that interrupts you to ask whether you meant
 * it is a window that trains you to dismiss the question. What it does ask
 * about is the case where saving did not work — a folder that has gone, a
 * permission withdrawn — because closing then really does lose something.
 */
function guardUnsavedWork(window: BrowserWindow): void {
  let letting = false
  window.on('close', (event) => {
    if (letting || !unsaved || UNATTENDED) return
    event.preventDefault()
    sendCommand({ type: 'save' })

    const deadline = Date.now() + 5_000
    const poll = setInterval(() => {
      if (!unsaved) {
        clearInterval(poll)
        letting = true
        window.close()
        return
      }
      if (Date.now() <= deadline) return
      clearInterval(poll)
      const choice = dialog.showMessageBoxSync(window, {
        type: 'warning',
        message: 'This project could not be saved.',
        detail: 'Closing now loses the changes that are still only in this window.',
        buttons: ['Close anyway', 'Keep the window open'],
        defaultId: 1,
        cancelId: 1,
      })
      if (choice !== 0) return
      letting = true
      window.close()
    }, 100)
  })
}

/**
 * The end of the line: something went wrong before there was an app to say it
 * in.
 *
 * A native box rather than a toast, because the renderer is exactly what is not
 * available at this point — and it names the log file, because "it did not
 * start" is not a bug report and the path is the difference.
 */
function fatal(during: string, error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  log('main', `failed while ${during}: ${detail}`)
  if (UNATTENDED) { app.exit(1); return }
  dialog.showErrorBox(
    'The Architecture Management Tool could not start.',
    `It failed while ${during}.\n\n${detail}\n\nDiagnostics: ${logFilePath()}`,
  )
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length !== 0) return
  createWindow().loadURL(RENDERER_URL).catch((error: unknown) => fatal('reopening the window', error))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// A watcher holds a handle on a folder and a callback into a window that is on
// its way out. Neither is a leak worth arguing about in a process that is
// exiting, but a folder held open across a quit is visible on Windows.
app.on('before-quit', () => stopWatching())
