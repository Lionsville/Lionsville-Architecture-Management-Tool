/**
 * How much of the top bar belongs to the window rather than to the app.
 *
 * The desktop build hides the macOS title bar (`titleBarStyle: 'hiddenInset'`,
 * `electron/main/index.ts`) so the app starts at the top of the window instead
 * of under a strip of grey. Hiding it does not remove the two jobs it was
 * doing: the traffic lights still sit over our top-left corner, and there is no
 * longer anywhere to grab to move the window. Both become the top bar's
 * problem, and this is the rule that decides when.
 *
 * A decision, so it lives here. What the host is comes from the preload bridge
 * (`src/adapters/browser/hostWindow.ts`); what follows from it is arithmetic,
 * and testable in node.
 */

export type WindowChrome = {
  /**
   * Space to keep clear at the start of the top bar, in px, for window controls
   * the host draws on top of it.
   */
  controlsInset: number
  /** Whether the top bar must double as the handle that moves the window. */
  draggable: boolean
}

/** A browser tab draws its own frame around us; there, the page owns every pixel. */
export const NO_WINDOW_CHROME: WindowChrome = { controlsInset: 0, draggable: false }

/**
 * Where the traffic lights end.
 *
 * Three 12px circles 20px apart, and `hiddenInset` pushes them a little further
 * in than a standard title bar does — the last one ends around 78px. The bar
 * adds its own padding after this, which is what keeps a button off them.
 */
const MAC_TRAFFIC_LIGHTS = 78

/**
 * Windows and Linux keep a real title bar, which moves the window itself and
 * covers nothing of ours: only macOS hands us both jobs.
 */
export function windowChromeFor(host: { desktop: boolean; platform?: string }): WindowChrome {
  if (!host.desktop || host.platform !== 'darwin') return NO_WINDOW_CHROME
  return { controlsInset: MAC_TRAFFIC_LIGHTS, draggable: true }
}
