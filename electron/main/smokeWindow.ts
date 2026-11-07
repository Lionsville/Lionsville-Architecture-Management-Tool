// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The smoke run's window: never shown, so the run neither interrupts anybody
 * nor depends on what they do meanwhile.
 *
 * A page whose window is shown and then covered, minimised or behind a locked
 * screen is hidden: Chromium stops its frames, and a capture waits on a frame
 * (`html-to-image`, `painted()`). A window never shown has never been hidden:
 * its page is visible and draws at the display's rate, so the export, the
 * agent's picture and every wait on a frame run as they do on a screen, and
 * the same whatever the person at the machine is doing.
 *
 * What that leaves out is the moment the window reaches the screen, which is
 * why the run still waits for `ready-to-show` — the first paint a person's
 * window is shown on — and why {@link SMOKE_SHOWN} runs it in a real window.
 *
 * Nothing here applies without `--smoke`: a person's window is always shown.
 */

/** What runs the smoke in a window that is shown and comes to the front, as a person's does. */
export const SMOKE_SHOWN = 'LVARCH_SMOKE_SHOWN'

/** Whether a window is shown once it has something to show. */
export function showsWindow(unattended: boolean, env: NodeJS.ProcessEnv): boolean {
  return !unattended || env[SMOKE_SHOWN] === '1'
}

/** What the page answered about itself when a step failed; nothing at all if it did not answer. */
export type PageState = {
  visibility: string
  /** Whether a frame was drawn while it was asked. */
  frames: boolean
}

/** What a page is asked when a step failed: its visibility, and whether a frame comes within a second. */
export const PAGE_STATE_SCRIPT = `(async () => ({
  visibility: document.visibilityState,
  frames: await Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 1000)),
  ]),
}))()`

/**
 * What a failed step adds about the window, so a red run says at a glance
 * whether the machine or the code stopped it. A wait on a frame in a hidden
 * window does not fail, it just never ends, and a bare timeout reads the same
 * as a hang in the code.
 */
export function windowSays(state: PageState | undefined): string {
  if (!state) return 'the page did not answer when asked how it stood: the renderer is stuck or gone'
  if (state.visibility === 'hidden') {
    return 'the window was hidden, so the page drew no frames and nothing waiting on one could finish: this is the machine, not the code'
  }
  if (!state.frames) {
    return `the page says it is ${state.visibility} but drew no frame within a second: a stopped display or a busy renderer, not a hidden window`
  }
  return `the page was ${state.visibility} and drawing frames, so a hidden window did not cause this`
}
