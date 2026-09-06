/**
 * Staying current: ask the release page, tell the user, hand them the file.
 *
 * This used to be `electron-updater`'s `checkForUpdatesAndNotify()` — download
 * in the background, swap in on quit, no dialog. It is gone, because on the
 * path most people actually take it never completed:
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
 * What replaces it is smaller and works the same on all three platforms: read
 * the `latest` release, compare the version, and if it is newer put a dialog up
 * with a Download button that opens the installer in the browser. The user
 * installs it the way they installed this one. Nothing is fetched, staged or
 * replaced behind their back, and there is no signature, manifest or writable
 * bundle for it to trip over.
 *
 * The decisions live in `src/app/updates.ts` and are tested there; this file is
 * the fetch, the file and the message box.
 *
 * **The strings here are English only, deliberately.** Every other string in
 * this app comes from the i18n tables, but those are the renderer's and this
 * process has no way to know which language the renderer settled on — that
 * needs an IPC channel and a typed contract. A native dialog in English is the
 * price of not building one yet; when the file channel arrives, this notice
 * should move into the shell with the rest of the UI.
 */
import { app, BrowserWindow, dialog, net, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_UPDATE_SETTINGS,
  readRelease,
  readUpdateSettings,
  shouldCheckForUpdates,
  updateAvailable,
} from '../../src/app/updates'
import type { Release, UpdateSettings } from '../../src/app/updates'

/**
 * Where the releases are. Must agree with the `publish` block in
 * `electron-builder.cjs` — that one decides where a release is uploaded, this
 * one where it is looked for.
 */
const OWNER = 'Lionsville'
const REPO = 'Lionsville-Architecture-Management-Tool'
const LATEST_RELEASE = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`

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

/** So the quit notice does not open a second dialog on top of the first. */
let showing = false

/** So `app.quit()` from inside the quit notice is not intercepted by it again. */
let quitting = false

let timer: NodeJS.Timeout | undefined

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
    await writeFile(settingsPath(), `${JSON.stringify(next, undefined, 2)}\n`, 'utf8')
  } catch (error) {
    log(`could not save settings: ${String(error)}`)
  }
}

/**
 * The `latest` release, or `undefined` for every way that can fail.
 *
 * `net.fetch` rather than the global one so the request goes through Chromium's
 * network stack, and therefore through the system proxy and its certificates —
 * which on a managed laptop is the difference between working and timing out.
 */
async function fetchLatest(): Promise<Release | undefined> {
  try {
    const response = await net.fetch(LATEST_RELEASE, {
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
    return readRelease(await response.json(), process.platform, process.arch)
  } catch (error) {
    // A release page that cannot be reached is not a reason to interrupt
    // someone drawing a diagram. It is written down and tried again later.
    log(`release check failed: ${String(error)}`)
    return undefined
  }
}

/** The dialog. Returns once the user has answered it. */
async function notify(release: Release): Promise<void> {
  if (showing) return
  showing = true
  try {
    const parent = BrowserWindow.getAllWindows()[0]
    const options = {
      type: 'info' as const,
      title: 'Update available',
      message: `Version ${release.version} is available.`,
      detail:
        `You are running ${app.getVersion()}. Downloading opens the installer in your browser; ` +
        'install it the way you installed this one.',
      buttons: ['Download…', 'Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1,
      checkboxLabel: 'Check for updates automatically',
      checkboxChecked: settings.checkAutomatically,
      noLink: true,
    }
    const answer = parent
      ? await dialog.showMessageBox(parent, options)
      : await dialog.showMessageBox(options)

    if (answer.checkboxChecked !== settings.checkAutomatically) {
      await saveSettings({ ...settings, checkAutomatically: answer.checkboxChecked })
      if (answer.checkboxChecked) schedule()
      else stop()
    }

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

  const parent = BrowserWindow.getAllWindows()[0]
  const options = release
    ? {
        type: 'info' as const,
        title: 'No update available',
        message: `You are up to date.`,
        detail: `Version ${app.getVersion()} is the latest version.`,
        buttons: ['OK'],
      }
    : {
        type: 'warning' as const,
        title: 'Could not check for updates',
        message: 'The release page could not be reached.',
        detail: 'Check your connection and try again.',
        buttons: ['OK'],
      }
  if (parent) await dialog.showMessageBox(parent, options)
  else await dialog.showMessageBox(options)
}

function schedule(): void {
  stop()
  timer = setInterval(() => void check(false), RECHECK_INTERVAL_MS)
}

function stop(): void {
  if (timer) clearInterval(timer)
  timer = undefined
}

/** The menu item. Always checks, whatever the automatic setting says. */
export function checkForUpdatesNow(): void {
  void check(true)
}

export function startUpdates(): void {
  if (!shouldCheckForUpdates(app.isPackaged, process.argv, process.env)) return

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
    void notify(pending).finally(() => app.quit())
  })

  void loadSettings().then(() => {
    if (!settings.checkAutomatically) return
    void check(false)
    schedule()
  })
}
