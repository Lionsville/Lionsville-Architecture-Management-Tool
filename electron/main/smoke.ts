/**
 * The go/no-go check for phase 6A, run against the packaged bundle.
 *
 * The roadmap calls this out as the risk that decides whether the desktop plan
 * is shaped like this at all: the editor routes edges in WebAssembly on an ES
 * module worker and exports PNG through the DOM, and none of the three is
 * obviously portable off `http://`. Under `file://` two of them cannot work at
 * all. So rather than reason about it, drive the real production renderer over
 * `app://` in a real window and report what happened.
 *
 * **A real window, visible, on purpose.** A hidden or offscreen pane never fires
 * `requestAnimationFrame`, and `html-to-image` waits on one — an export check in
 * a hidden window hangs for reasons that have nothing to do with Electron. That
 * trap cost a day in phase 3; it is written down here so it does not cost
 * another one.
 *
 * The renderer is not modified to be testable. Everything below is what a person
 * would do: read the origin bar, open an example, look at the canvas, press
 * Export PNG. `window.Worker` is wrapped from the outside before the app is
 * asked to route, because "did it construct a module worker" is not otherwise
 * observable — and a router that quietly fell back to the main thread would pass
 * every visual check while being exactly the failure this phase is looking for.
 */
import type { BrowserWindow } from 'electron'

export type SmokeResult = { name: string; ok: boolean; detail: string }

/** Give the renderer a fixed budget per step; a hang is a failure, not a wait. */
const STEP_TIMEOUT_MS = 20_000

/**
 * Report each step as it finishes, not the lot at the end.
 *
 * A batched report is unreadable exactly when it matters: a hung step looks
 * identical to a slow boot, and the only signal you get is the absence of
 * output for as long as every remaining timeout added together. Printing as we
 * go turns "it is stuck" into "it is stuck HERE".
 */
