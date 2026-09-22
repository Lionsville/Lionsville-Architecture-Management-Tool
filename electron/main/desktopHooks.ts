// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The registered hooks, run (`platform/desktopHook`).
 *
 * This build registers none, so the loop below runs over an empty list and
 * this file does nothing — which is the shape the seam is meant to have. What
 * it buys is that a build composed from this one adds its side of a channel by
 * registering a hook at composition rather than by editing `index.ts`, the way
 * an icon pack is a `registerLogoPack` call and not a line in the registry.
 *
 * Electron's `ipcMain` is handed over as the `ChannelHost` it structurally is:
 * a hook may answer a call and take its answer back, and cannot reach the
 * window, the menu or the file channel.
 *
 * A hook that throws while registering is logged and the rest still run. One
 * that will not start must not take the app's first paint with it, which is
 * the same rule `startAgent` keeps.
 */
import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import { desktopHooks } from '../../src/platform/desktopHook'
import type { DesktopSide } from '../../src/platform/desktopHook'
import { log } from './log'
import { fileSecrets } from './secrets'

/** Beside `mcp.json` in `userData`, and with the same mode. */
const SECRETS_FILE = 'secrets.json'

export function runDesktopHooks(): void {
  const hooks = desktopHooks()
  if (hooks.length === 0) return
  const desktop: DesktopSide = {
    channels: ipcMain,
    secrets: fileSecrets(join(app.getPath('userData'), SECRETS_FILE)),
  }
  for (const hook of hooks) {
    try {
      hook.registerChannels(desktop)
      log('main', `hook ${hook.id} registered`)
    } catch (error) {
      log('main', `hook ${hook.id} could not register: ${String(error)}`)
    }
  }
}
