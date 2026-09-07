# ADR-0006 — Release channels: stable, and beta

* Status: accepted
* Date: 2026-09-07
* Deciders: Wouter Simons

**This record is a design, not a report.** Nothing in it is built yet. It is
written for the agent who picks the work up; the last section is the order to
build it in. ADR-0005 left the **Updates** section of the preferences dialog
as the place this lands, and this record is what lands there.

## Context and Problem Statement

The update check (`electron/main/updates.ts`, decisions in
`src/app/updates.ts`) asks GitHub for `releases/latest`, compares the tag with
the running version, and puts up a dialog with a Download button. It is
deliberately modest: nothing is fetched or replaced behind the user's back.

`releases/latest` is, by GitHub's definition, **the newest release that is not
a prerelease and not a draft**. That is exactly right for most people and
makes a beta impossible: a release published with the *pre-release* box
ticked is invisible to every installed copy, so a build handed to a few
people ahead of a release cannot reach them through the mechanism they
already have. Today "try this before it is a release" means sending a file.

So the question is how a person says *I want the betas*, what that changes
about the request, and what it does not change.

## Decision Drivers

* **A setting belongs to whatever it is about** (ADR-0005). Which channel
  this install follows is about this install, and there is already a file for
  that: `update-settings.json`, main's own, read before any window exists.
* **The mechanism stays modest.** A channel is a different question to the
  release page, not a different updater. Download, install the way you
  installed this one, nothing behind the user's back.
* **A beta is a release, published the same way.** `docs/release.md` and
  `.github/workflows/release.yml` build and sign from a published GitHub
  release; the only difference for a beta must be one tick box and a tag.
* **Semver already knows the ordering.** `isNewerVersion` treats
  `1.3.0-beta.1` as older than `1.3.0` and newer than `1.2.9`, which is the
  whole of what a channel needs to compare.
* **Leaving the beta channel must not uninstall anything.** A person who
  turns it off keeps the build they have; they simply stop being told about
  betas.

## Considered Options

1. **A separate feed per channel** — a `beta` branch, a second release page or
   a manifest file. Rejected: a second thing to publish and keep in step, for a
   difference GitHub already records on the release itself.
2. **Prerelease releases on the same page, and a setting that decides whether
   they count.** What this record chooses.
3. **A prerelease build that always follows the betas.** Rejected: which
   channel you are on becomes a property of the file you downloaded rather
   than a setting you can see and change, and the dialog has no way to say so.

## Decision Outcome

**Two channels, `stable` and `beta`, as one setting in `update-settings.json`,
and a beta is a GitHub prerelease.**

### The setting

```jsonc
{ "checkAutomatically": true, "channel": "beta", "skippedVersion": "1.3.0-beta.1" }
```

`channel` is `stable` unless the file says `beta`; anything else reads as
`stable`, the way every field in that file fails towards the safe answer. It
is read by `readUpdateSettings` (`src/platform/updateSettings.ts`), patched
through `DesktopSettings` like `checkAutomatically`, and main reacts to a
change by checking again at once — switching to beta should show the beta
that is already out, not wait six hours for it.

`skippedVersion` is unchanged: one version, whatever channel it was on. A
skipped beta is a skipped version; the next beta is a new question.

### The request

* `stable` keeps `releases/latest`. Nothing about today's behaviour changes
  for anyone who has not chosen otherwise.
* `beta` asks `releases?per_page=10` and takes the **newest release that is
  not a draft**, prerelease or not. Not "the newest prerelease": a stable
  release newer than the last beta is what a beta user should be told about,
  and `isNewerVersion` already puts `1.3.0` above `1.3.0-beta.2`.

The reduction is a second pure function beside `readRelease` — a list payload
in, the newest `Release` out — with the same distrust of the network: a
payload that is not a list of releases, a draft, a tag that is not a version,
a non-`https:` URL, all produce `undefined` and never a link. The ten-item page
is a bound, not a promise: GitHub lists newest first, and a channel where the
newest ten are all drafts has nothing to offer anyway.

### Publishing a beta

Tag it `vX.Y.Z-beta.N`, title it the way `docs/release.md` says, tick
**Set as a pre-release**. The workflow builds and signs it like any other
release. That is the entire ceremony, and it is why option 1 lost: the
prerelease flag is a fact GitHub already keeps and already leaves out of
`latest`.

### The dialog

The **Updates** section of the preferences dialog gains a second row under
*Check for updates automatically*: a two-way toggle, **Stable** and **Beta**,
with one sentence under it saying that betas are builds ahead of a release,
signed and published the same way, and that turning the channel off keeps
whatever is installed. Written on change, like everything else in that dialog.
The update notice itself does not change: the version in it is whatever the
channel found.

### What does not change

* The interchange format, the working file, the folder — nothing about the
  data. A beta opens the same folders a release does, and a folder written by
  a beta must open in the release that follows it, which is a constraint on
  how betas are made and not a mechanism.
* The manual **Check for Updates…** item, which checks the channel the
  setting names and ignores a skipped version as it does today.
* `LVARCH_NO_UPDATE` and `LVARCH_UPDATE_CHECK`, which decide whether to check
  at all and say nothing about which channel.

## Consequences

* One more key in main's settings file, one more row in one dialog section,
  and one more pure function with a test — the shape of a small change.
* A beta is reachable by every install that asks for it, through the
  mechanism it already has, and by nobody who did not.
* People on the beta channel are told about stable releases too, so nobody is
  stranded on a prerelease once the release is out.
* The release process gains one tick box and a tag convention, and
  `docs/release.md` has to say so.

## What this takes, in order

Each step ends green (`npm run check`); the desktop step wants `npm run
verify` before a push.

1. **The setting.** `channel: 'stable' | 'beta'` on `UpdateSettings` and in
   `readUpdateSettings`, defaulting to `stable` for anything else;
   `UpdateSettingsPatch` accepts it. Unit tests, node.
2. **The reduction.** `readNewestRelease(payload, platform, arch)` beside
   `readRelease` in `src/app/updates.ts`: a list payload, drafts skipped, the
   newest by `isNewerVersion`, the same checks on every field. Tests with a
   list, a list of drafts, a list with a stable newer than the beta, and a
   payload that is not a list.
3. **The request.** `fetchLatest` in `electron/main/updates.ts` asks
   `releases/latest` or `releases?per_page=10` by the channel in force, and a
   write to `channel` over `DesktopSettings` triggers a check.
4. **The dialog.** The Stable / Beta toggle in the Updates section of
   `PreferencesDialog.tsx`, the strings in `src/app/strings/{en,nl}.ts`, and a
   component test through `renderShell`.
5. **The operator's page.** A paragraph in `docs/release.md` on tagging and
   publishing a beta, and `CLAUDE.md`'s state of play.

## Open questions

* **Should the notice say it is a beta?** The dialog can tell from the
  version string. Whether *Version 1.3.0-beta.1 is available* is enough, or
  whether the notice should add a line, is a wording question that can be
  settled when the first beta is cut.
