/**
 * The agent server, as main runs it (ADR-0007).
 *
 * Three things live here and nowhere else: the settings file that says
 * whether the feature is on and which port and token it settled on; the
 * relay that hands a tool call to the window and waits for its answer; and
 * the three facts the renderer is told — off, listening on which port,
 * connected by whom. The protocol is `mcpProtocol.ts` and the listener is
 * `mcpServer.ts`; this file decides nothing about either.
 *
 * **Off by default, and kept once on.** The port and the token are generated
 * the first time the feature is turned on and kept in `mcp.json` in
 * `userData`, mode 0600, until it is turned off or a person asks for a new
 * token. A person configures their agent once; a token that changed on every
 * launch would mean doing it again every morning. If the kept port is busy
 * at start, the listener takes another, this file keeps that one, and the
 * status says so.
 *
 * **The token never reaches the log.** The port does, the tool names do, the
 * refusal keys do; the token is shown to the person in the app's own dialog
 * and to nobody else.
 */
import { app, ipcMain, webContents } from 'electron'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentAnswer, AgentRequest } from '../../src/agent/tools'
import { refused } from '../../src/agent/tools'
import type {
  AgentClient, AgentServerPatch, AgentServerSettings, AgentServerStatus,
} from '../../src/platform/agentServer'
import { AGENT_OFF, DEFAULT_AGENT_SETTINGS, readAgentSettings } from '../../src/platform/agentServer'
import { log } from './log'
import { listen } from './mcpServer'
import type { AgentListener } from './mcpServer'

const SETTINGS_FILE = 'mcp.json'

/**
 * How long a tool call may take the window. Generous, because a later tier
 * draws and lays out; a client that waits half a minute for a refusal is
 * still better off than one that waits forever.
 */
const ANSWER_TIMEOUT_MS = 60_000

/**
 * How long a client stays *connected* after its last request. The transport
 * has no connection to watch — a client that closes without the goodbye the
 * SDK makes optional simply stops talking — so silence this long is read as
 * gone, and the glyph goes back to listening.
 */
const IDLE_MS = 10 * 60 * 1000

const settingsPath = (): string => join(app.getPath('userData'), SETTINGS_FILE)

let settings: AgentServerSettings = DEFAULT_AGENT_SETTINGS
let listener: AgentListener | undefined
let client: AgentClient | undefined
let idle: NodeJS.Timeout | undefined
/** The port `mcp.json` named when the listener could not have it. */
let movedFrom: number | undefined

/** The window's answers, by the id of the request they answer. */
const pending = new Map<string, (answer: AgentAnswer) => void>()

async function loadSettings(): Promise<void> {
  try {
    settings = readAgentSettings(JSON.parse(await readFile(settingsPath(), 'utf8')))
  } catch {
    settings = DEFAULT_AGENT_SETTINGS
  }
}

