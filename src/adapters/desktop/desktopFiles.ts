/**
 * Is there a desktop under us, and does it offer files?
 *
 * The preload puts `files` on `window.desktop` and a browser tab has no such
 * object, which is the whole test — the same one `hostWindow.ts` makes for the
 * window chrome. Reading a global is why this sits in an adapter; what to DO
 * about the answer is `app/composition.ts`.
 */
import type { DesktopFiles } from './channel'

export function desktopFiles(): DesktopFiles | undefined {
  return (window as unknown as { desktop?: { files?: DesktopFiles } }).desktop?.files
}
