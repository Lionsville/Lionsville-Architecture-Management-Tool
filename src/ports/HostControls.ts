/**
 * The two things a crash page can offer: start again, and hand over the trail.
 *
 * Small enough to look like it does not need a seam, and it is here for the
 * same reason as the others: `location.reload()` and `navigator.clipboard` are
 * the outside world, and the crash fallback is a component — one that has to be
 * renderable in a test on the day it matters most. Behind this the desktop can
 * later reload a `BrowserWindow` and write to Electron's own clipboard without
 * the fallback knowing.
 */
export interface HostControls {
  readonly id: string

  /** Load the app again from scratch. */
  reload(): void

  /** Put text on the clipboard. Rejects if the host refuses. */
  copyText(text: string): Promise<void>
}
