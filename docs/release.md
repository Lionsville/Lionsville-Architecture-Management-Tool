# Cutting a release

Draft a release on GitHub with a tag of the form `v1.2.3`, write the notes,
press **Publish release**. That is the whole procedure. About twenty minutes
later the release page carries:

| File | Platform |
|---|---|
| `…-mac-arm64.dmg` | macOS, Apple Silicon — signed, notarized, stapled |
| `…-mac-arm64.zip` | the same app, in the form `electron-updater` can update from |
| `…-win-x64.exe`, `…-win-arm64.exe` | Windows NSIS installers — signed |
| `…-linux-x86_64.AppImage`, `…-linux-amd64.deb` | Linux, unsigned |
| `latest.yml`, `latest-mac.yml`, `latest-linux.yml`, `*.blockmap` | the update manifests |

**The tag is the version.** `package.json` says `0.0.0` and stays that way; the
workflow stamps the number from the tag before it builds. A tag that is not
`v<semver>` stops the run in its first job.

`.github/workflows/release.yml` also has a **Run workflow** button. That builds
and signs exactly as a release does but publishes nothing, and its `notarize`
input can be switched off to skip Apple's ~15-minute queue. Use it to test a
change to the pipeline; the installers come back as run artifacts.

## What has to be configured once

Thirteen values. The workflow's `preflight` job checks all of them are present
and fails the run before anything is built if any is not — an unsigned release
is not a degraded release, it is a broken one.

### Secrets — macOS (Settings → Secrets and variables → Actions → Secrets)

| Name | What it is |
|---|---|
| `MAC_CSC_LINK` | The **Developer ID Application** certificate exported from Keychain Access as `.p12`, then base64-encoded: `base64 -i cert.p12 \| pbcopy` |
| `MAC_CSC_KEY_PASSWORD` | The password set on that `.p12` |
| `APPLE_API_KEY` | The App Store Connect API key `.p8`, base64-encoded the same way |
| `APPLE_API_KEY_ID` | The key's ID (the `XXXXXXXXXX` in `AuthKey_XXXXXXXXXX.p8`) |
| `APPLE_API_ISSUER` | The issuer UUID shown above the key list in App Store Connect |
| `APPLE_TEAM_ID` | The ten-character team ID |

Create the API key in App Store Connect → Users and Access → Integrations →
App Store Connect API, with the **Developer** role. Apple lets you download the
`.p8` exactly once.

An Apple ID plus an app-specific password works too, but the API key is the
supported route for CI and is what the workflow is written for.

### Secrets — Windows

| Name | What it is |
|---|---|
| `AZURE_TENANT_ID` | Microsoft Entra ID → Overview → Tenant ID. **Not** the subscription ID |
| `AZURE_CLIENT_ID` | The App Registration's **Application (client) ID**. Not its Object ID |
| `AZURE_CLIENT_SECRET` | The secret's **Value**, which Azure shows once. Not the Secret ID |

### Variables (same page → Variables)

None of these is a secret; they are variables so they can be read and corrected
without being re-entered blind.

| Name | Example |
|---|---|
| `AZURE_CODE_SIGNING_ENDPOINT` | `https://neu.codesigning.azure.net/` — the region chosen when the account was created |
| `AZURE_CODE_SIGNING_ACCOUNT` | the Trusted Signing **account** name |
| `AZURE_CODE_SIGNING_PROFILE` | the certificate **profile** name inside that account |
| `AZURE_CODE_SIGNING_PUBLISHER` | must equal the certificate's CommonName **exactly** — the legal entity from the identity validation form, not the product name |

The service principal needs the **Artifact Signing Certificate Profile Signer**
role on the signing account. Without it, signing fails with a bare `403` and no
explanation of what is forbidden. Azure renamed that role from *Trusted Signing
Certificate Profile Signer*, so the old name finds nothing in the portal.

Every one of the four is readable from the signing account itself rather than
remembered — `accountUri` is the endpoint, and the publisher is the `CN=` in the
certificate profile's subject name. Read them; the publisher in particular is the
legal entity and looks nothing like the product name.

### The signing identity is this app's own

`lionsville-architecture-tool-signing` is an app registration dedicated to this
repository, holding that one role and nothing else. Signing here cannot be
broken by, and cannot break, whatever else the organisation signs — which is the
entire reason it is not shared.

