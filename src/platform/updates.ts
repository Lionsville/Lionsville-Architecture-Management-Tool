// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Is there a newer version, and where does this machine get it?
 *
 * The arithmetic of updating, with no network, no dialog and no filesystem in
 * it — so the interesting decisions ("is this actually newer", "which of the
 * eight files on the release page is mine", "has the user said no to this one")
 * are testable in node, and the desktop main process is left with nothing but
 * the fetch and the message box.
 *
 * Two mechanisms are served, and which one runs is decided by the build rather
 * than by the machine (ADR-0030):
 *
 * - **With no feed registered**, the modest one: **look at the `latest`
 *   release, tell the user, hand them the file.** It replaced electron-updater's
 *   install-in-place, which could not work on the path most people took — it
 *   downloaded before asking, and staged an install for a quit that closing
 *   the window never is. A download link works on every platform, always, and
 *   asks first.
 * - **With a feed registered** by a build composed from this one, install in
 *   place again, consent first: ask, download with progress, then *Restart to
 *   update*. Whether this copy can replace itself at all is decided here
 *   (`selfReplacement`) before anything is offered, and where it cannot, the
 *   first mechanism's notice is what the person gets, pointed at the feed's
 *   page.
 */

import type { UpdateSettings } from './updateSettings'

/**
 * The settings themselves are `updateSettings.ts` beside this file, where both
 * processes read them (ADR-0005). Re-exported so the arithmetic and the shape
 * are still one import for main.
 */
export { DEFAULT_UPDATE_SETTINGS, readUpdateSettings } from './updateSettings'
export type { UpdateSettings } from './updateSettings'

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

/**
 * A GitHub `releases` list, reduced to the newest release in it (ADR-0006).
 *
 * The beta channel's request. Drafts are skipped and prereleases are not:
 * the newest release of any kind is the answer, so a stable release that
 * follows a beta reaches the people on the beta channel too. Newest by
 * version, not by position — GitHub lists newest first, but "newest" here is
 * a fact about the tags and not about the order somebody published in. Every
 * entry is checked the way a single payload is; an entry that is not a
 * release is skipped rather than trusted, and a payload that is not a list
 * is nothing.
 */
export function readNewestRelease(payload: unknown, platform: string, arch: string): Release | undefined {
  if (!Array.isArray(payload)) return undefined
  let newest: Release | undefined
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object' || (entry as Record<string, unknown>)['draft'] === true) continue
    const release = readRelease(entry, platform, arch)
    if (!release) continue
    if (!newest || isNewerVersion(release.version, newest.version)) newest = release
  }
  return newest
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

/**
 * Whether this build OFFERS to check for updates: the menu item, and the switch
 * in the preferences dialog.
 *
 * Deliberately narrower than {@link shouldCheckForUpdates}, which also answers
 * no to a development run and to a smoke run. Those two are about not reaching
 * the network *by itself* — a dev build has no version to compare and a smoke
 * run must stay deterministic — and checking by hand is exactly what is worth
 * keeping there: it is how the feature can be looked at at all, and it is the
 * point of an off switch that the manual check still works.
 *
 * `LVARCH_NO_UPDATE` is the one that means updates are not this build's
 * business: a machine that must not phone home, or **a build composed from this
 * one that keeps its own updates** — where this app's release page is not where
 * its versions come from, and an item that reaches it would answer a question
 * nobody asked about a product nobody is running. A build that publishes its
 * versions as a feed registers the feed instead (ADR-0030), and then the item
 * and the switch are about that feed.
 */
export function offersUpdateCheck(env: Record<string, string | undefined>): boolean {
  return !env['LVARCH_NO_UPDATE']
}

/**
 * The update settings as a process that does not offer updates may answer them.
 *
 * Nothing in such a process ever asks the release page anything, so *Check
 * automatically* ticked in the dialog would be a switch with no engine behind
 * it — a promise of a check that will never happen, which is worse than the
 * honest no. What is kept on disk is deliberately left as it is: it is the
 * answer for a build that does check, and one that checks nothing has no
 * business rewriting it.
 */
export function updateSettingsFor(kept: UpdateSettings, checks: boolean): UpdateSettings {
  return checks ? kept : { ...kept, checkAutomatically: false }
}

/**
 * Where a build composed from this one publishes its own versions, for the
 * desktop to update itself from (ADR-0030).
 *
 * The shape `electron/main/updates.ts` exports as `UpdateFeed`, said once here
 * so that what a registration must look like is tested in node beside the
 * rest of the arithmetic.
 */
export type UpdateFeedShape = {
  /** Base URL of an electron-builder generic feed: the `latest*.yml` manifests and the files they name. */
  readonly url: string
  /** The page a person downloads the app from by hand: the fallback wherever the app cannot replace itself. */
  readonly page: string
}

/**
 * What is wrong with a feed a build tried to register, or `undefined` when
 * nothing is.
 *
 * `https:` for both, and nothing else. The manifest names the file this app is
 * about to install over itself, and the page is about to be opened in the
 * person's browser: a plain-`http` feed is one anybody on the network between
 * here and there can answer, and a `javascript:` page must never reach
 * `openExternal`. A sentence rather than a key, because the only reader is
 * whoever composed the build, at the moment the registration throws.
 */
export function updateFeedProblem(feed: UpdateFeedShape): string | undefined {
  if (!isHttps(feed.url)) return `the update feed's url must be an https: URL, not '${feed.url}'`
  if (!isHttps(feed.page)) return `the update feed's page must be an https: URL, not '${feed.page}'`
  return undefined
}

/**
 * Should the person be offered the version a feed's manifest names?
 *
 * The same answer `updateAvailable` gives about a release, plus the one thing a
 * feed does not say for itself: whether a version is a prerelease that only
 * the beta channel counts (ADR-0006). A GitHub release carries that flag and
 * the stable request leaves prereleases out; a feed has one manifest per
 * platform and whatever its publisher put in it, so the channel is applied
 * here, to the version string, and a stable install is never talked into a
 * beta because somebody published one to the same place.
 *
 * `manual` ignores a skipped version, for the reason `updateAvailable` gives.
 */
export function feedUpdateAvailable(
  version: string | undefined,
  currentVersion: string,
  settings: Pick<UpdateSettings, 'skippedVersion' | 'channel'>,
  manual: boolean,
): version is string {
  if (!version) return false
  const parsed = parseVersion(version)
  if (!parsed) return false
  if (parsed.prerelease && settings.channel !== 'beta') return false
  if (!manual && settings.skippedVersion === version) return false
  return isNewerVersion(version, currentVersion)
}

/** What main can tell about where this copy is running from, for `selfReplacement`. */
export type Installation = {
  /** `process.platform`. */
  readonly platform: string
  /** `app.isPackaged`: a development run has nothing to replace. */
  readonly packaged: boolean
  /** `process.execPath`: on macOS, the binary inside the bundle. */
  readonly executable: string
  /** macOS: may this user write the folder the `.app` sits in? */
  readonly installWritable: boolean
  /** The environment; on Linux `APPIMAGE` says the app is one. */
  readonly env: Record<string, string | undefined>
}

/** Why a copy cannot replace itself, each of which the notice says in its own words. */
export type NotInPlace =
  /** A development run: there is no installed app to replace. */
  | 'development'
  /** macOS: running straight from the disk image, which is read-only. */
  | 'mountedVolume'
  /** macOS: Gatekeeper's randomised read-only copy of an app that was never moved. */
  | 'translocated'
  /** macOS: the folder the app sits in is not this user's to write. */
  | 'notWritable'
  /** Linux: installed by the package manager, whose business an upgrade is. */
  | 'packageManager'
  /** A platform nothing here knows how to update. */
  | 'platform'

export type SelfReplacement =
  | { readonly possible: true }
  | { readonly possible: false; readonly because: NotInPlace }

/**
 * The `.app` a macOS executable belongs to (`…/Name.app/Contents/MacOS/Name`),
 * or `undefined` when it is not inside one.
 */
export function macBundleOf(executable: string): string | undefined {
  const at = executable.lastIndexOf('.app/Contents/MacOS/')
  return at === -1 ? undefined : executable.slice(0, at + '.app'.length)
}

/**
 * Can this copy replace itself where it is, so that *Download and install* is
 * a promise it can keep?
 *
 * Decided before anything is offered, because the failure it prevents is the
 * one that made the self-updater go the first time: an install that fails
 * with a line on stderr and nothing on screen, after the person agreed to it.
 *
 * - **macOS** updates through Squirrel.Mac, which swaps the bundle and needs to
 *   write where it sits. A copy run from the disk image (`/Volumes/…`) is on a
 *   read-only volume; a copy run from Downloads without being moved is
 *   *translocated* — Gatekeeper runs it from a randomised read-only path with
 *   `/AppTranslocation/` in it; and a copy in a folder this user cannot write,
 *   /Applications for a standard account among them, cannot be swapped either.
 *   Being in an Applications folder is not enough on its own, for that last
 *   reason.
 * - **Windows** always can: the NSIS installer runs again over the install,
 *   asking for elevation itself where the install was per-machine.
 * - **Linux** only as an AppImage, which says so in `APPIMAGE`. A `.deb` belongs
 *   to the package manager, and an upgrade behind its back is how a system ends
 *   up with two of this app.
 */
export function selfReplacement(install: Installation): SelfReplacement {
  if (!install.packaged) return { possible: false, because: 'development' }
  switch (install.platform) {
    case 'darwin': {
      const bundle = macBundleOf(install.executable) ?? install.executable
      if (bundle.startsWith('/Volumes/')) return { possible: false, because: 'mountedVolume' }
      if (bundle.includes('/AppTranslocation/')) return { possible: false, because: 'translocated' }
      if (!install.installWritable) return { possible: false, because: 'notWritable' }
      return { possible: true }
    }
    case 'win32':
      return { possible: true }
    case 'linux':
      return install.env['APPIMAGE'] ? { possible: true } : { possible: false, because: 'packageManager' }
    default:
      return { possible: false, because: 'platform' }
  }
}
