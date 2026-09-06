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
import type { DesktopChange, DesktopCommands, DesktopFiles } from '../../src/adapters/desktop/channel'
import type { HostCommand } from '../../src/platform/hostCommands'

export type DesktopBridge = {
  readonly platform: NodeJS.Platform
  readonly versions: { electron: string; chrome: string }
  /** Present on the desktop and nowhere else — which is how the app tells. */
  readonly files: DesktopFiles
  /** Menu items and files the OS handed us. See `HostCommand`. */
  readonly commands: DesktopCommands
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
}

const bridge: DesktopBridge = {
  platform: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  files,
  commands,
}

contextBridge.exposeInMainWorld('desktop', bridge)
