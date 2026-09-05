/**
 * Staying current.
 *
 * The whole mechanism is `checkForUpdatesAndNotify()`: it asks the release
 * page whether there is a newer version, downloads it in the background if so,
 * shows the OS notification, and swaps it in when the app next quits. No
 * dialog, no progress bar, no IPC — deliberately. An update UI needs a typed
 * channel and translated strings, which is phase 7C; the mechanism underneath
 * it works now and is worth having now.
 *
 * What makes it work is not this file, it is the release: `latest.yml`,
 * `latest-mac.yml` and `latest-linux.yml` published beside the installers, and
 * `app-update.yml` written into the bundle by electron-builder from the
 * `publish` block of `electron-builder.cjs`. If the manifests are missing from
 * a release, this reports 404 and nothing else happens.
 *
 * Three platform truths worth knowing before debugging a silent updater:
 *
 * - **macOS updates through Squirrel.Mac, which verifies the signature.** An
 *   unsigned or ad-hoc-signed build cannot update itself — it fails with
 *   "Could not get code signature for running application". That is why the
 *   error handler below logs rather than throws: a locally packaged build is a
 *   normal thing to run, and it must not die because it cannot do something it
 *   was never going to be able to do. Squirrel.Mac also reads the **zip**, not
 *   the dmg, which is why both targets are built.
 * - **Windows updates through the NSIS installer**, which is why the release
 *   carries `.blockmap` files: they let the updater fetch only the changed
 *   parts of the installer rather than all of it.
 * - **Linux updates only from the AppImage.** A `.deb` is the package
 *   manager's business and electron-updater leaves it alone.
 */
import { app } from 'electron'

/**
 * Whether this process should talk to the update server at all.
 *
 * Pure, and its own function, because "is this a real installed app" is three
 * different questions and getting any of them wrong is invisible: a dev run has
 * no `app-update.yml` and throws on the first check, and a smoke run that
 * reaches the network turns a deterministic gate into a flaky one — worse, it
 * can raise a notification in front of the window the smoke is photographing.
 *
 * `LVARCH_NO_UPDATE` is the escape hatch for the third case: a machine that
 * must not phone home, or a locally packaged build being tested against a
 * release that is newer than it.
 */
export function shouldCheckForUpdates(
  packaged: boolean,
  argv: readonly string[],
  env: Record<string, string | undefined>,
): boolean {
  if (!packaged) return false
  if (argv.includes('--smoke')) return false
  if (env['LVARCH_NO_UPDATE']) return false
  return true
}

/** Six hours. Long enough to be invisible, short enough that a machine left on
 *  over a weekend does not miss a release. The first check is immediate. */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export function startUpdates(): void {
  if (!shouldCheckForUpdates(app.isPackaged, process.argv, process.env)) return

  // Imported here rather than at the top of the file so that a dev run never
  // loads it. electron-updater reads `app-update.yml` eagerly and complains
  // when there is none, which is noise on every `npm run dev:desktop`.
  //
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

  autoUpdater.logger = {
    info: (message: unknown) => process.stderr.write(`update: ${String(message)}\n`),
    warn: (message: unknown) => process.stderr.write(`update warning: ${String(message)}\n`),
    error: (message: unknown) => process.stderr.write(`update error: ${String(message)}\n`),
    debug: () => {},
  }

  // An update that cannot be fetched is not a reason to interrupt someone
  // drawing a diagram. It is written down and forgotten about until the next
  // check.
  autoUpdater.on('error', (error: Error) => {
    process.stderr.write(`update error: ${error.message}\n`)
  })

  const check = (): void => {
    // `checkForUpdatesAndNotify` returns a rejected promise on a network
    // failure *as well as* emitting 'error', so it needs its own catch or the
    // process reports an unhandled rejection for something already handled.
    void autoUpdater
      .checkForUpdatesAndNotify()
      .catch((error: unknown) => process.stderr.write(`update check failed: ${String(error)}\n`))
  }

  check()
  setInterval(check, RECHECK_INTERVAL_MS)
}
