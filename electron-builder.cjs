/**
 * What electron-builder makes, and when it signs it.
 *
 * This is a `.cjs` file rather than the `.yml` it used to be for one reason:
 * signing has to be conditional. A release is signed and notarized; a build on
 * a laptop is not, and must need no setup at all. YAML cannot express that, and
 * the alternatives are worse — a second config file duplicating the first, or a
 * line of `--config.win.azureSignOptions.endpoint=…` flags in the workflow that
 * nobody can read. So the rule lives here, in one place, in code:
 *
 *   **sign with whatever credentials are in the environment, and nothing else.**
 *
 * The workflow decides what is in the environment; this file decides what that
 * means. Nothing here holds a secret — the Azure account names are not secret
 * and come from repository variables, the credentials never appear.
 *
 * `.cjs` and not `.js` because the package is `"type": "module"` and
 * electron-builder loads a `.js` config as ESM. `.cjs` is in its search list
 * (after `.yml`, which is why that file is gone rather than kept alongside).
 */

/**
 * macOS signs from a Developer ID `.p12` handed over as `CSC_LINK`. Without one
 * electron-builder looks in the keychain and, finding nothing, skips signing —
 * which is the behaviour a fresh clone wants.
 */
const signMac = Boolean(process.env.CSC_LINK)

/**
 * Notarization is Apple's queue and it costs ~15 minutes. It is unconditional
 * for a release; `NOTARIZE=false` exists so a manual run of the workflow can
 * exercise everything else without the wait.
 */
const notarizeMac = signMac && process.env.NOTARIZE !== 'false'

/**
 * Windows signs through Azure Trusted Signing. The `.pfx` route is gone — an OV
 * key must live on a token, an HSM or a cloud service — so there is no
 * `WIN_CSC_LINK` here and there never will be.
 *
 * All four fields have to be present together. An `azureSignOptions` block with
 * an empty `endpoint` is rejected by electron-builder's own schema before the
 * request ever reaches Azure, so a half-configured environment must produce no
 * block at all rather than a broken one.
 */
const azure = {
  endpoint: process.env.AZURE_CODE_SIGNING_ENDPOINT,
  codeSigningAccountName: process.env.AZURE_CODE_SIGNING_ACCOUNT,
  certificateProfileName: process.env.AZURE_CODE_SIGNING_PROFILE,
  // Must match the certificate's CommonName *exactly* — the legal name given on
  // the Azure identity validation form, not the product name.
  publisherName: process.env.AZURE_CODE_SIGNING_PUBLISHER,
}
const signWin = Object.values(azure).every(Boolean)

module.exports = {
  appId: 'nl.lionsville.architecture',
  productName: 'Lionsville Architecture Management Tool',
  copyright: 'Copyright © Lionsville Group BV',

  directories: {
    output: 'release',
    buildResources: 'resources',
  },

  // `dependencies` is the list electron-builder copies into the app, so it is
  // kept down to what the app actually reads from node_modules at runtime —
  // which is `electron-updater` and nothing else. Everything the renderer uses
  // is already bundled into `out/renderer` by Vite, and main and preload import
  // nothing but `electron` and node builtins.
  //
  // This is not tidiness. With React, MUI and elk sitting in `dependencies` the
  // asar was 61 MB, of which 55 MB was never opened — paid for on every
  // download, and again in notarization, which charges by the byte hashed.
  // Adding a runtime dependency is therefore a decision, not a convenience.
  files: ['out/**', 'package.json'],

  // The product name has spaces in it, which is right for the Dock and wrong
  // for a download link. Name the artifacts after the package instead.
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',

  // A release that quietly ships unsigned is worse than a release that fails.
  // Only asserted when credentials were supplied, so a local build is unaffected.
  forceCodeSigning: signMac || signWin,

  publish: {
    provider: 'github',
    owner: 'Lionsville',
    repo: 'Lionsville-Architecture-Management-Tool',
    // Load-bearing. The default is `draft`, and electron-builder refuses to
    // upload into an *already published* release when it is publishing drafts —
    // it logs "existing type not compatible with publishing type" and uploads
    // nothing, successfully. This workflow is triggered by a published release,
    // so the type has to say so.
    releaseType: 'release',
  },

  mac: {
    category: 'public.app-category.business',
    // A macOS-specific icon, because the platforms disagree about what an app
    // icon IS. Windows and Linux want full-bleed square artwork; macOS expects
    // the file to already contain Apple's grid — an 824x824 rounded body inset
    // in a 1024x1024 canvas — and does NOT apply that mask itself. Left on the
    // square icon, the app renders as a hard-edged tile visibly larger than
    // every neighbour in the Dock and Launchpad.
    //
    // Both files are generated from public/icon.svg, which is also the app's
    // favicon, so the mark cannot drift between the browser build and the
    // desktop one:  swift scripts/make-icons.swift public/icon.svg resources
    icon: 'resources/icon-mac.png',
    target: [
      // arm64 only. Signing cost scales with bytes hashed and every
      // architecture is a separate notarization submission; if Intel is ever
      // needed the answer is `universal`, not `[arm64, x64]`.
      { target: 'dmg', arch: ['arm64'] },
      // zip is not redundant with dmg: Squirrel.Mac, and therefore
      // electron-updater, can only update from a zip.
      { target: 'zip', arch: ['arm64'] },
    ],
    hardenedRuntime: true,
    entitlements: 'resources/entitlements.mac.plist',
    notarize: notarizeMac,
  },

  win: {
    icon: 'resources/icon.png',
    target: [{ target: 'nsis', arch: ['x64', 'arm64'] }],
    ...(signWin ? { azureSignOptions: azure } : {}),
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },

  linux: {
    category: 'Office',
    icon: 'resources/icon.png',
    target: ['AppImage', 'deb'],
  },
}
