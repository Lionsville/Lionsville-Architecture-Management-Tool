// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Staying current, two ways, and which one is decided by the build (ADR-0030).
 *
 * **With no feed registered** — this repository's own build, and anybody's
 * build from its source: ask the release page, tell the user, hand them the
 * file. This used to be `electron-updater`'s `checkForUpdatesAndNotify()` —
 * download in the background, swap in on quit, no dialog — and it went,
 * because on the path most people actually took it never completed:
 *
 * - **macOS.** A DMG dragged into /Applications updates through Squirrel.Mac,
 *   which reads the *zip*, verifies the code signature of the running app, and
 *   needs the bundle to be writable. Miss any of the three and it fails with a
 *   line on stderr and nothing on screen. And the install it stages happens on
 *   **quit** — which on macOS is not what closing the window does, so an app
 *   that is only ever closed and reopened never installs anything.
 * - **Everywhere.** It downloaded ~100 MB before asking whether anyone wanted
 *   it, and the user's only signal was an OS notification they may not see.
 *
 * What replaced it is smaller and works the same on all three platforms: read
 * the `latest` release, compare the version, and if it is newer put a dialog up
 * with a Download button that opens the installer in the browser. The user
 * installs it the way they installed this one. Nothing is fetched, staged or
 * replaced behind their back.
 *
 * **With a feed registered** (`registerUpdateFeed`) — a build composed from
 * this one that is signed, notarized and published with the update manifests —
 * the app replaces itself again, and every one of the reasons above is
 * answered rather than ignored: the build is signed and notarized, the zip is
 * still built, nothing is downloaded before the person says so, and the end of
 * it is *Restart Now* rather than a quit that may never come. Before any of it
 * is offered, `selfReplacement` asks whether this copy can be replaced where it
 * runs at all — not from the disk image, not translocated, not in a folder this
 * user cannot write, not a `.deb` — and where it cannot, or where anything
 * fails, the person gets the first mechanism's notice, pointed at the feed's
 * download page.
 *
 * The decisions live in `src/platform/updates.ts` and are tested there; this file is
 * the fetch, the file and the message box.
 *
 * **The strings here are English only, deliberately.** Every other string in
 * this app comes from the i18n tables, but those are the renderer's and this
 * process has no way to know which language the renderer settled on — that
 * needs an IPC channel and a typed contract. A native dialog in English is the
 * price of not building one yet; when the file channel arrives, this notice
 * should move into the shell with the rest of the UI.
 */
import { app, BrowserWindow, dialog, ipcMain, net, shell } from 'electron'
import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron'
import type { AppUpdater, ProgressInfo } from 'electron-updater'
import { constants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_UPDATE_SETTINGS,
  feedUpdateAvailable,
  macBundleOf,
  readNewestRelease,
  readRelease,
  readUpdateSettings,
  selfReplacement,
  shouldCheckForUpdates,
  updateAvailable,
  updateFeedProblem,
  updateSettingsFor,
} from '../../src/platform/updates'
import type { Installation, NotInPlace, Release, UpdateSettings } from '../../src/platform/updates'
import type { UpdateSettingsPatch } from '../../src/platform/updateSettings'
import { writeWhole } from './fileStore'

/**
 * Where a build composed from this one publishes its own versions (ADR-0030).
 *
 * Registered by that build's entry, before `app.whenReady`, with
 * `registerUpdateFeed`. With none registered, the app asks this repository's
 * release page and hands the person the file, as it always has.
 */
export type UpdateFeed = {
  /** Base URL of an electron-builder generic feed: latest-mac.yml, latest.yml, latest-linux.yml and the files they name. */
  readonly url: string
  /** The page a person downloads the app from by hand: the fallback wherever the app cannot replace itself. */
  readonly page: string
}

/**
 * Where the releases are, for a build with no feed: this repository's release
 * page, which carries the source and the web build of every version.
 */
