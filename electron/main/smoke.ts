/**
 * The desktop smoke run: the packaged renderer, in a real window, over `app://`,
 * driven the way a person and an agent drive it, against real folders.
 *
 * It began as the go/no-go for one question — do WebAssembly routing on a
 * module worker and a DOM export survive being served off `app://` — and it
 * still asks that first, because a router that quietly fell back to the main
 * thread would pass every visual check while being exactly the failure a
 * desktop build is for. It then walks the product's core features in the
 * order a person meets them: a folder to work in, an example copied into it,
 * the canvas, the export, an agent connecting and reading the organisation
 * across its scopes, a change made, saved and found on disk as the format
 * writes it, a decision and a plan landing as files, and then **a second
 * folder** — because the three bugs that hid longest all sat on the path where
 * a folder is opened *after* the boot, and no unit test can mount the
 * composition root twice.
 *
 * **A real window, visible, on purpose.** A hidden or offscreen pane never fires
 * `requestAnimationFrame`, and `html-to-image` waits on one — an export check in
 * a hidden window hangs for reasons that have nothing to do with Electron. That
 * trap cost a day once; it is written down here so it does not cost another.
 *
 * **The renderer is not modified to be testable.** Everything below is what a
 * person would do — press the button, read the screen — or what an agent would
 * do through the real MCP client over the real loopback server. The one thing
 * wrapped from the outside is `window.Worker`, because "did it construct a
 * module worker" is not otherwise observable. Test ids are used where the words
 * on a button exist in four languages.
 *
 * **What a check proves is on disk or over the wire**, never a React state.
 * A saved element is looked for in `model.json`; a decision in `decisions/`;
 * a folder that must stay empty is listed with `readdir`. The index is asked
 * through `register.list`, which is what the map, the picker and the checks
 * read — an empty answer there is the exact symptom the switch tests exist to
 * catch.
 */
import type { BrowserWindow } from 'electron'
import { sendCommand } from './appMenu'
import { grantDirectory } from './files'
import { logFilePath } from './log'
import type { DesktopDirectory } from '../../src/adapters/desktop/channel'

export type SmokeResult = { name: string; ok: boolean; detail: string }

/** Give the renderer a fixed budget per step; a hang is a failure, not a wait. */
const STEP_TIMEOUT_MS = 20_000

/**
 * The shipped example, as the smoke knows it: three scopes, and how many
 * applications the landscape defines. The numbers are asserted, not just
 * "more than nothing" — the register answering 18 where 20 were written would
 * be a fold with a hole in it, and the run is where that gets noticed.
 */
const EXAMPLE = {
  organisation: 'Acme Logistics',
  // On the desktop a fresh folder's root is already named — after the folder
  // (`upgradeFormat` in main.tsx) — so the example is filed under a scope of
  // its own rather than becoming the root.
  path: 'acme-logistics',
  landscape: 'acme-logistics/application-landscape',
  landscapeName: 'Application landscape',
  /** The root, the example's organisation, its landscape and its platforms (ADR-0013). */
  scopes: 4,
  applications: 20,
  activeDiagram: 'landscape',
}

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

