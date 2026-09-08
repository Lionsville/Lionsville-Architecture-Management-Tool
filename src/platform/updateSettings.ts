/**
 * What the user has decided about update checks.
 *
 * Down here because two processes read it: main keeps the file (it is read
 * before any window exists, and before a folder has been chosen) and the
 * preferences dialog in the renderer is a client of it over `DesktopSettings`
 * (ADR-0005). The arithmetic of updating — is this newer, which file is mine —
 * is `updates.ts` beside it, for the same reason.
 */
/**
 * Which releases count (ADR-0006). `stable` is GitHub's `latest`: the newest
 * release that is not a prerelease. `beta` is the newest release of any kind,
 * so a beta user is told about the stable that follows a beta too.
 */
export type UpdateChannel = 'stable' | 'beta'

export type UpdateSettings = {
  readonly checkAutomatically: boolean
  readonly channel: UpdateChannel
  /**
   * A version the user pressed "Skip this version" on. One version, not a list:
   * skipping is a way of saying "not this one", and the next release is a new
   * question. Bookkeeping, not a preference: the dialog leaves it alone.
   */
  readonly skippedVersion?: string
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = { checkAutomatically: true, channel: 'stable' }

/** What the dialog may change. The skipped version is not a preference. */
export type UpdateSettingsPatch = Partial<Pick<UpdateSettings, 'checkAutomatically' | 'channel'>>

/**
 * The settings out of whatever was on disk.
 *
 * Checking is on unless the file says otherwise, so a corrupt, empty or
 * hand-edited file fails towards being told about security fixes rather than
 * away from it.
 */
export function readUpdateSettings(stored: unknown): UpdateSettings {
  if (!stored || typeof stored !== 'object') return DEFAULT_UPDATE_SETTINGS
  const raw = stored as Record<string, unknown>
  const skipped = raw['skippedVersion']
  return {
    checkAutomatically: raw['checkAutomatically'] !== false,
    // Anything but the one word that opts in reads as stable.
    channel: raw['channel'] === 'beta' ? 'beta' : 'stable',
    ...(typeof skipped === 'string' && skipped ? { skippedVersion: skipped } : {}),
  }
}