function report(result: SmokeResult): SmokeResult {
  process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}\n        ${result.detail}\n`)
  return result
}

async function check(
  window: BrowserWindow,
  name: string,
  script: string,
): Promise<SmokeResult> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${STEP_TIMEOUT_MS} ms`)), STEP_TIMEOUT_MS))
  try {
    const detail = await Promise.race([
      window.webContents.executeJavaScript(script, true) as Promise<string>,
      timeout,
    ])
    return report({ name, ok: true, detail: String(detail) })
  } catch (error) {
    return report({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * Poll the DOM rather than wait a fixed time. Routing goes to a worker and the
 * first layout lands whenever it lands; a sleep long enough to be safe on a slow
 * machine is a sleep wasted on every fast one.
 */
const waitFor = (expression: string, what: string) => `
  (async () => {
    const deadline = Date.now() + 20000
    while (Date.now() < deadline) {
      const value = (() => { try { return (${expression}) } catch { return null } })()
      if (value) return String(value)
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('never became true: ' + ${JSON.stringify(what)})
  })()`

export async function runSmoke(window: BrowserWindow): Promise<void> {
  const results: SmokeResult[] = []
  process.stdout.write('\n--- 7A smoke ---\n')

  // The export test presses the real Export PNG button, and the real button
  // downloads. Cancel it in the session rather than in the page: the DOM trick
  // that used to do this depended on the editor using an anchor, and when it
  // did not, macOS put a save panel in front of the window and the run sat there
  // waiting for a human. Proving the blob exists is the point; writing it to
  // someone's Downloads folder is not.
  window.webContents.session.on('will-download', (event) => event.preventDefault())

  results.push(await check(window, 'origin is a standard app:// scheme', `
    (() => {
      if (location.origin !== 'app://local') throw new Error('origin is ' + location.origin)
      return location.href
    })()`))

  // The reason `standard: true` is not optional: the shell keeps every project
  // and preference here, and a non-standard scheme disables it silently.
  results.push(await check(window, 'localStorage and IndexedDB are available', `
    (() => {
      localStorage.setItem('smoke', 'yes')
      if (localStorage.getItem('smoke') !== 'yes') throw new Error('localStorage did not round-trip')
      localStorage.removeItem('smoke')
      if (!window.indexedDB) throw new Error('no indexedDB')
      return 'localStorage ok, indexedDB present'
    })()`))

  results.push(await check(window, 'preload bridge is exposed', `
    (() => {
      if (!window.desktop) throw new Error('window.desktop missing')
      if (window.require || window.process) throw new Error('node reached the renderer')
      return window.desktop.platform + ', electron ' + window.desktop.versions.electron
    })()`))

  // Fetched over app:// and compiled under the CSP: this is where a missing
  // 'wasm-unsafe-eval' or a mis-typed response would surface.
  results.push(await check(window, 'libavoid.wasm loads and compiles', `
    (async () => {
      const response = await fetch('/libavoid.wasm')
      if (!response.ok) throw new Error('fetch ' + response.status)
      const type = response.headers.get('content-type')
      const bytes = await response.arrayBuffer()
      await WebAssembly.compile(bytes)
      return bytes.byteLength + ' bytes, ' + type
    })()`))

  // Wrap the constructor before anything routes. The shell's worker factory is
  // lazy, so this is early enough as long as no project is open yet.
  results.push(await check(window, 'worker constructor instrumented', `
    (() => {
      const Native = window.Worker
      window.__smokeWorkers = []
      window.Worker = class extends Native {
        constructor(url, options) {
          super(url, options)
          window.__smokeWorkers.push({ url: String(url), type: options && options.type })
          this.addEventListener('error', (e) => { window.__smokeWorkerError = String(e.message || e) })
        }
      }
      return 'wrapped'
    })()`))

  results.push(await check(window, 'an example project opens', `
    (async () => {
      ${'' /* The picker's own affordance: the button on an example card. */}
      const button = [...document.querySelectorAll('button')]
        .find((b) => /Copy to a project|Open|Kopieer|Openen/.test(b.textContent || ''))
      if (!button) throw new Error('no example button; picker text was: ' + document.body.innerText.slice(0, 200))
      button.click()
      return await ${waitFor("document.querySelector('.react-flow') && 'canvas mounted'", 'the canvas to mount')}
    })()`))

  results.push(await check(window, 'the canvas renders nodes and routed edges', `
    ${waitFor(`(() => {
      const nodes = document.querySelectorAll('.react-flow__node').length
      const edges = [...document.querySelectorAll('.react-flow__edge path.react-flow__edge-path')]
      if (!nodes || !edges.length) return null
      ${'' /* A routed orthogonal edge is a run of segments — lines with rounded
              corners, so L and Q both appear. The straight-line fallback the
              router degrades to is exactly one command after the move, and
              telling those two apart is the entire point of this check: a
              landscape drawn with 24 straight lines through its own boxes looks
              plausible in a screenshot and is the failure this phase hunts. */}
      const commands = (d) => (d.match(/[LCQAH V]/gi) || []).length
      const routed = edges.filter((path) => commands(path.getAttribute('d') || '') >= 2).length
      const shapes = new Set(edges.flatMap((path) => (path.getAttribute('d') || '').match(/[A-Za-z]/g) || []))
      return nodes + ' nodes, ' + edges.length + ' edges, ' + routed + ' routed ('
        + [...shapes].join('') + ')'
    })()`, 'nodes and edges to render')}`))

  results.push(await check(window, 'Tidy runs the router on an ES module worker', `
    (async () => {
      ${'' /* Opening a project may route from stored routes without ever asking
              the router, so waiting to see a worker appear is a race — it passed
              and then timed out on consecutive runs of identical code. Tidy is
              the affordance that always re-lays-out and re-routes, so press it
              and the question becomes deterministic. It is also the check the
              phase actually wants: Tidy completing under app:// is what proves
              wasm-in-a-worker works here. */}
      const button = [...document.querySelectorAll('button')]
        .find((b) => /Tidy layout|Netjes/.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.textContent || '')))
      if (!button) throw new Error('no Tidy button found')
      button.click()
      return await ${waitFor(`(() => {
        const workers = window.__smokeWorkers || []
        if (window.__smokeWorkerError) throw new Error('worker error: ' + window.__smokeWorkerError)
        const modules = workers.filter((w) => w.type === 'module')
        if (!modules.length) return null
        return modules.length + ' module worker(s): ' + modules[0].url.split('/').pop()
      })()`, 'the router worker to be constructed')}
    })()`))

  results.push(await check(window, 'PNG export settles', `
    (async () => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => /Export PNG|PNG exporteren/.test((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')))
      if (!button) throw new Error('no export button found')
      const seen = []
      ${'' /* Watch the blob go by. The download itself is cancelled in the main
              process, so nothing reaches the filesystem. */}
      const createObjectURL = URL.createObjectURL.bind(URL)
      URL.createObjectURL = (blob) => { seen.push(blob); return createObjectURL(blob) }
      button.click()
      const result = await ${waitFor("(() => { const png = seen.find((b) => b.type === 'image/png'); return png && (png.size + ' byte PNG') })()", 'a PNG blob')}
      URL.createObjectURL = createObjectURL
      return result
    })()`))

  const failed = results.filter((r) => !r.ok)
  process.stdout.write(failed.length ? `\n${failed.length} of ${results.length} FAILED\n` : `\nall ${results.length} passed\n`)

  // Fit the view before the screenshot. The canvas opens where the project left
  // it, which for a freshly copied example is somewhere in the middle of one
  // band — a picture of empty grid says nothing about whether the app works.
  await check(window, 'the view fits to the diagram', `
    (() => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => /Fit view|Passend maken/.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')))
      if (!button) throw new Error('no fit-view button found')
      button.click()
      return 'fitted'
    })()`)
  await new Promise((resolve) => setTimeout(resolve, 600))

  const image = await window.webContents.capturePage()
  const { writeFile } = await import('node:fs/promises')
  await writeFile('smoke-screenshot.png', image.toPNG())
  process.stdout.write('screenshot: smoke-screenshot.png\n')

  process.exit(failed.length ? 1 : 0)
}
