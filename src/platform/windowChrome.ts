// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the window around us asks of the page.
 *
 * The desktop build hides the macOS title bar (`titleBarStyle: 'hiddenInset'`,
 * `electron/main/index.ts`) so the app starts at the top of the window instead
 * of under a strip of grey. Hiding it does not remove the two jobs it was
 * doing: the traffic lights still sit over our top-left corner, and there is no
 * longer anywhere to grab to move the window. Both become the job of whatever
 * bar stands at the top of the window, and this is the rule that decides when
 * ({@link windowAreaFor}); the kit's `windowArea` is the one place a bar is
 * told, through the root, so no surface carries the numbers itself.
 *
 * A decision, so it lives here. What the host is comes from the preload bridge
 * (`src/adapters/browser/hostWindow.ts`); what follows from it is arithmetic,
 * and testable in node.
 */

export type WindowChrome = {
  /**
   * How much of the top of the window a full-window page must leave to the
   * shell, in px: the height of the shell's own toolbar, which stays on
   * screen above every page so Documentation, Decisions and Roadmap are one
   * click away from each other. Absent or zero, a page covers the window.
   */
  topInset?: number
  /**
   * Whether the top bar draws Back and Forward (ADR-0033): a window with no
   * browser bar around it has no other Back to press. Never in a browser tab,
   * whose own Back, keys and gestures move the same history — a page that drew
   * a second Back beside the browser's would have two that disagree.
   */
  backForward?: boolean
}

/** A browser tab draws its own frame around us; there, the page owns every pixel. */
export const NO_WINDOW_CHROME: WindowChrome = {}

/**
 * Where the traffic lights end.
 *
 * Three 12px circles 20px apart, and `hiddenInset` pushes them a little further
 * in than a standard title bar does — the last one ends around 78px. The bar
 * adds its own padding after this, which is what keeps a button off them.
 */
const MAC_TRAFFIC_LIGHTS = 78

/** Back and Forward are the bar's on every desktop, because no desktop window has a browser's. */
export function windowChromeFor(host: { desktop: boolean; platform?: string }): WindowChrome {
  return host.desktop ? { backForward: true } : NO_WINDOW_CHROME
}

/**
 * What the bar at the top of the window must do about it: keep `controls` px
 * clear for the window's own buttons, and be what the window is dragged by.
 *
 * Only macOS hands us both jobs: Windows and Linux keep a real title bar, which
 * moves the window itself and covers nothing of ours. In full screen the
 * traffic lights are gone and the window cannot be moved, so neither is asked.
 */
export function windowAreaFor(host: { desktop: boolean; platform?: string; fullScreen?: boolean }): { controls: number; drag: boolean } {
  if (!host.desktop || host.platform !== 'darwin' || host.fullScreen) return { controls: 0, drag: false }
  return { controls: MAC_TRAFFIC_LIGHTS, drag: true }
}
