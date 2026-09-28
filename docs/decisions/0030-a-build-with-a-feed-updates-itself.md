# ADR-0030 — A build with a feed updates itself, and the releases here carry no installers

* Status: accepted
* Date: 2026-09-28
* Deciders: Wouter Simons
* Supersedes: ADR-0006, in part — *Publishing a beta*'s "the workflow builds
  and signs it like any other release", since a release here builds no
  installer; and the driver *the mechanism stays modest* for a build that
  registers a feed, which installs in place, asking first
* Supersedes: ADR-0024, in part — §2's deployment *after the README job*,
  since there is no README job; the host now waits for the release to be
  whole, and still never runs a beta

## Context and Problem Statement

Since September 2026 the desktop app has not replaced itself.
`electron/main/updates.ts` asks this repository's release page for the newest
version and, when there is one, puts up a dialog whose *Download…* opens the
installer in the browser. It replaced `electron-updater`'s
`checkForUpdatesAndNotify()`, for three reasons written at the top of that
file:

1. **macOS.** Squirrel.Mac updates from the zip, checks the running app's
   signature and needs a bundle it can write. Any of the three missing, and it
   failed with a line on stderr and nothing on screen.
2. **The quit.** The install it staged happened on quit, which closing the
   window on macOS is not; an app that is closed and reopened all week never
   installed anything.
3. **Consent.** It downloaded about 100 MB before anybody was asked, and
   announced it in a notification that was easy to miss.

The notice is honest and it works everywhere, but it leaves every update as an
installation the person does by hand, and most people do not. Meanwhile the
desktop app most people install is no longer built here: it is built outside
this repository, from this source and more, and that build is signed,
notarized and published together with electron-builder's update manifests.
Two desktop builds of one app, each with its own installers and its own idea
of what is newest, are two apps competing for one file extension and one
settings folder. So this repository stops publishing installers, and the
build that is published needs a way to update itself.

## Decision Drivers

* **Nothing is fetched before the person says so**, and nothing is installed
  that they did not agree to. That was the notice's point, and it stays true.
* **The end of an update is a question, not a quit.** *Restart to update*,
  now or later, and later means the next quit, which the person has already
  agreed to.
* **A promise the app cannot keep is not offered.** Whether this copy can
  replace itself where it runs is decided before the button is drawn, and
  where it cannot, the person gets the notice that has always worked.
* **Where versions come from is the build's to say**, not the machine's. A
  build composed from this one names its feed at composition, the way it
  names a source provider or a desktop hook (ADR-0022); a build from this
  source alone names none and behaves exactly as before.
* **This repository's releases stay useful without installers**: the tag is
  the source, the web build runs at app.architecture.lionsville.nl, the bill
  of materials says what it is made of, and anyone may build the app from it.

## Considered Options

1. **Keep the notice for everybody.** Rejected: it is the reason most installs
   are behind, and the build that is published can meet every condition the
   self-updater failed on.
2. **The self-updater for everybody, this repository's builds included.**
   Rejected: this repository would have to keep publishing signed, notarized
   installers and their manifests, a second desktop build of the same app.
3. **The self-updater for a build that registers a feed, the notice for one
   that does not.** What this record chooses.

## Decision Outcome

### 1. A feed is registered, once, before the app is ready

```ts
export type UpdateFeed = {
  /** Base URL of an electron-builder generic feed: latest-mac.yml, latest.yml, latest-linux.yml and the files they name. */
  readonly url: string
  /** The page a person downloads the app from by hand: the fallback wherever the app cannot replace itself. */
  readonly page: string
}
export function registerUpdateFeed(feed: UpdateFeed): void
```

In `electron/main/updates.ts`, called by a build composed from this one before
`app.whenReady`. A second registration throws, and so does one after the
updates have started, because either would leave a build checking somewhere
other than where it believes it does. Both addresses must be `https:`
(`updateFeedProblem` in `src/platform/updates.ts`). Importing the file does
nothing; registering only remembers the feed; `electron-updater` is loaded on
the first check against a feed, so a build with none never loads it.

With no feed, nothing changes: the release page, the notice, *Download…*.

### 2. With a feed: ask, download, restart

