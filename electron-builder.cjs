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
 * This repository's own release builds no installers any more (ADR-0030): the
 * rule is kept for a build composed from this one, whose config starts from
 * this file, and for anybody building their own signed copy of the source.
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
 * for a release; `NOTARIZE=false` exists so a manual run of a release workflow
 * can exercise everything else without the wait.
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

// The product's name is package.json's, which main reads too for the app
// menu: one place, so About <name> and the bundle cannot disagree.
//
// This is a *display* name and may be changed. What it must not drag with it is
// `userData`, which Electron would otherwise derive from it — every install's
// preferences, recents, update settings and agent token live in a folder named
// after whatever this said when they were made. Main pins that path instead
// (`src/platform/userData.ts`), so a rename here costs nobody their settings.
const { productName } = require('./package.json')

module.exports = {
  appId: 'nl.lionsville.architecture',
  productName,
  copyright: 'Copyright © Lionsville Group BV',

  directories: {
    output: 'release',
    buildResources: 'resources',
  },

  // `dependencies` is the list electron-builder copies into the app, and it is
  // now empty: nothing here reads anything from node_modules at runtime.
  // Everything the renderer uses is already bundled into `out/renderer` by Vite,
  // and so is everything main uses: `electron-updater`, the one library main
  // loads (ADR-0030), is a dev dependency like the rest and bundled into
  // `out/main`, so it is in the asar without `node_modules` being there.
  //
  // This is not tidiness. With React, MUI and elk sitting in `dependencies` the
  // asar was 61 MB, of which 55 MB was never opened — paid for on every
  // download, and again in notarization, which charges by the byte hashed.
  // Adding a runtime dependency is therefore a decision, not a convenience.
  //
  // THIRD-PARTY-NOTICES.md rides along for the opposite reason: almost every
  // licence in that bundle asks for its notice to travel with the binary, and
  // with nothing but bundled output in the asar there was nowhere for a reader
  // to find one. It sits at the package root, beside package.json — and so do
  // LICENSE and NOTICE, the AGPL text this build is published under and who
  // holds it, which the licence asks to be given with every copy.
  files: ['out/**', 'package.json', 'THIRD-PARTY-NOTICES.md', 'LICENSE', 'NOTICE'],

  // The drawing editor, outside the asar. `app.min.js` is larger than the
  // renderer budget, so it is not under `out/**`. `build/fetchDrawio.ts`
  // writes the pruned tree; this copies it beside the app, where main serves
  // it on the drawing scheme.
  extraResources: [{ from: 'build/drawio', to: 'drawio' }],

  // The product name has spaces in it, which is right for the Dock and wrong
  // for a download link. Name the artifacts after the package instead.
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',

  /**
   * Double-clicking a working file opens it here.
   *
   * One extension and not two words with a dot between them, which is half of
   * why `.lvarch` exists: Windows cannot reliably associate a double extension
   * and shows `.werkbestand.json` as a JSON file that any other program is
   * welcome to claim.
   *
   * `application/zip` because that is what a version-3 file IS (ADR-0003), and
   * saying otherwise would be a lie the OS repeats to every other tool.
   */
  fileAssociations: [
    {
      ext: 'lvarch',
      name: 'Architecture Working File',
      description: 'Lionsville architecture working file',
      mimeType: 'application/zip',
      role: 'Editor',
      rank: 'Owner',
    },
  ],

  // A release that quietly ships unsigned is worse than a release that fails.
  // Only asserted when credentials were supplied, so a local build is unaffected.
  forceCodeSigning: signMac || signWin,

  // Nobody publishes from this config. This repository's releases carry the
  // source, the web build and the bill of materials, and no installers
  // (ADR-0030), so there is nowhere for electron-builder to upload to — and
  // `null` rather than nothing, because with nothing it guesses a GitHub
  // provider from package.json and, on a CI tag, tries.
  //
  // A build composed from this one that publishes a feed names it here in its
  // own config, as a `generic` provider at the feed's URL. That block is not
  // decoration: it is what makes electron-builder write the `latest*.yml`
  // manifests the feed serves, and `app-update.yml` inside the app, which the
  // updater reads for its download cache and, on Windows, for the publisher
  // whose signature a downloaded installer must carry.
  publish: null,

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
      // Squirrel.Mac, and therefore electron-updater, updates from the zip and
      // from nothing else: a build that registers a feed (ADR-0030) replaces
      // itself from this file, and without it `latest-mac.yml` names nothing
      // the updater can use. It is also the form that survives being emailed
      // or unpacked without a mount.
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
