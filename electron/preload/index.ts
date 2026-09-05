/**
 * The preload, and it is deliberately almost empty.
 *
 * A sandboxed preload cannot `require` a Node module, so this bundle is not a
 * place to do work: it is the doorway. Everything it exposes becomes permanent
 * renderer surface, so it exposes the two facts the shell may legitimately want
 * — that it is running on the desktop, and on which platform — and nothing else.
 *
 * The file channel arrives in 6C, as `ipcRenderer.invoke` behind a typed
 * contract with every payload validated in main. Until it does, the renderer's
 * capabilities on the desktop are exactly its capabilities in a browser tab.
 *
 * (CommonJS on purpose: an ESM preload cannot run in a sandboxed renderer. See
 * the preload output format in `electron.vite.config.ts`.)
 */
import { contextBridge } from 'electron'

export type DesktopBridge = {
  readonly platform: NodeJS.Platform
  readonly versions: { electron: string; chrome: string }
}

const bridge: DesktopBridge = {
  platform: process.platform,
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
}

contextBridge.exposeInMainWorld('desktop', bridge)