async function saveSettings(next: AgentServerSettings): Promise<void> {
  settings = next
  const path = settingsPath()
  try {
    await writeFile(path, `${JSON.stringify(next, undefined, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    // `mode` applies only when the file is created; a file that already
    // existed keeps whatever it had, so say it again.
    await chmod(path, 0o600)
  } catch (error) {
    log('agent', `could not save ${SETTINGS_FILE}: ${String(error)}`)
  }
}

/** Forty-eight hex characters from the OS, which is more than a loopback needs. */
function mintToken(): string {
  return randomBytes(24).toString('hex')
}

// --- the three facts ---------------------------------------------------------------

export function agentStatus(): AgentServerStatus {
  if (!listener || !settings.token) return AGENT_OFF
  const base = { port: listener.port, token: settings.token, ...(movedFrom !== undefined ? { movedFrom } : {}) }
  return client ? { kind: 'connected', ...base, client } : { kind: 'listening', ...base }
}

function broadcast(): void {
  const status = agentStatus()
  for (const held of webContents.getAllWebContents()) {
    if (!held.isDestroyed()) held.send('agent:status', status)
  }
}

/**
 * Keep the window painting while an agent may ask it to draw.
 *
 * Chromium stops painting a page whose window is minimised or covered, and
 * Electron then reports it hidden — which is the ordinary state of this app
 * while a person works in a terminal beside it, and exactly when an agent
 * asks for a picture. With background throttling off the page keeps painting
 * and keeps saying it is visible, so a capture succeeds without anyone
 * clicking. It costs a canvas animating in the background, so it is off only
 * while the server listens, and back on the moment it stops.
 */
export function keepPaintingForAgent(contents: Electron.WebContents): void {
  contents.setBackgroundThrottling(listener === undefined)
}

function throttleEverywhere(): void {
  for (const held of webContents.getAllWebContents()) {
    if (!held.isDestroyed()) keepPaintingForAgent(held)
  }
}

function touch(): void {
  if (idle) clearTimeout(idle)
  idle = setTimeout(() => {
    idle = undefined
    if (!client) return
    client = undefined
    log('agent', 'the client went quiet; listening again')
    broadcast()
  }, IDLE_MS)
  idle.unref()
}

// --- the relay ---------------------------------------------------------------------

/**
 * To the focused window, and to the only window when none is focused — the
 * same rule the menu uses, for the same reason.
 */
function target(): Electron.WebContents | undefined {
  const all = webContents.getAllWebContents().filter((held) => !held.isDestroyed())
  return all.find((held) => held.isFocused()) ?? all[0]
}

function ask(request: AgentRequest): Promise<AgentAnswer> {
  touch()
  const window = target()
  if (!window) return Promise.resolve(refused('agent.noAnswer', 'no window'))
  return new Promise<AgentAnswer>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(request.id)
      log('agent', `tool ${request.tool} -> agent.noAnswer`)
      resolve(refused('agent.noAnswer'))
    }, ANSWER_TIMEOUT_MS)
    pending.set(request.id, (answer) => {
      clearTimeout(timer)
      pending.delete(request.id)
      // Names and keys, never content: this line goes to a file the user is
      // invited to hand over.
      log('agent', `tool ${request.tool} -> ${answer.ok ? 'ok' : answer.refusal}`)
      resolve(answer)
    })
    window.send('agent:request', request)
  })
}

function isAnswer(value: unknown): value is AgentAnswer {
  if (!value || typeof value !== 'object') return false
  const held = value as Record<string, unknown>
  if (held['ok'] === true) return Array.isArray(held['content'])
  return held['ok'] === false && typeof held['refusal'] === 'string'
}

// --- the listener's life ---------------------------------------------------------------

async function start(): Promise<void> {
  if (listener) return
  const token = settings.token ?? mintToken()
  const wanted = settings.port ?? 0
  listener = await listen({
    port: wanted,
    token,
    relay: {
      ask,
      onInitialized: (who) => {
        client = who
        touch()
        log('agent', `${who.name} ${who.version} connected`)
        broadcast()
      },
      onClosed: () => {
        client = undefined
        log('agent', 'the client said goodbye')
        broadcast()
      },
    },
    server: { name: 'lionsville-architecture-management-tool', version: app.getVersion() },
  })
  movedFrom = wanted !== 0 && listener.port !== wanted ? wanted : undefined
  if (movedFrom !== undefined) log('agent', `port ${movedFrom} was busy; listening on ${listener.port} instead`)
  else log('agent', `listening on ${listener.port}`)
  if (settings.port !== listener.port || settings.token !== token) {
    await saveSettings({ enabled: true, port: listener.port, token })
  }
  throttleEverywhere()
  broadcast()
}

async function stop(): Promise<void> {
  if (!listener) return
  const held = listener
  listener = undefined
  client = undefined
  if (idle) clearTimeout(idle)
  idle = undefined
  for (const [id, resolve] of pending) {
    pending.delete(id)
    resolve(refused('agent.off'))
  }
  await held.close()
  log('agent', 'stopped listening')
  throttleEverywhere()
  broadcast()
}

/** The switch. Turning it off forgets the port and the token, as the record says. */
export async function setAgentEnabled(enabled: boolean): Promise<AgentServerStatus> {
  if (enabled) {
    await saveSettings({ ...settings, enabled: true })
    await start()
  } else {
    await stop()
    await saveSettings({ enabled: false })
  }
  return agentStatus()
}

/** A new token, and the listener restarted under it. Every configured agent needs it again. */
export async function newAgentToken(): Promise<AgentServerStatus> {
  const running = Boolean(listener)
  await stop()
  await saveSettings({ ...settings, token: mintToken() })
  if (running || settings.enabled) await start()
  return agentStatus()
}

/** At boot: read the file, and listen if it says so. Never throws; a server that will not start is a log line. */
export async function startAgent(): Promise<void> {
  await loadSettings()
  if (!settings.enabled) return
  try {
    await start()
  } catch (error) {
    log('agent', `could not start: ${String(error)}`)
  }
}

export function stopAgent(): Promise<void> {
  return stop()
}

/**
 * What a relaunch does, without one: stop, read the file again, start if it
 * says so. For the smoke run, which has one process to prove persistence in.
 */
export async function reloadAgent(): Promise<void> {
  await stop()
  await startAgent()
}

/**
 * The renderer's side: answers to requests, and the switch. Every payload is
 * a shape until it has been checked, like every payload from the renderer.
 */
export function registerAgentChannel(): void {
  ipcMain.handle('agent:answer', (_event, id: unknown, answer: unknown) => {
    if (typeof id !== 'string' || !isAnswer(answer)) return
    pending.get(id)?.(answer)
  })
  ipcMain.handle('agent:status', (): AgentServerStatus => agentStatus())
  ipcMain.handle('agent:configure', (_event, patch: unknown): Promise<AgentServerStatus> => {
    const held = (patch ?? {}) as Partial<AgentServerPatch>
    if (typeof held.enabled !== 'boolean') return Promise.resolve(agentStatus())
    return setAgentEnabled(held.enabled)
  })
  ipcMain.handle('agent:newToken', (): Promise<AgentServerStatus> => newAgentToken())
}

/** For the smoke run, which has no client to hand it one. */
export function freshRequestId(): string {
  return randomUUID()
}
