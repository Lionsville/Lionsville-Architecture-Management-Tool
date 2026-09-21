/**
 * Is there a desktop under us, and does it offer files?
 *
 * The preload puts `files` on `window.desktop` and a browser tab has no such
 * object, which is the whole test — the same one `hostWindow.ts` makes for the
 * window chrome. Reading a global is why this sits in an adapter; what to DO
 * about the answer is `app/composition.ts`.
 */
import type {
  DesktopAgent, DesktopCommands, DesktopFiles, DesktopHistory, DesktopSettings,
} from './channel'
import type { HookInvoke } from '../../platform/desktopHook'

type Bridge = {
  files?: DesktopFiles; commands?: DesktopCommands; history?: DesktopHistory; settings?: DesktopSettings
  agent?: DesktopAgent
  invokeHook?: HookInvoke
}

function bridge(): Bridge | undefined {
  return (window as unknown as { desktop?: Bridge }).desktop
}

export function desktopFiles(): DesktopFiles | undefined {
  return bridge()?.files
}

/** Menu items and files the OS handed us. Absent in a browser tab. */
export function desktopCommands(): DesktopCommands | undefined {
  return bridge()?.commands
}

/** Snapshots, through the machine's own git. Absent in a browser tab. */
export function desktopHistory(): DesktopHistory | undefined {
  return bridge()?.history
}

/** The settings main keeps for itself. Absent in a browser tab. */
export function desktopSettings(): DesktopSettings | undefined {
  return bridge()?.settings
}

/** An agent's tool calls, relayed from main. Absent in a browser tab. */
export function desktopAgent(): DesktopAgent | undefined {
  return bridge()?.agent
}

/**
 * Call a hook's main side (`platform/desktopHook.ts`). Absent in a browser tab
 * and in a desktop build older than the door, which is why a provider asks
 * rather than assumes.
 */
export function desktopHookChannel(): HookInvoke | undefined {
  return bridge()?.invokeHook
}
