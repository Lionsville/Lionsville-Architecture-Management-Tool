/**
 * Is there a newer version, and where does this machine get it?
 *
 * The arithmetic of updating, with no network, no dialog and no filesystem in
 * it — so the interesting decisions ("is this actually newer", "which of the
 * eight files on the release page is mine", "has the user said no to this one")
 * are testable in node, and the desktop main process is left with nothing but
 * the fetch and the message box.
 *
 * The mechanism this serves is deliberately the modest one: **look at the
 * `latest` release, tell the user, hand them the file.** It replaced
 * electron-updater's install-in-place, which cannot work on the path most
 * people take on macOS — a DMG dragged into /Applications updates through
 * Squirrel.Mac, which needs the signed zip, a writable bundle and a code
 * signature it can verify, and fails silently when any of the three is missing.
 * A download link works on every platform, always, and asks first.
 */

/** What the user has decided about update checks. Persisted by the desktop. */
export type UpdateSettings = {
  readonly checkAutomatically: boolean
  /**
   * A version the user pressed "Skip this version" on. One version, not a list:
   * skipping is a way of saying "not this one", and the next release is a new
   * question.
   */
  readonly skippedVersion?: string
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = { checkAutomatically: true }

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
    ...(typeof skipped === 'string' && skipped ? { skippedVersion: skipped } : {}),
  }
}

type Version = { readonly numbers: readonly number[]; readonly prerelease: string }

/**
 * `v1.2.3`, `1.2.3-beta.1`, `1.2` — or `undefined` for anything that is not a
 * version at all.
 *
 * Build metadata (`+sha`) is stripped rather than compared, which is what
 * semver says it is for. Missing segments count as zero, so `1.2` and `1.2.0`
 * are the same version.
 */
export function parseVersion(raw: string): Version | undefined {
  const withoutBuild = raw.trim().replace(/^v/i, '').split('+')[0] ?? ''
  const dash = withoutBuild.indexOf('-')
  const core = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash)
  const prerelease = dash === -1 ? '' : withoutBuild.slice(dash + 1)

  const parts = core.split('.')
  if (parts.length === 0 || parts.length > 3) return undefined
  const numbers = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : NaN))
  if (numbers.some(Number.isNaN)) return undefined
  while (numbers.length < 3) numbers.push(0)
  return { numbers, prerelease }
}

/**
 * Is `latest` a version worth telling the user about, given they are running
 * `current`?
 *
 * A release beats a prerelease of the same numbers (1.2.0 > 1.2.0-rc.1), which
 * is semver's rule. Two prereleases of the same numbers are compared as plain
 * strings — cruder than semver, and enough: this app's releases are the `latest`
 * tag, and a prerelease is not one.
 *
 * An unparseable version on either side means "no": a build that cannot say
 * what it is must not be talked into replacing itself.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false

  for (let i = 0; i < 3; i += 1) {
    const left = a.numbers[i] ?? 0
    const right = b.numbers[i] ?? 0
    if (left !== right) return left > right
  }
  if (a.prerelease === b.prerelease) return false
  if (!a.prerelease) return true
  if (!b.prerelease) return false
  return a.prerelease > b.prerelease
}

/** One file on the release page. */
export type ReleaseAsset = { readonly name: string; readonly url: string }

/** A release, reduced to the three things a notice needs. */
export type Release = {
  /** Without the `v`: what gets compared, shown and skipped. */
  readonly version: string
  /** The release page — the honest fallback when no asset matches. */
  readonly pageUrl: string
  /** The installer for this platform, or the page when there isn't one. */
  readonly downloadUrl: string
}

/** The file extension this platform installs from. */
const INSTALLER: Record<string, string> = {
  darwin: '.dmg',
  win32: '.exe',
  // The AppImage and not the .deb: a .deb belongs to the package manager, and
  // handing someone a newer one behind its back is how a system ends up with
  // two of this app.
  linux: '.appimage',
}

/**
 * The words a release file uses for this architecture.
 *
 * More than one per arch because the platforms disagree: electron-builder names
 * the macOS and Windows artifacts `arm64`/`x64`, and the Linux AppImage
 * `x86_64`. Matching on `process.arch` alone finds nothing on Linux.
 */
const ARCH_WORDS: Record<string, readonly string[]> = {
  arm64: ['arm64', 'aarch64'],
  x64: ['x64', 'x86_64', 'amd64'],
  ia32: ['ia32', 'x86', 'i386'],
}

/** Every architecture word, so a filename can be asked whether it names one. */
const ALL_ARCH_WORDS: readonly string[] = Object.values(ARCH_WORDS).flat()

