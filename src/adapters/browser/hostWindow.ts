// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the window around us is.
 *
 * The desktop preload exposes two facts on `window.desktop` and nothing else
 * (`electron/preload/index.ts`); in a browser tab that object is simply absent,
 * which is the whole test. Reading a global is why this sits in an adapter —
 * the rule that follows from the answer lives in `core/windowChrome.ts`.
 */
import { windowAreaFor, windowChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { windowTitleFor } from '../../platform/windowTitle'
import type { DesktopWindow } from '../desktop/channel'

type DesktopHost = { platform?: string; window?: DesktopWindow }

function desktopHost(): DesktopHost | undefined {
  return (window as unknown as { desktop?: DesktopHost }).desktop
}

export function hostWindowChrome(): WindowChrome {
  return windowChromeFor({ desktop: Boolean(desktopHost()) })
}

/** What the window asks of the bar at its top, and the root it is said on. */
export type ShowWindowArea = (root: HTMLElement, area: { controls: number; drag: boolean }) => void

/**
 * Say what the window asks of the page's top bar now, and again whenever it
 * goes into full screen or comes out (`platform/windowChrome.ts`'s
 * `windowAreaFor`). A browser tab is said once, as asking nothing.
 */
export function watchWindowArea(show: ShowWindowArea): () => void {
  const desktop = desktopHost()
  const root = document.documentElement
  const say = (fullScreen: boolean) => show(root, windowAreaFor({ desktop: Boolean(desktop), platform: desktop?.platform, fullScreen }))
  say(false)
  const facts = desktop?.window
  if (!facts) return () => undefined
  // A page loaded into a window already in full screen; nothing to say if main cannot tell.
  facts.isFullScreen().then(say, () => undefined)
  return facts.onFullScreen(say)
}

/**
 * What the window is called: the scope you are in, and the product.
 *
 * The page's own title, which is the one mechanism both hosts already have —
 * a browser tab shows it in the tab strip, and Electron reads it off the page
 * rather than needing to be told. Writing it is a browser global, which is why
 * it lives here and the sentence it writes lives in `platform/windowTitle.ts`.
 */
export function showWindowTitle(organisation: string, scope?: string, here?: string, before?: string): void {
  document.title = windowTitleFor(organisation, scope, here, before)
}
