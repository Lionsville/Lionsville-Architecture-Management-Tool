/**
 * What the window around us is.
 *
 * The desktop preload exposes two facts on `window.desktop` and nothing else
 * (`electron/preload/index.ts`); in a browser tab that object is simply absent,
 * which is the whole test. Reading a global is why this sits in an adapter —
 * the rule that follows from the answer lives in `core/windowChrome.ts`.
 */
import { windowChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { windowTitleFor } from '../../platform/windowTitle'

type DesktopHost = { platform?: string }

export function hostWindowChrome(): WindowChrome {
  const desktop = (window as unknown as { desktop?: DesktopHost }).desktop
  return windowChromeFor({ desktop: Boolean(desktop), platform: desktop?.platform })
}

/**
 * What the window is called: the scope you are in, and the product.
 *
 * The page's own title, which is the one mechanism both hosts already have —
 * a browser tab shows it in the tab strip, and Electron reads it off the page
 * rather than needing to be told. Writing it is a browser global, which is why
 * it lives here and the sentence it writes lives in `platform/windowTitle.ts`.
 */
export function showWindowTitle(organisation: string, scope?: string): void {
  document.title = windowTitleFor(organisation, scope)
}