function section(title: string): void {
  process.stdout.write(`\n· ${title}\n`)
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
 * A step that runs in this process rather than in the page.
 *
 * Most checks ask the renderer a question; the ones about files, the log and
 * the agent server read the disk or the socket directly, because proving a
 * write through the renderer that made it proves nothing about the path.
 */
async function checkHere(
  name: string,
  run: () => Promise<string>,
): Promise<SmokeResult> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${STEP_TIMEOUT_MS * 2} ms`)), STEP_TIMEOUT_MS * 2))
  try {
    return report({ name, ok: true, detail: await Promise.race([run(), timeout]) })
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

/** The minimal MCP client the run needs: the SDK's own, typed loosely. */
type ToolClient = {
  listTools(): Promise<{ tools: { name: string }[] }>
  callTool(call: { name: string; arguments: Record<string, unknown> }): Promise<unknown>
  close(): Promise<void>
}

type ToolAnswer = { isError?: boolean; content: { type: string; text?: string; data?: string; mimeType?: string }[] }

export async function runSmoke(window: BrowserWindow): Promise<void> {
  const results: SmokeResult[] = []
  process.stdout.write('\n--- smoke ---\n')

  const { mkdtemp, readdir, readFile, stat } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join, basename } = await import('node:path')

  const page = (script: string) => window.webContents.executeJavaScript(script, true) as Promise<string>

  /**
   * Two folders for this run, granted without a dialog.
   *
   * The desktop keeps projects in a folder the user chose (ADR-0003) and asks
   * for one when it has none — so a run that never answers that question never
   * reaches the canvas. Granting one here and telling the renderer about it
   * over the same command the Recent menu uses is the closest thing to a
   * person choosing it. The second folder is what the switch section is
   * about; it is granted now so a grant failure is one clear line at the top.
   */
  const grant = async (label: string): Promise<DesktopDirectory> => {
    const granted = await grantDirectory(await mkdtemp(join(tmpdir(), `lvarch-smoke-${label}-`)), { remember: false })
    if (!granted) throw new Error(`no ${label} folder could be granted`)
    return granted
  }
  const first = await grant('a')
  const second = await grant('b')

  /** Tell the renderer to work in a folder, and wait for that folder's home. */
  const openFolder = async (directory: DesktopDirectory): Promise<string> => {
    sendCommand({ type: 'openFolder', root: directory.root })
    return page(waitFor(`(() => {
      const chip = document.querySelector('[data-testid="working-source"]')
      const cards = document.querySelector('[data-testid="organisation-cards"]')
      return chip && cards && (chip.textContent || '').includes(${JSON.stringify(directory.name)}) && 'its home is up'
    })()`, `the home of ${directory.name}`))
  }

  /**
   * Copy the example into whatever root is on screen, and wait for its
   * landscape's canvas. By its test id rather than by its words: the cards say
   * "Open" too, and the words exist in four languages.
   */
  const copyExample = () => page(`
    (async () => {
      const button = document.querySelector('[data-testid="copy-example"]')
      if (!button) throw new Error('no example button; screen text was: ' + document.body.innerText.slice(0, 200))
      button.click()
      return await ${waitFor("document.querySelector('.react-flow') && 'canvas mounted'", 'the canvas to mount')}
    })()`)

  const onDisk = (directory: DesktopDirectory, path: string) => readFile(join(directory.root, path), 'utf8')

  /**
   * Poll an agent read until it says what is expected. The index is read
   * after the watcher settles, off the render path by design (ADR-0004), so a
   * register asked the instant a write lands may answer from before it; the
   * deadline, not the first answer, is the check.
   */
  const until = async <T,>(what: string, read: () => Promise<T>, ok: (held: T) => boolean): Promise<T> => {
    const deadline = Date.now() + 10_000
    let last: T = await read()
    while (!ok(last)) {
      if (Date.now() > deadline) throw new Error(`${what}: still ${JSON.stringify(last).slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, 200))
      last = await read()
    }
    return last
  }
  const registerTotal = (query?: string) =>
    agent<{ total: number; some: { id: string; name: string; master?: string }[] }>('register.list', { limit: 500, ...(query ? { query } : {}) })
  const exists = (directory: DesktopDirectory, path: string) =>
    stat(join(directory.root, path)).then(() => true, () => false)

  // The export test presses the real Export PNG button, and the real button
  // downloads. Cancel it in the session rather than in the page: the DOM trick
  // that used to do this depended on the editor using an anchor, and when it
  // did not, macOS put a save panel in front of the window and the run sat there
  // waiting for a human. Proving the blob exists is the point; writing it to
  // someone's Downloads folder is not.
  window.webContents.session.on('will-download', (event) => event.preventDefault())

  // --- the platform: what app:// has to give the renderer ---------------------
  section('the platform')

  results.push(await check(window, 'origin is a standard app:// scheme', `
    (() => {
      if (location.origin !== 'app://local') throw new Error('origin is ' + location.origin)
      return location.href
    })()`))

  // The reason `standard: true` is not optional: the shell keeps its
  // preferences here, and a non-standard scheme disables it silently.
  results.push(await check(window, 'localStorage and IndexedDB are available', `
    (() => {
      localStorage.setItem('smoke', 'yes')
      if (localStorage.getItem('smoke') !== 'yes') throw new Error('localStorage did not round-trip')
      localStorage.removeItem('smoke')
      if (!window.indexedDB) throw new Error('no indexedDB')
      return 'localStorage ok, indexedDB present'
    })()`))

  results.push(await check(window, 'preload bridge is exposed and node is not', `
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

  // --- a folder to work in (ADR-0003, ADR-0012 §1) ----------------------------
  section('a folder to work in')

  results.push(await checkHere('the app takes a folder and shows its root, named after the folder', async () => {
    const seen = await openFolder(first)
    // An empty folder is an organisation named after the folder, with nothing
    // under it and the example on offer as the way to have something.
    const shown = JSON.parse(await page(`JSON.stringify({
      name: (document.querySelector('[data-testid="organisation-name"]') || {}).textContent || '',
      example: Boolean(document.querySelector('[data-testid="copy-example"]')),
      rows: document.querySelectorAll('[data-testid^="scope-"]').length,
    })`)) as { name: string; example: boolean; rows: number }
    if (shown.name !== first.name) throw new Error(`the root is called ${JSON.stringify(shown.name)}`)
    if (!shown.example) throw new Error('the example is not on offer')
    if (shown.rows) throw new Error(`${shown.rows} scopes under an empty root`)
    return `${first.root} — ${seen}, root "${shown.name}", nothing under it, example on offer`
  }))

  results.push(await checkHere('the example becomes the organisation, as the format writes it', async () => {
    const seen = await copyExample()
    // What the format writes, where it writes it (ADR-0003, format 5): the
    // organisation at the root, the landscape filed under it, a view as two
    // files, a description as markdown, a decision and a plan as numbered
    // records. Read off the disk, not asked of the app.
    const organisation = JSON.parse(await onDisk(first, `${EXAMPLE.path}/scope.json`)) as { name?: string; type?: string; version?: number }
    if (organisation.type !== 'lionsville-architecture' || organisation.version !== 5) throw new Error(`header: ${JSON.stringify(organisation)}`)
    if (organisation.name !== EXAMPLE.organisation) throw new Error(`the example's organisation is called ${organisation.name}`)
    const landscape = JSON.parse(await onDisk(first, `${EXAMPLE.landscape}/scope.json`)) as { name?: string }
    if (landscape.name !== EXAMPLE.landscapeName) throw new Error(`the landscape is called ${landscape.name}`)
    for (const path of [
      `${EXAMPLE.path}/model.json`,
      `${EXAMPLE.path}/diagrams/business-architecture.json`,
      `${EXAMPLE.landscape}/model.json`,
      `${EXAMPLE.landscape}/diagrams/landscape.json`,
      `${EXAMPLE.landscape}/diagrams/landscape.geometry.json`,
    ]) {
      if (!await exists(first, path)) throw new Error(`${path} was not written`)
    }
    const decisions = await readdir(join(first.root, EXAMPLE.landscape, 'decisions'))
    const plans = await readdir(join(first.root, EXAMPLE.landscape, 'transitions'))
    if (!decisions.some((name) => /^0001-.*\.md$/.test(name))) throw new Error(`decisions/: ${decisions.join(', ')}`)
    if (!plans.some((name) => /^0001-.*\.md$/.test(name))) throw new Error(`transitions/: ${plans.join(', ')}`)
    return `${seen}; ${EXAMPLE.path}/ + ${EXAMPLE.landscape}/, ${decisions.length} decisions, ${plans.length} plans on disk`
  }))

  // --- the canvas: routing in wasm on a worker, and a picture out ------------
  section('the canvas')

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
              plausible in a screenshot and is the failure this run hunts. */}
      const commands = (d) => (d.match(/[LCQAH V]/gi) || []).length
      const routed = edges.filter((path) => commands(path.getAttribute('d') || '') >= 2).length
      const shapes = new Set(edges.flatMap((path) => (path.getAttribute('d') || '').match(/[A-Za-z]/g) || []))
      return nodes + ' nodes, ' + edges.length + ' edges, ' + routed + ' routed ('
        + [...shapes].join('') + ')'
    })()`, 'nodes and edges to render')}`))

  results.push(await check(window, 'Tidy runs the router on an ES module worker', `
    (async () => {
      ${'' /* Opening a project may route from stored routes without ever asking
              the router, so waiting to see a worker appear is a race. Tidy is
              the affordance that always re-lays-out and re-routes, so press it
              and the question becomes deterministic: Tidy completing under
              app:// is what proves wasm-in-a-worker works here. */}
      const named = (b) => (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.textContent || '')
      const tidy = () => [...document.querySelectorAll('button')]
        .find((b) => /Tidy layout|Netjes/.test(named(b)))
      ${'' /* Waiting for the button, not just looking for it: while any tidy is
              running that button IS the cancel and says so, so "no Tidy button"
              means the settling pass had not finished. */}
      await ${waitFor("tidy() && 'idle'", 'the settling pass to finish and the Tidy button to be idle')}
      tidy().click()
      return await ${waitFor(`(() => {
        const workers = window.__smokeWorkers || []
        if (window.__smokeWorkerError) throw new Error('worker error: ' + window.__smokeWorkerError)
        const modules = workers.filter((w) => w.type === 'module')
        if (!modules.length) return null
        return modules.length + ' module worker(s): ' + modules[0].url.split('/').pop()
      })()`, 'the router worker to be constructed')}
    })()`))

  // The size is part of the check, not decoration: the export used to hand
  // `getViewportForBounds` a padding in pixels where it wants a ratio, which
  // pinned the capture at that function's 0.1 zoom floor. A tenth-scale drawing
  // in a full-size bitmap passes "a PNG arrived" and is unreadable on paper.
  results.push(await check(window, 'PNG export settles at a size worth printing', `
    (async () => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => /Export PNG|PNG exporteren/.test((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')))
      if (!button) throw new Error('no export button found')
      const seen = []
      const createObjectURL = URL.createObjectURL.bind(URL)
      URL.createObjectURL = (blob) => { seen.push(blob); return createObjectURL(blob) }
      ${'' /* Tidy, one check above, moves every node. Capturing while it settles
              photographs a layout nobody would recognise. */}
      const positions = () => [...document.querySelectorAll('.react-flow__node')]
        .map((n) => n.style.transform).join('|')
      let last = ''
      for (let settled = 0; settled < 3; settled += 1) {
        await new Promise((r) => setTimeout(r, 400))
        const now = positions()
        if (now !== last) { settled = -1; last = now }
      }
      const started = Date.now()
      button.click()
      const confirm = () => [...document.querySelectorAll('[role="dialog"] button')]
        .find((b) => /^(Export|Export anyway|Exporteren|Toch exporteren)$/.test((b.textContent || '').trim()))
      await ${waitFor("confirm() && 'open'", 'the export dialog')}
      confirm().click()
      await ${waitFor("!document.querySelector('[role=\"dialog\"]') && seen.some((b) => b.type === 'image/png') && 'arrived'", 'the export to leave')}
      URL.createObjectURL = createObjectURL
      const png = seen.filter((b) => b.type === 'image/png').sort((a, b) => b.size - a.size)[0]
      const bitmap = await createImageBitmap(png)
      const elapsed = Date.now() - started
      if (Math.max(bitmap.width, bitmap.height) < 3000) {
        throw new Error('only ' + bitmap.width + 'x' + bitmap.height + ' px: too coarse to print')
      }
      return png.size + ' bytes, ' + bitmap.width + 'x' + bitmap.height + ' px in ' + elapsed + ' ms'
    })()`))

  // --- an agent as a peer of the menu (ADR-0007) ------------------------------
  //
  // Turned on the way the dialog turns it on, connected to with the real SDK
  // client, and kept for the rest of the run: from here on the agent is how
  // the run reads the organisation and makes changes, because it goes through
  // the same dispatch a keystroke takes and answers in JSON rather than DOM.
  section('an agent')

  const { agentStatus, reloadAgent, setAgentEnabled } = await import('./mcp')
  let client: ToolClient | undefined
  let endpoint = ''
  let token = ''
  let port = 0

  /** One tool call, its JSON answer parsed; a refusal is a thrown error naming the tool. */
  const agent = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    if (!client) throw new Error('no agent client')
    const result = await client.callTool({ name, arguments: args }) as ToolAnswer
    const text = result.content.find((block) => block.type === 'text')?.text ?? ''
    if (result.isError) throw new Error(`${name} refused: ${text}`)
    try { return JSON.parse(text) as T } catch { return { text } as T }
  }

  results.push(await checkHere('an agent connects over the loopback, and a wrong token is refused', async () => {
    if (agentStatus().kind !== 'off') throw new Error('listening before being turned on')
    const on = await setAgentEnabled(true)
    if (on.kind === 'off') throw new Error('did not start listening')
    port = on.port
    token = on.token
    endpoint = `http://127.0.0.1:${port}/mcp`

    // The client the agents actually use, from node_modules — a dev
    // dependency, reached through a path the bundler cannot see so it is not
    // bundled into main.
    const sdk = '@modelcontextprotocol/sdk/client/'
    const { Client } = await import(/* @vite-ignore */ `${sdk}index.js`) as
      typeof import('@modelcontextprotocol/sdk/client/index.js')
    const { StreamableHTTPClientTransport } = await import(/* @vite-ignore */ `${sdk}streamableHttp.js`) as
      typeof import('@modelcontextprotocol/sdk/client/streamableHttp.js')

    const wrong = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-it' }, body: '{}',
    })
    if (wrong.status !== 401) throw new Error(`a wrong token was answered with ${wrong.status}`)

    const connected = new Client({ name: 'smoke-agent', version: '0' })
    await connected.connect(new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }))
    client = connected as unknown as ToolClient
    const { tools } = await client.listTools()
    for (const wanted of ['project.current', 'register.list', 'scopes.list', 'element.add', 'project.save', 'undo']) {
      if (!tools.some((tool) => tool.name === wanted)) throw new Error(`${wanted} is not among the tools`)
    }
    if (agentStatus().kind !== 'connected') throw new Error('the app does not say connected')
    return `port ${port}: ${tools.length} tools`
  }))

  results.push(await checkHere('the agent reads the landscape on screen', async () => {
    const current = await agent<{ name?: string; path?: string; elements?: number; activeDiagramId?: string }>('project.current')
    if (current.name !== EXAMPLE.landscapeName || current.path !== EXAMPLE.landscape) {
      throw new Error(`the open scope is ${current.name} at ${JSON.stringify(current.path)}`)
    }
    if (current.activeDiagramId !== EXAMPLE.activeDiagram) throw new Error(`the board on screen is ${current.activeDiagramId}`)
    return `"${current.name}" at ${current.path}, ${current.elements} elements, ${current.activeDiagramId} on screen`
  }))

  // The four things only the renderer can do, through the same client: a
  // picture of the board comes back as an image block with the transform
  // beside it, and pointing at an element is answered.
  results.push(await checkHere('the agent sees the board: focus and a budgeted render', async () => {
    const current = await agent<{ activeDiagramId: string }>('project.current')
    const listed = await agent<{ elements?: { id: string }[] }>('elements.list', { limit: 1, diagramId: current.activeDiagramId })
    const firstId = listed.elements?.[0]?.id
    if (!firstId) throw new Error('elements.list named nothing')
    await agent('focus', { elementId: firstId })
    const drawn = await client!.callTool({ name: 'diagram.render', arguments: { elementIds: [firstId], maxPixels: 250_000 } }) as ToolAnswer
    if (drawn.isError) throw new Error(`diagram.render refused: ${drawn.content[0]?.text}`)
    const image = drawn.content[0]
    if (image.type !== 'image' || image.mimeType !== 'image/png' || !image.data) throw new Error('no image block')
    if (Buffer.from(image.data, 'base64').subarray(0, 4).toString('hex') !== '89504e47') throw new Error('the image is not a PNG')
    const transform = JSON.parse(drawn.content[1]?.text ?? '{}') as { width?: number; height?: number }
    if (!transform.width || !transform.height || transform.width * transform.height > 250_000) {
      throw new Error(`the picture is ${transform.width}x${transform.height}, over the budget`)
    }
    return `a ${transform.width}x${transform.height} picture of ${firstId}`
  }))

  // --- the organisation, read across its scopes (ADR-0012 §2) -----------------
  //
  // The index is built at boot from every scope's model.json, and the register
  // is that index filtered to applications. The landscape defines 20; the
  // organisation defines none and holds the business layer. A register that
  // answers 0 here is an index that never read the folder — which is the
  // symptom every cross-scope name, link and finding shows at once.
  section('the organisation across scopes')

  results.push(await checkHere('the tree lists the organisation and its landscape', async () => {
    const tree = await agent<{ total: number; open: string; scopes: { path: string; name: string; views: number }[] }>('scopes.list')
    if (tree.total !== EXAMPLE.scopes) throw new Error(`${tree.total} scopes: ${tree.scopes.map((s) => s.path || '(root)').join(', ')}`)
    const root = tree.scopes.find((s) => s.path === '')
    if (root?.name !== first.name) throw new Error(`the root is ${root?.name}`)
    const organisation = tree.scopes.find((s) => s.path === EXAMPLE.path)
    if (organisation?.name !== EXAMPLE.organisation) throw new Error(`${EXAMPLE.path} is ${organisation?.name}`)
    if (tree.open !== EXAMPLE.landscape) throw new Error(`open is ${JSON.stringify(tree.open)}`)
    return tree.scopes.map((s) => `${s.path || '(root)'} "${s.name}" ${s.views} views`).join('; ')
  }))

  results.push(await checkHere('the register knows every application and who answers for it', async () => {
    // The example was written by this app a moment ago: the index has to have
    // heard about its own writes, which is the thing that was not true.
    const register = await until('the register', () => registerTotal(), (held) => held.total === EXAMPLE.applications)
    const elsewhere = register.some.filter((entry) => entry.master !== EXAMPLE.landscape)
    if (elsewhere.length) throw new Error(`not the landscape's: ${elsewhere.map((e) => `${e.id}@${e.master}`).join(', ')}`)
    return `${register.total} applications, all mastered by ${EXAMPLE.landscape}`
  }))

  results.push(await checkHere('the checks answer over the whole tree, and nothing dangles', async () => {
    const findings = await agent<{ total: number; some: { key: string; id: string; scope: string }[] }>('checks.list', { limit: 500 })
    const dangling = findings.some.filter((f) => f.key === 'check.dangling' || f.key === 'check.danglingEnd')
    if (dangling.length) throw new Error(`dangling: ${dangling.map((f) => `${f.scope || '(root)'}/${f.id}`).slice(0, 5).join(', ')}`)
    const keys = [...new Set(findings.some.map((f) => f.key))]
    return `${findings.total} findings, keys: ${keys.join(', ') || 'none'}`
  }))

  results.push(await checkHere('search answers over elements, decisions and plans in one list', async () => {
    const hits = await agent<{ hits: { kind: string }[] }>('search', { query: 'rater' })
    if (!hits.hits.length) throw new Error('nothing found for "rater"')
    const kinds = [...new Set(hits.hits.map((hit) => hit.kind))]
    if (kinds.length < 2) throw new Error(`only ${kinds.join(', ')} for a word the example uses in a plan and a decision`)
    return `${hits.hits.length} hits: ${kinds.join(', ')}`
  }))

  // --- a change: one step, one undo, one file (ADR-0002, ADR-0003, ADR-0011) ---
  section('a change, saved and undone')

  const ADDED = 'Smoke Rater'
  let addedId = ''

  results.push(await checkHere("undo takes back the agent's own step and stops at a person's", async () => {
    const before = await agent<{ elements?: number }>('project.current')
    const extra = await agent<{ id: string }>('element.add', { name: 'Smoke Undo Me' })
    const undone = await agent<{ undone: string[]; revision: number }>('undo', { steps: 1 })
    if (undone.undone.length !== 1) throw new Error(`undid ${undone.undone.length} steps`)
    const after = await agent<{ elements?: number }>('project.current')
    if (after.elements !== before.elements) throw new Error(`${after.elements} elements after undo, ${before.elements} before`)
    const listed = await agent<{ elements?: { id: string }[] }>('elements.list', { query: 'Smoke Undo Me' })
    if (listed.elements?.some((e) => e.id === extra.id)) throw new Error('the undone element is still listed')
    // Tidy, pressed by a person earlier in this run, is now the newest step:
    // the agent's undo stops there rather than taking back what a person did.
    const past = await client!.callTool({ name: 'undo', arguments: { steps: 1 } }) as ToolAnswer
    if (!past.isError) throw new Error("undo went on past a person's step")
    return `took back "${undone.undone[0]}", then refused at the person's step`
  }))

  results.push(await checkHere('an element added by the agent is one step and lands on the board', async () => {
    const added = await agent<{ id: string; name: string; kind: string; diagramId: string; revision: number }>('element.add', { name: ADDED })
    addedId = added.id
    if (added.diagramId !== EXAMPLE.activeDiagram) throw new Error(`drawn on ${added.diagramId}`)
    const onBoard = await page(waitFor(
      `[...document.querySelectorAll('.react-flow__node')].some((n) => (n.textContent || '').includes(${JSON.stringify(ADDED)})) && 'on the board'`,
      'the new card to appear'))
    const activity = await agent<{ steps: { by?: string; origin?: string; label?: string; what?: string }[] }>('activity.list', { limit: 1 })
    const newest = activity.steps[0]
    if (!newest) throw new Error('the Activity list is empty')
    if (!JSON.stringify(newest).toLowerCase().includes('agent')) throw new Error(`the newest step is not the agent's: ${JSON.stringify(newest)}`)
    return `${added.id} (${added.kind}) at revision ${added.revision}, ${onBoard}, newest Activity line is the agent's`
  }))

  results.push(await checkHere('project.save writes it to model.json as the format does', async () => {
    await agent('project.save')
    const model = JSON.parse(await onDisk(first, `${EXAMPLE.landscape}/model.json`)) as
      { elements: { id: string; name: string; kind: string }[] }
    const held = model.elements.find((e) => e.id === addedId)
    if (!held) throw new Error(`${addedId} is not in model.json`)
    if (held.name !== ADDED || held.kind !== 'application') throw new Error(`written as ${JSON.stringify(held)}`)
    const left = await readdir(join(first.root, EXAMPLE.landscape))
    if (left.some((name) => name.endsWith('.tmp'))) throw new Error(`temporary files left: ${left}`)
    return `${addedId} in ${EXAMPLE.landscape}/model.json, ${model.elements.length} elements, no temporary files`
  }))


  results.push(await checkHere('a decision and a plan proposed by the agent land as numbered files', async () => {
    const decision = await agent<{ id: string; label: string }>('decision.propose', { title: 'Smoke decision', subjectId: addedId })
    const plan = await agent<{ id: string; label: string }>('plan.create', { title: 'Smoke plan' })
    await agent('project.save')
    // A record about one element goes in a folder of its own, because numbers
    // are per list (`projects/adrFile.ts`); a plan is flat under transitions/.
    const decisions = await readdir(join(first.root, EXAMPLE.landscape, 'decisions', addedId))
    const plans = await readdir(join(first.root, EXAMPLE.landscape, 'transitions'))
    const decisionFile = decisions.find((name) => /^\d{4}-smoke-decision\.md$/.test(name))
    const planFile = plans.find((name) => /^\d{4}-smoke-plan\.md$/.test(name))
    if (!decisionFile) throw new Error(`no decision file among ${decisions.join(', ')}`)
    if (!planFile) throw new Error(`no plan file among ${plans.join(', ')}`)
    const text = await onDisk(first, `${EXAMPLE.landscape}/decisions/${addedId}/${decisionFile}`)
    if (!text.includes(addedId)) throw new Error(`the decision does not name ${addedId}`)
    const listed = await agent<{ decisions: unknown[] }>('decisions.list', { subjectId: addedId })
    if (listed.decisions.length < 1) throw new Error('decisions.list does not list it under its subject')
    return `${decision.label} → decisions/${addedId}/${decisionFile}, ${plan.label} → transitions/${planFile}`
  }))

  // --- a second folder: everything read at boot, read again --------------------
  //
  // The path the composition root takes when a folder is chosen or picked from
  // Recent while another is open. Three bugs sat here at once: the migration
  // copied the open organisation into the new folder, the open scope stayed
  // open over the new store, and the index kept the boot's read — an empty
  // register, every stand-in dangling. None of that is reachable from a unit
  // test, because none of it is under `App`; it is what mounts `App`.
  section('a second folder')

  results.push(await checkHere('switching to an empty folder shows an empty root, and copies nothing into it', async () => {
    const seen = await openFolder(second)
    const listing = (await readdir(second.root)).filter((name) => !name.startsWith('.'))
    // Nothing of the first folder may arrive: not the organisation, not the
    // landscape, not a `scope.json` written for the example.
    if (listing.length) throw new Error(`the new folder already holds ${listing.join(', ')}`)
    const shown = JSON.parse(await page(`JSON.stringify({
      name: (document.querySelector('[data-testid="organisation-name"]') || {}).textContent || '',
      rows: document.querySelectorAll('[data-testid^="scope-"]').length,
    })`)) as { name: string; rows: number }
    if (shown.name !== second.name) throw new Error(`the root is called ${JSON.stringify(shown.name)}`)
    if (shown.rows) throw new Error(`${shown.rows} scopes shown under a root that has none: the old tree is still up`)
    const refused = await client!.callTool({ name: 'project.current', arguments: {} }) as ToolAnswer
    if (!refused.isError) throw new Error('the agent still answers for the scope that was open in the other folder')
    return `${second.root} — ${seen}, empty on disk, nothing open`
  }))

  const ADDED_ELSEWHERE = 'Smoke Rater Elsewhere'

  results.push(await checkHere('the index is read for the new folder: the register fills after the switch', async () => {
    await copyExample()
    // The register answered 0 here for as long as the index read once at
    // mount: the example is on disk in the new folder, so 20 is the only
    // right answer, and "some applications" would hide a partial read.
    const register = await until('the register after the switch', () => registerTotal(), (held) => held.total === EXAMPLE.applications)
    // The listing is read again after the copy, off the render path like the
    // index; asked the instant the register answered, it can still be the
    // empty folder's.
    const tree = await until('the tree after the copy', () => agent<{ total: number; open: string }>('scopes.list'), (held) => held.total === EXAMPLE.scopes)
    if (tree.total !== EXAMPLE.scopes || tree.open !== EXAMPLE.landscape) throw new Error(`${tree.total} scopes, open ${tree.open}`)
    const stale = await registerTotal(ADDED)
    if (stale.total !== 0) throw new Error(`"${ADDED}" from the other folder is in this folder's register`)
    const findings = await agent<{ some: { key: string }[] }>('checks.list', { limit: 500 })
    const dangling = findings.some.filter((f) => f.key === 'check.dangling' || f.key === 'check.danglingEnd').length
    if (dangling) throw new Error(`${dangling} dangling findings over an example that has none`)
    // Something of this folder's own, saved, so the way back can tell the
    // two folders apart by what each holds.
    await agent('element.add', { name: ADDED_ELSEWHERE })
    await agent('project.save')
    const model = JSON.parse(await onDisk(second, `${EXAMPLE.landscape}/model.json`)) as { elements: { name: string }[] }
    if (!model.elements.some((e) => e.name === ADDED_ELSEWHERE)) throw new Error('the save landed somewhere other than the new folder')
    return `${register.total} applications, ${tree.total} scopes, none of the first folder's; "${ADDED_ELSEWHERE}" saved here`
  }))

  results.push(await checkHere('switching back reads the first folder again, with what was saved there', async () => {
    await openFolder(first)
    // Its home, not its canvas: nothing is open until a person opens it. The
    // landscape's row is in the tree; its Open is the one button on the row
    // with neither an aria-label (the icon buttons carry one, in four
    // languages) nor a test id (the way to its home carries one).
    await page(`
      (async () => {
        await ${waitFor(`document.querySelector('[data-testid="scope-${EXAMPLE.landscape}"]') && 'row'`, 'the landscape row')}
        const row = document.querySelector('[data-testid="scope-${EXAMPLE.landscape}"]')
        const open = [...row.querySelectorAll('button')].find((b) => !b.getAttribute('aria-label') && !b.dataset.testid)
        if (!open) throw new Error('no Open on the landscape row')
        open.click()
        return await ${waitFor("document.querySelector('.react-flow') && 'canvas mounted'", 'the canvas to mount')}
      })()`)
    const current = await agent<{ path?: string; elements?: number }>('project.current')
    if (current.path !== EXAMPLE.landscape) throw new Error(`open is ${current.path}`)
    const register = await until('the register back in the first folder', () => registerTotal(), (held) => held.total === EXAMPLE.applications + 1)
    const mine = await registerTotal(ADDED)
    if (mine.total !== 1) throw new Error(`"${ADDED}" answered ${mine.total} times in its own folder`)
    const theirs = await registerTotal(ADDED_ELSEWHERE)
    if (theirs.total !== 0) throw new Error(`"${ADDED_ELSEWHERE}" from the second folder is in the first folder's register`)
    // And the second folder is as it was left: a switch reads, it never
    // removes. (Its root is named after the folder and is not a file; the
    // example under it is.)
    if (!await exists(second, `${EXAMPLE.path}/scope.json`)) throw new Error('the second folder lost the example on the way back')
    return `${register.total} applications: the example's ${EXAMPLE.applications} and "${ADDED}", not "${ADDED_ELSEWHERE}"`
  }))

  // --- the file channel and the history, on the wire ---------------------------
  //
  // The renderer asks over IPC, main resolves the path inside the folder it was
  // granted, and the bytes land on somebody's disk. None of that is observable
  // from the unit tests, which know the main-process half but not the wire.
  // Against the second folder, whose tree no assertion above still needs.
  section('the file channel and the history')

  results.push(await checkHere('a tree of scopes written through the file channel lands as folders', async () => {
    const directory = second
    const answer = await page(`
      (async () => {
        const root = ${JSON.stringify(directory.root)}
        const files = window.desktop.files
        const header = (name, kind) => new TextEncoder().encode(
          JSON.stringify({ type: 'lionsville-architecture', version: 5, name, kind, diagrams: [] }))
        await files.write(root, 'smoke/scope.json', header('Smoke', 'domain'))
        await files.write(root, 'smoke/one/scope.json', header('Smoke landscape', 'landscape'))
        const back = await files.read(root, 'smoke/one/scope.json')
        const listing = await files.list(root, 'smoke')
        const escaped = await files.read(root, '../escape.json')
        return JSON.stringify({
          text: new TextDecoder().decode(back.bytes),
          listing: listing.map((entry) => entry.name + ':' + entry.kind),
          escaped: escaped === undefined,
        })
      })()`)
    const held = JSON.parse(answer) as { text: string; listing: string[]; escaped: boolean }
    if (!held.text.includes('"Smoke landscape"')) throw new Error(`read back ${held.text}`)
    if (!held.escaped) throw new Error('a path outside the folder was answered')
    if (!held.listing.includes('one:directory')) throw new Error(`the domain does not hold the landscape: ${held.listing.join(', ')}`)
    const left = await readdir(join(directory.root, 'smoke/one'))
    if (left.some((name) => name.endsWith('.tmp'))) throw new Error(`temporary files left: ${left}`)
    return `${basename(directory.root)}/smoke/one, ${held.listing.join(', ')}, escape refused`
  }))

  // The property a crash mid-save depends on. A renderer that dies while
  // writing must leave the PREVIOUS file, never half of the new one — so read
  // the file continuously while a large write is in flight and insist that
  // every read is one whole version or the other.
  results.push(await checkHere('a write in flight never shows half a file', async () => {
    const directory = second
    const path = join(directory.root, 'smoke/two/model.json')
    const before = '{"before":true}'
    const after = `{"after":"${'x'.repeat(400_000)}"}`
    const write = (text: string) => page(`
      window.desktop.files.write(
        ${JSON.stringify(directory.root)}, 'smoke/two/model.json',
        new TextEncoder().encode(${JSON.stringify(text)}),
      ).then(() => 'written')`)
    await write(before)
    const writing = write(after)
    let reads = 0
    let partial = 0
    let done = false
    void writing.then(() => { done = true })
    while (!done) {
      const text = await readFile(path, 'utf8').catch(() => undefined)
      if (text !== undefined) {
        reads += 1
        if (text !== before && text !== after) partial += 1
      }
    }
    await writing
    if (partial > 0) throw new Error(`${partial} of ${reads} reads saw a half-written file`)
    if (await readFile(path, 'utf8') !== after) throw new Error('the write did not land')
    return `${reads} reads during a ${after.length}-byte write, none of them partial`
  }))

  // The remote half of the history channel (ADR-0005), end to end, against a
  // bare repository in a third temporary folder: main runs the machine's own
  // git in the folder it was granted, and the commit lands in the remote. The
  // refusals first, because those are what a person meets before anything works.
  results.push(await checkHere('a folder pushes to and pulls from a local remote', async () => {
    const directory = second
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = promisify(execFile)
    const git = (cwd: string, args: string[]) =>
      run('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).then((r) => r.stdout.trim())
    try {
      await git(directory.root, ['--version'])
    } catch {
      return 'no git on this machine; nothing to exercise'
    }
    const bare = await mkdtemp(join(tmpdir(), 'lvarch-smoke-remote-'))
    await git(bare, ['init', '--bare'])

    const ask = (script: string) => page(`
      (async () => {
        const root = ${JSON.stringify(directory.root)}
        const history = window.desktop.history
        ${script}
      })()`)

    const before = JSON.parse(await ask(`
      await history.init(root)
      const remote = await history.remote(root)
      const pull = await history.pull(root)
      const push = await history.push(root)
      return JSON.stringify({ remote: remote === undefined, pull, push })`)) as
      { remote: boolean; pull: string; push: string }
    if (!before.remote || before.pull !== 'no-remote' || before.push !== 'no-remote') {
      throw new Error(`before a remote: ${JSON.stringify(before)}`)
    }

    await git(directory.root, ['remote', 'add', 'origin', bare])
    const after = JSON.parse(await ask(`
      const sha = await history.snapshot(root, 'smoke sync')
      const push = await history.push(root)
      const pull = await history.pull(root)
      const remote = await history.remote(root)
      return JSON.stringify({ sha: Boolean(sha), push, pull, remote })`)) as
      { sha: boolean; push: string; pull: string; remote: { name: string; branch: string } }
    if (!after.sha) throw new Error('nothing was snapshotted')
    if (after.push !== 'done') throw new Error(`push answered ${after.push}`)
    if (after.pull !== 'done') throw new Error(`pull answered ${after.pull}`)
    const landed = await git(bare, ['log', '--all', '--format=%s'])
    if (!landed.includes('smoke sync')) throw new Error(`the remote holds: ${landed || 'nothing'}`)
    return `${after.remote.name}/${after.remote.branch}: pushed, pulled, and the remote has the snapshot`
  }))

  // --- the trail, and the server switched off ----------------------------------
  section('the trail, and switching the agent off')

  // The diagnostics trail, end to end and on a real packaged build: the shell
  // reports through `ConsoleDiagnostics`, which writes a `[lvarch]` line; main
  // relays the renderer's console into a dated file. Neither half is observable
  // from inside the app, and a log nobody writes is exactly as useless as no log
  // — so the line goes in from the renderer and comes back off the disk.
  results.push(await checkHere("the renderer's diagnostics reach the log file", async () => {
    const path = logFilePath()
    const marker = `smoke relay ${Date.now()}`
    await page(`console.error(${JSON.stringify(`[lvarch] ${marker}`)})`)
    const deadline = Date.now() + 5_000
    for (;;) {
      const text = await readFile(path, 'utf8').catch(() => '')
      const started = text.includes('started ')
      if (started && text.includes(marker)) return `${path}, ${text.trimEnd().split('\n').length} lines`
      if (Date.now() > deadline) {
        throw new Error(text
          ? `${path} has ${started ? 'the start line but not the relayed one' : 'no start line'}`
          : `nothing at ${path}`)
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }))

  results.push(await checkHere('the agent server keeps its address across a relaunch, and closes when off', async () => {
    await client?.close()
    client = undefined
    // A relaunch keeps the port and the token: the file is read back and the
    // listener comes up on the same address, so an agent configured before
    // the relaunch still connects.
    await reloadAgent()
    const again = agentStatus()
    if (again.kind === 'off' || again.port !== port || again.token !== token) {
      throw new Error('the port or the token did not survive a relaunch')
    }
    await setAgentEnabled(false)
    const closed = await fetch(endpoint).then(() => false, () => true)
    if (!closed) throw new Error('the port is still open with the feature off')
    return `port ${port} kept across the relaunch, closed again`
  }))

  const failed = results.filter((r) => !r.ok)
  process.stdout.write(failed.length ? `\n${failed.length} of ${results.length} FAILED\n` : `\nall ${results.length} passed\n`)

  // Fit the view before the screenshot. The canvas opens where the project left
  // it, and a picture of empty grid says nothing about whether the app works.
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
