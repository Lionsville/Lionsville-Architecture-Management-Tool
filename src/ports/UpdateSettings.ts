/**
 * Where "check for updates automatically" is kept (ADR-0005).
 *
 * A separate seam from `PreferencesStore` on purpose, and not a compromise:
 * the desktop's main process must read this before any window exists, so it
 * keeps the file, and a preferences blob the renderer reads before its first
 * render cannot be the same file. The dialog is a client of both — one face,
 * two sources — and this is the second source's shape.
 *
 * Absent on a shell that has no host to ask (a browser tab), the way
 * `history?` is, rather than a store that answers "no".
 */
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'

export interface UpdateSettingsStore {
  readonly id: string
  read(): Promise<UpdateSettings>
  /** Change some of it. The host reacts at once — a timer starts or stops. */
  write(patch: UpdateSettingsPatch): Promise<UpdateSettings>
}
