/**
 * The preload, and it is deliberately almost empty.
 *
 * A sandboxed preload cannot `require` a Node module, so this bundle is not a
 * place to do work: it is the doorway. Everything it exposes becomes permanent
 * renderer surface, so it exposes the two facts the shell may legitimately want
 * — that it is running on the desktop, and on which platform — and nothing else.
 *
 * The file channel is the exception, and it is the reason this file is not
 * empty. It is `ipcRenderer.invoke` behind the typed contract in
 * `src/adapters/desktop/channel.ts` — the same file the renderer's adapter
 * compiles against, so the two ends cannot drift — and every payload is checked
 * again in main, which is where the folder the user chose is actually known.
 * Nothing here validates anything: a check on this side of the boundary is a
 * check the caller can skip.
 *
 * (CommonJS on purpose: an ESM preload cannot run in a sandboxed renderer. See
 * the preload output format in `electron.vite.config.ts`.)
 */
import { contextBridge, ipcRenderer } from 'electron'
import type {
  DesktopAgent, DesktopChange, DesktopCommands, DesktopFiles, DesktopHistory, DesktopSettings,
} from '../../src/adapters/desktop/channel'
import type { AgentRequest } from '../../src/agent/tools'
import type { AgentServerStatus } from '../../src/platform/agentServer'
import type { HostCommand } from '../../src/platform/hostCommands'
import type { ThemeMode } from '../../src/platform/theme'

export type DesktopBridge = {
  readonly platform: NodeJS.Platform
  readonly versions: { electron: string; chrome: string }
  /** Present on the desktop and nowhere else — which is how the app tells. */
  readonly files: DesktopFiles
  /** Menu items and files the OS handed us. See `HostCommand`. */
  readonly commands: DesktopCommands
  /** Snapshots of the working directory, through the machine's own git. */
  readonly history: DesktopHistory
  /** What main keeps for itself: the update settings. See `DesktopSettings`. */
  readonly settings: DesktopSettings
  /** An agent's tool calls, relayed from the MCP server in main. See `DesktopAgent`. */
  readonly agent: DesktopAgent
}

const files: DesktopFiles = {
  chooseDirectory: () => ipcRenderer.invoke('files:chooseDirectory'),
  recentDirectories: () => ipcRenderer.invoke('files:recentDirectories'),
  list: (root, path) => ipcRenderer.invoke('files:list', root, path),
  makeDirectory: (root, path) => ipcRenderer.invoke('files:makeDirectory', root, path),
  read: (root, path) => ipcRenderer.invoke('files:read', root, path),
  write: (root, path, bytes) => ipcRenderer.invoke('files:write', root, path, bytes),
  remove: (root, path, options) => ipcRenderer.invoke('files:remove', root, path, options),
  fingerprint: (root, path) => ipcRenderer.invoke('files:fingerprint', root, path),
  revealInFolder: (root, path) => ipcRenderer.invoke('files:revealInFolder', root, path),
  saveDocument: (name, bytes, mediaType) =>
    ipcRenderer.invoke('files:saveDocument', name, bytes, mediaType),
  watch: (root) => ipcRenderer.invoke('files:watch', root),
  unwatch: (root) => ipcRenderer.invoke('files:unwatch', root),
  onChanged: (listener) => {
    // The event object itself is not passed on: it carries a `sender` the
    // renderer has no business holding, and this doorway hands over data only.
    const relay = (_event: unknown, changes: DesktopChange[]) => {
      for (const change of changes) listener(change)
    }
    ipcRenderer.on('files:changed', relay)
    return () => { ipcRenderer.off('files:changed', relay) }
  },
}

const commands: DesktopCommands = {
  on(listener) {
    const relay = (_event: unknown, command: HostCommand) => listener(command)
    ipcRenderer.on('app:command', relay)
    // A file the OS opened us WITH arrives before this window exists, let alone
    // before anything in it is listening. Main holds those until somebody says
    // it is listening, which is this line, and nothing else can say it.
    void ipcRenderer.invoke('app:listening')
    return () => { ipcRenderer.off('app:command', relay) }
  },
  reportUnsaved: (unsaved) => { void ipcRenderer.invoke('app:unsaved', unsaved) },
  reportTheme: (mode: ThemeMode) => { void ipcRenderer.invoke('app:theme', mode) },
}

const history: DesktopHistory = {
  available: () => ipcRenderer.invoke('git:available'),
  isRepository: (root) => ipcRenderer.invoke('git:isRepository', root),
  init: (root) => ipcRenderer.invoke('git:init', root),
  snapshot: (root, message) => ipcRenderer.invoke('git:snapshot', root, message),
  history: (root, limit, paths) => ipcRenderer.invoke('git:history', root, limit, paths),
  filesAt: (root, sha, prefix) => ipcRenderer.invoke('git:filesAt', root, sha, prefix),
  remote: (root) => ipcRenderer.invoke('git:remote', root),
  pull: (root) => ipcRenderer.invoke('git:pull', root),
  push: (root) => ipcRenderer.invoke('git:push', root),
  resolve: (root, side) => ipcRenderer.invoke('git:resolve', root, side),
  excludeLocal: (root) => ipcRenderer.invoke('git:excludeLocal', root),
}

const settings: DesktopSettings = {
  readUpdates: () => ipcRenderer.invoke('settings:readUpdates'),
  writeUpdates: (patch) => ipcRenderer.invoke('settings:writeUpdates', patch),
}

const agent: DesktopAgent = {
  onRequest(listener) {
    const relay = (_event: unknown, request: AgentRequest) => listener(request)
    ipcRenderer.on('agent:request', relay)
    return () => { ipcRenderer.off('agent:request', relay) }
  },
  answer: (id, answer) => ipcRenderer.invoke('agent:answer', id, answer),
  status: () => ipcRenderer.invoke('agent:status'),
  onStatus(listener) {
    const relay = (_event: unknown, status: AgentServerStatus) => listener(status)
    ipcRenderer.on('agent:status', relay)
    return () => { ipcRenderer.off('agent:status', relay) }
  },
  configure: (patch) => ipcRenderer.invoke('agent:configure', patch),
  newToken: () => ipcRenderer.invoke('agent:newToken'),
}

const bridge: DesktopBridge = {
  platform: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  files,
  commands,
  history,
  settings,
  agent,
}

contextBridge.exposeInMainWorld('desktop', bridge)