Its client secret is **stored nowhere**. It goes from `az` into the repository
secret and is never written down, because a copy kept somewhere convenient is a
copy that can leak; Azure will not show it again either. So if it is ever lost,
do not go hunting for it — issue a new one. That costs nothing and invalidates
nothing else, which is the whole advantage of a dedicated identity:

```bash
az ad app credential reset --id <the app registration> --append \
  --display-name "github-actions-$(date +%Y%m%d)" --years 2 \
  --query password -o tsv | gh secret set AZURE_CLIENT_SECRET
```

`--append` is not optional. Without it that same command **deletes every
existing credential** on the registration before adding the new one.

## Things that have already gone wrong elsewhere

- **`APPLE_API_KEY` is a path, not a key.** `@electron/notarize` opens the value
  as a file. The workflow decodes the secret to `$RUNNER_TEMP/signing/AuthKey.p8`
  and sets the variable to that path. Passing the key material directly produces
  a notarization failure that reads like an authentication problem.
- **A published release rejects a draft upload.** electron-builder publishes
  drafts by default and, finding a published release under the tag, logs
  `existing type not compatible with publishing type` and uploads nothing — with
  a green tick. `publish.releaseType: 'release'` in `electron-builder.cjs` is
  what prevents that, and it is the whole reason this workflow can be triggered
  by a release at all.
- **A release older than two hours also rejects uploads**, unless
  `EP_GH_IGNORE_TIME` is set. It is, so re-running one failed platform job the
  next day still works.
- **Azure signing needs NuGet bootstrapped.** electron-builder installs the
  `TrustedSigning` PowerShell module on demand, which fails on a runner with no
  NuGet package provider (electron-builder#8828). The workflow installs both up
  front.
- **Identity validation expires yearly.** Azure Trusted Signing stops signing
  when it lapses, and the failure gives no hint that a renewal is what is wanted.

## Local builds are unsigned, on purpose

```bash
npm run pack:desktop    # release/<platform>-unpacked, no installer
npm run dist:desktop    # installers, unsigned
```

`electron-builder.cjs` signs with whatever credentials are in the environment
and nothing else, so a fresh clone builds with no setup at all. Gatekeeper and
SmartScreen will warn about a locally built artifact; that is expected, not a
defect.

## The updater

Installed copies update themselves. `electron/main/updates.ts` asks the release
page for `latest.yml` / `latest-mac.yml` / `latest-linux.yml` on start and every
six hours after, downloads a newer version in the background, shows the OS
notification, and swaps it in when the app next quits. There is no dialog and no
IPC — an update UI needs a typed channel and translated strings, which is phase
7C.

For that to work a release must carry the manifests **and** the file each
platform's updater actually reads:

| Platform | Reads | Needs |
|---|---|---|
| macOS | the `.zip`, never the `.dmg` | a valid Developer ID signature — Squirrel.Mac verifies it, so an unsigned build cannot self-update |
| Windows | the NSIS `.exe`, plus its `.blockmap` to fetch only what changed | — |
| Linux | the `.AppImage` | a `.deb` is the package manager's business and is left alone |

All of them are published by the workflow. `app-update.yml`, which tells the
installed app where its release page is, is written into the bundle by
electron-builder from the `publish` block — note that it appears only in a build
with real targets, so a `--dir` pack will not have one and will log a harmless
error on start.

`LVARCH_NO_UPDATE=1` turns the whole thing off for a machine that must not
phone home.

**The repository has to be public**, or the updater needs a token it has no way
to get. That is the case today.

## Not yet done

- **Linux is unsigned**, and on Ubuntu 24.04+ an AppImage of an Electron app
  will not start until the kernel's restriction on unprivileged user namespaces
  is addressed — the `.deb` installs an AppArmor profile and does not have the
  problem, the AppImage has no install step and does
  ([electron/electron#41066](https://github.com/electron/electron/issues/41066)).
  Say so next to the download, or ship the `.deb` as the recommended file.
- **No build provenance.** `actions/attest-build-provenance` would sign an
  attestation for each installer; it needs `id-token: write` and one step.

## Two package.json fields the Linux build will not build without

`author` (with an **email**) and `homepage`. The `.deb` target throws rather
than warns if either is missing — the maintainer and homepage fields are
mandatory in a Debian control file. They are filled in; this note exists so that
a future tidy-up does not remove them as decoration.