The same schedule and the same settings as the notice: a check on start and
every six hours while *Check for updates automatically* is on, a skipped
version left alone except by *Check for Updates…*, `LVARCH_NO_UPDATE` turning
it all off, and a development or `--smoke` run never checking by itself
(`shouldCheckForUpdates`, `offersUpdateCheck`). The beta channel lets a
prerelease through; a stable install is never offered one, whatever the feed
names (`feedUpdateAvailable`), because a feed does not flag a prerelease the
way a release page does.

`electron-updater`'s `autoUpdater` reads the feed as a `generic` provider with
`autoDownload` off. When the manifest names a newer version:

1. **The offer** — the notice's dialog, with the version, the checkbox,
   *Later* and *Skip This Version*, and **Download and Install** as its first
   button.
2. **The download**, in the background, with its progress on the window's
   progress bar (the Dock's on macOS, the taskbar's on Windows).
3. **Restart to update** — *Version X is ready*, with **Restart Now**
   (`quitAndInstall`) and **Later**. `autoInstallOnAppQuit` is turned on when
   the person agrees to the download and not before, so *Later* installs it at
   the next quit and nothing is ever staged that nobody agreed to.

*Check for Updates…* runs the same flow, says so when there is nothing newer,
and while an update is downloading or waiting says where it is instead of
offering it again.

### 3. Whether this copy can replace itself is decided first

`selfReplacement` in `src/platform/updates.ts`, pure and tested:

| Platform | Replaces itself when |
|---|---|
| macOS | the bundle is not on a mounted volume (`/Volumes/…`, run from the disk image), not translocated (`/AppTranslocation/`, run from Downloads without being moved), and its folder is writable by this user. Being in an Applications folder is not enough: a standard account cannot write /Applications |
| Windows | always: the NSIS installer runs again over the install, asking for elevation itself where the install is per-machine |
| Linux | only as an AppImage (`APPIMAGE` is set). A `.deb` is the package manager's |
| anything else, or a development run | never |

### 4. The fallback is the notice

Where the copy cannot replace itself, the offer is the notice, with a first
sentence saying why (*Move it to Applications and it will update itself from
then on*) and *Download…* opening the feed's page. Any failure after the
person agreed — the download, the manifest's checksum, Squirrel.Mac refusing
the signature — is written down, clears what was staged, and puts up the same
notice once. A check that fails on its own is only written down, as the
release page's always was; a check by hand that fails says so and offers the
page.

### 5. Why the three old reasons no longer hold

1. **macOS**: the build that registers a feed is signed and notarized, the zip
   is still built (`electron-builder.cjs`), and a bundle that cannot be written
   is sent to the page before anything is offered, rather than failing after.
2. **The quit**: the last step is *Restart Now*, asked, and *Later* means the
   next quit on purpose.
3. **Consent**: `autoDownload` is off; the person presses *Download and
   Install* before a byte is fetched.

### 6. The releases here carry no installers

`.github/workflows/release.yml` keeps its tag checks, its `verify`, the web
build and its deployment, the bill of materials, `SHA256SUMS` and a
provenance attestation over what it publishes. The installer matrix, the
Apple and Azure signing, notarization and the job that pointed the README at
the installers are gone, with the secrets only they used. The README's
Download section points at the download page, architecture.lionsville.nl/download,
and says the source is here under the AGPL for anyone to build.

The web build (the `⋯` menu's Help section, which exists only where there is
no menu bar, so never on the desktop) carries *Get the Desktop App*, a link to
the same page.

`electron-builder.cjs` stays, for anyone building their own copy and for a
build composed from this one, whose config starts from it. It publishes
nothing (`publish: null`); a build with a feed names its feed there as a
`generic` provider, which is also what makes electron-builder write the
manifests and the `app-update.yml` the updater reads.

Copies installed from earlier releases of this repository keep asking its
release page. A release with no installer on it sends their *Download…* to
that page, and its notes say where the app is downloaded now.

## Consequences

* The app most people run updates in three presses, and says why when it
  cannot.
* `electron-updater` is back, as a dev dependency bundled into main like
  everything else (`dependencies` stays empty), and on the policy's list
  (`build/dependencyPolicy.ts`) with its notices.
* A release here is minutes, not twenty of them, and needs no signing
  credential at all: the five variables of the web host are what is left to
  configure (`docs/release.md`).
* The update dialogs stay English only, as the notice's always were.
