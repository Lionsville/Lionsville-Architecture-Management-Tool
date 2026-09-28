# Cutting a release

Draft a release on GitHub with a tag of the form `v1.2.3`, write the notes
(`docs/release-notes/next.md` collects them between releases; paste it in and
empty it),
press **Publish release**. That is the whole procedure. A few minutes later
the release page carries:

| File | What it is |
|---|---|
| `web-<version>.zip` | the web build — `npm run build`'s `dist/`, with a `version.json` saying which release it is; what [app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/) runs |
| `sbom-<version>.cdx.json` | the bill of materials, in CycloneDX: every package the web build and the desktop main process are made of, with its version, licence and hash — npm's own document, narrowed to what ships (`build/sbom.ts`) |
| `SHA256SUMS`, `<file>.sha256` | a SHA-256 per file, and one file listing them all |

and, as on every GitHub release, the source at the tag.

**No installers** (ADR-0030). The desktop app is downloaded from
[architecture.lionsville.nl/download](https://architecture.lionsville.nl/download),
where it is built, signed and published with the update feed it replaces
itself from; this repository is its source, under the AGPL, and anyone may
build their own copy from it (*Building the desktop app yourself*, below).
Copies installed from releases of this repository before then keep asking its
release page for the newest version, and a release with no installer on it
sends their *Download…* to that page — so a release's notes say, near the top,
where the app is downloaded now.

**The tag is the version.** `package.json` says `0.0.0` and stays that way; the
workflow stamps the number from the tag before it builds. A tag that is not
`v<semver>` stops the run in its first job, and so does a tag whose commit has
no successful `check` run.

`.github/workflows/release.yml` also has a **Run workflow** button. That builds
exactly as a release does but publishes nothing and deploys nowhere; the files
come back as run artifacts. Use it to test a change to the pipeline.

**Then the browser.** A stable release ends with the web build deployed to
[app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/) —
the `web-host` job, which waits for the release to be whole: the zip, the bill
of materials and their sums on the page. A beta is never deployed there. The
job signs in to Azure by OIDC under the `app` environment, fetches the Static
Web App's deployment token for the run, uploads the unpacked zip with
`.github/staticwebapp.config.json` beside it, and polls `/version.json` until
the host says the new version. The five values it reads are listed below.

## Verifying a download

Every file arrives with a **`<file>.sha256`** beside it, and the release
carries one **`SHA256SUMS`** over all of them — sha256sum's own format, file
names only, so it reads from whatever folder the downloads landed in:
`sha256sum -c SHA256SUMS` on Linux, `shasum -a 256 -c SHA256SUMS` on macOS,
`certutil -hashfile <file> SHA256` on Windows compared by eye. It runs for a
beta too. This is a check against a damaged or swapped download, not a
signature.

Every file also has a **build-provenance attestation**: the web job hands the
same sums to `actions/attest-build-provenance`, and GitHub signs a statement
that this file came from this repository, this workflow and this commit. It is
checked with the GitHub CLI:
`gh attestation verify <file> --repo Lionsville/Lionsville-Architecture-Management-Tool`.
A public repository keeps attestations on any plan.

## Rolling back

There is no rollback button and no separate procedure: **putting the previous
release back is publishing it again.** Open the previous release on GitHub,
press *Edit*, and publish it once more — that fires `release: published` on
that tag, and the workflow does for it exactly what it did the first time:
builds the web build from the tag's commit, uploads it over the one already
there, and deploys it to
[app.architecture.lionsville.nl](https://app.architecture.lionsville.nl/),
polling `/version.json` until the host says so. Re-running that release's own
workflow run from the Actions page has the same effect, and is quicker when
the run is still in the list.

Two things to know before you press it. The **Run workflow** button is *not*
this: a manual run builds but publishes nothing and deploys nowhere, which
makes it a rehearsal rather than a rollback. And `preflight` refuses a tag
whose commit has no successful `check` run, so a tag older than that gate has
to be checked first — push nothing, just let `check.yml` run on the commit, or
the run stops in its first job.

What this does **not** roll back:

- **An installed desktop app.** This repository publishes none. The app people
  download updates from its own feed, and that feed is withdrawn where it is
  published; a copy somebody built themselves keeps running until they build
  or install another.
- **Files already written.** A working file saved by the newer version is a
  file in that version's format; the previous build reads what its own format
  version can read and nothing more.
- **The newer release itself.** Its page, its tag and its notes stay until
  somebody removes them. Tick *Set as a pre-release* on it to take it out of
  `latest`, which is what copies installed from older releases ask for.
- **Anything outside this repository.** The public site, the desktop app's
  downloads and the hosted service are released on their own and roll back on
  their own.

## What has to be configured once

Five variables, all for the browser host. There is no secret: nothing here
signs anything, and the deployment proves who it is by OIDC.

### Variables — the browser host (Settings → Secrets and variables → Actions → Variables)

None of these is a secret; they name where the web build goes.

| Name | Example |
|---|---|
| `WEB_HOST_CLIENT_ID` | the application (client) id of the identity that deploys the web build |
| `WEB_HOST_TENANT_ID` | its tenant |
| `WEB_HOST_SUBSCRIPTION_ID` | the subscription the host is in |
| `WEB_HOST_RESOURCE_GROUP` | the host's resource group |
| `WEB_HOST_STATIC_SITE` | the Static Web App's name |

The identity is a registration of its own, with a federated credential for
this repository's `app` environment and *Contributor* on that one Static Web
App — enough to read its deployment token, nothing beyond it. There is no
secret: the workflow proves who it is with the OIDC token GitHub mints for
the run. The `web-host` job is skipped when the variables are absent only in
the sense that it fails at sign-in; there is no preflight for them, because a
release with its files on the page and no browser deployment is a release
with one job to re-run, not a broken one.

## Building the desktop app yourself

```bash
npm run pack:desktop    # release/<platform>-unpacked, no installer
npm run dist:desktop    # installers, unsigned
```

`electron-builder.cjs` signs with whatever credentials are in the environment
and nothing else, so a fresh clone builds with no setup at all. Gatekeeper and
SmartScreen will warn about a locally built artifact; that is expected, not a
defect.

To sign, put the credentials in the environment and build on the platform
you sign for. macOS: `CSC_LINK` (a Developer ID Application `.p12`, a path or
base64), `CSC_KEY_PASSWORD`, and for notarization `APPLE_API_KEY`,
`APPLE_API_KEY_ID`, `APPLE_API_ISSUER` and `APPLE_TEAM_ID`. Windows, through
Azure Trusted Signing: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and
`AZURE_CLIENT_SECRET` for the identity, and `AZURE_CODE_SIGNING_ENDPOINT`,
`AZURE_CODE_SIGNING_ACCOUNT`, `AZURE_CODE_SIGNING_PROFILE` and
`AZURE_CODE_SIGNING_PUBLISHER` for the account — all four or none. Linux is
not signed. Things that have gone wrong doing this:

- **`APPLE_API_KEY` is a path, not a key.** `@electron/notarize` opens the value
  as a file. Passing the key material directly produces a notarization failure
  that reads like an authentication problem.
- **Azure signing needs NuGet bootstrapped.** electron-builder installs the
  `TrustedSigning` PowerShell module on demand, which fails on a machine with no
  NuGet package provider (electron-builder#8828). Install the module first.
- **The signer role.** The identity needs **Artifact Signing Certificate
  Profile Signer** on the signing account; without it signing fails with a
  bare `403`. Azure renamed the role from *Trusted Signing Certificate Profile
  Signer*, so the old name finds nothing in the portal.
- **`AZURE_CODE_SIGNING_PUBLISHER` must equal the certificate's CommonName
  exactly** — the legal entity from the identity validation form, not the
  product name. Read it from the certificate profile's subject rather than
  remembering it.
- **Identity validation expires yearly.** Azure Trusted Signing stops signing
  when it lapses, and the failure gives no hint that a renewal is what is wanted.
- **An AppImage on Ubuntu 24.04+** will not start until the kernel's
  restriction on unprivileged user namespaces is addressed — the `.deb`
  installs an AppArmor profile and does not have the problem
  ([electron/electron#41066](https://github.com/electron/electron/issues/41066)).

Nothing in this config publishes (`publish: null`). A copy that should update
itself names its feed there as a `generic` provider — which is what makes
electron-builder write the `latest*.yml` manifests and the app's
`app-update.yml` — and registers the same address in main (*Updates*, below).

## Updates

Which of two mechanisms an installed copy uses is decided by the build, not
by the machine (ADR-0030).

### With no feed: the notice

A build from this source alone **does not update itself**.
`electron/main/updates.ts` asks GitHub for the `latest` release on start and
every six hours after; if its tag is a newer version than the running one it
puts a dialog up —

> **Version 1.2.3 is available.** … *Download… · Later · Skip This Version*
> ☑ Check for updates automatically

— and **Download…** opens this platform's installer in the browser, or the
release page when the release carries none, which is every release since
ADR-0030. Pressing *Later* means the same dialog appears again on the way out,
which on macOS is the moment that matters: closing the window is not quitting,
and the version people run for weeks is the one they never quit.

It picks the `.dmg` on macOS, the `.exe` for this architecture on Windows and
the `.AppImage` on Linux — never the `.deb`, which is the package manager's
business — and falls back to the release page whenever it cannot tell which
file is meant.

### With a feed: install in place, asking first

A build composed from this one registers where its versions are published,
before the app is ready:

```ts
import { registerUpdateFeed } from './electron/main/updates'
registerUpdateFeed({
  url: 'https://downloads.example.org/latest/',  // latest-mac.yml, latest.yml, latest-linux.yml and the files they name
  page: 'https://example.org/download',          // where a person downloads it by hand
})
```

Then the same checks, on the same schedule and under the same settings, read
the feed through `electron-updater` as a `generic` provider, and a newer
version is three steps, each asked:

1. *Version 1.2.3 is available.* — **Download and Install** · Later · Skip This
   Version, with the same checkbox.
2. The download, in the background, with its progress on the window's
   progress bar and the Dock or taskbar icon.
3. *Version 1.2.3 is ready.* — **Restart Now** · Later. *Later* installs it at
   the next quit, which the person agreed to by downloading it.

Before step 1 the app decides whether it can replace itself where it runs
(`selfReplacement`): not from the disk image, not translocated (run from
Downloads without being moved to Applications), not in a folder this user
cannot write, and on Linux only as an AppImage. Where it cannot, step 1 is the
notice above, saying why and opening the feed's page. Any failure after the
person said yes does the same, once. The feed has to be `https:`, and a stable
install is never offered a prerelease the feed names.

### The settings, for both

Three settings, all in `update-settings.json` in the app's user-data folder,
and the first two also in the **Updates** section of the preferences dialog:

| Field | Set by |
|---|---|
| `checkAutomatically` | the checkbox on the dialog. Off means no automatic check ever again |
| `channel` | `stable` (the default) or `beta` — the toggle in the preferences dialog (ADR-0006) |
| `skippedVersion` | *Skip This Version*. One version, not a list — the next release is a new question |

### Publishing a beta

A beta is a GitHub **prerelease**, and nothing else is different. Tag it
`vX.Y.Z-beta.N`, title it as above, tick *Set as a pre-release*, publish; the
workflow builds it like any release and does not deploy it. `releases/latest`
never returns a prerelease, so installs on the stable channel never hear of
it. Installs on the beta channel ask for the newest few releases and take the
newest by version, prerelease or not — so the stable `vX.Y.Z` that follows
reaches them too, and nobody is left on a beta. A folder written by a beta
must open in the release that follows it; that is a rule for what goes into a
beta, not a mechanism.

**Check for Updates…** in the menu (the app menu on macOS, Help elsewhere) always
checks, ignores a skipped version, and says so when there is nothing to report —
so an unticked checkbox can always be re-ticked.

`LVARCH_NO_UPDATE=1` turns the whole thing off for a machine that must not phone
home, and a dev or `--smoke` run never checks by itself.

**The repository has to be public**, or the release API needs a token the app has
no way to get. That is the case today.

The dialogs' strings are English only. Every other string in the app comes from
the i18n tables, but those belong to the renderer and this process cannot know
which language it settled on without an IPC channel; when the file channel
arrives, the notice should move into the shell with the rest of the UI.

## The agent server

Since ADR-0007 the desktop can listen for an MCP client, on the loopback
only and off until a person turns it on from **Connect an Agent…**. Nothing
about a release changes: there is no port to open, no certificate, no
credential. The port and the bearer token are minted on the user's machine and
kept in `mcp.json` under `userData` with mode 0600; they never reach a folder,
a project, a log or this repository. The smoke run turns the server on,
connects with the real SDK client, reads and draws through it, and checks the
port is closed again once it is off.

## Two package.json fields the Linux build will not build without

`author` (with an **email**) and `homepage`. The `.deb` target throws rather
than warns if either is missing — the maintainer and homepage fields are
mandatory in a Debian control file. They are filled in; this note exists so that
a future tidy-up does not remove them as decoration.