/**
 * The file this machine should download, or `undefined` when the release does
 * not obviously carry one.
 *
 * Deliberately unwilling to guess, in both directions. A file that names this
 * architecture wins. Failing that, a lone candidate is taken only if it names
 * *no* architecture at all — a release with one `…-linux-x86_64.AppImage` in it
 * has nothing to offer an arm64 machine, and handing that user the only file on
 * the shelf gives them a binary that will not run. Two unlabelled candidates are
 * refused for the same reason. The caller then sends them to the release page,
 * where a human reading the filenames beats a rule picking the wrong one.
 */
export function pickDownloadAsset(
  assets: readonly ReleaseAsset[],
  platform: string,
  arch: string,
): ReleaseAsset | undefined {
  const extension = INSTALLER[platform]
  if (!extension) return undefined

  // `.blockmap` sits beside each installer and is not one.
  const candidates = assets.filter((asset) => asset.name.toLowerCase().endsWith(extension))
  if (candidates.length === 0) return undefined

  const words = ARCH_WORDS[arch] ?? [arch]
  const matched = candidates.find((asset) =>
    words.some((word) => asset.name.toLowerCase().includes(word)))
  if (matched) return matched

  const only = candidates.length === 1 ? candidates[0] : undefined
  if (!only) return undefined
  const namesSomeoneElse = ALL_ARCH_WORDS.some((word) => only.name.toLowerCase().includes(word))
  return namesSomeoneElse ? undefined : only
}

/**
 * A GitHub `releases/latest` payload, reduced to a {@link Release}.
 *
 * Everything is checked rather than trusted: this is the one JSON document in
 * the app that comes off the network, and the URL it yields is about to be
 * opened in the user's browser. A payload that is not a release — an API error,
 * a rate-limit body, a proxy's login page — must produce `undefined` and not a
 * link.
 */
export function readRelease(payload: unknown, platform: string, arch: string): Release | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const raw = payload as Record<string, unknown>

  const tag = raw['tag_name']
  const pageUrl = raw['html_url']
  if (typeof tag !== 'string' || typeof pageUrl !== 'string') return undefined
  if (!isHttps(pageUrl)) return undefined
  if (!parseVersion(tag)) return undefined

  const assets: ReleaseAsset[] = Array.isArray(raw['assets'])
    ? raw['assets'].flatMap((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return []
        const asset = entry as Record<string, unknown>
        const name = asset['name']
        const url = asset['browser_download_url']
        if (typeof name !== 'string' || typeof url !== 'string' || !isHttps(url)) return []
        return [{ name, url }]
      })
    : []

  return {
    version: tag.replace(/^v/i, ''),
    pageUrl,
    downloadUrl: pickDownloadAsset(assets, platform, arch)?.url ?? pageUrl,
  }
}

/** `https:` and nothing else — a `javascript:` URL must never reach `openExternal`. */
function isHttps(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Should the user be told about this release?
 *
 * `skipped` is left out on a check the user asked for by hand: having pressed
 * "Check for Updates…" is a clearer statement than having pressed "Skip" a
 * fortnight ago, and otherwise the menu item would answer "you are up to date"
 * about a version the user can see on the release page.
 */
export function updateAvailable(
  release: Release | undefined,
  currentVersion: string,
  settings: Pick<UpdateSettings, 'skippedVersion'>,
): release is Release {
  if (!release) return false
  if (settings.skippedVersion === release.version) return false
  return isNewerVersion(release.version, currentVersion)
}

/**
 * Whether this process should talk to the release page at all.
 *
 * Three different questions, and getting any of them wrong is invisible: a dev
 * run has no version to compare against, and a smoke run that reaches the
 * network turns a deterministic gate into a flaky one — worse, it can raise a
 * dialog in front of the window the smoke is photographing.
 *
 * `LVARCH_NO_UPDATE` is the escape hatch for the third case: a machine that
 * must not phone home, or a locally packaged build being tested against a
 * release that is newer than it.
 *
 * `LVARCH_UPDATE_CHECK` is the opposite, and it exists so this feature can be
 * looked at. Without it the notice is reachable only from an installed build,
 * which means the only way to see whether the dialog is right is to cut a
 * release — the one loop in this repository that costs twenty minutes and a
 * notarization. A dev run with the variable set does the real check against the
 * real release page. `--smoke` still wins over it: a deterministic gate must
 * stay deterministic however the environment is set.
 */
export function shouldCheckForUpdates(
  packaged: boolean,
  argv: readonly string[],
  env: Record<string, string | undefined>,
): boolean {
  if (env['LVARCH_NO_UPDATE']) return false
  if (argv.includes('--smoke')) return false
  if (env['LVARCH_UPDATE_CHECK']) return true
  return packaged
}
