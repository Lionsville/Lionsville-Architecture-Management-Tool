/**
 * What the window around us is.
 *
 * The desktop preload exposes two facts on `window.desktop` and nothing else
 * (`electron/preload/index.ts`); in a browser tab that object is simply absent,
 * which is the whole test. Reading a global is why this sits in an adapter —
 * the rule that follows from the answer lives in `core/windowChrome.ts`.
 */
import { windowChromeFor } from '../../core/windowChrome'
import type { WindowChrome } from '../../core/windowChrome'

type DesktopHost = { platform?: string }

export function hostWindowChrome(): WindowChrome {
  const desktop = (window as unknown as { desktop?: DesktopHost }).desktop
  return windowChromeFor({ desktop: Boolean(desktop), platform: desktop?.platform })
}