const OWNER = 'Lionsville'
const REPO = 'Lionsville-Architecture-Management-Tool'
const RELEASES = `https://api.github.com/repos/${OWNER}/${REPO}/releases`
/** Stable: GitHub's own idea of the newest non-prerelease. */
const LATEST_RELEASE = `${RELEASES}/latest`
/**
 * Beta (ADR-0006): the newest few of any kind, reduced to the newest by
 * version. Ten is a bound, not a promise — GitHub lists newest first.
 */
const RECENT_RELEASES = `${RELEASES}?per_page=10`

/**
 * Six hours. Long enough to be invisible, short enough that a machine left on
 * over a weekend does not miss a release. The first check is immediate.
 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/** A check that never answers must not hold up a quit or leak a timer. */
const REQUEST_TIMEOUT_MS = 15_000

/** Beside the preferences, not in them: this one is read before any window exists. */
const settingsPath = (): string => join(app.getPath('userData'), 'update-settings.json')

let settings: UpdateSettings = DEFAULT_UPDATE_SETTINGS

/**
 * The newest release we know is newer than us and that the user has not yet
 * dealt with. It is what makes the quit-time notice possible without a network
 * call: quitting must not wait on a request, so the answer has to be one we
 * already have.
 */
let pending: Release | undefined

/** The sentence a fallback from the feed put first, so asking again on the way out says it again. */
let pendingWhy: string | undefined

/** So the quit notice does not open a second dialog on top of the first. */
let showing = false

/** So `app.quit()` from inside the quit notice is not intercepted by it again. */
let quitting = false

let timer: NodeJS.Timeout | undefined

/** Whether this process talks to the release page at all; see `startUpdates`. */
let checking = false

/** The feed a build registered, or none: which of the two mechanisms runs. */
let feed: UpdateFeed | undefined

/** So a feed registered after the updates started is refused rather than half-used. */
let started = false

/**
 * Where an update from the feed has got to. `downloading` and `ready` are
 * both after the person said yes, which is why a failure in either of them is
 * said out loud and a failure before them is only written down.
 */
type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'downloading'; readonly version: string }
  | { readonly kind: 'ready'; readonly version: string }

let stage: Stage = { kind: 'idle' }

/** electron-updater's updater, set up on the first check against a feed and never before. */
let updater: AppUpdater | undefined

function log(message: string): void {
  process.stderr.write(`update: ${message}\n`)
}

async function loadSettings(): Promise<void> {
  try {
    settings = readUpdateSettings(JSON.parse(await readFile(settingsPath(), 'utf8')))
  } catch {
    // No file yet, or an unreadable one. The defaults say "check", which is the
    // right way for this to fail.
    settings = DEFAULT_UPDATE_SETTINGS
  }
}

async function saveSettings(next: UpdateSettings): Promise<void> {
  settings = next
  try {
    await writeWhole(settingsPath(), `${JSON.stringify(next, undefined, 2)}\n`)
  } catch (error) {
    log(`could not save settings: ${String(error)}`)
  }
}

/**
 * The newest release the channel counts, or `undefined` for every way that
 * can fail.
 *
 * `net.fetch` rather than the global one so the request goes through Chromium's
 * network stack, and therefore through the system proxy and its certificates —
 * which on a managed laptop is the difference between working and timing out.
 */
async function fetchLatest(): Promise<Release | undefined> {
  try {
    const beta = settings.channel === 'beta'
    const response = await net.fetch(beta ? RECENT_RELEASES : LATEST_RELEASE, {
      headers: {
        Accept: 'application/vnd.github+json',
        // GitHub rejects an API request without one.
        'User-Agent': `${app.getName()}/${app.getVersion()}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      log(`release check returned ${response.status}`)
      return undefined
    }
    const payload: unknown = await response.json()
    return beta
      ? readNewestRelease(payload, process.platform, process.arch)
      : readRelease(payload, process.platform, process.arch)
  } catch (error) {
    // A release page that cannot be reached is not a reason to interrupt
    // someone drawing a diagram. It is written down and tried again later.
    log(`release check failed: ${String(error)}`)
    return undefined
  }
}

/** A message box on the window when there is one, and on its own when there is not. */
async function ask(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
  const parent = BrowserWindow.getAllWindows()[0]
  return parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options)
}

/** The checkbox every offer carries, kept the way the preferences dialog keeps it. */
async function keepCheckbox(checked: boolean): Promise<void> {
  if (checked === settings.checkAutomatically) return
  await saveSettings({ ...settings, checkAutomatically: checked })
  if (checked) schedule()
  else stop()
}

/**
 * The dialog that hands the person the file. Returns once the user has
 * answered it.
 *
 * `why` is the sentence that comes first where this is a fallback from a feed
 * — this copy cannot replace itself, or replacing it failed — so the person is
 * told why they are being sent to a page when the app updates itself for
 * everybody else.
 */
async function notify(release: Release, why?: string): Promise<void> {
  if (showing) return
  showing = true
  pendingWhy = why
  try {
    const answer = await ask({
      type: 'info',
      title: 'Update available',
      message: `Version ${release.version} is available.`,
      detail:
        (why ? `${why} ` : '') +
        `You are running ${app.getVersion()}. Downloading opens ${why ? 'the download page' : 'the installer'} ` +
        'in your browser; install it the way you installed this one.',
      buttons: ['Download…', 'Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
      checkboxLabel: 'Check for updates automatically',
      checkboxChecked: settings.checkAutomatically,
      noLink: true,
    })

    await keepCheckbox(answer.checkboxChecked)

    if (answer.response === 0) {
      pending = undefined
      await shell.openExternal(release.downloadUrl)
    } else if (answer.response === 2) {
      pending = undefined
      await saveSettings({ ...settings, skippedVersion: release.version })
    }
    // "Later" leaves `pending` where it is, which is the whole point of asking
    // again on the way out.
  } finally {
    showing = false
  }
}

/**
 * One check.
 *
 * `manual` is the menu item, and it differs in two ways: it ignores a version
 * the user once skipped — pressing "Check for Updates…" is a clearer statement
 * than a "Skip" from a fortnight ago — and it says something when the answer is
 * no, because a menu item that does nothing visible looks broken.
 */
async function check(manual: boolean): Promise<void> {
  if (feed) {
    await checkFeed(feed, manual)
    return
  }
  const release = await fetchLatest()

  // Said out loud, and not only when it fails. A check that reports nothing on
  // the happy path is indistinguishable from one that never ran, which is
  // exactly the hole the old updater left: "it does not update" and "it decided
  // not to" looked the same from outside the process.
  log(release
    ? `latest is ${release.version}, running ${app.getVersion()} (${release.downloadUrl})`
    : 'no release could be read')

  if (updateAvailable(release, app.getVersion(), manual ? {} : settings)) {
    pending = release
    await notify(release)
    return
  }

  if (!manual) return
  await ask(release ? upToDate() : {
    type: 'warning',
    title: 'Could not check for updates',
    message: 'The release page could not be reached.',
    detail: 'Check your connection and try again.',
    buttons: ['OK'],
  })
}

/** What a check by hand says when there is nothing newer, from either mechanism. */
function upToDate(): MessageBoxOptions {
  return {
    type: 'info',
    title: 'No update available',
    message: 'You are up to date.',
    detail: `Version ${app.getVersion()} is the latest version.`,
    buttons: ['OK'],
  }
}

/**
 * Updates from a feed, for a build composed from this one. Once, and before
 * `app.whenReady`; a second call throws, and so does one after the updates
 * have started, because either would leave a build checking somewhere other
 * than where it believes it checks. A feed that is not `https:` throws too
 * (`updateFeedProblem`).
 *
 * Importing this file does nothing, and registering a feed only remembers it:
 * electron-updater is loaded on the first check against the feed, so a build
 * with no feed never loads it at all.
 */
export function registerUpdateFeed(next: UpdateFeed): void {
  if (feed) throw new Error('an update feed is already registered: a build has one place its versions come from')
  if (started) throw new Error('the update feed was registered after the updates started: register it before app.whenReady')
  const problem = updateFeedProblem(next)
  if (problem) throw new Error(problem)
  feed = { url: next.url, page: next.page }
}

/**
 * electron-updater, set up for this feed and for asking first.
 *
 * `autoDownload` off is the consent: nothing is fetched until the person
 * presses *Download and Install*. `autoInstallOnAppQuit` off until then as well,
 * so nothing is staged for a quit either; `download` turns it on once they
 * agreed, which is what makes *Later* on the last dialog mean "at the next
 * quit". A development run is let through the library's own check
 * (`forceDevUpdateConfig`), so `LVARCH_UPDATE_CHECK` shows the dialogs against
 * the real feed; `selfReplacement` then sends it to the page, because a
 * development run has nothing to replace.
 *
 * The library's `error` event is listened to because an event emitter with an
 * `error` nobody hears throws it; it is written down, and after the person said
 * yes it is also the one way a failure inside Squirrel.Mac reaches this file.
 */
async function updaterFor(from: UpdateFeed): Promise<AppUpdater> {
  if (updater) return updater
  const { autoUpdater } = await import('electron-updater')
  autoUpdater.logger = {
    info: (message?: unknown) => log(String(message)),
    warn: (message?: unknown) => log(`warning: ${String(message)}`),
    error: (message?: unknown) => log(`error: ${String(message)}`),
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.forceDevUpdateConfig = !app.isPackaged
  autoUpdater.setFeedURL({ provider: 'generic', url: from.url })
  autoUpdater.on('download-progress', (progress: ProgressInfo) => showProgress(progress.percent / 100))
  autoUpdater.on('error', (error: Error) => {
    log(`updater error: ${error.message}`)
    if (stage.kind !== 'idle') void failed(from, stage.version, error)
  })
  updater = autoUpdater
  return autoUpdater
}

/** The window's progress bar, and the Dock's or the taskbar's with it; below zero clears it. */
function showProgress(fraction: number): void {
  for (const window of BrowserWindow.getAllWindows()) window.setProgressBar(fraction)
}

/** The version the feed's manifest for this platform names, or `undefined` for every way reading it can fail. */
async function feedVersion(from: UpdateFeed): Promise<string | undefined> {
  try {
    const found = await updaterFor(from)
    // The beta channel lets a prerelease through (ADR-0006); `feedUpdateAvailable`
    // is what holds a stable install to stable versions whatever the feed says.
    found.allowPrerelease = settings.channel === 'beta'
    const result = await found.checkForUpdates()
    return result?.updateInfo.version
  } catch (error) {
    // A feed that cannot be reached is not a reason to interrupt someone
    // drawing a diagram. It is written down and tried again later.
    log(`feed check failed: ${String(error)}`)
    return undefined
  }
}

/**
 * One check against the feed. The same rules as the release page's: `manual`
 * ignores a skipped version and says something when the answer is no. An
 * update already on its way or already waiting is not offered again; a check by
 * hand says where it is instead.
 */
async function checkFeed(from: UpdateFeed, manual: boolean): Promise<void> {
  if (stage.kind !== 'idle') {
    if (manual) await sayStage(stage)
    return
  }
  const version = await feedVersion(from)
  log(version
    ? `feed says ${version}, running ${app.getVersion()} (${from.url})`
    : 'the feed could not be read')

  if (feedUpdateAvailable(version, app.getVersion(), settings, manual)) {
    await offer(from, version)
    return
  }
  if (!manual) return
  if (version) {
    await ask(upToDate())
    return
  }
  // Checked by hand and failed: the page is the way round it, so the notice
  // says so and opens it rather than only reporting the failure.
  const answer = await ask({
    type: 'warning',
    title: 'Could not check for updates',
    message: 'The update feed could not be reached.',
    detail: 'Check your connection and try again, or get the newest version from the download page.',
    buttons: ['Download…', 'OK'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  })
  if (answer.response === 0) await shell.openExternal(from.page)
}

/** What a check by hand says while an update is already on its way or waiting. */
async function sayStage(now: Exclude<Stage, { kind: 'idle' }>): Promise<void> {
  if (now.kind === 'ready') {
    await offerRestart(now.version)
    return
  }
  await ask({
    type: 'info',
    title: 'Update downloading',
    message: `Version ${now.version} is downloading.`,
    detail: 'You will be asked to restart when it is ready.',
    buttons: ['OK'],
  })
}

/** What main can tell about where this copy runs from. */
async function installation(): Promise<Installation> {
  const bundle = process.platform === 'darwin' ? macBundleOf(process.execPath) : undefined
  return {
    platform: process.platform,
    packaged: app.isPackaged,
    executable: process.execPath,
    installWritable: bundle ? await writable(dirname(bundle)) : false,
    env: process.env,
  }
}

async function writable(folder: string): Promise<boolean> {
  try {
    await access(folder, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** Why this copy is sent to the page, said first in the notice. */
const NOT_IN_PLACE: Record<NotInPlace, string> = {
  development: 'This is a development run, which has nothing to replace.',
  mountedVolume: 'This copy is running from the disk image, which cannot be changed. Move it to Applications and it will update itself from then on.',
  translocated: 'macOS is running this copy from a protected location because it was never moved. Move it to Applications and it will update itself from then on.',
  notWritable: 'This copy is in a folder you cannot change, so it cannot replace itself.',
  packageManager: 'This copy was installed as a package, which the app does not replace behind your package manager\'s back.',
  platform: 'This copy cannot replace itself on this system.',
}

/** A feed's version as the release-page notice reads one: both links are the download page. */
function byHand(from: UpdateFeed, version: string): Release {
  return { version, pageUrl: from.page, downloadUrl: from.page }
}

/**
 * The offer. Where this copy can replace itself, the dialog the release page's
 * notice is, with *Download and Install* as its first button; where it cannot,
 * that notice itself, pointed at the page and saying why.
 */
async function offer(from: UpdateFeed, version: string): Promise<void> {
  const inPlace = selfReplacement(await installation())
  if (!inPlace.possible) {
    log(`cannot replace itself here (${inPlace.because}); offering the download page`)
    const release = byHand(from, version)
    pending = release
    await notify(release, NOT_IN_PLACE[inPlace.because])
    return
  }
  if (showing) return
  showing = true
  let answer: MessageBoxReturnValue
  try {
    answer = await ask({
      type: 'info',
      title: 'Update available',
      message: `Version ${version} is available.`,
      detail:
        `You are running ${app.getVersion()}. It downloads in the background while you work, ` +
        'and you will be asked to restart when it is ready.',
      buttons: ['Download and Install', 'Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
      checkboxLabel: 'Check for updates automatically',
      checkboxChecked: settings.checkAutomatically,
      noLink: true,
    })
  } finally {
    showing = false
  }
  await keepCheckbox(answer.checkboxChecked)
  // Handles its own failures, so there is nothing here to catch.
  if (answer.response === 0) void download(from, version)
  else if (answer.response === 2) await saveSettings({ ...settings, skippedVersion: version })
  // "Later" asks again at the next check, six hours on or at the next start.
}

/**
 * The download the person agreed to, with its progress on the window, and
 * then the question that replaces waiting for a quit: *Restart Now*.
 */
async function download(from: UpdateFeed, version: string): Promise<void> {
  stage = { kind: 'downloading', version }
  pending = undefined
  showProgress(0)
  try {
    const found = await updaterFor(from)
    // They said yes, so an update that is ready may now install on the way out.
    found.autoInstallOnAppQuit = true
    await found.downloadUpdate()
  } catch (error) {
    await failed(from, version, error)
    return
  } finally {
    showProgress(-1)
  }
  // An `error` event may have got there first and said so already.
  if (stage.kind !== 'downloading' || stage.version !== version) return
  stage = { kind: 'ready', version }
  log(`${version} is downloaded and ready`)
  await offerRestart(version)
}

/**
 * Restart to update. *Later* is not a dismissal: the update installs the next
 * time the app quits, which the person has already agreed to by downloading it.
 *
 * The window's own guard still runs on the way out — work not yet saved is
 * saved before it closes — and the updater waits for the windows to go.
 */
async function offerRestart(version: string): Promise<void> {
  if (showing) return
  showing = true
  try {
    const answer = await ask({
      type: 'info',
      title: 'Update ready',
      message: `Version ${version} is ready.`,
      detail: 'Restart to update. Later installs it the next time you quit.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (answer.response !== 0) return
    log(`restarting into ${version}`)
    quitting = true
    updater?.quitAndInstall()
  } finally {
    showing = false
  }
}

/**
 * Anything that goes wrong after the person said yes: written down, the stage
 * back to the start, nothing left staged for a quit, and the notice that hands
 * them the page — once, whichever of the promise and the `error` event
 * arrives first.
 */
async function failed(from: UpdateFeed, version: string, error: unknown): Promise<void> {
  log(`${version} could not be downloaded and installed: ${error instanceof Error ? error.message : String(error)}`)
  if (stage.kind === 'idle') return
  stage = { kind: 'idle' }
  showProgress(-1)
  if (updater) updater.autoInstallOnAppQuit = false
  const release = byHand(from, version)
  pending = release
  await notify(release, 'The update could not be downloaded and installed.')
}

function schedule(): void {
  stop()
  timer = setInterval(() => void check(false), RECHECK_INTERVAL_MS)
}

function stop(): void {
  if (timer) clearInterval(timer)
  timer = undefined
}

/**
 * The renderer's side of these settings (ADR-0005): the preferences dialog
 * reads them and writes the one that is a preference. A write reacts the way
 * the checkbox on the native dialog does — the timer starts or stops now, not
 * at the next launch — which is the reason this is a channel and not a file
 * the renderer could edit.
 *
 * The patch is a shape until it has been checked, like every payload from the
 * renderer: only a boolean under the one key the dialog owns gets through.
 *
 * `checks` is whether this process checks for updates at all
 * (`shouldCheckForUpdates`), and where it does not, both handlers answer that
 * rather than acting: updates are not this build's to check. The switch used to
 * be live in a process that had already decided not to ask anybody — turning it
 * on started the six-hourly timer, which is the one thing here that outlives the
 * call — so a build composed from this one that keeps its own updates had a
 * checkbox in this app's dialog that started this app's clock against this app's
 * release page. What is kept on disk is left exactly as it is: it is the answer
 * for a build that does check, and this one has no business rewriting it.
 */
export function registerSettingsChannel(options: { checks: boolean }): void {
  const { checks } = options
  ipcMain.handle('settings:readUpdates', (): UpdateSettings => updateSettingsFor(settings, checks))
  ipcMain.handle('settings:writeUpdates', async (_event, patch: unknown): Promise<UpdateSettings> => {
    if (!checks) return updateSettingsFor(settings, false)
    const held = (patch ?? {}) as UpdateSettingsPatch
    const wanted = typeof held.checkAutomatically === 'boolean' ? held.checkAutomatically : settings.checkAutomatically
    const channel = held.channel === 'beta' || held.channel === 'stable' ? held.channel : settings.channel
    if (wanted === settings.checkAutomatically && channel === settings.channel) return settings
    const switched = channel !== settings.channel
    await saveSettings({ ...settings, checkAutomatically: wanted, channel })
    if (wanted) schedule()
    else stop()
    // Switching channels should show the beta that is already out, not wait
    // six hours for it. Only when the process checks at all (see startUpdates).
    if (switched && checking) void check(false)
    return settings
  })
}

/** The menu item. Always checks, whatever the automatic setting says. */
export function checkForUpdatesNow(): void {
  void check(true)
}

export function startUpdates(): void {
  started = true
  if (!shouldCheckForUpdates(app.isPackaged, process.argv, process.env)) return
  checking = true
  log(feed ? `updates from the feed at ${feed.url}` : 'updates from the release page')

  /**
   * On the way out, ask again about an update the user has already been shown
   * and put off. Quitting is the moment installing one costs nothing, and on
   * macOS it is also the only moment that reliably happens — the window gets
   * closed all week without the app going anywhere near it.
   *
   * No network here: a quit that waits on a request is a quit that hangs. The
   * answer is whatever the startup check or a six-hourly one already found.
   */
  app.on('before-quit', (event) => {
    if (quitting || showing || !pending) return
    event.preventDefault()
    quitting = true
    void notify(pending, pendingWhy).finally(() => app.quit())
  })

  void loadSettings().then(() => {
    if (!settings.checkAutomatically) return
    void check(false)
    schedule()
  })
}
